import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Avatar, Button, inputClass } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { dealStatusLabel, formatDate, formatMoney, formatRating } from "../lib/format";
import type { Deal, Offer, ReviewItem, User } from "../types";
import { SearchCard } from "./HomePage";

export function UserPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const payload = await api<{ user: User; offers: Offer[]; canReview?: boolean; deals?: Deal[] }>(
      `/api/users/${id}`,
    );
    setUser(payload.user);
    setOffers(payload.offers);
    setDeals(payload.deals ?? []);
    setCanReview(Boolean(payload.canReview));
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [id]);

  if (!user) return null;
  const staff = me?.role === "moderator" || me?.role === "owner";

  return (
    <div className="flex flex-col items-center gap-4 pt-6 text-center">
      <Avatar name={user.name} hue={user.avatarHue} photoUrl={user.photoUrl} size={92} />
      <p className="text-xl font-semibold">@{user.username}</p>
      <button
        type="button"
        className="rounded-2xl bg-panel px-4 py-2 text-sm text-mute"
        onClick={() => navigate(`/user/${user.id}/reviews`)}
      >
        ★ {formatRating(user)} · {user.deals} сделок · смотреть отзывы
      </button>
      <div className="flex w-full gap-2">
        <Button
          className="flex-1"
          onClick={async () => {
            const payload = await api<{ chatId: string }>("/api/chats", {
              method: "POST",
              body: { sellerId: user.id },
            });
            navigate(`/chats/${payload.chatId}`);
          }}
        >
          Написать
        </Button>
      </div>
      {canReview && me?.id !== user.id ? (
        <form
          className="flex w-full flex-col gap-2 text-left"
          onSubmit={async (event) => {
            event.preventDefault();
            setMessage("");
            try {
              await api(`/api/users/${user.id}/reviews`, {
                method: "POST",
                body: { rating, body },
              });
              setBody("");
              setCanReview(false);
              setMessage("Отзыв отправлен.");
              await load();
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Не удалось");
            }
          }}
        >
          <p className="font-semibold">Отзыв о продавце</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={`size-9 rounded-xl ${rating >= value ? "bg-signal text-night" : "bg-panel"}`}
                onClick={() => setRating(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <input
            className={inputClass}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Как прошла сделка"
          />
          <Button type="submit">Оставить отзыв</Button>
          {message ? <p className="text-sm text-mute">{message}</p> : null}
        </form>
      ) : null}
      {staff ? (
        <>
          {message ? <p className="w-full text-left text-sm text-mute">{message}</p> : null}
          <DealHistory
            deals={deals}
            onRefund={async (deal) => {
              setMessage("");
              try {
                await api(`/api/deals/${deal.id}/cancel`, { method: "POST" });
                setMessage("Деньги возвращены покупателю.");
                await load();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Не удалось вернуть");
              }
            }}
          />
        </>
      ) : null}
      <div className="w-full text-left">
        <h2 className="mb-2 font-semibold">Объявления</h2>
        <div className="flex flex-col gap-2">
          {offers.map((offer) => (
            <SearchCard key={offer.id} offer={{ ...offer, seller: user }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DealHistory({
  deals,
  onRefund,
}: {
  deals: Deal[];
  onRefund: (deal: Deal) => Promise<void>;
}) {
  const purchases = deals.filter((deal) => deal.mine);
  const sales = deals.filter((deal) => deal.asSeller);
  return (
    <div className="w-full text-left">
      <h2 className="mb-2 font-semibold">История покупок</h2>
      {purchases.length === 0 ? (
        <p className="mb-4 rounded-2xl bg-panel px-4 py-3 text-sm text-mute">Покупок нет</p>
      ) : (
        <div className="mb-4 flex flex-col gap-2">
          {purchases.map((deal) => (
            <DealRow key={deal.id} deal={deal} onRefund={onRefund} />
          ))}
        </div>
      )}
      {sales.length > 0 ? (
        <>
          <h2 className="mb-2 font-semibold">Продажи</h2>
          <div className="flex flex-col gap-2">
            {sales.map((deal) => (
              <DealRow key={deal.id} deal={deal} onRefund={onRefund} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function DealRow({ deal, onRefund }: { deal: Deal; onRefund: (deal: Deal) => Promise<void> }) {
  const canRefund = deal.status === "held" || deal.status === "completed" || deal.status === "paid";
  return (
    <article className="rounded-2xl bg-panel px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to={`/offer/${deal.offerId}`} className="font-semibold">
            {deal.offerTitle || "Услуга"}
          </Link>
          <p className="mt-1 text-xs text-mute">
            {dealStatusLabel(deal.status)} · {formatDate(deal.createdAt)}
          </p>
        </div>
        <p className="font-display font-semibold text-signal">{formatMoney(deal.amount)}</p>
      </div>
      {canRefund ? (
        <Button variant="ghost" className="mt-3 min-h-9 text-sm" onClick={() => onRefund(deal)}>
          Вернуть деньги покупателю
        </Button>
      ) : null}
    </article>
  );
}

export function ReviewsPage() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);

  async function load() {
    const payload = await api<{ user: User; reviews: ReviewItem[] }>(`/api/users/${id}/reviews`);
    setUser(payload.user);
    setReviews(payload.reviews);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [id]);

  if (!user) return null;
  const staff = me?.role === "moderator" || me?.role === "owner";

  return (
    <div className="flex flex-col gap-4">
      <button type="button" className="text-left text-sm text-mute" onClick={() => navigate(-1)}>
        Назад
      </button>
      <h1 className="text-2xl font-semibold">Отзывы @{user.username}</h1>
      <p className="text-sm text-mute">Рейтинг {formatRating(user)}</p>
      {reviews.length === 0 ? (
        <p className="rounded-2xl bg-panel px-4 py-8 text-center text-sm text-mute">Отзывов пока нет</p>
      ) : (
        reviews.map((review) => (
          <article key={review.id} className="rounded-2xl bg-panel px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">@{review.buyer.username || review.buyer.name}</p>
              <p className="text-signal">★ {review.rating}</p>
            </div>
            <p className="mt-2 text-sm">{review.body}</p>
            <p className="mt-2 text-[11px] text-mute">{formatDate(review.createdAt)}</p>
            {staff ? (
              <Button
                variant="danger"
                className="mt-3 min-h-9 px-3 text-sm"
                onClick={async () => {
                  await api(`/api/reviews/${review.id}`, { method: "DELETE" });
                  await load();
                }}
              >
                Удалить отзыв
              </Button>
            ) : null}
          </article>
        ))
      )}
    </div>
  );
}
