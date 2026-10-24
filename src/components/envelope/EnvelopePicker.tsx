"use client";

import { useState, useSyncExternalStore } from "react";
import {
  DEFAULT_ENVELOPE,
  LAYOUTS,
  NOTICES,
  POSTMARKS,
  SEAL_COLORS,
  STAMPS,
  type EnvelopeOptions,
} from "@/lib/envelope";
import { EnvelopeClosed, EnvelopeDefs } from "./Envelope";
import { useIsClient } from "./useFit";

type Props = {
  value: EnvelopeOptions;
  onChange: (next: EnvelopeOptions) => void;
  openOn: string; // the unlock date typed on the desk, "YYYY-MM-DD" (may be empty)
};

const GOLD = "#ffe9b0";

// Today's time, read once and only in the browser (never while the server builds the page).
// The server gets 0 and, since the previews only draw in the browser, never uses it.
let clockCache = 0;
function useClock() {
  return useSyncExternalStore(
    () => () => {},
    () => clockCache || (clockCache = Date.now()),
    () => 0
  );
}

// One row of choices, shown as small pill buttons
function Chips<T extends string>({
  label,
  items,
  value,
  onPick,
}: {
  label: string;
  items: { id: T; name: string; swatch?: string }[];
  value: T;
  onPick: (id: T) => void;
}) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs uppercase tracking-[0.14em]" style={{ color: "rgba(255,233,176,.7)" }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => {
          const on = it.id === value;
          return (
            <button
              key={it.id}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(it.id)}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm"
              style={{
                border: `1px solid ${on ? GOLD : "rgba(255,233,176,.3)"}`,
                background: on ? "rgba(255,233,176,.16)" : "transparent",
                color: on ? GOLD : "rgba(244,239,224,.85)",
              }}
            >
              {it.swatch && (
                <span
                  aria-hidden="true"
                  className="inline-block h-3.5 w-3.5 rounded-full"
                  style={{ background: it.swatch, border: "1px solid rgba(0,0,0,.35)" }}
                />
              )}
              {it.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function EnvelopePicker({ value, onChange, openOn }: Props) {
  const [open, setOpen] = useState(false);
  const isClient = useIsClient();

  // the envelope previews use "today" and the chosen date, like the real one will
  const now = useClock();
  const meta = { createdAt: now, openOn: openOn || new Date(now + 86400000 * 30).toISOString().slice(0, 10) };
  const set = (patch: Partial<EnvelopeOptions>) => onChange({ ...value, ...patch });
  const isDefault = JSON.stringify(value) === JSON.stringify(DEFAULT_ENVELOPE);
  const layoutName = LAYOUTS.find((l) => l.id === value.layout)?.name ?? "";

  return (
    <>
      {isClient && <EnvelopeDefs />}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left"
        style={{ border: "1px solid rgba(255,233,176,.35)", color: "#f4efe0" }}
      >
        <span className="shrink-0">
          {isClient && <EnvelopeClosed options={value} meta={meta} scale={0.2} />}
        </span>
        <span className="flex-1">
          <span className="block text-sm" style={{ color: GOLD }}>
            Choose your envelope
          </span>
          <span className="block text-xs" style={{ color: "rgba(244,239,224,.65)" }}>
            {layoutName}
            {isDefault ? " (the classic)" : ""} · tap to change
          </span>
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose your envelope"
          className="fixed inset-0 z-50 flex items-center justify-center p-3"
          style={{ background: "rgba(5,8,22,.82)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl p-5"
            style={{ background: "#141c4d", border: "1px solid rgba(255,233,176,.3)" }}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg" style={{ color: GOLD }}>
                Choose your envelope
              </h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="px-2 text-lg" style={{ color: GOLD }}>
                ✕
              </button>
            </div>

            <div className="mt-3 flex justify-center">
              {isClient && <EnvelopeClosed options={value} meta={meta} scale={Math.min(0.85, (Math.min(window.innerWidth, 512) - 72) / 380)} />}
            </div>

            <Chips
              label="Design"
              items={LAYOUTS.map((l) => ({ id: l.id, name: l.name }))}
              value={value.layout}
              onPick={(id) => onChange(LAYOUTS.find((l) => l.id === id)!.defaults)}
            />
            <Chips label="Wax seal" items={SEAL_COLORS} value={value.seal} onPick={(seal) => set({ seal })} />
            <Chips label="Stamp" items={STAMPS} value={value.stamp} onPick={(stamp) => set({ stamp })} />
            <Chips label="Postmark" items={POSTMARKS} value={value.postmark} onPick={(postmark) => set({ postmark })} />
            <Chips label="Stamped words" items={NOTICES} value={value.notice} onPick={(notice) => set({ notice })} />

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => onChange(DEFAULT_ENVELOPE)}
                disabled={isDefault}
                className="text-sm underline"
                style={{ color: "rgba(244,239,224,.7)", opacity: isDefault ? 0.4 : 1 }}
              >
                Back to the classic
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-5 py-2 text-sm"
                style={{ background: GOLD, color: "#1a2766" }}
              >
                Use this one
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
