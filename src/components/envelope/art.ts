import type { EnvelopeOptions, SealColor } from "@/lib/envelope";

/* ================================================================
   All the drawing of the envelope lives here, as SVG text.
   The React components in Envelope.tsx just place these drawings.
   ================================================================ */

/* ---------- sizes (the whole scene is drawn at this size, then scaled to fit) ---------- */
export const ENV_W = 380;
export const ENV_H = 240;
export const FLAP_H = 135;
export const GROUP_OFFSET_Y = 20; // the envelope sits a little below the screen centre

/* ---------- colours (your night-sky palette) ---------- */
export const PAPER = "#98b0e4"; // the front of the envelope
export const FLAP_PAPER = "#abbfec"; // the flap, a touch lighter
export const INK = "#27387f"; // the dark-blue pen lines
export const CREAM = "#fff7dd";
export const TEAL = "#8cc6c6";
const MONO = "'Courier New', Courier, monospace";

/* ---------- the shapes ---------- */
// The front: the pocket, with a V-shaped top edge that ends in a soft round tip
export const FRONT_D =
  "M0 0 L168 116 Q190 130 212 116 L380 0 L380 236 Q380 240 376 240 L4 240 Q0 240 0 236 Z";
// The flap: a triangle with a rounded tip, a little bigger than the V so it covers the edge
export const FLAP_D = "M0 0 L380 0 L214 118 Q190 135 166 118 Z";
export const SPARK = "M0 -8 Q0 0 8 0 Q0 0 0 8 Q0 0 -8 0 Q0 0 0 -8 Z";

/* ---------- star <-> envelope morph (used when a star turns into an envelope and back) ---------- */
const N = 120;
function starRadius(theta: number) {
  const k = 0.5 + 0.5 * Math.cos(5 * (theta + Math.PI / 2));
  return 118 * (0.5 + 0.5 * Math.pow(k, 0.8));
}
function envelopeRadius(theta: number) {
  const a = ENV_W / 2;
  const b = ENV_H / 2;
  const n = 10;
  const c = Math.abs(Math.cos(theta)) / a;
  const s = Math.abs(Math.sin(theta)) / b;
  return 1 / Math.pow(Math.pow(c, n) + Math.pow(s, n), 1 / n);
}
// k = 0 is the star, k = 1 is the envelope, in between is a blend of both
export function morphPathD(k: number) {
  let d = "";
  for (let i = 0; i < N; i++) {
    const theta = (i / N) * Math.PI * 2;
    const r = starRadius(theta) * (1 - k) + envelopeRadius(theta) * k;
    d += `${i === 0 ? "M" : "L"}${(Math.cos(theta) * r).toFixed(1)} ${(Math.sin(theta) * r).toFixed(1)} `;
  }
  return d + "Z";
}

/* ---------- little drawing helpers ---------- */
type Pt = [number, number];

// Joins points with a smooth curve
function smooth(pts: Pt[], t = 0.18) {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    d += ` C${(p1[0] + (p2[0] - p0[0]) * t).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) * t).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) * t).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) * t).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

// Your soft, curved five-pointed star
function softStarD(cx: number, cy: number, outer: number, inner: number) {
  const pts: Pt[] = [];
  for (let k = 0; k < 10; k++) {
    const r = k % 2 ? inner : outer;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  const n = 10;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let k = 0; k < n; k++) {
    const p0 = pts[(k - 1 + n) % n];
    const p1 = pts[k];
    const p2 = pts[(k + 1) % n];
    const p3 = pts[(k + 2) % n];
    const t = 0.16;
    d += ` C${(p1[0] + (p2[0] - p0[0]) * t).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) * t).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) * t).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) * t).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + "Z";
}

// A doodle = a flat colour fill nudged off the lines + a thin pen outline (like real gouache)
function paint(d: string, fill: string, sw = 1.15) {
  return (
    `<path d="${d}" transform="translate(1.1 .9)" fill="${fill}"/>` +
    `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" stroke-opacity=".85"/>`
  );
}
function star(x: number, y: number, r: number, fill: string) {
  return paint(softStarD(x, y, r, r * 0.5), fill);
}
const wobbled = (inner: string) => `<g filter="url(#wobble)">${inner}</g>`;

/* ---------- hand lettering: "for future me", drawn stroke by stroke ---------- */
// Each letter is a few strokes. Points are [x, y]; y is negative going up from the baseline.
const GLYPH: Record<string, { w: number; s: Pt[][] }> = {
  f: { w: 12, s: [[[-3, 6], [0, 9], [3, 5], [5, -4], [7, -14], [9, -21], [12, -23], [13, -20], [11, -17]], [[1, -10], [7, -11.5], [13, -12]]] },
  o: { w: 11, s: [[[9, -8], [5, -10.5], [1, -8], [0, -4], [3, -0.5], [7, -1.5], [9, -5], [8, -9], [11, -8.5]]] },
  r: { w: 9, s: [[[0, -8], [1, 0], [1, -6], [3, -9.5], [6, -10.5], [9, -9]]] },
  u: { w: 12, s: [[[0, -10], [1, -4], [3, -1], [7, -2], [9, -10], [9, -4], [10, -1], [13, -1.5]]] },
  t: { w: 9, s: [[[4, -17], [3, -8], [3, -3], [5, -0.5], [8, -1.5], [10, -3]], [[-1, -11], [5, -11.5], [10, -12]]] },
  e: { w: 10, s: [[[0, -5], [5, -6], [9, -8], [6, -10.5], [2, -9], [0, -4], [2, -0.5], [6, -0.5], [10, -3]]] },
  m: { w: 16, s: [[[0, -8], [1, 0], [1, -6], [3, -9.5], [6, -8], [6, 0], [6, -6], [9, -9.5], [12, -8], [12, 0], [13, -1.5], [16, -2]]] },
};

function lettering(text: string, x: number, y: number, scale: number, rot: number) {
  const slant = 0.22; // leans the writing to the right
  let cx = 0;
  let k = 0;
  let paths = "";
  for (const ch of text) {
    if (ch === " ") {
      cx += 9;
      continue;
    }
    const g = GLYPH[ch];
    if (!g) continue;
    for (const stroke of g.s) {
      // a tiny wobble on every point so no two letters are identical
      const pts: Pt[] = stroke.map(([px, py]) => [
        cx + px - py * slant + Math.sin(k++ * 12.9898) * 0.25,
        py + Math.sin(k++ * 12.9898) * 0.25,
      ]);
      const d = smooth(pts);
      paths += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".92"/>`;
      paths += `<path d="${d}" transform="translate(.5 .35)" fill="none" stroke="${INK}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".5"/>`;
    }
    cx += g.w + 1.5;
  }
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})" filter="url(#wobbleSm)">${paths}</g>`;
}

/* ---------- the rabbit and the ground it sits on ---------- */
const GROUND_D =
  "M-46 4 C-52 -4 -38 -12 -28 -8 C-20 -14 -4 -13 4 -9 C14 -14 32 -12 38 -5 C50 -4 54 6 44 11 C26 16 -30 17 -46 4 Z";
function rabbitOnGround() {
  return (
    `<path d="${GROUND_D}" transform="translate(1.2 1)" fill="#f7e8cb"/>` +
    `<path d="${GROUND_D}" fill="none" stroke="#8d9fcc" stroke-width="1.1" stroke-linejoin="round" stroke-opacity=".9"/>` +
    `<path d="M36 4 l3 -5 l3 5z" fill="#9fb2d8" opacity=".8"/><path d="M-36 8 l2.5 -4.5 l2.5 4.5z" fill="#9fb2d8" opacity=".7"/>` +
    `<path d="${softStarD(30, 8, 3.6, 2)}" fill="${TEAL}" opacity=".9"/>` +
    `<image href="/rabbit.png" x="-31" y="-61" width="62" height="64"/>`
  );
}

/* ---------- stamps ---------- */
function stampRabbit(value: string) {
  const s = softStarD(26, 26, 12, 6.8);
  return (
    `<g transform="rotate(5 28 34)"><g filter="url(#wobbleSm)">` +
    `<rect x="0" y="0" width="56" height="68" fill="#fffdf6" stroke="${PAPER}" stroke-width="5" stroke-dasharray="0 6" stroke-linecap="round"/>` +
    `<rect x="2" y="2" width="52" height="64" fill="none" stroke="${INK}" stroke-opacity=".35" stroke-width=".8"/>` +
    `<rect x="7" y="7" width="42" height="54" fill="${TEAL}" stroke="#4f8f93" stroke-opacity=".7" stroke-width=".9"/></g>` +
    `<path d="${s}" transform="translate(1 1)" fill="#7f90c6"/>` +
    `<path d="${s}" fill="#8fa0d2" stroke="#3d4f94" stroke-width="1.1" stroke-linejoin="round"/>` +
    `<circle cx="22.5" cy="26" r="1.3" fill="${INK}"/><circle cx="29.5" cy="26" r="1.3" fill="${INK}"/>` +
    `<path d="M24.5 29 q1.5 1.3 3 0" fill="none" stroke="${INK}" stroke-width=".8" stroke-linecap="round"/>` +
    `<image href="/rabbit.png" x="29" y="38" width="19" height="19.6"/>` +
    `<text x="10" y="56" font-size="10" fill="#f1fbfb" font-family="Inter,system-ui,sans-serif" font-weight="600" opacity=".95">${value}</text></g>`
  );
}
function stampNight() {
  return (
    `<g transform="rotate(-4 28 34)"><g filter="url(#wobbleSm)">` +
    `<rect x="0" y="0" width="56" height="68" fill="#fbf1d6" stroke="${PAPER}" stroke-width="5" stroke-dasharray="0 6" stroke-linecap="round"/>` +
    `<rect x="6" y="6" width="44" height="56" fill="#1f2f72"/><rect x="9" y="9" width="38" height="50" fill="none" stroke="${CREAM}" stroke-opacity=".5" stroke-width=".7"/></g>` +
    `<path d="M6 52 Q18 44 30 50 T50 47 V62 H6Z" fill="#162258"/>` +
    `<path d="${softStarD(28, 27, 10, 5.6)}" fill="#cfe0ff" stroke="#fff" stroke-width="1" stroke-linejoin="round"/>` +
    `<path d="M12 14 l1 -3 l1 3 l3 1 l-3 1 l-1 3 l-1 -3 l-3 -1z" fill="${CREAM}"/><circle cx="41" cy="16" r="1.1" fill="${CREAM}"/><circle cx="14" cy="40" r=".9" fill="${CREAM}"/>` +
    `<text x="28" y="57.5" font-size="5" text-anchor="middle" fill="#fbf1d6" letter-spacing="1.2" font-family="${MONO}">STARSTAMP</text></g>`
  );
}

/* ---------- postmarks and stamped notices: inked by hand, so uneven and worn ---------- */
function postmarkRound(day: string, mon: string, yr: string, rot: number) {
  const t = `font-family="${MONO}" font-weight="700" fill="#1d2b6e" stroke="none"`;
  return (
    `<g transform="rotate(${rot})" filter="url(#distress)" fill="none" stroke="#1d2b6e" stroke-linecap="round" stroke-linejoin="round" opacity=".92">` +
    `<circle r="19" stroke-width="1.7"/><circle r="12.5" stroke-width="1"/>` +
    `<path id="pmTop" d="M-15.8 0 A15.8 15.8 0 0 1 15.8 0" stroke="none"/><path id="pmBot" d="M-17.6 0 A17.6 17.6 0 0 0 17.6 0" stroke="none"/>` +
    `<text font-size="4.4" ${t} letter-spacing=".7" text-anchor="middle"><textPath href="#pmTop" startOffset="50%">STARSTAMP POST</textPath></text>` +
    `<text font-size="4.4" ${t} letter-spacing=".7" text-anchor="middle" dy="3.4"><textPath href="#pmBot" startOffset="50%">✦ NIGHT SKY ✦</textPath></text>` +
    `<text y="-.8" font-size="5.8" text-anchor="middle" ${t}>${day} ${mon}</text>` +
    `<text y="5.4" font-size="5.2" text-anchor="middle" ${t}>${yr}</text></g>`
  );
}
function postmarkBox(line1: string, line2: string, rot: number) {
  const t = `font-family="${MONO}" font-weight="700" fill="#1d2b6e"`;
  return (
    `<g transform="rotate(${rot})" filter="url(#distress)" opacity=".9"><rect x="-21" y="-13" width="42" height="26" fill="none" stroke="#1d2b6e" stroke-width="1.5"/>` +
    `<path d="M-21 0 H21" stroke="#1d2b6e" stroke-width=".9"/>` +
    `<text y="-3.5" font-size="6.5" text-anchor="middle" ${t}>${line1}</text><text y="9" font-size="6.5" text-anchor="middle" ${t}>${line2}</text></g>`
  );
}
function cancel(rot: number) {
  return (
    `<g transform="rotate(${rot})" filter="url(#distress)" fill="none" stroke="#1d2b6e" stroke-width="1.5" stroke-linecap="round" opacity=".85">` +
    `<path d="M0 -8 q4 -4 8 0 t8 0 t8 0 t8 0 t8 0 M0 -1 q4 -4 8 0 t8 0 t8 0 t8 0 t8 0 M0 6 q4 -4 8 0 t8 0 t8 0 t8 0 t8 0"/></g>`
  );
}
function notice(text: string) {
  return (
    `<g transform="rotate(-2)" filter="url(#distress)" opacity=".85"><rect x="-62" y="-7" width="124" height="14" fill="none" stroke="#1d2b6e" stroke-width="1.2"/>` +
    `<rect x="-60" y="-5" width="120" height="10" fill="none" stroke="#1d2b6e" stroke-width=".5"/>` +
    `<text y="1.9" font-size="4.9" text-anchor="middle" fill="#1d2b6e" font-family="${MONO}" font-weight="700" letter-spacing=".9">${text}</text></g>`
  );
}

/* ---------- a faint constellation sketch (design C) ---------- */
function sketch() {
  const P: Pt[] = [[40, 150], [74, 118], [112, 132], [150, 98], [205, 92], [238, 60], [290, 70]];
  return (
    `<g opacity=".5" fill="none" stroke="${INK}" stroke-width="1" stroke-linecap="round" filter="url(#wobble)">` +
    `<path d="${smooth(P, 0.05)}" stroke-dasharray="1 5"/>` +
    P.map(([x, y], i) => `<path d="${softStarD(x, y, i % 2 ? 5 : 3.4, i % 2 ? 2.6 : 1.8)}" stroke-width=".9"/>`).join("") +
    `</g>`
  );
}

const moon = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})">${paint("M0 -9 A9 9 0 1 0 9 6 A7 7 0 1 1 0 -9 Z", CREAM)}</g>`;

/* ---------- the dates that go on the envelope ---------- */
export type EnvelopeMeta = { createdAt: number; openOn: string };

function dates(meta: EnvelopeMeta) {
  const made = new Date(meta.createdAt);
  return {
    day: String(made.getDate()),
    mon: made.toLocaleDateString("en-GB", { month: "short" }).toUpperCase(),
    yr: String(made.getFullYear()),
    openDay: String(new Date(`${meta.openOn}T00:00:00`).getDate()),
  };
}

/* ---------- the front of the envelope: put the chosen pieces together ---------- */
export function frontInner(o: EnvelopeOptions, meta: EnvelopeMeta) {
  const d = dates(meta);
  let art = "";
  let noticeAt: [number, number] = [258, 224];

  if (o.layout === "rabbit") {
    art += wobbled(star(34, 74, 6.5, CREAM) + star(92, 132, 4.2, TEAL) + star(104, 112, 3.2, CREAM));
    art += `<g transform="translate(66 216)">${rabbitOnGround()}</g>`;
    art += lettering("for future me", 136, 190, 1.18, -6);
  } else if (o.layout === "quiet") {
    art += wobbled(star(40, 80, 6, CREAM) + star(66, 112, 4, TEAL) + star(26, 150, 3.4, CREAM)) + moon(34, 218);
    art += lettering("for future me", 66, 186, 1.5, -5);
    noticeAt = [190, 222];
  } else {
    art += sketch();
    art += `<g transform="translate(52 218) scale(.86)">${rabbitOnGround()}</g>`;
    art += lettering("for future me", 118, 200, 1.25, -7);
    noticeAt = [258, 226];
  }

  if (o.notice !== "none") {
    const text = o.notice === "align" ? "OPEN WHEN THE STARS ALIGN ✦" : "DO NOT OPEN BEFORE THE DATE ✦";
    art += `<g transform="translate(${noticeAt[0]} ${noticeAt[1]})">${notice(text)}</g>`;
  }

  art += o.stamp === "rabbit" ? `<g transform="translate(316 56)">${stampRabbit(d.openDay)}</g>` : `<g transform="translate(318 54)">${stampNight()}</g>`;

  if (o.postmark === "round") {
    art += `<g transform="translate(314 118)">${postmarkRound(d.day, d.mon, d.yr, -14)}</g><g transform="translate(330 108)">${cancel(-8)}</g>`;
  } else {
    art += `<g transform="translate(300 128)">${postmarkBox(d.day + " " + d.mon, d.yr, -6)}</g>`;
    art += `<g transform="translate(330 106)">${cancel(-8)}</g>`;
  }

  return (
    `<defs><clipPath id="frontClip"><path d="${FRONT_D}"/></clipPath></defs>` +
    `<path d="${FRONT_D}" fill="${PAPER}"/>` +
    art +
    `<path d="${FRONT_D}" fill="none" stroke="${INK}" stroke-opacity=".6" stroke-width="1.4" stroke-linejoin="round" filter="url(#wobble)"/>` +
    texture(ENV_H, "frontClip")
  );
}

function texture(h: number, clip: string) {
  return (
    `<g clip-path="url(#${clip})" style="pointer-events:none">` +
    `<rect width="380" height="${h}" filter="url(#fibre)" opacity=".14"/>` +
    `<rect width="380" height="${h}" filter="url(#grainDark)" opacity=".2"/>` +
    `<rect width="380" height="${h}" filter="url(#grainLight)" opacity=".3"/></g>`
  );
}

/* ---------- the flap, back of the envelope, and the wax seal ---------- */
export const LINING_STARS: Pt[] = [
  [30, 20], [60, 48], [95, 22], [130, 70], [160, 30], [190, 88], [225, 28],
  [255, 66], [290, 22], [325, 50], [350, 24], [200, 50], [110, 100], [270, 100],
];

export function flapOuterInner() {
  return (
    `<defs><clipPath id="flapClip"><path d="${FLAP_D}"/></clipPath></defs>` +
    `<path d="${FLAP_D}" transform="translate(0 5)" fill="rgba(20,30,90,.33)" filter="url(#softShadow)"/>` +
    `<path d="${FLAP_D}" fill="${FLAP_PAPER}"/>` +
    `<path d="${FLAP_D}" fill="none" stroke="${INK}" stroke-opacity=".6" stroke-width="1.4" stroke-linejoin="round" filter="url(#wobble)"/>` +
    texture(FLAP_H, "flapClip")
  );
}
export function flapInnerInner() {
  return (
    `<path d="${FLAP_D}" fill="#27357f" stroke="rgba(255,233,176,0.35)" stroke-width="1" stroke-linejoin="round"/>` +
    LINING_STARS.slice(0, 9)
      .map(([x, y], i) => `<circle cx="${x}" cy="${Math.min(y, 70) * 0.9}" r="${i % 3 === 0 ? 1.6 : 1}" fill="#ffe9b0" opacity=".55"/>`)
      .join("") +
    `<path d="${FLAP_D}" fill="none" stroke="${INK}" stroke-opacity=".6" stroke-width="1.2" stroke-linejoin="round" filter="url(#wobble)"/>`
  );
}
export function backInner() {
  return (
    `<rect width="${ENV_W}" height="${ENV_H}" rx="4" fill="#2a3a85"/>` +
    LINING_STARS.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 1.6 : 1}" fill="#ffe9b0" opacity=".5"/>`).join("") +
    `<rect width="${ENV_W}" height="${ENV_H}" filter="url(#grainLight)" opacity=".25"/>`
  );
}

// The seal: a flat, hand-pressed disc of wax with your soft star
const SEAL_LOOK: Record<SealColor, { wax: string; line: string; outline: string; lobes: number }> = {
  blue: { wax: "#7d92c9", line: "#e4edff", outline: "#2c3d86", lobes: 6 },
  gold: { wax: "#dcb062", line: "#fff3cf", outline: "#7a5115", lobes: 6 },
  navy: { wax: "#34479d", line: "#bcd0ff", outline: "#111b55", lobes: 6 },
  cream: { wax: "#f2e6c8", line: "#8a7340", outline: "#8a7340", lobes: 7 },
};
function lobed(lobes: number, amp: number) {
  let d = "";
  for (let i = 0; i < 90; i++) {
    const t = (i / 90) * Math.PI * 2;
    const r = 20.5 + amp * Math.sin(lobes * t + 0.4) + 0.7 * Math.sin(3 * t + 1);
    d += `${i ? "L" : "M"}${(26 + Math.cos(t) * r).toFixed(1)} ${(26 + Math.sin(t) * r).toFixed(1)} `;
  }
  return d + "Z";
}
export function sealInner(color: SealColor) {
  const { wax, line, outline, lobes } = SEAL_LOOK[color];
  const b = lobed(lobes, 1.7);
  return (
    `<g filter="url(#wobbleSm)">` +
    `<path d="${b}" transform="translate(1.2 1.8)" fill="rgba(25,30,80,.28)"/>` +
    `<path d="${b}" fill="${wax}" stroke="${outline}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<circle cx="26" cy="26" r="15.5" fill="none" stroke="${line}" stroke-width="1.1" stroke-linecap="round" stroke-dasharray="38 5 24 7 16 6" stroke-opacity=".9"/>` +
    `<path d="${softStarD(26, 26.5, 9.5, 5.6)}" fill="none" stroke="${line}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<circle cx="26" cy="26.5" r="1" fill="${line}"/></g>`
  );
}

/* ---------- the paint effects (wobbly pen, paper grain, worn ink, soft shadow) ---------- */
export const DEFS_INNER =
  `<defs>` +
  `<filter id="wobble" filterUnits="userSpaceOnUse" x="-60" y="-80" width="520" height="400" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" seed="8" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="3" xChannelSelector="R" yChannelSelector="G"/></filter>` +
  `<filter id="wobbleSm" filterUnits="userSpaceOnUse" x="-60" y="-80" width="520" height="400" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="3" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="2" xChannelSelector="R" yChannelSelector="G"/></filter>` +
  `<filter id="distress" filterUnits="userSpaceOnUse" x="-90" y="-60" width="180" height="120" color-interpolation-filters="sRGB">` +
  `<feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="2" seed="21" result="fine"/>` +
  `<feColorMatrix in="fine" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -9 6.3" result="holes"/>` +
  `<feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="4" result="blot"/>` +
  `<feColorMatrix in="blot" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -6 4.6" result="patch"/>` +
  `<feComposite in="holes" in2="patch" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="mask"/>` +
  `<feComposite in="SourceGraphic" in2="mask" operator="in" result="worn"/>` +
  `<feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="2" seed="9" result="w"/>` +
  `<feDisplacementMap in="worn" in2="w" scale="1.8" xChannelSelector="R" yChannelSelector="G"/></filter>` +
  `<filter id="grainLight" filterUnits="userSpaceOnUse" x="0" y="0" width="400" height="300" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="5"/><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 .95 2.6 0 0 0 -1.15"/></filter>` +
  `<filter id="grainDark" filterUnits="userSpaceOnUse" x="0" y="0" width="400" height="300" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 .1 0 0 0 0 .15 0 0 0 0 .4 2.6 0 0 0 -1.1"/></filter>` +
  `<filter id="fibre" filterUnits="userSpaceOnUse" x="0" y="0" width="400" height="300" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".015 .35" numOctaves="3" seed="2"/><feColorMatrix type="matrix" values="0 0 0 0 .15 0 0 0 0 .2 0 0 0 0 .5 2.2 0 0 0 -.95"/></filter>` +
  `<filter id="softShadow" filterUnits="userSpaceOnUse" x="-20" y="-20" width="420" height="190"><feGaussianBlur stdDeviation="3"/></filter>` +
  `</defs>`;
