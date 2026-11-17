import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import {calendarDays,calendarHistory,renderStudyCalendar} from '../enhanced/studyCalendar';
import {emptyPlan,recordResult,defaultIntervals,dayTasks} from '../enhanced/studyPlan';
import {acmTemplate} from '../enhanced/codeTemplates';
import {catalogById,topCompanyNames} from '../enhanced/catalog';
import {SUPPORTED_LANGUAGES} from '../utils/languageUtils';

test('month calendars align Monday-first, including leap years and six-week months',()=>{
 const november=calendarDays(2026,11);assert.equal(november.length,42);assert.equal(november[6],'2026-11-01');assert.equal(november[35],'2026-11-30');
 assert.equal(calendarDays(2028,2).filter(Boolean).length,29);assert.equal(calendarDays(2027,2).filter(Boolean).length,28);
 assert.equal(calendarDays(2027,1)[4],'2027-01-01');
});
test('calendar counts only actual events, deduplicates repeats, and never forecasts future completions',()=>{
 let state=recordResult(emptyPlan(),'1',true,'2026-11-16',defaultIntervals);
 state=recordResult(state,'1',true,'2026-11-17',defaultIntervals);
 state.events.push({...state.events[1]}, {id:'2',date:'2026-11-20',kind:'new',source:'test'});
 const history=calendarHistory(state,'2026-11-18');assert.equal(history['2026-11-16'].newCount,1);assert.equal(history['2026-11-17'].reviewCount,1);assert.equal(history['2026-11-20'],undefined);
 assert.equal(dayTasks(state,'2026-11-18',['2','3'],5,20).reviewIds[0],'1');
});
test('plan renders direct title links, existing tag chips, and all completed rows without collapse',()=>{
 let state=emptyPlan();for(const id of ['1','2','3','4','5','11'])state=recordResult(state,id,true,'2026-11-18',defaultIntervals);
 const html=renderStudyCalendar({state,today:'2026-11-18',goal:7,limit:20,intervals:defaultIntervals,company:'字节跳动'});
 assert.ok(html.includes('已完成'));assert.ok(html.includes('tag-chip'));assert.ok(html.includes('考察 127 次'));
 assert.ok(html.includes('data-action=\\"open\\"')||html.includes('data-action="open"'));
 assert.ok(!html.includes('<details'));assert.ok(!html.includes('上次练习'));assert.ok(!html.includes('<table'));assert.ok(!html.includes('去练习'));
 assert.ok(html.includes('上个月'));assert.ok(html.includes('下个月'));assert.ok(html.includes('api.getState()'));assert.ok(html.includes('acquireVsCodeApi'));
});
test('ACM template exists for every original Pro language, without a silent Python fallback',()=>{
 for(const language of SUPPORTED_LANGUAGES)assert.ok(acmTemplate(language.slug).length>15,language.slug);
 assert.ok(acmTemplate('golang').startsWith('package main'));assert.throws(()=>acmTemplate('invalid'));
});

test('first day has zero pending reviews and never invents a new-question list',()=>{
 const html=renderStudyCalendar({state:emptyPlan(),today:'2026-11-18',goal:10,limit:20,intervals:defaultIntervals,company:''});
 const data=JSON.parse(html.match(/const api=acquireVsCodeApi\(\),data=(.*);\n/)![1]);
 assert.equal(data.remaining,0);assert.ok(data.todo.includes('待复习 0 道'));assert.equal((data.todo.match(/class="task-group"/g)||[]).length,2);
 assert.ok(!html.includes('待完成新题'));assert.ok(!data.todo.includes('problem-row'));assert.ok(html.includes('今日新题'));assert.ok(html.includes('今日复习'));assert.ok(html.includes('/ 10 道'));
});
test('only actually learned due problems enter pending reviews, while today new completions remain visible',()=>{
 let state=recordResult(emptyPlan(),'1',true,'2026-11-17',defaultIntervals);
 state=recordResult(state,'3',true,'2026-11-18',defaultIntervals);
 const html=renderStudyCalendar({state,today:'2026-11-18',goal:5,limit:20,intervals:defaultIntervals,company:''});
 const data=JSON.parse(html.match(/const api=acquireVsCodeApi\(\),data=(.*);\n/)![1]);
 assert.equal(data.remaining,1);assert.ok(data.todo.includes('data-action="manual" data-id="1"'));assert.ok(data.todo.includes('3. 无重复字符的最长子串'));assert.ok(!data.todo.includes('2. 两数相加'));
 const reviewed=recordResult(state,'1',true,'2026-11-18',defaultIntervals,'manual');
 const next=renderStudyCalendar({state:reviewed,today:'2026-11-18',goal:5,limit:20,intervals:defaultIntervals,company:''});
 const nextData=JSON.parse(next.match(/const api=acquireVsCodeApi\(\),data=(.*);\n/)![1]);assert.equal(nextData.remaining,0);assert.ok(!nextData.todo.includes('data-action="manual"'));assert.equal(nextData.history['2026-11-18'].reviewCount,1);
});

test('related companies show only seven names in frequency order without mutating source data',()=>{
 const p=catalogById.get('1')!;const before=JSON.stringify(p.freq.companies);
 const names=topCompanyNames(p);assert.ok(names.length<=7);assert.deepEqual(names,[...p.freq.companies].sort((a,b)=>b.value-a.value).slice(0,7).map(c=>c.name));assert.equal(JSON.stringify(p.freq.companies),before);assert.ok(names.every(n=>!n.includes('次')));
});
