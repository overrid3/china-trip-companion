// Pure, side-effect-free helpers. Shared by index.html (browser global CT)
// and selftest.js (node require). No DOM, no storage here.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CT = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const pad = (n) => String(n).padStart(2, "0");

  // Local calendar date as YYYY-MM-DD (not UTC — the phone's wall clock is what matters).
  function todayISO(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // Whole-day difference b - a (both YYYY-MM-DD), timezone-agnostic.
  function diffDays(aISO, bISO) {
    const a = Date.UTC(...aISO.split("-").map(Number).map((n, i) => (i === 1 ? n - 1 : n)));
    const b = Date.UTC(...bISO.split("-").map(Number).map((n, i) => (i === 1 ? n - 1 : n)));
    return Math.round((b - a) / 86400000);
  }

  // Where are we in the trip? dates = sorted YYYY-MM-DD of every seed day.
  function resolveView(dates, todayStr) {
    const first = dates[0], last = dates[dates.length - 1];
    const idx = dates.indexOf(todayStr);
    if (idx !== -1) return { phase: "during", index: idx };
    if (todayStr < first) return { phase: "before", index: 0, daysUntil: diffDays(todayStr, first) };
    return { phase: "after", index: dates.length - 1 };
  }

  // Move id one slot up (dir -1) or down (dir +1); returns a new array, clamped.
  function reorderIds(order, id, dir) {
    const out = order.slice();
    const i = out.indexOf(id);
    if (i === -1) return out;
    const j = i + dir;
    if (j < 0 || j >= out.length) return out;
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  }

  // Merge seed items + user-added items with the per-day overlay (done/hidden/note)
  // and the saved display order. New seed/user items missing from `order` are appended,
  // so re-publishing seed.json never drops or clobbers anything.
  function mergeDayItems(seedItems, dayState) {
    const ds = dayState || {};
    const overlay = ds.items || {};
    const userItems = ds.userItems || [];
    const byId = new Map();
    for (const it of seedItems) byId.set(it.id, it);
    for (const it of userItems) byId.set(it.id, { ...it, user: true });

    const order = (ds.order && ds.order.length ? ds.order.slice() : seedItems.map((i) => i.id));
    for (const id of byId.keys()) if (!order.includes(id)) order.push(id);

    const all = order
      .filter((id) => byId.has(id))
      .map((id) => {
        const st = overlay[id] || {};
        return { ...byId.get(id), done: !!st.done, hidden: !!st.hidden, note: st.note || "" };
      });
    return { visible: all.filter((i) => !i.hidden), hidden: all.filter((i) => i.hidden) };
  }

  // Deep-link builders. No coordinates — name search dodges the GCJ-02 offset entirely.
  function gmaps(item) {
    const q = [item.zh || item.title, item.cityZh || item.city || ""].filter(Boolean).join(" ");
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
  }
  function amap(item) {
    // With coords, drop a precise marker. coordinate=wgs84 tells Amap the point is raw GPS
    // so it applies the GCJ-02 offset itself.
    if (item.lat != null && item.lon != null) {
      return "https://uri.amap.com/marker?position=" + item.lon + "," + item.lat +
        "&name=" + encodeURIComponent(item.zh || item.title) +
        "&src=china-trip&coordinate=wgs84&callnative=1";
    }
    const kw = item.zh || item.title;
    const city = item.cityZh || item.city || "";
    // Name search is city-scoped but ranks by current location — fine on-site, wrong from afar.
    return "https://uri.amap.com/search?keyword=" + encodeURIComponent(kw) +
      (city ? "&city=" + encodeURIComponent(city) : "") +
      "&src=china-trip&coordinate=gaode&callnative=1";
  }

  // Android intent:// URL — names the Amap package directly, so it force-opens the app
  // even from inside a webview (where plain https App-Links get stuck on the web page).
  // If Amap isn't installed, Android follows browser_fallback_url to the web map.
  function amapApp(item) {
    // Coords -> viewMap pins the exact spot no matter where the phone is (dev=1: the input is
    // WGS-84 GPS and Amap applies the GCJ-02 offset itself). No coords -> keyword search, which
    // Amap ranks around the CURRENT location, so it mis-pins when you're not on-site yet.
    const deep = (item.lat != null && item.lon != null)
      ? "viewMap?sourceApplication=chinatrip&poiname=" + encodeURIComponent(item.zh || item.title) +
        "&lat=" + item.lat + "&lon=" + item.lon + "&dev=1"
      : "poi?sourceApplication=chinatrip&keywords=" +
        encodeURIComponent([item.zh || item.title, item.cityZh || item.city || ""].filter(Boolean).join(" ")) +
        "&dev=0";
    return "intent://" + deep +
      "#Intent;scheme=androidamap;package=com.autonavi.minimap;" +
      "S.browser_fallback_url=" + encodeURIComponent(amap(item)) + ";end";
  }

  // Android intent:// for Google Maps too — same webview-handoff problem.
  function gmapsApp(item) {
    const web = gmaps(item);
    return "intent://" + web.replace(/^https?:\/\//, "") +
      "#Intent;scheme=https;package=com.google.android.apps.maps;" +
      "S.browser_fallback_url=" + encodeURIComponent(web) + ";end";
  }

  // tel: link. Strips the spaces Trip.com puts in the numbers; keeps the leading +
  // so the call works from an Italian SIM roaming in China without editing the prefix.
  function tel(number) {
    return "tel:" + String(number || "").replace(/[^\d+]/g, "");
  }

  // WeChat deliberately has NO public deep link to add a contact by phone number —
  // Tencent removed it years ago because it was a spam vector. So the honest best
  // is: open the app and let the user paste. The caller copies the number to the
  // clipboard first, then the flow is + › Aggiungi contatti › Numero di telefono.
  // Same intent:// trick as Amap: from a PWA webview a plain weixin:// often dies.
  function wechatApp() {
    return "intent://#Intent;scheme=weixin;package=com.tencent.mm;" +
      "S.browser_fallback_url=" + encodeURIComponent("https://weixin.qq.com/") + ";end";
  }

  // Hotel check-in windows are "after 14:00" / "before 12:00" — a plain string in the
  // seed. Returns the hour so the day view can sort the check-in into the timeline.
  function parseTime(s) {
    const m = /(\d{1,2}):(\d{2})/.exec(String(s || ""));
    return m ? +m[1] * 60 + +m[2] : null;
  }

  // Sort key for the timeline: items with a real clock first, in order; everything
  // without one keeps its authored position after them. A calm itinerary genuinely
  // has no time for the temple, so we don't invent one.
  function itemMinutes(it) {
    return parseTime(it.t || it.dep || (it.kind === "lodging" ? it.ci : ""));
  }
  function sortByTime(items) {
    return items
      .map((it, i) => ({ it, i, m: itemMinutes(it) }))
      .sort((a, b) => (a.m === null) - (b.m === null) || (a.m - b.m) || (a.i - b.i))
      .map((x) => x.it);
  }

  // The next thing that moves you: first transport of the day still ahead of `now`
  // (minutes since midnight), else the first one not ticked off.
  function nextMove(items, nowMin, done) {
    const moves = items.filter((i) => i.kind === "transport");
    const ahead = moves.find((i) => { const m = itemMinutes(i); return m !== null && m > nowMin; });
    return ahead || moves.find((i) => !(done || {})[i.id]) || null;
  }

  // Deadlines still open, soonest first, with the days left. Anything already ticked
  // drops out; anything overdue stays and sorts to the top — it is the loudest case.
  function dueList(deadlines, todayStr, done) {
    return (deadlines || [])
      .filter((d) => !(done || {})[d.id])
      .map((d) => ({ ...d, days: diffDays(todayStr, d.due) }))
      .sort((a, b) => a.days - b.days);
  }

  // Minimal VCALENDAR: all-day VEVENTs with a 9:00 alarm the same morning. No library —
  // the phone's own calendar is the only thing that can actually ring while the app is shut.
  function toICS(deadlines, prodid) {
    const stamp = (iso) => iso.replace(/-/g, "");
    const esc = (s) => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "CALSCALE:GREGORIAN",
      "PRODID:-//" + (prodid || "china-trip") + "//IT"];
    for (const d of deadlines) {
      const end = new Date(Date.UTC(...d.due.split("-").map(Number).map((n, i) => (i === 1 ? n - 1 : n))));
      end.setUTCDate(end.getUTCDate() + 1); // DTEND is exclusive for all-day events
      lines.push("BEGIN:VEVENT",
        "UID:" + d.id + "@china-trip",
        "DTSTART;VALUE=DATE:" + stamp(d.due),
        "DTEND;VALUE=DATE:" + stamp(todayISO(end)),
        "SUMMARY:" + esc(d.title),
        "DESCRIPTION:" + esc([d.desc, d.url].filter(Boolean).join("\n")),
        "BEGIN:VALARM", "TRIGGER:PT9H", "ACTION:DISPLAY",
        "DESCRIPTION:" + esc(d.title), "END:VALARM",
        "END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  return { todayISO, diffDays, resolveView, reorderIds, mergeDayItems, gmaps, amap, amapApp, gmapsApp,
           tel, wechatApp, parseTime, itemMinutes, sortByTime, nextMove, dueList, toICS };
});
