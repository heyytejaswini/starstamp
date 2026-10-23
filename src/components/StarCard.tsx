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

/* ---------- colours of the envelope (all in your night-sky palette) ---------- */
const PAPER = "#98b0e4"; // the front of the envelope
const FLAP_PAPER = "#abbfec"; // the flap, a touch lighter
const INK = "#26357c"; // the thin dark-blue pen lines
const CREAM = "#fff7dd";
const TEAL = "#7fcfd0";
const CARD_CREAM = "#fbf6e9";
const NAVY = "#1a2766";

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

/* ---------- shapes of the envelope ---------- */
// The front: the pocket, with a V-shaped top edge that ends in a soft round tip
const FRONT_D =
  "M0 0 L168 116 Q190 130 212 116 L380 0 L380 236 Q380 240 376 240 L4 240 Q0 240 0 236 Z";
// The flap: a triangle with a rounded tip, a little bigger than the V so it covers the edge
const FLAP_D = "M0 0 L380 0 L214 118 Q190 135 166 118 Z";

/* ---------- little drawing helpers ---------- */
const SPARK = "M0 -8 Q0 0 8 0 Q0 0 0 8 Q0 0 -8 0 Q0 0 0 -8 Z";

// A five-pointed star outline
function starD(cx: number, cy: number, outer: number, inner: number) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += `${i === 0 ? "M" : "L"}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)} `;
  }
  return d + "Z";
}

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

// A flat disc of wax with a gently scalloped, slightly uneven edge
function sealPathD() {
  let d = "";
  for (let i = 0; i < 80; i++) {
    const t = (i / 80) * Math.PI * 2;
    const r =
      21 +
      1.5 * Math.sin(11 * t) +
      0.8 * Math.sin(3 * t + 0.6);
    d += `${i === 0 ? "M" : "L"}${(26 + Math.cos(t) * r).toFixed(1)} ${(26 + Math.sin(t) * r).toFixed(1)} `;
  }
  return d + "Z";
}
const SEAL_PATH = sealPathD();

const LINING_STARS: [number, number][] = [
  [30, 20], [60, 48], [95, 22], [130, 70], [160, 30], [190, 88], [225, 28],
  [255, 66], [290, 22], [325, 50], [350, 24], [200, 50], [110, 100], [270, 100],
];

/* ---------- hand-drawn doodles ---------- */

// Every doodle is drawn twice: a flat colour fill, and a thin pen outline on top.
// The fill is nudged a tiny bit sideways so it doesn't line up perfectly, like real gouache.

function Rabbit() {
  const body = "M-24 0 C-31 -16 -24 -33 -4 -35 C12 -36 24 -26 24 -12 C24 -5 21 -1 16 0 Z";
  const ear1 = "M9 -48 C3 -66 9 -78 15 -75 C21 -72 18 -58 18 -50 Z";
  const ear2 = "M17 -50 C16 -66 24 -76 29 -71 C33 -66 26 -56 24 -49 Z";
  const mound =
    "M-36 3 C-30 -4 -10 -7 8 -5 C28 -7 42 -2 40 6 C38 13 12 15 -10 13 C-30 13 -40 9 -36 3 Z";
  return (
    <g>
      <path d={mound} transform="translate(2 1.5)" fill="#f3e6c0" />
      <path d={mound} fill="none" stroke={INK} strokeOpacity="0.55" strokeWidth="1" strokeDasharray="1.5 3.2" strokeLinecap="round" />
      <g transform="translate(1.6 1.2)" fill="#fff8e8">
        <path d={ear1} />
        <path d={ear2} />
        <path d={body} />
        <circle cx="-25" cy="-10" r="4.5" />
        <circle cx="15" cy="-40" r="11" />
      </g>
      <g fill="none" stroke={INK} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.9">
        <path d="M9 -48 C3 -66 9 -78 15 -75 C21 -72 18 -58 18 -50" />
        <path d="M17 -50 C16 -66 24 -76 29 -71 C33 -66 26 -56 24 -49" />
        <path d={body} />
        <circle cx="-25" cy="-10" r="4.5" />
        <circle cx="15" cy="-40" r="11" />
        <path d="M-12 -8 C-4 -22 12 -20 14 -6" strokeOpacity="0.55" />
      </g>
      <circle cx="19.5" cy="-41" r="1.5" fill={INK} />
      <circle cx="25.5" cy="-37.5" r="1.1" fill={INK} />
      <path d="M14 -31 q3 2 6 0" fill="none" stroke={INK} strokeWidth="0.9" strokeLinecap="round" strokeOpacity="0.7" />
    </g>
  );
}

function Fish({ x, y, fill }: { x: number; y: number; fill: string }) {
  const body = "M0 0 C6 -7 16 -7 22 0 C16 7 6 7 0 0 Z";
  const tail = "M21 0 L29 -6 L28 6 Z";
  return (
    <g transform={`translate(${x} ${y})`}>
      <g transform="translate(1.2 1)" fill={fill}>
        <path d={body} />
        <path d={tail} />
      </g>
      <g fill="none" stroke={INK} strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round" strokeOpacity="0.85">
        <path d={body} />
        <path d={tail} />
      </g>
      <circle cx="6" cy="-1.5" r="1" fill={INK} />
      <path d="M11 -3 Q13 0 11 3" fill="none" stroke={INK} strokeWidth="0.8" strokeOpacity="0.6" />
    </g>
  );
}

function DoodleStar({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const d = starD(x, y, r, r * 0.48);
  return (
    <g>
      <path d={d} transform="translate(1.2 1)" fill={fill} />
      <path d={d} fill="none" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" strokeOpacity="0.9" />
    </g>
  );
}

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
          {/* shared "paint effects": wobbly pen lines, paper grain, soft shadow */}
          <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
            <defs>
              <filter id="wobble" filterUnits="userSpaceOnUse" x="-10" y="-10" width="420" height="300" colorInterpolationFilters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="8" result="w" />
                <feDisplacementMap in="SourceGraphic" in2="w" scale="3" xChannelSelector="R" yChannelSelector="G" />
              </filter>
              <filter id="wobbleSm" filterUnits="userSpaceOnUse" x="-10" y="-10" width="420" height="300" colorInterpolationFilters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="3" result="w" />
                <feDisplacementMap in="SourceGraphic" in2="w" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
              </filter>
              <filter id="grainLight" filterUnits="userSpaceOnUse" x="0" y="0" width="400" height="300" colorInterpolationFilters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="5" />
                <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 0.95  2.6 0 0 0 -1.15" />
              </filter>
              <filter id="grainDark" filterUnits="userSpaceOnUse" x="0" y="0" width="400" height="300" colorInterpolationFilters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="11" />
                <feColorMatrix type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.15  0 0 0 0 0.4  2.6 0 0 0 -1.1" />
              </filter>
              <filter id="fibre" filterUnits="userSpaceOnUse" x="0" y="0" width="400" height="300" colorInterpolationFilters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency="0.015 0.35" numOctaves="3" seed="2" />
                <feColorMatrix type="matrix" values="0 0 0 0 0.15  0 0 0 0 0.2  0 0 0 0 0.5  2.2 0 0 0 -0.95" />
              </filter>
              <filter id="softShadow" filterUnits="userSpaceOnUse" x="-20" y="-20" width="420" height="190">
                <feGaussianBlur stdDeviation="3" />
              </filter>
            </defs>
          </svg>

          {/* inside of the envelope */}
          <div ref={backRef} className="absolute inset-0" style={{ zIndex: 1 }}>
            <svg width={ENV_W} height={ENV_H} viewBox={`0 0 ${ENV_W} ${ENV_H}`} aria-hidden="true">
              <rect width={ENV_W} height={ENV_H} rx="4" fill="#2a3a85" />
              {LINING_STARS.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.6 : 1} fill="#ffe9b0" opacity="0.5" />
              ))}
              <rect width={ENV_W} height={ENV_H} filter="url(#grainLight)" opacity="0.25" />
            </svg>
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

          {/* the front of the envelope */}
          <div ref={frontRef} className="absolute inset-0" style={{ zIndex: 3 }}>
            <svg width={ENV_W} height={ENV_H} viewBox={`0 0 ${ENV_W} ${ENV_H}`} aria-hidden="true">
              <defs>
                <clipPath id="frontClip">
                  <path d={FRONT_D} />
                </clipPath>
              </defs>

              {/* flat paper colour */}
              <path d={FRONT_D} fill={PAPER} />

              {/* doodles, drawn with a slightly shaky pen */}
              <g filter="url(#wobble)">
                <g transform="translate(58 218)">
                  <Rabbit />
                </g>
                <DoodleStar x={108} y={131} r={6} fill={CREAM} />
                <DoodleStar x={34} y={68} r={7} fill={CREAM} />
                <DoodleStar x={64} y={104} r={4.5} fill={TEAL} />
                <DoodleStar x={346} y={62} r={6} fill={CREAM} />
                <DoodleStar x={318} y={102} r={4} fill={TEAL} />
                {/* a little moon */}
                <g transform="translate(262 112)">
                  <path d="M0 -9 A9 9 0 1 0 9 6 A7 7 0 1 1 0 -9 Z" transform="translate(1.2 1)" fill={CREAM} />
                  <path d="M0 -9 A9 9 0 1 0 9 6 A7 7 0 1 1 0 -9 Z" fill="none" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" strokeOpacity="0.9" />
                </g>
                {/* a row of little fish, swimming along the bottom */}
                <Fish x={136} y={227} fill="#fff8e8" />
                <Fish x={176} y={227} fill={TEAL} />
                <Fish x={216} y={227} fill="#5a74bd" />
                {/* tiny sparkles and a dotted trail */}
                {([[142, 100, 0.8], [236, 92, 0.65], [20, 150, 0.7], [364, 150, 0.6], [86, 128, 0.5]] as const).map(([x, y, s], i) => (
                  <path key={i} d={SPARK} transform={`translate(${x} ${y}) scale(${s})`} fill={CREAM} fillOpacity="0.9" stroke={INK} strokeWidth="0.8" strokeOpacity="0.5" />
                ))}
                <path d="M92 168 C 100 156, 104 148, 108 140" fill="none" stroke={INK} strokeOpacity="0.55" strokeWidth="1.1" strokeDasharray="1.5 4" strokeLinecap="round" />
              </g>

              {/* the handwritten label: a stepped patch of paint with writing on it */}
              <g filter="url(#wobbleSm)">
                <path
                  d="M126 160 L206 156 L208 169 L268 165 L271 194 L130 198 Z"
                  fill="#5a74bd"
                  stroke={INK}
                  strokeOpacity="0.7"
                  strokeWidth="1.1"
                  strokeLinejoin="round"
                />
              </g>
              <text x="138" y="186" fontSize="18" fill={CREAM} fontFamily={HAND} transform="rotate(-2 138 186)">
                for future me
              </text>
              <text x="132" y="213" fontSize="11" fill={INK} fillOpacity="0.9" fontFamily={HAND}>
                from your younger self ✦
              </text>

              {/* the stamp, with a star in your star's colour */}
              <g transform="translate(298 142)">
                <rect x="0" y="0" width="54" height="66" fill="#fbf3dc" stroke={PAPER} strokeWidth="5" strokeDasharray="0 6" strokeLinecap="round" />
                <rect x="6" y="6" width="42" height="42" rx="2" fill="#1b2a6b" />
                <path d={SPARK} transform="translate(27 27) scale(1.7)" fill={`hsl(${star.hue}, 90%, 85%)`} />
                <text x="27" y="60" fontSize="6" textAnchor="middle" fill="#3a2f1f" letterSpacing="1">
                  STARSTAMP
                </text>
              </g>

              {/* the postmark */}
              <g transform="translate(286 216)" opacity="0.9" filter="url(#wobbleSm)">
                <circle r="21" fill="none" stroke="#1b2a6b" strokeWidth="1.4" strokeDasharray="2 2.5" />
                <circle r="15" fill="none" stroke="#1b2a6b" strokeWidth="1" />
                <text y="2.5" fontSize="6" textAnchor="middle" fill="#1b2a6b">
                  {shortDate}
                </text>
              </g>

              {/* the pen outline around the whole envelope */}
              <path
                d={FRONT_D}
                fill="none"
                stroke={INK}
                strokeOpacity="0.65"
                strokeWidth="1.4"
                strokeLinejoin="round"
                filter="url(#wobble)"
              />

              {/* paper texture on top of everything */}
              <g clipPath="url(#frontClip)" style={{ pointerEvents: "none" }}>
                <rect width={ENV_W} height={ENV_H} filter="url(#fibre)" opacity="0.2" />
                <rect width={ENV_W} height={ENV_H} filter="url(#grainDark)" opacity="0.3" />
                <rect width={ENV_W} height={ENV_H} filter="url(#grainLight)" opacity="0.35" />
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
              <svg width={ENV_W} height={FLAP_H} viewBox={`0 0 ${ENV_W} ${FLAP_H}`} aria-hidden="true" style={{ overflow: "visible" }}>
                <defs>
                  <clipPath id="flapClip">
                    <path d={FLAP_D} />
                  </clipPath>
                </defs>
                {/* soft shadow the flap throws on the envelope */}
                <path d={FLAP_D} transform="translate(0 5)" fill="rgba(20, 30, 90, 0.35)" filter="url(#softShadow)" />
                <path d={FLAP_D} fill={FLAP_PAPER} />
                <g filter="url(#wobble)">
                  <path
                    d="M22 6 L170 107 Q190 121 210 107 L358 6"
                    fill="none"
                    stroke={INK}
                    strokeOpacity="0.45"
                    strokeWidth="1.1"
                    strokeDasharray="1.5 6"
                    strokeLinecap="round"
                  />
                  <DoodleStar x={112} y={36} r={6} fill={CREAM} />
                  <DoodleStar x={272} y={32} r={5} fill={TEAL} />
                  <path d={SPARK} transform="translate(190 30) scale(0.7)" fill={CREAM} stroke={INK} strokeWidth="0.8" strokeOpacity="0.5" />
                </g>
                <path
                  d={FLAP_D}
                  fill="none"
                  stroke={INK}
                  strokeOpacity="0.65"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                  filter="url(#wobble)"
                />
                <g clipPath="url(#flapClip)" style={{ pointerEvents: "none" }}>
                  <rect width={ENV_W} height={FLAP_H} filter="url(#fibre)" opacity="0.2" />
                  <rect width={ENV_W} height={FLAP_H} filter="url(#grainDark)" opacity="0.3" />
                  <rect width={ENV_W} height={FLAP_H} filter="url(#grainLight)" opacity="0.35" />
                </g>
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
                <path d={FLAP_D} fill="#27357f" stroke="rgba(255,233,176,0.35)" strokeWidth="1" strokeLinejoin="round" />
                {LINING_STARS.slice(0, 9).map(([x, y], i) => (
                  <circle key={i} cx={x} cy={Math.min(y, 70) * 0.9} r={i % 3 === 0 ? 1.6 : 1} fill="#ffe9b0" opacity="0.55" />
                ))}
                <path d={FLAP_D} fill="none" stroke={INK} strokeOpacity="0.6" strokeWidth="1.2" strokeLinejoin="round" filter="url(#wobble)" />
              </svg>
            </div>
          </div>

          {/* the wax seal on the flap tip: a flat blob of wax pressed with a little star */}
          <div ref={sealRef} className="absolute" style={{ left: 164, top: 102, width: 52, height: 52, zIndex: 6, opacity: 0 }}>
            <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
              <defs>
                <clipPath id="sealClip">
                  <path d={SEAL_PATH} />
                </clipPath>
              </defs>
              <g filter="url(#wobbleSm)">
                <path d={SEAL_PATH} transform="translate(1.6 2)" fill="rgba(30, 20, 70, 0.4)" />
                <path d={SEAL_PATH} fill="#d3a24c" stroke="#8a5d1c" strokeOpacity="0.8" strokeWidth="1.3" strokeLinejoin="round" />
                <circle cx="26" cy="26" r="14" fill="none" stroke="#8a5d1c" strokeOpacity="0.6" strokeWidth="1.1" strokeDasharray="2.5 2.8" strokeLinecap="round" />
                <path d={starD(26.5, 26.5, 9.5, 4.4)} fill="#a8741f" fillOpacity="0.55" stroke="#6b430f" strokeWidth="1.4" strokeLinejoin="round" />
              </g>
              <g clipPath="url(#sealClip)">
                <rect width="52" height="52" filter="url(#grainDark)" opacity="0.22" />
              </g>
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