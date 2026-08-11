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

// tel: strip Trip.com's spaces, keep the + so it dials from a roaming Italian SIM.
// Numeri finti: quelli veri vivono solo in seed.json, che non entra nel repo.
assert.strictEqual(CT.tel("+86 100 0000 0000"), "tel:+8610000000000");
assert.strictEqual(CT.tel("+86-000-0000000"), "tel:+860000000000");
assert.strictEqual(CT.tel(undefined), "tel:");

// WeChat: no add-by-phone deep link exists, so we only open the app (+ web fallback)
const wx = CT.wechatApp();
assert.ok(wx.startsWith("intent://#Intent;") && wx.includes("package=com.tencent.mm") && wx.endsWith(";end"));
assert.ok(wx.includes("S.browser_fallback_url="));

// parseTime: the seed writes times as free text, so only pull out what is really there
assert.strictEqual(CT.parseTime("11:35"), 695);
assert.strictEqual(CT.parseTime("~13:00"), 780);
assert.strictEqual(CT.parseTime("dopo le 14:00"), 840);
assert.strictEqual(CT.parseTime("primo pomeriggio"), null);
assert.strictEqual(CT.parseTime(""), null);
assert.strictEqual(CT.parseTime(undefined), null);

// sortByTime: timed items in order, untimed keep their authored position after them
const dayItems = [
  { id: "c", kind: "place", title: "tempio" },
  { id: "a", kind: "transport", dep: "08:15" },
  { id: "d", kind: "lodging", ci: "14:00" },
  { id: "b", kind: "transport", dep: "~11:35" },
  { id: "e", kind: "place", title: "sera" },
];
assert.deepStrictEqual(CT.sortByTime(dayItems).map(i => i.id), ["a", "b", "d", "c", "e"]);
assert.strictEqual(CT.itemMinutes({ kind: "lodging", ci: "14:00" }), 840);
assert.strictEqual(CT.itemMinutes({ kind: "place", title: "x" }), null);
assert.strictEqual(CT.itemMinutes({ t: "09:30", dep: "08:00" }), 570); // explicit t wins over dep

// nextMove: the first transport still ahead of now; falls back to the first un-ticked one
assert.strictEqual(CT.nextMove(dayItems, 9 * 60, {}).id, "b");   // 09:00 -> the 11:35
assert.strictEqual(CT.nextMove(dayItems, 7 * 60, {}).id, "a");   // 07:00 -> the 08:15
assert.strictEqual(CT.nextMove(dayItems, 23 * 60, { a: true }).id, "b"); // all past, a done
assert.strictEqual(CT.nextMove([{ id: "p", kind: "place" }], 600, {}), null);

// dueList: soonest first, ticked ones drop out, overdue stays and sorts to the top
const dl = [
  { id: "x", due: "2026-08-24" }, { id: "y", due: "2026-08-13" },
  { id: "z", due: "2026-08-15" }, { id: "w", due: "2026-08-09" },
];
assert.deepStrictEqual(CT.dueList(dl, "2026-08-11", {}).map(d => d.id), ["w", "y", "z", "x"]);
assert.strictEqual(CT.dueList(dl, "2026-08-11", {})[0].days, -2); // overdue is negative
assert.deepStrictEqual(CT.dueList(dl, "2026-08-11", { w: true, y: true }).map(d => d.id), ["z", "x"]);
assert.deepStrictEqual(CT.dueList(undefined, "2026-08-11", {}), []);

// toICS: DTEND is exclusive, so an all-day event on the 13th ends on the 14th
const ics = CT.toICS([{ id: "dl-g351", due: "2026-08-13", title: "G351, su 12306", desc: "riga1\nriga2" }]);
assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR"));
assert.ok(ics.includes("DTSTART;VALUE=DATE:20260813") && ics.includes("DTEND;VALUE=DATE:20260814"));
assert.ok(ics.includes("SUMMARY:G351\\, su 12306"));   // comma escaped per RFC 5545
assert.ok(ics.includes("DESCRIPTION:riga1\\nriga2"));  // newline escaped, not literal
assert.ok(ics.includes("TRIGGER:PT9H"));               // rings at 9:00 that morning
// month rollover: 31 ago -> DTEND 1 set
assert.ok(CT.toICS([{ id: "m", due: "2026-08-31", title: "t" }]).includes("DTEND;VALUE=DATE:20260901"));

// crypto round-trip — browser and CLI share crypto.js, so this covers both
(async () => {
  const CTC = require("./crypto.js");
  const PW = "una password lunga a sufficienza";
  const msg = JSON.stringify({ hotel: "示例旅馆", ref: "0000000000", days: [1, 2, 3] });

  const env = await CTC.encrypt(msg, PW);
  assert.strictEqual(env.v, 1);
  assert.strictEqual(env.kdf, "PBKDF2-SHA256");
  // the plaintext must not be recoverable by just base64-decoding the envelope
  assert.ok(!Buffer.from(env.ct, "base64").toString("utf8").includes("示例旅馆"));
  assert.ok(!Buffer.from(env.ct, "base64").toString("utf8").includes("0000000000"));

  assert.strictEqual(await CTC.decrypt(env, PW), msg);
  await assert.rejects(() => CTC.decrypt(env, PW + "x"), /Password sbagliata/);
  await assert.rejects(() => CTC.decrypt({ v: 2 }, PW), /Formato del file/);

  // fresh salt + IV every time: two encryptions of the same text must differ
  const env2 = await CTC.encrypt(msg, PW);
  assert.notStrictEqual(env.ct, env2.ct);
  assert.notStrictEqual(env.salt, env2.salt);

  // a real-size payload (the seed is ~31 KB) exercises the chunked base64
  const big = "x".repeat(40000);
  assert.strictEqual(await CTC.decrypt(await CTC.encrypt(big, PW), PW), big);

  console.log("ok — all logic + crypto checks passed");
})().catch((e) => {
  console.error("✗ crypto:", e.message);
  process.exit(1);
});
