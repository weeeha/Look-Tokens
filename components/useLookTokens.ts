"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { imageGen } from "@/lib/engine/adapters/image-gen";
import { applyEdits, exportSeed, makeEdit } from "@/lib/engine/edits";
import { usage } from "@/lib/engine/usage";
import { mockSvg } from "@/lib/providers/mock";
import { seed } from "@/lib/seed";
import {
  addEdit,
  dismissApply,
  emptySession,
  lookText,
  pendingEdits,
  recordRenders,
  settle,
  shotViews,
  staleViews,
  type NewRender,
  type Session,
  type ShotView,
} from "@/lib/session";
import { idbBackend, openStore, type SessionStore } from "@/lib/store/browser-store";

const adapter = imageGen;

function derive(session: Session) {
  const { groups, conflicts } = applyEdits(seed.groups, session.log);
  const views = shotViews(groups, seed.shots, adapter, session);
  return { groups, conflicts, views };
}

function mockRender(view: ShotView, groups: ReturnType<typeof derive>["groups"], at: string): NewRender[] {
  if (!view.key || !view.composition.ok) return [];
  const url = mockSvg({
    label: view.shot.label,
    shotSize: view.shot.shotSize,
    lookText: lookText(view.shot, groups),
    key: view.key,
  });
  return [{ shotId: view.shot.id, key: view.key, entry: { kind: "mock", url, prompt: view.composition.prompt, at } }];
}

// Every state change passes through here: render never-rendered shots,
// then settle after rollbacks. Keeps effects out of the data flow.
function normalize(session: Session): Session {
  const at = new Date().toISOString();
  const { groups, views } = derive(session);
  const first = views.filter((v) => v.needsFirstRender).flatMap((v) => mockRender(v, groups, at));
  const rendered = first.length ? recordRenders(session, first, { apply: false, at }) : session;
  return settle(rendered, derive(rendered).views);
}

export function useLookTokens() {
  const [session, setSession] = useState<Session | null>(null);
  const [persistent, setPersistent] = useState(true);
  const storeRef = useRef<SessionStore | null>(null);

  useEffect(() => {
    let cancelled = false;
    openStore(idbBackend).then((store) => {
      if (cancelled) return;
      storeRef.current = store;
      setPersistent(store.persistent);
      setSession(normalize(store.load() ?? emptySession()));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const store = storeRef.current;
    if (!store || !session) return;
    store.save(session).then(() => setPersistent(store.persistent));
  }, [session]);

  const derived = useMemo(() => (session ? derive(session) : null), [session]);
  const usedBy = useMemo(
    () => (derived ? usage(derived.groups, seed.shots, adapter) : new Map<string, string[]>()),
    [derived],
  );

  const edit = useCallback((path: string, to: string) => {
    setSession((s) => {
      if (!s) return s;
      const e = makeEdit(applyEdits(seed.groups, s.log).groups, path, to, new Date().toISOString());
      return e ? normalize(addEdit(s, e)) : s;
    });
  }, []);

  const apply = useCallback(() => {
    setSession((s) => {
      if (!s) return s;
      const at = new Date().toISOString();
      const { groups, views } = derive(s);
      const renders = staleViews(views).flatMap((v) => mockRender(v, groups, at));
      return renders.length ? normalize(recordRenders(s, renders, { apply: true, at })) : s;
    });
  }, []);

  const dismiss = useCallback(() => setSession((s) => (s ? dismissApply(s) : s)), []);
  const reset = useCallback(() => setSession(normalize(emptySession())), []);

  const download = useCallback(() => {
    if (!session) return;
    const data = exportSeed(seed, session.log);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "look-tokens-seed.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [session]);

  return {
    ready: session !== null && derived !== null,
    groups: derived?.groups ?? [],
    conflicts: derived?.conflicts ?? [],
    views: derived?.views ?? [],
    usedBy,
    pending: session ? pendingEdits(session) : [],
    staleCount: derived ? staleViews(derived.views).length : 0,
    lastApply: session?.lastApply ?? null,
    renders: session?.renders ?? {},
    persistent,
    edit,
    apply,
    dismiss,
    reset,
    download,
  };
}
