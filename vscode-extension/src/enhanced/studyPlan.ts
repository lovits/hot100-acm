export const defaultIntervals = [1,2,4,7,15,30];
export interface Learned { first: string; last: string; stage: number; due: string }
export interface StudyEvent { id: string; date: string; kind: 'new'|'review'; source: 'test'|'manual' }
export interface PlanState { learned: Record<string, Learned>; events: StudyEvent[] }
export function emptyPlan(): PlanState { return {learned:{},events:[]}; }
export function addDays(date: string, days: number): string {
    const [y,m,d] = date.split('-').map(Number); const next = new Date(y,m-1,d+days,12);
    return `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
}
export function intervalsOf(value: unknown): number[] {
    return Array.isArray(value) && value.length > 0 && value.length <= 20
        && value.every((n,i)=>Number.isInteger(n) && n>0 && n<=365 && (i===0 || n>value[i-1])) ? [...value] : [...defaultIntervals];
}
export function recordResult(state: PlanState, id: string, ok: boolean, date: string, intervals: number[], source: StudyEvent['source'] = 'test'): PlanState {
    const next: PlanState = {learned: {...state.learned},events:[...state.events]}; const entry = next.learned[id];
    if (!ok) {
        if (entry?.due && entry.due<=date) { next.learned[id] = {...entry,due:addDays(date,1)}; }
        return next;
    }
    if (next.events.some(e=>e.id===id && e.date===date)) { return next; }
    if (!entry) {
        next.learned[id] = {first:date,last:date,stage:0,due:addDays(date,intervals[0])};
        next.events.push({id,date,kind:'new',source}); return next;
    }
    if (!entry.due || entry.due>date) { return next; }
    const stage = entry.stage+1;
    next.learned[id] = {...entry,last:date,stage,due:stage<intervals.length ? addDays(date,intervals[stage]-intervals[stage-1]) : ''};
    next.events.push({id,date,kind:'review',source}); return next;
}
export function replan(state: PlanState, intervals: number[]): PlanState {
    return {...state,learned:Object.fromEntries(Object.entries(state.learned).map(([id,e])=>[id,{...e,due:e.stage<intervals.length ? addDays(e.last,e.stage===0?intervals[0]:intervals[e.stage]-intervals[e.stage-1]) : ''}]))};
}
export function dayTasks(state: PlanState, date: string, eligible: string[], newGoal: number, reviewLimit: number) {
    const done = state.events.filter(e=>e.date===date); const newDone=done.filter(e=>e.kind==='new'),reviewDone=done.filter(e=>e.kind==='review');
    const reviewed = new Set(done.map(e=>e.id));
    const due = Object.entries(state.learned).filter(([id,e])=>e.due && e.due<=date && !reviewed.has(id)).sort((a,b)=>a[1].due.localeCompare(b[1].due)||Number(a[0])-Number(b[0]));
    return {newDone,reviewDone,newIds:eligible.filter(id=>!state.learned[id]).slice(0,Math.max(0,newGoal-newDone.length)),reviewIds:due.slice(0,Math.max(0,reviewLimit-reviewDone.length)).map(([id])=>id),overdue:due.filter(([,e])=>e.due<date).length,dueTotal:due.length};
}
