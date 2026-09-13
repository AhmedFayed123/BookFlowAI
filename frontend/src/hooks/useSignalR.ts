import { useCallback, useEffect, useRef, useState } from "react";
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  LogLevel,
  type IRetryPolicy,
  type IHttpConnectionOptions,
} from "@microsoft/signalr";
import type { BookingNotification, BookingStatusUpdate } from "../lib/api";

export type SignalRConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

export interface BookingHubEvents {
  ReceiveNewBooking: (payload: BookingNotification) => void;
  ReceiveBookingUpdate: (payload: BookingStatusUpdate) => void;
  BookingStatusUpdated: (payload: BookingStatusUpdate) => void;
}

export interface UseSignalROptions {
  hubUrl?: string;
  accessToken?: string | null;
  autoStart?: boolean;
  onError?: (error: Error | null) => void;
  handlers?: Partial<BookingHubEvents>;
}

const defaultHubUrl = process.env.NEXT_PUBLIC_SIGNALR_URL || "http://localhost:5000/hubs/bookings";
const retryPolicy: IRetryPolicy = {
  nextRetryDelayInMilliseconds: ({ previousRetryCount }) => {
    const delays = [0, 2_000, 5_000, 10_000, 20_000, 30_000];
    return delays[Math.min(previousRetryCount, delays.length - 1)];
  },
};

const resolveAccessToken = () => {
  if (typeof window === "undefined") return "";
  for (const key of ["access_token", "token", "authToken"]) {
    const token = window.localStorage.getItem(key);
    if (token) return token;
  }
  const cookie = document.cookie.split("; ").find((row) => row.startsWith("access_token="));
  return cookie ? decodeURIComponent(cookie.split("=")[1] ?? "") : "";
};

export function useSignalR(options: UseSignalROptions = {}) {
  const { hubUrl = defaultHubUrl, accessToken, autoStart = true } = options;
  // keep a module-scoped singleton per hook instance to reduce rapid remount issues
  const connectionRef = useRef<HubConnection | null>(null);
  const handlersRef = useRef<Partial<BookingHubEvents>>(options.handlers ?? {});
  const onErrorRef = useRef(options.onError);
  const startRef = useRef<(() => Promise<void>) | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const stoppingRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<SignalRConnectionStatus>("disconnected");
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => { handlersRef.current = options.handlers ?? {}; }, [options.handlers]);
  useEffect(() => { onErrorRef.current = options.onError; }, [options.onError]);

  const updateStatus = useCallback((status: SignalRConnectionStatus, nextError: Error | null = null) => {
    if (!mountedRef.current) return;
    setConnectionStatus(status);
    setIsConnected(status === "connected");
    setError(nextError);
    onErrorRef.current?.(nextError);
  }, []);

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const buildConnection = useCallback(() => {
    const useWebSocket = process.env.NEXT_PUBLIC_SIGNALR_USE_WEBSOCKET === "true";
    const urlOptions: IHttpConnectionOptions = {
      withCredentials: true,
      accessTokenFactory: () => accessToken ?? resolveAccessToken(),
    };
    if (useWebSocket) {
      // prefer direct websocket transport when backend supports it to skip negotiation races
      // NOTE: enable by setting NEXT_PUBLIC_SIGNALR_USE_WEBSOCKET=true in your env
      // This sets skipNegotiation and forces WebSocket transport
      urlOptions.skipNegotiation = true;
      urlOptions.transport = HttpTransportType.WebSockets;
    }

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, urlOptions)
      .withAutomaticReconnect(retryPolicy)
      // reduce library noise; we'll handle and suppress negotiation/abort cases explicitly
      .configureLogging(LogLevel.Error)
      .build();

    connection.on("ReceiveNewBooking", (payload: BookingNotification) => handlersRef.current.ReceiveNewBooking?.(payload));
    connection.on("ReceiveBookingUpdate", (payload: BookingStatusUpdate) => handlersRef.current.ReceiveBookingUpdate?.(payload));
    connection.on("BookingStatusUpdated", (payload: BookingStatusUpdate) => handlersRef.current.BookingStatusUpdated?.(payload));
    connection.onreconnecting((nextError) => updateStatus("reconnecting", nextError ?? null));
    connection.onreconnected(() => updateStatus("connected"));
    connection.onclose((nextError) => {
      if (!stoppingRef.current) updateStatus(nextError ? "error" : "disconnected", nextError ?? null);
    });
    return connection;
  }, [accessToken, hubUrl, updateStatus]);

  const start = useCallback(async () => {
    clearRetry();
    stoppingRef.current = false;
    let connection = connectionRef.current;
    if (!connection) {
      connection = buildConnection();
      connectionRef.current = connection;
    }

    // Only attempt to start if the connection is fully disconnected
    if (connection.state !== HubConnectionState.Disconnected) return;

    updateStatus("connecting");
    try {
      await connection.start();
      updateStatus("connected");
    } catch (caught) {
      // Normalize error text from different thrown shapes
      let errMessage = "";
      if (caught instanceof Error) errMessage = caught.message;
      else if (typeof caught === "string") errMessage = caught;
      else if (caught != null) errMessage = String(caught);
      const msg = (errMessage || "").toLowerCase();

      // Patterns that indicate negotiation/abort races or transient network aborts
      const transientPatterns = [
        "stopped during negotiation",
        "the connection was stopped during negotiation",
        "failed to start the connection",
        "aborterror",
        "aborted",
        "networkerror",
        "fetch failed",
      ];

      if (transientPatterns.some((p) => msg.includes(p))) {
        // benign during hot reloads / strict-mode double renders — do not escalate
        console.debug("SignalR transient startup error (suppressed):", errMessage || caught);
        updateStatus("disconnected", null);
        if (mountedRef.current && !stoppingRef.current) {
          retryTimerRef.current = window.setTimeout(() => { void startRef.current?.(); }, 5_000);
        }
        return;
      }

      const nextError = caught instanceof Error ? caught : new Error(errMessage || "Live updates are unavailable.");
      updateStatus("error", nextError);
      if (mountedRef.current && !stoppingRef.current) {
        retryTimerRef.current = window.setTimeout(() => { void startRef.current?.(); }, 5_000);
      }
    }
  }, [buildConnection, clearRetry, updateStatus]);

  useEffect(() => { startRef.current = start; }, [start]);

  const stop = useCallback(async () => {
    stoppingRef.current = true;
    clearRetry();
    const connection = connectionRef.current;
    // do not call stop while the connection is connecting or reconnecting to avoid aborting negotiation
    if (connection) {
      if (connection.state === HubConnectionState.Connected) {
        try {
          await connection.stop();
        } catch (e) {
          // ignore stop errors during shutdown
            console.warn("SignalR stop() failed:", e);
        }
      } else {
        // Skip stopping during Connecting/Reconnecting states to avoid negotiation aborts
        console.info("Skipping SignalR.stop() because connection is not connected (state=", connection.state, ")");
      }
    }
    connectionRef.current = null;
    updateStatus("disconnected");
  }, [clearRetry, updateStatus]);

  const invoke = useCallback(async <TResult = unknown>(method: string, ...args: unknown[]): Promise<TResult> => {
    const connection = connectionRef.current;
    if (!connection || connection.state !== HubConnectionState.Connected) {
      throw new Error("Live updates are not connected.");
    }
    return connection.invoke<TResult>(method, ...args);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (autoStart) void start();
    return () => {
      mountedRef.current = false;
      stoppingRef.current = true;
      clearRetry();
      const connection = connectionRef.current;
      // Avoid stopping while connecting/reconnecting — that can abort negotiation requests.
      if (connection) {
        if (connection.state === HubConnectionState.Connected) {
          void connection.stop().catch(() => {/* ignore */ });
        } else {
          // when unmounting during a connect, leave the connection alone; it will either succeed or be closed by the runtime
            console.info("Unmounted during SignalR connect; not calling stop() to avoid negotiation abort.");
        }
      }
      connectionRef.current = null;
    };
  }, [autoStart, clearRetry, start]);

  return {
    start,
    stop,
    reconnect: start,
    invoke,
    joinAdminGroup: () => invoke("JoinAdminGroup"),
    joinStaffGroup: (staffId: number) => invoke("JoinStaffGroup", staffId),
    isConnected,
    connectionStatus,
    error,
  };
}

export default useSignalR;
