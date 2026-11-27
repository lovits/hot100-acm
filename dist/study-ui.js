'use strict';

let studyView = {month: new Date(), selected: StudyPlan.localDate(), tab: 'review', query: '', filter: 'all'};
function studyTasks() {
  const today = StudyPlan.localDate(), plan = state.studyPlan;
  const done = plan.events.filter(event => event.date === today);
  const due = Object.entries(plan.learned).filter(([id, item]) => item.due && item.due <= today && !done.some(event => String(event.id) === id));
  due.sort((a, b) => a[1].due.localeCompare(b[1].due) || Number(a[0]) - Number(b[0]));
  return {today, done, due};
}
function updateStudyBadge() {
  const button = $('#nav-study');
  if (!button || !state.studyPlan) return;
  let badge = button.querySelector('#sp-due-badge');
  if (!badge) { badge = document.createElement('span'); badge.id = 'sp-due-badge'; button.append(badge); }
  const count = studyTasks().due.length;
  badge.hidden = !count;
  badge.textContent = count > 99 ? '99+' : String(count);
}
function studyStreak(today, events) {
  const dates = new Set(events.map(event => event.date));
  let day = dates.has(today) ? today : StudyPlan.addDays(today, -1), streak = 0;
  while (dates.has(day)) { streak++; day = StudyPlan.addDays(day, -1); }
  return streak;
}
function studyCalendar() {
  const year = studyView.month.getFullYear(), month = studyView.month.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate(), cells = Math.ceil((offset + count) / 7) * 7;
  const today = StudyPlan.localDate();
  return Array.from({length: cells}, (_, i) => {
    const day = i - offset + 1;
    if (day < 1 || day > count) return '<span class="sp-cell sp-blank"></span>';
    const date = StudyPlan.localDate(new Date(year, month, day, 12));
    const rows = state.studyPlan.events.filter(event => event.date === date);
    const news = rows.filter(event => event.kind === 'new').length, reviews = rows.length - news;
    const heat = rows.length ? `sp-heat-${Math.min(3, Math.ceil(rows.length / 2))}` : '';
    return `<button class="sp-cell ${heat} ${date === studyView.selected ? 'sp-selected' : ''} ${date > today ? 'sp-future' : ''}" data-sp-date="${date}" aria-label="${date} 新题 ${news} 复习 ${reviews}"><span class="sp-day-head"><span>${day}</span>${date === today ? '<small>今</small>' : ''}</span>${date <= today ? `<span class="sp-day-count"><span>新${news}</span> <span class="${reviews ? 'sp-count-active' : ''}">复${reviews}</span></span>` : ''}</button>`;
  }).join('');
}
function studyRows(tasks) {
  const historical = studyView.selected !== tasks.today;
  let rows = historical ? state.studyPlan.events.filter(e => e.date === studyView.selected).map(e => ({...e, type: e.kind})) : studyView.tab === 'review' ? tasks.due.slice(0, state.studySettings.reviewLimit).map(([id, entry]) => ({id, entry, type: 'due'})) : tasks.done.map(e => ({...e, type: e.kind}));
  rows = rows.filter(row => {
    const p = problems.find(item => String(item.id) === String(row.id));
    const matches = p && `${p.id} ${p.title} ${(p.topicTags || []).join(' ')}`.toLowerCase().includes(studyView.query.toLowerCase());
    if (!matches) return false;
    if (studyView.filter === 'overdue') return row.entry?.due < tasks.today;
    if (studyView.filter === 'new' || studyView.filter === 'review') return row.type === studyView.filter;
    return true;
  });
  return rows.map(row => {
    const problem = problems.find(item => String(item.id) === String(row.id));
    const overdue = row.type === 'due' && row.entry.due < tasks.today ? Math.round((Date.parse(tasks.today + 'T12:00:00Z') - Date.parse(row.entry.due + 'T12:00:00Z')) / 86400000) : 0;
    const time = row.createdAt ? new Date(row.createdAt).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}) : '';
    return `<div class="sp-task">${row.type === 'due' ? `<button class="sp-check" data-sp-review="${esc(row.id)}" aria-label="确认复习 ${esc(problem.title)}">✓</button>` : '<span class="sp-done">✓</span>'}<div class="sp-task-main"><button class="sp-task-name" data-sp-problem="${esc(row.id)}">${problem.id}. ${esc(problem.title)}</button> ${overdue ? `<span class="sp-label sp-overdue">逾期 ${overdue} 天</span>` : row.type !== 'due' ? `<span class="sp-label">${row.type === 'new' ? '新题' : '复习'}</span>` : ''}<div class="sp-task-tags">${(problem.topicTags || []).slice(0, 3).map(tag => `<span>${esc(tag)}</span>`).join('')}</div></div><span class="sp-task-end">${esc(problem.difficulty)}<small>${esc(time)}</small></span></div>`;
  }).join('') || '<div class="sp-empty">暂无匹配记录</div>';
}
function renderStudy() {
  const dialog = $('#study-plan-dialog'), tasks = studyTasks(), today = tasks.today;
  const historical = studyView.selected !== today, news = tasks.done.filter(e => e.kind === 'new').length, reviewed = tasks.done.length - news;
  const total = reviewed + tasks.due.length, overdue = tasks.due.filter(([, e]) => e.due < today).length;
  const monthPrefix = `${studyView.month.getFullYear()}-${String(studyView.month.getMonth() + 1).padStart(2, '0')}`;
  const monthDays = new Set(state.studyPlan.events.filter(e => e.date.startsWith(monthPrefix)).map(e => e.date)).size;
  const filters = !historical && studyView.tab === 'review' ? [['all', '全部'], ['overdue', '仅逾期']] : [['all', '全部'], ['new', '新题'], ['review', '复习']];
  dialog.innerHTML = `<div class="sp-shell"><header class="sp-head"><div class="sp-heading">${icon('calendar')}<strong>学习计划</strong><span>间隔 ${state.studySettings.intervals.join('·')} 天</span></div><div class="sp-actions"><button class="icon-btn" data-sp-action="settings" title="目标设置" aria-label="目标设置">${icon('settings')}</button><button class="icon-btn" data-sp-action="backup" title="导出 / 导入备份" aria-label="导出或导入备份">${icon('download')}</button><button class="icon-btn" data-sp-action="reset" title="重置数据" aria-label="重置数据">${icon('reset')}</button><button class="icon-btn" data-sp-action="close" title="关闭" aria-label="关闭学习计划">${icon('close')}</button></div></header><div class="sp-summary"><span>今日新题 <b>${news}/${state.studySettings.dailyGoal}</b><i><em style="width:${Math.min(100, news / state.studySettings.dailyGoal * 100)}%"></em></i></span><span>今日复习 <b>${reviewed}/${total}</b><i><em style="width:${total ? Math.min(100, reviewed / total * 100) : 0}%"></em></i>${overdue ? `<small>${overdue} 逾期</small>` : ''}</span><span>连续打卡 <b>${studyStreak(today, state.studyPlan.events)} 天</b>${tasks.done.length ? '<small class="sp-done-tag">已打卡</small>' : ''}</span><span class="sp-summary-meta">本月 ${monthDays} 天 · 已通过 ${state.accepted.length}/100</span></div><div class="sp-grid"><section class="sp-calendar"><div class="sp-month"><strong>${studyView.month.getFullYear()} 年 ${studyView.month.getMonth() + 1} 月</strong><div><button data-sp-action="prev" aria-label="上个月">‹</button><button data-sp-action="today">今天</button><button data-sp-action="next" aria-label="下个月">›</button></div></div><div class="sp-week">${['一','二','三','四','五','六','日'].map(day => `<span>${day}</span>`).join('')}</div><div class="sp-days">${studyCalendar()}</div><div class="sp-calendar-foot">新/复 = 当日完成 · 点击查记录</div></section><section class="sp-tasks"><div class="sp-tabs">${historical ? `<strong>当日记录 ${esc(studyView.selected)}</strong><button data-sp-action="today">回到今天</button>` : `<button data-sp-tab="review" class="${studyView.tab === 'review' ? 'active' : ''}">待复习 ${tasks.due.length}</button><button data-sp-tab="done" class="${studyView.tab === 'done' ? 'active' : ''}">今日完成 ${tasks.done.length}</button>`}</div><div class="sp-tools"><input id="sp-search" aria-label="搜索题目" placeholder="搜索题号、题名或标签…" value="${esc(studyView.query)}"><select id="sp-filter" aria-label="筛选">${filters.map(([value, text]) => `<option value="${value}" ${studyView.filter === value ? 'selected' : ''}>${text}</option>`).join('')}</select></div><div class="sp-scroll">${studyRows(tasks)}</div></section></div></div>`;
  updateStudyBadge();
}
function studySettings() {
  const settings = state.studySettings;
  const numberInput = (id, value, label) => `<span class="sp-number"><input id="${id}" type="number" min="1" max="100" value="${value}"><span class="sp-number-controls"><button type="button" data-number="${id}" data-step="up" aria-label="增加${label}">▴</button><button type="button" data-number="${id}" data-step="down" aria-label="减少${label}">▾</button></span></span>`;
  modal('学习计划设置', `<p>设置每日目标和复习间隔。</p><p><label for="sp-goal">每日新题目标</label> ${numberInput('sp-goal', settings.dailyGoal, '新题目标')}</p><p><label for="sp-limit">每日复习上限</label> ${numberInput('sp-limit', settings.reviewLimit, '复习上限')}</p><p><label>复习间隔（天） <input id="sp-intervals" value="${esc(settings.intervals.join(','))}"></label></p><p><label><input id="sp-include" type="checkbox"> 纳入已有通过题目</label></p><button class="button submit" id="sp-save-settings">保存</button>`);
  $('#modal-body').querySelectorAll('[data-number]').forEach(button => button.onclick = () => {
    const input = document.getElementById(button.dataset.number);
    button.dataset.step === 'up' ? input.stepUp() : input.stepDown();
    input.dispatchEvent(new Event('input', {bubbles:true}));
  });
  $('#sp-save-settings').onclick = () => {
    const goal = Number($('#sp-goal').value), limit = Number($('#sp-limit').value);
    const raw = $('#sp-intervals').value.split(/[,，\s]+/).filter(Boolean).map(Number), intervals = StudyPlan.intervalsOf(raw);
    if (!Number.isInteger(goal) || goal < 1 || goal > 100 || !Number.isInteger(limit) || limit < 1 || limit > 100 || JSON.stringify(raw) !== JSON.stringify(intervals)) return notify('请输入有效的目标和递增复习间隔');
    const now = Date.now(), today = StudyPlan.localDate();
    state.studySettings = {dailyGoal: goal, reviewLimit: limit, intervals};
    state.studySettingsAt = Math.max(now, (state.studySettingsAt || 0) + 1);
    for (const [id, entry] of Object.entries(state.studyPlan.learned)) {
      entry.due = entry.stage < intervals.length ? StudyPlan.addDays(entry.last, entry.stage === 0 ? intervals[0] : intervals[entry.stage] - intervals[entry.stage - 1]) : '';
      state.studyPlan.learnedMeta = {...state.studyPlan.learnedMeta, [id]: {at: now, deleted: false}};
    }
    if ($('#sp-include').checked) for (const id of state.accepted) if (!state.studyPlan.learned[id]) {
      state.studyPlan.learned[id] = {first: today, last: today, stage: 0, due: StudyPlan.addDays(today, intervals[0])};
      state.studyPlan.learnedMeta = {...state.studyPlan.learnedMeta, [id]: {at: now, deleted: false}};
    }
    persist(); closeModal(); renderStudy();
  };
}
async function resetConfigured() {
  const response = await fetch('/api/sync/status');
  if (!response.ok) throw Error('无法确认同步配置');
  return !!(await response.json()).configured;
}
function resetDataDialog() {
  modal('重置数据', `<p>仅重置学习计划：清空复习排期和日历打卡，保留已通过、代码、笔记、收藏与目标设置。</p><p><button class="button" id="sp-reset-plan">仅重置学习计划</button></p><hr><p>重置所有数据：清空通过进度、学习计划、提交记录、收藏、笔记和代码草稿。云端同步时会保留操作前快照。</p><p><button class="button" id="sp-export-before-reset">先导出备份</button></p><p><label>输入“重置”确认 <input id="sp-reset-confirm" autocomplete="off"></label></p><button class="button sp-danger" id="sp-reset-all" disabled>重置所有数据</button>`);
  let exported = false;
  const confirm = $('#sp-reset-confirm'), all = $('#sp-reset-all');
  $('#sp-export-before-reset').onclick = () => {
    saveCode(); saveView();
    const {cloudSync, pendingCloudReset, ...backup} = state;
    download('hot100-acm-before-reset.json', JSON.stringify({app: KEY, schemaVersion: 2, ...backup}, null, 2), 'application/json');
    exported = true; all.disabled = confirm.value !== '重置';
  };
  confirm.oninput = () => { all.disabled = !exported || confirm.value !== '重置'; };
  $('#sp-reset-plan').onclick = () => executeReset('plan').catch(error => notify('重置失败：' + error.message));
  all.onclick = () => executeReset('all').catch(error => notify('重置失败：' + error.message));
}
async function executeReset(kind) {
  if (state.pendingCloudReset) throw Error('上一次重置尚未同步，请先完成同步');
  if (cloudBusy) await cloudBusy.catch(() => {});
  const configured = await resetConfigured();
  saveCode(); saveView(); persist();
  if (!await flushDisk()) throw Error('本地数据尚未保存');
  const now = Date.now();
  if (kind === 'plan') {
    const latest = Math.max(state.studyPlan.resetAt || 0, ...Object.values(state.studyPlan.learnedMeta || {}).map(meta => meta.at || 0));
    state.studyPlan = {learned: {}, learnedMeta: {}, events: [], resetAt: Math.max(now, latest + 1)};
  } else {
    loadingCode = true;
    editor.instance.setModel(null);
    for (const model of models.values()) model.dispose();
    models.clear();
    Object.assign(state, {codes: {}, notes: {}, history: {}, accepted: [], favorites: [], progressMeta: {}, conflicts: [], editorViews: {}, reading: {}, testInputs: {}, testWorkspaces: {}, codeBookmarks: {}, studyPlan: {learned: {}, learnedMeta: {}, events: [], resetAt: now}, studySettings: {dailyGoal: 5, reviewLimit: 20, intervals: [...StudyPlan.defaultIntervals]}, studySettingsAt: now, localEpoch: (state.localEpoch || 0) + 1});
    for (const key of Object.keys(localStorage)) if (/^hot100-acm:v2:(?:progress|starred|\d+:)/.test(key) || key === 'training-favorite-changes') localStorage.removeItem(key);
    editor.switchProblem(current); loadingCode = false;
    $('#problem-content').dataset.version = '';
  }
  if (configured) state.pendingCloudReset = {kind, request: null};
  persist(); await flushDisk(); renderList(); renderContent(); updateStudyBadge();
  closeModal(); if ($('#study-plan-dialog').open) renderStudy();
  notify(configured ? '本地已重置，联网后同步到云端' : '本地数据已重置');
  if (configured) syncCloud().catch(() => {});
}
function installStudyUI() {
  const dialog = $('#study-plan-dialog');
  $('#nav-reset').onclick = resetDataDialog;
  $('#nav-study').onclick = () => { studyView = {month: new Date(), selected: StudyPlan.localDate(), tab: 'review', query: '', filter: 'all'}; renderStudy(); dialog.showModal(); };
  dialog.addEventListener('click', event => {
    if (event.target === dialog || event.target.closest('[data-sp-action="close"]')) return dialog.close();
    const action = event.target.closest('[data-sp-action]')?.dataset.spAction;
    if (action === 'prev' || action === 'next') { studyView.month = new Date(studyView.month.getFullYear(), studyView.month.getMonth() + (action === 'next' ? 1 : -1), 1, 12); return renderStudy(); }
    if (action === 'today') { studyView.month = new Date(); studyView.selected = StudyPlan.localDate(); studyView.filter = 'all'; return renderStudy(); }
    if (action === 'settings') return studySettings();
    if (action === 'backup') return progress();
    if (action === 'reset') return resetDataDialog();
    const date = event.target.closest('[data-sp-date]')?.dataset.spDate;
    if (date) { studyView.selected = date; studyView.filter = 'all'; return renderStudy(); }
    const tab = event.target.closest('[data-sp-tab]')?.dataset.spTab;
    if (tab) { studyView.tab = tab; studyView.filter = 'all'; return renderStudy(); }
    const problem = event.target.closest('[data-sp-problem]')?.dataset.spProblem;
    if (problem) { dialog.close(); return go(Number(problem)); }
    const review = event.target.closest('[data-sp-review]')?.dataset.spReview;
    if (review) { state.studyPlan = StudyPlan.record(state.studyPlan, review, StudyPlan.localDate(), state.studySettings.intervals, 'manual', true); persist(); renderStudy(); }
  });
  dialog.addEventListener('input', event => {
    if (event.target.id !== 'sp-search') return;
    studyView.query = event.target.value;
    dialog.querySelector('.sp-scroll').innerHTML = studyRows(studyTasks());
  });
  dialog.addEventListener('change', event => { if (event.target.id === 'sp-filter') { studyView.filter = event.target.value; renderStudy(); } });
  document.addEventListener('click', event => {
    const toggle = event.target.closest('#sp-solved'), reset = event.target.closest('#sp-reset-one');
    if (toggle) { const button = $('#sp-reset-one'); button.hidden = !button.hidden; toggle.setAttribute('aria-expanded', String(!button.hidden)); return; }
    if (reset) {
      const id = current.id, meta = state.progressMeta[id] || {};
      state.progressMeta[id] = {...meta, solvedAt: meta.solvedAt || 1, resetAt: Math.max(Date.now(), (meta.solvedAt || 0) + 1, (meta.resetAt || 0) + 1)};
      state.accepted = state.accepted.filter(value => value !== id);
      state.studyPlan = StudyPlan.resetProblem(state.studyPlan, id, state.progressMeta[id].resetAt);
      persist(); renderList(); renderContent(); updateStudyBadge(); return;
    }
    const button = $('#sp-reset-one'); if (button) { button.hidden = true; $('#sp-solved')?.setAttribute('aria-expanded', 'false'); }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && $('#sp-reset-one')) { $('#sp-reset-one').hidden = true; $('#sp-solved')?.setAttribute('aria-expanded', 'false'); } });
  updateStudyBadge();
}
