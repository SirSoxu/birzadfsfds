import { ChevronLeft, Heart, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Avatar, Button, StatusBadge, inputClass } from "../components/ui";
import { api } from "../lib/api";
import { dealStatusLabel, formatDate, formatMoney, formatRating } from "../lib/format";
import type { Offer } from "../types";
import { Empty } from "./HomePage";
import { useAuth } from "../lib/auth";

export function OfferPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
  const staff = user?.role === "moderator" || user?.role === "owner";
  const refundable = (offer.deals ?? []).filter(
    (deal) => deal.status === "held" || deal.status === "completed" || deal.status === "paid",
  );

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

  async function buy() {
    setNotice("");
    try {
      await api(`/api/offers/${current.id}/buy`, { method: "POST" });
      setNotice("Оплата на холде. Подтвердите сделку, когда продавец выполнит работу.");
      await refresh();
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Не удалось купить");
    }
  }

  async function setVisibility(published: boolean) {
    setNotice("");
    try {
      await api(`/api/offers/${current.id}/visibility`, {
        method: "POST",
        body: { published },
      });
      setNotice(published ? "Объявление снова на витрине." : "Объявление снято с публикации.");
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Не удалось изменить видимость");
    }
  }

  async function confirmDeal(dealId: string) {
    setNotice("");
    try {
      await api(`/api/deals/${dealId}/confirm`, { method: "POST" });
      setNotice("Сделка подтверждена. Можно оставить отзыв.");
      await refresh();
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Не удалось подтвердить");
    }
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
            ★ {formatRating(offer.seller)} · {offer.seller.deals} сделок
          </span>
        </span>
        <Star className="size-4 text-price" />
      </Link>
      {offer.myDeal?.status === "held" ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-panel p-3">
          <p className="text-sm font-semibold">Сделка на холде · {formatMoney(offer.myDeal.amount)}</p>
          <p className="text-xs text-mute">
            Деньги уйдут продавцу только после вашего подтверждения.
          </p>
          <Button onClick={() => confirmDeal(offer.myDeal!.id)}>Подтвердить выполнение</Button>
        </div>
      ) : null}
      <div className="flex gap-2">
        {offer.canBuy ? (
          <Button className="flex-1" onClick={buy}>
            Купить
          </Button>
        ) : null}
        <Button
          className="flex-1"
          variant={offer.canBuy ? "ghost" : "primary"}
          onClick={write}
          disabled={offer.status !== "approved"}
        >
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
      {offer.canUnpublish ? (
        <Button variant="ghost" onClick={() => setVisibility(false)}>
          Снять с публикации
        </Button>
      ) : null}
      {offer.canPublish ? (
        <div className="flex flex-col gap-2">
          {offer.publishError ? (
            <p className="text-sm text-warn">
              {offer.publishError}{" "}
              <Link to="/plans" className="text-signal">
                Купить статус
              </Link>
            </p>
          ) : null}
          <Button onClick={() => setVisibility(true)} disabled={Boolean(offer.publishError)}>
            Выложить объявление
          </Button>
        </div>
      ) : null}
      {notice ? <p className="text-sm text-mute">{notice}</p> : null}
      {offer.canReview && offer.seller ? (
        <Link to={`/user/${offer.seller.id}`} className="text-sm text-signal">
          Оставить отзыв продавцу
        </Link>
      ) : null}
      {staff ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-panel p-3">
          <p className="text-sm font-semibold">Модерация</p>
          <Button
            variant="danger"
            onClick={async () => {
              await api(`/api/offers/${offer.id}`, { method: "DELETE" });
              navigate("/");
            }}
          >
            Удалить услугу
          </Button>
          {refundable.map((deal) => (
            <Button
              key={deal.id}
              variant="ghost"
              onClick={async () => {
                await api(`/api/deals/${deal.id}/cancel`, { method: "POST" });
                setNotice("Деньги возвращены покупателю.");
                await load();
              }}
            >
              Вернуть {formatMoney(deal.amount)} · {dealStatusLabel(deal.status)}
            </Button>
          ))}
        </div>
      ) : null}
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
