"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sky from "@/components/Sky";
import { getSupabase } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

export default function SignInPage() {
  const router = useRouter();
  // true while we ask "is someone already signed in?"
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  // if you're already signed in, there's nothing to do here, so go to the sky
  useEffect(() => {
    let alive = true;
    getSupabase()
      .auth.getUser()
      .then(({ data }) => {
        if (!alive) return;
        if (data.user) {
          router.replace("/");
        } else {
          setChecking(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === "sending") return;
    setStatus("sending");
    setMessage("");

    const { error } = await getSupabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  };

  if (checking) {
    return <main className="min-h-screen" />;
  }

  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      <Sky />
      <Link
        href="/"
        className="fixed left-4 top-4 z-10 text-sm"
        style={{ color: "rgba(220, 230, 255, 0.8)" }}
      >
        ← the sky
      </Link>

      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-light tracking-[0.15em]">Come on in</h1>
        <p
          className="mt-3 max-w-sm"
          style={{ color: "rgba(220, 230, 255, 0.8)" }}
        >
          We&apos;ll email you a link. No password needed.
        </p>

        {status === "sent" ? (
          <p className="mt-8 max-w-sm" style={{ color: "#ffe9b0" }}>
            Check your inbox (and spam). Open the link in this same browser.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-8 flex w-full max-w-sm flex-col gap-3"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Your email"
              className="rounded-full px-5 py-3 text-center outline-none"
              style={{ background: "rgba(255, 255, 255, 0.1)", color: "white" }}
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-full px-6 py-3 text-sm uppercase tracking-[0.2em] disabled:opacity-50"
              style={{ background: "#ffe9b0", color: "#1b2a6b" }}
            >
              {status === "sending" ? "Sending..." : "Send me a link"}
            </button>
            {status === "error" && (
              <p className="text-sm" style={{ color: "#ffb4b4" }}>
                {message}
              </p>
            )}
          </form>
        )}
      </section>
    </main>
  );
}
