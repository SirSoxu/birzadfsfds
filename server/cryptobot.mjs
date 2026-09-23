import crypto from "node:crypto";
import { config } from "./env.mjs";

const base = () =>
  config.cryptobotTestnet ? "https://testnet-pay.crypt.bot/api" : "https://pay.crypt.bot/api";

export function cryptobotEnabled() {
  return Boolean(config.cryptobotToken);
}

async function call(method, body) {
  const response = await fetch(`${base()}/${method}`, {
    method: "POST",
    headers: {
      "Crypto-Pay-API-Token": config.cryptobotToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  const payload = await response.json();
  if (!payload.ok) {
    throw new Error(payload.error?.name || "CryptoBot error");
  }
  return payload.result;
}

export async function createCryptoInvoice({ amountUsd, payload, description }) {
  const invoice = await call("createInvoice", {
    currency_type: "fiat",
    fiat: "USD",
    amount: amountUsd.toFixed(2),
    accepted_assets: "USDT,TON",
    description,
    payload,
    expires_in: 3600,
    paid_btn_name: "callback",
    paid_btn_url: config.webappUrl,
  });
  return {
    id: String(invoice.invoice_id),
    payUrl:
      invoice.mini_app_invoice_url ||
      invoice.bot_invoice_url ||
      invoice.web_app_invoice_url ||
      invoice.pay_url,
  };
}

export async function transferUsdt({ telegramId, amount, spendId }) {
  return call("transfer", {
    user_id: Number(telegramId),
    asset: "USDT",
    amount: String(amount),
    spend_id: spendId,
  });
}

export async function usdtRate() {
  try {
    const rates = await call("getExchangeRates");
    const row = rates.find(
      (item) => item.source === "USDT" && item.target === "USD" && item.is_valid,
    );
    if (row) return Number(row.rate);
  } catch {
    // fallback below
  }
  return 1;
}

export function verifyCryptoWebhook(rawBody, signature) {
  if (!signature || !config.cryptobotToken) return false;
  const secret = crypto.createHash("sha256").update(config.cryptobotToken).digest();
  const hmac = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return hmac === signature;
}
