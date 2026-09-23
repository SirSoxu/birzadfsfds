import { Bot, InlineKeyboard } from "grammy";
import { config } from "./env.mjs";

export function createBot() {
  if (!config.botToken) return null;
  const bot = new Bot(config.botToken);
  const keyboard = new InlineKeyboard().webApp("Открыть биржу", config.webappUrl);

  bot.command("start", async (ctx) => {
    await ctx.reply(
      "BIRZA — биржа услуг в Telegram.\nОткройте мини-приложение, чтобы смотреть разделы, размещать объявления и пополнять баланс.",
      { reply_markup: keyboard },
    );
  });

  bot.catch((error) => {
    console.error("bot error", error);
  });

  return bot;
}

export async function configureMenu(bot) {
  await bot.api.setChatMenuButton({
    menu_button: {
      type: "web_app",
      text: "Открыть биржу",
      web_app: { url: config.webappUrl },
    },
  });
}
