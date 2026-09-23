# BIRZA

Биржа услуг: сайт + Telegram Mini App, тёмно-синий интерфейс. Пополнение и вывод через **CryptoBot** и **xRocket**.

## Запуск

```bash
copy .env.example .env
npm install
npm run dev
```

Фронт: http://localhost:5173  
API: http://localhost:8787  

Пока нет `BOT_TOKEN`, вход демо: в профиле переключаются роли. Пополнение без платёжных ключей открывает демо-ссылку, которая зачисляет баланс.

## Telegram-бот

1. Создайте бота у [@BotFather](https://t.me/BotFather), вставьте токен в `BOT_TOKEN`.
2. `/newapp` — Mini App, URL: публичный HTTPS фронта (`WEBAPP_URL`).
3. Для локалки поднимите туннель на Vite и на API:

```
WEBAPP_URL=https://your-frontend
PUBLIC_URL=https://your-api
```

4. `OWNER_TELEGRAM_IDS` / `MODERATOR_TELEGRAM_IDS` — Telegram ID владельца и модераторов.

После старта `npm run dev` бот сам ставит кнопку меню «Открыть биржу».

## Платежи

### CryptoBot
[@CryptoBot](https://t.me/CryptoBot) → Crypto Pay → Create App → токен в `CRYPTOBOT_TOKEN`.  
Webhook: `PUBLIC_URL/api/webhooks/cryptobot`

Пополнение создаёт invoice в рублях. Вывод — `transfer` USDT на Telegram ID пользователя.

### xRocket
Приложение xRocket Pay → API token в `XROCKET_TOKEN`, секрет вебхука в `XROCKET_WEBHOOK_SECRET`.  
Webhook: `PUBLIC_URL/api/webhooks/xrocket`

Пополнение — invoice. Вывод — payout на `telegram_user_id`.

Комиссии задаёт владелец в кабинете. На экране кошелька: сумма на баланс + комиссия = к оплате (как на ваших макетах).
