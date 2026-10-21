"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { refreshStars } from "@/lib/stars";

export default function AccountMenu() {
  const router = useRouter();
  const pathname = usePathname();
  // undefined = still checking, null = signed out, string = signed-in email
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    let alive = true;

    supabase.auth.getUser().then(({ data }) => {
      if (alive) setEmail(data.user?.email ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await getSupabase().auth.signOut();
    await refreshStars(); // clears your stars from the sky
    setOpen(false);
    router.push("/");
  };

  // not needed on the sign-in pages themselves
  if (pathname.startsWith("/signin") || pathname.startsWith("/auth")) return null;
  if (email === undefined) return null;

  const pill = {
    background: "rgba(255, 255, 255, 0.1)",
    color: "#ffe9b0",
    border: "1px solid rgba(255, 233, 176, 0.4)",
  };

  if (email === null) {
    return (
      <Link
        href="/signin"
        className="fixed right-4 top-4 z-40 rounded-full px-4 py-2 text-sm"
        style={pill}
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="fixed right-4 top-4 z-40 text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        className="flex h-10 w-10 items-center justify-center rounded-full uppercase"
        style={pill}
      >
        {email[0]}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 flex w-56 flex-col gap-1 rounded-xl p-3"
          style={{ background: "rgba(11, 16, 38, 0.95)", border: pill.border }}
        >
          <p className="truncate pb-2" style={{ color: "rgba(220, 230, 255, 0.8)" }}>
            {email}
          </p>
          <span style={{ color: "rgba(220, 230, 255, 0.4)" }}>
            My letters (coming soon)
          </span>
          <button
            type="button"
            onClick={signOut}
            className="mt-1 text-left"
            style={{ color: "#ffe9b0" }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}