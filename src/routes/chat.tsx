import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell, useRequireVerified } from "@/components/AppShell";
import { btnClass, inputClass } from "@/components/Field";
import { api, type ChatMessage } from "@/lib/api";
import { usePoll } from "@/lib/use-poll";

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
  const [image, setImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = () =>
    api<{ messages: ChatMessage[] }>("/api/chat")
      .then((r) => setMessages(r.messages))
      .catch(() => {});

  usePoll(load, 10000);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !image) return;
    setSending(true);
    try {
      await api("/api/chat", { body: { text, image } });
      setText("");
      setImage(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  /** Compresses the picked photo so chat images fit comfortably in storage. */
  const pickImage = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only images can be attached");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 800 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setImage(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
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
                {m.image && (
                  <img
                    src={m.image}
                    alt="Shared in chat"
                    className="mb-2 max-h-56 w-full rounded-xl object-cover"
                  />
                )}
                {m.text && <p>{m.text}</p>}
                <p className="mt-1 text-[10px] opacity-70">
                  {m.from === "user" ? "You" : "Admin"} ·{" "}
                  {new Date(m.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="space-y-2 border-t border-border pt-4">
          {image && (
            <div className="flex items-center gap-2">
              <img src={image} alt="Attachment preview" className="size-14 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => setImage(null)}
                className="text-xs font-semibold underline"
              >
                Remove
              </button>
            </div>
          )}
          <div className="flex gap-2">
          <label className="glass grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl text-lg">
            📎
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
            />
          </label>
          <input
            className={inputClass}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your message or note request..."
          />
          <button className={btnClass} disabled={sending}>
            Send
          </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}