"use client";

// Full-screen product listing panel (M11) — store3-style. Big framed product photo on the
// left, bold title + price + spec list + finish chips + the inline World ID entry/draw/
// purchase flow on the right. One per drop, stacked in the ScrollDeck.
//
// Variant selection lives here so picking a finish both (a) swaps the photo and (b) drives
// the entry flow's variantId. The photo is shown inside a brutalist white card so the
// product shots' white backgrounds read as intentional studio photography on the cream canvas.

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { WorldIdEntry } from "@/components/world-id-entry";
import type { DropPresentation } from "@/lib/drops.presentation";

export type ItemVariant = { id: string; name: string };

export type ItemPanelProps = {
  dropId: string;
  name: string;
  priceUsdc: string;
  status: string;
  variants: ItemVariant[];
  presentation: DropPresentation;
  index: number; // 1-based position among items (for the corner marker)
  total: number;
};

export default function ItemPanel({
  dropId,
  name,
  priceUsdc,
  status,
  variants,
  presentation,
  index,
  total,
}: ItemPanelProps) {
  const [variant, setVariant] = useState<ItemVariant | null>(variants[0] ?? null);
  const open = status === "open";

  // Pick the photo for the selected finish, falling back to the default.
  const photo =
    (variant && presentation.photo.byVariant?.[variant.name]) ||
    presentation.photo.default;

  return (
    <div className="flex min-h-[100svh] flex-col px-5 py-6 sm:px-8">
      {/* Panel chrome: brand + position marker */}
      <div className="flex items-center justify-between border-b-[3px] border-ink pb-3 text-xs font-extrabold uppercase">
        <Link href="/" className="display text-base sm:text-lg">
          PROOF·OF·HUMAN
        </Link>
        <span className="tracking-widest text-muted-foreground">
          Drop {index} / {total}
        </span>
      </div>

      {/* Body: photo (left) + details (right) */}
      <div className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 py-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        {/* Framed product photo — white studio card with an accent top bar so product colors
            stay true (no blend tint). The accent reads as a brand stripe, not a wash. */}
        <div className="order-1 flex items-center justify-center">
          <div className="brutal relative aspect-square w-full max-w-[34rem] overflow-hidden bg-white">
            {/* Accent stripe along the top edge for brand pop. */}
            <div
              className={`absolute inset-x-0 top-0 h-2.5 border-b-[3px] border-ink ${presentation.accent}`}
            />
            <Image
              key={photo}
              src={photo}
              alt={`${name}${variant ? ` — ${variant.name}` : ""}`}
              fill
              priority={index === 1}
              sizes="(max-width: 1024px) 90vw, 40vw"
              className="object-contain p-10"
            />
            <span className="pill absolute left-3 top-5">
              {status.replace("_", " ")}
            </span>
          </div>
        </div>

        {/* Details + entry */}
        <div className="order-2 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
              {presentation.tagline}
            </span>
            <h2 className="display text-6xl leading-[0.92] sm:text-7xl">{name}</h2>
            <div className="flex items-end gap-3">
              <span className="display text-5xl">${Number(priceUsdc).toFixed(0)}</span>
              <span className="pb-1 text-sm font-extrabold uppercase text-muted-foreground">
                USDC · one entry per human
              </span>
            </div>
          </div>

          {/* Spec list */}
          <ul className="flex flex-col gap-1.5 border-y-[3px] border-ink py-4 text-sm font-medium">
            {presentation.specs.map((s) => (
              <li key={s} className="flex items-start gap-2">
                <span aria-hidden className="mt-1 text-lime">
                  ▪
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>

          {/* Finish chips (lifted state → swaps photo + drives entry) */}
          {variants.length > 1 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
                Choose a finish
              </span>
              <div className="flex flex-wrap gap-3">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariant(v)}
                    aria-pressed={variant?.id === v.id}
                    className={
                      "border-[3px] border-ink px-5 py-2 text-sm font-extrabold uppercase transition-all " +
                      (variant?.id === v.id
                        ? "bg-ink text-cream"
                        : "bg-white text-ink hover:bg-lime")
                    }
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Inline World ID entry → draw → purchase */}
          {open ? (
            <WorldIdEntry dropId={dropId} variantId={variant?.id ?? null} />
          ) : (
            <div className="brutal flex items-center gap-2 px-5 py-4 font-extrabold uppercase text-muted-foreground">
              Not open for entry
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
