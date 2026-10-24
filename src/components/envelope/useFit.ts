import { useSyncExternalStore } from "react";

function subscribeResize(callback: () => void) {
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}

// How much to shrink a scene so it fits the screen (1 = full size).
// `sceneHeight` is how tall the whole animation gets, `pad` is the breathing room at the sides.
export function useFit(envW: number, sceneHeight = 520, pad = 24) {
  return useSyncExternalStore(
    subscribeResize,
    () => {
      const byWidth = (window.innerWidth - pad) / envW;
      const byHeight = (window.innerHeight - 40) / sceneHeight;
      return Math.round(Math.min(1, byWidth, byHeight) * 100) / 100;
    },
    () => 1
  );
}

// true in the browser, false while the server builds the page
export function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}
