'use strict';

// Keep the desktop schedule compatible with the VS Code extension's plan data.
const StudyPlan = (() => {
  const defaultIntervals = [1, 2, 4, 7, 15, 30];
  function localDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function intervalsOf(value) {
    return Array.isArray(value) && value.length > 0 && value.length <= 20 && value.every((n, i) => Number.isInteger(n) && n > 0 && n <= 365 && (!i || n > value[i - 1])) ? [...value] : [...defaultIntervals];
  }
  function addDays(date, days) {
    const [year, month, day] = date.split('-').map(Number);
    const next = new Date(year, month - 1, day + days, 12);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
  }
  function record(plan, id, date, intervals = defaultIntervals, source = 'test', alreadySolved = false, now = Date.now()) {
    id = String(id);
    const next = {...plan, learned: {...plan.learned}, events: [...plan.events], learnedMeta: {...plan.learnedMeta}};
    const entry = next.learned[id];
    const recorded = next.events.some(event => event.id === id && event.date === date);
    const updatedAt = Math.max(now, (next.learnedMeta[id]?.at || 0) + 1, (next.resetAt || 0) + 1);
    if (!entry) {
      next.learned[id] = {first: date, last: date, stage: 0, due: addDays(date, intervals[0])};
      next.learnedMeta[id] = {at: updatedAt, deleted: false};
      if (!recorded) next.events.push({id, date, kind: alreadySolved ? 'review' : 'new', source, createdAt: updatedAt});
    } else if (!recorded && entry.due && entry.due <= date) {
      const stage = entry.stage + 1;
      next.learned[id] = {...entry, last: date, stage, due: stage < intervals.length ? addDays(date, intervals[stage] - intervals[stage - 1]) : ''};
      next.learnedMeta[id] = {at: updatedAt, deleted: false};
      next.events.push({id, date, kind: 'review', source, createdAt: updatedAt});
    }
    return next;
  }
  function resetProblem(plan, id, now = Date.now()) {
    const learned = {...plan.learned};
    delete learned[String(id)];
    const at = Math.max(now, (plan.learnedMeta?.[id]?.at || 0) + 1, (plan.resetAt || 0) + 1);
    return {...plan, learned, events: [...plan.events], learnedMeta: {...plan.learnedMeta, [id]: {at, deleted: true}}};
  }
  function mergeProgress(local, remote) {
    const localFavorites = (local.favorites || []).map(String), remoteFavorites = (remote.favorites || []).map(String);
    const ids = new Set([...local.accepted, ...remote.accepted, ...localFavorites, ...remoteFavorites, ...Object.keys(local.progressMeta || {}), ...Object.keys(remote.progressMeta || {})].map(String));
    const accepted = [], favorites = [], progressMeta = {};
    for (const id of ids) {
      if (!/^\d+$/.test(id)) continue;
      const a = local.progressMeta?.[id] || {}, b = remote.progressMeta?.[id] || {};
      const solvedAt = Math.max(a.solvedAt || (local.accepted.map(String).includes(id) ? 1 : 0), b.solvedAt || (remote.accepted.map(String).includes(id) ? 1 : 0));
      const resetAt = Math.max(a.resetAt || 0, b.resetAt || 0);
      const favoriteAtA = a.favoriteAt || (localFavorites.includes(id) ? 1 : 0), favoriteAtB = b.favoriteAt || (remoteFavorites.includes(id) ? 1 : 0);
      progressMeta[id] = {solvedAt, resetAt, favoriteAt: Math.max(favoriteAtA, favoriteAtB)};
      if (solvedAt > resetAt) accepted.push(Number(id));
      if (favoriteAtA > favoriteAtB ? localFavorites.includes(id) : favoriteAtB > favoriteAtA ? remoteFavorites.includes(id) : localFavorites.includes(id) || remoteFavorites.includes(id)) favorites.push(Number(id));
    }
    return {accepted, favorites, progressMeta};
  }
  function mergePlans(local, remote) {
    const resetAt = Math.max(local.resetAt || 0, remote.resetAt || 0);
    const learned = {}, learnedMeta = {};
    const ids = new Set([...Object.keys(local.learned || {}), ...Object.keys(remote.learned || {}), ...Object.keys(local.learnedMeta || {}), ...Object.keys(remote.learnedMeta || {})]);
    for (const id of ids) {
      const a = local.learnedMeta?.[id] || {at: local.learned?.[id] ? 1 : 0, deleted: !local.learned?.[id]};
      const b = remote.learnedMeta?.[id] || {at: remote.learned?.[id] ? 1 : 0, deleted: !remote.learned?.[id]};
      const fromLocal = a.at > b.at || (a.at === b.at && a.deleted && !b.deleted);
      const chosen = fromLocal ? a : b, value = (fromLocal ? local : remote).learned?.[id];
      learnedMeta[id] = chosen;
      if (chosen.at > resetAt && !chosen.deleted && value) learned[id] = value;
    }
    const events = new Map();
    for (const event of [...(local.events || []), ...(remote.events || [])]) {
      if ((event.createdAt || 1) <= resetAt) continue;
      const key = JSON.stringify([String(event.id), event.date]);
      if (!events.has(key)) events.set(key, event);
    }
    return {learned, learnedMeta, events: [...events.values()], resetAt};
  }
  return {defaultIntervals, localDate, intervalsOf, addDays, record, resetProblem, mergeProgress, mergePlans};
})();

if (typeof module !== 'undefined') module.exports = StudyPlan;
