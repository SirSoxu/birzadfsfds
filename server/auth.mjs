import crypto from "node:crypto";
import { config } from "./env.mjs";

export function validateInitData(initData) {
  if (!config.botToken || !initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(config.botToken).digest();
  const digest = crypto.createHmac("sha256", secret).update(dataCheck).digest("hex");
  if (digest !== hash) return null;
  const userRaw = params.get("user");
  if (!userRaw) return null;
  try {
    return JSON.parse(userRaw);
  } catch {
    return null;
  }
}

export function signSession(userId) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 14;
  const payload = `${userId}.${exp}`;
  const sig = crypto
    .createHmac("sha256", config.botToken || "birza-demo-secret")
    .update(payload)
    .digest("hex");
  return `${payload}.${sig}`;
}

export function readSession(token) {
  if (!token) return null;
  const [userId, exp, sig] = token.split(".");
  if (!userId || !exp || !sig) return null;
  if (Number(exp) < Date.now()) return null;
  const expected = crypto
    .createHmac("sha256", config.botToken || "birza-demo-secret")
    .update(`${userId}.${exp}`)
    .digest("hex");
  if (expected !== sig) return null;
  return userId;
}
