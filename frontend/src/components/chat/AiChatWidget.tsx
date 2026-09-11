"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  aiApi,
  type ChatRequestDto,
  type ChatResponseDto,
} from "../../lib/api";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
  timestamp: string;
};

const STORAGE_SESSION_KEY = "bookflowai:chat:sessionId";
const STORAGE_HISTORY_KEY = "bookflowai:chat:history";

const createSessionId = (): string =>
  `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getTimestamp = (): string => new Date().toISOString();

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const renderMarkdown = (value: string): string => {
  const escaped = escapeHtml(value)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  const segments = escaped.split("\n");
  const htmlSegments: string[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const paragraph = paragraphBuffer.join("<br />");
    htmlSegments.push(`<p>${paragraph}</p>`);
    paragraphBuffer = [];
  };

  const renderInline = (text: string): string =>
    text
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/_(.+?)_/g, "<em>$1</em>");

  for (const segment of segments) {
    const trimmed = segment.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      flushParagraph();
      const items = [trimmed.replace(/^[-*]\s*/, "")];
      htmlSegments.push(
        `<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`,
      );
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushParagraph();
      htmlSegments.push(
        `<h3>${renderInline(trimmed.replace(/^#\s*/, ""))}</h3>`,
      );
      continue;
    }

    paragraphBuffer.push(renderInline(trimmed));
  }

  flushParagraph();

  return htmlSegments.join("");
};

const getInitialMessages = (): ChatMessage[] => {
  if (typeof window === "undefined") return [];

  try {
    const rawHistory = window.localStorage.getItem(STORAGE_HISTORY_KEY);
    if (!rawHistory) return [];

    const parsed = JSON.parse(rawHistory) as ChatMessage[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item) =>
        item &&
        typeof item.role === "string" &&
        typeof item.content === "string",
    );
  } catch {
    return [];
  }
};

const getOrCreateSessionId = (): string => {
  if (typeof window === "undefined") return createSessionId();

  const existing = window.localStorage.getItem(STORAGE_SESSION_KEY);
  if (existing) return existing;

  const nextSessionId = createSessionId();
  window.localStorage.setItem(STORAGE_SESSION_KEY, nextSessionId);
  return nextSessionId;
};

const tryChatRequest = async (
  payload: ChatRequestDto,
): Promise<ChatResponseDto> => {
  const chatMethod = (
    aiApi as unknown as {
      chat?: (data: ChatRequestDto) => Promise<ChatResponseDto>;
    }
  ).chat;

  if (typeof chatMethod === "function") {
    return chatMethod(payload);
  }

  return aiApi.sendChatMessage(payload);
};

export default function AiChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  // Initialize empty on first render (server + client) to avoid SSR hydration
  // mismatches. Load persisted history after mount in an effect.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const lastAssistantMessage = useMemo(
    () => messages.filter((m) => m.role === "assistant").slice(-1)[0],
    [messages],
  );

  useEffect(() => {
    const timer = window.setTimeout(
      () => setSessionId(getOrCreateSessionId()),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      STORAGE_SESSION_KEY,
      sessionId || getOrCreateSessionId(),
    );
  }, [sessionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(messages));
  }, [messages]);

  // Load persisted messages after mount to avoid hydration mismatches
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const initial = getInitialMessages();
      if (initial.length) setMessages(initial);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen, isMinimized]);

  const appendMessage = (role: ChatRole, content: string) => {
    setMessages((current) => [
      ...current,
      {
        role,
        content,
        timestamp: getTimestamp(),
      },
    ]);
  };

  const handleSend = async (retryText?: string) => {
    const nextMessage = (retryText ?? input).trim();
    if (!nextMessage || isLoading) return;

    setError(null);
    const userMessage = nextMessage;
    setInput("");
    appendMessage("user", userMessage);
    setIsLoading(true);

    try {
      const historyForRequest = messages
        .slice(-12)
        .map((message) => ({ role: message.role, content: message.content }));

      const payload: ChatRequestDto = {
        businessId: 1,
        sessionId,
        message: userMessage,
        conversationHistory: historyForRequest,
      };

      const response = await tryChatRequest(payload);
      const assistantReply =
        response.reply ||
        "عذراً، لم أتمكن من الحصول على ردٍّ من المساعد الذكي في هذه اللحظة.";
      const finalSessionId =
        response.sessionId || sessionId || getOrCreateSessionId();
      setSessionId(finalSessionId);
      appendMessage("assistant", assistantReply);
      setError(null);
    } catch (requestError) {
      const message =
        requestError instanceof Error && requestError.message
          ? requestError.message
          : "تعذّر الوصول إلى خدمة الذكاء الاصطناعي. حاول مرة أخرى.";

      setError(message);
      appendMessage(
        "assistant",
        `تعذّر الاتصال بالخدمة الذكية. ${
          message
        }\n\nيمكنك إعادة المحاولة الآن أو إرسال الرسالة مرة أخرى.`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    const lastUserText = [...messages]
      .reverse()
      .find((m) => m.role === "user")?.content;
    if (lastUserText) {
      void handleSend(lastUserText);
      return;
    }

    setError(null);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen && (
        <button
          type="button"
          aria-label="Open AI assistant"
          onClick={() => setIsOpen(true)}
          className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 text-white shadow-[0_18px_45px_rgba(79,70,229,0.45)] transition-all duration-300 hover:scale-105 hover:shadow-[0_18px_50px_rgba(59,130,246,0.5)]"
        >
          <div className="absolute inset-0 animate-pulse rounded-full bg-white/10" />
          <svg
            viewBox="0 0 24 24"
            className="relative h-7 w-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M12 4a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V8a4 4 0 0 1 4-4Z" />
            <path d="M6 14c0-2.2 2.7-4 6-4s6 1.8 6 4v1.5A2.5 2.5 0 0 1 15.5 18h-7A2.5 2.5 0 0 1 6 15.5V14Z" />
            <path d="M9 19h6" />
          </svg>
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-[9px] font-bold text-white">
            AI
          </span>
        </button>
      )}

      <div
        className={`absolute bottom-0 right-0 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-all duration-300 ${
          isOpen
            ? "visible w-[380px] translate-y-0 opacity-100"
            : "invisible w-[380px] translate-y-4 opacity-0"
        } ${isMinimized ? "h-[76px]" : "h-[560px]"}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M12 4a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V8a4 4 0 0 1 4-4Z" />
                <path d="M6 14c0-2.2 2.7-4 6-4s6 1.8 6 4v1.5A2.5 2.5 0 0 1 15.5 18h-7A2.5 2.5 0 0 1 6 15.5V14Z" />
              </svg>
            </div>

            <div>
              <div className="text-sm font-semibold">BookFlow AI Assistant</div>
              <div className="text-[11px] text-violet-100">
                {isLoading ? "Thinking..." : "Online now"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMinimized((value) => !value)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg font-semibold transition hover:bg-white/20"
              aria-label="Minimize chat"
            >
              {isMinimized ? "▢" : "—"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsMinimized(false);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg font-semibold transition hover:bg-white/20"
              aria-label="Close chat"
            >
              ×
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            <div
              ref={scrollRef}
              className="h-[420px] space-y-4 overflow-y-auto bg-slate-50 px-4 py-4"
            >
              {/* Render a stable placeholder on server and until client mount to avoid hydration mismatch */}
              {!mounted && (
                <div className="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
                  Ask about services, pricing, or your booking schedule.
                </div>
              )}

              {mounted && messages.length === 0 && (
                <div className="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
                  Ask about services, pricing, or your booking schedule.
                </div>
              )}

              {mounted &&
                messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}-${message.timestamp}`}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`flex max-w-[82%] items-start gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                    >
                      <div
                        className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          message.role === "user"
                            ? "bg-gradient-to-br from-sky-500 to-cyan-500 text-white"
                            : "bg-gradient-to-br from-violet-500 to-indigo-500 text-white"
                        }`}
                      >
                        {message.role === "user" ? "YOU" : "AI"}
                      </div>

                      <div
                        className={`rounded-2xl px-3 py-2 text-sm shadow-sm ring-1 ${
                          message.role === "user"
                            ? "bg-gradient-to-r from-sky-500 to-cyan-500 text-white ring-sky-400/30"
                            : "bg-white text-slate-700 ring-slate-200"
                        }`}
                      >
                        <div
                          className="break-words leading-relaxed [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[12px] [&_code]:text-violet-700 [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold"
                          dangerouslySetInnerHTML={{
                            __html: renderMarkdown(message.content),
                          }}
                        />
                        <div
                          className={`mt-2 text-[10px] ${message.role === "user" ? "text-sky-100" : "text-slate-400"}`}
                        >
                          {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex max-w-[82%] items-start gap-2">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-[10px] font-bold text-white">
                      AI
                    </div>
                    <div className="rounded-2xl bg-white px-3 py-3 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.2s]" />
                        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.1s]" />
                        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-violet-400" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && !isLoading && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 shadow-sm">
                  <div className="font-medium">
                    Unable to reach the AI service
                  </div>
                  <div className="mt-1">{error}</div>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="mt-3 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500"
                  >
                    Retry last message
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-white p-3">
              <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-inner">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Ask BookFlow AI..."
                  className="flex-1 border-0 bg-transparent px-2 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  disabled={!input.trim() || isLoading}
                  onClick={() => void handleSend()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Send message"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12h13" />
                    <path d="m13 5 7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  {sessionId
                    ? `Session: ${sessionId.slice(0, 12)}...`
                    : "New session"}
                </span>
                <span>{lastAssistantMessage ? "Context active" : "Ready"}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
