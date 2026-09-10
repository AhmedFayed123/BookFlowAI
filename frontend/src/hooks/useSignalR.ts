import { useCallback, useEffect, useRef, useState } from "react";
import {
    HubConnection,
    HubConnectionBuilder,
    HubConnectionState,
    LogLevel,
} from "@microsoft/signalr";

import type {
    BookingNotification,
    BookingStatusUpdate,
} from "../lib/api";

export type SignalRConnectionStatus =
    | "connecting"
    | "connected"
    | "reconnecting"
    | "disconnected"
    | "error";

export interface BookingHubEvents {
    ReceiveNewBooking: (payload: BookingNotification) => void;
    ReceiveBookingUpdate: (payload: BookingStatusUpdate) => void;
    BookingStatusUpdated: (payload: BookingStatusUpdate) => void;
}

export interface UseSignalROptions<TEvents extends object = BookingHubEvents> {
    hubUrl?: string;
    accessToken?: string | null;
    autoStart?: boolean;
    onError?: (error: Error | null) => void;
    handlers?: Partial<TEvents>;
}

const DEFAULT_HUB_URL =
    process.env.NEXT_PUBLIC_SIGNALR_URL || "http://localhost:5000/hubs/bookings";

const resolveAccessToken = (): string => {
    if (typeof window === "undefined") {
        return "";
    }

    const candidates = ["access_token", "token", "authToken"];
    for (const key of candidates) {
        const value = window.localStorage.getItem(key);
        if (value) {
            return value;
        }
    }

    const cookieValue = document.cookie
        .split("; ")
        .find((row) => row.startsWith("access_token="));

    if (!cookieValue) {
        return "";
    }

    return decodeURIComponent(cookieValue.split("=")[1] ?? "");
};

export function useSignalR<TEvents extends object = BookingHubEvents>(
    options: UseSignalROptions<TEvents> = {},
) {
    const {
        hubUrl = DEFAULT_HUB_URL,
        accessToken,
        autoStart = true,
        onError,
        handlers = {} as Partial<TEvents>,
    } = options;

    const connectionRef = useRef<HubConnection | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<SignalRConnectionStatus>("disconnected");
    const [error, setError] = useState<Error | null>(null);

    const start = useCallback(async () => {
        if (connectionRef.current) {
            if (connectionRef.current.state === HubConnectionState.Connected) {
                return;
            }

            if (connectionRef.current.state === HubConnectionState.Connecting) {
                return;
            }
        }

        const tokenToUse = accessToken ?? resolveAccessToken();

        const connection = new HubConnectionBuilder()
            .withUrl(hubUrl, {
                withCredentials: true,
                accessTokenFactory: () => tokenToUse,
            })
            .withAutomaticReconnect([0, 2000, 5000, 10000])
            .configureLogging(LogLevel.Warning)
            .build();

        connectionRef.current = connection;
        setConnectionStatus("connecting");

        Object.entries(handlers as Record<string, (...args: any[]) => void>).forEach(
            ([eventName, listener]) => {
                if (typeof listener === "function") {
                    connection.on(eventName, (...args: unknown[]) => listener(...(args as any[])));
                }
            },
        );

        connection.onreconnecting((err) => {
            setConnectionStatus("reconnecting");
            setIsConnected(false);
            if (err) {
                setError(err);
            }
        });

        connection.onreconnected(() => {
            setConnectionStatus("connected");
            setIsConnected(true);
            setError(null);
        });

        connection.onclose((err) => {
            setConnectionStatus("disconnected");
            setIsConnected(false);
            if (err) {
                setError(err);
            }
        });

        try {
            await connection.start();
            setConnectionStatus("connected");
            setIsConnected(true);
            setError(null);
            onError?.(null);
        } catch (err) {
            const nextError = err instanceof Error ? err : new Error("SignalR connection failed");
            setConnectionStatus("error");
            setIsConnected(false);
            setError(nextError);
            onError?.(nextError);
        }
    }, [accessToken, handlers, hubUrl, onError]);

    const stop = useCallback(async () => {
        if (!connectionRef.current) {
            return;
        }

        try {
            await connectionRef.current.stop();
        } finally {
            setIsConnected(false);
            setConnectionStatus("disconnected");
            connectionRef.current = null;
        }
    }, []);

    const invoke = useCallback(async <TResult = unknown>(method: string, ...args: unknown[]): Promise<TResult> => {
        if (!connectionRef.current) {
            throw new Error("SignalR connection is not initialized.");
        }

        if (connectionRef.current.state !== HubConnectionState.Connected) {
            throw new Error(`SignalR connection is not connected: ${connectionRef.current.state}`);
        }

        return connectionRef.current.invoke<TResult>(method, ...args);
    }, []);

    const joinAdminGroup = useCallback(async () => {
        await invoke("JoinAdminGroup");
    }, [invoke]);

    const joinStaffGroup = useCallback(async (staffId: number) => {
        await invoke("JoinStaffGroup", staffId);
    }, [invoke]);

    useEffect(() => {
        if (!autoStart) {
            return;
        }

        void start();

        return () => {
            void stop();
        };
    }, [autoStart, start, stop]);

    return {
        connection: connectionRef.current,
        start,
        stop,
        invoke,
        joinAdminGroup,
        joinStaffGroup,
        isConnected,
        connectionStatus,
        error,
    };
}

export default useSignalR;
