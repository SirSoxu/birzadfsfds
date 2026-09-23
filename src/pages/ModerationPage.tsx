import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button, Field, StatusBadge, inputClass } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate, formatMoney } from "../lib/format";
import type { Offer } from "../types";
import { Empty } from "./HomePage";

export function ModerationPage() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<Offer[]>([]);
  const [reason, setReason] = useState<Record<string, string>>({});

  async function load() {
    const payload = await api<{ offers: Offer[] }>("/api/offers?status=pending");
    setQueue(payload.offers.filter((offer) => offer.status === "pending"));
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  if (user && user.role !== "moderator" && user.role !== "owner") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Заявки на публикацию</h1>
        <p className="text-sm text-mute">Пока заявка не одобрена, услуга не попадает в общий раздел.</p>
      </div>
      {queue.length === 0 ? (
        <Empty text="Новых заявок нет." />
      ) : (
        queue.map((offer) => (
          <article key={offer.id} className="rounded-2xl bg-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <Link to={`/offer/${offer.id}`} className="font-semibold">
                {offer.title}
              </Link>
              <StatusBadge status={offer.status} />
            </div>
            <p className="mt-2 text-sm text-mute">{offer.description}</p>
            <p className="mt-2 text-sm text-price">
              {formatMoney(offer.price)} · {formatDate(offer.createdAt)}
            </p>
            <Field label="Причина отказа">
              <input
                className={inputClass}
                value={reason[offer.id] ?? ""}
                onChange={(event) => setReason((current) => ({ ...current, [offer.id]: event.target.value }))}
              />
            </Field>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="ok"
                onClick={async () => {
                  await api(`/api/offers/${offer.id}/moderate`, {
                    method: "POST",
                    body: { status: "approved" },
                  });
                  await load();
                }}
              >
                Опубликовать
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await api(`/api/offers/${offer.id}/moderate`, {
                    method: "POST",
                    body: { status: "rejected", reason: reason[offer.id] },
                  });
                  await load();
                }}
              >
                Отклонить
              </Button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
