import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Field, inputClass } from "../components/ui";
import { api } from "../lib/api";
import type { Section } from "../types";

export function CreatePage() {
  const navigate = useNavigate();
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("3000");
  const [unit, setUnit] = useState("за услугу");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ sections: Section[] }>("/api/catalog").then((payload) => {
      setSections(payload.sections);
      setSectionId(payload.sections[0]?.id ?? "");
    });
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const payload = await api<{ offer: { id: string } }>("/api/offers", {
        method: "POST",
        body: { sectionId, title, description, price: Number(price), unit },
      });
      navigate(`/offer/${payload.offer.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Новая услуга</h1>
        <p className="mt-1 text-sm text-mute">
          Объявление не появится на витрине сразу. Сначала его проверит модератор.
        </p>
      </div>
      <Field label="Раздел">
        <select className={inputClass} value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Название">
        <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field label="Описание">
        <textarea
          className={`${inputClass} min-h-28 py-3`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Цена, ₽">
          <input className={inputClass} inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value)} />
        </Field>
        <Field label="Единица">
          <input className={inputClass} value={unit} onChange={(event) => setUnit(event.target.value)} />
        </Field>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit">Отправить на проверку</Button>
    </form>
  );
}
