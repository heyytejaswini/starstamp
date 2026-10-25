"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sky from "@/components/Sky";
import { getSupabase } from "@/lib/supabase/client";
import { deleteLetter } from "@/lib/stars";

// The shape of one card on this page.
type LetterView = {
  id: string;
  unlockOn: string; // for example "21 Oct 2026"
  daysLeft: number; // 0 or less means the date has come
  isPublic: boolean;
  body: string | null; // null means the database kept the text hidden
};

export default function LettersPage() {
  const router = useRouter();
  const [letters, setLetters] = useState<LetterView[] | null>(null); // null = loading
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null); // letter waiting for a yes/no
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [toast, setToast] = useState("");
  const [skyKey, setSkyKey] = useState(0); // changing this redraws the sky

  async function confirmDelete() {
    if (!confirmId) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteLetter(confirmId);
      setLetters((current) =>
        current ? current.filter((l) => l.id !== confirmId) : current
      );
      setOpenId(null);
      setConfirmId(null);
      setSkyKey((k) => k + 1); // redraw the sky without that star and its lines
      setToast("Deleted successfully");
      setTimeout(() => setToast(""), 2600);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    let alive = true;

    async function load() {
      const supabase = getSupabase();

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/signin");
        return;
      }

      // Ask for both lists at the same time.
      const [lettersRes, bodiesRes] = await Promise.all([
        supabase
          .from("letters")
          .select("id, unlock_at, is_public")
          .eq("author_id", userData.user.id)
          .order("unlock_at", { ascending: true }),
        // No filter: we ask for every letter text we are allowed to see.
        supabase.from("letter_bodies").select("letter_id, body"),
      ]);

      if (!alive) return;

      if (lettersRes.error || bodiesRes.error) {
        setError("Could not load your letters. Please try again.");
        return;
      }

      const bodies = bodiesRes.data ?? [];
      // The privacy test: while every letter is sealed, this prints 0.
      console.log("Letter texts the database gave me:", bodies.length);

      const bodyById = new Map<string, string>(
        bodies.map((b) => [b.letter_id as string, b.body as string])
      );

      const now = Date.now();
      const views: LetterView[] = (lettersRes.data ?? []).map((l) => {
        const unlockTime = new Date(l.unlock_at).getTime();
        return {
          id: l.id,
          unlockOn: new Date(l.unlock_at).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          daysLeft: Math.ceil((unlockTime - now) / 86400000),
          isPublic: l.is_public,
          body: bodyById.get(l.id) ?? null,
        };
      });

      setLetters(views);
    }

    load();
    return () => {
      alive = false;
    };
  }, [router]);

  const muted = { color: "rgba(220, 230, 255, 0.75)" };

  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      <Sky key={skyKey} />
      <Link href="/" className="fixed left-4 top-4 z-10 text-sm" style={muted}>
        ← the sky
      </Link>

      <section className="relative z-10 mx-auto flex min-h-screen max-w-xl flex-col px-6 py-20">
        <h1 className="text-center text-3xl font-light tracking-[0.15em]">
          Star drawer
        </h1>

        {error && (
          <p className="mt-10 text-center" style={{ color: "#ffb4b4" }}>
            {error}
          </p>
        )}

        {!error && letters === null && (
          <p className="mt-10 text-center" style={muted}>
            Looking through the sky...
          </p>
        )}

        {letters !== null && letters.length === 0 && (
          <div className="mt-10 text-center" style={muted}>
            <p>You haven&apos;t sealed any letters yet.</p>
            <Link
              href="/write"
              className="mt-6 inline-block rounded-full border px-6 py-2 text-sm uppercase tracking-[0.2em]"
              style={{ borderColor: "rgba(255, 233, 176, 0.6)", color: "#ffe9b0" }}
            >
              Write one
            </Link>
          </div>
        )}

        <ul className="mt-10 flex flex-col gap-4">
          {letters?.map((l) => {
            const ready = l.body !== null;
            const isOpen = openId === l.id;
            return (
              <li
                key={l.id}
                className="rounded-md p-5"
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "2px dashed rgba(255, 233, 176, 0.45)",
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p style={{ color: "#ffe9b0" }}>
                      {ready ? "Ready to read" : `Sealed until ${l.unlockOn}`}
                    </p>
                    <p className="text-sm" style={muted}>
                      {ready
                        ? `Opened on ${l.unlockOn}`
                        : `${l.daysLeft} ${l.daysLeft === 1 ? "day" : "days"} to go`}
                      {l.isPublic ? " · shared" : " · private"}
                    </p>
                  </div>
                  {ready && (
                    <div className="flex items-center gap-2">
                      {isOpen && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError("");
                            setConfirmId(l.id);
                          }}
                          className="rounded-full border px-4 py-2 text-sm"
                          style={{
                            borderColor: "rgba(255, 180, 180, 0.7)",
                            color: "#ffb4b4",
                          }}
                        >
                          Delete
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : l.id)}
                        className="rounded-full px-4 py-2 text-sm"
                        style={{ background: "#ffe9b0", color: "#1b2a6b" }}
                      >
                        {isOpen ? "Close" : "Open"}
                      </button>
                    </div>
                  )}
                </div>

                {ready && isOpen && (
                  <div
                    className="mt-4 whitespace-pre-wrap rounded-sm p-5"
                    style={{
                      background: "#fbf6e9",
                      color: "#2b2b3a",
                      lineHeight: "32px",
                      fontFamily: "'Segoe Print', 'Bradley Hand', cursive",
                    }}
                  >
                    {l.body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {confirmId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: "rgba(8, 12, 40, 0.72)", backdropFilter: "blur(4px)" }}
          onClick={() => !deleting && setConfirmId(null)}
        >
          <div
            className="w-full max-w-sm rounded-md p-6 text-center"
            style={{
              background: "#151f55",
              border: "2px dashed rgba(255, 233, 176, 0.55)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-lg" style={{ color: "#ffe9b0" }}>
              Let this star go?
            </p>
            <p className="mt-3 text-sm" style={muted}>
              It will fade from the sky for good. Once deleted, it can&apos;t be
              restored again.
            </p>

            {deleteError && (
              <p className="mt-3 text-sm" style={{ color: "#ffb4b4" }}>
                {deleteError}
              </p>
            )}

            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmId(null)}
                className="rounded-full border px-5 py-2 text-sm"
                style={{
                  borderColor: "rgba(255, 233, 176, 0.6)",
                  color: "#ffe9b0",
                }}
              >
                Keep it
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="rounded-full px-5 py-2 text-sm"
                style={{ background: "#ffb4b4", color: "#3a1030" }}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2 text-sm"
          style={{ background: "#ffe9b0", color: "#1b2a6b" }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}