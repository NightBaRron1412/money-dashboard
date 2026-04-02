"use client";

import { useState, useRef, useEffect } from "react";
import { PageHeader } from "../components/money-ui";
import { Send, Loader2, MessageSquare, Sparkles } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  ts: number;
}

const DEMO_MESSAGES: ChatMessage[] = [
  { role: "user", text: "How much did I spend on food this month?", ts: Date.now() - 60000 },
  {
    role: "assistant",
    text: "You've spent about $134 on Food this month — $92 at Metro for groceries and $42 via Uber Eats on your Visa. That's fairly typical compared to your 3-month average of $120/month in this category.",
    ts: Date.now() - 55000,
  },
  { role: "user", text: "Am I on track with my savings goals?", ts: Date.now() - 30000 },
  {
    role: "assistant",
    text: "Your Emergency Fund is at $9,200 of $20,000 — about 46% there. At your current savings rate (~$1,850/month after expenses), you should hit the target in roughly 6 months, which puts you ahead of your goal date. Your Condo Down Payment ($3,000 of $80,000) will take longer at current rates — roughly 3.5 years. Consider increasing your investing allocation if you want to accelerate it.",
    ts: Date.now() - 25000,
  },
];

export function ChatContent({
  demoMode = false,
}: {
  demoMode?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    demoMode ? DEMO_MESSAGES : []
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", text, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const endpoint = demoMode ? "/api/ai/demo-chat" : "/api/ai/chat";

    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      const data = await res.json();
      const reply = res.ok
        ? (data.reply || "Sorry, I couldn't generate a response.")
        : (data.error || data.reply || "Something went wrong. Please try again.");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: reply, ts: Date.now() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Something went wrong. Please try again.",
          ts: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <PageHeader
        title="AI Finance Chat"
        description="Ask questions about your money"
      />

      <div data-tour="chat-panel" className="flex flex-col rounded-2xl border border-border-subtle bg-bg-secondary" style={{ height: "calc(100dvh - 200px)", minHeight: 400 }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-purple/10 mb-4">
                <Sparkles className="h-8 w-8 text-accent-purple" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Ask me anything about your finances
              </h3>
              <p className="text-sm text-text-secondary max-w-md mb-6">
                I can analyze your spending, predict goals, compare months, and more.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "How much did I spend this month?",
                  "What's my savings rate trend?",
                  "Which category costs me the most?",
                  "Am I on track for my goals?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setInput(q);
                    }}
                    className="rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-secondary transition hover:border-accent-purple/40 hover:text-text-primary"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={`${msg.ts}-${i}`}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-accent-purple text-white"
                    : "bg-bg-elevated text-text-primary border border-border-subtle"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="mb-1 flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3 text-accent-purple" />
                    <span className="text-[10px] font-medium text-accent-purple">AI</span>
                  </div>
                )}
                <p className="whitespace-pre-line">{msg.text}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-bg-elevated border border-border-subtle px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-accent-purple" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border-subtle p-4">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances…"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-border-subtle bg-bg-elevated px-4 py-3 text-sm text-text-primary outline-none focus:border-accent-purple placeholder:text-text-secondary"
              style={{ maxHeight: 120 }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-accent-purple text-white transition hover:bg-accent-purple/80 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
