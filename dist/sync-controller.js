'use strict';

let cloudState = 'offline', cloudBusy = null, cloudConfigured = false;
function cloudIndicator(value) {
  cloudState = value;
  const button = $('#nav-sync'); if (!button) return;
  let dot = button.querySelector('.cloud-dot');
  if (!dot) { dot = document.createElement('span'); dot.className = 'cloud-dot'; button.append(dot); }
  dot.dataset.state = value;
  button.title = {offline: '远程同步 · 离线', busy: '远程同步 · 同步中', ok: '远程同步 · 已同步', conflict: '远程同步 · 需要处理'}[value];
}
async function cloudRequest(method, path, body, query) {
  const response = await fetch('/api/sync/request', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Hot100-Token': session.token}, body: JSON.stringify({method, path, body, query})});
  const result = await response.json();
  if (!response.ok) { const error = new Error(result.error || '同步失败'); error.status = response.status; throw error; }
  return result;
}
function cloudChunk(operations) {
  const result = []; let bytes = 0;
  for (const op of operations) {
    const size = new TextEncoder().encode(JSON.stringify(op)).length;
    if (size > 3 * 1024 * 1024) throw Error('单条同步数据过大');
    if (result.length >= 256 || bytes + size > 3 * 1024 * 1024) break;
    result.push(op); bytes += size;
  }
  return result;
}
function applyCloud(result, sent) {
  const cloud = state.cloudSync;
  Hot100SyncCore.apply(state, cloud.known, result.changes, sent);
  cloud.revision = result.revision; cloud.planEpoch = result.planEpoch;
  for (const [key, model] of models) {
    const value = state.codes[key];
    if (typeof value === 'string' && value !== model.getValue()) { loadingCode = true; model.setValue(value); loadingCode = false; }
  }
  renderList(); renderContent(); updateStudyBadge();
}
async function cloudSave() {
  persist();
  if (!await flushDisk()) throw Error('本地同步队列尚未保存');
}
async function processCloudReset() {
  for (let attempt = 0; state.pendingCloudReset && attempt < 5; attempt++) {
    const pending = state.pendingCloudReset, cloud = state.cloudSync;
    if (cloud.outbox) {
      try {
        const result = await cloudRequest('POST', '/v1/sync', cloud.outbox.body);
        if (pending.kind === 'plan') applyCloud({...result, changes: result.changes.filter(c => !['learned','event','plan-reset'].includes(c.kind))}, cloud.outbox.sent);
        else { cloud.revision = result.revision; cloud.planEpoch = result.planEpoch; }
        state.cloudSync.outbox = null; await cloudSave(); continue;
      } catch (error) {
        if (error.message !== 'PLAN_EPOCH_MISMATCH') throw error;
        const meta = await cloudRequest('GET', '/v1/meta');
        if (meta.epoch !== cloud.epoch) throw Error('DATA_EPOCH_MISMATCH');
        const ops = cloud.outbox.body.operations.filter(op => !['learned','event'].includes(op.kind));
        cloud.planEpoch = meta.planEpoch;
        cloud.outbox = ops.length ? {...cloud.outbox, body: {...cloud.outbox.body, planEpoch: meta.planEpoch, requestId: crypto.randomUUID(), operations: ops}} : null;
        await cloudSave(); continue;
      }
    }
    if (!pending.request) {
      const meta = await cloudRequest('GET', '/v1/meta');
      if (meta.epoch !== cloud.epoch) throw Error('DATA_EPOCH_MISMATCH');
      pending.request = {epoch: cloud.epoch, revision: meta.revision, deviceId: cloud.deviceId, requestId: crypto.randomUUID(), ...(pending.kind === 'plan' ? {planEpoch: meta.planEpoch} : {})};
      await cloudSave();
    }
    let result;
    try { result = await cloudRequest('POST', pending.kind === 'plan' ? '/v1/reset-plan' : '/v1/reset-all', pending.request); }
    catch (error) {
      if (!['REVISION_MISMATCH','PLAN_EPOCH_MISMATCH'].includes(error.message)) throw error;
      state.pendingCloudReset.request = null; await cloudSave(); continue;
    }
    if (pending.kind === 'all') {
      cloud.epoch = result.epoch; cloud.planEpoch = result.planEpoch; cloud.revision = result.revision; cloud.known = Hot100SyncCore.empty();
    } else {
      const changes = await cloudRequest('GET', '/v1/changes', null, {epoch: cloud.epoch, after: cloud.revision});
      cloud.known.learned = {}; cloud.known.events = {};
      applyCloud({...changes, changes: changes.changes.filter(c => c.revision > result.revision || !['learned','event','plan-reset'].includes(c.kind))}, {drafts: {}});
    }
    state.pendingCloudReset = null; await cloudSave();
  }
  if (state.pendingCloudReset) throw Error('云端数据持续变化，请稍后重试重置');
}
async function runCloudSync() {
  if (!cloudConfigured) return;
  cloudIndicator('busy');
  try {
    if (!state.cloudSync) {
      const meta = await cloudRequest('GET', '/v1/meta');
      if ((meta.epoch || meta.planEpoch) && !state.pendingCloudReset) throw Error('云端曾重置数据；请先导出本地备份并检查恢复方式');
      state.cloudSync = {deviceId: crypto.randomUUID(), epoch: meta.epoch, planEpoch: meta.planEpoch, revision: 0, known: Hot100SyncCore.empty(), outbox: null};
      await cloudSave();
    }
    if (state.pendingCloudReset) await processCloudReset();
    let rounds = 0;
    while (++rounds <= 30) {
      let cloud = state.cloudSync;
      if (!cloud.outbox) {
        const snapshot = Hot100SyncCore.capture(state), ops = cloudChunk(Hot100SyncCore.operations(snapshot, cloud.known));
        if (!ops.length) {
          const result = await cloudRequest('GET', '/v1/changes', null, {epoch: cloud.epoch, after: cloud.revision});
          applyCloud(result, {drafts: {}}); await cloudSave();
          if (!Hot100SyncCore.operations(Hot100SyncCore.capture(state), state.cloudSync.known).length) break;
          continue;
        }
        const draftKeys = new Set(ops.filter(op => op.kind === 'draft').map(op => `${op.id}:${op.lang}:${op.mode}`));
        const sent = {drafts: Object.fromEntries(Object.entries(snapshot.drafts).filter(([key]) => draftKeys.has(key)))};
        cloud.outbox = {body: {epoch: cloud.epoch, planEpoch: cloud.planEpoch, baseRevision: cloud.revision, deviceId: cloud.deviceId, requestId: crypto.randomUUID(), operations: ops}, sent};
        await cloudSave(); cloud = state.cloudSync;
      }
      try {
        const outbox = cloud.outbox;
        const result = await cloudRequest('POST', '/v1/sync', outbox.body);
        applyCloud(result, outbox.sent); state.cloudSync.outbox = null; await cloudSave();
      } catch (error) {
        if (error.message !== 'PLAN_EPOCH_MISMATCH') throw error;
        const result = await cloudRequest('GET', '/v1/changes', null, {epoch: cloud.epoch, after: cloud.revision});
        applyCloud(result, cloud.outbox.sent); state.cloudSync.outbox = null; await cloudSave();
      }
    }
    if (rounds > 30) throw Error('待同步数据较多，稍后继续');
    cloudIndicator(state.conflicts.length ? 'conflict' : 'ok');
  } catch (error) {
    cloudIndicator(error.status === 409 || /重置|过大|EPOCH_MISMATCH/.test(error.message) ? 'conflict' : 'offline');
    throw error;
  }
}
function syncCloud() {
  if (cloudBusy) return cloudBusy;
  const run = () => runCloudSync();
  cloudBusy = (navigator.locks ? navigator.locks.request('hot100-private-sync', {ifAvailable: true}, lock => lock ? run() : undefined) : run()).finally(() => { cloudBusy = null; });
  return cloudBusy;
}
async function cloudDialog() {
  let info;
  try { info = await (await fetch('/api/sync/status')).json(); }
  catch { return notify('无法读取同步配置'); }
  modal('远程同步', `<p>通过已加入的 Tailscale 私网同步学习进度、代码和笔记。</p><p>状态：${esc({offline:'离线',busy:'同步中',ok:'已同步',conflict:'有待处理内容'}[cloudState])}</p><p><label>私网设备名 <input id="cloud-host" value="${esc(info.host || '')}"></label></p><p><label>私网地址 <input id="cloud-address" value="${esc(info.address || '')}"></label></p><p><label>同步令牌 <input id="cloud-token" type="password" autocomplete="off" placeholder="${info.configured ? '已配置，留空保持原令牌' : '输入个人同步令牌'}"></label></p><div class="solution-actions"><button class="button submit" id="cloud-save">保存并同步</button>${info.configured ? '<button class="button" id="cloud-now">立即同步</button>' : ''}</div>`);
  $('#cloud-save').onclick = async () => {
    const token = $('#cloud-token').value;
    if (info.configured && !token) { closeModal(); return syncCloud().catch(error => notify('同步失败：' + error.message)); }
    try {
      const response = await fetch('/api/sync/config', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Hot100-Token': session.token}, body: JSON.stringify({host: $('#cloud-host').value.trim(), address: $('#cloud-address').value.trim(), token})});
      const result = await response.json(); if (!response.ok) throw Error(result.error || '配置失败');
      cloudConfigured = true; closeModal(); await syncCloud(); notify('同步完成');
    } catch (error) { notify('同步失败：' + error.message); }
  };
  if ($('#cloud-now')) $('#cloud-now').onclick = () => { closeModal(); syncCloud().catch(error => notify('同步失败：' + error.message)); };
}
function installCloudSync() {
  $('#nav-sync').onclick = cloudDialog; cloudIndicator('offline');
  fetch('/api/sync/status').then(response => response.json()).then(info => {
    cloudConfigured = !!info.configured;
    if (cloudConfigured) syncCloud().catch(() => {});
  }).catch(() => {});
  setInterval(() => { if (cloudConfigured && navigator.onLine) syncCloud().catch(() => {}); }, 30000);
  window.addEventListener('online', () => { if (cloudConfigured) syncCloud().catch(() => {}); });
}
