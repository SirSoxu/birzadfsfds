import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate, formatMoney } from "../lib/format";
import type { ListingPlan } from "../types";
import { Empty } from "./HomePage";

export function PlansPage() {
  const { user, refresh } = useAuth();
  const [plans, setPlans] = useState<ListingPlan[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const payload = await api<{ plans: ListingPlan[] }>("/api/plans");
    setPlans(payload.plans);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  if (error) return <Empty text={error} />;
  const current = user?.plan;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Статусы продавца</h1>
        <p className="mt-1 text-sm text-mute">
          Выложить объявление можно только с активным статусом. Лимит активных услуг задаёт владелец.
        </p>
      </div>
      {current ? (
        <div className="rounded-2xl bg-panel px-4 py-3">
          <p className="font-semibold">
            Сейчас: {current.name}
            {current.expired ? " (истёк)" : ""}
          </p>
          <p className="mt-1 text-sm text-mute">
            Активных объявлений {current.activeCount ?? 0} из {current.maxActive}
            {current.until ? ` · до ${formatDate(current.until)}` : " · без срока"}
          </p>
        </div>
      ) : (
        <p className="rounded-2xl bg-panel px-4 py-3 text-sm text-mute">Статуса пока нет.</p>
      )}
      {plans.map((plan) => (
        <article key={plan.id} className="flex flex-col gap-2 rounded-2xl bg-panel px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{plan.name}</p>
              <p className="mt-1 text-sm text-mute">
                {plan.maxActive} активных · {plan.durationDays > 0 ? `${plan.durationDays} дн.` : "без срока"}
              </p>
            </div>
            <p className="font-display text-lg font-semibold text-signal">{formatMoney(plan.price)}</p>
          </div>
          <Button
            onClick={async () => {
              setNotice("");
              try {
                await api(`/api/plans/${plan.id}/buy`, { method: "POST" });
                await refresh();
                await load();
                setNotice(`Статус «${plan.name}» активирован.`);
              } catch (err) {
                setNotice(err instanceof Error ? err.message : "Не удалось купить");
              }
            }}
          >
            {current?.id === plan.id && !current.expired ? "Продлить" : "Купить"}
          </Button>
        </article>
      ))}
      <Link to="/search?mine=1" className="text-center text-sm text-signal">
        Мои объявления
      </Link>
      {notice ? <p className="text-sm text-mute">{notice}</p> : null}
    </div>
  );
}
