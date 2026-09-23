export type Role = "user" | "moderator" | "owner";

export type ListingPlan = {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  maxActive: number;
  until?: string | null;
  activeCount?: number;
  expired?: boolean;
};

export type User = {
  id: string;
  telegramId?: number | null;
  username: string;
  name: string;
  photoUrl?: string;
  role: Role;
  balance: number;
  rating: number | null;
  reviewCount?: number;
  deals: number;
  likes?: number;
  avatarHue: number;
  mutedUntil?: string | null;
  plan?: ListingPlan | null;
};

export type DealStatus = "held" | "completed" | "paid" | "cancelled";

export type Deal = {
  id: string;
  offerId?: string;
  offerTitle?: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  status: DealStatus | string;
  createdAt: string;
  mine?: boolean;
  asSeller?: boolean;
};

export type Section = {
  id: string;
  name: string;
  description: string;
  icon: string;
  count?: number;
};

export type OfferStatus = "pending" | "approved" | "rejected" | "unpublished";

export type Offer = {
  id: string;
  sectionId: string;
  sellerId: string;
  title: string;
  description: string;
  price: number;
  unit: string;
  status: OfferStatus;
  rejectReason?: string;
  views?: number;
  likes?: number;
  createdAt: string;
  seller?: User;
  favorite?: boolean;
  comments?: CommentItem[];
  canBuy?: boolean;
  canReview?: boolean;
  reviewDealId?: string | null;
  canUnpublish?: boolean;
  canPublish?: boolean;
  publishError?: string | null;
  myDeal?: { id: string; status: string; amount: number } | null;
  deals?: Deal[];
};

export type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  user: Pick<User, "id" | "name" | "username" | "photoUrl" | "avatarHue">;
};

export type Banner = {
  title: string;
  subtitle: string;
  href: string;
  cta: string;
  imageUrl: string;
};

export type Settings = {
  depositCommission: number;
  withdrawCommission: number;
  banner: Banner;
  chatLocked?: boolean;
  demoAuth?: boolean;
};

export type ChatPreview = {
  id: string;
  lastBody?: string | null;
  lastAt?: string | null;
  peer: User | null;
  support?: boolean;
  kind?: string;
};

export type ChatMessage = {
  id: string;
  body: string;
  mine: boolean;
  createdAt: string;
  sender?: User | null;
};

export type ReviewItem = {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  buyer: Pick<User, "id" | "name" | "username" | "photoUrl" | "avatarHue">;
};

export type Notice = {
  id: string;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};
