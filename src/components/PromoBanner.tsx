import { ArrowUpRight } from "lucide-react";
import type { Banner } from "../types";
import { openExternal } from "../lib/telegram";

export function PromoBanner({ banner }: { banner: Banner }) {
  const hasImage = Boolean(banner.imageUrl);

  return (
    <button
      type="button"
      onClick={() => openExternal(banner.href)}
      className="group relative block w-full overflow-hidden rounded-2xl border border-line text-left transition duration-200 hover:border-line-strong active:scale-[0.99]"
    >
      <div
        className="relative min-h-[148px] px-5 py-5"
        style={{
          background: hasImage
            ? `linear-gradient(180deg, rgba(6,16,28,0.15), rgba(6,16,28,0.82)), url(${banner.imageUrl}) center/cover`
            : "radial-gradient(120% 140% at 100% 0%, #3b8bff 0%, transparent 42%), linear-gradient(135deg, #102a52 0%, #071526 58%, #0b274c 100%)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(126,224,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(126,224,255,0.08)_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative flex h-full min-h-[108px] flex-col justify-between gap-4">
          <div className="max-w-[78%]">
            <p className="font-display text-xl font-semibold leading-tight text-ice">
              {banner.title}
            </p>
            <p className="mt-2 text-sm leading-5 text-mute">{banner.subtitle}</p>
          </div>
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-signal px-3 py-2 text-sm font-semibold text-night transition duration-150 group-hover:bg-signal-2">
            {banner.cta}
            <ArrowUpRight className="size-4" aria-hidden />
          </span>
        </div>
      </div>
    </button>
  );
}
