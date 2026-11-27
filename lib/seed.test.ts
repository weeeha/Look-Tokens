import { describe, expect, it } from "vitest";
import { seed } from "./seed";

describe("seed", () => {
  it("loads 13 token groups and 6 shots", () => {
    expect(seed.groups).toHaveLength(13);
    expect(seed.shots).toHaveLength(6);
  });

  it("puts every Scene 15 shot on look/overgrown-interior", () => {
    for (const shot of seed.shots) expect(shot.refs).toContain("look/overgrown-interior");
  });

  // Spec section 6: Seedance reads world/* and voice/*, so their USED BY is 6 with it active.
  it("puts every Scene 15 shot on the three world rules and the restaurant robot's voice", () => {
    const worlds = seed.groups.filter((g) => g.id.startsWith("world/")).map((g) => g.id);
    expect(worlds).toHaveLength(3);
    for (const shot of seed.shots) {
      for (const id of [...worlds, "voice/restaurant-robot"]) expect(shot.refs, shot.id).toContain(id);
    }
  });

  it("keeps spoiler text and spoiler-revealing ids out of the repo", () => {
    const spoilers = seed.groups.filter((g) => g.spoiler);
    expect(spoilers.map((g) => g.id)).toEqual(["prim/director-only-1", "prim/director-only-2"]);
    for (const g of spoilers) {
      for (const v of Object.values(g.values)) {
        expect(v.prompt).toBe(false);
        expect(v.current.startsWith("[director-only")).toBe(true);
      }
    }
  });
});
