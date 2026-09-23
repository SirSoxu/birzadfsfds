import { Bell, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { formatMoney } from "../lib/format";
import type { User } from "../types";
import { Avatar } from "./ui";

export function HomeHeader({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={user.name} hue={user.avatarHue} photoUrl={user.photoUrl} size={48} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold">
          Привет, @{user.username || user.name}
        </p>
      </div>
      <Link
        to="/wallet"
        className="inline-flex min-h-10 items-center gap-1 rounded-full bg-panel px-3 text-sm font-semibold text-ice transition duration-150 hover:bg-panel-2"
      >
        {formatMoney(user.balance)}
        <span className="grid size-5 place-items-center rounded-full bg-signal text-night">
          <Plus className="size-3" />
        </span>
      </Link>
      <button
        type="button"
        className="grid size-10 place-items-center rounded-full bg-panel text-mute"
        aria-label="Уведомления"
      >
        <Bell className="size-4" />
      </button>
    </div>
  );
}

export function PayMark({ provider }: { provider: "cryptobot" | "xrocket" }) {
  if (provider === "cryptobot") {
    return (
      <span className="grid size-9 place-items-center rounded-xl bg-[#e11d48] font-display text-sm font-bold text-white">
        C
      </span>
    );
  }
  return (
    <span className="grid size-9 place-items-center rounded-xl bg-[#fb7185] text-white">
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
        <path d="M13 3 4 14h7l-1 7 10-12h-7l0-6z" />
      </svg>
    </span>
  );
}
