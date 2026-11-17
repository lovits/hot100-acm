'use strict';
const key=value=>JSON.stringify(value);
const sorted=values=>values.slice().sort((a,b)=>key(a).localeCompare(key(b)));

function balancedBST(values, input){
  if(!Array.isArray(input))return false;
  if(!input.length)return values==null||(Array.isArray(values)&&!values.length);
  if(!Array.isArray(values)||!values.length)return false;
  const root={value:values[0]},queue=[root];let next=1;
  for(let i=0;i<queue.length&&next<values.length;i++)for(const side of ['left','right']){
    const value=values[next++];
    if(value!=null){const node={value};queue[i][side]=node;queue.push(node);}
  }
  if(next<values.length)return false;
  const inorder=[];
  function visit(node){
    if(!node)return 0;
    const left=visit(node.left);inorder.push(node.value);const right=visit(node.right);
    if(left<0||right<0||Math.abs(left-right)>1)return -1;
    return Math.max(left,right)+1;
  }
  return visit(root)>=0&&key(inorder)===key(input);
}

function compareCoreResult(rule, got, expected, args){
  if(rule==='palindrome')return typeof got==='string'&&typeof expected==='string'&&got.length===expected.length&&args[0].includes(got)&&got===Array.from(got).reverse().join('');
  if(rule==='balanced-bst')return balancedBST(got,args[0]);
  if(!Array.isArray(got)||!Array.isArray(expected))return false;
  if(rule==='unordered-nested'){
    if(!got.every(Array.isArray)||!expected.every(Array.isArray))return false;
    return key(sorted(got.map(sorted)))===key(sorted(expected.map(sorted)));
  }
  if(rule==='unordered')return key(sorted(got))===key(sorted(expected));
  throw Error('Unknown core comparison rule: '+rule);
}


function compareACMOutput(rule, got, expected, input){
  if(!got.trim()&&!expected.trim())return true;
  if(rule==='palindrome')return compareCoreResult(rule,got.trim(),expected.trim(),[input.replace(/\r?\n$/, '')]);
  if(rule==='balanced-bst'){
    const tree=got.trim().split(/\s+/).map(v=>v==='null'?null:Number(v));
    const text=input.trim().split(/\r?\n/).slice(1).join(' ').trim();
    const values=text?text.split(/\s+/).map(Number):[];
    return balancedBST(tree,values);
  }
  const tokens=s=>s.trim()==='EMPTY'||!s.trim()?[]:s.trim().split(/\s+/);
  if(rule==='unordered-tokens')return key(sorted(tokens(got)))===key(sorted(tokens(expected)));
  const counted=rule.startsWith('counted-');
  const nested=rule.includes('nested');
  const parse=s=>{
    const lines=s.replace(/\r\n/g,'\n').split('\n');
    if(lines.at(-1)==='')lines.pop();
    const count=counted?Number(lines.shift()):null;
    const rows=lines.map(tokens);
    if(counted&&(!Number.isInteger(count)||count!==rows.length))return null;
    return sorted(nested?rows.map(sorted):rows);
  };
  const a=parse(got),b=parse(expected);
  return a!==null&&b!==null&&key(a)===key(b);
}
const api={compareCoreResult,compareACMOutput};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else globalThis.Hot100Judge=api;
