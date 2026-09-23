import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { HomeHeader } from "../components/HomeHeader";
import { PromoBanner } from "../components/PromoBanner";
import { SectionGlyph } from "../components/SectionGlyph";
import { Button } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatMoney } from "../lib/format";
import type { Offer, Section, Settings } from "../types";

export function HomePage() {
  const { user, refresh } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    api<{ sections: Section[]; offers: Offer[]; settings: Settings }>("/api/catalog").then(
      (payload) => {
        setSections(payload.sections);
        setOffers(payload.offers);
        setSettings(payload.settings);
      },
    );
    refresh().catch(() => undefined);
  }, [refresh]);

  if (!user) return null;

  return (
    <div className="flex flex-col gap-5">
      <HomeHeader user={user} />
      {settings ? <PromoBanner banner={settings.banner} /> : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Категории</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sections.map((section) => (
            <Link
              key={section.id}
              to={`/search?section=${section.id}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-panel px-3 py-2 text-sm text-ice transition duration-150 hover:bg-panel-2"
            >
              <SectionGlyph name={section.icon} className="size-4 text-price" />
              {section.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Свежие объявления</h2>
        {offers.length === 0 ? (
          <div className="rounded-3xl bg-panel px-4 py-10 text-center">
            <p className="text-mute">Пока нет свежих объявлений</p>
            <Link to="/create" className="mt-4 inline-block">
              <Button>Создать</Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {offers.slice(0, 6).map((offer) => (
              <SearchCard key={offer.id} offer={offer} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function SearchCard({ offer }: { offer: Offer }) {
  return (
    <Link
      to={`/offer/${offer.id}`}
      className="rounded-2xl bg-panel px-4 py-3 transition duration-150 hover:bg-panel-2"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold leading-5">{offer.title}</p>
        <p className="shrink-0 font-display text-lg font-semibold text-signal">
          {formatMoney(offer.price)}
        </p>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-mute">
        <span>
          @{offer.seller?.username || "seller"} · ★ {offer.seller?.rating?.toFixed(1) ?? "5.0"}
        </span>
        <span>
          {offer.likes ?? 0} ♥ · {offer.views ?? 0} просм.
        </span>
      </div>
    </Link>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-3xl bg-panel px-4 py-8 text-center text-sm text-mute">{text}</div>
  );
}
