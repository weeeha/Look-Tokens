"use client";

import { valueHistory } from "@/lib/engine/edits";
import type { TokenValue } from "@/lib/engine/types";

const FOCUS = "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2";

interface Props {
  path: string;
  value: TokenValue;
  onRollback(to: string): void;
  onClose(): void;
}

export function HistoryDrawer({ path, value, onRollback, onClose }: Props) {
  const items = valueHistory(value).reverse(); // newest first
  return (
    <aside
      role="dialog"
      aria-label={`History of ${path}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className="fixed inset-y-0 right-0 z-10 w-full max-w-sm overflow-y-auto border-l border-zinc-200 bg-white p-5 shadow-xl"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="min-w-0 font-mono text-sm font-medium break-words">{path}</h2>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className={`rounded-md py-0.5 text-sm underline underline-offset-2 ${FOCUS}`}
        >
          Close
        </button>
      </div>
      <ol className="mt-4 space-y-3">
        {items.map((item, i) => (
          <li key={`${i}-${item.value}`} className="border-t border-zinc-200 pt-3 text-sm">
            <p>{item.value}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {item.replacedAt === null ? "Current" : `Replaced ${new Date(item.replacedAt).toLocaleString()}`}
            </p>
            {item.replacedAt !== null && item.value !== value.current ? (
              <button
                type="button"
                onClick={() => onRollback(item.value)}
                className={`mt-2 rounded-md py-1 text-xs underline underline-offset-2 ${FOCUS}`}
              >
                Roll back to this
              </button>
            ) : null}
          </li>
        ))}
      </ol>
    </aside>
  );
}
