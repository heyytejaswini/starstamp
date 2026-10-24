"use client";

import type { CSSProperties } from "react";
import type { EnvelopeOptions } from "@/lib/envelope";
import {
  ENV_W,
  ENV_H,
  FLAP_H,
  DEFS_INNER,
  backInner,
  frontInner,
  flapOuterInner,
  flapInnerInner,
  sealInner,
  type EnvelopeMeta,
} from "./art";

/* Each piece below is one <svg> whose insides come from art.ts.
   dangerouslySetInnerHTML just means "put this SVG text inside the tag as it is". */

// The paint effects (wobbly pen, grain, worn ink). Render this ONCE on any screen that draws an envelope.
export function EnvelopeDefs() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute" }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: DEFS_INNER }}
    />
  );
}

export function EnvelopeBack() {
  return (
    <svg
      width={ENV_W}
      height={ENV_H}
      viewBox={`0 0 ${ENV_W} ${ENV_H}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: backInner() }}
    />
  );
}

export function EnvelopeFront({ options, meta }: { options: EnvelopeOptions; meta: EnvelopeMeta }) {
  return (
    <svg
      width={ENV_W}
      height={ENV_H}
      viewBox={`0 0 ${ENV_W} ${ENV_H}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: frontInner(options, meta) }}
    />
  );
}

// The flap has two faces (outside and lining). Never fade the flap itself: fade the faces.
export function EnvelopeFlap({ style }: { style?: CSSProperties }) {
  const face: CSSProperties = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };
  return (
    <div
      data-flap
      className="absolute left-0 top-0"
      style={{
        width: ENV_W,
        height: FLAP_H,
        transformStyle: "preserve-3d",
        transformOrigin: "50% 0%",
        ...style,
      }}
    >
      <div data-face className="absolute inset-0" style={face}>
        <svg
          width={ENV_W}
          height={FLAP_H}
          viewBox={`0 0 ${ENV_W} ${FLAP_H}`}
          aria-hidden="true"
          style={{ overflow: "visible" }}
          dangerouslySetInnerHTML={{ __html: flapOuterInner() }}
        />
      </div>
      <div data-face className="absolute inset-0" style={{ ...face, transform: "rotateY(180deg)" }}>
        <svg
          width={ENV_W}
          height={FLAP_H}
          viewBox={`0 0 ${ENV_W} ${FLAP_H}`}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: flapInnerInner() }}
        />
      </div>
    </div>
  );
}

export function WaxSeal({ options }: { options: EnvelopeOptions }) {
  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 52 52"
      aria-hidden="true"
      style={{ overflow: "visible" }}
      dangerouslySetInnerHTML={{ __html: sealInner(options.seal) }}
    />
  );
}

// The seal sits on the tip of the flap (centre = 190, 128 in envelope units)
export const SEAL_BOX = { left: 164, top: 102, width: 52, height: 52 };

// A small, closed envelope for previews (the picker uses this)
export function EnvelopeClosed({
  options,
  meta,
  scale = 1,
}: {
  options: EnvelopeOptions;
  meta: EnvelopeMeta;
  scale?: number;
}) {
  return (
    <div style={{ width: ENV_W * scale, height: ENV_H * scale, position: "relative" }}>
      <div
        style={{
          width: ENV_W,
          height: ENV_H,
          position: "absolute",
          left: 0,
          top: 0,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          isolation: "isolate",
        }}
      >
        <div className="absolute inset-0" style={{ zIndex: 1 }}>
          <EnvelopeBack />
        </div>
        <div className="absolute inset-0" style={{ zIndex: 3 }}>
          <EnvelopeFront options={options} meta={meta} />
        </div>
        <div className="absolute" style={{ zIndex: 4, left: 0, top: 0 }}>
          <svg
            width={ENV_W}
            height={FLAP_H}
            viewBox={`0 0 ${ENV_W} ${FLAP_H}`}
            aria-hidden="true"
            style={{ overflow: "visible" }}
            dangerouslySetInnerHTML={{ __html: flapOuterInner() }}
          />
        </div>
        <div className="absolute" style={{ zIndex: 6, ...SEAL_BOX }}>
          <WaxSeal options={options} />
        </div>
      </div>
    </div>
  );
}
