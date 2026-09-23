import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./env.mjs";

const dbPath = resolve(process.cwd(), "server/data/birza.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  telegram_id INTEGER UNIQUE,
  username TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  photo_url TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  balance_cents INTEGER NOT NULL DEFAULT 0,
  rating REAL NOT NULL DEFAULT 5,
  deals INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'palette',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'за услугу',
  status TEXT NOT NULL DEFAULT 'pending',
  reject_reason TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id TEXT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, offer_id)
);
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  offer_id TEXT REFERENCES offers(id) ON DELETE SET NULL,
  buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE (offer_id, buyer_id, seller_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  provider TEXT NOT NULL,
  credit_cents INTEGER NOT NULL,
  fee_cents INTEGER NOT NULL,
  charge_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  external_id TEXT,
  pay_url TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (provider, external_id)
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_offers_section_status ON offers(section_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);
CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deal_id TEXT NOT NULL UNIQUE REFERENCES deals(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mutes (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  until TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS listing_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 30,
  max_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
`);

function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
}

if (!columnExists("chats", "kind")) {
  db.exec("ALTER TABLE chats ADD COLUMN kind TEXT NOT NULL DEFAULT 'direct'");
}
if (!columnExists("messages", "deleted_at")) {
  db.exec("ALTER TABLE messages ADD COLUMN deleted_at TEXT");
}
if (!columnExists("users", "plan_id")) {
  db.exec("ALTER TABLE users ADD COLUMN plan_id TEXT");
}
if (!columnExists("users", "plan_until")) {
  db.exec("ALTER TABLE users ADD COLUMN plan_until TEXT");
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

const getSettingStmt = db.prepare("SELECT value FROM settings WHERE key = ?");
const setSettingStmt = db.prepare(
  "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
);

export function getSetting(key, fallback = "") {
  return getSettingStmt.get(key)?.value ?? fallback;
}

export function setSetting(key, value) {
  setSettingStmt.run(key, String(value));
}

export function getSettings() {
  return {
    depositCommission: Number(getSetting("deposit_commission", "1.5")),
    withdrawCommission: Number(getSetting("withdraw_commission", "1.5")),
    chatLocked: getSetting("global_chat_locked", "0") === "1",
    demoAuth: config.demoAuth,
    banner: {
      title: getSetting("banner_title", "Комиссия на вывод 1.5%"),
      subtitle: getSetting(
        "banner_subtitle",
        "Пополняйте в долларах через CryptoBot или xRocket и выводите после сделки.",
      ),
      href: getSetting("banner_href", "https://t.me"),
      cta: getSetting("banner_cta", "Подробнее"),
      imageUrl: getSetting("banner_image", ""),
    },
  };
}

export function sellerRating(sellerId) {
  const row = db
    .prepare("SELECT AVG(rating) AS avg, COUNT(*) AS count FROM reviews WHERE seller_id = ?")
    .get(sellerId);
  const count = Number(row?.count ?? 0);
  if (!count) return { rating: null, reviewCount: 0 };
  return { rating: Math.round(Number(row.avg) * 10) / 10, reviewCount: count };
}

export function publicUser(row) {
  if (!row) return null;
  const stats = sellerRating(row.id);
  return {
    id: row.id,
    telegramId: row.telegram_id,
    username: row.username,
    name: row.name,
    photoUrl: row.photo_url,
    role: row.role,
    balance: row.balance_cents / 100,
    rating: stats.rating,
    reviewCount: stats.reviewCount,
    deals: row.deals,
    likes: row.likes,
    avatarHue: Math.abs(Number(row.telegram_id ?? 1) * 17) % 360,
    createdAt: row.created_at,
    mutedUntil: getMute(row.id)?.until ?? null,
    plan: publicPlan(row),
  };
}

export function getPlan(id) {
  if (!id) return null;
  return db.prepare("SELECT * FROM listing_plans WHERE id = ?").get(id);
}

export function listPlans() {
  return db.prepare("SELECT * FROM listing_plans ORDER BY price_cents ASC, name ASC").all();
}

export function publicPlanRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    price: row.price_cents / 100,
    durationDays: row.duration_days,
    maxActive: row.max_active,
  };
}

export function planActive(user) {
  const plan = getPlan(user?.plan_id);
  if (!plan || plan.max_active < 1) return null;
  if (plan.duration_days > 0 && user.plan_until && new Date(user.plan_until).getTime() <= Date.now()) {
    return null;
  }
  return plan;
}

export function activeListingCount(sellerId, exceptId) {
  const row = exceptId
    ? db
        .prepare("SELECT COUNT(*) AS c FROM offers WHERE seller_id = ? AND status = 'approved' AND id != ?")
        .get(sellerId, exceptId)
    : db.prepare("SELECT COUNT(*) AS c FROM offers WHERE seller_id = ? AND status = 'approved'").get(sellerId);
  return Number(row?.c ?? 0);
}

export function publicPlan(user) {
  const plan = getPlan(user?.plan_id);
  if (!plan) return null;
  const expired =
    plan.duration_days > 0 && user.plan_until && new Date(user.plan_until).getTime() <= Date.now();
  return {
    id: plan.id,
    name: plan.name,
    until: user.plan_until,
    maxActive: plan.max_active,
    durationDays: plan.duration_days,
    price: plan.price_cents / 100,
    activeCount: activeListingCount(user.id),
    expired: Boolean(expired),
  };
}

export function canPublishListing(user, exceptOfferId) {
  if (user.role === "owner" || user.role === "moderator") return { ok: true };
  const plan = planActive(user);
  if (!plan) return { ok: false, error: "Чтобы выложить объявление, купите статус продавца." };
  if (activeListingCount(user.id, exceptOfferId) >= plan.max_active) {
    return { ok: false, error: `Лимит статуса «${plan.name}»: ${plan.max_active} активных объявлений.` };
  }
  return { ok: true, plan };
}

export function expireStaleListings(userId) {
  const user = userId ? getUserById(userId) : null;
  if (user && (user.role === "owner" || user.role === "moderator")) return;
  if (user && planActive(user)) return;
  if (user) {
    db.prepare("UPDATE offers SET status = 'unpublished' WHERE seller_id = ? AND status = 'approved'").run(user.id);
    return;
  }
  const rows = db
    .prepare(
      `SELECT DISTINCT u.id FROM users u
       JOIN offers o ON o.seller_id = u.id AND o.status = 'approved'
       WHERE u.role = 'user'`,
    )
    .all();
  for (const row of rows) {
    const seller = getUserById(row.id);
    if (!planActive(seller)) {
      db.prepare("UPDATE offers SET status = 'unpublished' WHERE seller_id = ? AND status = 'approved'").run(row.id);
    }
  }
}

export function publicOffer(row, extra = {}) {
  return {
    id: row.id,
    sectionId: row.section_id,
    sellerId: row.seller_id,
    title: row.title,
    description: row.description,
    price: row.price_cents / 100,
    unit: row.unit,
    status: row.status,
    rejectReason: row.reject_reason ?? undefined,
    views: row.views,
    likes: row.likes,
    createdAt: row.created_at,
    ...extra,
  };
}

const userByTelegram = db.prepare("SELECT * FROM users WHERE telegram_id = ?");
const userById = db.prepare("SELECT * FROM users WHERE id = ?");

export function getUserById(id) {
  return userById.get(id);
}

export function getUserByTelegram(telegramId) {
  return userByTelegram.get(Number(telegramId));
}

export function upsertTelegramUser(tg) {
  const existing = getUserByTelegram(tg.id);
  const name = [tg.first_name, tg.last_name].filter(Boolean).join(" ") || "Пользователь";
  const username = tg.username ?? "";
  const photo = tg.photo_url ?? "";
  let role = "user";
  const sid = String(tg.id);
  if (config.ownerIds.includes(sid)) role = "owner";
  else if (config.moderatorIds.includes(sid)) role = "moderator";

  if (existing) {
    db.prepare(
      "UPDATE users SET username = ?, name = ?, photo_url = ?, role = CASE WHEN role = 'user' THEN ? ELSE role END WHERE id = ?",
    ).run(username, name, photo, role, existing.id);
    return getUserById(existing.id);
  }

  const id = uid("u");
  db.prepare(
    `INSERT INTO users(id, telegram_id, username, name, photo_url, role, balance_cents, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
  ).run(id, tg.id, username, name, photo, role, now());
  return getUserById(id);
}

export function setUserRole(id, role) {
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
  return getUserById(id);
}

export function changeBalance(id, deltaCents) {
  db.prepare("UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?").run(deltaCents, id);
  return getUserById(id);
}

export function listSections() {
  return db.prepare("SELECT * FROM sections ORDER BY created_at DESC").all();
}

export function createSection(input) {
  const id = uid("s");
  db.prepare(
    "INSERT INTO sections(id, name, description, icon, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, input.name, input.description, input.icon, now());
  return db.prepare("SELECT * FROM sections WHERE id = ?").get(id);
}

export function deleteSection(id) {
  db.prepare("DELETE FROM sections WHERE id = ?").run(id);
}

export function listOffers({ sectionId, status, sellerId, q } = {}) {
  let sql = "SELECT * FROM offers WHERE 1=1";
  const params = [];
  if (sectionId) {
    sql += " AND section_id = ?";
    params.push(sectionId);
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (sellerId) {
    sql += " AND seller_id = ?";
    params.push(sellerId);
  }
  if (q) {
    sql += " AND (title LIKE ? OR description LIKE ?)";
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += " ORDER BY created_at DESC";
  return db.prepare(sql).all(...params);
}

export function getOffer(id) {
  return db.prepare("SELECT * FROM offers WHERE id = ?").get(id);
}

export function bumpViews(id) {
  db.prepare("UPDATE offers SET views = views + 1 WHERE id = ?").run(id);
}

export function createOffer(input) {
  const id = uid("o");
  db.prepare(
    `INSERT INTO offers(id, section_id, seller_id, title, description, price_cents, unit, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
  ).run(
    id,
    input.sectionId,
    input.sellerId,
    input.title,
    input.description,
    input.priceCents,
    input.unit,
    now(),
  );
  return getOffer(id);
}

export function moderateOffer(id, status, rejectReason) {
  db.prepare("UPDATE offers SET status = ?, reject_reason = ? WHERE id = ?").run(
    status,
    status === "rejected" ? rejectReason ?? "Не соответствует правилам" : null,
    id,
  );
  return getOffer(id);
}

export function setOfferStatus(id, status) {
  db.prepare("UPDATE offers SET status = ? WHERE id = ?").run(status, id);
  return getOffer(id);
}

export function listComments(offerId) {
  return db
    .prepare(
      `SELECT c.*, u.name, u.username, u.photo_url, u.telegram_id
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.offer_id = ? ORDER BY c.created_at ASC`,
    )
    .all(offerId);
}

export function addComment(offerId, userId, body) {
  const id = uid("c");
  db.prepare(
    "INSERT INTO comments(id, offer_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, offerId, userId, body, now());
  return listComments(offerId);
}

export function toggleFavorite(userId, offerId) {
  const exists = db
    .prepare("SELECT 1 FROM favorites WHERE user_id = ? AND offer_id = ?")
    .get(userId, offerId);
  if (exists) {
    db.prepare("DELETE FROM favorites WHERE user_id = ? AND offer_id = ?").run(userId, offerId);
    db.prepare("UPDATE offers SET likes = MAX(likes - 1, 0) WHERE id = ?").run(offerId);
    return false;
  }
  db.prepare("INSERT INTO favorites(user_id, offer_id) VALUES (?, ?)").run(userId, offerId);
  db.prepare("UPDATE offers SET likes = likes + 1 WHERE id = ?").run(offerId);
  return true;
}

export function isFavorite(userId, offerId) {
  return Boolean(
    db.prepare("SELECT 1 FROM favorites WHERE user_id = ? AND offer_id = ?").get(userId, offerId),
  );
}

export function supportUser() {
  return db.prepare("SELECT * FROM users WHERE id = 'u_support'").get();
}

export function getOrCreateChat({ offerId, buyerId, sellerId, kind = "direct" }) {
  const found = db
    .prepare(
      `SELECT * FROM chats WHERE buyer_id = ? AND seller_id = ? AND IFNULL(offer_id,'') = IFNULL(?, '')
       AND IFNULL(kind,'direct') = ?`,
    )
    .get(buyerId, sellerId, offerId ?? "", kind);
  if (found) return found;
  const id = uid("ch");
  db.prepare(
    "INSERT INTO chats(id, offer_id, buyer_id, seller_id, created_at, kind) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, offerId ?? null, buyerId, sellerId, now(), kind);
  return db.prepare("SELECT * FROM chats WHERE id = ?").get(id);
}

export function ensureSupportChat(userId) {
  const support = supportUser();
  if (!support || support.id === userId) return null;
  return getOrCreateChat({
    offerId: null,
    buyerId: userId,
    sellerId: support.id,
    kind: "support",
  });
}

export function listChats(userId, { staff = false } = {}) {
  if (staff) {
    return db
      .prepare(
        `SELECT c.*,
          (SELECT body FROM messages m WHERE m.chat_id = c.id AND m.deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) AS last_body,
          (SELECT created_at FROM messages m WHERE m.chat_id = c.id AND m.deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) AS last_at
         FROM chats c
         WHERE IFNULL(c.kind,'direct') = 'support' OR c.buyer_id = ? OR c.seller_id = ?
         ORDER BY IFNULL(last_at, c.created_at) DESC`,
      )
      .all(userId, userId);
  }
  ensureSupportChat(userId);
  return db
    .prepare(
      `SELECT c.*,
        (SELECT body FROM messages m WHERE m.chat_id = c.id AND m.deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) AS last_body,
        (SELECT created_at FROM messages m WHERE m.chat_id = c.id AND m.deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) AS last_at
       FROM chats c
       WHERE (c.buyer_id = ? OR c.seller_id = ?) AND IFNULL(c.kind,'direct') != 'global'
       ORDER BY IFNULL(last_at, c.created_at) DESC`,
    )
    .all(userId, userId);
}

export function getChat(id) {
  return db.prepare("SELECT * FROM chats WHERE id = ?").get(id);
}

export function listMessages(chatId) {
  return db
    .prepare(
      "SELECT * FROM messages WHERE chat_id = ? AND deleted_at IS NULL ORDER BY created_at ASC",
    )
    .all(chatId);
}

export function addMessage(chatId, senderId, body) {
  const id = uid("m");
  db.prepare(
    "INSERT INTO messages(id, chat_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, chatId, senderId, body, now());
  return db.prepare("SELECT * FROM messages WHERE id = ?").get(id);
}

export function getMessage(id) {
  return db.prepare("SELECT * FROM messages WHERE id = ?").get(id);
}

export function deleteMessage(id) {
  db.prepare("UPDATE messages SET deleted_at = ? WHERE id = ?").run(now(), id);
}

export function recentSimilarCount(chatId, senderId, body, windowMs = 3 * 60 * 1000) {
  const normalized = normalizeText(body);
  const since = new Date(Date.now() - windowMs).toISOString();
  const rows = db
    .prepare(
      `SELECT body FROM messages WHERE chat_id = ? AND sender_id = ? AND created_at >= ? AND deleted_at IS NULL`,
    )
    .all(chatId, senderId, since);
  return rows.filter((row) => normalizeText(row.body) === normalized).length;
}

export function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function hasLink(value) {
  return /https?:\/\/|www\.|t\.me\/|telegram\.me\/|[a-z0-9-]+\.(com|ru|net|org|io|gg|me|xyz)\b/i.test(
    String(value ?? ""),
  );
}

export function getMute(userId) {
  const row = db.prepare("SELECT * FROM mutes WHERE user_id = ?").get(userId);
  if (!row) return null;
  if (new Date(row.until).getTime() <= Date.now()) {
    db.prepare("DELETE FROM mutes WHERE user_id = ?").run(userId);
    return null;
  }
  return row;
}

export function setMute(userId, hours, reason) {
  const until = new Date(Date.now() + Number(hours) * 3600 * 1000).toISOString();
  db.prepare(
    "INSERT INTO mutes(user_id, until, reason) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET until = excluded.until, reason = excluded.reason",
  ).run(userId, until, reason ?? "");
  return getMute(userId);
}

export function clearMute(userId) {
  db.prepare("DELETE FROM mutes WHERE user_id = ?").run(userId);
}

export function createPayment(row) {
  const id = uid("p");
  db.prepare(
    `INSERT INTO payments(id, user_id, kind, provider, credit_cents, fee_cents, charge_cents, status, external_id, pay_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    row.userId,
    row.kind,
    row.provider,
    row.creditCents,
    row.feeCents,
    row.chargeCents,
    row.status,
    row.externalId ?? null,
    row.payUrl ?? null,
    now(),
  );
  return getPayment(id);
}

export function getPayment(id) {
  return db.prepare("SELECT * FROM payments WHERE id = ?").get(id);
}

export function getPaymentByExternal(provider, externalId) {
  return db
    .prepare("SELECT * FROM payments WHERE provider = ? AND external_id = ?")
    .get(provider, externalId);
}

export function updatePayment(id, patch) {
  const current = getPayment(id);
  if (!current) return null;
  db.prepare(
    "UPDATE payments SET status = ?, external_id = ?, pay_url = ? WHERE id = ?",
  ).run(
    patch.status ?? current.status,
    patch.externalId ?? current.external_id,
    patch.payUrl ?? current.pay_url,
    id,
  );
  return getPayment(id);
}

export function completeDeposit(payment) {
  if (payment.status === "paid") return payment;
  db.exec("BEGIN");
  try {
    updatePayment(payment.id, { status: "paid" });
    changeBalance(payment.user_id, payment.credit_cents);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getPayment(payment.id);
}

export function holdWithdraw(payment) {
  const user = getUserById(payment.user_id);
  if (!user || user.balance_cents < payment.charge_cents) return null;
  db.exec("BEGIN");
  try {
    changeBalance(payment.user_id, -payment.charge_cents);
    updatePayment(payment.id, { status: "processing" });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getPayment(payment.id);
}

export function failWithdraw(payment) {
  if (payment.status === "failed") return payment;
  db.exec("BEGIN");
  try {
    if (payment.status === "processing") {
      changeBalance(payment.user_id, payment.charge_cents);
    }
    updatePayment(payment.id, { status: "failed" });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getPayment(payment.id);
}

export function addNotification(userId, kind, title, body = "") {
  if (!userId) return;
  db.prepare(
    "INSERT INTO notifications(id, user_id, kind, title, body, read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)",
  ).run(uid("n"), userId, kind, title, body, now());
}

export function listNotifications(userId) {
  return db
    .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 80")
    .all(userId);
}

export function unreadNotifications(userId) {
  return Number(
    db.prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0").get(userId)
      ?.c ?? 0,
  );
}

export function markNotificationsRead(userId) {
  db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(userId);
}

export function deleteOffer(id) {
  db.prepare("DELETE FROM offers WHERE id = ?").run(id);
}

export function createDeal({ offerId, buyerId, sellerId, amountCents }) {
  const id = uid("d");
  db.exec("BEGIN");
  try {
    db.prepare(
      "INSERT INTO deals(id, offer_id, buyer_id, seller_id, amount_cents, status, created_at) VALUES (?, ?, ?, ?, ?, 'held', ?)",
    ).run(id, offerId, buyerId, sellerId, amountCents, now());
    changeBalance(buyerId, -amountCents);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getDeal(id);
}

export function getDeal(id) {
  return db
    .prepare(
      `SELECT d.*, o.title AS offer_title
       FROM deals d JOIN offers o ON o.id = d.offer_id
       WHERE d.id = ?`,
    )
    .get(id);
}

export function listDealsForOffer(offerId) {
  return db
    .prepare(
      `SELECT d.*, o.title AS offer_title
       FROM deals d JOIN offers o ON o.id = d.offer_id
       WHERE d.offer_id = ? ORDER BY d.created_at DESC`,
    )
    .all(offerId);
}

export function buyerHasPaidDeal(buyerId, sellerId) {
  return Boolean(
    db
      .prepare(
        "SELECT 1 FROM deals WHERE buyer_id = ? AND seller_id = ? AND status = 'paid' LIMIT 1",
      )
      .get(buyerId, sellerId),
  );
}

export function unpaidReviewDeal(buyerId, sellerId) {
  return db
    .prepare(
      `SELECT d.* FROM deals d
       LEFT JOIN reviews r ON r.deal_id = d.id
       WHERE d.buyer_id = ? AND d.seller_id = ? AND d.status IN ('completed', 'paid') AND r.id IS NULL
       ORDER BY d.created_at DESC LIMIT 1`,
    )
    .get(buyerId, sellerId);
}

export function listDealsForUser(userId) {
  return db
    .prepare(
      `SELECT d.*, o.title AS offer_title
       FROM deals d JOIN offers o ON o.id = d.offer_id
       WHERE d.buyer_id = ? OR d.seller_id = ?
       ORDER BY d.created_at DESC`,
    )
    .all(userId, userId);
}

export function confirmDeal(id) {
  const deal = getDeal(id);
  if (!deal || deal.status !== "held") return null;
  db.exec("BEGIN");
  try {
    changeBalance(deal.seller_id, deal.amount_cents);
    db.prepare("UPDATE deals SET status = 'completed' WHERE id = ?").run(id);
    db.prepare("UPDATE users SET deals = deals + 1 WHERE id IN (?, ?)").run(deal.buyer_id, deal.seller_id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getDeal(id);
}

export function cancelDeal(id) {
  const deal = getDeal(id);
  if (!deal || (deal.status !== "held" && deal.status !== "completed" && deal.status !== "paid")) {
    return null;
  }
  db.exec("BEGIN");
  try {
    changeBalance(deal.buyer_id, deal.amount_cents);
    if (deal.status === "completed" || deal.status === "paid") {
      changeBalance(deal.seller_id, -deal.amount_cents);
      db.prepare("UPDATE users SET deals = MAX(0, deals - 1) WHERE id IN (?, ?)").run(
        deal.buyer_id,
        deal.seller_id,
      );
    }
    db.prepare("UPDATE deals SET status = 'cancelled' WHERE id = ?").run(id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getDeal(id);
}

export function addReview({ sellerId, buyerId, dealId, rating, body }) {
  const id = uid("rv");
  db.prepare(
    "INSERT INTO reviews(id, seller_id, buyer_id, deal_id, rating, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(id, sellerId, buyerId, dealId, rating, body, now());
  return getReview(id);
}

export function getReview(id) {
  return db.prepare("SELECT * FROM reviews WHERE id = ?").get(id);
}

export function listReviews(sellerId) {
  return db
    .prepare(
      `SELECT r.*, u.name AS buyer_name, u.username AS buyer_username, u.telegram_id AS buyer_telegram, u.photo_url AS buyer_photo
       FROM reviews r JOIN users u ON u.id = r.buyer_id
       WHERE r.seller_id = ? ORDER BY r.created_at DESC`,
    )
    .all(sellerId);
}

export function deleteReview(id) {
  db.prepare("DELETE FROM reviews WHERE id = ?").run(id);
}

export function createPlan({ name, priceCents, durationDays, maxActive }) {
  const id = uid("lp");
  db.prepare(
    "INSERT INTO listing_plans(id, name, price_cents, duration_days, max_active, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, name, priceCents, durationDays, maxActive, now());
  return getPlan(id);
}

export function updatePlan(id, patch) {
  const current = getPlan(id);
  if (!current) return null;
  db.prepare(
    "UPDATE listing_plans SET name = ?, price_cents = ?, duration_days = ?, max_active = ? WHERE id = ?",
  ).run(
    patch.name ?? current.name,
    patch.priceCents ?? current.price_cents,
    patch.durationDays ?? current.duration_days,
    patch.maxActive ?? current.max_active,
    id,
  );
  return getPlan(id);
}

export function deletePlan(id) {
  db.prepare("DELETE FROM listing_plans WHERE id = ?").run(id);
}

export function assignPlan(userId, planId, until) {
  db.prepare("UPDATE users SET plan_id = ?, plan_until = ? WHERE id = ?").run(planId, until, userId);
  return getUserById(userId);
}

export const GLOBAL_CHAT_ID = "ch_global";

export function getDemoUser(person) {
  const map = {
    alex: 1001,
    mira: 1002,
    moderator: 1003,
    owner: 0,
    user: 1001,
  };
  const telegramId = map[person] ?? map.alex;
  return getUserByTelegram(telegramId);
}

function seed() {
  if (!getSetting("seeded")) {
    setSetting("seeded", "1");
    setSetting("deposit_commission", "1.5");
    setSetting("withdraw_commission", "1.5");
    setSetting("banner_title", "Комиссия на вывод 1.5%");
    setSetting(
      "banner_subtitle",
      "Пополняйте в долларах через CryptoBot или xRocket и выводите после сделки.",
    );
    setSetting("banner_href", "https://t.me");
    setSetting("banner_cta", "Подробнее");
    setSetting("banner_image", "");
    setSetting("global_chat_locked", "0");

    const demoId = "u_demo";
    db.prepare(
      `INSERT OR IGNORE INTO users(id, telegram_id, username, name, photo_url, role, balance_cents, created_at)
       VALUES (?, 1001, 'alex', 'Алексей', '', 'user', 25000, ?)`,
    ).run(demoId, now());

    const sellerId = "u_seller";
    db.prepare(
      `INSERT OR IGNORE INTO users(id, telegram_id, username, name, photo_url, role, balance_cents, rating, deals, created_at)
       VALUES (?, 1002, 'mira', 'Мира Ким', '', 'user', 8000, 5, 0, ?)`,
    ).run(sellerId, now());

    db.prepare(
      `INSERT OR IGNORE INTO users(id, telegram_id, username, name, photo_url, role, balance_cents, created_at)
       VALUES ('u_mod', 1003, 'moderator', 'Модератор', '', 'moderator', 0, ?)`,
    ).run(now());

    const supportId = "u_support";
    db.prepare(
      `INSERT OR IGNORE INTO users(id, telegram_id, username, name, photo_url, role, balance_cents, created_at)
       VALUES (?, 0, 'support', 'Поддержка BIRZA', '', 'owner', 0, ?)`,
    ).run(supportId, now());

    const sections = [
      ["s_design", "Дизайн", "Логотипы, лендинги и брендинг", "palette"],
      ["s_dev", "Разработка", "Сайты и мини-приложения", "code"],
      ["s_bots", "Telegram-боты", "Боты, воронки и автоматизация", "bot"],
      ["s_smm", "SMM и реклама", "Каналы, таргет и контент", "megaphone"],
      ["s_video", "Видео", "Монтаж и рилсы", "video"],
      ["s_copy", "Тексты", "Офферы и карточки", "pen"],
    ];
    for (const [id, name, description, icon] of sections) {
      db.prepare(
        "INSERT OR IGNORE INTO sections(id, name, description, icon, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(id, name, description, icon, now());
    }

    db.prepare(
      `INSERT OR IGNORE INTO offers(id, section_id, seller_id, title, description, price_cents, unit, status, views, likes, created_at)
       VALUES ('o_logo', 's_design', ?, 'Логотип и гайдлайн за 3 дня',
       'Фирменный знак, палитра и правила использования. Три концепции на выбор.', 8900, 'за пакет', 'approved', 57, 2, ?)`,
    ).run(sellerId, now());

    db.prepare(
      `INSERT OR IGNORE INTO chats(id, offer_id, buyer_id, seller_id, created_at, kind) VALUES (?, NULL, ?, ?, ?, 'support')`,
    ).run("ch_support", demoId, supportId, now());
    db.prepare(
      `INSERT OR IGNORE INTO messages(id, chat_id, sender_id, body, created_at)
       VALUES ('m_hello', 'ch_support', ?, 'Напишите, если нужна помощь по бирже.', ?)`,
    ).run(supportId, now());
  }

  db.prepare(
    `INSERT OR IGNORE INTO users(id, telegram_id, username, name, photo_url, role, balance_cents, created_at)
     VALUES ('u_mod', 1003, 'moderator', 'Модератор', '', 'moderator', 0, ?)`,
  ).run(now());
  db.prepare(
    `INSERT OR IGNORE INTO users(id, telegram_id, username, name, photo_url, role, balance_cents, created_at)
     VALUES ('u_seller', 1002, 'mira', 'Мира Ким', '', 'user', 8000, ?)`,
  ).run(now());
  db.prepare(
    `INSERT OR IGNORE INTO users(id, telegram_id, username, name, photo_url, role, balance_cents, created_at)
     VALUES ('u_demo', 1001, 'alex', 'Алексей', '', 'user', 25000, ?)`,
  ).run(now());
  db.prepare(
    `INSERT OR IGNORE INTO users(id, telegram_id, username, name, photo_url, role, balance_cents, created_at)
     VALUES ('u_support', 0, 'support', 'Поддержка BIRZA', '', 'owner', 0, ?)`,
  ).run(now());
  db.prepare(
    "INSERT OR IGNORE INTO sections(id, name, description, icon, created_at) VALUES ('s_design', 'Дизайн', 'Логотипы, лендинги и брендинг', 'palette', ?)",
  ).run(now());
  if (getSetting("currency") !== "USD") {
    setSetting("currency", "USD");
    db.prepare("UPDATE offers SET price_cents = 8900 WHERE id = 'o_logo' AND price_cents = 890000").run();
    db.prepare("UPDATE users SET balance_cents = 25000 WHERE id = 'u_demo' AND balance_cents = 0").run();
    db.prepare("UPDATE users SET balance_cents = 8000 WHERE id = 'u_seller' AND balance_cents = 0").run();
    setSetting(
      "banner_subtitle",
      "Пополняйте в долларах через CryptoBot или xRocket и выводите после сделки.",
    );
  }
  db.prepare(
    `INSERT OR IGNORE INTO chats(id, offer_id, buyer_id, seller_id, created_at, kind)
     VALUES ('ch_global', NULL, 'u_support', 'u_support', ?, 'global')`,
  ).run(now());
  db.prepare(
    "UPDATE chats SET kind = 'support' WHERE seller_id = 'u_support' AND id != 'ch_global'",
  ).run();
  db.prepare(
    `INSERT OR IGNORE INTO offers(id, section_id, seller_id, title, description, price_cents, unit, status, views, likes, created_at)
     VALUES ('o_logo', 's_design', 'u_seller', 'Логотип и гайдлайн за 3 дня',
     'Фирменный знак, палитра и правила использования. Три концепции на выбор.', 8900, 'за пакет', 'approved', 57, 2, ?)`,
  ).run(now());
  const stamp = now();
  db.prepare(
    `INSERT OR IGNORE INTO listing_plans(id, name, price_cents, duration_days, max_active, created_at)
     VALUES ('lp_basic', 'Базовый', 500, 7, 1, ?)`,
  ).run(stamp);
  db.prepare(
    `INSERT OR IGNORE INTO listing_plans(id, name, price_cents, duration_days, max_active, created_at)
     VALUES ('lp_pro', 'Профи', 1500, 30, 5, ?)`,
  ).run(stamp);
  db.prepare(
    `INSERT OR IGNORE INTO listing_plans(id, name, price_cents, duration_days, max_active, created_at)
     VALUES ('lp_biz', 'Бизнес', 4900, 90, 20, ?)`,
  ).run(stamp);
  const far = new Date(Date.now() + 90 * 86400000).toISOString();
  db.prepare("UPDATE users SET plan_id = COALESCE(plan_id, 'lp_pro'), plan_until = COALESCE(plan_until, ?) WHERE id = 'u_seller'").run(far);
}

seed();
