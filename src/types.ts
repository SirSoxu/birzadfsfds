export type Role = "user" | "moderator" | "owner";

export type User = {
  id: string;
  telegramId?: number | null;
  username: string;
  name: string;
  photoUrl?: string;
  role: Role;
  balance: number;
  rating: number;
  deals: number;
  likes?: number;
  avatarHue: number;
};

export type Section = {
  id: string;
  name: string;
  description: string;
  icon: string;
  count?: number;
};

export type OfferStatus = "pending" | "approved" | "rejected";

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
};

export type ChatPreview = {
  id: string;
  lastBody?: string | null;
  lastAt?: string | null;
  peer: User | null;
  support?: boolean;
};
