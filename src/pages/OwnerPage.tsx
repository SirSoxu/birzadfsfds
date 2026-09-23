import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { SectionGlyph } from "../components/SectionGlyph";
import { Button, Field, inputClass } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SECTION_ICONS, type SectionIconName } from "../lib/format";
import type { ListingPlan, Section, Settings } from "../types";

export function OwnerPage() {
  const { user, settings, refresh } = useAuth();
  if (user && user.role !== "owner") return <Navigate to="/" replace />;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Кабинет владельца</h1>
        <p className="text-sm text-mute">Разделы, статусы продавца, баннер и комиссии.</p>
      </div>
      {settings ? <BannerForm settings={settings} onSaved={refresh} /> : null}
      {settings ? <CommissionForm settings={settings} onSaved={refresh} /> : null}
      {settings ? <ChatLockForm settings={settings} onSaved={refresh} /> : null}
      <PlansForm />
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

function ChatLockForm({ settings, onSaved }: { settings: Settings; onSaved: () => Promise<void> }) {
  async function toggle() {
    await api("/api/settings", { method: "POST", body: { chatLocked: !settings.chatLocked } });
    await onSaved();
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-panel p-4">
      <h2 className="font-semibold">Общий чат</h2>
      <p className="text-sm text-mute">
        {settings.chatLocked
          ? "Сейчас писать могут только модераторы и владелец."
          : "Чат открыт для всех."}
      </p>
      <Button variant="ghost" onClick={toggle}>
        {settings.chatLocked ? "Включить чат" : "Отключить чат"}
      </Button>
    </div>
  );
}

function PlansForm() {
  const [plans, setPlans] = useState<ListingPlan[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("5");
  const [durationDays, setDurationDays] = useState("30");
  const [maxActive, setMaxActive] = useState("3");
  const [error, setError] = useState("");

  async function load() {
    const payload = await api<{ plans: ListingPlan[] }>("/api/plans");
    setPlans(payload.plans);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/plans", {
        method: "POST",
        body: {
          name,
          price: Number(price.replace(",", ".")),
          durationDays: Number(durationDays),
          maxActive: Number(maxActive),
        },
      });
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать статус");
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-panel p-4">
      <h2 className="font-semibold">Статусы продавца</h2>
      <p className="text-sm text-mute">
        Цена, срок и сколько объявлений можно держать на витрине. Редактировать может только владелец.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field label="Название">
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Цена, $">
            <input className={inputClass} value={price} onChange={(event) => setPrice(event.target.value)} />
          </Field>
          <Field label="Дней">
            <input
              className={inputClass}
              value={durationDays}
              onChange={(event) => setDurationDays(event.target.value)}
            />
          </Field>
          <Field label="Лимит">
            <input className={inputClass} value={maxActive} onChange={(event) => setMaxActive(event.target.value)} />
          </Field>
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit">Добавить статус</Button>
      </form>
      {plans.map((plan) => (
        <PlanEditor key={plan.id} plan={plan} onSaved={load} />
      ))}
    </section>
  );
}

function PlanEditor({ plan, onSaved }: { plan: ListingPlan; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(String(plan.price));
  const [durationDays, setDurationDays] = useState(String(plan.durationDays));
  const [maxActive, setMaxActive] = useState(String(plan.maxActive));

  useEffect(() => {
    setName(plan.name);
    setPrice(String(plan.price));
    setDurationDays(String(plan.durationDays));
    setMaxActive(String(plan.maxActive));
  }, [plan]);

  return (
    <form
      className="flex flex-col gap-2 rounded-xl bg-navy px-3 py-3"
      onSubmit={async (event) => {
        event.preventDefault();
        await api(`/api/plans/${plan.id}`, {
          method: "POST",
          body: {
            name,
            price: Number(price.replace(",", ".")),
            durationDays: Number(durationDays),
            maxActive: Number(maxActive),
          },
        });
        await onSaved();
      }}
    >
      <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
      <div className="grid grid-cols-3 gap-2">
        <input className={inputClass} value={price} onChange={(event) => setPrice(event.target.value)} />
        <input
          className={inputClass}
          value={durationDays}
          onChange={(event) => setDurationDays(event.target.value)}
        />
        <input className={inputClass} value={maxActive} onChange={(event) => setMaxActive(event.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1 min-h-9 text-sm">
          Сохранить
        </Button>
        <Button
          variant="danger"
          className="min-h-9 px-3 text-sm"
          onClick={async () => {
            await api(`/api/plans/${plan.id}`, { method: "DELETE" });
            await onSaved();
          }}
        >
          Удалить
        </Button>
      </div>
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
