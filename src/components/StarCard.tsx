"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import gsap from "gsap";
import { getSupabase } from "@/lib/supabase/client";
import type { MyStar } from "@/lib/stars";

type Props = {
  star: MyStar;
  origin: { x: number; y: number }; // where the star was on screen when clicked
  onClose: () => void;
};

type View =
  | { kind: "loading" }
  | { kind: "open"; body: string }
  | { kind: "locked"; daysLeft: number; remaining: number };

/* ---------- sizes (the whole scene is drawn at this size, then scaled to fit) ---------- */
const ENV_W = 380;
const ENV_H = 240;
const FLAP_H = 135;
const CARD_W = 330;
const CARD_H = 230;
const GROUP_OFFSET_Y = 20; // the envelope sits a little below the screen centre
const HAND = "'Segoe Print', 'Bradley Hand', cursive";

/* ---------- star -> envelope morph ---------- */
const N = 120; // points around the outline

// A soft five-pointed star: the distance from the centre at each angle
function starRadius(theta: number) {
  const k = 0.5 + 0.5 * Math.cos(5 * (theta + Math.PI / 2));
  return 118 * (0.5 + 0.5 * Math.pow(k, 0.8));
}

// A rounded rectangle the size of the envelope, as a distance from the centre
function envelopeRadius(theta: number) {
  const a = ENV_W / 2;
  const b = ENV_H / 2;
  const n = 10; // higher = squarer corners
  const c = Math.abs(Math.cos(theta)) / a;
  const s = Math.abs(Math.sin(theta)) / b;
  return 1 / Math.pow(Math.pow(c, n) + Math.pow(s, n), 1 / n);
}

// k = 0 is the star, k = 1 is the envelope, in between is a blend of both
function morphPathD(k: number) {
  let d = "";
  for (let i = 0; i < N; i++) {
    const theta = (i / N) * Math.PI * 2;
    const r = starRadius(theta) * (1 - k) + envelopeRadius(theta) * k;
    d += `${i === 0 ? "M" : "L"}${(Math.cos(theta) * r).toFixed(1)} ${(Math.sin(theta) * r).toFixed(1)} `;
  }
  return d + "Z";
}
const MORPH_START = morphPathD(0);

/* ---------- little drawing helpers ---------- */
const SPARK = "M0 -8 Q0 0 8 0 Q0 0 0 8 Q0 0 -8 0 Q0 0 0 -8 Z";

// A rectangle whose edges are rows of round bumps (the postcard edge)
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
const SCALLOP = scallopPath(CARD_W, CARD_H, 14);

// The wobbly edge of the wax seal
function sealPathD() {
  let d = "";
  for (let i = 0; i < 72; i++) {
    const t = (i / 72) * Math.PI * 2;
    const r = 22 + 1.6 * Math.sin(9 * t) + 0.8 * Math.sin(5 * t + 1);
    d += `${i === 0 ? "M" : "L"}${(26 + Math.cos(t) * r).toFixed(1)} ${(26 + Math.sin(t) * r).toFixed(1)} `;
  }
  return d + "Z";
}
const SEAL_PATH = sealPathD();

const LINING_STARS: [number, number][] = [
  [30, 20], [60, 48], [95, 22], [130, 70], [160, 30], [190, 88], [225, 28],
  [255, 66], [290, 22], [325, 50], [350, 24], [200, 50], [110, 100], [270, 100],
];

/* ---------- shrink the scene to fit small screens ---------- */
function subscribeResize(callback: () => void) {
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}
function useFitScale() {
  return useSyncExternalStore(
    subscribeResize,
    () => {
      const byWidth = (window.innerWidth - 24) / ENV_W;
      const byHeight = (window.innerHeight - 40) / 520;
      return Math.round(Math.min(1, byWidth, byHeight) * 100) / 100;
    },
    () => 1
  );
}

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

/* ---------- the scalloped postcard ---------- */
function ScallopCard({
  tone,
  innerRef,
  children,
}: {
  tone: "paper" | "night";
  innerRef: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
}) {
  const paper = tone === "paper";
  return (
    <div className="relative" style={{ width: CARD_W, height: CARD_H }}>
      <svg
        className="absolute inset-0"
        width={CARD_W}
        height={CARD_H}
        viewBox={`0 0 ${CARD_W} ${CARD_H}`}
        aria-hidden="true"
        style={{ filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.35))" }}
      >
        <path
          d={SCALLOP}
          fill={paper ? "#fbf6e9" : "#1a2766"}
          stroke={paper ? "#e3c98a" : "#ffe9b0"}
          strokeOpacity={paper ? 1 : 0.5}
          strokeWidth="1.2"
        />
        <rect
          x="16"
          y="16"
          width={CARD_W - 32}
          height={CARD_H - 32}
          rx="6"
          fill="none"
          stroke={paper ? "#d9b977" : "#ffe9b0"}
          strokeOpacity="0.55"
          strokeDasharray="3 5"
          strokeLinecap="round"
        />
      </svg>
      <div ref={innerRef} className="absolute" style={{ inset: 26, opacity: 0 }}>
        {children}
      </div>
    </div>
  );
}

/* ---------- the whole thing ---------- */
export default function StarCard({ star, origin, onClose }: Props) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const fit = useFitScale();

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

  // Build the opening animation once.
  useEffect(() => {
    const backdrop = backdropRef.current;
    const morph = morphRef.current;
    const morphPathEl = morphPathRef.current;
    const group = groupRef.current;
    const back = backRef.current;
    const card = cardRef.current;
    const front = frontRef.current;
    const flap = flapRef.current;
    const seal = sealRef.current;
    const sparksBox = sparksRef.current;
    const content = contentRef.current;
    const closeBtn = closeBtnRef.current;
    if (!backdrop || !morph || !morphPathEl || !group || !back || !card || !front) return;
    if (!flap || !seal || !sparksBox || !content || !closeBtn) return;

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
    const faces = Array.from(flap.querySelectorAll<HTMLElement>("[data-face]"));

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
        .to(morphPathEl, { fill: "#8fa8dd", duration: 1.0, ease: "power2.inOut" }, 0.1)
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
        .set(flap, { zIndex: 1 }, 2.7)
        // 5. the card slides up out of the envelope
        .to(card, { y: -150, duration: 0.8, ease: "power2.out" }, 3.05)
        // 6. the envelope sinks and softens while the card comes forward to be read
        .to([back, front, ...faces], { opacity: 0.25, duration: 0.7, ease: "power1.inOut" }, 3.6)
        .set(card, { zIndex: 8 }, 3.75)
        .to([back, front, flap], { y: 170, duration: 0.9, ease: "power2.inOut" }, 3.8)
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

  const shortDate = new Date(star.createdAt)
    .toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })
    .toUpperCase();
  const dateFormat = { day: "numeric", month: "long", year: "numeric" } as const;
  const written = new Date(star.createdAt).toLocaleDateString("en-IN", dateFormat);
  const opensOn = new Date(`${star.openOn}T00:00:00`).toLocaleDateString("en-IN", dateFormat);

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

        {/* the envelope */}
        <div
          ref={groupRef}
          data-keep
          className="pointer-events-auto absolute inset-0"
          style={{ opacity: 0, perspective: 900, isolation: "isolate" }}
        >
          {/* inside of the envelope */}
          <div ref={backRef} className="absolute inset-0" style={{ zIndex: 1 }}>
            <svg width={ENV_W} height={ENV_H} viewBox={`0 0 ${ENV_W} ${ENV_H}`} aria-hidden="true">
              <rect width={ENV_W} height={ENV_H} rx="8" fill="#2a3a85" />
              {LINING_STARS.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.6 : 1} fill="#ffe9b0" opacity="0.5" />
              ))}
            </svg>
          </div>

          {/* the card, resting inside */}
          <div ref={cardRef} className="absolute" style={{ left: (ENV_W - CARD_W) / 2, top: 8, zIndex: 2 }}>
            <ScallopCard tone={view.kind === "open" ? "paper" : "night"} innerRef={contentRef}>
              {view.kind === "loading" && (
                <p
                  className="flex h-full items-center justify-center text-sm"
                  style={{ color: "rgba(220, 230, 255, 0.7)", fontFamily: HAND }}
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
                    <p className="mt-1 text-sm" style={{ color: "rgba(220, 230, 255, 0.9)" }}>
                      {view.daysLeft > 0
                        ? `${view.daysLeft} ${view.daysLeft === 1 ? "day" : "days"} until ${opensOn}.`
                        : "Any moment now."}
                    </p>
                    <p className="mt-2 text-xs" style={{ color: "rgba(220, 230, 255, 0.55)" }}>
                      Sealed on {written}. Your younger self is keeping it safe.
                    </p>
                  </div>
                </div>
              )}

              {view.kind === "open" && (
                <div className="flex h-full flex-col">
                  <p className="text-[11px] uppercase tracking-[0.15em]" style={{ color: "#9a7b3c" }}>
                    A letter from {written}
                  </p>
                  <div
                    className="mt-2 flex-1 overflow-y-auto whitespace-pre-wrap pr-1 text-left"
                    style={{
                      fontFamily: HAND,
                      fontSize: 14,
                      lineHeight: "22px",
                      color: "#2b2b3a",
                      scrollbarWidth: "thin",
                      scrollbarColor: "#d9b977 transparent",
                    }}
                  >
                    {view.body}
                  </div>
                </div>
              )}
            </ScallopCard>
          </div>

          {/* the front of the envelope */}
          <div ref={frontRef} className="absolute inset-0" style={{ zIndex: 3 }}>
            <svg width={ENV_W} height={ENV_H} viewBox={`0 0 ${ENV_W} ${ENV_H}`} aria-hidden="true">
              <defs>
                <linearGradient id="frontGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#a3b9ea" />
                  <stop offset="1" stopColor="#869fd6" />
                </linearGradient>
                <linearGradient id="windowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#0b1026" />
                  <stop offset="1" stopColor="#1b2a6b" />
                </linearGradient>
              </defs>
              <path
                d="M0 0 L190 128 L380 0 L380 232 Q380 240 372 240 L8 240 Q0 240 0 232 Z"
                fill="url(#frontGrad)"
              />
              <path d="M0 0 L190 128 L380 0" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
              <path
                d="M14 3 L190 116 L366 3"
                fill="none"
                stroke="#fff7dd"
                strokeOpacity="0.7"
                strokeWidth="1.2"
                strokeDasharray="3 5"
                strokeLinecap="round"
              />

              {/* doodles */}
              <path
                d="M40 228 C 100 214, 160 234, 220 224 S 320 218, 350 228"
                fill="none"
                stroke="#fff7dd"
                strokeOpacity="0.7"
                strokeWidth="1.3"
                strokeDasharray="2 7"
                strokeLinecap="round"
              />
              <path d="M0 -14 A14 14 0 1 0 14 8 A11 11 0 1 1 0 -14 Z" transform="translate(152 208) scale(0.7)" fill="#fff7dd" fillOpacity="0.85" />
              {([[126, 148, 0.8], [236, 146, 0.6], [264, 212, 0.9], [18, 176, 0.7], [366, 128, 0.6]] as const).map(([x, y, s], i) => (
                <path key={i} d={SPARK} transform={`translate(${x} ${y}) scale(${s})`} fill="#fff7dd" fillOpacity="0.85" />
              ))}

              {/* the little window with a star inside */}
              <rect x="30" y="140" width="72" height="72" rx="10" fill="url(#windowGrad)" stroke="#fff7dd" strokeWidth="2" />
              <rect x="35" y="145" width="62" height="62" rx="7" fill="none" stroke="#fff7dd" strokeOpacity="0.5" strokeDasharray="2 4" strokeLinecap="round" />
              <path className="twinkle" d={SPARK} transform="translate(66 176) scale(2.2)" fill="#ffe9b0" />
              <circle cx="46" cy="160" r="1.2" fill="#fff" opacity="0.7" />
              <circle cx="86" cy="194" r="1.4" fill="#fff" opacity="0.7" />
              <circle cx="82" cy="156" r="1" fill="#fff" opacity="0.7" />

              {/* the address, in handwriting */}
              <text x="116" y="170" fontSize="21" fill="#fff7dd" fontFamily={HAND} transform="rotate(-4 116 170)">
                for future me
              </text>
              <text x="118" y="194" fontSize="11" fill="#fff7dd" fillOpacity="0.85" fontFamily={HAND}>
                from your younger self ✦
              </text>

              {/* the stamp, with a star in your star's colour */}
              <g transform="translate(298 142)">
                <rect x="0" y="0" width="54" height="66" fill="#fbf3dc" stroke="#97afe3" strokeWidth="5" strokeDasharray="0 6" strokeLinecap="round" />
                <rect x="6" y="6" width="42" height="42" rx="2" fill="#1b2a6b" />
                <path d={SPARK} transform="translate(27 27) scale(1.7)" fill={`hsl(${star.hue}, 90%, 85%)`} />
                <text x="27" y="60" fontSize="6" textAnchor="middle" fill="#3a2f1f" letterSpacing="1">
                  STARSTAMP
                </text>
              </g>

              {/* the postmark */}
              <g transform="translate(288 198)" opacity="0.75">
                <circle r="21" fill="none" stroke="#1b2a6b" strokeWidth="1.2" strokeDasharray="2 2.5" />
                <circle r="15" fill="none" stroke="#1b2a6b" strokeWidth="0.8" />
                <text y="2.5" fontSize="6" textAnchor="middle" fill="#1b2a6b">
                  {shortDate}
                </text>
              </g>
            </svg>
          </div>

          {/* the flap: an outer face and an inner face, joined at the top edge */}
          <div
            ref={flapRef}
            className="absolute left-0 top-0"
            style={{
              width: ENV_W,
              height: FLAP_H,
              zIndex: 4,
              transformStyle: "preserve-3d",
              transformOrigin: "50% 0%",
            }}
          >
            <div
              data-face
              className="absolute inset-0"
              style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
            >
              <svg width={ENV_W} height={FLAP_H} viewBox={`0 0 ${ENV_W} ${FLAP_H}`} aria-hidden="true">
                <defs>
                  <linearGradient id="flapGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#bccdf2" />
                    <stop offset="1" stopColor="#9db4e6" />
                  </linearGradient>
                </defs>
                <path d="M0 0 L380 0 L190 135 Z" fill="url(#flapGrad)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinejoin="round" />
                <path
                  d="M18 8 L190 118 L362 8"
                  fill="none"
                  stroke="#fff7dd"
                  strokeOpacity="0.7"
                  strokeWidth="1.2"
                  strokeDasharray="3 5"
                  strokeLinecap="round"
                />
                <path d={SPARK} transform="translate(120 30) scale(0.7)" fill="#fff7dd" fillOpacity="0.8" />
                <path d={SPARK} transform="translate(265 26) scale(0.9)" fill="#fff7dd" fillOpacity="0.8" />
              </svg>
            </div>
            <div
              data-face
              className="absolute inset-0"
              style={{
                transform: "rotateY(180deg)",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            >
              <svg width={ENV_W} height={FLAP_H} viewBox={`0 0 ${ENV_W} ${FLAP_H}`} aria-hidden="true">
                <path d="M0 0 L380 0 L190 135 Z" fill="#27357f" stroke="rgba(255,233,176,0.35)" strokeWidth="1" strokeLinejoin="round" />
                {LINING_STARS.slice(0, 9).map(([x, y], i) => (
                  <circle key={i} cx={x} cy={Math.min(y, 70) * 0.9} r={i % 3 === 0 ? 1.6 : 1} fill="#ffe9b0" opacity="0.55" />
                ))}
              </svg>
            </div>
          </div>

          {/* the wax seal on the flap tip */}
          <div ref={sealRef} className="absolute" style={{ left: 164, top: 102, width: 52, height: 52, zIndex: 6, opacity: 0 }}>
            <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
              <defs>
                <radialGradient id="waxGrad" cx="40%" cy="35%" r="70%">
                  <stop offset="0" stopColor="#f7e0a0" />
                  <stop offset="0.6" stopColor="#d9a94c" />
                  <stop offset="1" stopColor="#b07a2a" />
                </radialGradient>
              </defs>
              <path d={SEAL_PATH} fill="url(#waxGrad)" />
              <circle cx="26" cy="26" r="15" fill="none" stroke="rgba(120,70,10,0.45)" strokeWidth="1.2" />
              <path d={SPARK} transform="translate(26.6 26.6) scale(1.6)" fill="rgba(255,240,200,0.6)" />
              <path d={SPARK} transform="translate(26 26) scale(1.6)" fill="#a8741f" />
            </svg>
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