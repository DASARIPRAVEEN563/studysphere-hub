import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell, useRequireVerified } from "@/components/AppShell";
import { btnClass, inputClass } from "@/components/Field";
import { api, type ChatMessage } from "@/lib/api";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat with Admin | Students Ka Notes Sharing Hub" },
      {
        name: "description",
        content:
          "Message the admin directly for enquiries, requests for notes and any help you need.",
      },
      { property: "og:title", content: "Chat with Admin | Students Ka Notes Sharing Hub" },
      { property: "og:description", content: "Direct messages, enquiries and note requests." },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const user = useRequireVerified();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = () =>
    api<{ messages: ChatMessage[] }>("/api/chat")
      .then((r) => setMessages(r.messages))
      .catch(() => {});

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await api("/api/chat", { body: { text } });
      setText("");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell title="Chat with Admin">
      <div className="glass animate-rise mx-auto flex h-[65vh] max-w-3xl flex-col rounded-3xl p-6">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <span className="hero-gradient grid size-10 place-items-center rounded-xl text-lg">💬</span>
          <div>
            <p className="font-black">Admin Support</p>
            <p className="text-muted-foreground text-xs">
              Messages, enquiries and notes requests · {user?.registrationId}
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto py-4">
          {!messages.length && (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Say hi 👋 — ask the admin for any notes you need.
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`animate-rise flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.from === "user" ? "hero-gradient text-white" : "glass"
                }`}
              >
                <p>{m.text}</p>
                <p className="mt-1 text-[10px] opacity-70">
                  {m.from === "user" ? "You" : "Admin"} ·{" "}
                  {new Date(m.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="flex gap-2 border-t border-border pt-4">
          <input
            className={inputClass}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your message or note request..."
          />
          <button className={btnClass} disabled={sending}>
            Send
          </button>
        </form>
      </div>
    </AppShell>
  );
}