import { createBrowserClient } from "@supabase/ssr";

// Creates the connection to your Supabase project.
// Calling it many times is fine: it hands back the same one each time.
export function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
