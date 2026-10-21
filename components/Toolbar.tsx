"use client";

const FOCUS = "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2";

interface Props {
  persistent: boolean;
  conflictCount: number;
  onReset(): void;
  onExport(): void;
}

export function Toolbar({ persistent, conflictCount, onReset, onExport }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <button type="button" onClick={onReset} className={`rounded-md border border-zinc-300 px-3 py-1 ${FOCUS}`}>
        Reset to seed
      </button>
      <button type="button" onClick={onExport} className={`rounded-md border border-zinc-300 px-3 py-1 ${FOCUS}`}>
        Export JSON
      </button>
      {persistent ? null : (
        <p className="text-zinc-500">This browser is not saving edits. They last until you close the tab.</p>
      )}
      {conflictCount ? (
        <p className="text-red-700">
          {conflictCount} saved {conflictCount === 1 ? "edit no longer matches" : "edits no longer match"} the seed.
          Reset to clear {conflictCount === 1 ? "it" : "them"}.
        </p>
      ) : null}
    </div>
  );
}
