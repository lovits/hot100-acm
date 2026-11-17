import {randomBytes} from 'crypto';
import {catalogById, frequency} from './catalog';
import {dayTasks, PlanState, StudyEvent} from './studyPlan';
import {escapeHtml} from '../utils/htmlUtil';

interface CalendarOptions {
    state:PlanState; today:string; goal:number; limit:number; intervals:number[]; company:string;
}
export function calendarDays(year:number,month:number):Array<string|null> {
    const start=(new Date(year,month-1,1,12).getDay()+6)%7;
    const count=new Date(year,month,0,12).getDate();
    const days:Array<string|null>=Array(start).fill(null);
    for(let day=1;day<=count;day++)days.push(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`);
    while(days.length%7)days.push(null);
    return days;
}
export function calendarHistory(state:PlanState,today:string):Record<string,{newCount:number;reviewCount:number;events:StudyEvent[]}> {
    const history:ReturnType<typeof calendarHistory>={};
    for(const event of state.events){
        if(event.date>today)continue;
        const day=history[event.date]??(history[event.date]={newCount:0,reviewCount:0,events:[]});
        if(day.events.some(e=>e.id===event.id))continue;
        day.events.push(event);if(event.kind==='new')day.newCount++;else day.reviewCount++;
    }
    return history;
}
function problemRow(id:string,company:string,done=false,kind='',review=false) {
    const p=catalogById.get(id);if(!p)return '';
    const chips=[`考察 ${frequency(p,company)} 次`,...p.topicTags.filter(Boolean)];
    return `<article class="problem-row">${review?`<button class="status review-check" role="checkbox" aria-checked="false" aria-label="标记 ${escapeHtml(p.title)} 复习完成" data-action="manual" data-id="${id}">○</button>`:`<span class="status" aria-label="${done?'已完成':'待完成'}">${done?'✓':'○'}</span>`}<div class="problem-info"><button class="problem-link" data-action="open" data-id="${id}">${p.id}. ${escapeHtml(p.title)}</button><div class="tag-chips">${chips.map(t=>`<span class="tag-chip">${escapeHtml(t)}</span>`).join('')}</div></div><span class="difficulty ${p.difficulty==='简单'?'easy':p.difficulty==='困难'?'hard':'medium'}">${escapeHtml(p.difficulty)}${kind?`<small>${escapeHtml(kind)}</small>`:''}</span></article>`;
}
function group(title:string,summary:string,rows:string) {
    return `<section class="task-group"><header><h3>${title}</h3><span>${summary}</span></header>${rows||'<p class="empty">暂无题目</p>'}</section>`;
}
export function renderStudyCalendar(options:CalendarOptions):string {
    const {state,today,goal,limit,intervals,company}=options;
    const history=calendarHistory(state,today),task=dayTasks(state,today,[],goal,limit);
    const done=[...task.newDone,...task.reviewDone];
    const todo=group('待完成',`待复习 ${task.reviewIds.length} 道`,task.reviewIds.map(id=>problemRow(id,company,false,'',true)).join(''))
        +group('已完成',`新题 ${task.newDone.length} · 复习 ${task.reviewDone.length}`,done.map(e=>problemRow(e.id,company,true,e.kind==='new'?'新题':'复习')).join(''));
    const data=Object.fromEntries(Object.entries(history).map(([date,h])=>[date,{...h,html:group('已完成练习',`新题 ${h.newCount} · 复习 ${h.reviewCount}`,h.events.map(e=>problemRow(e.id,company,true,e.kind==='new'?'新题':'复习')).join(''))}]));
    const json=JSON.stringify({today,history:data,todo,remaining:task.reviewIds.length}).replace(/</g,'\\u003c');
    const nonce=randomBytes(18).toString('base64');
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'nonce-${nonce}';script-src 'nonce-${nonce}'"><title>学习计划</title><style nonce="${nonce}">
*{box-sizing:border-box}body{margin:0;color:var(--vscode-editor-foreground,#eeeff4);background:var(--vscode-editor-background,#252733);font:var(--vscode-font-size,14px)/1.6 var(--vscode-font-family,system-ui);--border:var(--vscode-panel-border,#454355);--muted:var(--vscode-descriptionForeground,#acabba);--accent:var(--vscode-textLink-foreground,#c1a0ed)}main{max-width:860px;margin:auto;padding:20px 24px 32px}button{font:inherit;color:inherit;background:transparent;border:1px solid var(--border);border-radius:5px;cursor:pointer;padding:5px 10px}button:hover{background:var(--vscode-list-hoverBackground,#ffffff08)}button:focus-visible{outline:2px solid var(--vscode-focusBorder,#c1a0ed);outline-offset:2px}.top,.monthbar,.section-heading,.task-group header{display:flex;align-items:center;justify-content:space-between;gap:12px}h1{font-size:24px;margin:0}h2{font-size:18px;margin:0}h3{font-size:14px;margin:0}.top p{color:var(--muted);margin:4px 0;font-size:13px}.settings{display:flex;flex-wrap:wrap;gap:8px}.text-button{color:var(--accent);border:0;padding:4px 0;font-size:12px}.overview{display:flex;gap:28px;margin:22px 0;padding-bottom:20px;border-bottom:1px solid var(--border)}.metric{flex:1}.metric>span{font-size:12px;color:var(--muted)}.metric strong{display:block;font-size:24px;font-weight:600}.metric small{font-size:13px;font-weight:400;color:var(--muted)}.bar{height:3px;background:var(--border);margin-top:8px;border-radius:3px;overflow:hidden}.bar i{display:block;height:100%;background:var(--accent)}.new-progress{width:${Math.min(100,task.newDone.length/goal*100)}%}.review-progress{width:${task.reviewDone.length/Math.max(1,task.reviewDone.length+task.reviewIds.length)*100}%}.calendar{border:1px solid var(--border);border-radius:8px;overflow:hidden}.monthbar{padding:12px 14px}.monthbar strong{font-size:16px}.monthnav{display:flex;gap:6px}.monthnav button{padding:3px 10px}.week,.days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}.week span{padding:7px;text-align:center;color:var(--muted);font-size:12px;background:var(--vscode-sideBar-background,#232530)}.day{height:52px;border-style:solid;border-color:var(--border);border-radius:0;border-width:1px 1px 0 0;padding:6px 10px;text-align:left;display:flex;flex-direction:column;justify-content:center;gap:3px;min-width:0}.day:nth-child(7n){border-right:0}.day-number{font-size:16px;line-height:22px}.day-number em{font-size:11px;float:right;font-style:normal;color:var(--accent)}.counts{font-size:12px;color:var(--muted);white-space:nowrap}.day.selected{box-shadow:inset 0 0 0 1px var(--accent);background:var(--vscode-list-inactiveSelectionBackground,#353144)}.selected .day-number{font-weight:600;color:var(--accent)}.future{color:var(--muted)}.blank{background:var(--vscode-sideBar-background,#232530)}.calendar-note{margin:8px 0;color:var(--muted);font-size:12px}.section-heading{margin:18px 0 10px}.section-heading span{font-size:12px;color:var(--muted)}.task-group{border:1px solid var(--border);border-radius:7px;margin:8px 0;overflow:hidden}.task-group header{padding:9px 14px;background:var(--vscode-tab-inactiveBackground,#ffffff04)}.task-group header>span{font-size:12px;color:var(--muted)}.problem-row{display:flex;align-items:flex-start;gap:8px;padding:8px 12px;border-top:1px solid var(--border)}.review-check{padding:0;border:0;border-radius:4px;flex-shrink:0;min-width:24px;min-height:24px;cursor:pointer}.status{width:24px;flex-shrink:0;font-size:19px;line-height:24px;color:var(--muted)}.problem-info{min-width:0;flex:1;display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px}.problem-link{padding:0;border:0;text-align:left;font-size:14px;line-height:24px;color:var(--vscode-editor-foreground,#eeeff4)}.problem-link:hover{color:var(--vscode-editor-foreground,#eeeff4);text-decoration:none;background:var(--vscode-list-hoverBackground,#ffffff08)}.tag-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0}.tag-chip{padding:1px 8px;border-radius:12px;font-size:12px;background:var(--vscode-tab-inactiveBackground,#ffffff04);border:1px solid var(--border)}.difficulty{font-size:12px;white-space:nowrap;line-height:24px}.difficulty small{display:block;text-align:right;color:var(--muted);font-size:11px}.easy{color:var(--vscode-testing-iconPassed,#73b99e)}.medium{color:var(--vscode-editorWarning-foreground,#e4bb70)}.hard{color:var(--vscode-errorForeground,#e38a91)}.empty{color:var(--muted);padding:6px 14px;font-size:13px}
@media(max-width:620px){main{padding:18px 14px 30px}.top{align-items:flex-start}.settings{justify-content:flex-end;max-width:132px;gap:2px}.top p{font-size:12px}h1{font-size:22px}.overview{gap:14px}.day{height:52px;padding:5px}.day-number{font-size:15px}.day-number em{display:none}.counts{font-size:11px}.problem-row{padding:10px;gap:8px}.task-group header{padding:9px 10px}.tag-chip{font-size:12px;padding:1px 8px}}
@media(max-width:380px){.counts{font-size:10px}.overview{gap:10px}.metric strong{font-size:22px}}
</style></head><body><main><div class="top"><div><h1>学习计划</h1><p>记录每一次练习，安排今天的复习。</p></div><div class="settings"><button class="text-button" data-action="configure">修改目标与间隔</button><button class="text-button" data-action="include">纳入已有通过题目</button></div></div><div class="overview"><div class="metric"><span>今日新题</span><strong>${task.newDone.length} <small>/ ${goal} 道</small></strong><div class="bar"><i class="new-progress"></i></div></div><div class="metric"><span>今日复习</span><strong>${task.reviewDone.length} <small>/ ${task.reviewDone.length+task.reviewIds.length} 道</small></strong><div class="bar"><i class="review-progress"></i></div></div><div class="metric"><span id="practice-label">本月练习</span><strong><b id="practice-days">0</b> <small>天</small></strong></div></div><section class="calendar" aria-label="练习日历"><div class="monthbar"><strong id="month"></strong><div class="monthnav"><button id="previous" aria-label="上个月">‹</button><button id="today">今天</button><button id="next" aria-label="下个月">›</button></div></div><div class="week">${['一','二','三','四','五','六','日'].map(d=>`<span>${d}</span>`).join('')}</div><div class="days" id="days"></div></section><p class="calendar-note">日期下方为实际完成量 · 新题 / 复习 · 复习间隔：${intervals.join('、')} 天</p><div class="section-heading"><h2 id="heading"></h2><span id="summary"></span></div><div id="tasks"></div></main><script nonce="${nonce}">
const api=acquireVsCodeApi(),data=${json};
const saved=api.getState(),initial=data.today.split('-').map(Number);let year=initial[0],month=initial[1],selected=data.today;
if(saved&&saved.today===data.today&&Number.isInteger(saved.year)&&saved.year>=1900&&saved.year<=2200&&Number.isInteger(saved.month)&&saved.month>=1&&saved.month<=12&&/^\\d{4}-\\d{2}-\\d{2}$/.test(saved.selected)){year=saved.year;month=saved.month;selected=saved.selected;}
const el=id=>document.getElementById(id);
function render(){
 el('month').textContent=year+' 年 '+month+' 月';el('practice-days').textContent=Object.keys(data.history).filter(d=>d.startsWith(year+'-'+String(month).padStart(2,'0')+'-')).length;
 el('days').replaceChildren();const start=(new Date(year,month-1,1,12).getDay()+6)%7,count=new Date(year,month,0,12).getDate(),length=Math.ceil((start+count)/7)*7;
 for(let i=0;i<length;i++){const day=i-start+1,blank=day<1||day>count;if(blank){const cell=document.createElement('div');cell.className='day blank';el('days').append(cell);continue;}
 const date=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0'),h=data.history[date],b=document.createElement('button');b.className='day'+(date===selected?' selected':'')+(date>data.today?' future':'');b.dataset.date=date;b.setAttribute('aria-pressed',String(date===selected));b.setAttribute('aria-label',date+(h?' 新题 '+h.newCount+' 道，复习 '+h.reviewCount+' 道':''));
 b.innerHTML='<span class="day-number">'+day+(date===data.today?'<em>今天</em>':'')+'</span>'+(h?'<span class="counts">新 '+h.newCount+' · 复 '+h.reviewCount+'</span>':'');el('days').append(b);}
 const h=data.history[selected];el('heading').textContent=selected===data.today?'今日复习':'当日记录';el('summary').textContent=selected+' · '+(selected===data.today?'待完成 '+data.remaining+' 道':h?'新题 '+h.newCount+' · 复习 '+h.reviewCount:'暂无记录');
 el('tasks').innerHTML=selected===data.today?data.todo:h?h.html:'<p class="empty">'+(selected>data.today?'不预排未来任务，到当天根据实际练习记录生成。':'这一天没有练习记录。')+'</p>';api.setState({year,month,selected,today:data.today});
}
el('days').onclick=e=>{const b=e.target.closest('[data-date]');if(b){selected=b.dataset.date;render();}};
function move(step){const date=new Date(year,month-1+step,1,12);year=date.getFullYear();month=date.getMonth()+1;selected=year+'-'+String(month).padStart(2,'0')+'-01';render();}
el('previous').onclick=()=>move(-1);el('next').onclick=()=>move(1);el('today').onclick=()=>{year=initial[0];month=initial[1];selected=data.today;render();};
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)api.postMessage({type:b.dataset.action,id:b.dataset.id});});render();
</script></body></html>`;
}
