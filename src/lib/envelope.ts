import { getSupabase } from "@/lib/supabase/client";

/* ---------- the choices a person can make for their envelope ---------- */
export type Layout = "rabbit" | "quiet" | "sketch";
export type SealColor = "blue" | "gold" | "navy" | "cream";
export type StampKind = "rabbit" | "night";
export type PostmarkKind = "round" | "box";
export type NoticeKind = "align" | "before" | "none";

export type EnvelopeOptions = {
  layout: Layout;
  seal: SealColor;
  stamp: StampKind;
  postmark: PostmarkKind;
  notice: NoticeKind;
};

// Design A, the default
export const DEFAULT_ENVELOPE: EnvelopeOptions = {
  layout: "rabbit",
  seal: "blue",
  stamp: "rabbit",
  postmark: "round",
  notice: "align",
};

// The three ready-made designs. Picking one sets every choice to its starting mix.
export const LAYOUTS: { id: Layout; name: string; blurb: string; defaults: EnvelopeOptions }[] = [
  { id: "rabbit", name: "Rabbit post", blurb: "A little rabbit, looking up at the stars", defaults: DEFAULT_ENVELOPE },
  {
    id: "quiet",
    name: "Quiet script",
    blurb: "Just your handwriting and a few stars",
    defaults: { layout: "quiet", seal: "navy", stamp: "night", postmark: "round", notice: "before" },
  },
  {
    id: "sketch",
    name: "Sky sketch",
    blurb: "A faint constellation drawn behind it all",
    defaults: { layout: "sketch", seal: "gold", stamp: "rabbit", postmark: "box", notice: "none" },
  },
];

export const SEAL_COLORS: { id: SealColor; name: string; swatch: string }[] = [
  { id: "blue", name: "Slate blue", swatch: "#7d92c9" },
  { id: "gold", name: "Gold", swatch: "#dcb062" },
  { id: "navy", name: "Night navy", swatch: "#34479d" },
  { id: "cream", name: "Cream", swatch: "#f2e6c8" },
];
export const STAMPS: { id: StampKind; name: string }[] = [
  { id: "rabbit", name: "Rabbit and star" },
  { id: "night", name: "Night sky" },
];
export const POSTMARKS: { id: PostmarkKind; name: string }[] = [
  { id: "round", name: "Round" },
  { id: "box", name: "Date box" },
];
export const NOTICES: { id: NoticeKind; name: string }[] = [
  { id: "align", name: "Open when the stars align" },
  { id: "before", name: "Do not open before the date" },
  { id: "none", name: "None" },
];

/* ---------- reading what the database gives back, safely ---------- */
function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

// Anything missing or unknown falls back to design A, so old letters still open.
export function parseEnvelope(raw: unknown): EnvelopeOptions {
  if (!raw || typeof raw !== "object") return DEFAULT_ENVELOPE;
  const r = raw as Record<string, unknown>;
  return {
    layout: pick(r.layout, LAYOUTS.map((l) => l.id), DEFAULT_ENVELOPE.layout),
    seal: pick(r.seal, SEAL_COLORS.map((s) => s.id), DEFAULT_ENVELOPE.seal),
    stamp: pick(r.stamp, STAMPS.map((s) => s.id), DEFAULT_ENVELOPE.stamp),
    postmark: pick(r.postmark, POSTMARKS.map((p) => p.id), DEFAULT_ENVELOPE.postmark),
    notice: pick(r.notice, NOTICES.map((n) => n.id), DEFAULT_ENVELOPE.notice),
  };
}

/* ---------- saving and loading the choice ---------- */

// Never blocks sealing: if this fails the letter simply opens in design A.
export async function saveEnvelope(letterId: string, envelope: EnvelopeOptions) {
  try {
    const { error } = await getSupabase().from("letters").update({ envelope }).eq("id", letterId);
    if (error) console.warn("Could not save the envelope choice:", error.message);
  } catch (e) {
    console.warn("Could not save the envelope choice:", e);
  }
}

export async function loadEnvelope(letterId: string): Promise<EnvelopeOptions> {
  try {
    const { data } = await getSupabase().from("letters").select("envelope").eq("id", letterId).maybeSingle();
    return parseEnvelope(data?.envelope);
  } catch {
    return DEFAULT_ENVELOPE;
  }
}
