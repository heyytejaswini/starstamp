"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { getSupabase } from "@/lib/supabase/client";
import type { MyStar } from "@/lib/stars";

type Props = {
  star: MyStar;
  onClose: () => void;
};

type View =
  | { kind: "loading" }
  | { kind: "open"; body: string }
  | { kind: "locked"; daysLeft: number; remaining: number };

// The outline of the hourglass (two bulbs joined by a thin neck)
const GLASS =
  "M20 10 H100 C100 50 66 70 62 90 C66 110 100 130 100 170 H20 C20 130 54 110 58 90 C54 70 20 50 20 10 Z";

// Fixed spots where little stars sit in the sand
const TOP_SPARKS: [number, number][] = [[45, 86], [60, 84], [75, 86], [52, 76], [68, 74], [60, 66]];
const BOTTOM_SPARKS: [number, number][] = [[35, 164], [50, 158], [65, 163], [80, 160], [45, 150], [70, 148], [58, 140], [88, 165]];

// remaining: 1 = the wait has just begun, 0 = the wait is over
function Hourglass({ remaining }: { remaining: number }) {
  const r = Math.min(1, Math.max(0, remaining));
  const topHeight = 80 * r; // sand left in the top bulb
  const bottomHeight = 80 * (1 - r); // sand collected in the bottom bulb

  return (
    <svg width="110" height="165" viewBox="0 0 120 180" aria-hidden="true" className="mx-auto">
      <defs>
        <clipPath id="glassClip">
          <path d={GLASS} />
        </clipPath>
      </defs>

      <g clipPath="url(#glassClip)">
        <rect x="0" y={90 - topHeight} width="120" height={topHeight} fill="#ffe9b0" opacity="0.8" />
        <rect x="0" y={170 - bottomHeight} width="120" height={bottomHeight} fill="#ffe9b0" opacity="0.8" />
        {TOP_SPARKS.map(([x, y], i) =>
          y > 90 - topHeight + 3 ? (
            <text key={`t${i}`} className="twinkle" x={x} y={y} fontSize="9" fill="#fff" style={{ animationDelay: `${i * 0.3}s` }}>
              ✦
            </text>
          ) : null
        )}
        {BOTTOM_SPARKS.map(([x, y], i) =>
          y > 170 - bottomHeight + 3 ? (
            <text key={`b${i}`} className="twinkle" x={x} y={y} fontSize="9" fill="#fff" style={{ animationDelay: `${i * 0.25}s` }}>
              ✦
            </text>
          ) : null
        )}
      </g>

      {/* the thin stream of sand through the neck */}
      {r > 0.02 && (
        <line className="sand-stream" x1="60" y1="90" x2="60" y2={170 - bottomHeight} stroke="#ffe9b0" strokeWidth="1.5" />
      )}

      <path d={GLASS} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
    </svg>
  );
}

export default function StarCard({ star, onClose }: Props) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const paperRef = useRef<HTMLDivElement>(null);
  const glyphRef = useRef<HTMLParagraphElement>(null);

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
        const now = Date.now();
        const total = unlockTime - star.createdAt;
        setView({
          kind: "locked",
          daysLeft: Math.ceil((unlockTime - now) / 86400000),
          remaining: total > 0 ? (unlockTime - now) / total : 0,
        });
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [star.id, star.openOn, star.createdAt]);

  // When the letter is ready: a flash of light, then the page unfolds.
  useEffect(() => {
    if (view.kind !== "open") return;
    const paper = paperRef.current;
    const glyph = glyphRef.current;
    if (!paper || !glyph) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(paper, { opacity: 1 });
      return;
    }

    const tl = gsap.timeline();
    tl.fromTo(
      glyph,
      { scale: 0, opacity: 1 },
      { scale: 2, opacity: 0, duration: 0.8, ease: "power2.out" }
    ).fromTo(
      paper,
      { scaleY: 0.05, opacity: 0, transformOrigin: "50% 0%" },
      { scaleY: 1, opacity: 1, duration: 1, ease: "power3.out" },
      0.3
    );
    return () => {
      tl.kill();
    };
  }, [view.kind]);

  // Press Escape to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dateFormat = { day: "numeric", month: "long", year: "numeric" } as const;
  const written = new Date(star.createdAt).toLocaleDateString("en-IN", dateFormat);
  const opensOn = new Date(`${star.openOn}T00:00:00`).toLocaleDateString("en-IN", dateFormat);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(5, 8, 22, 0.7)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-md p-6 text-center"
        style={{
          background: "rgba(11, 16, 38, 0.95)",
          color: "white",
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
            <Hourglass remaining={view.remaining} />
            <h2 className="mt-3 text-xl">Not yet</h2>
            <p className="mt-2" style={{ color: "rgba(220, 230, 255, 0.85)" }}>
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
            <p
              ref={glyphRef}
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl"
              style={{ color: "#ffe9b0" }}
            >
              ✦
            </p>
            <div
              ref={paperRef}
              className="opacity-0 rounded-sm p-5"
              style={{ background: "#fbf6e9", color: "#2b2b3a" }}
            >
              <p className="text-sm" style={{ opacity: 0.6 }}>
                A letter from {written}
              </p>
              <div
                className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap text-left"
                style={{
                  lineHeight: "32px",
                  fontFamily: "'Segoe Print', 'Bradley Hand', cursive",
                }}
              >
                {view.body}
              </div>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-6 rounded-full px-5 py-2 text-sm"
          style={{ border: "1px solid rgba(255, 233, 176, 0.5)", color: "#ffe9b0" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}