"use client";

import Link from "next/link";
import { useState } from "react";
import Sky from "@/components/Sky";
import Door from "@/components/Door";

// Lives until the page is fully reloaded. It survives moving between pages
// inside the site, so the door shows on a fresh load but not when you come
// back from the writing desk.
let doorOpenedThisLoad = false;

export default function Home() {
  const [doorOpen, setDoorOpen] = useState(doorOpenedThisLoad);

  const handleOpened = () => {
    doorOpenedThisLoad = true;
    setDoorOpen(true);
  };

  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      <Sky />
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
    </main>
  );
}