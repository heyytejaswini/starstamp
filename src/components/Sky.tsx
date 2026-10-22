"use client";

import { useEffect, useRef } from "react";
import { SKY } from "@/lib/animation/config";
import { loadStars, type MyStar } from "@/lib/stars";

type Star = {
  x: number;
  y: number;
  radius: number;
  depth: number;
  speed: number;
  phase: number;
  color: string;
};

function makeStars(count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    radius: SKY.minRadius + Math.random() * (SKY.maxRadius - SKY.minRadius),
    depth: 0.2 + Math.random() * 0.8,
    speed:
      SKY.twinkleSpeedMin +
      Math.random() * (SKY.twinkleSpeedMax - SKY.twinkleSpeedMin),
    phase: Math.random() * Math.PI * 2,
    color: SKY.colors[Math.floor(Math.random() * SKY.colors.length)],
  }));
}

// A four-pointed sparkle: four curves that pinch toward the center
function drawSparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

// Today's date as "YYYY-MM-DD", in the visitor's own timezone
function todayISO() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

const HIT_RADIUS = 28; // how close (in pixels) a click must be to count

type Props = {
  onStarClick?: (star: MyStar) => void;
};

export default function Sky({ onStarClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Keep the newest click handler in a ref, so the drawing loop never restarts.
  const clickRef = useRef(onStarClick);
  useEffect(() => {
    clickRef.current = onStarClick;
  }, [onStarClick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let frameId = 0;
    const myStars: MyStar[] = loadStars();
    const today = todayISO();
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };

    // Where each of your stars was drawn this frame, so clicks can find them.
    const spots: { star: MyStar; x: number; y: number }[] = [];
    let hovered: MyStar | null = null;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = makeStars(width < 700 ? SKY.starCountMobile : SKY.starCount);
    };

    const handleMove = (e: PointerEvent) => {
      target.x = (e.clientX / width - 0.5) * 2;
      target.y = (e.clientY / height - 0.5) * 2;
    };

    // The closest of your stars to a point, if one is near enough.
    const findStar = (x: number, y: number): MyStar | null => {
      let best: MyStar | null = null;
      let bestDist = HIT_RADIUS * HIT_RADIUS;
      for (const s of spots) {
        const dx = s.x - x;
        const dy = s.y - y;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = s.star;
        }
      }
      return best;
    };

    // Buttons, links, inputs and dialogs on top of the sky keep their own clicks.
    const isInteractive = (t: EventTarget | null) =>
      t instanceof Element &&
      t.closest("a, button, input, textarea, label, [role='dialog']") !== null;

    const handleHover = (e: PointerEvent) => {
      hovered = isInteractive(e.target) ? null : findStar(e.clientX, e.clientY);
      document.documentElement.style.cursor = hovered ? "pointer" : "";
    };

    const handleClick = (e: MouseEvent) => {
      if (isInteractive(e.target)) return;
      const star = findStar(e.clientX, e.clientY);
      if (star) clickRef.current?.(star);
    };

    const draw = (time: number) => {
      const t = time / 1000;
      current.x += (target.x - current.x) * SKY.parallaxEase;
      current.y += (target.y - current.y) * SKY.parallaxEase;

      ctx.clearRect(0, 0, width, height);

      for (const s of stars) {
        const px = s.x * width - current.x * SKY.parallaxStrength * s.depth;
        const py = s.y * height - current.y * SKY.parallaxStrength * s.depth;
        const twinkle = reduceMotion
          ? 0.8
          : 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
        ctx.globalAlpha = twinkle * (0.4 + 0.6 * s.depth);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(px, py, s.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // your own stars: bigger, glowing and gently pulsing
      spots.length = 0;
      for (const m of myStars) {
        const px = m.x * width - current.x * SKY.parallaxStrength;
        const py = m.y * height - current.y * SKY.parallaxStrength;
        spots.push({ star: m, x: px, y: py });

        const ready = m.openOn !== "" && m.openOn <= today;
        const isHover = hovered !== null && hovered.id === m.id;
        const pulse = reduceMotion ? 1 : 1 + 0.15 * Math.sin(t * 1.5 + m.x * 10);
        const r = 9 * pulse * (isHover ? 1.3 : 1);

        const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
        glow.addColorStop(0, `hsla(${m.hue}, 90%, 82%, 0.55)`);
        glow.addColorStop(1, `hsla(${m.hue}, 90%, 82%, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, r * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `hsl(${m.hue}, 90%, 88%)`;
        drawSparkle(ctx, px, py, r);

        // a soft pulsing ring tells you this letter is ready to open
        if (ready) {
          const ring = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * 2 + m.y * 10);
          ctx.strokeStyle = `hsla(${m.hue}, 90%, 85%, ${0.25 + 0.45 * ring})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(px, py, r * 2 + ring * 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      frameId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    if (!reduceMotion) window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointermove", handleHover);
    window.addEventListener("click", handleClick);
    frameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointermove", handleHover);
      window.removeEventListener("click", handleClick);
      document.documentElement.style.cursor = "";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-0"
      style={{
        background: "linear-gradient(to bottom, #0b1026, #1b2a6b 60%, #3a4f9c)",
      }}
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}