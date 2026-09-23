"use client";

import { useEffect, useRef, useState } from "react";
import ActionIcon from "../../components/ui/ActionIcon";
import {
  aiApi,
  type ChatRequestDto,
  type ChatResponseDto,
} from "../../lib/api";

import { ChevronDown, ChevronUp, MessageCircle, RotateCcw, Send, Sparkles, ArrowUpRight } from "lucide-react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
  timestamp: string;
  durationMs?: number;
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

const quickActions = ["How to book?", "Services available", "Change or cancel a booking"];

export default function AiChatWidget() {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mounted, setMounted] = useState(false);
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setMessages(getInitialMessages());
        setSessionId(getOrCreateSessionId());
      } catch {
        setSessionId(createSessionId());
      }
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const receivePrompt = (event: Event) => {
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (!prompt) return;
      setIsMinimized(false);
      setInput(prompt);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    };
    window.addEventListener("bookflow:ai-prompt", receivePrompt);
    return () => window.removeEventListener("bookflow:ai-prompt", receivePrompt);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(STORAGE_SESSION_KEY, sessionId);
      window.localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(messages));
    } catch {
      // Storage restrictions should not prevent a conversation.
    }
  }, [mounted, messages, sessionId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading, isMinimized]);

  useEffect(() => {
    if (!isLoading) return;
    const timer = window.setInterval(() => setWaitingSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isLoading]);

  const handleSend = async (suggestion?: string, isRetry = false) => {
    const text = (suggestion ?? input).trim();
    if (!text || isLoading || !mounted) return;
    setError(null);
    setInput("");
    setWaitingSeconds(0);
    setIsLoading(true);
    if (!isRetry) setMessages((current) => [...current, { role: "user", content: text, timestamp: getTimestamp() }]);
    const started = performance.now();

    try {
      const response = await tryChatRequest({
        businessId: 1,
        sessionId,
        message: text,
        conversationHistory: (isRetry ? messages.slice(0, -1) : messages)
          .slice(-12).map(({ role, content }) => ({ role, content })),
      });
      setSessionId(response.sessionId || sessionId);
      setMessages((current) => [...current, {
        role: "assistant",
        content: response.reply || "I couldn't prepare a reply. Please try again.",
        timestamp: getTimestamp(),
        durationMs: performance.now() - started,
      }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn't reach the assistant. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const retry = () => {
    const lastMessage = [...messages].reverse().find((message) => message.role === "user");
    if (lastMessage) void handleSend(lastMessage.content, true);
  };

  const reset = () => {
    setMessages([]);
    setSessionId(createSessionId());
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <section className="surface-card overflow-hidden rounded-3xl shadow-[0_24px_70px_-36px_rgba(15,23,42,.35)]" aria-label="BookFlow booking assistant">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md shadow-indigo-500/20"><MessageCircle className="h-4 w-4" /></span>
          <div><h2 className="text-sm font-semibold text-slate-900">A little help with your booking</h2><p className="mt-0.5 text-xs text-slate-500">BookFlow assistant · AI-assisted guidance</p></div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={reset} disabled={isLoading || !mounted || messages.length === 0} aria-label="Start new conversation" title="Start new conversation" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-30"><RotateCcw className="h-4 w-4" /></button>
          <button type="button" onClick={() => setIsMinimized((value) => !value)} aria-label={isMinimized ? "Expand assistant" : "Collapse assistant"} aria-expanded={!isMinimized} aria-controls="booking-chat-body" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-50">{isMinimized ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}</button>
        </div>
      </header>

      {!isMinimized && (
        <div id="booking-chat-body">
          <div ref={scrollRef} role="log" aria-label="Booking conversation" aria-live="polite" aria-relevant="additions" className="h-64 space-y-4 overflow-y-auto overscroll-contain bg-slate-50/70 px-5 py-5 sm:h-72">
            {messages.length === 0 && (
              <div className="soft-enter max-w-sm rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm"><span className="mb-4 grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600"><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
                <p className="text-base font-medium leading-6 text-slate-800">Not sure where to start?</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">Ask about booking a service, choosing a provider, or managing your appointments. We can help you find the next step.</p>
                <p className="mt-4 text-xs text-slate-500">Choose a question below, or ask in your own words.</p>
              </div>
            )}

            {messages.map((message, index) => (
              <div key={message.timestamp + index} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className="max-w-[90%] min-w-0">
                  <p className={`mb-1.5 text-xs font-medium ${message.role === "user" ? "text-right text-slate-500" : "text-emerald-800"}`}>{message.role === "user" ? "You" : "BookFlow"}</p>
                  <div className={`rounded-2xl border px-4 py-3 text-sm ${message.role === "user" ? "rounded-tr-sm border-indigo-600 bg-indigo-600 text-white" : "rounded-tl-sm border-slate-200 bg-white text-slate-700 shadow-sm"}`}>
                    <div dir="auto" className="break-words leading-6 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:text-emerald-800 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_h3]:font-semibold" dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
                  </div>
                  <p className={`mt-1.5 text-[11px] text-slate-500 ${message.role === "user" ? "text-right" : ""}`}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {message.durationMs !== undefined && ` · Replied in ${(message.durationMs / 1000).toFixed(1)}s`}
                  </p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div role="status" className="flex items-center gap-3 py-2 text-xs text-slate-500">
                <span aria-hidden="true" className="flex gap-1">{[0, 1, 2].map((dot) => <span key={dot} className="h-1.5 w-1.5 typing-dot rounded-full bg-slate-500" style={{ animationDelay: `${dot * 180}ms` }} />)}</span>
                Preparing your reply{waitingSeconds > 0 ? ` · ${waitingSeconds}s` : "…"}
              </div>
            )}
          </div>

          {error && (
            <div role="alert" className="mx-5 mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p>{error}</p><button type="button" onClick={retry} disabled={isLoading} className="mt-2 text-xs font-semibold underline underline-offset-4 disabled:opacity-40"><ActionIcon action="retry" />Retry last message</button>
            </div>
          )}

          <div className="border-t border-slate-200/80 p-4">
            <div className="mb-3 flex flex-wrap gap-2" aria-label="Suggested questions">
              {quickActions.map((action) => <button key={action} type="button" onClick={() => void handleSend(action)} disabled={isLoading || !mounted} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 disabled:opacity-40">{action}<ArrowUpRight className="h-3 w-3 opacity-50" aria-hidden="true" /></button>)}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); void handleSend(); }} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-400/20">
              <input ref={inputRef} aria-label="Message the booking assistant" dir="auto" type="text" value={input} onChange={(event) => setInput(event.target.value)} placeholder="What can we help with?" className="min-w-0 flex-1 rounded-lg border-0 bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-500 focus-visible:outline-none" />
              <button type="submit" disabled={!input.trim() || isLoading || !mounted} aria-label="Send message" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg button-primary text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"><Send className="h-4 w-4" /></button>
            </form>
            <p className="mt-3 text-[11px] leading-4 text-slate-500">AI guidance may be incomplete. Confirm details before booking.</p>
          </div>
        </div>
      )}
    </section>
  );
}
