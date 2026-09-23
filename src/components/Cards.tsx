import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Offer, Section, User } from "../types";
import { formatMoney } from "../lib/format";
import { Avatar } from "./ui";
import { SectionGlyph } from "./SectionGlyph";

export function SectionTile({
  section,
  count,
}: {
  section: Section;
  count: number;
}) {
  return (
    <Link
      to={`/section/${section.id}`}
      className="flex min-h-[88px] items-center gap-3 rounded-2xl border border-line bg-panel px-3 py-3 transition duration-150 hover:border-line-strong hover:bg-panel-2 active:scale-[0.99]"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-navy text-price">
        <SectionGlyph name={section.icon} className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ice">{section.name}</span>
        <span className="mt-0.5 block text-xs text-mute">
          {count} {offersLabel(count)}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-mute" aria-hidden />
    </Link>
  );
}

export function OfferRow({ offer, seller }: { offer: Offer; seller?: User }) {
  return (
    <Link
      to={`/offer/${offer.id}`}
      className="flex items-start gap-3 rounded-2xl border border-line bg-panel px-3 py-3 transition duration-150 hover:border-line-strong hover:bg-panel-2 active:scale-[0.99]"
    >
      {seller ? <Avatar name={seller.name} hue={seller.avatarHue} size={40} /> : null}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-5 text-ice">{offer.title}</span>
        <span className="mt-1 block truncate text-xs text-mute">
          {seller?.name ?? "Продавец"} · {seller?.rating.toFixed(1)} · {seller?.deals} сделок
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-display text-sm font-semibold text-price">
          {formatMoney(offer.price)}
        </span>
        <span className="mt-1 block text-[11px] text-mute">{offer.unit}</span>
      </span>
    </Link>
  );
}

function offersLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "предложение";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "предложения";
  return "предложений";
}
