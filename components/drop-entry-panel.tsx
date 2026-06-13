"use client";

// Client wrapper that holds the selected variant and renders the World ID entry button
// (M4). Variant chips are minimal here; the brutalist restyle is M9.
import { useState } from "react";
import { WorldIdEntry } from "@/components/world-id-entry";

interface VariantLite {
  id: string;
  name: string;
}

export function DropEntryPanel({
  dropId,
  variants,
  open,
}: {
  dropId: string;
  variants: VariantLite[];
  open: boolean;
}) {
  const [variantId, setVariantId] = useState<string | null>(variants[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-4">
      {variants.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVariantId(v.id)}
              className={
                "border-2 border-black px-4 py-2 text-sm font-bold uppercase transition-colors " +
                (variantId === v.id
                  ? "bg-black text-white"
                  : "bg-white text-black hover:bg-zinc-100")
              }
              aria-pressed={variantId === v.id}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}

      {open ? (
        <WorldIdEntry dropId={dropId} variantId={variantId} />
      ) : (
        <div className="border-2 border-black bg-zinc-100 px-4 py-3 font-bold uppercase text-zinc-500">
          Not open for entry
        </div>
      )}
    </div>
  );
}
