'use strict';
const header=`#ifndef HOT100_TYPES
#define HOT100_TYPES
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>
#include <stdint.h>
#include <limits.h>
#include <math.h>
struct ListNode { int val; struct ListNode *next; };
struct TreeNode { int val; struct TreeNode *left,*right; };
struct Node { int val; struct Node *next,*random; };
#endif
`;
const output=`
static void hstr(const char*s){if(!s){printf("null");return;}putchar('"');for(;*s;s++){unsigned char c=*s;if(c=='"'||c=='\\\\')printf("\\\\%c",c);else if(c<32)printf("\\\\u%04x",c);else putchar(c);}putchar('"');}
static void hlist(struct ListNode*p){struct ListNode**seen=calloc(262144,sizeof(*seen));putchar('[');int count=0;while(p&&count<100000){size_t k=((uintptr_t)p>>3)%262144;while(seen[k]&&seen[k]!=p)k=(k+1)%262144;if(seen[k])break;seen[k]=p;if(count++)putchar(',');printf("%d",p->val);p=p->next;}putchar(']');free(seen);}
static void htree(struct TreeNode*p){struct TreeNode**q=calloc(200002,sizeof(*q));int n=1;q[0]=p;for(int i=0;i<n&&n<200000;i++)if(q[i]){q[n++]=q[i]->left;q[n++]=q[i]->right;}while(n&&!q[n-1])n--;putchar('[');for(int i=0;i<n;i++){if(i)putchar(',');if(q[i])printf("%d",q[i]->val);else printf("null");}putchar(']');free(q);}
static void hrandom(struct Node*p){struct Node**a=calloc(100001,sizeof(*a));int n=0;for(struct Node*q=p;q&&n<100000;q=q->next)a[n++]=q;putchar('[');for(int i=0;i<n;i++){int k=-1;for(int j=0;j<n;j++)if(a[j]==a[i]->random)k=j;if(i)putchar(',');printf("[%d,%d]",a[i]->val,k);}putchar(']');free(a);}
`;
function signatures(code){return [...code.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([\w\s]+?(?:\s*\*\s*)*)\b(\w+)\s*\(([^()]*)\)\s*\{/g)].map(m=>({ret:m[1].trim(),name:m[2],params:m[3].trim()?m[3].split(',').map(s=>{const a=s.trim().match(/^(.*?)\b(\w+)$/);if(!a)throw Error('C signature: '+s);return{type:a[1].trim(),name:a[2]};}):[]}));}
function emit(type,v,n,lines,shared){
 if(type==='listArray'){type='list[]';if(typeof v==='string')v=JSON.parse(v.slice(v.indexOf(':')+1));}
 const declare=(t,x)=>{lines.push(`${t} ${n}=${x};`);return n;};
 if(type==='int'||type==='long'||type==='double'||type==='bool')return declare(type==='long'?'long long':type,JSON.stringify(v));
 if(type==='string'){if(Array.isArray(v))v=v.join('');lines.push(`char ${n}[]=${JSON.stringify(v)};`);return n;}
 if(type==='int[]'||type==='long[]'){lines.push(`${type==='long[]'?'long long':'int'} ${n}[]={${v.length?v.join(','):0}};`);return n;}
 if(['int[][]','char[][]','grid','string[]','string[][]','list[]'].includes(type)){
  let values=v;if(type==='grid'&&typeof v==='string')values=JSON.parse(v.slice(5));
  const child=type==='int[][]'?'int[]':type==='string[][]'?'string[]':type==='list[]'?'list':'string';
  const names=values.map((x,i)=>emit(child,x,n+'_'+i,lines,shared));
  const ct=type==='int[][]'?'int*':type==='string[][]'?'char**':type==='list[]'?'struct ListNode*':'char*';
  lines.push(`${ct} ${n}[]={${names.join(',')||'NULL'}};`);return n;
 }
 if(type==='tree'){
  const a=typeof v==='string'?JSON.parse(v.slice(5)):v;
  lines.push(`struct TreeNode ${n}_nodes[${Math.max(1,a.length)}]={0};`);
  let next=1;for(let i=0;i<a.length;i++)if(a[i]!=null){lines.push(`${n}_nodes[${i}].val=${a[i]};`);for(const side of ['left','right']){if(next<a.length&&a[next]!=null)lines.push(`${n}_nodes[${i}].${side}=&${n}_nodes[${next}];`);next++;}}
  return declare('struct TreeNode*',a.length?'&'+n+'_nodes[0]':'NULL');
 }
 if(['list','cycleList','randomList','intersectList'].includes(type)){
  const prefix=typeof v==='string'?v.split(':')[0]:type;
  if(prefix==='intersectB')return declare('struct ListNode*',shared.b);
  let a=typeof v==='string'?JSON.parse(v.slice(v.indexOf(':')+1)):v;
  if(prefix==='intersectList'&&a===null)return declare('struct ListNode*',shared.b);
  if(prefix==='intersectList'){
   const left=emit('list',a[0],n+'_left',lines,shared),right=emit('list',a[1],n+'_right',lines,shared);
   if(a[2]>=0&&a[3]>=0&&a[2]<a[0].length&&a[3]<a[1].length){if(a[3]===0)lines.push(`${right}=&${n}_left_nodes[${a[2]}];`);else lines.push(`${n}_right_nodes[${a[3]-1}].next=&${n}_left_nodes[${a[2]}];`);}
   shared.b=right;return declare('struct ListNode*',left);
  }
  let pos=-1;if(prefix==='cycleList'){pos=a[1];a=a[0];}
  const random=prefix==='randomList',ct=random?'struct Node':'struct ListNode';
  lines.push(`${ct} ${n}_nodes[${Math.max(1,a.length)}]={0};`);
  a.forEach((x,i)=>{lines.push(`${n}_nodes[${i}].val=${random?x[0]:x};`);if(i+1<a.length)lines.push(`${n}_nodes[${i}].next=&${n}_nodes[${i+1}];`);if(random&&x[1]>=0)lines.push(`${n}_nodes[${i}].random=&${n}_nodes[${x[1]}];`);});
  if(pos>=0)lines.push(`${n}_nodes[${a.length-1}].next=&${n}_nodes[${pos}];`);
  return declare(ct+'*',a.length?'&'+n+'_nodes[0]':'NULL');
 }
 throw Error('Unsupported C input '+type);
}
function printValue(type,v,size='rs',cols='rc'){
 if(type==='void')return 'printf("null");';
 if(type==='bool')return `printf(${v}?"true":"false");`;
 if(['int','long','double'].includes(type))return `printf("%.17g",(double)${v});`;
 if(type==='string')return `hstr(${v});`;
 if(type==='list')return `hlist(${v});`;
 if(type==='tree')return `htree(${v});`;
 if(type==='randomList')return `hrandom(${v});`;
 throw Error('Unsupported C output '+type);
}
// Separate names per nesting level keep row/column traversal independent.
function arrayPrint(type,v,size='rs',cols='rc',depth=0){
 if(!type.endsWith('[]'))return printValue(type,v);
 const i='h'+depth;return `putchar('[');for(int ${i}=0;${i}<${size};${i}++){if(${i})putchar(',');${arrayPrint(type.slice(0,-2),v+'['+i+']',cols+'['+i+']',cols,depth+1)}}putchar(']');`;
}
function buildCDriver(p,code,tests){
 const sigs=signatures(p.officialTemplates.c);if(!sigs.length)throw Error('Missing C signature '+p.id);
 const cases=tests.map((test,ci)=>{
  const lines=[`case ${ci}:{int rs=0;int*rc=NULL;`],shared={};
  if(p.core.kind==='ops'){
   const cls=p.core.className,ctor=sigs.find(s=>s.name.endsWith('Create')),prefix=ctor.name.slice(0,-6);
   lines.push(`${cls}*obj=NULL;printf("{\\"got\\":[");`);
   test.ops.forEach((op,i)=>{if(i)lines.push("putchar(',');");if(op===cls){lines.push(`obj=${ctor.name}(${test.args[i].join(',')});printf("null");`);return;}
    const fn=sigs.find(s=>s.name.toLowerCase()===(prefix+op).toLowerCase());if(!fn)throw Error('C operation '+op);
    const a=test.args[i].map((v,j)=>typeof v==='string'?`(char[]){${[...v].map(c=>c.charCodeAt(0)).concat(0).join(',')}}`:JSON.stringify(v));const call=`${fn.name}(obj${a.length?','+a.join(','):''})`;
    lines.push(fn.ret==='void'?`${call};printf("null");`:printValue(fn.ret,call));
   });lines.push(`printf("]}");${prefix}Free(obj);break;}`);return lines.join('\n');
  }
  const core=p.core,fn=sigs.find(s=>s.name===core.method)||sigs[0];
  core.params.forEach((param,i)=>{if((core.nodeParams||[]).includes(i)){
   const tree=JSON.parse(test.args[0].slice(5)),idx=tree.indexOf(test.args[i]);lines.push(`struct TreeNode*a${i}=${idx<0?'NULL':`&a0_nodes[${idx}]`};`);
  }else emit(param.type,test.args[i],'a'+i,lines,shared);});
  let ai=0,last=-1;const call=[];
  for(const param of fn.params){
   if(param.name==='returnSize'){call.push('&rs');continue;}
   if(param.name==='returnColumnSizes'){call.push('&rc');continue;}
   if(/ColSize$/.test(param.name)){let a=test.args[last];if(typeof a==='string')a=JSON.parse(a.slice(a.indexOf(':')+1));lines.push(`int cols${last}[]={${a.map(x=>x.length).join(',')||0}};`);call.push('cols'+last);continue;}
   if(/Size$/.test(param.name)){let a=test.args[last];if(typeof a==='string'&&a.includes(':')&&['grid','listArray'].includes(core.params[last].type))a=JSON.parse(a.slice(a.indexOf(':')+1));call.push(String(a.length));continue;}
   call.push('a'+ai);last=ai++;
  }
  const expr=`${fn.name}(${call.join(',')})`,mut=core.mutates>=0;
  lines.push(fn.ret==='void'?expr+';':`${fn.ret} result=${expr};`);
  const v=mut?'a'+core.mutates:'result',type=mut?core.params[core.mutates].type:core.returns;
  lines.push('printf("{\\"got\\":");');
  let size='rs',cols='rc';if(mut&&type.endsWith('[]')){let a=test.args[core.mutates];size=String(a.length);if(type==='int[][]'){cols='mutcols';lines.push(`int mutcols[]={${a.map(x=>x.length).join(',')||0}};`);}}
  lines.push(arrayPrint(type,v,size,cols));
  if(core.resultRef){let ref='NULL';if(core.resultRef==='tree'){const a=JSON.parse(test.args[0].slice(5)),e=JSON.parse(test.expected.slice(5));ref=`&a0_nodes[${a.indexOf(e[0])}]`;}else{const a=JSON.parse(test.args[0].slice(test.args[0].indexOf(':')+1)),idx=a[core.resultRef==='cycle'?1:2];ref=idx<0?'NULL':core.resultRef==='cycle'?`&a0_nodes[${idx}]`:`&a0_left_nodes[${idx}]`;}
   lines.push(`printf(",\\"identityOK\\":%s",result==${ref}?"true":"false");`);}
  if(core.copyInput!==undefined){const count=JSON.parse(test.args[0].slice(11)).length;lines.push(`bool copyOK=true;for(struct Node*q=result;q;q=q->next){for(int k=0;k<${count};k++)if(q==&a0_nodes[k]||q->random==&a0_nodes[k])copyOK=false;}printf(",\\\"copyOK\\\":%s",copyOK?"true":"false");`);}
  lines.push('putchar(\'}\');break;}');return lines.join('\n');
 });
 return header+'\n'+code+'\n'+output+'\nint main(int argc,char**argv){if(argc!=2)return 2;switch(atoi(argv[1])){'+cases.join('\n')+'default:return 2;}return 0;}';
}
module.exports={buildCDriver,header,signatures};
