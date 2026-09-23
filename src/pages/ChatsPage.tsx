import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Avatar, Button, inputClass } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate, roleLabel } from "../lib/format";
import type { ChatMessage, ChatPreview } from "../types";

export function ChatsPage() {
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    api<{ chats: ChatPreview[] }>("/api/chats").then((payload) => setChats(payload.chats));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Чаты</h1>
      <Link to="/chats/global" className="flex items-center gap-3 rounded-2xl bg-signal/15 px-3 py-3">
        <span className="grid size-11 place-items-center rounded-full bg-signal text-night font-bold">#</span>
        <span>
          <span className="block font-semibold">Общий чат</span>
          <span className="text-sm text-mute">Все пользователи, модераторы и владелец</span>
        </span>
      </Link>
      {chats.length === 0 ? (
        <div className="rounded-3xl bg-panel px-4 py-10 text-center">
          <p className="font-semibold">Личных чатов пока нет</p>
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
                  {chat.support
                    ? user && (user.role === "moderator" || user.role === "owner") && chat.peer?.username !== "support"
                      ? `Поддержка · @${chat.peer?.username}`
                      : "Чат с поддержкой"
                    : `@${chat.peer?.username}`}
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
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const global = id === "global";
  const staff = user?.role === "moderator" || user?.role === "owner";
  const [peer, setPeer] = useState<{
    name: string;
    username: string;
    avatarHue: number;
    photoUrl?: string;
    id?: string;
    role?: string;
  }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [locked, setLocked] = useState(false);
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [muteHours, setMuteHours] = useState("24");

  async function load() {
    const payload = await api<{
      chat: {
        peer: {
          name: string;
          username: string;
          avatarHue: number;
          photoUrl?: string;
          id?: string;
          role?: string;
        };
        messages: ChatMessage[];
        locked?: boolean;
        mutedUntil?: string | null;
        kind?: string;
        support?: boolean;
      };
    }>(`/api/chats/${id}`);
    setPeer(payload.chat.peer);
    setMessages(payload.chat.messages);
    setLocked(Boolean(payload.chat.locked));
    setMutedUntil(payload.chat.mutedUntil ?? null);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [id]);

  async function send() {
    if (!text.trim()) return;
    setError("");
    try {
      await api(`/api/chats/${id}/messages`, { method: "POST", body: { body: text.trim() } });
      setText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не отправилось");
    }
  }

  const title = global
    ? "Общий чат"
    : peer?.username === "support"
      ? "Поддержка"
      : `@${peer?.username}`;

  const cannotWrite =
    Boolean(global && locked && !staff) || Boolean(global && mutedUntil && !staff);

  return (
    <div className="flex min-h-[70dvh] flex-col gap-3">
      <button type="button" className="flex items-center gap-2 text-left" onClick={() => navigate(-1)}>
        {peer && !global ? (
          <Avatar name={peer.name} hue={peer.avatarHue} photoUrl={peer.photoUrl} size={40} />
        ) : (
          <span className="grid size-10 place-items-center rounded-full bg-signal text-night font-bold">#</span>
        )}
        <span>
          <span className="block font-semibold text-signal">{title}</span>
          {global && locked ? <span className="text-xs text-mute">Чат отключён для пользователей</span> : null}
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              message.mine ? "ml-auto bg-signal text-night" : "bg-panel"
            }`}
          >
            {global && message.sender ? (
              <p className={`mb-1 text-[11px] font-semibold ${message.mine ? "text-night/70" : "text-price"}`}>
                @{message.sender.username}
                {roleLabel(message.sender.role) ? ` · ${roleLabel(message.sender.role)}` : ""}
              </p>
            ) : null}
            <p>{message.body}</p>
            {global && staff && !message.mine ? (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="text-[11px] underline"
                  onClick={async () => {
                    await api(`/api/global-chat/messages/${message.id}`, { method: "DELETE" });
                    await load();
                  }}
                >
                  Удалить
                </button>
                {message.sender?.id ? (
                  <button
                    type="button"
                    className="text-[11px] underline"
                    onClick={async () => {
                      await api("/api/global-chat/mute", {
                        method: "POST",
                        body: { userId: message.sender?.id, hours: Number(muteHours) || 24 },
                      });
                      await load();
                    }}
                  >
                    Мут {muteHours}ч
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {global && user?.role === "owner" ? (
        <Button
          variant="ghost"
          onClick={async () => {
            await api("/api/settings", { method: "POST", body: { chatLocked: !locked } });
            await refresh();
            await load();
          }}
        >
          {locked ? "Включить чат" : "Отключить чат"}
        </Button>
      ) : null}
      {global && staff ? (
        <input
          className={inputClass}
          value={muteHours}
          onChange={(event) => setMuteHours(event.target.value)}
          placeholder="Часы мута"
        />
      ) : null}
      {mutedUntil && !staff ? (
        <p className="text-xs text-danger">Мут до {formatDate(mutedUntil)}</p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex gap-2">
        <input
          className={inputClass}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={cannotWrite ? "Писать нельзя" : "Сообщение..."}
          disabled={cannotWrite}
          onKeyDown={(event) => {
            if (event.key === "Enter") send();
          }}
        />
        <Button className="px-3" onClick={send} disabled={!user || cannotWrite}>
          →
        </Button>
      </div>
    </div>
  );
}
