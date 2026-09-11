import { useCallback, useEffect, useRef, useState } from "react";
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
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
  const { hubUrl = defaultHubUrl, accessToken, autoStart = true, onError, handlers = {} } = options;
  const connectionRef = useRef<HubConnection | null>(null);
  const handlersRef = useRef<Partial<BookingHubEvents>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<SignalRConnectionStatus>("disconnected");
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => { handlersRef.current = handlers; }, [handlers]);

  const start = useCallback(async () => {
    if (connectionRef.current?.state === HubConnectionState.Connected
      || connectionRef.current?.state === HubConnectionState.Connecting) return;

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, { withCredentials: true, accessTokenFactory: () => accessToken ?? resolveAccessToken() })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on("ReceiveNewBooking", (payload: BookingNotification) => handlersRef.current.ReceiveNewBooking?.(payload));
    connection.on("ReceiveBookingUpdate", (payload: BookingStatusUpdate) => handlersRef.current.ReceiveBookingUpdate?.(payload));
    connection.on("BookingStatusUpdated", (payload: BookingStatusUpdate) => handlersRef.current.BookingStatusUpdated?.(payload));
    connection.onreconnecting((nextError) => { setConnectionStatus("reconnecting"); setIsConnected(false); if (nextError) setError(nextError); });
    connection.onreconnected(() => { setConnectionStatus("connected"); setIsConnected(true); setError(null); });
    connection.onclose((nextError) => { setConnectionStatus("disconnected"); setIsConnected(false); if (nextError) setError(nextError); });
    connectionRef.current = connection;
    setConnectionStatus("connecting");

    try {
      await connection.start();
      setConnectionStatus("connected");
      setIsConnected(true);
      setError(null);
      onError?.(null);
    } catch (caught) {
      const nextError = caught instanceof Error ? caught : new Error("SignalR connection failed");
      setConnectionStatus("error");
      setError(nextError);
      onError?.(nextError);
    }
  }, [accessToken, hubUrl, onError]);

  const stop = useCallback(async () => {
    const connection = connectionRef.current;
    if (!connection) return;
    connectionRef.current = null;
    await connection.stop();
    setIsConnected(false);
    setConnectionStatus("disconnected");
  }, []);

  const invoke = useCallback(async <TResult = unknown>(method: string, ...args: unknown[]): Promise<TResult> => {
    const connection = connectionRef.current;
    if (!connection || connection.state !== HubConnectionState.Connected)
      throw new Error("SignalR connection is not connected.");
    return connection.invoke<TResult>(method, ...args);
  }, []);

  useEffect(() => {
    if (!autoStart) return;
    const timer = window.setTimeout(() => { void start(); }, 0);
    return () => { window.clearTimeout(timer); void stop(); };
  }, [autoStart, start, stop]);

  return {
    start,
    stop,
    invoke,
    joinAdminGroup: () => invoke("JoinAdminGroup"),
    joinStaffGroup: (staffId: number) => invoke("JoinStaffGroup", staffId),
    isConnected,
    connectionStatus,
    error,
  };
}

export default useSignalR;
