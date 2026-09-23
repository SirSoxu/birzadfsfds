export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export function formatRating(user?: { rating?: number | null; reviewCount?: number } | null) {
  if (!user?.reviewCount) return "—";
  return Number(user.rating).toFixed(1);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function roleLabel(role?: string) {
  if (role === "owner") return "Владелец";
  if (role === "moderator") return "Модератор";
  return "";
}

export function dealStatusLabel(status?: string) {
  if (status === "held") return "Ждёт подтверждения";
  if (status === "completed" || status === "paid") return "Завершена";
  if (status === "cancelled") return "Возврат";
  return status || "";
}

export const SECTION_ICONS = [
  "palette",
  "code",
  "bot",
  "megaphone",
  "video",
  "pen",
  "camera",
  "graduation",
  "gamepad",
  "music",
] as const;

export type SectionIconName = (typeof SECTION_ICONS)[number];
