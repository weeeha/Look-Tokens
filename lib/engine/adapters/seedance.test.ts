import { describe, expect, it } from "vitest";
import { seed } from "../../seed";
import { compose } from "../compose";
import { resolve } from "../resolve";
import { usage } from "../usage";
import { namespaceOf, promptValues, valuePath, type TokenGroup } from "../types";
import { seedance } from "./seedance";

const shotById = (id: string) => {
  const s = seed.shots.find((x) => x.id === id);
  if (!s) throw new Error(`no shot ${id}`);
  return s;
};
const run = (id: string) => {
  const shot = shotById(id);
  const groups = resolve(shot, seed.groups).groups;
  const out = seedance.compose(shot, groups);
  const [subject, scene, beat] = out.prompt.split("\n\n");
  return { shot, groups, out, subject, scene, beat };
};
// Case and a trailing period may change when a value becomes a sentence.
const norm = (s: string) => s.replace(/[.\s]+$/, "").toLowerCase();
const count = (haystack: string, needle: string) => haystack.toLowerCase().split(norm(needle)).length - 1;
// Spec section 6: Subject takes the entity values; Scene takes look, world and audio, and voice
// (film-tokens.md 2c files voice with audio).
const SUBJECT = ["bot", "prop", "loc"];
const SCENE = ["look", "world", "audio", "voice"];
const inBlock = (block: string[]) => (g: TokenGroup) => block.includes(namespaceOf(g.id));
const values = (groups: TokenGroup[]) => groups.flatMap((g) => promptValues(g).map(([key, v]) => ({ g, key, v })));

describe("seedance adapter", () => {
  it("targets the Seedance 2.5 model id the video pipeline uses", () => {
    expect(seedance.id).toBe("seedance");
    expect(seedance.target.model).toBe("dreamina-seedance-2-5-260628");
  });

  it("composes three blocks: Subject, Scene, then the beat line", () => {
    for (const s of seed.shots) {
      const { out } = run(s.id);
      expect(out.prompt.split("\n\n"), s.id).toHaveLength(3);
    }
  });

  it("puts every entity prompt value in Subject exactly once, and nothing else there", () => {
    for (const s of seed.shots) {
      const { groups, subject } = run(s.id);
      for (const { g, key, v } of values(groups.filter(inBlock(SUBJECT)))) {
        expect(count(subject, v.current), `${s.id}: ${g.id}.${key}`).toBe(1);
      }
      for (const { g, key, v } of values(groups.filter(inBlock(SCENE)))) {
        expect(count(subject, v.current), `${s.id}: ${g.id}.${key} in Subject`).toBe(0);
      }
    }
  });

  it("puts every look, world and voice prompt value in Scene exactly once, and no entity value", () => {
    for (const s of seed.shots) {
      const { groups, scene } = run(s.id);
      const sceneGroups = groups.filter(inBlock(SCENE));
      expect(sceneGroups.some((g) => g.id.startsWith("world/")), s.id).toBe(true);
      expect(sceneGroups.some((g) => g.id.startsWith("voice/")), s.id).toBe(true);
      for (const { g, key, v } of values(sceneGroups)) {
        expect(count(scene, v.current), `${s.id}: ${g.id}.${key}`).toBe(1);
      }
      for (const { g, key, v } of values(groups.filter(inBlock(SUBJECT)))) {
        expect(count(scene, v.current), `${s.id}: ${g.id}.${key} in Scene`).toBe(0);
      }
    }
  });

  it("makes the beat line the action only, never restated style", () => {
    for (const s of seed.shots) {
      const { beat, groups } = run(s.id);
      expect(beat).toBe(s.action);
      for (const { g, key, v } of values(groups)) {
        expect(count(beat, v.current), `${s.id}: ${g.id}.${key} in beat`).toBe(0);
      }
    }
  });

  it("leaves out documentation-only values and spoilers", () => {
    for (const s of seed.shots) {
      const { out, groups } = run(s.id);
      for (const g of groups) {
        for (const v of Object.values(g.values).filter((x) => x.prompt === false)) {
          expect(count(out.prompt, v.current), `${s.id}: ${g.id}`).toBe(0);
        }
      }
      expect(out.prompt).not.toContain("director-only");
    }
  });

  it("reports exactly the value paths it used", () => {
    for (const s of seed.shots) {
      const { out, groups } = run(s.id);
      const expected = groups
        .filter(inBlock([...SUBJECT, ...SCENE]))
        .flatMap((g) => promptValues(g).map(([key]) => valuePath(g.id, key)));
      expect([...out.reads].sort()).toEqual([...expected].sort());
    }
  });

  it("passes the engine's compose checks for every seed shot", () => {
    for (const s of seed.shots) {
      expect(compose(s, seed.groups, seedance).ok, s.id).toBe(true);
    }
  });

  it("composes s15-pour-medium exactly", () => {
    expect(run("s15-pour-medium").out.prompt).toBe(
      "A simple general-purpose service robot in an abandoned restaurant, still working its shift. " +
        "The diners at the set tables are dead. " +
        "Slim humanoid service unit, worn cream-white chassis, a serving tray arm, smooth precise movement. " +
        "A cover on its back that opens to its batteries. " +
        "A broken, empty carafe. " +
        "The pour that delivers nothing. " +
        "Set tables with dead diners. " +
        "Set tables, dead diners, live robot." +
        "\n\n" +
        "Soft overcast daylight through overgrown windows, in green-tinted shafts, dust hangs in the still air, " +
        "muted desaturated palette, cool greens against warm dust, modern digital cinema, " +
        "35mm lens, shallow depth of field. " +
        "Every exterior. Vegetation reclaims intact structures. Nature won by growth, not by fire. " +
        "Machines run leftover routines at different levels of degradation. " +
        "Behaviour is loyal to a dead purpose (the restaurant robot still serving). " +
        "Empty streets, no crowds, single figures. Bodies concentrate where animals live, the park of skeletons. " +
        "Dead diners still at set tables. " +
        "French, service-polite, unaware anything is wrong, still working its shift for dead customers, " +
        "warm and unhurried." +
        "\n\n" +
        "The robot leans over the diner's cup and tilts the carafe. Nothing comes out.",
    );
  });

  it("raises world/* and voice/* USED BY to 6, entity and look counts as in spec section 4", () => {
    const map = usage(seed.groups, seed.shots, seedance);
    const n = (path: string) => (map.get(path) ?? []).length;
    for (const g of seed.groups.filter((x) => ["world", "voice"].includes(namespaceOf(x.id)))) {
      for (const [key] of promptValues(g)) expect(n(valuePath(g.id, key)), `${g.id}.${key}`).toBe(6);
    }
    for (const key of ["light", "air", "palette", "capture", "lens"]) {
      expect(n(`look/overgrown-interior.${key}`)).toBe(6);
    }
    expect(n("bot/restaurant.identity")).toBe(6);
    expect(n("loc/restaurant.interior")).toBe(5);
    expect(n("prop/carafe.identity")).toBe(3);
    expect(n("prop/cable.identity")).toBe(1);
    expect(n("voice/restaurant-robot.lines")).toBe(0);
    expect(n("world/most-people-died.antiUse")).toBe(0);
  });
});
