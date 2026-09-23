import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Avatar, Button, inputClass } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { ChatPreview } from "../types";

export function ChatsPage() {
  const [chats, setChats] = useState<ChatPreview[]>([]);

  useEffect(() => {
    api<{ chats: ChatPreview[] }>("/api/chats").then((payload) => setChats(payload.chats));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Чаты</h1>
      {chats.length === 0 ? (
        <div className="rounded-3xl bg-panel px-4 py-10 text-center">
          <p className="font-semibold">Чатов пока нет</p>
          <p className="mt-2 text-sm text-mute">Напишите продавцу с карточки объявления</p>
          <Link to="/search" className="mt-4 inline-block">
            <Button>В поиск</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {chats.map((chat) => (
            <Link
              key={chat.id}
              to={`/chats/${chat.id}`}
              className="flex items-center gap-3 rounded-2xl bg-panel px-3 py-3"
            >
              {chat.peer ? (
                <Avatar
                  name={chat.peer.name}
                  hue={chat.peer.avatarHue}
                  photoUrl={chat.peer.photoUrl}
                  size={44}
                />
              ) : null}
              <span className="min-w-0">
                <span className="block font-semibold">
                  {chat.support ? "Чат с поддержкой" : `@${chat.peer?.username}`}
                </span>
                <span className="mt-1 block truncate text-sm text-mute">
                  {chat.lastBody || "Напишите, если нужна помощь"}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChatThreadPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [peer, setPeer] = useState<{ name: string; username: string; avatarHue: number; photoUrl?: string }>();
  const [messages, setMessages] = useState<{ id: string; body: string; mine: boolean }[]>([]);
  const [text, setText] = useState("");

  async function load() {
    const payload = await api<{
      chat: {
        peer: { name: string; username: string; avatarHue: number; photoUrl?: string };
        messages: { id: string; body: string; mine: boolean }[];
      };
    }>(`/api/chats/${id}`);
    setPeer(payload.chat.peer);
    setMessages(payload.chat.messages);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [id]);

  async function send() {
    if (!text.trim()) return;
    await api(`/api/chats/${id}/messages`, { method: "POST", body: { body: text.trim() } });
    setText("");
    await load();
  }

  return (
    <div className="flex min-h-[70dvh] flex-col gap-3">
      <button type="button" className="flex items-center gap-2 text-left" onClick={() => navigate(-1)}>
        {peer ? (
          <Avatar name={peer.name} hue={peer.avatarHue} photoUrl={peer.photoUrl} size={40} />
        ) : null}
        <span>
          <span className="block font-semibold text-signal">@{peer?.username}</span>
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
              message.mine ? "ml-auto bg-signal text-night" : "bg-panel"
            }`}
          >
            {message.body}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className={inputClass}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Сообщение..."
          onKeyDown={(event) => {
            if (event.key === "Enter") send();
          }}
        />
        <Button className="px-3" onClick={send} disabled={!user}>
          →
        </Button>
      </div>
    </div>
  );
}
