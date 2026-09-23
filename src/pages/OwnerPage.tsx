import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { SectionGlyph } from "../components/SectionGlyph";
import { Button, Field, inputClass } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SECTION_ICONS, type SectionIconName } from "../lib/format";
import type { Section, Settings } from "../types";

export function OwnerPage() {
  const { user, settings, refresh } = useAuth();
  if (user && user.role !== "owner") return <Navigate to="/" replace />;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Кабинет владельца</h1>
        <p className="text-sm text-mute">Разделы, баннер и комиссии на CryptoBot / xRocket.</p>
      </div>
      {settings ? <BannerForm settings={settings} onSaved={refresh} /> : null}
      {settings ? <CommissionForm settings={settings} onSaved={refresh} /> : null}
      <SectionsForm />
    </div>
  );
}

function BannerForm({ settings, onSaved }: { settings: Settings; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState(settings.banner.title);
  const [subtitle, setSubtitle] = useState(settings.banner.subtitle);
  const [href, setHref] = useState(settings.banner.href);
  const [cta, setCta] = useState(settings.banner.cta);
  const [imageUrl, setImageUrl] = useState(settings.banner.imageUrl);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await api("/api/settings", {
      method: "POST",
      body: { banner: { title, subtitle, href, cta, imageUrl } },
    });
    await onSaved();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-2xl bg-panel p-4">
      <h2 className="font-semibold">Рекламный баннер</h2>
      <Field label="Заголовок">
        <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field label="Текст">
        <textarea className={`${inputClass} min-h-20 py-3`} value={subtitle} onChange={(event) => setSubtitle(event.target.value)} />
      </Field>
      <Field label="Ссылка">
        <input className={inputClass} value={href} onChange={(event) => setHref(event.target.value)} />
      </Field>
      <Field label="Кнопка">
        <input className={inputClass} value={cta} onChange={(event) => setCta(event.target.value)} />
      </Field>
      <Field label="Картинка, URL">
        <input className={inputClass} value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
      </Field>
      <Button type="submit">Сохранить баннер</Button>
    </form>
  );
}

function CommissionForm({ settings, onSaved }: { settings: Settings; onSaved: () => Promise<void> }) {
  const [deposit, setDeposit] = useState(String(settings.depositCommission));
  const [withdraw, setWithdraw] = useState(String(settings.withdrawCommission));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await api("/api/settings", {
      method: "POST",
      body: {
        depositCommission: Number(deposit.replace(",", ".")),
        withdrawCommission: Number(withdraw.replace(",", ".")),
      },
    });
    await onSaved();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-2xl bg-panel p-4">
      <h2 className="font-semibold">Комиссии</h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Пополнение, %">
          <input className={inputClass} value={deposit} onChange={(event) => setDeposit(event.target.value)} />
        </Field>
        <Field label="Вывод, %">
          <input className={inputClass} value={withdraw} onChange={(event) => setWithdraw(event.target.value)} />
        </Field>
      </div>
      <Button type="submit">Сохранить комиссии</Button>
    </form>
  );
}

function SectionsForm() {
  const [sections, setSections] = useState<Section[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<SectionIconName>("palette");

  async function load() {
    const payload = await api<{ sections: Section[] }>("/api/catalog");
    setSections(payload.sections);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await api("/api/sections", { method: "POST", body: { name, description, icon } });
    setName("");
    setDescription("");
    await load();
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-panel p-4">
      <h2 className="font-semibold">Разделы</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field label="Название">
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Описание">
          <input className={inputClass} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {SECTION_ICONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setIcon(item)}
              className={`grid size-11 place-items-center rounded-xl ${
                icon === item ? "bg-signal/20 text-price" : "bg-navy text-mute"
              }`}
            >
              <SectionGlyph name={item} className="size-4" />
            </button>
          ))}
        </div>
        <Button type="submit">Добавить раздел</Button>
      </form>
      {sections.map((section) => (
        <div key={section.id} className="flex items-center gap-3 rounded-xl bg-navy px-3 py-3">
          <SectionGlyph name={section.icon} className="size-4 text-price" />
          <span className="flex-1 font-semibold">{section.name}</span>
          <Button
            variant="danger"
            className="min-h-9 px-3 text-sm"
            onClick={async () => {
              await api(`/api/sections/${section.id}`, { method: "DELETE" });
              await load();
            }}
          >
            Удалить
          </Button>
        </div>
      ))}
    </section>
  );
}
