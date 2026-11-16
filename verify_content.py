"""Reference-case, boundary and independent brute-force differential checks."""
import contextlib
import io
import itertools
import json
import math
import random
import sys
from collections import deque
from pathlib import Path

ROOT=Path(__file__).parent
problems={p['id']:p for p in json.loads((ROOT/'dist/problems.json').read_text(encoding='utf-8'))}
programs={key:compile(p['solution'],f'problem_{key}.py','exec') for key,p in problems.items()}
counts={'reference':0,'boundary':0,'differential':0}
failures=[]

def run(key, data):
    old=sys.stdin; result=io.StringIO()
    try:
        sys.stdin=io.StringIO(data)
        with contextlib.redirect_stdout(result):exec(programs[key],{'__name__':'__main__'})
    finally:sys.stdin=old
    return result.getvalue()

def check(key,data,expected,group):
    actual=run(key,data);a=actual.split();b=str(expected).split()
    ok=len(a)==len(b) and all(abs(float(x)-float(y))<=1e-6 if problems[key].get('judge')=='float' else x==y for x,y in zip(a,b))
    if not ok:failures.append({'id':key,'input':data,'expected':str(expected),'actual':actual})
    counts[group]+=1

def arr(a,suffix=''):return f'{len(a)}\n'+ ' '.join(map(str,a))+'\n'+str(suffix)
for key,p in problems.items():
    s=p['solutions'][0]
    assert s['code']==p['solution'] and s['walkthrough']['rows'],key
    assert sum(l.lstrip().startswith('#') for l in p['solution'].splitlines())>=6,key
    for test in p['tests']:check(key,test['input'],test['output'],'reference')

BOUNDARIES=[
(3,'abba',2),(3,'-',0),(560,arr([0,0,0],0),6),(560,arr([1,-1,1],1),3),
(239,arr([2,2,2],3),'2'),(239,arr([-2,0,-1],1),'-2 0 -1'),(76,'AAAB\nAAB','AAB'),
(53,arr([-9,-2,-7]),-2),(41,arr([1,1]),2),(41,arr([-1,-2]),1),
(238,arr([0,0,3]),'0 0 0'),(238,arr([0,2,3]),'6 0 0'),(189,arr([1,2,3],6),'1 2 3'),
(54,'1 3\n1 2 3','1 2 3'),(54,'3 1\n1\n2\n3','1 2 3'),
(206,'0\n','EMPTY'),(234,'0\n','true'),(24,arr([1,2,3]),'2 1 3'),(25,arr([1,2,3,4,5],3),'3 2 1 4 5'),
(142,'1\n7\n0',0),(141,'1\n7\n-1','false'),(2,'1 1\n9\n1','0 1'),
(101,'1 2 2 null 3 null 3','false'),(104,'null',0),(124,'-10 -20 -3',-3),
(437,'0 0 0\n0',5),(994,'1 1\n0',0),(207,'1 1\n0 0','false'),
(20,'([)]','false'),(394,'12[a]','aaaaaaaaaaaa'),(739,arr([5,5,5]),'0 0 0'),
(84,arr([2,2,2]),6),(215,arr([3,3,2],2),3),(45,arr([0]),0),
(322,arr([1,3,4],6),2),(416,arr([1,2,5]),'false'),(152,arr([-2,3,-4]),24),
(32,'()()',4),(72,'-\nabc',3),(1143,'abc\n-',0),(75,arr([1,2,0]),'0 1 2'),
(31,arr([3,2,1]),'1 2 3'),(31,arr([1,1,5]),'1 5 1'),(287,arr([1,1]),1),
]
for key,data,expected in BOUNDARIES:check(key,data,expected,'boundary')

random.seed(20261102)
for _ in range(90):
    n=random.randint(1,9);a=[random.randint(-4,5) for _ in range(n)]
    k=random.randint(-4,6)
    check(560,arr(a,k),sum(sum(a[i:j])==k for i in range(n) for j in range(i+1,n+1)),'differential')
    check(53,arr(a),max(sum(a[i:j]) for i in range(n) for j in range(i+1,n+1)),'differential')
    check(152,arr(a),max(math.prod(a[i:j]) for i in range(n) for j in range(i+1,n+1)),'differential')
    window=random.randint(1,n)
    check(239,arr(a,window),' '.join(str(max(a[i:i+window])) for i in range(n-window+1)),'differential')
    rank=random.randint(1,n);check(215,arr(a,rank),sorted(a,reverse=True)[rank-1],'differential')
    missing=next(x for x in range(1,n+2) if x not in a);check(41,arr(a),missing,'differential')
    check(238,arr(a),' '.join(str(math.prod(a[:i]+a[i+1:])) for i in range(n)),'differential')
    text=''.join(random.choice('abcd') for _ in range(n))
    check(3,text,max(j-i for i in range(n) for j in range(i+1,n+1) if len(set(text[i:j]))==j-i),'differential')
    nonneg=[random.randint(0,6) for _ in range(n)]
    water=sum(max(0,min(max(nonneg[:i+1]),max(nonneg[i:]))-nonneg[i]) for i in range(n))
    check(42,arr(nonneg),water,'differential')
    check(84,arr(nonneg),max(min(nonneg[i:j])*(j-i) for i in range(n) for j in range(i+1,n+1)),'differential')
    subsets=[[a[i] for i in range(n) if mask>>i&1] for mask in range(1<<n)]
    lis=max(len(v) for v in subsets if all(v[i]<v[i+1] for i in range(len(v)-1)))
    check(300,arr(a),lis,'differential')
    best=max(sum(nonneg[i] for i in range(n) if mask>>i&1) for mask in range(1<<n) if not(mask&(mask<<1)))
    check(198,arr(nonneg),best,'differential')
    nums=[random.randint(1,8) for _ in range(n)];total=sum(nums)
    possible=total%2==0 and any(sum(nums[i] for i in range(n) if mask>>i&1)*2==total for mask in range(1<<n))
    check(416,arr(nums),str(possible).lower(),'differential')
    check(206,arr(a),' '.join(map(str,a[::-1])),'differential')
    # Independent shortest-path BFS over remaining amounts for coin change.
    coins=random.sample(range(1,9),random.randint(1,4));amount=random.randint(0,24)
    queue=deque([(0,0)]);seen={0};expected=-1
    while queue:
        value,steps=queue.popleft()
        if value==amount:expected=steps;break
        for coin in coins:
            if value+coin<=amount and value+coin not in seen:seen.add(value+coin);queue.append((value+coin,steps+1))
    check(322,arr(coins,amount),expected,'differential')

report={'counts':counts,'total':sum(counts.values()),'failures':failures,'seed':20261102}
(ROOT/'reference/content-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
assert not failures
