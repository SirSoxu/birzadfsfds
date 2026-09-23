import { ChevronLeft, Heart, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Avatar, Button, StatusBadge, inputClass } from "../components/ui";
import { api } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";
import type { Offer } from "../types";
import { Empty } from "./HomePage";

export function OfferPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const payload = await api<{ offer: Offer }>(`/api/offers/${id}`);
    setOffer(payload.offer);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [id]);

  if (error) return <Empty text={error} />;
  if (!offer || !offer.seller) return <Empty text="Загружаем объявление…" />;
  const current = offer;

  async function favorite() {
    const payload = await api<{ favorite: boolean; likes: number }>(`/api/offers/${current.id}/favorite`, {
      method: "POST",
    });
    setOffer({ ...current, favorite: payload.favorite, likes: payload.likes });
  }

  async function write() {
    const payload = await api<{ chatId: string }>("/api/chats", {
      method: "POST",
      body: { sellerId: current.sellerId, offerId: current.id },
    });
    navigate(`/chats/${payload.chatId}`);
  }

  async function sendComment() {
    if (!comment.trim()) return;
    await api(`/api/offers/${current.id}/comments`, { method: "POST", body: { body: comment } });
    setComment("");
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm text-mute"
      >
        <ChevronLeft className="size-4" />
        Назад
      </button>
      <div>
        <h1 className="text-2xl font-semibold leading-8">{offer.title}</h1>
        <p className="mt-2 font-display text-3xl font-semibold text-signal">{formatMoney(offer.price)}</p>
        {offer.status !== "approved" ? (
          <div className="mt-2">
            <StatusBadge status={offer.status} />
          </div>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-6 text-mute">{offer.description}</p>
      <p className="text-xs text-mute">
        ♥ {offer.likes ?? 0} лайка · {offer.views ?? 0} просмотров · {formatDate(offer.createdAt)}
      </p>
      <Link to={`/user/${offer.seller.id}`} className="flex items-center gap-3 rounded-2xl bg-panel px-3 py-3">
        <Avatar
          name={offer.seller.name}
          hue={offer.seller.avatarHue}
          photoUrl={offer.seller.photoUrl}
          size={44}
        />
        <span className="min-w-0 flex-1 text-left">
          <span className="block font-semibold">@{offer.seller.username}</span>
          <span className="text-xs text-mute">
            ★ {offer.seller.rating.toFixed(1)} · {offer.seller.deals} сделок
          </span>
        </span>
        <Star className="size-4 text-price" />
      </Link>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={write} disabled={offer.status !== "approved"}>
          Написать
        </Button>
        <button
          type="button"
          onClick={favorite}
          className={`grid size-11 place-items-center rounded-2xl border ${
            offer.favorite ? "border-signal text-signal" : "border-line text-mute"
          }`}
          aria-label="В избранное"
        >
          <Heart className="size-5" fill={offer.favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Комментарии</h2>
        {(offer.comments ?? []).map((item) => (
          <div key={item.id} className="rounded-2xl bg-panel px-3 py-3">
            <p className="text-sm font-semibold">@{item.user.username || item.user.name}</p>
            <p className="mt-1 text-sm">{item.body}</p>
            <p className="mt-1 text-[11px] text-mute">{formatDate(item.createdAt)}</p>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Написать комментарий"
          />
          <Button className="px-3" onClick={sendComment}>
            →
          </Button>
        </div>
      </section>
    </div>
  );
}
