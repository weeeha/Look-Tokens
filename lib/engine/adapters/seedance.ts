import { namespaceOf, promptValues, valuePath, type TokenGroup } from "../types";
import type { Adapter } from "./types";

// film-tokens.md Tier 3 and spec section 6: Subject (entity values) + Scene (look, world,
// audio values) + beat line (action only, never restated style). Voice sits with audio,
// as in film-tokens.md 2c. Text only: nothing renders through this adapter.
const SUBJECT = ["bot", "prop", "loc"];
const SCENE = ["look", "world", "audio", "voice"];

const sentence = (s: string) => {
  const t = s.trim();
  const c = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(c) ? c : `${c}.`;
};

export const seedance: Adapter = {
  id: "seedance",
  // Seedance 2.5, the default model of the Video Generation Pipeline client.
  target: { model: "dreamina-seedance-2-5-260628" },
  compose(shot, groups) {
    const reads: string[] = [];
    const take = (g: TokenGroup) =>
      promptValues(g).map(([key, v]) => {
        reads.push(valuePath(g.id, key));
        return v.current;
      });

    // Subject: each entity value is its own sentence, entities in ref order.
    const subject = groups
      .filter((g) => SUBJECT.includes(namespaceOf(g.id)))
      .flatMap(take)
      .map(sentence)
      .join(" ");

    // Scene: one sentence per semantic group, its values joined with commas,
    // look first, then world, audio and voice; ref order within a namespace.
    const scene = SCENE.flatMap((ns) => groups.filter((g) => namespaceOf(g.id) === ns))
      .map(take)
      .filter((parts) => parts.length > 0)
      .map((parts) => sentence(parts.join(", ")))
      .join(" ");

    return { prompt: [subject, scene, shot.action].join("\n\n"), reads };
  },
};
