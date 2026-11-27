'use strict';

const Hot100SyncCore = (() => {
  const plans = typeof module !== 'undefined' && module.exports ? require('./study-plan.js') : StudyPlan;
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    return value;
  }
  const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  const empty = () => ({progress: {}, learned: {}, events: {}, drafts: {}, submissions: {}, recoveries: {}, settings: null});
  function draftKey(id, lang, mode) { return `${id}:${lang}:${mode}`; }
  function recoveryId(entry) {
    const text = JSON.stringify([entry.key, String(entry.id), entry.time, entry.value]);
    let a = 2166136261, b = 0x9e3779b9;
    for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b ^ text.charCodeAt(i), 2246822519); }
    return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}:${entry.time}`;
  }
  function capture(state) {
    const view = empty(), accepted = new Set(state.accepted.map(String)), favorites = new Set(state.favorites.map(String));
    const ids = new Set([...accepted, ...favorites, ...Object.keys(state.progressMeta || {})]);
    for (const id of ids) {
      if (!/^\d+$/.test(id)) continue;
      const meta = state.progressMeta?.[id] || {};
      view.progress[id] = {id, solvedAt: meta.solvedAt || (accepted.has(id) ? 1 : 0), resetAt: meta.resetAt || 0, favorite: favorites.has(id), favoriteAt: meta.favoriteAt || (favorites.has(id) ? 1 : 0)};
    }
    const plan = state.studyPlan || {learned: {}, events: []};
    for (const id of new Set([...Object.keys(plan.learned || {}), ...Object.keys(plan.learnedMeta || {})])) {
      const meta = plan.learnedMeta?.[id] || {at: 1, deleted: false}, entry = plan.learned?.[id];
      if (!/^\d+$/.test(id) || (!meta.deleted && !entry)) continue;
      view.learned[id] = {id, updatedAt: meta.at, deleted: !!meta.deleted, ...(!meta.deleted ? {first: entry.first, last: entry.last, stage: entry.stage, due: entry.due || ''} : {})};
    }
    for (const e of plan.events || []) {
      const id = String(e.id), key = `${id}:${e.date}`;
      if (/^\d+$/.test(id)) view.events[key] = {id, date: e.date, eventKind: e.kind, source: e.source, createdAt: e.createdAt || 1};
    }
    for (const [key, code] of Object.entries(state.codes || {})) {
      if (typeof code !== 'string') continue;
      const parts = key.split(':'), id = parts[0], lang = parts[1] || 'python3', mode = parts[2] || 'acm';
      if (!/^\d+$/.test(id) || !['acm', 'core'].includes(mode)) continue;
      view.drafts[draftKey(id, lang, mode)] = {id, lang, mode, code, note: null};
    }
    for (const [id, note] of Object.entries(state.notes || {})) {
      if (/^\d+$/.test(id) && typeof note === 'string') view.drafts[draftKey(id, 'text', 'note')] = {id, lang: 'text', mode: 'note', code: null, note};
    }
    for (const [id, rows] of Object.entries(state.history || {})) for (const row of rows) {
      if (/^\d+$/.test(id) && typeof row.id === 'string') view.submissions[row.id] = {id, submissionId: row.id, value: row};
    }
    for (const entry of state.conflicts || []) {
      if (typeof entry.key !== 'string' || !entry.key || typeof entry.id === 'undefined' || typeof entry.value !== 'string' || !Number.isSafeInteger(entry.time) || entry.time < 0) continue;
      const item = {key:entry.key, id:String(entry.id), value:entry.value, time:entry.time};
      const id = recoveryId(item); view.recoveries[id] = {recoveryId:id, ...item};
    }
    view.settings = {updatedAt: state.studySettingsAt || 1, value: state.studySettings};
    return view;
  }
  function isPristine(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state) || state.cloudSync || state.pendingCloudReset || state.localEpoch || state.storageNamespace) return false;
    for (const key of ['accepted', 'favorites', 'conflicts']) if (!Array.isArray(state[key]) || state[key].length) return false;
    for (const key of ['progressMeta', 'codes', 'notes', 'history', 'testInputs', 'testWorkspaces', 'codeBookmarks']) {
      const value = state[key];
      if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length)) return false;
    }
    const plan = state.studyPlan;
    if (!plan || typeof plan !== 'object' || Array.isArray(plan) || plan.resetAt) return false;
    for (const key of ['learned', 'learnedMeta']) {
      const value = plan[key];
      if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length)) return false;
    }
    if (!Array.isArray(plan.events) || plan.events.length) return false;
    return (!state.studySettingsAt || state.studySettingsAt === 1) && equal(state.studySettings, {dailyGoal: 5, reviewLimit: 20, intervals: [1, 2, 4, 7, 15, 30]});
  }
  function operations(view, known) {
    const result = [];
    for (const domain of ['progress', 'learned', 'events', 'submissions', 'recoveries']) for (const [key, value] of Object.entries(view[domain])) {
      if (!equal(value, known[domain]?.[key])) result.push({kind: {events: 'event', submissions: 'submission', recoveries:'recovery'}[domain] || domain, ...value});
    }
    for (const [key, value] of Object.entries(view.drafts)) {
      const old = known.drafts?.[key];
      if (!old || value.code !== old.code || value.note !== old.note) result.push({kind: 'draft', ...value, baseHash: old?.hash || null});
    }
    if (!equal(view.settings, known.settings)) result.push({kind: 'settings', ...view.settings});
    return result;
  }
  function addConflict(state, key, id, value) {
    if (value === null || value === undefined) return;
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    if (!state.conflicts.some(c => c.key === key && String(c.id) === String(id) && c.value === text)) state.conflicts.push({key, id: String(id), value: text, time: Date.now()});
  }
  function applyDraft(state, known, change, sent) {
    const value = change.value, key = change.entityKey, prior = known.drafts[key], local = capture(state).drafts[key], outgoing = sent.drafts[key];
    const field = value.mode === 'note' ? 'notes' : 'codes', id = value.mode === 'note' ? value.id : value.lang === 'python3' && value.mode === 'acm' ? value.id : key;
    const incoming = field === 'notes' ? value.note : value.code;
    const localText = field === 'notes' ? local?.note : local?.code;
    const priorText = field === 'notes' ? prior?.note : prior?.code;
    const sentText = field === 'notes' ? outgoing?.note : outgoing?.code;
    if (localText !== undefined && localText !== priorText && localText !== incoming) {
      if (localText === sentText) { addConflict(state, field, id, localText); state[field][id] = incoming; }
      else addConflict(state, field, id, incoming);
    } else if (incoming !== null) state[field][id] = incoming;
    known.drafts[key] = value;
  }
  function apply(state, known, changes, sent) {
    if (!known.recoveries) known.recoveries = {};
    for (const change of changes) {
      const value = change.value, key = change.entityKey;
      if (change.kind === 'progress') {
        const meta = state.progressMeta[key] || {}, localFavoriteAt = meta.favoriteAt || (state.favorites.includes(Number(key)) ? 1 : 0);
        const solvedAt = Math.max(meta.solvedAt || (state.accepted.includes(Number(key)) ? 1 : 0), value.solvedAt || 0), resetAt = Math.max(meta.resetAt || 0, value.resetAt || 0);
        state.progressMeta[key] = {solvedAt, resetAt, favoriteAt: Math.max(localFavoriteAt, value.favoriteAt || 0)};
        state.accepted = state.accepted.filter(id => String(id) !== key);
        if (solvedAt > resetAt) state.accepted.push(Number(key));
        if ((value.favoriteAt || 0) >= localFavoriteAt) {
          state.favorites = state.favorites.filter(id => String(id) !== key);
          if (value.favorite) state.favorites.push(Number(key));
        }
        known.progress[key] = {id: key, solvedAt: value.solvedAt, resetAt: value.resetAt, favorite: value.favorite, favoriteAt: value.favoriteAt};
      } else if (change.kind === 'learned') {
        const other = {learned: value.deleted ? {} : {[key]: {first: value.first, last: value.last, stage: value.stage, due: value.due}}, learnedMeta: {[key]: {at: value.updatedAt, deleted: value.deleted}}, events: []};
        state.studyPlan = plans.mergePlans(state.studyPlan, other);
        const {kind, ...item} = value; known.learned[key] = item;
      } else if (change.kind === 'event') {
        const index = state.studyPlan.events.findIndex(e => String(e.id) === value.id && e.date === value.date);
        const incoming = {id: value.id, date: value.date, kind: value.eventKind, source: value.source, createdAt: value.createdAt};
        if (index < 0) state.studyPlan.events.push(incoming);
        else if (!equal(state.studyPlan.events[index], incoming)) { addConflict(state, 'studyEvent', key, state.studyPlan.events[index]); state.studyPlan.events[index] = incoming; }
        const {kind, ...item} = value; known.events[key] = item;
      } else if (change.kind === 'draft') applyDraft(state, known, change, sent);
      else if (change.kind === 'conflict') addConflict(state, value.mode === 'note' ? 'notes' : 'codes', value.mode === 'note' ? value.problemId : draftKey(value.problemId, value.lang, value.mode), value.mode === 'note' ? value.note : value.code);
      else if (change.kind === 'recovery') {
        const {kind, recoveryId: id, ...entry} = value;
        const existing = state.conflicts.find(c => c.key === entry.key && String(c.id) === entry.id && c.value === entry.value);
        if (existing) existing.time = entry.time;
        else state.conflicts.push(entry);
        known.recoveries[key] = {recoveryId:id, ...entry};
      } else if (change.kind === 'submission') {
        const rows = state.history[value.id] || (state.history[value.id] = []);
        const index = rows.findIndex(row => row.id === value.submissionId);
        if (index < 0) rows.push(value.value);
        else if (!equal(rows[index], value.value)) { addConflict(state, 'submission', value.submissionId, rows[index]); rows[index] = value.value; }
        const {kind, ...item} = value; known.submissions[key] = item;
      } else if (change.kind === 'settings') {
        if (value.updatedAt >= (state.studySettingsAt || 1)) { state.studySettings = value.value; state.studySettingsAt = value.updatedAt; }
        known.settings = {updatedAt: value.updatedAt, value: value.value};
      } else if (change.kind === 'plan-reset') {
        if (Object.keys(state.studyPlan.learned).length || state.studyPlan.events.length) addConflict(state, 'studyPlan', 'plan', state.studyPlan);
        state.studyPlan = {learned: {}, learnedMeta: {}, events: [], resetAt: 0};
        known.learned = {}; known.events = {};
      }
    }
    return state;
  }
  return {empty, capture, isPristine, operations, apply};
})();

if (typeof module !== 'undefined') module.exports = Hot100SyncCore;
