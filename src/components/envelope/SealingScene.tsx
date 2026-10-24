"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import gsap from "gsap";
import type { EnvelopeOptions } from "@/lib/envelope";
import {
  ENV_H,
  ENV_W,
  GROUP_OFFSET_Y,
  PAPER,
  morphPathD,
} from "./art";
import {
  EnvelopeBack,
  EnvelopeDefs,
  EnvelopeFlap,
  EnvelopeFront,
  SEAL_BOX,
  WaxSeal,
} from "./Envelope";

/* What Desk.tsx can ask this scene to do:  await sceneRef.current?.play({...}) */
export type SealSceneHandle = {
  play: (args: {
    envelope: EnvelopeOptions;
    openOn: string;
    hue: number;
    target: { x: number; y: number }; // where the new star will sit on screen
  }) => Promise<void>;
};

type Job = {
  envelope: EnvelopeOptions;
  openOn: string;
  hue: number;
  createdAt: number;
  target: { x: number; y: number };
  fit: number;
  paper: { node: HTMLElement; w: number; h: number; cx: number; cy: number };
};

const MORPH_END = morphPathD(1);
const STAR_END = 0.075; // the star is about 18px wide when it settles in the sky

// Copy the paper the person wrote on into a plain element we can fold.
// (A <textarea> can't be cloned with its text, so it becomes a <div> with the same look.)
function clonePaper(paper: HTMLElement) {
  const clone = paper.cloneNode(true) as HTMLElement;
  const originals = paper.querySelectorAll("textarea");
  clone.querySelectorAll("textarea").forEach((ta, i) => {
    const src = originals[i];
    const cs = getComputedStyle(src);
    const div = document.createElement("div");
    div.textContent = src.value;
    div.style.cssText =
      `font:${cs.font};color:${cs.color};line-height:${cs.lineHeight};padding:${cs.padding};` +
      `background:${cs.background};white-space:pre-wrap;overflow:hidden;` +
      `width:${src.clientWidth}px;height:${src.clientHeight}px;box-sizing:border-box;`;
    ta.replaceWith(div);
  });
  // anything else the person could type into or press is not part of the letter
  clone.querySelectorAll("input, button, select, label").forEach((el) => el.remove());
  return clone;
}

const SealingScene = forwardRef<SealSceneHandle>(function SealingScene(_props, ref) {
  const [job, setJob] = useState<Job | null>(null);
  const resolveRef = useRef<(() => void) | null>(null);

  const backdropRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const flapWrapRef = useRef<HTMLDivElement>(null);
  const sealRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const sparksRef = useRef<HTMLDivElement>(null);
  const letterRef = useRef<HTMLDivElement>(null);
  const creaseRef = useRef<HTMLDivElement>(null);
  const morphRef = useRef<HTMLDivElement>(null);
  const morphPathRef = useRef<SVGPathElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    play: ({ envelope, openOn, hue, target }) =>
      new Promise<void>((resolve) => {
        const paper = document.querySelector<HTMLElement>("[data-paper]");
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!paper || reduce) {
          resolve();
          return;
        }
        const fit = Math.round(Math.min(1, (window.innerWidth - 24) / ENV_W, (window.innerHeight - 40) / 520) * 100) / 100;
        const r = paper.getBoundingClientRect();
        // paper's centre, in scene units (the scene's middle is the middle of the envelope)
        const cx0 = window.innerWidth / 2;
        const cy0 = window.innerHeight / 2 + GROUP_OFFSET_Y * fit;
        const node = clonePaper(paper);
        resolveRef.current = resolve;
        const original = paper;
        original.dataset.sealing = "1";
        setJob({
          envelope,
          openOn,
          hue,
          target,
          fit,
          createdAt: Date.now(),
          paper: {
            node,
            w: r.width,
            h: r.height,
            cx: (r.left + r.width / 2 - cx0) / fit + ENV_W / 2,
            cy: (r.top + r.height / 2 - cy0) / fit + ENV_H / 2,
          },
        });
      }),
  }));

  // Build and run the whole sealing animation when a job starts.
  useEffect(() => {
    if (!job) return;
    const backdrop = backdropRef.current;
    const back = backRef.current;
    const front = frontRef.current;
    const flapWrap = flapWrapRef.current;
    const seal = sealRef.current;
    const ring = ringRef.current;
    const sparksBox = sparksRef.current;
    const letter = letterRef.current;
    const crease = creaseRef.current;
    const morph = morphRef.current;
    const morphPathEl = morphPathRef.current;
    if (!backdrop || !back || !front || !flapWrap || !seal || !ring || !sparksBox) return;
    if (!letter || !crease || !morph || !morphPathEl || !fxRef.current) return;

    const flap = flapWrap.querySelector<HTMLElement>("[data-flap]")!;
    const faces = Array.from(flapWrap.querySelectorAll<HTMLElement>("[data-face]"));
    const fx = fxRef.current!;
    const sparks = Array.from(sparksBox.children);
    const parts = [back, front, ...faces];
    const { w, h, cx, cy, node } = job.paper;

    // put the copy of the letter inside its holder
    letter.prepend(node); // first, so the crease lines sit on top of it
    node.style.margin = "0";
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    node.style.opacity = "1";

    // the folded letter: this big, resting in the pocket
    const foldW = 290;
    const foldH = 150;
    const pocketX = ENV_W / 2;
    const pocketY = 78;
    const liftY = -52;
    // where the star must end up, measured from the middle of the envelope, in scene units
    const dx = (job.target.x - window.innerWidth / 2) / job.fit;
    const dy = (job.target.y - (window.innerHeight / 2 + GROUP_OFFSET_Y * job.fit)) / job.fit;
    let timer = 0;

    const ctx = gsap.context(() => {
      // where everything starts
      gsap.set(letter, {
        left: cx - w / 2,
        top: cy - h / 2,
        width: w,
        height: h,
        scaleX: 1 / job.fit,
        scaleY: 1 / job.fit,
        zIndex: 5,
        transformOrigin: "50% 50%",
        opacity: 1,
      });
      gsap.set(parts, { opacity: 0 });
      gsap.set(flap, { rotationX: -180 });
      gsap.set(flapWrap, { zIndex: 1 }); // open flap sits BEHIND the letter
      gsap.set(seal, { opacity: 0 });
      gsap.set(ring, { opacity: 0 });
      gsap.set(sparks, { opacity: 0 });
      gsap.set(morph, { opacity: 0, x: 0, y: 0, scale: 1, rotation: 0 });
      gsap.set(crease, { opacity: 0 });
      morphPathEl.setAttribute("d", MORPH_END);
      morphPathEl.setAttribute("fill", PAPER);

      const k = { v: 1 };
      let frame = 0;

      // sparkle helpers: they borrow the little ✦ pieces from the fx layer
      const trailBits = Array.from(fx.querySelectorAll<HTMLElement>("[data-trail]"));
      const burstBits = Array.from(fx.querySelectorAll<HTMLElement>("[data-burst]"));
      let trailAt = 0;
      const dropTrail = (x: number, y: number) => {
        const bit = trailBits[trailAt++ % trailBits.length];
        gsap.fromTo(
          bit,
          { x: x + (Math.random() - 0.5) * 22, y: y + (Math.random() - 0.5) * 22, opacity: 0.95, scale: 0.6 + Math.random() * 0.8 },
          { y: `+=${14 + Math.random() * 14}`, opacity: 0, scale: 0.2, duration: 0.9, ease: "power1.out", overwrite: true }
        );
      };
      const burstAt = (x: number, y: number, n: number, reach: number) => {
        burstBits.slice(0, n).forEach((bit, i) => {
          const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
          const r = reach * (0.6 + Math.random() * 0.6);
          gsap.fromTo(
            bit,
            { x, y, opacity: 1, scale: 0.5 },
            { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, opacity: 0, scale: 1.1, duration: 0.9, ease: "power2.out", overwrite: true }
          );
        });
      };
      gsap.set([...trailBits, ...burstBits], { opacity: 0 });
      const tl = gsap.timeline();
      tl.timeScale(1.3);

      tl.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0)
        // 1. the letter folds in half, then in half again
        .to(node.children, { opacity: 0, duration: 0.4 }, 0)
        .set(node, { backgroundImage: "none" }, 0.2)
        .to([letter, node], { backgroundColor: "#f3ead2", duration: 0.5 }, 0)
        .to(crease, { opacity: 1, duration: 0.4 }, 0.2)
        .to(letter, { scaleY: foldH / h, duration: 0.8, ease: "power2.inOut" }, 0.5)
        .to(letter, { scaleX: foldW / w, duration: 0.7, ease: "power2.inOut" }, 1.3)
        // 2. the envelope fades in, flap open
        .to(parts, { opacity: 1, duration: 0.6, ease: "power1.out" }, 0.9)
        // 3. the folded letter lifts, then slips into the pocket (between the back and the front)
        .to(letter, { x: pocketX - cx, y: liftY - cy, duration: 0.8, ease: "power2.inOut" }, 2.0)
        .set(letter, { zIndex: 2 }, 2.85)
        .to(letter, { y: pocketY - cy, duration: 0.7, ease: "power2.inOut" }, 2.9)
        // 4. the flap closes
        .to(flap, { rotationX: 0, duration: 0.9, ease: "power2.inOut" }, 3.7)
        .set(flapWrap, { zIndex: 4 }, 4.15) // closed flap sits in FRONT of the letter
        // 5. the wax seal presses on, with a ring of light and sparkles
        .fromTo(seal, { scale: 1.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2)" }, 4.7)
        .fromTo(ring, { scale: 0.5, opacity: 0.9 }, { scale: 2.4, opacity: 0, duration: 0.7, ease: "power2.out" }, 4.85)
        .fromTo(
          sparks,
          { x: 0, y: 0, scale: 0.4, opacity: 1 },
          {
            x: (i: number) => Math.cos((i / 8) * Math.PI * 2) * 62,
            y: (i: number) => Math.sin((i / 8) * Math.PI * 2) * 62,
            scale: 1.2,
            opacity: 0,
            duration: 0.8,
            ease: "power2.out",
          },
          4.85
        )
        // 6. the sealed envelope lifts off and flies to the sky, turning into a star on the way
        //    (the same morph as when a star opens, played the other way round)
        .to([...parts, seal, letter], { opacity: 0, duration: 0.3 }, 5.5)
        .to(morph, { opacity: 1, duration: 0.3 }, 5.5)
        .to(backdrop, { opacity: 0, duration: 1.4, ease: "power1.inOut" }, 5.8)
        .to(
          k,
          { v: 0, duration: 1.5, ease: "power2.inOut", onUpdate: () => morphPathEl.setAttribute("d", morphPathD(k.v)) },
          5.6
        )
        .to(morphPathEl, { fill: `hsl(${job.hue}, 90%, 82%)`, duration: 1.5, ease: "power2.inOut" }, 5.6)
        .to(
          morph,
          {
            x: dx,
            duration: 1.8,
            ease: "power2.inOut",
            onUpdate: () => {
              frame += 1;
              if (frame % 2 === 0) dropTrail(Number(gsap.getProperty(morph, "x")), Number(gsap.getProperty(morph, "y")));
            },
          },
          5.6
        )
        .to(morph, { y: dy, duration: 1.8, ease: "power3.inOut" }, 5.6)
        .to(morph, { rotation: 72, scale: STAR_END, duration: 1.8, ease: "power2.inOut" }, 5.6)
        // 7. it lands: sparkles and a happy pulse, then it rests in the sky
        .call(() => burstAt(dx, dy, 12, 34), [], 7.35)
        .to(morph, { scale: STAR_END * 1.5, duration: 0.2, ease: "power2.out" }, 7.35)
        .to(morph, { scale: STAR_END, duration: 0.4, ease: "elastic.out(1, 0.5)" }, 7.55)
        .to(morph, { opacity: 0, duration: 0.35 }, 8.0);

      tl.eventCallback("onComplete", () => {
        resolveRef.current?.();
        resolveRef.current = null;
        timer = window.setTimeout(() => {
          const p = document.querySelector<HTMLElement>("[data-sealing]");
          if (p) delete p.dataset.sealing;
          setJob(null);
        }, 1500);
      });
    });

    return () => {
      window.clearTimeout(timer);
      ctx.revert();
      // Next.js can keep this page alive in the background and bring it back later.
      // Clearing the job here means the animation can never replay by itself.
      setJob(null);
      resolveRef.current?.(); // never leave the desk waiting
      resolveRef.current = null;
      document.querySelectorAll<HTMLElement>("[data-sealing]").forEach((p) => delete p.dataset.sealing);
    };
  }, [job]);

  if (!job) return null;
  const { envelope, fit } = job;
  const meta = { createdAt: job.createdAt, openOn: job.openOn };

  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      {/* hides the real paper while its copy folds (the desk sets data-sealing on it) */}
      <style>{`[data-paper][data-sealing]{visibility:hidden}`}</style>
      <EnvelopeDefs />
      <div ref={backdropRef} className="absolute inset-0" style={{ background: "rgba(5,8,22,.72)", opacity: 0 }} />

      <div
        className="absolute left-1/2"
        style={{
          top: `calc(50% + ${GROUP_OFFSET_Y * fit}px)`,
          width: ENV_W,
          height: ENV_H,
          transform: `translate(-50%, -50%) scale(${fit})`,
        }}
      >
        <div className="absolute inset-0" style={{ perspective: 900, isolation: "isolate" }}>
          <div ref={backRef} className="absolute inset-0" style={{ zIndex: 1 }}>
            <EnvelopeBack />
          </div>

          {/* the folded letter: a copy of the paper the person wrote on */}
          <div
            ref={letterRef}
            className="absolute overflow-hidden"
            style={{ borderRadius: 4, boxShadow: "0 6px 16px rgba(0,0,0,.35)", background: "#fbf6e9" }}
          >
            <div
              ref={creaseRef}
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, transparent 32%, rgba(120,100,60,.35) 33%, transparent 34%, transparent 65%, rgba(120,100,60,.35) 66%, transparent 67%)," +
                  "linear-gradient(to right, transparent 49%, rgba(120,100,60,.3) 50%, transparent 51%)",
              }}
            />
          </div>

          <div ref={frontRef} className="absolute inset-0" style={{ zIndex: 3 }}>
            <EnvelopeFront options={envelope} meta={meta} />
          </div>

          <div ref={flapWrapRef} className="absolute inset-0" style={{ zIndex: 4, perspective: 900 }}>
            <EnvelopeFlap />
          </div>

          <div ref={sealRef} className="absolute" style={{ zIndex: 6, ...SEAL_BOX, opacity: 0 }}>
            <WaxSeal options={envelope} />
          </div>
          <div
            ref={ringRef}
            className="absolute rounded-full"
            style={{ zIndex: 6, left: 164, top: 102, width: 52, height: 52, border: "2px solid #ffe9b0", opacity: 0 }}
          />
          <div ref={sparksRef} className="pointer-events-none absolute" style={{ left: 190, top: 128, zIndex: 7 }}>
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="absolute" style={{ marginLeft: -6, marginTop: -8, fontSize: 12, color: "#ffe9b0", opacity: 0 }}>
                ✦
              </span>
            ))}
          </div>
        </div>

        {/* sparkles: a pool of little stars the animation borrows for trails and bursts */}
        <div ref={fxRef} className="pointer-events-none absolute" style={{ left: ENV_W / 2, top: ENV_H / 2, zIndex: 10 }}>
          {Array.from({ length: 30 }, (_, i) => (
            <span key={`t${i}`} data-trail className="absolute" style={{ marginLeft: -7, marginTop: -9, fontSize: 14, color: "#ffe9b0", opacity: 0 }}>
              ✦
            </span>
          ))}
          {Array.from({ length: 14 }, (_, i) => (
            <span key={`b${i}`} data-burst className="absolute" style={{ marginLeft: -7, marginTop: -9, fontSize: 15, color: "#fff3cf", opacity: 0 }}>
              ✦
            </span>
          ))}
        </div>

        {/* the envelope turning back into a star */}
        <div
          ref={morphRef}
          className="absolute"
          style={{ left: ENV_W / 2 - 300, top: ENV_H / 2 - 300, width: 600, height: 600, opacity: 0, zIndex: 9 }}
        >
          <svg width="600" height="600" viewBox="-300 -300 600 600" style={{ overflow: "visible", filter: "drop-shadow(0 0 18px rgba(255,233,176,.8))" }}>
            <path ref={morphPathRef} d={MORPH_END} fill={PAPER} />
          </svg>
        </div>
      </div>
    </div>
  );
});

export default SealingScene;
