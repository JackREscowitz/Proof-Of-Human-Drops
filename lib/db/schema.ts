// Drizzle schema for Proof-of-Human Drops (M2).
// Data model: RESEARCH_REPORT.md §4. The one invariant that matters is
// `entries UNIQUE (drop_id, human_key)` — the Sybil guarantee (RALPH_GUIDE.md §7).
//
// Type notes:
//   - nullifier_hash stored as numeric(78,0) — World ID nullifiers exceed bigint range.
//   - USDC amounts as numeric(20,6) — USDC has 6 decimals ($10 = 10.000000).
//   - human_key is the World ID nullifier (web) OR the AgentBook humanId (agent); both
//     resolve to "one unique human", so the unique constraint blocks cross-path double entry.

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// ---- Enums ----------------------------------------------------------------
export const dropStatus = pgEnum("drop_status", [
  "coming_soon",
  "open",
  "closed",
  "settled",
]);

export const entrySource = pgEnum("entry_source", ["web", "agent"]);

export const verificationLvl = pgEnum("verification_lvl", ["orb", "device"]);

export const entryStatus = pgEnum("entry_status", [
  "pending",
  "won",
  "lost",
  "purchased",
  "expired",
]);

export const orderStatus = pgEnum("order_status", [
  "awaiting_payment",
  "confirmed",
  "failed",
]);

// ---- Tables ---------------------------------------------------------------

export const drops = pgTable("drops", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: dropStatus("status").notNull().default("coming_soon"),
  opensAt: timestamp("opens_at", { withTimezone: true }),
  closesAt: timestamp("closes_at", { withTimezone: true }),
  totalSlots: integer("total_slots").notNull().default(1),
  priceUsdc: numeric("price_usdc", { precision: 20, scale: 6 }).notNull().default("0"),
  // Seedable RNG for deterministic demo wins (M6). Null = use a real CSPRNG.
  drawSeed: text("draw_seed"),
  // The World ID v4 action id created for this drop (M4). One action per drop.
  worldActionId: text("world_action_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const variants = pgTable("variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  dropId: uuid("drop_id")
    .notNull()
    .references(() => drops.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // "Silver" / "Black"
  sku: text("sku"),
  stock: integer("stock").notNull().default(0),
});

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dropId: uuid("drop_id")
      .notNull()
      .references(() => drops.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => variants.id, {
      onDelete: "set null",
    }),
    // The dedupe key: nullifier_hash (web) OR humanId (agent). Stored as text so both
    // namespaces fit. THIS is what UNIQUE(drop_id, human_key) enforces uniqueness over.
    humanKey: text("human_key").notNull(),
    source: entrySource("source").notNull(),
    nullifierHash: numeric("nullifier_hash", { precision: 78, scale: 0 }),
    humanId: text("human_id"),
    verificationLvl: verificationLvl("verification_lvl"),
    status: entryStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // ★ THE SYBIL GUARANTEE — one entry per human per drop.
    unique("entries_drop_human_key_unique").on(t.dropId, t.humanKey),
  ],
);

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull().unique(),
  humanId: text("human_id"),
  registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  // Option B ergonomic cache only — maps a session token 1:1 to a verified humanId.
  token: text("token").primaryKey(),
  humanId: text("human_id").notNull(),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Nullable so a standalone settlement (e.g. the M5 /api/admin/test-transfer that proves the
  // money path before the draw is wired) can be recorded without a winning entry. M6+ ties
  // real purchases to an entry.
  entryId: uuid("entry_id").references(() => entries.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").references(() => variants.id, {
    onDelete: "set null",
  }),
  amountUsdc: numeric("amount_usdc", { precision: 20, scale: 6 }).notNull(),
  txHash: text("tx_hash"),
  // Sender / recipient of the on-chain transfer (M5) — useful for the orders audit + demo.
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  status: orderStatus("status").notNull().default("awaiting_payment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Convenient type exports for the service layer.
export type Drop = typeof drops.$inferSelect;
export type NewDrop = typeof drops.$inferInsert;
export type Variant = typeof variants.$inferSelect;
export type NewVariant = typeof variants.$inferInsert;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
