const token = process.env.BOT_TOKEN;
const webAppUrl = process.env.WEBAPP_URL;

if (!token || !webAppUrl) {
  console.error("Задайте BOT_TOKEN и WEBAPP_URL");
  process.exit(1);
}

const response = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    menu_button: {
      type: "web_app",
      text: "Открыть биржу",
      web_app: { url: webAppUrl },
    },
  }),
});

const payload = await response.json();
if (!payload.ok) {
  console.error(payload);
  process.exit(1);
}

console.log("Кнопка Mini App установлена:", webAppUrl);
