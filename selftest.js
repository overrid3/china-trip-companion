// Runnable check for the pure logic: `node selftest.js` (exits non-zero on failure).
const assert = require("assert");
const CT = require("./logic.js");

// diffDays / todayISO
assert.strictEqual(CT.diffDays("2026-08-23", "2026-09-12"), 20);
assert.strictEqual(CT.diffDays("2026-08-23", "2026-08-23"), 0);
assert.strictEqual(CT.todayISO(new Date(2026, 7, 5)), "2026-08-05"); // month is 0-based

// resolveView across the three phases
const dates = ["2026-08-23", "2026-08-24", "2026-09-12"];
assert.deepStrictEqual(CT.resolveView(dates, "2026-08-10"), { phase: "before", index: 0, daysUntil: 13 });
assert.deepStrictEqual(CT.resolveView(dates, "2026-08-24"), { phase: "during", index: 1 });
assert.deepStrictEqual(CT.resolveView(dates, "2026-10-01"), { phase: "after", index: 2 });

// reorderIds: move, clamp, no-op on unknown
assert.deepStrictEqual(CT.reorderIds(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
assert.deepStrictEqual(CT.reorderIds(["a", "b", "c"], "a", -1), ["a", "b", "c"]); // clamped top
assert.deepStrictEqual(CT.reorderIds(["a", "b", "c"], "c", +1), ["a", "b", "c"]); // clamped bottom
assert.deepStrictEqual(CT.reorderIds(["a", "b"], "z", +1), ["a", "b"]); // unknown id

// mergeDayItems: overlay applied, hidden split, user items appended, seed updates never dropped
const seed = [{ id: "x", title: "X" }, { id: "y", title: "Y" }];
const state = {
  order: ["y", "x"],
  items: { x: { done: true, note: "hi" }, y: { hidden: true } },
  userItems: [{ id: "u1", title: "Mine" }],
};
const m = CT.mergeDayItems(seed, state);
assert.deepStrictEqual(m.visible.map((i) => i.id), ["x", "u1"]); // y hidden, u1 appended
assert.strictEqual(m.visible[0].done, true);
assert.strictEqual(m.visible[0].note, "hi");
assert.strictEqual(m.visible[1].user, true);
assert.deepStrictEqual(m.hidden.map((i) => i.id), ["y"]);

// empty overlay falls back to seed order
assert.deepStrictEqual(CT.mergeDayItems(seed, {}).visible.map((i) => i.id), ["x", "y"]);

// nav links carry the Chinese name, no coordinates
const gm = CT.gmaps({ title: "Terracotta", zh: "兵马俑", cityZh: "西安" });
assert.ok(gm.includes(encodeURIComponent("兵马俑 西安")) && !gm.includes("@"));
const am = CT.amap({ zh: "兵马俑", cityZh: "西安" });
assert.ok(am.startsWith("https://uri.amap.com/search?keyword="));
assert.ok(am.includes("callnative=1") && am.includes("src=china-trip") && am.includes("coordinate=gaode"));

// Android intent:// deep links: right package/scheme, keeps a web fallback, well-formed
const amApp = CT.amapApp({ zh: "兵马俑", cityZh: "西安" });
assert.ok(amApp.startsWith("intent://poi?") && amApp.endsWith(";end"));
assert.ok(amApp.includes("scheme=androidamap") && amApp.includes("package=com.autonavi.minimap"));
assert.ok(amApp.includes("S.browser_fallback_url=" + encodeURIComponent("https://uri.amap.com/search").slice(0, 20)));
const gmApp = CT.gmapsApp({ zh: "兵马俑", cityZh: "西安" });
assert.ok(gmApp.startsWith("intent://www.google.com/maps/search/") && gmApp.endsWith(";end"));
assert.ok(gmApp.includes("package=com.google.android.apps.maps") && gmApp.includes("S.browser_fallback_url="));

// With coords: Amap pins the exact spot via viewMap+dev=1 (WGS-84), no location-biased search
const amPt = CT.amapApp({ zh: "故宫", lat: 39.9163, lon: 116.3972 });
assert.ok(amPt.startsWith("intent://viewMap?") && amPt.includes("lat=39.9163") && amPt.includes("lon=116.3972"));
assert.ok(amPt.includes("dev=1") && amPt.includes("package=com.autonavi.minimap") && !amPt.includes("keywords="));
const amWeb = CT.amap({ zh: "故宫", lat: 39.9163, lon: 116.3972 });
assert.ok(amWeb.startsWith("https://uri.amap.com/marker?position=116.3972,39.9163") && amWeb.includes("coordinate=wgs84"));

console.log("ok — all logic checks passed");
