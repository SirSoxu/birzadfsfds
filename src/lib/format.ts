export function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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
