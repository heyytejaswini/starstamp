"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import Sky from "@/components/Sky";
import Door from "@/components/Door";
import StarCard from "@/components/StarCard";
import { refreshStars, type MyStar } from "@/lib/stars";

type DoorWindow = Window & { __starstampDoorOpen?: boolean };

export default function Home() {
  const [openedNow, setOpenedNow] = useState(false);
  const [starsReady, setStarsReady] = useState(false);
  const [selected, setSelected] = useState<MyStar | null>(null);

  // true if the door was already opened earlier in this page load
  const openedBefore = useSyncExternalStore(
    () => () => {},
    () => Boolean((window as DoorWindow).__starstampDoorOpen),
    () => false
  );
  const doorOpen = openedNow || openedBefore;

  // fetch your stars from the database, then show the sky
  useEffect(() => {
    let alive = true;
    refreshStars().finally(() => {
      if (alive) setStarsReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleOpened = () => {
    (window as DoorWindow).__starstampDoorOpen = true;
    setOpenedNow(true);
  };

  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      {starsReady && <Sky onStarClick={setSelected} />}
      {!doorOpen && <Door onOpened={handleOpened} />}
      {doorOpen && (
        <section className="fade-in relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <h1 className="text-5xl font-light tracking-[0.2em] sm:text-7xl">
            Starstamp
          </h1>
          <p
            className="mt-4 max-w-md text-lg"
            style={{ color: "rgba(220, 230, 255, 0.8)" }}
          >
            Letters to your future self, sealed with a star.
          </p>
          <Link
            href="/write"
            className="mt-10 rounded-full border px-8 py-3 text-sm uppercase tracking-[0.25em]"
            style={{ borderColor: "rgba(255, 233, 176, 0.6)", color: "#ffe9b0" }}
          >
            Write a letter
          </Link>
        </section>
      )}

      {selected && (
        <StarCard
          key={selected.id}
          star={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}