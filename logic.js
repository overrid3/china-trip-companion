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
    const kw = item.zh || item.title;
    const city = item.cityZh || item.city || "";
    // callnative=1 opens the Amap app on Android; src+coordinate are required for the
    // web fallback to render results instead of a blank landing page.
    return "https://uri.amap.com/search?keyword=" + encodeURIComponent(kw) +
      (city ? "&city=" + encodeURIComponent(city) : "") +
      "&src=china-trip&coordinate=gaode&callnative=1";
  }

  return { todayISO, diffDays, resolveView, reorderIds, mergeDayItems, gmaps, amap };
});
