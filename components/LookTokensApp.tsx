"use client";

import { useState } from "react";
import { parsePath } from "@/lib/engine/types";
import { HistoryDrawer } from "./HistoryDrawer";
import { TokenTable } from "./TokenTable";
import { Toolbar } from "./Toolbar";
import { useLookTokens } from "./useLookTokens";

// First version: the token side only. Task 13 replaces this file.
export function LookTokensApp() {
  const t = useLookTokens();
  const [historyPath, setHistoryPath] = useState<string | null>(null);

  if (!t.ready) return <main className="p-6 text-sm text-zinc-500">Loading tokens…</main>;

  const parsed = historyPath ? parsePath(historyPath) : null;
  const historyValue = parsed ? t.groups.find((g) => g.id === parsed.groupId)?.values[parsed.key] : undefined;

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold">Look Tokens</h1>
          <p className="text-sm text-zinc-500">Post-Collapse Montreal · Scene 15 · image-gen adapter</p>
        </div>
        <Toolbar
          persistent={t.persistent}
          conflictCount={t.conflicts.length}
          onReset={t.reset}
          onExport={t.download}
        />
      </header>

      <section aria-label="Tokens" className="mt-6 max-w-3xl">
        <TokenTable
          groups={t.groups}
          usedBy={t.usedBy}
          selectedGroup={null}
          onEdit={t.edit}
          onShowUsers={() => {}}
          onOpenHistory={setHistoryPath}
        />
      </section>

      {historyPath && historyValue ? (
        <HistoryDrawer
          path={historyPath}
          value={historyValue}
          onRollback={(to) => {
            t.edit(historyPath, to);
            setHistoryPath(null);
          }}
          onClose={() => setHistoryPath(null)}
        />
      ) : null}
    </main>
  );
}
