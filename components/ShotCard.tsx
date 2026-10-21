"use client";

import { lookId, type ShotView } from "@/lib/session";

const FOCUS = "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2";

interface Props {
  view: ShotView;
  highlighted: boolean;
  onChip(groupId: string): void;
}

export function ShotCard({ view, highlighted, onChip }: Props) {
  const { shot, composition, display, fresh } = view;
  const unresolved = composition.ok ? [] : composition.unresolved;
  return (
    <article
      className={`rounded-md border p-3 ${highlighted ? "border-sky-700 ring-2 ring-sky-700" : "border-zinc-200"}`}
    >
      <div className="relative aspect-video overflow-hidden rounded-md bg-zinc-100">
        {display ? (
          // Renders are data URLs (mock) or Blob URLs (phase 2); next/image adds nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={display.url}
            alt={`${shot.shotSize}, ${shot.label}: ${lookId(shot) ?? "no look"}`}
            className={`h-full w-full object-cover ${fresh ? "" : "opacity-40"}`}
          />
        ) : null}
        <div className="absolute left-2 top-2 flex gap-1">
          {!fresh && composition.ok ? <Badge tone="stale">Stale</Badge> : null}
          {unresolved.length ? <Badge tone="error">Unresolved</Badge> : null}
        </div>
      </div>
      <h3 className="mt-2 text-sm font-medium">{shot.label}</h3>
      <p className="text-xs text-zinc-500">
        {shot.shotSize}
        {shot.proposedFields.includes("shotSize") ? " (proposed)" : ""}
      </p>
      <ul className="mt-2 flex flex-wrap gap-1" aria-label="Token references">
        {shot.refs.map((ref) => (
          <li key={ref}>
            <button
              type="button"
              onClick={() => onChip(ref)}
              className={`rounded-full px-2 py-1 font-mono text-xs ${FOCUS} ${
                unresolved.includes(ref) ? "bg-red-50 text-red-700" : "bg-zinc-100 text-zinc-900"
              }`}
            >
              {ref}
            </button>
          </li>
        ))}
      </ul>
      {composition.ok ? (
        <details className="mt-2 text-xs">
          <summary className={`cursor-pointer rounded-md py-1 text-zinc-500 ${FOCUS}`}>Composed prompt</summary>
          <p className="mt-1 font-mono leading-relaxed">{composition.prompt}</p>
        </details>
      ) : (
        <p className="mt-2 text-xs text-red-700">Does not compose: {unresolved.join(", ")} not found.</p>
      )}
    </article>
  );
}

function Badge({ tone, children }: { tone: "stale" | "error"; children: React.ReactNode }) {
  const colors = tone === "stale" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700";
  return <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${colors}`}>{children}</span>;
}
