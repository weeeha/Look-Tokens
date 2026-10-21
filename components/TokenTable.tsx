"use client";

import { useState } from "react";
import { valuePath, type Tier, type TokenGroup } from "@/lib/engine/types";

const FOCUS = "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2";

const SECTIONS: { tier: Tier; label: string }[] = [
  { tier: "semantic", label: "Semantic" },
  { tier: "entity", label: "Entities" },
  { tier: "prim", label: "Primitives" },
];

interface Props {
  groups: TokenGroup[];
  usedBy: Map<string, string[]>;
  selectedGroup: string | null;
  onEdit(path: string, to: string): void;
  onShowUsers(shotIds: string[]): void;
  onOpenHistory(path: string): void;
}

export function TokenTable({ groups, usedBy, selectedGroup, onEdit, onShowUsers, onOpenHistory }: Props) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
          <th scope="col" className="py-2 pr-3 font-medium">Token</th>
          <th scope="col" className="py-2 pr-3 font-medium">Value</th>
          <th scope="col" className="py-2 font-medium">Used by</th>
        </tr>
      </thead>
      {SECTIONS.map(({ tier, label }) => (
        <tbody key={tier}>
          <tr>
            <th colSpan={3} scope="colgroup" className="pt-6 pb-1 text-left text-xs font-medium text-zinc-500">
              {label}
            </th>
          </tr>
          {groups
            .filter((g) => g.tier === tier)
            .map((g) => (
              <GroupRows
                key={g.id}
                group={g}
                usedBy={usedBy}
                selected={g.id === selectedGroup}
                onEdit={onEdit}
                onShowUsers={onShowUsers}
                onOpenHistory={onOpenHistory}
              />
            ))}
        </tbody>
      ))}
    </table>
  );
}

function GroupRows({
  group,
  usedBy,
  selected,
  onEdit,
  onShowUsers,
  onOpenHistory,
}: Omit<Props, "groups" | "selectedGroup"> & { group: TokenGroup; selected: boolean }) {
  const rowTone = selected ? "bg-sky-50" : "";
  return (
    <>
      <tr className={`border-t border-zinc-200 ${rowTone}`}>
        <th colSpan={3} scope="rowgroup" className="py-2 text-left font-mono text-sm font-medium break-words">
          {group.id}
          {group.proposed ? <Tag>proposed</Tag> : null}
          {group.spoiler ? <Tag>director-only</Tag> : null}
          {group.citations.length ? (
            <span className="ml-2 font-sans text-xs font-normal text-zinc-500" title={group.citations.join(" ")}>
              {group.citations.length} {group.citations.length === 1 ? "citation" : "citations"}
            </span>
          ) : null}
        </th>
      </tr>
      {group.spoiler
        ? null
        : Object.entries(group.values).map(([key, v]) => {
            const path = valuePath(group.id, key);
            const users = usedBy.get(path) ?? [];
            const doc = v.prompt === false;
            return (
              <tr key={path} className={`align-top ${rowTone}`}>
                <td className="py-1 pr-3 font-mono text-xs text-zinc-500 break-words">.{key}</td>
                <td className="py-1 pr-3">
                  <ValueEditor path={path} value={v.current} editable={!doc} onEdit={onEdit} />
                  {v.proposed ? <Tag>proposed</Tag> : null}
                  {doc ? <Tag>doc only</Tag> : null}
                  {v.history?.length ? (
                    <button
                      type="button"
                      onClick={() => onOpenHistory(path)}
                      className={`ml-2 rounded-md py-1 text-xs text-zinc-500 underline underline-offset-2 ${FOCUS}`}
                    >
                      {v.history.length + 1} versions
                    </button>
                  ) : null}
                </td>
                <td className="py-1 whitespace-nowrap">
                  {users.length ? (
                    <button
                      type="button"
                      onClick={() => onShowUsers(users)}
                      className={`rounded-md py-0.5 tabular-nums underline underline-offset-2 ${FOCUS}`}
                    >
                      {users.length} {users.length === 1 ? "shot" : "shots"}
                    </button>
                  ) : (
                    <span className="inline-block py-0.5 text-zinc-500">0</span>
                  )}
                </td>
              </tr>
            );
          })}
    </>
  );
}

function ValueEditor({
  path,
  value,
  editable,
  onEdit,
}: {
  path: string;
  value: string;
  editable: boolean;
  onEdit(path: string, to: string): void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  if (!editable) return <span className="inline-block py-0.5 font-mono text-zinc-500">{value}</span>;
  if (draft === null) {
    return (
      <button
        type="button"
        onClick={() => setDraft(value)}
        aria-label={`Edit ${path}: ${value}`}
        className={`rounded-md py-0.5 text-left font-mono hover:underline hover:underline-offset-2 ${FOCUS}`}
      >
        {value}
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onEdit(path, draft);
        setDraft(null);
      }}
    >
      <input
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setDraft(null);
        }}
        onBlur={() => setDraft(null)}
        aria-label={`New value for ${path}`}
        className={`w-full rounded-md border border-zinc-300 px-2 py-1 font-mono ${FOCUS}`}
      />
      <p className="mt-1 text-xs text-zinc-500">Enter to save, Esc to cancel</p>
    </form>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-2 rounded-md border border-zinc-300 px-1 py-px font-sans text-xs font-normal text-zinc-500">
      {children}
    </span>
  );
}
