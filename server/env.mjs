import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function list(name) {
  return (process.env[name] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  botToken: process.env.BOT_TOKEN ?? "",
  webappUrl: process.env.WEBAPP_URL ?? "http://localhost:5173",
  publicUrl: process.env.PUBLIC_URL ?? "http://localhost:8787",
  demoAuth: process.env.DEMO_AUTH !== "0",
  ownerIds: list("OWNER_TELEGRAM_IDS"),
  moderatorIds: list("MODERATOR_TELEGRAM_IDS"),
  cryptobotToken: process.env.CRYPTOBOT_TOKEN ?? "",
  cryptobotTestnet: process.env.CRYPTOBOT_TESTNET === "1",
  xrocketToken: process.env.XROCKET_TOKEN ?? "",
  xrocketWebhookSecret: process.env.XROCKET_WEBHOOK_SECRET ?? "",
  usdtRub: Number(process.env.USDT_RUB ?? 90),
};
