"use client";

import { useState } from "react";
import Sky from "@/app/components/Sky";
import Door from "@/app/components/Door";

export default function Home() {
  const [doorOpen, setDoorOpen] = useState(false);

  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      <Sky />
      {!doorOpen && <Door onOpened={() => setDoorOpen(true)} />}
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
        </section>
      )}
    </main>
  );
}