export function bootTelegram() {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return;
  webApp.ready();
  webApp.expand();
  webApp.setHeaderColor("#0A1830");
  webApp.setBackgroundColor("#06101C");
}

export function openExternal(url: string) {
  const webApp = window.Telegram?.WebApp;
  if (url.includes("t.me") && webApp?.openTelegramLink) {
    webApp.openTelegramLink(url);
    return;
  }
  if (webApp?.openLink) {
    webApp.openLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
