import { Home, MessageCircle, Plus, Search, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "Главная", icon: Home, end: true },
  { to: "/search", label: "Поиск", icon: Search },
  { to: "/create", label: "Создать", icon: Plus, plus: true },
  { to: "/chats", label: "Чаты", icon: MessageCircle },
  { to: "/profile", label: "Профиль", icon: UserRound },
];

export function BottomNav() {
  return (
    <nav className="relative z-20 border-t border-line bg-navy/96 pb-[max(8px,env(safe-area-inset-bottom))] backdrop-blur-md">
      <div className="grid grid-cols-5 px-1 pt-1">
        {items.map((item) => {
          const Icon = item.icon;
          if (item.plus) {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex items-start justify-center"
                aria-label={item.label}
              >
                <span className="grid size-14 -translate-y-4 place-items-center rounded-full bg-signal text-night shadow-[0_8px_24px_rgba(59,139,255,0.35)] transition duration-150 hover:bg-signal-2 active:scale-95">
                  <Icon className="size-7" />
                </span>
              </NavLink>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-12 flex-col items-center justify-center gap-1 text-[11px] font-medium transition duration-150 ${
                  isActive ? "text-signal" : "text-mute hover:text-ice"
                }`
              }
            >
              <Icon className="size-5" aria-hidden />
              {item.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
