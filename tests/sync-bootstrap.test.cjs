'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {TextEncoder} = require('node:util');
const core = require('../dist/sync-core');

function fresh() {
  return {accepted:[], favorites:[], conflicts:[], progressMeta:{}, codes:{}, notes:{}, history:{}, testInputs:{}, testWorkspaces:{}, localEpoch:0,
    studyPlan:{learned:{}, learnedMeta:{}, events:[]}, studySettings:{dailyGoal:5,reviewLimit:20,intervals:[1,2,4,7,15,30]}};
}
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function runCase(options={}) {
  const state = options.state || fresh();
  const entries = new Map(Object.entries(options.storage || {}));
  const storage = {get length(){return entries.size;}, key(i){return [...entries.keys()][i] ?? null;}, getItem(k){return entries.has(k)?entries.get(k):null;}};
  const requests = []; let confirms = 0, metaCount = 0, failedPull = false;
  const button = {title:'', querySelector(){return {dataset:{}};}};
  const ctx = {state, session:{token:'test-only',revision:0}, localStorage:storage, Hot100SyncCore:core, TextEncoder, models:new Map(), navigator:{}, crypto:{randomUUID:()=> 'new-device'},
    clone, same:(a,b)=>JSON.stringify(a)===JSON.stringify(b), normalizeState:s=>s, bootstrapInFlight:false, pendingSave:false, serviceStopped:false, pageGeneration:'test-page',
    window:{confirm(){confirms++;return options.confirm !== false;}}, document:{createElement(){return {dataset:{}};}}, $:()=>button,
    persist(){}, flushDisk:async()=>true, renderList(){}, renderContent(){}, updateStudyBadge(){},
    fetch:async(_url,requestOptions)=>{
      const req=JSON.parse(requestOptions.body); requests.push(req);
      if(_url==='/api/sync/bootstrap') return {ok:true,json:async()=>({page:'new-page',token:'new-token',revision:1,state:{...req.state,storageNamespace:'new-namespace',cloudSync:{deviceId:'new-device',epoch:req.epoch,planEpoch:req.planEpoch,revision:0,initialPullPending:true,known:core.empty(),outbox:null}}})};
      if(req.method==='GET' && req.path==='/v1/meta') { metaCount++; return {ok:true,json:async()=>(metaCount>1 && options.changedMeta ? options.changedMeta : {epoch:1,planEpoch:1,revision:28})}; }
      if(req.method==='POST' && req.path==='/v1/sync') {
        if(optionsEpoch(req)===0)return {ok:false,status:409,json:async()=>({error:'DATA_EPOCH_MISMATCH'})};
        const changes=req.body.operations.filter(o=>o.kind==='settings').map(value=>({kind:'settings',entityKey:'settings',value}));
        return {ok:true,json:async()=>({revision:29,planEpoch:1,changes})};
      }
      if(req.method==='GET' && req.path==='/v1/changes') {
        if(options.failFirstPull && !failedPull){failedPull=true;throw Error('offline');}
        return {ok:true,json:async()=>({revision:29,planEpoch:1,changes:options.cloudChanges || []})};
      }
      throw Error('unexpected request');
    }};
  function optionsEpoch(req){return req.body.epoch;}
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(require.resolve('../dist/sync-controller.js'),'utf8'),ctx);
  ctx.confirmCleanBootstrap=async()=>{confirms++;if(options.onConfirm)options.onConfirm(state,entries);return options.confirm!==false;};
  vm.runInContext('cloudConfigured = true',ctx);
  return {ctx,get state(){return ctx.state;},requests,get confirms(){return confirms;}};
}
(async()=>{
  assert.equal(core.isPristine(fresh()),true);
  const mutations=[
    s=>s.accepted.push(1), s=>s.favorites.push(1), s=>s.conflicts.push({}), s=>s.progressMeta['1']={},
    s=>s.codes['1']='old', s=>s.notes['1']='old', s=>s.history['1']=[], s=>s.testInputs['1']='old',
    s=>s.testWorkspaces['1']={}, s=>s.codeBookmarks={'1':{}}, s=>s.studyPlan.learned['1']={}, s=>s.studyPlan.learnedMeta['1']={},
    s=>s.studyPlan.events.push({}), s=>s.studyPlan.resetAt=1, s=>s.localEpoch=1,
    s=>s.studySettings.dailyGoal=10, s=>s.studySettingsAt=2, s=>s.cloudSync={}, s=>s.pendingCloudReset={}
  ];
  for(const mutate of mutations){const state=fresh();mutate(state);assert.equal(core.isPristine(state),false);}
  assert.equal(core.isPristine({}),false);

  let t=runCase(); await assert.rejects(t.ctx.runCloudSync(false),/手动配置/); assert.equal(t.requests.filter(x=>x.method==='POST').length,0); assert.equal(t.confirms,0); assert.equal(t.state.cloudSync,undefined);
  t=runCase({confirm:false}); await assert.rejects(t.ctx.runCloudSync(true),/取消/); assert.equal(t.requests.filter(x=>x.method==='POST').length,0); assert.equal(t.confirms,1); assert.equal(t.state.cloudSync,undefined);
  const stale=fresh(); stale.codes['1']='old user code'; t=runCase({state:stale}); await assert.rejects(t.ctx.runCloudSync(true),/旧数据/); assert.equal(t.requests.filter(x=>x.method==='POST').length,0); assert.equal(t.confirms,0);
  for(const storage of [
    {'hot100-acm:v2:1:cpp:acm':'old code'}, {'hot100-acm:v2:progress':'{}'}, {'training-favorite-changes':'{}'},
    {'hot100-acm-v1':JSON.stringify(stale)}, {'hot100-acm-v1':'not-json'},
    {'hot100-pending':JSON.stringify({base:{},state:stale})}, {'hot100-pending':'not-json'}
  ]) { t=runCase({storage});await assert.rejects(t.ctx.runCloudSync(true),/旧数据/);assert.equal(t.requests.filter(x=>x.method==='POST').length,0);assert.equal(t.confirms,0); }
  const pendingReset=fresh();pendingReset.pendingCloudReset={kind:'all',request:null};t=runCase({state:pendingReset});await assert.rejects(t.ctx.runCloudSync(true),/未完成的重置/);assert.equal(t.requests.length,0);
  t=runCase({onConfirm:(state)=>{state.codes['1']='arrived while waiting';}});await assert.rejects(t.ctx.runCloudSync(true),/数据变更/);assert.equal(t.requests.filter(x=>x.method==='POST').length,0);
  t=runCase({onConfirm:(_state,storage)=>{storage.set('hot100-acm:v2:1:cpp:acm','old');}});await assert.rejects(t.ctx.runCloudSync(true),/数据变更/);assert.equal(t.requests.filter(x=>x.method==='POST').length,0);
  t=runCase({changedMeta:{epoch:2,planEpoch:2,revision:30}});await assert.rejects(t.ctx.runCloudSync(true),/云端重置状态发生变化/);assert.equal(t.requests.filter(x=>x.method==='POST').length,0);
  t=runCase({storage:{'hot100-acm-v1':JSON.stringify(fresh()),'hot100-pending':JSON.stringify({base:{},state:fresh()}),'hot100-acm:v2:theme':'dark','hot100-acm:v2:sidebar-width':'320'}});
  await t.ctx.runCloudSync(true);assert.equal(t.confirms,1);assert.equal(t.state.cloudSync.epoch,1);assert.equal(t.state.cloudSync.planEpoch,1);
  const posts=t.requests.filter(x=>x.method==='POST');assert.equal(posts.length,1);assert.deepEqual(posts[0].body.operations.map(x=>x.kind),['settings']);
  assert.ok(t.requests.findIndex(x=>x.path==='/v1/changes') < t.requests.findIndex(x=>x.path==='/v1/sync'));
  const cloudSettings={dailyGoal:12,reviewLimit:25,intervals:[1,3,7]};
  t=runCase({cloudChanges:[{kind:'settings',entityKey:'plan',value:{updatedAt:50,value:cloudSettings}}]});
  await t.ctx.runCloudSync(true);
  assert.deepEqual(t.state.studySettings,cloudSettings);
  assert.equal(t.requests.filter(x=>x.path==='/v1/sync').length,0);
  assert.equal(t.state.cloudSync.initialPullPending,false);
  t=runCase({failFirstPull:true});
  await assert.rejects(t.ctx.runCloudSync(true),/offline/);
  assert.equal(t.state.cloudSync.initialPullPending,true);
  assert.equal(t.requests.filter(x=>x.path==='/v1/sync').length,0);
  await t.ctx.runCloudSync(true);
  assert.equal(t.state.cloudSync.initialPullPending,false);
  const existing=fresh();existing.cloudSync={epoch:0,planEpoch:0,revision:0,deviceId:'old-device',known:core.empty(),outbox:null};
  existing.codes['1']='old code';t=runCase({state:existing});await assert.rejects(t.ctx.runCloudSync(true),/DATA_EPOCH_MISMATCH/);assert.equal(t.confirms,0);assert.equal(t.state.cloudSync.epoch,0);
  console.log('desktop reset-epoch bootstrap safety passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
