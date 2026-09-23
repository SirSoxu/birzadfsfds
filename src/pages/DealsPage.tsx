import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { dealStatusLabel, formatDate, formatMoney } from "../lib/format";
import type { Deal } from "../types";
import { Empty } from "./HomePage";

export function DealsPage() {
  const { refresh } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const payload = await api<{ deals: Deal[] }>("/api/deals");
    setDeals(payload.deals);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  if (error) return <Empty text={error} />;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Мои сделки</h1>
        <p className="mt-1 text-sm text-mute">
          Покупка закрывается только после подтверждения покупателем.
        </p>
      </div>
      {notice ? <p className="text-sm text-mute">{notice}</p> : null}
      {deals.length === 0 ? (
        <Empty text="Сделок пока нет" />
      ) : (
        deals.map((deal) => (
          <article key={deal.id} className="flex flex-col gap-2 rounded-2xl bg-panel px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link to={`/offer/${deal.offerId}`} className="font-semibold">
                  {deal.offerTitle || "Услуга"}
                </Link>
                <p className="mt-1 text-xs text-mute">
                  {deal.mine ? "Покупка" : "Продажа"} · {dealStatusLabel(deal.status)} ·{" "}
                  {formatDate(deal.createdAt)}
                </p>
              </div>
              <p className="font-display font-semibold text-signal">{formatMoney(deal.amount)}</p>
            </div>
            {deal.mine && deal.status === "held" ? (
              <Button
                onClick={async () => {
                  setNotice("");
                  try {
                    await api(`/api/deals/${deal.id}/confirm`, { method: "POST" });
                    setNotice("Сделка подтверждена.");
                    await refresh();
                    await load();
                  } catch (err) {
                    setNotice(err instanceof Error ? err.message : "Не удалось подтвердить");
                  }
                }}
              >
                Подтвердить выполнение
              </Button>
            ) : null}
          </article>
        ))
      )}
    </div>
  );
}
