import Link from "next/link";
import Sky from "@/components/Sky";
import Desk from "@/components/Desk";

export default function WritePage() {
  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      <Sky />
      <Link
        href="/"
        className="absolute left-4 top-4 z-30 text-sm"
        style={{ color: "rgba(220, 230, 255, 0.8)" }}
      >
        ← the sky
      </Link>
      <Desk />
    </main>
  );
}