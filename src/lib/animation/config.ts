export const SKY = {
  starCount: 220,
  starCountMobile: 110,
  minRadius: 0.4,
  maxRadius: 1.8,
  twinkleSpeedMin: 0.4,
  twinkleSpeedMax: 1.6,
  parallaxStrength: 28, // pixels the nearest stars shift when the mouse moves
  parallaxEase: 0.05, // 0 to 1, lower means smoother and slower
  colors: ["#ffffff", "#cfe0ff", "#ffe9c7"],
};

export const DOOR = {
  openDuration: 1.8,
  glowDuration: 0.6,
  ease: "power3.inOut",
};

export const DESK = {
  charmsPerKey: 1, // stars that fall each time you type a character
  gravity: 0.12, // how much faster a charm falls every frame
  lifeMin: 90, // frames a charm lives (60 frames is about one second)
  lifeMax: 150,
};