import { useEffect, useMemo, useState } from "react";
import { api, openPayUrl } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatMoney } from "../lib/format";
import { Button, inputClass } from "../components/ui";
import { PayMark } from "../components/HomeHeader";

type Provider = "cryptobot" | "xrocket";

export function WalletPage() {
  const { user, settings, refresh } = useAuth();
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [provider, setProvider] = useState<Provider>("cryptobot");
  const [amount, setAmount] = useState("100");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const value = Number(amount) || 0;
  const percent =
    tab === "deposit" ? (settings?.depositCommission ?? 1.5) : (settings?.withdrawCommission ?? 1.5);
  const fee = Math.round(value * (percent / 100) * 100) / 100;
  const charge = Math.round((value + fee) * 100) / 100;

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const hint = useMemo(() => {
    if (tab === "deposit") {
      return `Минимальная сумма 100. Комиссия ${percent}%.`;
    }
    return `Сумма спишется с баланса. Минимум 100 ₽. Комиссия ${percent}%.`;
  }, [percent, tab]);

  async function submit() {
    setMessage("");
    setBusy(true);
    try {
      if (tab === "deposit") {
        const payload = await api<{
          payment: { id: string; payUrl?: string };
          demo?: boolean;
        }>("/api/wallet/deposit", {
          method: "POST",
          body: { provider, amount: value },
        });
        if (payload.payment.payUrl) openPayUrl(payload.payment.payUrl);
        setMessage(
          payload.demo
            ? "Демо: счёт открыт на сервере. После оплаты вернитесь сюда."
            : `Счёт придёт в чат с ботом («Оплатить в ${provider === "cryptobot" ? "CryptoBot" : "xRocket"}»). После оплаты вернитесь сюда.`,
        );
        poll(payload.payment.id);
      } else {
        const payload = await api<{ user: { balance: number } }>("/api/wallet/withdraw", {
          method: "POST",
          body: { provider, amount: value },
        });
        setMessage(`Выплата отправлена в ${provider === "cryptobot" ? "CryptoBot" : "xRocket"}.`);
        await refresh();
        if (payload.user) await refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не получилось");
    } finally {
      setBusy(false);
    }
  }

  function poll(id: string) {
    let ticks = 0;
    const timer = setInterval(async () => {
      ticks += 1;
      try {
        const payload = await api<{ payment: { status: string } }>(`/api/payments/${id}`);
        if (payload.payment.status === "paid") {
          clearInterval(timer);
          await refresh();
          setMessage("Баланс пополнен.");
        }
      } catch {
        // ignore
      }
      if (ticks > 40) clearInterval(timer);
    }, 2500);
  }

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Баланс</h1>
      <div className="grid grid-cols-2 gap-2">
        <Tab active={tab === "deposit"} onClick={() => setTab("deposit")}>
          Пополнить
        </Tab>
        <Tab active={tab === "withdraw"} onClick={() => setTab("withdraw")}>
          Вывод
        </Tab>
      </div>

      <div className="rounded-2xl bg-panel px-4 py-4">
        <p className="text-sm text-mute">Текущий баланс</p>
        <p className="mt-1 text-3xl font-semibold text-signal">{formatMoney(user.balance)}</p>
      </div>

      <div>
        <p className="mb-2 text-sm text-mute">
          {tab === "deposit" ? "Чем пополнить" : "Куда вывести"}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <ProviderCard
            provider="cryptobot"
            label="CryptoBot"
            active={provider === "cryptobot"}
            onClick={() => setProvider("cryptobot")}
          />
          <ProviderCard
            provider="xrocket"
            label="xRocket"
            active={provider === "xrocket"}
            onClick={() => setProvider("xrocket")}
          />
        </div>
      </div>

      <p className="text-sm text-mute">{hint}</p>

      {tab === "deposit" ? (
        <div className="rounded-2xl bg-panel px-4 py-3 text-sm">
          <Row label="На баланс" value={formatMoney(value)} />
          <Row label="Комиссия" value={formatMoney(fee)} />
          <Row label="К оплате" value={formatMoney(charge)} strong />
        </div>
      ) : (
        <div className="rounded-2xl bg-panel px-4 py-3 text-sm">
          <Row label="К выплате" value={formatMoney(value)} />
          <Row label="Комиссия" value={formatMoney(fee)} />
          <Row label="Спишется" value={formatMoney(charge)} strong />
        </div>
      )}

      <input
        className={inputClass}
        inputMode="numeric"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder="100"
      />
      <Button disabled={busy} onClick={submit}>
        {tab === "deposit" ? "Пополнить" : "Вывести средства"}
      </Button>
      {message ? <p className="text-sm text-mute">{message}</p> : null}
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 rounded-2xl text-sm font-semibold transition duration-150 ${
        active ? "bg-signal text-night" : "bg-panel text-ice hover:bg-panel-2"
      }`}
    >
      {children}
    </button>
  );
}

function ProviderCard({
  provider,
  label,
  active,
  onClick,
}: {
  provider: Provider;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-16 items-center justify-center gap-2 rounded-2xl border px-3 font-semibold transition duration-150 ${
        active ? "border-signal bg-signal text-night" : "border-transparent bg-panel text-ice"
      }`}
    >
      <PayMark provider={provider} />
      {label}
    </button>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-mute">{label}</span>
      <span className={strong ? "font-semibold text-ice" : ""}>{value}</span>
    </div>
  );
}
