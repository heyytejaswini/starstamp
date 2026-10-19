export type MyStar = {
  id: string;
  x: number; // 0 to 1 across the sky
  y: number; // 0 to 1 down the sky
  hue: number; // star color, from 0 to 360
  openOn: string; // the date the letter may open
  createdAt: number;
};

const KEY = "starstamp:fake-stars";

export function loadStars(): MyStar[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MyStar[]) : [];
  } catch {
    return [];
  }
}

export function addStar(star: MyStar) {
  try {
    const all = loadStars();
    all.push(star);
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage can be blocked, so the star simply isn't saved
  }
}

export function createStar(openOn: string): MyStar {
  const hues = [42, 200, 320]; // gold, ice blue, pink
  return {
    id: crypto.randomUUID(),
    x: 0.12 + Math.random() * 0.76,
    y: 0.1 + Math.random() * 0.4,
    hue: hues[Math.floor(Math.random() * hues.length)],
    openOn,
    createdAt: Date.now(),
  };
}