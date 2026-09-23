import crypto from "node:crypto";
import { config } from "./env.mjs";

const API = "https://pay.api.xrocket.exchange/api/v1";

export function xrocketEnabled() {
  return Boolean(config.xrocketToken);
}

async function call(path, { method = "GET", body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.xrocketToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || `xRocket ${response.status}`);
  }
  return payload.data ?? payload;
}

export async function createRocketInvoice({
  amountUsd,
  paymentId,
  description,
  telegramId,
  username,
}) {
  const invoice = await call("/invoices", {
    method: "POST",
    body: {
      priceAmount: amountUsd.toFixed(2),
      priceCurrency: "USD",
      payoutCurrency: "USDT",
      clientInvoiceId: paymentId,
      description,
      expiresIn: 3_600_000,
      callback: {
        callbackUrl: `${config.publicUrl}/api/webhooks/xrocket`,
        payload: { paymentId },
      },
      customer: {
        id: paymentId,
        telegramId: String(telegramId ?? ""),
        telegramUsername: username || undefined,
      },
    },
  });
  return {
    id: String(invoice.id ?? invoice.invoiceId ?? ""),
    payUrl: invoice.links?.telegramBotLink || invoice.telegramBotLink || "",
  };
}

export async function rocketPayout({ telegramId, amountUsdt, paymentId }) {
  return call("/payouts", {
    method: "POST",
    body: {
      asset: "USDT",
      amount: String(amountUsdt),
      target: String(telegramId),
      targetType: "telegram_user_id",
      clientPayoutId: paymentId,
      description: "Вывод с BIRZA",
      callback: {
        callbackUrl: `${config.publicUrl}/api/webhooks/xrocket`,
        payload: { paymentId },
      },
    },
  });
}

export function verifyRocketWebhook(rawBody, signature, timestamp) {
  const secret = config.xrocketWebhookSecret || config.xrocketToken;
  if (!signature || !secret || !timestamp) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return expected === signature;
}
