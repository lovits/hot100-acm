const fs=require('fs'),assert=require('assert/strict');const {evaluate}=require('../engine'),ps=require('../data/problems.json'),ts=require('../data/tests.json');const {header}=require('../c-driver');
const mains={
1:'int main(){int n,t,r;scanf("%d",&n);int*a=malloc(n*sizeof(int));for(int i=0;i<n;i++)scanf("%d",a+i);scanf("%d",&t);int*b=twoSum(a,n,t,&r);printf("%d %d\\n",b[0],b[1]);return 0;}',
20:'int main(){char s[100001]={0};fgets(s,sizeof(s),stdin);s[strcspn(s,"\\r\\n")]=0;puts(isValid(s)?"true":"false");return 0;}',
53:'int main(){int n;scanf("%d",&n);int*a=malloc(n*sizeof(int));for(int i=0;i<n;i++)scanf("%d",a+i);printf("%d\\n",maxSubArray(a,n));return 0;}',
70:'int main(){int n;scanf("%d",&n);printf("%d\\n",climbStairs(n));return 0;}',
994:'int main(){int n,m;scanf("%d %d",&n,&m);int**a=malloc(n*sizeof(*a)),*cols=malloc(n*sizeof(int));for(int i=0;i<n;i++){cols[i]=m;a[i]=malloc(m*sizeof(int));for(int j=0;j<m;j++)scanf("%d",a[i]+j);}printf("%d\\n",orangesRotting(a,n,cols));return 0;}'
};
(async()=>{const report={questions:0,cases:0,failures:[],negativeChecks:[]};for(const [id,main]of Object.entries(mains)){const p=ps.find(p=>p.id==id),code=header+fs.readFileSync(`test/c/${id}.c`,'utf8')+'\n'+main;const r=await evaluate(p,'c','acm',code,ts[id].acm);report.questions++;report.cases+=ts[id].acm.length;if(r.error||!r.results.every(x=>x.ok))report.failures.push({id,result:r});}
 const p=ps[0];for(const [name,code]of [['compile-error','invalid C'],['wrong-answer','#include <stdio.h>\nint main(){puts("-1 -1");}'],['timeout','int main(){while(1){}}']]){const r=await evaluate(p,'c','acm',code,[ts[1].acm[0]]);assert.ok(r.error||r.results.some(x=>!x.ok));report.negativeChecks.push(name);}
 fs.writeFileSync('test/results-c-acm.json',JSON.stringify(report,null,2));console.log(report);assert.equal(report.failures.length,0);
})().catch(e=>{console.error(e);process.exitCode=1;});
