import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import {collectReplica,LiveReplica} from '../enhanced/syncReplica';
import {validPrivateServer} from '../enhanced/syncNetwork';

function live():LiveReplica {return {passed:{'1':true},favorites:['1'],plan:{learned:{'1':{first:'2026-11-01',last:'2026-11-01',stage:0,due:'2026-11-02'}},events:[{id:'1',date:'2026-11-01',kind:'new',source:'test'}]},settings:{dailyGoal:5,reviewLimit:20,intervals:[1,2,4,7,15,30]},codes:{'1':'code'},notes:{'1':'note'}};}
test('missing local passed data cannot reset previously synced progress',()=>{
    const first=collectReplica(live(),undefined,100);
    assert.equal(first.progressMeta['1'].solvedAt,1);
    assert.equal(first.progressMeta['1'].favoriteAt,1);
    assert.equal(first.studyPlan.learnedMeta['1'].at,1);
    const next=live();next.passed={};next.favorites=[];next.plan.learned={};
    const reset=collectReplica(next,first,200);
    assert.equal(reset.progressMeta['1'].resetAt,undefined);
    assert.deepEqual(reset.accepted,[1]);
    assert.equal(reset.progressMeta['1'].favoriteAt,200);
    assert.equal(reset.studyPlan.learnedMeta['1'].deleted,true);
    assert.equal(reset.studyPlan.events.length,1);
    assert.equal(reset.codes['1'],'code');assert.equal(reset.notes['1'],'note');
});
test('only Tailscale IP addresses and ts.net device names are accepted',()=>{
    assert.equal(validPrivateServer({host:'hot100.example.ts.net',address:'100.64.0.1'}),true);
    for(const address of ['127.0.0.1','8.8.8.8','100.128.0.1'])assert.equal(validPrivateServer({host:'hot100.example.ts.net',address}),false);
    assert.equal(validPrivateServer({host:'attacker.example',address:'100.64.0.1'}),false);
});
