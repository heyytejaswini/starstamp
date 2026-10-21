"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import gsap from "gsap";
import { DESK } from "@/lib/animation/config";
import { addStar, saveLetter, starFromId } from "@/lib/stars";
import { getSupabase } from "@/lib/supabase/client";

type Charm = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number; // frames left
  maxLife: number;
  gravityScale: number; // 1 = normal fall, smaller = floatier
};

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function Lamp() {
  return (
    <svg width="90" height="180" viewBox="0 0 120 240" aria-hidden="true">
      <defs>
        <linearGradient id="lampCone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe9b0" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffe9b0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M42 96 L78 96 L112 232 L8 232 Z" fill="url(#lampCone)" />
      <ellipse cx="60" cy="228" rx="34" ry="7" fill="#2b3170" />
      <line
        x1="60"
        y1="228"
        x2="60"
        y2="96"
        stroke="#cfd6ff"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M30 92 L90 92 L76 52 L44 52 Z" fill="#e8ecff" />
      <circle cx="60" cy="97" r="6" fill="#ffe9b0" />
    </svg>
  );
}

export default function Desk() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [openOn, setOpenOn] = useState("");
  const [sealing, setSealing] = useState(false);
  //new add ons for supabase connnection -  day 3
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState("");
  // null = still checking, true = signed in, false = signed out
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  // "" on the server, tomorrow's date in the browser.
  // (useSyncExternalStore means no setState inside an effect.)
  const minDate = useSyncExternalStore(
    () => () => {},
    tomorrowISO,
    () => ""
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lampRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLTextAreaElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const starRef = useRef<HTMLSpanElement>(null);
  const charmsRef = useRef<Charm[]>([]);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  // Clean slate when the desk appears; reset everything when it leaves.
  // The state resets live in the cleanup function (allowed), not the effect body.
    useEffect(() => {
    const paper = paperRef.current;
    const ink = inkRef.current;
    const lamp = lampRef.current;
    const controls = controlsRef.current;
    const star = starRef.current;

    // only clear what the animation changes, so the paper colour and ruled lines stay
    const resetLook = () => {
      gsap.set([paper, lamp, controls], {
        clearProps: "transform,opacity,boxShadow",
      });
      gsap.set(ink, { clearProps: "opacity" });
    };

    resetLook();
    gsap.set(star, { opacity: 0, scale: 0 });
    charmsRef.current = [];

    return () => {
      timelineRef.current?.kill();
      resetLook();
      charmsRef.current = [];
      setText("");
      setOpenOn("");
      setSealing(false);
      setIsPublic(false);
      setError("");
    };
  }, []);

  // are we signed in? (the answer arrives a moment later)
  useEffect(() => {
    let alive = true;
    getSupabase()
      .auth.getUser()
      .then(({ data }) => {
        if (alive) setSignedIn(Boolean(data.user));
      });
    return () => {
      alive = false;
    };
  }, []);
  // the loop that moves and draws the charms (typing charms + sealing sparkles)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frameId = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const charms = charmsRef.current;
      for (let i = charms.length - 1; i >= 0; i--) {
        const c = charms[i];
        c.vy += DESK.gravity * c.gravityScale;
        c.x += c.vx;
        c.y += c.vy;
        c.life -= 1;
        if (c.life <= 0) {
          charms.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.min(1, c.life / (c.maxLife * 0.4));
        ctx.fillStyle = "#ffe9b0";
        ctx.font = `${c.size}px serif`;
        ctx.fillText("✦", c.x, c.y);
      }
      ctx.globalAlpha = 1;
      frameId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    frameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const spawnCharms = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lamp = lampRef.current;
    if (!lamp) return;
    const r = lamp.getBoundingClientRect();
    for (let i = 0; i < DESK.charmsPerKey; i++) {
      const maxLife =
        DESK.lifeMin + Math.random() * (DESK.lifeMax - DESK.lifeMin);
      charmsRef.current.push({
        x: r.left + r.width * 0.5 + (Math.random() - 0.5) * r.width * 0.4,
        y: r.top + r.height * 0.42,
        vx: (Math.random() - 0.5) * 0.6,
        vy: Math.random() * 0.5,
        size: 10 + Math.random() * 12,
        life: maxLife,
        maxLife,
        gravityScale: 1,
      });
    }
  };

  // a soft burst of sparkles that drift and sink slowly (used while sealing)
  const burst = (x: number, y: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3.5;
      const maxLife = 60 + Math.random() * 50;
      charmsRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        size: 8 + Math.random() * 14,
        life: maxLife,
        maxLife,
        gravityScale: 0.25,
      });
    }
  };

  // one tiny sparkle left behind the flying star
  const trail = (x: number, y: number) => {
    const maxLife = 40 + Math.random() * 25;
    charmsRef.current.push({
      x: x + (Math.random() - 0.5) * 16,
      y: y + (Math.random() - 0.5) * 16,
      vx: (Math.random() - 0.5) * 0.4,
      vy: Math.random() * 0.3,
      size: 6 + Math.random() * 8,
      life: maxLife,
      maxLife,
      gravityScale: 0.15,
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    if (next.length > text.length) spawnCharms();
    setText(next);
  };

    const canSeal =
    !sealing && signedIn === true && text.trim().length > 0 && openOn !== "";

    const seal = async () => {
    if (!canSeal) return;
    setSealing(true);
    setError("");

    const star = starFromId(crypto.randomUUID(), openOn);

    try {
      await saveLetter({ star, body: text, isPublic });
    } catch (err) {
      setSealing(false);
      setError(
        err instanceof Error ? err.message : "Could not save your letter."
      );
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      addStar(star);
      router.push("/");
      return;
    }

    const paper = paperRef.current;
    const ink = inkRef.current;
    const starEl = starRef.current;
    if (!paper || !ink || !starEl) return;

    // centre of the paper (we never move the paper, so the star starts exactly here)
    const pr = paper.getBoundingClientRect();
    const cx = pr.left + pr.width / 2;
    const cy = pr.top + pr.height / 2;
    // where the star will live in the sky
    const tx = star.x * window.innerWidth;
    const ty = star.y * window.innerHeight;

    gsap.set(starEl, {
      left: cx,
      top: cy,
      xPercent: -50,
      yPercent: -50,
      x: 0,
      y: 0,
      rotate: 0,
      scale: 0,
      opacity: 0,
      color: `hsl(${star.hue}, 90%, 85%)`,
    });

    const tl = gsap.timeline({
      onComplete: () => {
        addStar(star);
        router.push("/");
      },
    });
    timelineRef.current = tl;

    // 1) hush: lamp, date and button drift away; the ink fades; the paper glows
    tl.to(
      [controlsRef.current, lampRef.current],
      { opacity: 0, y: 14, duration: 0.5, ease: "power2.in" },
      0
    )
      .to(ink, { opacity: 0, duration: 0.4, ease: "power1.out" }, 0.1)
      .to(
        paper,
        {
          boxShadow: "0 0 60px 14px rgba(255, 233, 176, 0.5)",
          duration: 0.7,
          ease: "sine.out",
        },
        0.1
      )
      // 2) fold in half, then fold into a little glowing diamond
      .to(paper, { scaleY: 0.45, duration: 0.5, ease: "power2.inOut" }, 0.8)
      .to(
        paper,
        {
          scaleX: 0.2,
          scaleY: 0.2,
          rotate: 45,
          duration: 0.6,
          ease: "power3.in",
        },
        1.3
      )
      // 3) the paper winks out and the star blooms in the same spot
      .to(paper, { opacity: 0, duration: 0.12 }, 1.85)
      .call(() => burst(cx, cy, 34), [], 1.9)
      .to(
        starEl,
        { scale: 1.3, opacity: 1, duration: 0.7, ease: "back.out(2.2)" },
        1.9
      )
      // 4) a slow, floaty flight: x and y use different eases so the path curves
      .to(
        starEl,
        {
          x: tx - cx,
          duration: 1.9,
          ease: "power2.inOut",
          onUpdate: () => {
            const r = starEl.getBoundingClientRect();
            trail(r.left + r.width / 2, r.top + r.height / 2);
          },
        },
        2.7
      )
      .to(starEl, { y: ty - cy, duration: 1.9, ease: "power3.inOut" }, 2.7)
      .to(
        starEl,
        { rotate: 360, scale: 0.6, duration: 1.9, ease: "sine.inOut" },
        2.7
      )
      // 5) settle into the sky
      .call(() => burst(tx, ty, 14), [], 4.6)
      .to(starEl, { opacity: 0, duration: 0.25 }, 4.6);
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-20"
      />
      <span
        ref={starRef}
        className="pointer-events-none fixed z-30 block"
        style={{ opacity: 0 }}
      >
        <svg
          width="56"
          height="56"
          viewBox="0 0 24 24"
          style={{ filter: "drop-shadow(0 0 10px currentColor)" }}
        >
          <path
            d="M12 1 L14.9 9.1 L23 12 L14.9 14.9 L12 23 L9.1 14.9 L1 12 L9.1 9.1 Z"
            fill="currentColor"
          />
        </svg>
      </span>

      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-6">
        <div className="flex w-full max-w-130 flex-col items-end">
          <div ref={lampRef} className="-mb-5 mr-6">
            <Lamp />
          </div>

          <div
            ref={paperRef}
            className="w-full rounded-sm p-6 shadow-2xl"
            style={{ background: "#fbf6e9", color: "#2b2b3a" }}
          >
            <textarea
              ref={inkRef}
              value={text}
              onChange={handleChange}
              readOnly={sealing}
              maxLength={5000}
              placeholder="Dear future me,"
              aria-label="Your letter"
              className="h-72 w-full resize-none bg-transparent outline-none"
              style={{
                lineHeight: "32px",
                fontFamily: "'Segoe Print', 'Bradley Hand', cursive",
                backgroundImage:
                  "repeating-linear-gradient(transparent, transparent 31px, #c9d3f0 31px, #c9d3f0 32px)",
              }}
            />
          </div>

          <div
            ref={controlsRef}
            className="mt-4 flex w-full flex-wrap items-center justify-between gap-3"
          >
            <label
              className="flex items-center gap-2 text-sm"
              style={{ color: "rgba(220, 230, 255, 0.85)" }}
            >
              Open on
              <input
                type="date"
                value={openOn}
                min={minDate}
                onChange={(e) => setOpenOn(e.target.value)}
                className="rounded px-2 py-1"
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  colorScheme: "dark",
                }}
              />
            </label>
            <button
              type="button"
              onClick={seal}
              disabled={!canSeal}
              className="rounded-full px-6 py-2 text-sm uppercase tracking-[0.2em] disabled:opacity-40"
              style={{ background: "#ffe9b0", color: "#1b2a6b" }}
            >
              Seal with a star
            </button>
                        <label
              className="flex w-full items-center gap-2 text-sm"
              style={{ color: "rgba(220, 230, 255, 0.85)" }}
            >
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              Let this open for everyone as a star in the shared sky
            </label>
            {signedIn === false && (
              <p className="w-full text-sm" style={{ color: "#ffe9b0" }}>
                Please{" "}
                <Link href="/signin" className="underline">
                  sign in
                </Link>{" "}
                first so your star can be saved.
              </p>
            )}
            {error && (
              <p className="w-full text-sm" style={{ color: "#ffb4b4" }}>
                {error}
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}