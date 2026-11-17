import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import {emptyPlan,recordResult,dayTasks,defaultIntervals,addDays,replan,intervalsOf} from '../enhanced/studyPlan';
import {catalog,catalogById,defaultFilters,matches,frequency} from '../enhanced/catalog';
test('default daily five new questions and cumulative review schedule',()=>{
 let state=emptyPlan();const eligible=Array.from({length:100},(_,i)=>String(i+1));
 for(let day=0;day<5;day++){
  const date=addDays('2026-11-17',day),t=dayTasks(state,date,eligible,5,100);
  assert.equal(t.newIds.length,5);assert.equal(t.reviewIds.length,[0,5,10,10,15][day]);
  for(const id of [...t.newIds,...t.reviewIds])state=recordResult(state,id,true,date,defaultIntervals);
 }
});
test('language/mode repeats on the same day do not count new or review twice',()=>{
 let s=recordResult(emptyPlan(),'1',true,'2026-11-17',defaultIntervals);
 s=recordResult(s,'1',true,'2026-11-17',defaultIntervals);assert.equal(s.events.length,1);
 s=recordResult(s,'1',true,'2026-11-18',defaultIntervals);s=recordResult(s,'1',true,'2026-11-18',defaultIntervals);
 assert.equal(s.events.length,2);assert.equal(s.learned['1'].stage,1);
});
test('early passes and opening a problem cannot complete a scheduled review',()=>{
 const s=recordResult(emptyPlan(),'1',true,'2026-11-17',[2,4]);
 assert.deepEqual(recordResult(s,'1',true,'2026-11-18',[2,4]),s);
 assert.equal(dayTasks(s,'2026-11-18',[],5,20).reviewIds.length,0);
});
test('missed reviews carry forward, cap does not drop tasks, actual completion shifts next due',()=>{
 let s=emptyPlan();for(const id of ['1','2','3'])s=recordResult(s,id,true,'2026-11-17',defaultIntervals);
 const tasks=dayTasks(s,'2026-11-21',[],5,1);assert.equal(tasks.reviewIds.length,1);assert.equal(tasks.dueTotal,3);assert.equal(tasks.overdue,3);
 s=recordResult(s,'1',true,'2026-11-21',defaultIntervals);assert.equal(s.learned['1'].due,'2026-11-22');assert.equal(s.learned['1'].stage,1);
});
test('failure never advances a review and tomorrow remains due',()=>{
 let s=recordResult(emptyPlan(),'1',true,'2026-11-17',defaultIntervals);s=recordResult(s,'1',false,'2026-11-18',defaultIntervals);
 assert.equal(s.learned['1'].stage,0);assert.equal(s.learned['1'].due,'2026-11-19');assert.equal(s.events.length,1);
});
test('editing goals and intervals preserves completed events and stage',()=>{
 const s=recordResult(emptyPlan(),'1',true,'2026-11-17',defaultIntervals);
 assert.equal(dayTasks(s,'2026-11-17',['1','2','3','4'],2,10).newIds.length,1);
 const next=replan(s,[2,5,10]);assert.deepEqual(next.events,s.events);assert.equal(next.learned['1'].due,'2026-11-19');
});
test('interval validation and dates cross months and years',()=>{
 for(const input of [[0,2],[2,1],[-1],[],[366]])assert.deepEqual(intervalsOf(input),defaultIntervals);
 assert.equal(addDays('2026-12-31',1),'2027-01-01');assert.equal(addDays('2028-02-28',1),'2028-02-29');
});
test('topic/company/difficulty/status-independent tags compose as an intersection and frequencies match company',()=>{
 const p=catalogById.get('1')!;assert.ok(matches(p,{...defaultFilters,company:'字节跳动',difficulty:'简单',tag:'哈希表'}));
 assert.ok(!matches(p,{...defaultFilters,difficulty:'困难'}));assert.ok(!matches(p,{...defaultFilters,company:'不存在的公司'}));
 assert.equal(frequency(p,'字节跳动'),127);assert.equal(frequency(p),306);assert.equal(catalog.length,100);
});
