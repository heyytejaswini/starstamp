"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type { MyStar } from "@/lib/stars";

type Props = {
  star: MyStar;
  onClose: () => void;
};

type View =
  | { kind: "loading" }
  | { kind: "open"; body: string }
  | { kind: "locked"; daysLeft: number };

export default function StarCard({ star, onClose }: Props) {
  const [view, setView] = useState<View>({ kind: "loading" });

  // Ask the database for this star's letter text.
  useEffect(() => {
    let alive = true;

    async function load() {
      const { data } = await getSupabase()
        .from("letter_bodies")
        .select("body")
        .eq("letter_id", star.id)
        .maybeSingle();

      if (!alive) return;

      if (data) {
        setView({ kind: "open", body: data.body });
      } else {
        const unlockTime = new Date(`${star.openOn}T00:00:00`).getTime();
        const daysLeft = Math.ceil((unlockTime - Date.now()) / 86400000);
        setView({ kind: "locked", daysLeft });
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [star.id, star.openOn]);

  // Press Escape to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const written = new Date(star.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const opensOn = new Date(`${star.openOn}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(5, 8, 22, 0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-md p-6 text-center"
        style={{
          background: view.kind === "open" ? "#fbf6e9" : "rgba(11, 16, 38, 0.95)",
          color: view.kind === "open" ? "#2b2b3a" : "white",
          border: "1px solid rgba(255, 233, 176, 0.4)",
          boxShadow: "0 0 60px rgba(255, 233, 176, 0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {view.kind === "loading" && (
          <p style={{ color: "rgba(220, 230, 255, 0.7)" }}>Listening to the star...</p>
        )}

        {view.kind === "locked" && (
          <>
            <p className="text-3xl" style={{ color: "#ffe9b0" }}>
              ✦
            </p>
            <h2 className="mt-3 text-xl">Not yet</h2>
            <p className="mt-2" style={{ color: "rgba(220, 230, 255, 0.8)" }}>
              {view.daysLeft > 0
                ? `${view.daysLeft} ${view.daysLeft === 1 ? "day" : "days"} until ${opensOn}.`
                : "Any moment now."}
            </p>
            <p className="mt-1 text-sm" style={{ color: "rgba(220, 230, 255, 0.55)" }}>
              Sealed on {written}. Your younger self is keeping it safe.
            </p>
          </>
        )}

        {view.kind === "open" && (
          <>
            <p className="text-sm" style={{ opacity: 0.6 }}>
              A letter from {written}
            </p>
            <div
              className="mt-4 max-h-80 overflow-y-auto whitespace-pre-wrap text-left"
              style={{
                lineHeight: "32px",
                fontFamily: "'Segoe Print', 'Bradley Hand', cursive",
              }}
            >
              {view.body}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-6 rounded-full px-5 py-2 text-sm"
          style={{ border: "1px solid rgba(255, 233, 176, 0.5)", color: view.kind === "open" ? "#2b2b3a" : "#ffe9b0" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}