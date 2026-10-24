"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { getSupabase } from "@/lib/supabase/client";
import { DEFAULT_ENVELOPE, loadEnvelope, type EnvelopeOptions } from "@/lib/envelope";
import type { MyStar } from "@/lib/stars";
import {
  ENV_H,
  ENV_W,
  GROUP_OFFSET_Y,
  PAPER,
  SPARK,
  morphPathD,
} from "@/components/envelope/art";
import {
  EnvelopeBack,
  EnvelopeDefs,
  EnvelopeFlap,
  EnvelopeFront,
  SEAL_BOX,
  WaxSeal,
} from "@/components/envelope/Envelope";
import { useFit } from "@/components/envelope/useFit";

type Props = {
  star: MyStar;
  origin: { x: number; y: number }; // where the star was on screen when clicked
  onClose: () => void;
};

type View =
  | { kind: "loading" }
  | { kind: "open"; body: string }
  | { kind: "locked"; daysLeft: number; remaining: number };

const CARD_W = 330;
const CARD_H = 230;
const HAND = "'Segoe Print', 'Bradley Hand', cursive";
const CARD_CREAM = "#fbf6e9";
const NAVY = "#1a2766";
const MORPH_START = morphPathD(0);

// A rectangle whose edges are rows of round bumps (the scalloped panel on the card)
function scallopPath(w: number, h: number, bump: number) {
  const m = bump / 2;
  const nx = Math.round((w - 2 * m) / bump);
  const ny = Math.round((h - 2 * m) / bump);
  const bx = (w - 2 * m) / nx;
  const by = (h - 2 * m) / ny;
  let d = `M${m} ${m}`;
  for (let i = 0; i < nx; i++) d += ` a${bx / 2} ${bx / 2} 0 0 1 ${bx} 0`;
  for (let i = 0; i < ny; i++) d += ` a${by / 2} ${by / 2} 0 0 1 0 ${by}`;
  for (let i = 0; i < nx; i++) d += ` a${bx / 2} ${bx / 2} 0 0 1 ${-bx} 0`;
  for (let i = 0; i < ny; i++) d += ` a${by / 2} ${by / 2} 0 0 1 0 ${-by}`;
  return d + " Z";
}
const CARD_MARGIN = 10; // the cream border around the scalloped panel
const PANEL_W = CARD_W - CARD_MARGIN * 2;
const PANEL_H = CARD_H - CARD_MARGIN * 2;
const SCALLOP = scallopPath(PANEL_W, PANEL_H, 12);

/* ---------- the hourglass (for sealed letters) ---------- */
const GLASS =
  "M20 10 H100 C100 50 66 70 62 90 C66 110 100 130 100 170 H20 C20 130 54 110 58 90 C54 70 20 50 20 10 Z";
const TOP_SPARKS: [number, number][] = [[45, 86], [60, 84], [75, 86], [52, 76], [68, 74], [60, 66]];
const BOTTOM_SPARKS: [number, number][] = [[35, 164], [50, 158], [65, 163], [80, 160], [45, 150], [70, 148], [58, 140], [88, 165]];

// remaining: 1 = the wait has just begun, 0 = the wait is over
function Hourglass({ remaining, width }: { remaining: number; width: number }) {
  const r = Math.min(1, Math.max(0, remaining));
  const topHeight = 80 * r;
  const bottomHeight = 80 * (1 - r);

  return (
    <svg width={width} height={width * 1.5} viewBox="0 0 120 180" aria-hidden="true">
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
      {r > 0.02 && (
        <line className="sand-stream" x1="60" y1="90" x2="60" y2={170 - bottomHeight} stroke="#ffe9b0" strokeWidth="1.5" />
      )}
      <path d={GLASS} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
    </svg>
  );
}

/* ---------- the card: a cream rectangle with a scalloped night-blue panel inside ---------- */
function PostCard({
  innerRef,
  children,
}: {
  innerRef: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
}) {
  return (
    <div className="relative" style={{ width: CARD_W, height: CARD_H }}>
      <svg
        className="absolute inset-0"
        width={CARD_W}
        height={CARD_H}
        viewBox={`0 0 ${CARD_W} ${CARD_H}`}
        aria-hidden="true"
        style={{ filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.4))" }}
      >
        <defs>
          <clipPath id="cardClip">
            <rect width={CARD_W} height={CARD_H} rx="3" />
          </clipPath>
        </defs>
        {/* the cream card */}
        <rect width={CARD_W} height={CARD_H} rx="3" fill={CARD_CREAM} stroke="#e3c98a" strokeWidth="1" />
        <g clipPath="url(#cardClip)">
          <rect width={CARD_W} height={CARD_H} filter="url(#grainDark)" opacity="0.16" />
        </g>
        {/* the scalloped panel */}
        <g transform={`translate(${CARD_MARGIN} ${CARD_MARGIN})`}>
          <path d={SCALLOP} fill={NAVY} />
          <rect
            x="14"
            y="14"
            width={PANEL_W - 28}
            height={PANEL_H - 28}
            rx="4"
            fill="none"
            stroke="#ffe9b0"
            strokeOpacity="0.35"
            strokeDasharray="3 5"
            strokeLinecap="round"
          />
          {([[14, 14], [PANEL_W - 14, 14], [14, PANEL_H - 14], [PANEL_W - 14, PANEL_H - 14]] as const).map(([x, y], i) => (
            <path key={i} d={SPARK} transform={`translate(${x} ${y}) scale(0.7)`} fill="#ffe9b0" fillOpacity="0.7" />
          ))}
        </g>
      </svg>
      <div ref={innerRef} className="absolute" style={{ inset: 30, opacity: 0 }}>
        {children}
      </div>
    </div>
  );
}

/* ---------- the whole thing ---------- */
/* ---------- the whole thing ---------- */
export default function StarCard({ star, origin, onClose }: Props) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const fit = useFit(ENV_W);
  const [envelope, setEnvelope] = useState<EnvelopeOptions>(DEFAULT_ENVELOPE);

  // Values we only want from the moment the card opened (the animation is built once).
  const fitRef = useRef(fit);
  const originRef = useRef(origin);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const backdropRef = useRef<HTMLDivElement>(null);
  const morphRef = useRef<HTMLDivElement>(null);
  const morphPathRef = useRef<SVGPathElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const flapRef = useRef<HTMLDivElement>(null);
  const sealRef = useRef<HTMLDivElement>(null);
  const sparksRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const closingRef = useRef(false);
  const speedRef = useRef(1.7);

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

  // Which envelope did the writer choose? (old letters have none, so they get design A)
  useEffect(() => {
    let alive = true;
    loadEnvelope(star.id).then((e) => {
      if (alive) setEnvelope(e);
    });
    return () => {
      alive = false;
    };
  }, [star.id]);

  // Build the opening animation once.
  useEffect(() => {
    const backdrop = backdropRef.current;
    const morph = morphRef.current;
    const morphPathEl = morphPathRef.current;
    const group = groupRef.current;
    const back = backRef.current;
    const card = cardRef.current;
    const front = frontRef.current;
    const flapWrap = flapRef.current;
    const flap = flapWrap?.querySelector<HTMLElement>("[data-flap]") ?? null;
    const seal = sealRef.current;
    const sparksBox = sparksRef.current;
    const content = contentRef.current;
    const closeBtn = closeBtnRef.current;
    if (!backdrop || !morph || !morphPathEl || !group || !back || !card || !front) return;
    if (!flapWrap || !flap || !seal || !sparksBox || !content || !closeBtn) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    speedRef.current = reduce ? 40 : 1.7;

    const scale = fitRef.current;
    // where the star was, measured from the middle of the envelope, in scene units
    const ox = (originRef.current.x - window.innerWidth / 2) / scale;
    const oy =
      (originRef.current.y - (window.innerHeight / 2 + GROUP_OFFSET_Y * scale)) / scale;
    // how much bigger the card gets when it comes forward to be read
    const present = Math.min(
      1.45,
      (window.innerWidth - 24) / (CARD_W * scale),
      (window.innerHeight - 80) / (CARD_H * scale)
    );
    const sparks = Array.from(sparksBox.children);
    const faces = Array.from(flapWrap.querySelectorAll<HTMLElement>("[data-face]"));

    const ctx = gsap.context(() => {
      gsap.set(morph, { x: ox, y: oy, scale: 0.1, rotation: -72, opacity: 1 });
      morphPathEl.setAttribute("d", MORPH_START);

      const k = { v: 0 };
      const tl = gsap.timeline();
      tlRef.current = tl;

      tl.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power1.out" }, 0)
        // 1. the star blooms into an envelope shape
        .to(morph, { x: 0, y: 0, scale: 1, rotation: 0, duration: 1.0, ease: "power2.inOut" }, 0.1)
        .to(
          k,
          {
            v: 1,
            duration: 1.0,
            ease: "power2.inOut",
            onUpdate: () => morphPathEl.setAttribute("d", morphPathD(k.v)),
          },
          0.1
        )
        .to(morphPathEl, { fill: PAPER, duration: 1.0, ease: "power2.inOut" }, 0.1)
        // 2. the drawn envelope fades in over the shape
        .to(morph, { opacity: 0, duration: 0.3 }, 1.0)
        .to(group, { opacity: 1, duration: 0.3 }, 1.0)
        // 3. the wax seal presses on, glows, and breaks into sparkles
        .fromTo(seal, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: "back.out(2.5)" }, 1.25)
        .to(seal, { scale: 1.25, duration: 0.2, ease: "power1.out" }, 1.9)
        .to(seal, { scale: 0.2, opacity: 0, duration: 0.3, ease: "power2.in" }, 2.1)
        .fromTo(
          sparks,
          { x: 0, y: 0, scale: 0.4 },
          {
            x: (i: number) => Math.cos((i / 8) * Math.PI * 2) * 62,
            y: (i: number) => Math.sin((i / 8) * Math.PI * 2) * 62,
            scale: 1.2,
            duration: 0.7,
            ease: "power2.out",
          },
          2.1
        )
        .fromTo(sparks, { opacity: 0 }, { opacity: 1, duration: 0.1 }, 2.1)
        .to(sparks, { opacity: 0, duration: 0.6 }, 2.25)
        // 4. the flap swings open, and drops behind the card halfway
        .to(flap, { rotationX: -180, duration: 0.8, ease: "power2.inOut" }, 2.3)
        .set(flapWrap, { zIndex: 1 }, 2.7)
        // 5. the card slides up out of the envelope
        .to(card, { y: -150, duration: 0.8, ease: "power2.out" }, 3.05)
        // 6. the envelope sinks and softens while the card comes forward to be read
        .to([back, front, ...faces], { opacity: 0.25, duration: 0.7, ease: "power1.inOut" }, 3.6)
        .set(card, { zIndex: 8 }, 3.75)
        .to([back, front, flapWrap], { y: 170, duration: 0.9, ease: "power2.inOut" }, 3.8)
        .to(card, { scale: present, duration: 0.9, ease: "power2.inOut" }, 3.8)
        .fromTo(content, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 4.3)
        .fromTo(closeBtn, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 4.5);

      // For people who prefer less motion: jump straight to the end.
      if (reduce) tl.progress(1);
    });

    return () => {
      ctx.revert();
      tlRef.current = null;
    };
  }, []);

  // Closing = play the same animation backwards.
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const tl = tlRef.current;
    if (!tl) {
      onCloseRef.current();
      return;
    }
    tl.timeScale(speedRef.current);
    tl.eventCallback("onReverseComplete", () => onCloseRef.current());
    tl.reverse();
  }, []);

  // Press Escape to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

  const dateFormat = { day: "numeric", month: "long", year: "numeric" } as const;
  const written = new Date(star.createdAt).toLocaleDateString("en-IN", dateFormat);
  const opensOn = new Date(`${star.openOn}T00:00:00`).toLocaleDateString("en-IN", dateFormat);
  const meta = { createdAt: star.createdAt, openOn: star.openOn };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="A letter from your younger self"
      className="fixed inset-0 z-50 overflow-hidden"
      onClick={(e) => {
        // a click on anything that isn't the envelope, the card or the close button closes it
        if (!(e.target as Element).closest("[data-keep]")) requestClose();
      }}
    >
      <div
        ref={backdropRef}
        className="absolute inset-0"
        style={{ background: "rgba(5, 8, 22, 0.78)", opacity: 0 }}
      />

      <button
        ref={closeBtnRef}
        type="button"
        data-keep
        onClick={requestClose}
        aria-label="Close the letter"
        className="absolute right-4 top-4 z-10 h-10 w-10 rounded-full text-lg"
        style={{ border: "1px solid rgba(255, 233, 176, 0.5)", color: "#ffe9b0", opacity: 0 }}
      >
        ✕
      </button>

      {/* the scene: drawn at a fixed size, then scaled to fit the screen */}
      <div
        className="pointer-events-none absolute left-1/2"
        style={{
          top: `calc(50% + ${GROUP_OFFSET_Y * fit}px)`,
          width: ENV_W,
          height: ENV_H,
          transform: `translate(-50%, -50%) scale(${fit})`,
        }}
      >
        {/* the star that turns into an envelope */}
        <div
          ref={morphRef}
          className="absolute"
          style={{ left: ENV_W / 2 - 300, top: ENV_H / 2 - 300, width: 600, height: 600, opacity: 0 }}
        >
          <svg
            width="600"
            height="600"
            viewBox="-300 -300 600 600"
            aria-hidden="true"
            style={{ overflow: "visible", filter: "drop-shadow(0 0 18px rgba(255, 233, 176, 0.8))" }}
          >
            <path ref={morphPathRef} d={MORPH_START} fill={`hsl(${star.hue}, 90%, 82%)`} />
          </svg>
        </div>

        {/* the envelope (the same pieces the sealing animation used) */}
        <div
          ref={groupRef}
          data-keep
          className="pointer-events-auto absolute inset-0"
          style={{ opacity: 0, perspective: 900, isolation: "isolate" }}
        >
          <EnvelopeDefs />

          <div ref={backRef} className="absolute inset-0" style={{ zIndex: 1 }}>
            <EnvelopeBack />
          </div>

          {/* the card, resting inside */}
          <div ref={cardRef} className="absolute" style={{ left: (ENV_W - CARD_W) / 2, top: 8, zIndex: 2 }}>
            <PostCard innerRef={contentRef}>
              {view.kind === "loading" && (
                <p
                  className="flex h-full items-center justify-center text-sm"
                  style={{ color: "rgba(255, 247, 221, 0.7)", fontFamily: HAND }}
                >
                  Listening to the star...
                </p>
              )}

              {view.kind === "locked" && (
                <div className="flex h-full items-center gap-4">
                  <div className="shrink-0">
                    <Hourglass remaining={view.remaining} width={72} />
                  </div>
                  <div
                    className="h-3/4 shrink-0 border-l border-dashed"
                    style={{ borderColor: "rgba(255, 233, 176, 0.35)" }}
                  />
                  <div className="text-left">
                    <p className="text-xl" style={{ color: "#ffe9b0", fontFamily: HAND }}>
                      Not yet
                    </p>
                    <p className="mt-1 text-sm" style={{ color: "rgba(244, 239, 224, 0.92)" }}>
                      {view.daysLeft > 0
                        ? `${view.daysLeft} ${view.daysLeft === 1 ? "day" : "days"} until ${opensOn}.`
                        : "Any moment now."}
                    </p>
                    <p className="mt-2 text-xs" style={{ color: "rgba(244, 239, 224, 0.6)" }}>
                      Sealed on {written}. Your younger self is keeping it safe.
                    </p>
                  </div>
                </div>
              )}

              {view.kind === "open" && (
                <div className="flex h-full flex-col">
                  <p className="text-[11px] uppercase tracking-[0.15em]" style={{ color: "rgba(255, 233, 176, 0.8)" }}>
                    A letter from {written}
                  </p>
                  <div
                    className="mt-2 flex-1 overflow-y-auto whitespace-pre-wrap pr-1 text-left"
                    style={{
                      fontFamily: HAND,
                      fontSize: 14,
                      lineHeight: "22px",
                      color: "#f6f0df",
                      scrollbarWidth: "thin",
                      scrollbarColor: "rgba(255, 233, 176, 0.5) transparent",
                    }}
                  >
                    {view.body}
                  </div>
                </div>
              )}
            </PostCard>
          </div>

          <div ref={frontRef} className="absolute inset-0" style={{ zIndex: 3 }}>
            <EnvelopeFront options={envelope} meta={meta} />
          </div>

          <div ref={flapRef} className="absolute inset-0" style={{ zIndex: 4, perspective: 900 }}>
            <EnvelopeFlap />
          </div>

          <div ref={sealRef} className="absolute" style={{ zIndex: 6, ...SEAL_BOX, opacity: 0 }}>
            <WaxSeal options={envelope} />
          </div>

          {/* sparkles that burst out when the seal breaks */}
          <div ref={sparksRef} className="pointer-events-none absolute" style={{ left: 190, top: 128, zIndex: 7 }}>
            {Array.from({ length: 8 }, (_, i) => (
              <span
                key={i}
                className="absolute"
                style={{ marginLeft: -6, marginTop: -8, fontSize: 12, color: "#ffe9b0", opacity: 0 }}
              >
                ✦
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
