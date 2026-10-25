"use client";

import type { Edit } from "@/lib/engine/types";

const FOCUS = "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2";

interface Props {
  pending: Edit[];
  staleCount: number;
  onApply(): void;
}

export function EditPanel({ pending, staleCount, onApply }: Props) {
  if (!pending.length && !staleCount) return null;
  return (
    <section aria-live="polite" className="border-t border-zinc-200 pt-4">
      <h2 className="text-sm font-medium">Changed values</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {pending.map((e) => (
          <li key={`${e.at}-${e.path}`}>
            <code className="font-mono text-xs">{e.path}</code>{" "}
            <span className="text-zinc-500 line-through">{e.from}</span> → <span>{e.to}</span>
          </li>
        ))}
      </ul>
      {staleCount ? (
        <button
          type="button"
          onClick={onApply}
          className={`mt-3 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white ${FOCUS}`}
        >
          Apply to {staleCount} {staleCount === 1 ? "shot" : "shots"}
        </button>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">Every shot already has a render for these values.</p>
      )}
    </section>
  );
}
