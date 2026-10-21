"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabase();

    // The Supabase client reads the link and signs you in by itself.
    // We just wait until it says "signed in", then move on.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        // you just came in through the email link, so skip the door this time

        router.replace("/");
      }
    });

    return () => data.subscription.unsubscribe();
  }, [router]);

  return (
    <main
      className="flex min-h-screen items-center justify-center text-center"
      style={{ color: "rgba(220, 230, 255, 0.85)" }}
    >
      Opening the door...
    </main>
  );
}