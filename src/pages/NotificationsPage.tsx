import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate } from "../lib/format";
import type { Notice } from "../types";

export function NotificationsPage() {
  const { refresh } = useAuth();
  const [items, setItems] = useState<Notice[]>([]);

  useEffect(() => {
    (async () => {
      const payload = await api<{ notifications: Notice[] }>("/api/notifications");
      setItems(payload.notifications);
      await api("/api/notifications/read", { method: "POST" });
      await refresh();
    })().catch(() => undefined);
  }, [refresh]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Уведомления</h1>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-panel px-4 py-8 text-center text-sm text-mute">Пока тихо</p>
      ) : (
        items.map((item) => (
          <article
            key={item.id}
            className={`rounded-2xl px-4 py-3 ${item.read ? "bg-panel" : "bg-signal/15"}`}
          >
            <p className="font-semibold">{item.title}</p>
            {item.body ? <p className="mt-1 text-sm text-mute">{item.body}</p> : null}
            <p className="mt-2 text-[11px] text-mute">{formatDate(item.createdAt)}</p>
          </article>
        ))
      )}
    </div>
  );
}
