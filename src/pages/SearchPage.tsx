import { SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Offer, Section } from "../types";
import { SearchCard } from "./HomePage";

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [sectionId, setSectionId] = useState(params.get("section") ?? "");
  const mine = params.get("mine") === "1";
  const [sections, setSections] = useState<Section[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    api<{ sections: Section[] }>("/api/catalog").then((payload) => setSections(payload.sections));
  }, []);

  useEffect(() => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (sectionId) search.set("sectionId", sectionId);
    if (mine) search.set("mine", "1");
    api<{ offers: Offer[] }>(`/api/offers?${search.toString()}`).then((payload) =>
      setOffers(payload.offers),
    );
  }, [query, sectionId, mine]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Поиск</h1>
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          params.set("q", event.target.value);
          setParams(params, { replace: true });
        }}
        placeholder="Поиск объявлений и пользователей"
        className="min-h-12 rounded-2xl bg-panel px-4 text-sm text-ice placeholder:text-mute"
      />
      <div className="flex gap-2 overflow-x-auto">
        <Chip active={!sectionId} onClick={() => setSectionId("")}>
          Все
        </Chip>
        {sections.map((section) => (
          <Chip
            key={section.id}
            active={sectionId === section.id}
            onClick={() => setSectionId(section.id)}
          >
            {section.name}
          </Chip>
        ))}
      </div>
      <button
        type="button"
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-panel py-3 text-sm text-mute"
      >
        <SlidersHorizontal className="size-4" />
        Фильтры
      </button>
      <div className="flex flex-col gap-2">
        {offers.map((offer) => (
          <SearchCard key={offer.id} offer={offer} />
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition duration-150 ${
        active ? "bg-signal text-night" : "bg-panel text-ice"
      }`}
    >
      {children}
    </button>
  );
}
