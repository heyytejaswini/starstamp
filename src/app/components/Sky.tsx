"use client";

import { useEffect, useRef } from "react";
import { SKY } from "@/app/lib/animation/config";

type Star = {
  x: number; // 0 to 1 across the screen
  y: number; // 0 to 1 down the screen
  radius: number;
  depth: number; // 0.2 (far away) to 1 (close), controls parallax
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

export default function Sky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    const target = { x: 0, y: 0 }; // where the mouse is, from -1 to 1
    const current = { x: 0, y: 0 }; // where the sky has drifted to so far

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
      frameId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    if (!reduceMotion) window.addEventListener("pointermove", handleMove);
    frameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handleMove);
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