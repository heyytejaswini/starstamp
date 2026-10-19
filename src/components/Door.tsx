"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { DOOR } from "@/lib/animation/config";

export default function Door({ onOpened }: { onOpened: () => void }) {
  const leftRef = useRef<HTMLSpanElement>(null);
  const rightRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      timelineRef.current?.kill();
    };
  }, []);

  const open = () => {
    if (busy) return;
    setBusy(true);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onOpened();
      return;
    }

    const tl = gsap.timeline({ onComplete: onOpened });
    timelineRef.current = tl;

    tl.to(hintRef.current, { opacity: 0, duration: 0.3 })
      .to(
        glowRef.current,
        { opacity: 1, scaleX: 6, duration: DOOR.glowDuration, ease: "power2.out" },
        "<"
      )
      .to(
        leftRef.current,
        { xPercent: -100, duration: DOOR.openDuration, ease: DOOR.ease },
        ">-0.1"
      )
      .to(
        rightRef.current,
        { xPercent: 100, duration: DOOR.openDuration, ease: DOOR.ease },
        "<"
      )
      .to(glowRef.current, { opacity: 0, duration: 0.6 }, "<0.4");
  };

  const panel = {
    background: "linear-gradient(135deg, #10143a, #222a63)",
  };
  const knob = {
    background: "#ffe9b0",
    boxShadow: "0 0 12px 2px rgba(255, 220, 150, 0.7)",
  };

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Open the door"
      className="fixed inset-0 z-20 flex cursor-pointer overflow-hidden"
    >
      <span ref={leftRef} className="relative block h-full w-1/2" style={panel}>
        <span
          className="absolute top-1/2 block h-4 w-4 rounded-full"
          style={{ ...knob, right: 24 }}
        />
      </span>
      <span ref={rightRef} className="relative block h-full w-1/2" style={panel}>
        <span
          className="absolute top-1/2 block h-4 w-4 rounded-full"
          style={{ ...knob, left: 24 }}
        />
      </span>
      <span
        ref={glowRef}
        className="absolute top-0 block h-full"
        style={{
          left: "calc(50% - 1px)",
          width: 2,
          background: "#ffe9b0",
          boxShadow: "0 0 30px 10px rgba(255, 220, 150, 0.8)",
          opacity: 0.35,
        }}
      />
      <span ref={hintRef} className="absolute bottom-16 left-0 block w-full text-center">
        <span
          className="animate-pulse text-sm uppercase tracking-[0.3em]"
          style={{ color: "rgba(255, 236, 200, 0.75)" }}
        >
          tap to open
        </span>
      </span>
    </button>
  );
}