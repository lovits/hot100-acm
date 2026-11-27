export interface SyncProgressMeta { solvedAt?:number; resetAt?:number; favoriteAt?:number }
export interface SyncPlanEntry { first:string; last:string; stage:number; due:string }
export interface SyncEvent { id:string; date:string; kind:'new'|'review'; source:'test'|'manual'; createdAt?:number }
export interface SyncSettings { dailyGoal:number; reviewLimit:number; intervals:number[] }
export interface SyncModel {
    accepted:number[]; favorites:number[]; progressMeta:Record<string,SyncProgressMeta>;
    studyPlan:{learned:Record<string,SyncPlanEntry>; learnedMeta:Record<string,{at:number;deleted:boolean}>; events:SyncEvent[]; resetAt?:number};
    studySettings:SyncSettings; studySettingsAt?:number; codes:Record<string,string>; notes:Record<string,string>;
    history:Record<string,unknown[]>; conflicts:Array<{key:string;id:string;value:string;time:number}>;
    cloudSync?:unknown;
    pendingCloudReset?:{kind:'plan';localApplied:boolean;request:null|{epoch:number;planEpoch:number;revision:number;deviceId:string;requestId:string}};
}
export interface LiveReplica {
    passed:Record<string,boolean>; favorites:string[];
    plan:{learned:Record<string,SyncPlanEntry>; events:SyncEvent[]};
    settings:SyncSettings; codes:Record<string,string>; notes:Record<string,string>;
}
function ordered(value:unknown):unknown {
    if(Array.isArray(value))return value.map(ordered);
    if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,ordered(item)]));
    return value;
}
const same = (a:unknown,b:unknown):boolean => JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
const stamp = (now:number, old=0):number => Math.max(now,old+1);

export function collectReplica(live:LiveReplica, previous:SyncModel|undefined, now:number):SyncModel {
    const initial=!previous;
    const model:SyncModel=previous ? structuredClone(previous) : {
        accepted:[], favorites:[], progressMeta:{}, studyPlan:{learned:{},learnedMeta:{},events:[]},
        studySettings:live.settings, studySettingsAt:1, codes:{},notes:{},history:{},conflicts:[]
    };
    const accepted=Object.entries(live.passed).filter(([,value])=>value).map(([id])=>Number(id)).filter(Number.isSafeInteger);
    for(const id of model.accepted){
        const meta=model.progressMeta[String(id)]||{};
        if(!accepted.includes(id) && (meta.solvedAt||0)>(meta.resetAt||0))accepted.push(id);
    }
    const favorites=live.favorites.map(Number).filter(Number.isSafeInteger);
    const ids=new Set([...accepted,...favorites,...model.accepted,...model.favorites].map(String));
    for(const id of ids){
        const prior=model.progressMeta[id]||{}, oldSolved=model.accepted.includes(Number(id)), solved=accepted.includes(Number(id));
        const oldFavorite=model.favorites.includes(Number(id)), favorite=favorites.includes(Number(id));
        if(initial&&solved)prior.solvedAt=1;
        else if(solved&&!oldSolved)prior.solvedAt=stamp(now,Math.max(prior.solvedAt||0,prior.resetAt||0));
        if(initial&&favorite)prior.favoriteAt=1;
        else if(favorite!==oldFavorite)prior.favoriteAt=stamp(now,prior.favoriteAt);
        model.progressMeta[id]=prior;
    }
    model.accepted=accepted;model.favorites=favorites;
    for(const id of new Set([...Object.keys(model.studyPlan.learned),...Object.keys(live.plan.learned)])){
        const before=model.studyPlan.learned[id], after=live.plan.learned[id];
        if(!same(before,after))model.studyPlan.learnedMeta[id]={at:initial?1:stamp(now,model.studyPlan.learnedMeta[id]?.at),deleted:!after};
    }
    model.studyPlan.learned=structuredClone(live.plan.learned);
    const priorEvents=new Map(model.studyPlan.events.map(event=>[`${event.id}:${event.date}`,event]));
    model.studyPlan.events=live.plan.events.map(event=>({...event,createdAt:event.createdAt||priorEvents.get(`${event.id}:${event.date}`)?.createdAt||(initial?1:now)}));
    if(!same(model.studySettings,live.settings)){model.studySettings=structuredClone(live.settings);model.studySettingsAt=stamp(now,model.studySettingsAt);}
    Object.assign(model.codes,live.codes);Object.assign(model.notes,live.notes);
    return model;
}
