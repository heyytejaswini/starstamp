import { getSupabase } from "@/lib/supabase/client";

export type MyStar = {
  id: string;
  x: number; // 0 to 1, fraction of the screen width
  y: number; // 0 to 1, fraction of the screen height
  hue: number;
  openOn: string; // "YYYY-MM-DD"
  createdAt: number; // milliseconds
};

const HUES = [42, 200, 320];

// The stars the sky draws. Kept in memory so the sky can read it instantly.
let cache: MyStar[] = [];

export function loadStars(): MyStar[] {
  return cache;
}

// Add a star straight away (used right after sealing, before the next refresh).
export function addStar(star: MyStar) {
  cache = [...cache.filter((s) => s.id !== star.id), star];
}

// A simple recipe that turns any text into a number. Same text, same number.
function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// The same letter id always gives the same star position and colour.
export function starFromId(
  id: string,
  openOn: string,
  createdAt: number = Date.now()
): MyStar {
  return {
    id,
    x: 0.08 + (hash(id) / 4294967295) * 0.84,
    y: 0.08 + (hash(id + "y") / 4294967295) * 0.62,
    hue: HUES[hash(id + "hue") % HUES.length],
    openOn,
    createdAt,
  };
}

function localDate(iso: string) {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Fetch your letters from the database and rebuild your stars.
export async function refreshStars() {
  try {
    const supabase = getSupabase();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      cache = [];
      return;
    }
    const { data, error } = await supabase
      .from("letters")
      .select("id, unlock_at, created_at")
      .eq("author_id", userData.user.id);
    if (error || !data) return;
    cache = data.map((row) =>
      starFromId(
        row.id,
        row.unlock_at ? localDate(row.unlock_at) : "",
        new Date(row.created_at).getTime()
      )
    );
  } catch {
    // if the network is down, keep whatever we had
  }
}

// Save one letter. Throws an Error with a readable message if anything fails.
export async function saveLetter(input: {
  star: MyStar;
  body: string;
  isPublic: boolean;
}) {
  const { star, body, isPublic } = input;
  const supabase = getSupabase();

  // midnight, in the writer's own timezone, on the chosen day
  const unlockAt = new Date(`${star.openOn}T00:00:00`).toISOString();

  const letter = await supabase.from("letters").insert({
    id: star.id,
    unlock_type: "date",
    unlock_at: unlockAt,
    is_public: isPublic,
  });
  if (letter.error) throw new Error(letter.error.message);

  const text = await supabase
    .from("letter_bodies")
    .insert({ letter_id: star.id, body });
  if (text.error) {
    await supabase.from("letters").delete().eq("id", star.id);
    throw new Error(text.error.message);
  }

  if (isPublic) {
    const shared = await supabase
      .from("stars")
      .insert({ letter_id: star.id, x: star.x, y: star.y, hue: star.hue });
    if (shared.error) {
      await supabase.from("letters").delete().eq("id", star.id);
      throw new Error(shared.error.message);
    }
  }
}

// delete letters feature 

// Delete one unlocked letter. The database also removes its text, its shared
// star, and every light and report attached to it (cascade).
export async function deleteLetter(id: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("letters")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  // The rules hide rows silently, so zero rows back means nothing was deleted.
  if (!data || data.length === 0) {
    throw new Error("This letter could not be deleted.");
  }
  // Take the star out of the sky's memory too.
  cache = cache.filter((s) => s.id !== id);
}