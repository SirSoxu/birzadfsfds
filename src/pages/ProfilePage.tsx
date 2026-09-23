import { Link } from "react-router-dom";
import { Avatar } from "../components/ui";
import { formatDate, formatMoney, formatRating } from "../lib/format";
import { useAuth } from "../lib/auth";

const PEOPLE = [
  { id: "alex", label: "Алексей" },
  { id: "mira", label: "Мира" },
  { id: "moderator", label: "Модератор" },
  { id: "owner", label: "Владелец" },
];

export function ProfilePage() {
  const { user, loginDemo, settings } = useAuth();
  if (!user) return null;

  return (
    <div className="flex flex-col items-center gap-4 pt-4 text-center">
      <Avatar name={user.name} hue={user.avatarHue} photoUrl={user.photoUrl} size={92} />
      <div>
        <p className="text-xl font-semibold">@{user.username || user.name}</p>
        <span className="mt-2 inline-flex rounded-full bg-panel px-3 py-1 text-sm text-mute">
          {user.role === "owner" ? "Владелец" : user.role === "moderator" ? "Модератор" : "Обычный"}
        </span>
        {user.plan ? (
          <p className="mt-2 text-sm text-mute">
            Статус «{user.plan.name}»
            {user.plan.expired
              ? " истёк"
              : user.plan.until
                ? ` до ${formatDate(user.plan.until)}`
                : ""}
            {` · ${user.plan.activeCount ?? 0}/${user.plan.maxActive} объявлений`}
          </p>
        ) : user.role === "user" ? (
          <p className="mt-2 text-sm text-mute">Нет статуса продавца</p>
        ) : null}
      </div>
      <Link
        to={`/user/${user.id}/reviews`}
        className="rounded-2xl bg-panel px-4 py-2 text-sm text-mute"
      >
        Баланс: {formatMoney(user.balance)} · ★ {formatRating(user)} · ♥ {user.likes ?? 0}
      </Link>
      <div className="grid w-full grid-cols-3 gap-2">
        <Stat value="—" label="Объявлений" />
        <Stat value={String(user.deals)} label="Сделок" />
        <Stat value={formatRating(user)} label="Рейтинг" />
      </div>
      <div className="flex w-full flex-col gap-2">
        <Link to="/search?mine=1" className="rounded-2xl bg-panel py-3 font-medium">
          Мои объявления
        </Link>
        <Link to="/plans" className="rounded-2xl bg-panel py-3 font-medium">
          Статус продавца
        </Link>
        <Link to="/deals" className="rounded-2xl bg-panel py-3 font-medium">
          Мои сделки
        </Link>
        <Link to="/wallet" className="rounded-2xl bg-panel py-3 font-medium">
          Баланс и выплаты
        </Link>
        {user.role === "moderator" || user.role === "owner" ? (
          <Link to="/moderation" className="rounded-2xl bg-panel py-3 font-medium">
            Заявки на публикацию
          </Link>
        ) : null}
        {user.role === "owner" ? (
          <Link to="/owner" className="rounded-2xl bg-panel py-3 font-medium">
            Кабинет владельца
          </Link>
        ) : null}
      </div>
      {settings?.demoAuth !== false ? (
        <>
          <p className="text-xs text-mute">Войти как другой человек (демо в браузере)</p>
          <div className="grid w-full grid-cols-2 gap-2">
            {PEOPLE.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => loginDemo(person.id)}
                className={`rounded-2xl py-3 text-xs font-semibold ${
                  user.username === person.id ||
                  (person.id === "owner" && user.role === "owner") ||
                  (person.id === "moderator" && user.role === "moderator" && user.username === "moderator")
                    ? "bg-signal text-night"
                    : "bg-panel"
                }`}
              >
                {person.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-panel py-3">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-mute">{label}</p>
    </div>
  );
}
