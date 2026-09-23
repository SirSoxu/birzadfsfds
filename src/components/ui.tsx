import type { ReactNode } from "react";

export function Avatar({
  name,
  hue,
  size = 40,
  photoUrl,
}: {
  name: string;
  hue: number;
  size?: number;
  photoUrl?: string;
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-ice"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: `linear-gradient(145deg, hsl(${hue} 70% 42%), hsl(${hue + 24} 55% 26%))`,
      }}
    >
      {initials}
    </span>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "danger" | "ok";
  disabled?: boolean;
  className?: string;
}) {
  const variants = {
    primary:
      "bg-signal text-night hover:bg-signal-2 active:translate-y-px disabled:bg-line disabled:text-mute",
    ghost:
      "bg-panel text-ice border border-line hover:border-line-strong hover:bg-panel-2 active:translate-y-px disabled:opacity-50",
    danger:
      "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 active:translate-y-px",
    ok: "bg-ok/15 text-ok border border-ok/30 hover:bg-ok/25 active:translate-y-px",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-semibold transition duration-150 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-mute">{label}</span>
      {children}
      {hint ? <span className="text-xs text-mute">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-xl border border-line bg-navy px-3 text-ice placeholder:text-mute/70 transition duration-150 hover:border-line-strong focus:border-signal";

export function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  const map = {
    pending: "bg-warn/15 text-warn border-warn/25",
    approved: "bg-ok/15 text-ok border-ok/25",
    rejected: "bg-danger/15 text-danger border-danger/25",
  };
  const label = {
    pending: "На проверке",
    approved: "Опубликовано",
    rejected: "Отклонено",
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${map[status]}`}>
      {label[status]}
    </span>
  );
}
