import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Button } from "../components/ui";
import { api } from "../lib/api";
import type { Offer, User } from "../types";
import { SearchCard } from "./HomePage";

export function UserPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    api<{ user: User; offers: Offer[] }>(`/api/users/${id}`).then((payload) => {
      setUser(payload.user);
      setOffers(payload.offers);
    });
  }, [id]);

  if (!user) return null;

  return (
    <div className="flex flex-col items-center gap-4 pt-6 text-center">
      <Avatar name={user.name} hue={user.avatarHue} photoUrl={user.photoUrl} size={92} />
      <p className="text-xl font-semibold">@{user.username}</p>
      <p className="text-sm text-mute">
        Баланс скрыт · ★ {user.rating.toFixed(1)} · ♥ {user.likes ?? 0}
      </p>
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
