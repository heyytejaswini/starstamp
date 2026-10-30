import { getSupabase } from "@/lib/supabase/client";

// 3 to 20 characters: lowercase letters, digits and underscores
export const USERNAME_RULE = /^[a-z0-9_]{3,20}$/;

// Tidy whatever was typed: no spaces at the ends, all lowercase
export function cleanUsername(raw: string) {
  return raw.trim().toLowerCase();
}

// The saved username of whoever is signed in, or null if they have none yet.
export async function getMyUsername(): Promise<string | null> {
  const supabase = getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userData.user.id)
    .maybeSingle();

  return data?.username ?? null;
}

// Save (or change) the username. Throws an Error with a readable message.
export async function saveUsername(raw: string): Promise<string> {
  const name = cleanUsername(raw);
  if (!USERNAME_RULE.test(name)) {
    throw new Error("Use 3 to 20 letters, numbers or underscores.");
  }

  const supabase = getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Please sign in first.");

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userData.user.id, username: name });

  if (error) {
    // 23505 is Postgres's code for "this value must be unique but already exists"
    if (error.code === "23505") throw new Error("That name is taken. Try another.");
    throw new Error(error.message);
  }
  return name;
}