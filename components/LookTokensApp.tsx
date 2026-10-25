"use client";

import { useState } from "react";
import { parsePath } from "@/lib/engine/types";
import { seed } from "@/lib/seed";
import { BeforeAfter } from "./BeforeAfter";
import { EditPanel } from "./EditPanel";
import { HistoryDrawer } from "./HistoryDrawer";
import { ShotCard } from "./ShotCard";
import { TokenTable } from "./TokenTable";
import { Toolbar } from "./Toolbar";
import { useLookTokens } from "./useLookTokens";

export function LookTokensApp() {
  const t = useLookTokens();
  const [highlighted, setHighlighted] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
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

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-label="Tokens" className="min-w-0">
          <TokenTable
            groups={t.groups}
            usedBy={t.usedBy}
            selectedGroup={selectedGroup}
            onEdit={t.edit}
            onShowUsers={(ids) => {
              setHighlighted(ids);
              setSelectedGroup(null);
            }}
            onOpenHistory={setHistoryPath}
          />
        </section>

        <section aria-label="Shots" className="min-w-0 space-y-6">
          <EditPanel pending={t.pending} staleCount={t.staleCount} onApply={t.apply} />
          {t.lastApply ? (
            <BeforeAfter record={t.lastApply} renders={t.renders} shots={seed.shots} onDismiss={t.dismiss} />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {t.views.map((view) => (
              <ShotCard
                key={view.shot.id}
                view={view}
                highlighted={highlighted.includes(view.shot.id)}
                onChip={(groupId) => {
                  setSelectedGroup(groupId);
                  setHighlighted([]);
                }}
              />
            ))}
          </div>
        </section>
      </div>

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
