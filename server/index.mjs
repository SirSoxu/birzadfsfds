import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { config } from "./env.mjs";
import { readSession, signSession, validateInitData } from "./auth.mjs";
import { createBot, configureMenu } from "./bot.mjs";
import {
  cryptobotEnabled,
  createCryptoInvoice,
  transferUsdt,
  usdtRate,
  verifyCryptoWebhook,
} from "./cryptobot.mjs";
import {
  createRocketInvoice,
  rocketPayout,
  verifyRocketWebhook,
  xrocketEnabled,
} from "./xrocket.mjs";
import {
  GLOBAL_CHAT_ID,
  activeListingCount,
  addComment,
  addMessage,
  addNotification,
  addReview,
  assignPlan,
  bumpViews,
  canPublishListing,
  cancelDeal,
  changeBalance,
  completeDeposit,
  confirmDeal,
  createDeal,
  createOffer,
  createPayment,
  createPlan,
  createSection,
  deleteMessage,
  deleteOffer,
  deletePlan,
  deleteReview,
  deleteSection,
  expireStaleListings,
  failWithdraw,
  getChat,
  getDeal,
  getDemoUser,
  getMessage,
  getMute,
  getOffer,
  getOrCreateChat,
  getPayment,
  getPaymentByExternal,
  getPlan,
  getReview,
  getSettings,
  getUserById,
  hasLink,
  holdWithdraw,
  isFavorite,
  listChats,
  listComments,
  listDealsForOffer,
  listDealsForUser,
  listMessages,
  listNotifications,
  listOffers,
  listPlans,
  listReviews,
  listSections,
  markNotificationsRead,
  moderateOffer,
  publicOffer,
  publicPlanRow,
  publicUser,
  recentSimilarCount,
  setMute,
  setOfferStatus,
  setSetting,
  toggleFavorite,
  unpaidReviewDeal,
  unreadNotifications,
  updatePayment,
  updatePlan,
  upsertTelegramUser,
} from "./db.mjs";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use("/api/webhooks", express.raw({ type: "*/*" }));
app.use(express.json());

function auth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const userId = readSession(token);
  if (!userId) return res.status(401).json({ error: "Нужно войти через Telegram." });
  req.user = getUserById(userId);
  if (!req.user) return res.status(401).json({ error: "Сессия больше не действует." });
  expireStaleListings(req.user.id);
  next();
}

function staff(req, res, next) {
  if (req.user.role !== "moderator" && req.user.role !== "owner") {
    return res.status(403).json({ error: "Недостаточно прав." });
  }
  next();
}

function owner(req, res, next) {
  if (req.user.role !== "owner") return res.status(403).json({ error: "Только владелец." });
  next();
}

function isStaff(user) {
  return user?.role === "moderator" || user?.role === "owner";
}

function moneyToCents(value) {
  return Math.round(Number(value) * 100);
}

function feeCents(amountCents, percent) {
  return Math.round(amountCents * (Number(percent) / 100));
}

function canSeeChat(chat, user) {
  if (!chat) return false;
  if (chat.id === GLOBAL_CHAT_ID) return true;
  if ((chat.kind === "support" || chat.seller_id === "u_support") && isStaff(user)) return true;
  return chat.buyer_id === user.id || chat.seller_id === user.id;
}

function serializeMessage(message, meId) {
  return {
    id: message.id,
    body: message.body,
    mine: message.sender_id === meId,
    createdAt: message.created_at,
    sender: publicUser(getUserById(message.sender_id)),
  };
}

function serializeReview(row) {
  return {
    id: row.id,
    rating: row.rating,
    body: row.body,
    createdAt: row.created_at,
    dealId: row.deal_id,
    buyer: {
      id: row.buyer_id,
      name: row.buyer_name,
      username: row.buyer_username,
      photoUrl: row.buyer_photo,
      avatarHue: Math.abs(Number(row.buyer_telegram ?? 1) * 17) % 360,
    },
  };
}

function serializeDeal(deal, meId) {
  return {
    id: deal.id,
    offerId: deal.offer_id,
    offerTitle: deal.offer_title,
    buyerId: deal.buyer_id,
    sellerId: deal.seller_id,
    amount: deal.amount_cents / 100,
    status: deal.status,
    createdAt: deal.created_at,
    mine: deal.buyer_id === meId,
    asSeller: deal.seller_id === meId,
  };
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    cryptobot: cryptobotEnabled(),
    xrocket: xrocketEnabled(),
    bot: Boolean(config.botToken),
  });
});

app.post("/api/auth/telegram", (req, res) => {
  const tg = validateInitData(req.body?.initData ?? "");
  if (!tg) return res.status(401).json({ error: "Неверные данные Telegram." });
  const user = upsertTelegramUser(tg);
  res.json({ token: signSession(user.id), user: publicUser(user) });
});

app.post("/api/auth/demo", (req, res) => {
  if (!config.demoAuth) return res.status(403).json({ error: "Демо-вход выключен." });
  const person = String(req.body?.person || req.body?.role || "alex");
  const user = getDemoUser(person);
  if (!user) return res.status(500).json({ error: "Демо-пользователь не создан." });
  res.json({ token: signSession(user.id), user: publicUser(user) });
});

app.get("/api/me", auth, (req, res) => {
  const allowed = canPublishListing(req.user);
  res.json({
    user: publicUser(req.user),
    settings: getSettings(),
    unread: unreadNotifications(req.user.id),
    canPublish: allowed.ok,
    publishError: allowed.ok ? null : allowed.error,
  });
});

app.get("/api/catalog", auth, (req, res) => {
  expireStaleListings();
  const settings = getSettings();
  const sections = listSections().map((section) => ({
    id: section.id,
    name: section.name,
    description: section.description,
    icon: section.icon,
    count: listOffers({ sectionId: section.id, status: "approved" }).length,
  }));
  const offers = listOffers({ status: "approved", q: req.query.q }).slice(0, 20).map((offer) => {
    const seller = publicUser(getUserById(offer.seller_id));
    return publicOffer(offer, { seller });
  });
  res.json({ settings, sections, offers, me: publicUser(req.user) });
});

app.get("/api/offers", auth, (req, res) => {
  expireStaleListings();
  const status =
    req.query.mine === "1"
      ? undefined
      : req.user.role === "user"
        ? "approved"
        : req.query.status;
  const rows = listOffers({
    sectionId: req.query.sectionId,
    status: req.query.mine === "1" ? undefined : status,
    sellerId: req.query.mine === "1" ? req.user.id : undefined,
    q: req.query.q,
  }).filter((offer) => {
    if (req.query.mine === "1") return true;
    if (offer.status === "approved") return true;
    return offer.seller_id === req.user.id || req.user.role !== "user";
  });
  res.json({
    offers: rows.map((offer) =>
      publicOffer(offer, { seller: publicUser(getUserById(offer.seller_id)) }),
    ),
  });
});

app.get("/api/offers/:id", auth, (req, res) => {
  let offer = getOffer(req.params.id);
  if (!offer) return res.status(404).json({ error: "Объявление не найдено." });
  expireStaleListings(offer.seller_id);
  offer = getOffer(offer.id);
  if (
    offer.status !== "approved" &&
    offer.seller_id !== req.user.id &&
    req.user.role === "user"
  ) {
    return res.status(404).json({ error: "Объявление ещё на проверке." });
  }
  bumpViews(offer.id);
  const fresh = getOffer(offer.id);
  const reviewDeal = unpaidReviewDeal(req.user.id, fresh.seller_id);
  const myDeal = listDealsForOffer(fresh.id).find(
    (deal) => deal.buyer_id === req.user.id && deal.status === "held",
  );
  const own = fresh.seller_id === req.user.id;
  const allowed = canPublishListing(getUserById(fresh.seller_id), fresh.id);
  res.json({
    offer: publicOffer(fresh, {
      seller: publicUser(getUserById(fresh.seller_id)),
      favorite: isFavorite(req.user.id, fresh.id),
      canBuy: fresh.status === "approved" && fresh.seller_id !== req.user.id,
      canReview: Boolean(reviewDeal),
      reviewDealId: reviewDeal?.id ?? null,
      canUnpublish: own && fresh.status === "approved",
      canPublish: own && fresh.status === "unpublished",
      publishError: own && fresh.status === "unpublished" && !allowed.ok ? allowed.error : null,
      myDeal: myDeal
        ? { id: myDeal.id, status: myDeal.status, amount: myDeal.amount_cents / 100 }
        : null,
      deals: isStaff(req.user) || own
        ? listDealsForOffer(fresh.id).map((deal) => serializeDeal(deal, req.user.id))
        : undefined,
      comments: listComments(fresh.id).map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: row.created_at,
        user: {
          id: row.user_id,
          name: row.name,
          username: row.username,
          photoUrl: row.photo_url,
          avatarHue: Math.abs(Number(row.telegram_id ?? 1) * 17) % 360,
        },
      })),
    }),
  });
});

app.post("/api/offers", auth, (req, res) => {
  const title = String(req.body?.title ?? "").trim();
  const description = String(req.body?.description ?? "").trim();
  const sectionId = String(req.body?.sectionId ?? "");
  const unit = String(req.body?.unit ?? "за услугу").trim() || "за услугу";
  const priceCents = moneyToCents(req.body?.price);
  if (!listSections().some((section) => section.id === sectionId)) {
    return res.status(400).json({ error: "Нет такого раздела." });
  }
  if (title.length < 6) return res.status(400).json({ error: "Слишком короткое название." });
  if (description.length < 20) return res.status(400).json({ error: "Опишите услугу подробнее." });
  if (priceCents < 100) return res.status(400).json({ error: "Минимальная цена — $1." });
  const offer = createOffer({
    sectionId,
    sellerId: req.user.id,
    title,
    description,
    priceCents,
    unit,
  });
  res.json({ offer: publicOffer(offer) });
});

app.post("/api/offers/:id/comments", auth, (req, res) => {
  const offer = getOffer(req.params.id);
  if (!offer || offer.status !== "approved") {
    return res.status(404).json({ error: "Нельзя комментировать это объявление." });
  }
  const body = String(req.body?.body ?? "").trim();
  if (body.length < 1) return res.status(400).json({ error: "Пустой комментарий." });
  addComment(offer.id, req.user.id, body.slice(0, 500));
  res.json({ ok: true });
});

app.post("/api/offers/:id/favorite", auth, (req, res) => {
  const offer = getOffer(req.params.id);
  if (!offer) return res.status(404).json({ error: "Нет объявления." });
  const favorite = toggleFavorite(req.user.id, offer.id);
  res.json({ favorite, likes: getOffer(offer.id).likes });
});

app.post("/api/offers/:id/moderate", auth, staff, (req, res) => {
  const status = req.body?.status;
  if (status !== "approved" && status !== "rejected") {
    return res.status(400).json({ error: "Неизвестный статус." });
  }
  const offer = moderateOffer(req.params.id, status, req.body?.reason);
  if (offer) {
    if (status === "approved") {
      const seller = getUserById(offer.seller_id);
      const allowed = canPublishListing(seller, offer.id);
      if (!allowed.ok) {
        setOfferStatus(offer.id, "unpublished");
        addNotification(
          offer.seller_id,
          "offer_approved",
          "Услуга одобрена",
          `«${offer.title}» прошла проверку. Купите статус продавца, чтобы выложить её.`,
        );
        return res.json({ offer: publicOffer(getOffer(offer.id)), needsPlan: true });
      }
      addNotification(offer.seller_id, "offer_approved", "Услуга опубликована", offer.title);
    } else {
      addNotification(
        offer.seller_id,
        "offer_rejected",
        "Услугу отклонили",
        offer.reject_reason || offer.title,
      );
    }
  }
  res.json({ offer: publicOffer(getOffer(req.params.id)) });
});

app.post("/api/offers/:id/visibility", auth, (req, res) => {
  const offer = getOffer(req.params.id);
  if (!offer) return res.status(404).json({ error: "Объявление не найдено." });
  if (offer.seller_id !== req.user.id && !isStaff(req.user)) {
    return res.status(403).json({ error: "Недостаточно прав." });
  }
  const published = Boolean(req.body?.published);
  if (published) {
    if (offer.status !== "unpublished" && offer.status !== "approved") {
      return res.status(400).json({ error: "Сначала объявление должно пройти модерацию." });
    }
    const allowed = canPublishListing(getUserById(offer.seller_id), offer.id);
    if (!allowed.ok && !isStaff(req.user)) {
      return res.status(403).json({ error: allowed.error });
    }
    setOfferStatus(offer.id, "approved");
  } else {
    if (offer.status !== "approved") {
      return res.status(400).json({ error: "Снять с публикации можно только активное объявление." });
    }
    setOfferStatus(offer.id, "unpublished");
  }
  res.json({ offer: publicOffer(getOffer(offer.id)) });
});

app.delete("/api/offers/:id", auth, (req, res) => {
  const offer = getOffer(req.params.id);
  if (!offer) return res.status(404).json({ error: "Объявление не найдено." });
  const own = offer.seller_id === req.user.id;
  if (!isStaff(req.user) && !own) {
    return res.status(403).json({ error: "Недостаточно прав." });
  }
  if (!isStaff(req.user) && offer.status === "approved") {
    return res.status(403).json({ error: "Опубликованную услугу может удалить модератор." });
  }
  deleteOffer(offer.id);
  if (own && offer.seller_id !== req.user.id) {
    addNotification(offer.seller_id, "offer_deleted", "Услугу удалили", offer.title);
  } else if (isStaff(req.user) && offer.seller_id !== req.user.id) {
    addNotification(offer.seller_id, "offer_deleted", "Услугу удалили", offer.title);
  }
  res.json({ ok: true });
});

app.post("/api/offers/:id/buy", auth, (req, res) => {
  const offer = getOffer(req.params.id);
  if (!offer || offer.status !== "approved") {
    return res.status(404).json({ error: "Услугу нельзя купить." });
  }
  if (offer.seller_id === req.user.id) {
    return res.status(400).json({ error: "Нельзя купить свою услугу." });
  }
  if (req.user.balance_cents < offer.price_cents) {
    return res.status(400).json({ error: "Недостаточно средств на балансе." });
  }
  const deal = createDeal({
    offerId: offer.id,
    buyerId: req.user.id,
    sellerId: offer.seller_id,
    amountCents: offer.price_cents,
  });
  addNotification(
    offer.seller_id,
    "deal_sold",
    "Новый заказ",
    `${req.user.name} оплатил «${offer.title}». Деньги придут после подтверждения.`,
  );
  addNotification(
    req.user.id,
    "deal_bought",
    "Заказ оплачен",
    `Подтвердите выполнение «${offer.title}», когда работа будет готова.`,
  );
  res.json({ deal: serializeDeal(deal, req.user.id) });
});

app.post("/api/sections", auth, owner, (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (name.length < 2) return res.status(400).json({ error: "Название раздела слишком короткое." });
  const section = createSection({
    name,
    description: String(req.body?.description ?? "Раздел услуг").trim(),
    icon: String(req.body?.icon ?? "palette"),
  });
  res.json({ section });
});

app.delete("/api/sections/:id", auth, owner, (req, res) => {
  deleteSection(req.params.id);
  res.json({ ok: true });
});

app.post("/api/settings", auth, owner, (req, res) => {
  if (req.body.depositCommission != null) {
    setSetting("deposit_commission", Number(req.body.depositCommission));
  }
  if (req.body.withdrawCommission != null) {
    setSetting("withdraw_commission", Number(req.body.withdrawCommission));
  }
  if (req.body.chatLocked != null) {
    setSetting("global_chat_locked", req.body.chatLocked ? "1" : "0");
  }
  const banner = req.body.banner ?? {};
  for (const [key, setting] of [
    ["title", "banner_title"],
    ["subtitle", "banner_subtitle"],
    ["href", "banner_href"],
    ["cta", "banner_cta"],
    ["imageUrl", "banner_image"],
  ]) {
    if (banner[key] != null) setSetting(setting, banner[key]);
  }
  res.json({ settings: getSettings() });
});

app.get("/api/plans", auth, (_req, res) => {
  res.json({ plans: listPlans().map(publicPlanRow) });
});

app.post("/api/plans", auth, owner, (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (name.length < 2) return res.status(400).json({ error: "Название статуса слишком короткое." });
  const plan = createPlan({
    name,
    priceCents: moneyToCents(req.body?.price ?? 0),
    durationDays: Math.max(0, Number(req.body?.durationDays ?? 30)),
    maxActive: Math.max(0, Number(req.body?.maxActive ?? 1)),
  });
  res.json({ plan: publicPlanRow(plan) });
});

app.post("/api/plans/:id", auth, owner, (req, res) => {
  const current = getPlan(req.params.id);
  if (!current) return res.status(404).json({ error: "Статус не найден." });
  const plan = updatePlan(current.id, {
    name: req.body?.name != null ? String(req.body.name).trim() : undefined,
    priceCents: req.body?.price != null ? moneyToCents(req.body.price) : undefined,
    durationDays: req.body?.durationDays != null ? Math.max(0, Number(req.body.durationDays)) : undefined,
    maxActive: req.body?.maxActive != null ? Math.max(0, Number(req.body.maxActive)) : undefined,
  });
  res.json({ plan: publicPlanRow(plan) });
});

app.delete("/api/plans/:id", auth, owner, (req, res) => {
  deletePlan(req.params.id);
  res.json({ ok: true });
});

app.post("/api/plans/:id/buy", auth, (req, res) => {
  const plan = getPlan(req.params.id);
  if (!plan) return res.status(404).json({ error: "Статус не найден." });
  if (plan.max_active < 1 && plan.price_cents <= 0) {
    return res.status(400).json({ error: "Этот статус нельзя купить." });
  }
  if (plan.price_cents > 0 && req.user.balance_cents < plan.price_cents) {
    return res.status(400).json({ error: "Недостаточно средств на балансе." });
  }
  if (plan.price_cents > 0) changeBalance(req.user.id, -plan.price_cents);
  let from = Date.now();
  if (req.user.plan_id === plan.id && req.user.plan_until) {
    const current = new Date(req.user.plan_until).getTime();
    if (current > from) from = current;
  }
  const until =
    plan.duration_days > 0 ? new Date(from + plan.duration_days * 86400000).toISOString() : null;
  const user = assignPlan(req.user.id, plan.id, until);
  addNotification(req.user.id, "plan_bought", `Статус «${plan.name}»`, "Теперь можно выкладывать объявления.");
  res.json({ user: publicUser(user), plan: publicPlanRow(plan) });
});

app.get("/api/users/:id", auth, (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "Пользователь не найден." });
  const seeAll = isStaff(req.user) || req.user.id === user.id;
  const offers = listOffers({ sellerId: user.id, status: seeAll ? undefined : "approved" }).map((offer) =>
    publicOffer(offer),
  );
  const reviewDeal = unpaidReviewDeal(req.user.id, user.id);
  res.json({
    user: publicUser(user),
    offers,
    canReview: Boolean(reviewDeal),
    reviewDealId: reviewDeal?.id ?? null,
    deals: isStaff(req.user)
      ? listDealsForUser(user.id).map((deal) => serializeDeal(deal, user.id))
      : undefined,
  });
});

app.get("/api/users/:id/reviews", auth, (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "Пользователь не найден." });
  res.json({ user: publicUser(user), reviews: listReviews(user.id).map(serializeReview) });
});

app.post("/api/users/:id/reviews", auth, (req, res) => {
  const seller = getUserById(req.params.id);
  if (!seller) return res.status(404).json({ error: "Пользователь не найден." });
  if (seller.id === req.user.id) return res.status(400).json({ error: "Нельзя оценить себя." });
  const deal = unpaidReviewDeal(req.user.id, seller.id);
  if (!deal) {
    return res.status(403).json({ error: "Отзыв можно оставить только после покупки." });
  }
  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Оценка от 1 до 5." });
  }
  const body = String(req.body?.body ?? "").trim();
  if (body.length < 2) return res.status(400).json({ error: "Напишите комментарий." });
  const review = addReview({
    sellerId: seller.id,
    buyerId: req.user.id,
    dealId: deal.id,
    rating,
    body: body.slice(0, 500),
  });
  addNotification(
    seller.id,
    "review_received",
    "Новый отзыв",
    `${req.user.name} поставил ${rating} из 5`,
  );
  res.json({ review: { id: review.id, rating: review.rating, body: review.body } });
});

app.delete("/api/reviews/:id", auth, staff, (req, res) => {
  const review = getReview(req.params.id);
  if (!review) return res.status(404).json({ error: "Отзыв не найден." });
  deleteReview(review.id);
  res.json({ ok: true });
});

app.post("/api/deals/:id/cancel", auth, staff, (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: "Сделка не найдена." });
  const updated = cancelDeal(deal.id);
  if (!updated) return res.status(400).json({ error: "Сделку нельзя отменить." });
  addNotification(deal.buyer_id, "deal_cancelled", "Сделку отменили", "Средства вернулись на баланс.");
  addNotification(deal.seller_id, "deal_cancelled", "Сделку отменили", "Оплата возвращена покупателю.");
  res.json({ deal: serializeDeal(updated, req.user.id) });
});

app.post("/api/deals/:id/confirm", auth, (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: "Сделка не найдена." });
  if (deal.buyer_id !== req.user.id) {
    return res.status(403).json({ error: "Подтвердить может только покупатель." });
  }
  const updated = confirmDeal(deal.id);
  if (!updated) return res.status(400).json({ error: "Сделку уже подтвердили или отменили." });
  const offer = getOffer(deal.offer_id);
  addNotification(
    deal.seller_id,
    "deal_completed",
    "Покупатель подтвердил сделку",
    `Деньги за «${offer?.title || "услугу"}» зачислены.`,
  );
  addNotification(deal.buyer_id, "deal_completed", "Сделка завершена", "Можно оставить отзыв продавцу.");
  res.json({ deal: serializeDeal(updated, req.user.id) });
});

app.get("/api/deals", auth, (req, res) => {
  res.json({
    deals: listDealsForUser(req.user.id).map((deal) => serializeDeal(deal, req.user.id)),
  });
});

app.get("/api/users/:id/deals", auth, staff, (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "Пользователь не найден." });
  res.json({
    user: publicUser(user),
    deals: listDealsForUser(user.id).map((deal) => serializeDeal(deal, user.id)),
  });
});

app.get("/api/chats", auth, (req, res) => {
  const staffView = isStaff(req.user);
  const chats = listChats(req.user.id, { staff: staffView }).map((chat) => {
    const support = chat.kind === "support" || chat.seller_id === "u_support";
    const otherId = support
      ? chat.buyer_id === req.user.id
        ? chat.seller_id
        : chat.buyer_id
      : chat.buyer_id === req.user.id
        ? chat.seller_id
        : chat.buyer_id;
    const peer = publicUser(getUserById(otherId));
    return {
      id: chat.id,
      lastBody: chat.last_body,
      lastAt: chat.last_at,
      peer,
      support,
      kind: chat.kind || "direct",
    };
  });
  res.json({ chats });
});

app.get("/api/chats/:id", auth, (req, res) => {
  if (req.params.id === "global" || req.params.id === GLOBAL_CHAT_ID) {
    return globalChatPayload(req, res);
  }
  const chat = getChat(req.params.id);
  if (!canSeeChat(chat, req.user)) {
    return res.status(404).json({ error: "Чат не найден." });
  }
  const support = chat.kind === "support" || chat.seller_id === "u_support";
  const otherId = support
    ? chat.buyer_id === req.user.id
      ? chat.seller_id
      : chat.buyer_id
    : chat.buyer_id === req.user.id
      ? chat.seller_id
      : chat.buyer_id;
  res.json({
    chat: {
      id: chat.id,
      kind: chat.kind || "direct",
      support,
      peer: publicUser(getUserById(otherId)),
      messages: listMessages(chat.id).map((message) => serializeMessage(message, req.user.id)),
    },
  });
});

app.post("/api/chats", auth, (req, res) => {
  const sellerId = String(req.body?.sellerId ?? "");
  const offerId = req.body?.offerId ? String(req.body.offerId) : null;
  if (!getUserById(sellerId) || sellerId === req.user.id) {
    return res.status(400).json({ error: "Нельзя открыть этот чат." });
  }
  const chat = getOrCreateChat({ offerId, buyerId: req.user.id, sellerId });
  res.json({ chatId: chat.id });
});

app.post("/api/chats/:id/messages", auth, (req, res) => {
  if (req.params.id === "global" || req.params.id === GLOBAL_CHAT_ID) {
    return postGlobalMessage(req, res);
  }
  const chat = getChat(req.params.id);
  if (!canSeeChat(chat, req.user)) {
    return res.status(404).json({ error: "Чат не найден." });
  }
  const body = String(req.body?.body ?? "").trim();
  if (!body) return res.status(400).json({ error: "Пустое сообщение." });
  addMessage(chat.id, req.user.id, body.slice(0, 2000));
  res.json({ ok: true });
});

app.post("/api/wallet/deposit", auth, async (req, res) => {
  const provider = req.body?.provider;
  if (provider !== "cryptobot" && provider !== "xrocket") {
    return res.status(400).json({ error: "Выберите CryptoBot или xRocket." });
  }
  const creditCents = moneyToCents(req.body?.amount);
  if (creditCents < 100) return res.status(400).json({ error: "Минимум $1." });
  const settings = getSettings();
  const fee = feeCents(creditCents, settings.depositCommission);
  const charge = creditCents + fee;
  let payment = createPayment({
    userId: req.user.id,
    kind: "deposit",
    provider,
    creditCents,
    feeCents: fee,
    chargeCents: charge,
    status: "pending",
  });

  try {
    if (provider === "cryptobot" && cryptobotEnabled()) {
      const invoice = await createCryptoInvoice({
        amountUsd: charge / 100,
        payload: payment.id,
        description: `Пополнение BIRZA $${(creditCents / 100).toFixed(2)}`,
      });
      payment = updatePayment(payment.id, { externalId: invoice.id, payUrl: invoice.payUrl });
    } else if (provider === "xrocket" && xrocketEnabled()) {
      const invoice = await createRocketInvoice({
        amountUsd: charge / 100,
        paymentId: payment.id,
        description: `Пополнение BIRZA $${(creditCents / 100).toFixed(2)}`,
        telegramId: req.user.telegram_id,
        username: req.user.username,
      });
      payment = updatePayment(payment.id, { externalId: invoice.id, payUrl: invoice.payUrl });
    } else {
      payment = updatePayment(payment.id, {
        payUrl: `${config.publicUrl}/api/payments/${payment.id}/complete-demo`,
      });
    }
  } catch (error) {
    updatePayment(payment.id, { status: "failed" });
    return res.status(502).json({ error: error.message || "Платёжный сервис недоступен." });
  }

  res.json({
    payment: serializePayment(payment),
    demo: !payment.external_id,
  });
});

app.post("/api/wallet/withdraw", auth, async (req, res) => {
  const provider = req.body?.provider;
  if (provider !== "cryptobot" && provider !== "xrocket") {
    return res.status(400).json({ error: "Выберите CryptoBot или xRocket." });
  }
  if (!req.user.telegram_id || req.user.telegram_id < 10) {
    return res.status(400).json({
      error: "Вывод доступен после входа через Telegram-бот.",
    });
  }
  const creditCents = moneyToCents(req.body?.amount);
  if (creditCents < 100) return res.status(400).json({ error: "Минимум $1." });
  const settings = getSettings();
  const fee = feeCents(creditCents, settings.withdrawCommission);
  const charge = creditCents + fee;
  if (req.user.balance_cents < charge) {
    return res.status(400).json({ error: "Недостаточно средств с учётом комиссии." });
  }

  let payment = createPayment({
    userId: req.user.id,
    kind: "withdraw",
    provider,
    creditCents,
    feeCents: fee,
    chargeCents: charge,
    status: "pending",
  });
  payment = holdWithdraw(payment);
  if (!payment) return res.status(400).json({ error: "Недостаточно средств." });

  try {
    const rate = cryptobotEnabled() ? await usdtRate() : 1;
    const usdt = (creditCents / 100 / (rate || 1)).toFixed(4);
    if (provider === "cryptobot" && cryptobotEnabled()) {
      const result = await transferUsdt({
        telegramId: req.user.telegram_id,
        amount: usdt,
        spendId: payment.id,
      });
      payment = updatePayment(payment.id, {
        status: "paid",
        externalId: String(result.transfer_id ?? result.spend_id ?? payment.id),
      });
    } else if (provider === "xrocket" && xrocketEnabled()) {
      const result = await rocketPayout({
        telegramId: req.user.telegram_id,
        amountUsdt: usdt,
        paymentId: payment.id,
      });
      payment = updatePayment(payment.id, {
        status: result.status === "finished" ? "paid" : "processing",
        externalId: String(result.payoutId ?? result.id ?? ""),
      });
    } else {
      payment = updatePayment(payment.id, { status: "paid" });
    }
  } catch (error) {
    failWithdraw(payment);
    return res.status(502).json({ error: error.message || "Не удалось отправить выплату." });
  }

  res.json({
    payment: serializePayment(getPayment(payment.id)),
    user: publicUser(getUserById(req.user.id)),
  });
});

app.get("/api/payments/:id", auth, (req, res) => {
  const payment = getPayment(req.params.id);
  if (!payment || payment.user_id !== req.user.id) {
    return res.status(404).json({ error: "Платёж не найден." });
  }
  res.json({ payment: serializePayment(payment), user: publicUser(getUserById(req.user.id)) });
});

app.get("/api/payments/:id/complete-demo", (req, res) => {
  const payment = getPayment(req.params.id);
  if (!payment || payment.kind !== "deposit") {
    return res.status(404).send("Платёж не найден");
  }
  if (payment.external_id && (cryptobotEnabled() || xrocketEnabled())) {
    return res.status(403).send("Демо-оплата выключена, когда подключены платёжные ключи.");
  }
  completeDeposit(payment);
  res.send("Оплата засчитана. Вернитесь в мини-приложение BIRZA.");
});

app.post("/api/webhooks/cryptobot", (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);
  const signature = req.headers["crypto-pay-api-signature"];
  if (cryptobotEnabled() && !verifyCryptoWebhook(raw, signature)) {
    return res.status(401).json({ ok: false });
  }
  const update = JSON.parse(raw);
  if (update.update_type === "invoice_paid") {
    const invoice = update.payload;
    const payment =
      getPayment(invoice.payload) ||
      getPaymentByExternal("cryptobot", String(invoice.invoice_id));
    if (payment && payment.kind === "deposit") completeDeposit(payment);
  }
  res.json({ ok: true });
});

app.post("/api/webhooks/xrocket", (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);
  const signature = req.headers.signature || req.headers["rocket-pay-signature"];
  const timestamp = req.headers["signature-timestamp"];
  if (xrocketEnabled() && !verifyRocketWebhook(raw, signature, timestamp)) {
    return res.status(401).json({ ok: false });
  }
  const update = JSON.parse(raw);
  const paymentId =
    update.data?.invoice?.callback?.payload?.paymentId ||
    update.data?.callback?.payload?.paymentId ||
    update.data?.invoice?.clientInvoiceId ||
    update.data?.clientPayoutId;
  const status = update.data?.invoice?.status || update.data?.status;
  const payment = paymentId ? getPayment(paymentId) : null;
  if (payment?.kind === "deposit" && (status === "paid" || update.data?.event === "paid")) {
    completeDeposit(payment);
  }
  if (payment?.kind === "withdraw" && (status === "finished" || status === "paid")) {
    updatePayment(payment.id, { status: "paid" });
  }
  if (payment?.kind === "withdraw" && status === "failed") {
    failWithdraw(payment);
  }
  res.json({ ok: true });
});

function globalChatPayload(req, res) {
  const settings = getSettings();
  const mute = getMute(req.user.id);
  res.json({
    chat: {
      id: GLOBAL_CHAT_ID,
      kind: "global",
      locked: settings.chatLocked,
      mutedUntil: mute?.until ?? null,
      muteReason: mute?.reason ?? "",
      peer: { name: "Общий чат", username: "chat", avatarHue: 210, role: "user" },
      messages: listMessages(GLOBAL_CHAT_ID).map((message) => serializeMessage(message, req.user.id)),
    },
  });
}

function postGlobalMessage(req, res) {
  const body = String(req.body?.body ?? "").trim();
  if (!body) return res.status(400).json({ error: "Пустое сообщение." });
  const settings = getSettings();
  const staffMember = isStaff(req.user);
  if (settings.chatLocked && !staffMember) {
    return res.status(403).json({ error: "Чат отключён владельцем." });
  }
  const mute = getMute(req.user.id);
  if (mute && !staffMember) {
    return res.status(403).json({ error: `Мут до ${new Date(mute.until).toLocaleString("ru-RU")}` });
  }
  if (!staffMember && hasLink(body)) {
    setMute(req.user.id, 24, "Ссылки в общем чате");
    addNotification(req.user.id, "muted", "Мут на 24 часа", "В общем чате нельзя отправлять ссылки.");
    return res.status(400).json({ error: "Ссылки запрещены. Мут на 24 часа." });
  }
  if (!staffMember && recentSimilarCount(GLOBAL_CHAT_ID, req.user.id, body) >= 3) {
    return res.status(400).json({ error: "Слишком много одинаковых сообщений за 3 минуты." });
  }
  addMessage(GLOBAL_CHAT_ID, req.user.id, body.slice(0, 2000));
  return res.json({ ok: true });
}

app.get("/api/notifications", auth, (req, res) => {
  res.json({
    notifications: listNotifications(req.user.id).map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      read: Boolean(row.read),
      createdAt: row.created_at,
    })),
    unread: unreadNotifications(req.user.id),
  });
});

app.post("/api/notifications/read", auth, (req, res) => {
  markNotificationsRead(req.user.id);
  res.json({ ok: true, unread: 0 });
});

app.post("/api/global-chat/mute", auth, staff, (req, res) => {
  const target = getUserById(String(req.body?.userId ?? ""));
  if (!target) return res.status(404).json({ error: "Пользователь не найден." });
  if (isStaff(target) && req.user.role !== "owner") {
    return res.status(403).json({ error: "Нельзя дать мут сотруднику." });
  }
  const hours = Number(req.body?.hours ?? 24);
  if (!hours || hours < 0.1) return res.status(400).json({ error: "Укажите срок мута." });
  const mute = setMute(target.id, hours, String(req.body?.reason ?? "Мут модератора"));
  addNotification(target.id, "muted", "Вам выдали мут", mute.reason);
  res.json({ ok: true, until: mute.until });
});

app.delete("/api/global-chat/messages/:id", auth, staff, (req, res) => {
  const message = getMessage(req.params.id);
  if (!message || message.chat_id !== GLOBAL_CHAT_ID) {
    return res.status(404).json({ error: "Сообщение не найдено." });
  }
  deleteMessage(message.id);
  res.json({ ok: true });
});

function serializePayment(payment) {
  return {
    id: payment.id,
    kind: payment.kind,
    provider: payment.provider,
    credit: payment.credit_cents / 100,
    fee: payment.fee_cents / 100,
    charge: payment.charge_cents / 100,
    status: payment.status,
    payUrl: payment.pay_url,
  };
}

const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    res.sendFile(join(distDir, "index.html"));
  });
}

process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection", reason);
});
process.on("uncaughtException", (error) => {
  console.error("uncaughtException", error);
});

const bot = createBot();

const server = app.listen(config.port, "0.0.0.0", async () => {
  console.log(`BIRZA api http://0.0.0.0:${config.port}`);
  if (existsSync(distDir)) {
    console.log(`Mini App UI  http://0.0.0.0:${config.port}`);
  } else {
    console.warn("Папка dist не найдена. Выполните npm run build");
  }
  if (!bot) {
    console.log("BOT_TOKEN не задан — бот не запущен, демо-вход включён.");
    return;
  }
  try {
    await configureMenu(bot);
  } catch (error) {
    console.warn("menu button", error.message);
  }
  try {
    await bot.start({
      onStart: (info) => console.log(`bot @${info.username}`),
    });
  } catch (error) {
    console.error("бот не запустился, сайт продолжает работать:", error.message);
  }
});

server.on("error", (error) => {
  console.error("не удалось занять порт", config.port, error.message);
  process.exit(1);
});
