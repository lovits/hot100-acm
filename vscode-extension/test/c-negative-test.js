const fs=require('fs'),assert=require('assert/strict'),{evaluate}=require('../engine'),ps=require('../data/problems.json'),ts=require('../data/tests.json');
(async()=>{const cases=[
 [142,'struct ListNode*detectCycle(struct ListNode*h){struct ListNode*a=calloc(3,sizeof(*a));a[0].val=2;a[1].val=0;a[2].val=-4;a[0].next=a+1;a[1].next=a+2;return a;}'],
 [160,'struct ListNode*getIntersectionNode(struct ListNode*a,struct ListNode*b){struct ListNode*r=calloc(3,sizeof(*r));r[0].val=8;r[1].val=4;r[2].val=5;r[0].next=r+1;r[1].next=r+2;return r;}'],
 [138,'struct Node*copyRandomList(struct Node*h){return h;}']];
 const report=[];for(const [id,code]of cases){const r=await evaluate(ps.find(p=>p.id===id),'c','core',code,[ts[id].core[0]]);assert.ok(!r.error&&r.results[0].ok===false,JSON.stringify(r));report.push({id,rejectedValueOnlyOrAliasedAnswer:true});}
 fs.writeFileSync('test/results-c-negative.json',JSON.stringify(report,null,2));console.log('C identity/copy negative checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
