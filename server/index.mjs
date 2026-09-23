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
  addComment,
  addMessage,
  bumpViews,
  changeBalance,
  completeDeposit,
  createOffer,
  createPayment,
  createSection,
  deleteSection,
  failWithdraw,
  getChat,
  getOffer,
  getOrCreateChat,
  getPayment,
  getPaymentByExternal,
  getSettings,
  getUserById,
  getUserByTelegram,
  holdWithdraw,
  isFavorite,
  listChats,
  listComments,
  listMessages,
  listOffers,
  listSections,
  moderateOffer,
  publicOffer,
  publicUser,
  setSetting,
  setUserRole,
  toggleFavorite,
  updatePayment,
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

function rubToCents(value) {
  return Math.round(Number(value) * 100);
}

function feeCents(amountCents, percent) {
  return Math.round(amountCents * (Number(percent) / 100));
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
  let user = getUserByTelegram(1001);
  if (!user) return res.status(500).json({ error: "Демо-пользователь не создан." });
  const role = req.body?.role;
  if (role && ["user", "moderator", "owner"].includes(role)) {
    user = setUserRole(user.id, role);
  }
  res.json({ token: signSession(user.id), user: publicUser(user) });
});

app.get("/api/me", auth, (req, res) => {
  res.json({ user: publicUser(req.user), settings: getSettings() });
});

app.get("/api/catalog", auth, (req, res) => {
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
  const offer = getOffer(req.params.id);
  if (!offer) return res.status(404).json({ error: "Объявление не найдено." });
  if (
    offer.status !== "approved" &&
    offer.seller_id !== req.user.id &&
    req.user.role === "user"
  ) {
    return res.status(404).json({ error: "Объявление ещё на проверке." });
  }
  bumpViews(offer.id);
  const fresh = getOffer(offer.id);
  res.json({
    offer: publicOffer(fresh, {
      seller: publicUser(getUserById(fresh.seller_id)),
      favorite: isFavorite(req.user.id, fresh.id),
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
  const priceCents = rubToCents(req.body?.price);
  if (!listSections().some((section) => section.id === sectionId)) {
    return res.status(400).json({ error: "Нет такого раздела." });
  }
  if (title.length < 6) return res.status(400).json({ error: "Слишком короткое название." });
  if (description.length < 20) return res.status(400).json({ error: "Опишите услугу подробнее." });
  if (priceCents < 10000) return res.status(400).json({ error: "Минимальная цена — 100 ₽." });
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
  res.json({ offer: publicOffer(offer) });
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

app.get("/api/users/:id", auth, (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "Пользователь не найден." });
  const offers = listOffers({ sellerId: user.id, status: "approved" }).map((offer) =>
    publicOffer(offer),
  );
  res.json({ user: publicUser(user), offers });
});

app.get("/api/chats", auth, (req, res) => {
  const chats = listChats(req.user.id).map((chat) => {
    const otherId = chat.buyer_id === req.user.id ? chat.seller_id : chat.buyer_id;
    return {
      id: chat.id,
      lastBody: chat.last_body,
      lastAt: chat.last_at,
      peer: publicUser(getUserById(otherId)),
      support: getUserById(otherId)?.username === "support",
    };
  });
  res.json({ chats });
});

app.get("/api/chats/:id", auth, (req, res) => {
  const chat = getChat(req.params.id);
  if (!chat || (chat.buyer_id !== req.user.id && chat.seller_id !== req.user.id)) {
    return res.status(404).json({ error: "Чат не найден." });
  }
  const otherId = chat.buyer_id === req.user.id ? chat.seller_id : chat.buyer_id;
  res.json({
    chat: {
      id: chat.id,
      peer: publicUser(getUserById(otherId)),
      messages: listMessages(chat.id).map((message) => ({
        id: message.id,
        body: message.body,
        mine: message.sender_id === req.user.id,
        createdAt: message.created_at,
      })),
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
  const chat = getChat(req.params.id);
  if (!chat || (chat.buyer_id !== req.user.id && chat.seller_id !== req.user.id)) {
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
  const creditCents = rubToCents(req.body?.amount);
  if (creditCents < 10000) return res.status(400).json({ error: "Минимум 100 ₽." });
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
        amountRub: charge / 100,
        payload: payment.id,
        description: `Пополнение BIRZA ${creditCents / 100} ₽`,
      });
      payment = updatePayment(payment.id, { externalId: invoice.id, payUrl: invoice.payUrl });
    } else if (provider === "xrocket" && xrocketEnabled()) {
      const invoice = await createRocketInvoice({
        amountRub: charge / 100,
        paymentId: payment.id,
        description: `Пополнение BIRZA ${creditCents / 100} ₽`,
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
  const creditCents = rubToCents(req.body?.amount);
  if (creditCents < 10000) return res.status(400).json({ error: "Минимум 100 ₽." });
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
    const rate = cryptobotEnabled() ? await usdtRate() : config.usdtRub;
    const usdt = (creditCents / 100 / rate).toFixed(4);
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

const bot = createBot();

app.listen(config.port, async () => {
  console.log(`BIRZA api http://localhost:${config.port}`);
  if (existsSync(distDir)) {
    console.log(`Mini App UI  http://localhost:${config.port}`);
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
  bot.start({
    onStart: (info) => console.log(`bot @${info.username}`),
  });
});
