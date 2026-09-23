import { Link } from "react-router-dom";
import { Avatar } from "../components/ui";
import { formatMoney } from "../lib/format";
import { useAuth } from "../lib/auth";
import type { Role } from "../types";

const ROLES: { id: Role; label: string }[] = [
  { id: "user", label: "Пользователь" },
  { id: "moderator", label: "Модератор" },
  { id: "owner", label: "Владелец" },
];

export function ProfilePage() {
  const { user, loginDemo } = useAuth();
  if (!user) return null;

  return (
    <div className="flex flex-col items-center gap-4 pt-4 text-center">
      <Avatar name={user.name} hue={user.avatarHue} photoUrl={user.photoUrl} size={92} />
      <div>
        <p className="text-xl font-semibold">@{user.username || user.name}</p>
        <span className="mt-2 inline-flex rounded-full bg-panel px-3 py-1 text-sm text-mute">
          {user.role === "owner" ? "Владелец" : user.role === "moderator" ? "Модератор" : "Обычный"}
        </span>
      </div>
      <p className="text-sm text-mute">
        Баланс: {formatMoney(user.balance)} · ★ {user.rating.toFixed(1)} · ♥ {user.likes ?? 0}
      </p>
      <div className="grid w-full grid-cols-3 gap-2">
        <Stat value="—" label="Объявлений" />
        <Stat value={String(user.deals)} label="Сделок" />
        <Stat value={String(user.likes ?? 0)} label="Лайков" />
      </div>
      <div className="flex w-full flex-col gap-2">
        <Link to="/search?mine=1" className="rounded-2xl bg-panel py-3 font-medium">
          Мои объявления
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
      <div className="flex w-full gap-2">
        {ROLES.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => loginDemo(role.id)}
            className={`flex-1 rounded-2xl py-3 text-xs font-semibold ${
              user.role === role.id ? "bg-signal text-night" : "bg-panel"
            }`}
          >
            {role.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-mute">Демо-роли работают в браузере. В Telegram роль задаётся по ID.</p>
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
