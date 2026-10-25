"use client";

import type { Shot } from "@/lib/engine/types";
import type { ApplyRecord, RenderEntry } from "@/lib/session";

const FOCUS = "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2";

interface Props {
  record: ApplyRecord;
  renders: Record<string, RenderEntry>;
  shots: Shot[];
  onDismiss(): void;
}

export function BeforeAfter({ record, renders, shots, onDismiss }: Props) {
  const label = (id: string) => shots.find((s) => s.id === id)?.label ?? id;
  const rows: { name: string; keyOf(p: ApplyRecord["pairs"][number]): string | null }[] = [
    { name: "Before", keyOf: (p) => p.beforeKey },
    { name: "After", keyOf: (p) => p.afterKey },
  ];
  return (
    <section className="border-t border-zinc-200 pt-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium">
            {record.pairs.length} {record.pairs.length === 1 ? "shot" : "shots"} re-rendered
          </h2>
          <ul className="mt-1 text-xs text-zinc-500">
            {record.edits.map((e) => (
              <li key={`${e.at}-${e.path}`}>
                <code className="font-mono">{e.path}</code>: {e.from} → {e.to}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className={`rounded-md py-0.5 text-sm underline underline-offset-2 ${FOCUS}`}
        >
          Dismiss
        </button>
      </div>
      {rows.map((row) => (
        <div key={row.name} className="mt-3">
          <h3 className="text-xs font-medium text-zinc-500">{row.name}</h3>
          <ul className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {record.pairs.map((p) => {
              const key = row.keyOf(p);
              const entry = key ? renders[key] : undefined;
              return (
                <li key={p.shotId}>
                  <div className="aspect-video overflow-hidden rounded-md bg-zinc-100">
                    {entry ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={entry.url} alt={`${row.name}: ${label(p.shotId)}`} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{label(p.shotId)}</p>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
