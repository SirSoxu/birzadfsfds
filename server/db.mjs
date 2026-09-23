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
`);

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
    banner: {
      title: getSetting("banner_title", "Комиссия на вывод 1.5%"),
      subtitle: getSetting(
        "banner_subtitle",
        "Пополняйте через CryptoBot или xRocket и выводите после сделки.",
      ),
      href: getSetting("banner_href", "https://t.me"),
      cta: getSetting("banner_cta", "Подробнее"),
      imageUrl: getSetting("banner_image", ""),
    },
  };
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    telegramId: row.telegram_id,
    username: row.username,
    name: row.name,
    photoUrl: row.photo_url,
    role: row.role,
    balance: row.balance_cents / 100,
    rating: row.rating,
    deals: row.deals,
    likes: row.likes,
    avatarHue: Math.abs(Number(row.telegram_id ?? 1) * 17) % 360,
    createdAt: row.created_at,
  };
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

export function getOrCreateChat({ offerId, buyerId, sellerId }) {
  const found = db
    .prepare(
      "SELECT * FROM chats WHERE buyer_id = ? AND seller_id = ? AND IFNULL(offer_id,'') = IFNULL(?, '')",
    )
    .get(buyerId, sellerId, offerId ?? "");
  if (found) return found;
  const id = uid("ch");
  db.prepare(
    "INSERT INTO chats(id, offer_id, buyer_id, seller_id, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, offerId ?? null, buyerId, sellerId, now());
  return db.prepare("SELECT * FROM chats WHERE id = ?").get(id);
}

export function listChats(userId) {
  return db
    .prepare(
      `SELECT c.*,
        (SELECT body FROM messages m WHERE m.chat_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_body,
        (SELECT created_at FROM messages m WHERE m.chat_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_at
       FROM chats c
       WHERE c.buyer_id = ? OR c.seller_id = ?
       ORDER BY IFNULL(last_at, c.created_at) DESC`,
    )
    .all(userId, userId);
}

export function getChat(id) {
  return db.prepare("SELECT * FROM chats WHERE id = ?").get(id);
}

export function listMessages(chatId) {
  return db
    .prepare("SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC")
    .all(chatId);
}

export function addMessage(chatId, senderId, body) {
  const id = uid("m");
  db.prepare(
    "INSERT INTO messages(id, chat_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, chatId, senderId, body, now());
  return listMessages(chatId);
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

function seed() {
  if (getSetting("seeded")) return;
  setSetting("seeded", "1");
  setSetting("deposit_commission", "1.5");
  setSetting("withdraw_commission", "1.5");
  setSetting("banner_title", "Комиссия на вывод 1.5%");
  setSetting(
    "banner_subtitle",
    "Пополняйте через CryptoBot или xRocket и выводите после сделки.",
  );
  setSetting("banner_href", "https://t.me");
  setSetting("banner_cta", "Подробнее");
  setSetting("banner_image", "");

  const demoId = "u_demo";
  db.prepare(
    `INSERT OR IGNORE INTO users(id, telegram_id, username, name, photo_url, role, balance_cents, created_at)
     VALUES (?, 1001, 'alex', 'Алексей', '', 'user', 0, ?)`,
  ).run(demoId, now());

  const sellerId = "u_seller";
  db.prepare(
    `INSERT OR IGNORE INTO users(id, telegram_id, username, name, photo_url, role, balance_cents, rating, deals, created_at)
     VALUES (?, 1002, 'mira', 'Мира Ким', '', 'user', 0, 5, 214, ?)`,
  ).run(sellerId, now());

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
     'Фирменный знак, палитра и правила использования. Три концепции на выбор.', 890000, 'за пакет', 'approved', 57, 2, ?)`,
  ).run(sellerId, now());

  const supportChat = uid("ch");
  db.prepare(
    `INSERT OR IGNORE INTO chats(id, offer_id, buyer_id, seller_id, created_at) VALUES (?, NULL, ?, ?, ?)`,
  ).run("ch_support", demoId, supportId, now());
  db.prepare(
    `INSERT OR IGNORE INTO messages(id, chat_id, sender_id, body, created_at)
     VALUES ('m_hello', 'ch_support', ?, 'Напишите, если нужна помощь по бирже.', ?)`,
  ).run(supportId, now());
}

seed();
