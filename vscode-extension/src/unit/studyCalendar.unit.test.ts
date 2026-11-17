import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import {calendarDays,calendarHistory,renderStudyCalendar} from '../enhanced/studyCalendar';
import {emptyPlan,recordResult,defaultIntervals,dayTasks} from '../enhanced/studyPlan';
import {acmTemplate} from '../enhanced/codeTemplates';
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
 const html=renderStudyCalendar({state,today:'2026-11-18',goal:7,limit:20,eligible:['15'],intervals:defaultIntervals,company:'字节跳动'});
 assert.ok(html.includes('今日已完成'));assert.ok(html.includes('tag-chip'));assert.ok(html.includes('考察 127 次'));
 assert.ok(html.includes('data-action=\\"open\\"')||html.includes('data-action="open"'));
 assert.ok(!html.includes('<details'));assert.ok(!html.includes('上次练习'));assert.ok(!html.includes('<table'));assert.ok(!html.includes('去练习'));
 assert.ok(html.includes('上个月'));assert.ok(html.includes('下个月'));assert.ok(html.includes('api.getState()'));assert.ok(html.includes('acquireVsCodeApi'));
});
test('ACM template exists for every original Pro language, without a silent Python fallback',()=>{
 for(const language of SUPPORTED_LANGUAGES)assert.ok(acmTemplate(language.slug).length>15,language.slug);
 assert.ok(acmTemplate('golang').startsWith('package main'));assert.throws(()=>acmTemplate('invalid'));
});
