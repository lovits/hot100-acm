add(200,'岛屿数量','中等','图论','网格中 1 表示陆地，0 表示水。上下左右相邻的陆地属于同一座岛，统计岛屿数。',M,'输出岛屿数量。', '''
m, n = map(int, input().split())
a = [list(map(int, input().split())) for _ in range(m)]
ans = 0
for i in range(m):
    for j in range(n):
        if a[i][j] != 1: continue
        ans += 1
        stack = [(i, j)]; a[i][j] = 0
        while stack:
            x, y = stack.pop()
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < m and 0 <= ny < n and a[nx][ny] == 1:
                    a[nx][ny] = 0; stack.append((nx, ny))
print(ans)
''',[('4 5\n1 1 0 0 0\n1 1 0 0 0\n0 0 1 0 0\n0 0 0 1 1','3'),('1 1\n0','0'),('2 2\n1 1\n1 1','1')], '发现未访问陆地时，答案加一。|使用栈遍历整个连通块并置零，避免重复计算。','时间 O(mn)，空间 O(mn)。','1 ≤ m,n ≤ 300；网格值为 0 或 1。')
add(994,'腐烂的橘子','中等','图论','网格中 0 是空格，1 是新鲜橘子，2 是腐烂橘子。每分钟，腐烂橘子使四邻的新鲜橘子腐烂。求全部腐烂的最少分钟数，不能全部腐烂则输出 -1。',M,'输出分钟数或 -1；没有新鲜橘子时输出 0。', '''
from collections import deque
m, n = map(int, input().split())
a = [list(map(int, input().split())) for _ in range(m)]
q = deque((i,j,0) for i in range(m) for j in range(n) if a[i][j] == 2)
fresh = sum(row.count(1) for row in a)
minutes = 0
while q:
    x, y, minutes = q.popleft()
    for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
        nx,ny = x+dx,y+dy
        if 0 <= nx < m and 0 <= ny < n and a[nx][ny] == 1:
            a[nx][ny] = 2; fresh -= 1; q.append((nx,ny,minutes+1))
print(-1 if fresh else minutes)
''',[('3 3\n2 1 1\n1 1 0\n0 1 1','4'),('3 3\n2 1 1\n0 1 1\n1 0 1','-1'),('1 2\n0 2','0')], '所有初始腐烂橘子同时入队，进行多源广度优先搜索。|入队时立即标记腐烂；队列耗尽后若仍有新鲜橘子则无法完成。','时间 O(mn)，空间 O(mn)。','1 ≤ m,n ≤ 100；值为 0、1 或 2。')
add(207,'课程表','中等','图论','课程编号为 0 到 n−1。每条依赖 a b 表示学 a 前必须学 b，判断能否完成全部课程。','第一行 n m；随后 m 行为 a b。',BOOL, '''
from collections import deque
n, m = map(int, input().split())
graph = [[] for _ in range(n)]; degree = [0]*n
for _ in range(m):
    a,b = map(int,input().split()); graph[b].append(a); degree[a] += 1
q = deque(i for i in range(n) if degree[i] == 0)
count = 0
while q:
    u = q.popleft(); count += 1
    for v in graph[u]:
        degree[v] -= 1
        if degree[v] == 0: q.append(v)
print(str(count == n).lower())
''',[('2 1\n1 0','true'),('2 2\n1 0\n0 1','false'),('3 0','true')], '依赖图中有环就无法完成。|通过入度为 0 的节点做拓扑排序，能移除全部课程时才可行。','时间 O(n+m)，空间 O(n+m)。','1 ≤ n ≤ 2000；0 ≤ m ≤ 5000。')
add(208,'实现 Trie（前缀树）','中等','图论','实现 insert、search 和 startsWith。search 判断完整单词是否存在，startsWith 判断是否存在某个单词以给定前缀开始。','第一行 q；随后 q 行为操作名和非空小写字符串。','每次 search 或 startsWith 输出 true 或 false。', '''
root = {}
q = int(input())
for _ in range(q):
    op, word = input().split()
    node = root
    if op == 'insert':
        for ch in word: node = node.setdefault(ch,{})
        node['#'] = True
    else:
        for ch in word:
            if ch not in node: node = None; break
            node = node[ch]
        found = node is not None and (op == 'startsWith' or '#' in node)
        print(str(found).lower())
''',[('5\ninsert apple\nsearch apple\nsearch app\nstartsWith app\nsearch banana','true\nfalse\ntrue\nfalse'),('2\ninsert a\nsearch a','true'),('1\nstartsWith a','false')], '每个嵌套字典表示一个前缀节点。|插入末尾加结束标记，完整查询必须检查该标记，前缀查询不需要。','每次操作 O(L)，总空间 O(插入字符总数)。','1 ≤ q ≤ 10⁴；单词长度 ≤ 100；至少一次查询。')
add(46,'全排列','中等','回溯','输出互不相同整数的所有排列，按字典序排列。',A,GROUP,arr+'''
a.sort(); ans = []; used = [False]*n
def dfs(path):
    if len(path) == n: ans.append(path.copy()); return
    for i in range(n):
        if not used[i]:
            used[i] = True; path.append(a[i]); dfs(path)
            path.pop(); used[i] = False
dfs([])
print(len(ans))
for row in ans: print(*row)
''',[('3\n1 2 3','6\n1 2 3\n1 3 2\n2 1 3\n2 3 1\n3 1 2\n3 2 1'),('1\n0','1\n0'),('2\n2 1','2\n1 2\n2 1')], '每层选择一个尚未使用的元素。|递归返回后撤销选择；先排序使搜索顺序就是字典序。','时间 O(n·n!)，递归空间 O(n)，另计输出。','1 ≤ n ≤ 8；数字互不相同。')
add(78,'子集','中等','回溯','输出互不相同整数数组的所有子集。每个子集内升序，子集按字典序输出，空集排第一。',A,GROUP,arr+'''
a.sort(); ans = []
def dfs(start, path):
    ans.append(path.copy())
    for i in range(start, n):
        path.append(a[i]); dfs(i+1, path); path.pop()
dfs(0, [])
print(len(ans))
for row in ans: print(*row) if row else print('EMPTY')
''',[('2\n1 2','4\nEMPTY\n1\n1 2\n2'),('1\n0','2\nEMPTY\n0'),('3\n1 2 3','8\nEMPTY\n1\n1 2\n1 2 3\n1 3\n2\n2 3\n3')], '每个搜索节点本身都是一个子集。|仅从后续位置选择元素，防止生成同一子集的不同排列。','时间 O(n·2ⁿ)，递归空间 O(n)，另计输出。','1 ≤ n ≤ 12；数字互不相同。')
add(17,'电话号码的字母组合','中等','回溯','按电话键盘映射 2:abc、3:def、4:ghi、5:jkl、6:mno、7:pqrs、8:tuv、9:wxyz，为数字串生成所有字母组合。',S,'第一行是组合数量；之后每行一个字符串，按字典序输出。空输入输出 0。',readstr+'''
mapping = dict(zip('23456789', ['abc','def','ghi','jkl','mno','pqrs','tuv','wxyz']))
ans = [''] if s else []
for digit in s: ans = [prefix+ch for prefix in ans for ch in mapping[digit]]
print(len(ans))
for word in ans: print(word)
''',[('23','9\nad\nae\naf\nbd\nbe\nbf\ncd\nce\ncf'),('2','3\na\nb\nc'),('-','0')], '从空前缀开始。|依次拼接当前数字对应的每一个字母，形成下一层所有前缀。','时间与输出长度成正比，最多 O(k·4ᵏ)；空间 O(k·4ᵏ)。','0 ≤ 数字串长度 ≤ 6；仅包含 2 到 9。')
add(39,'组合总和','中等','回溯','候选数组由不同正整数组成，每个数可使用多次。输出和为 target 的所有组合；组内非递减，组合按字典序排列。',AT,GROUP,arr+'''
target = int(input()); a.sort(); ans = []
def dfs(start, remain, path):
    if remain == 0: ans.append(path.copy()); return
    for i in range(start,n):
        if a[i] > remain: break
        path.append(a[i]); dfs(i, remain-a[i], path); path.pop()
dfs(0,target,[])
print(len(ans))
for row in ans: print(*row)
''',[('4\n2 3 6 7\n7','2\n2 2 3\n7'),('1\n2\n1','0'),('2\n2 3\n6','2\n2 2 2\n3 3')], '排序后按非递减顺序选择，避免排列重复。|下一层仍可从当前下标选择；超过剩余和时停止扩展。','最坏时间 O(n^(T/min(a)+1))，递归空间 O(T/min(a))，另计输出。','1 ≤ n ≤ 20；候选值 2 到 40；1 ≤ target ≤ 40。')
add(22,'括号生成','中等','回溯','输出由 n 对括号组成的所有合法括号串。任意前缀中右括号数不能超过左括号数。','输入一个整数 n。','第一行数量；之后每行一个括号串，按字典序输出。', '''
n = int(input()); ans=[]
def dfs(s,l,r):
    if len(s)==2*n: ans.append(s); return
    if l<n: dfs(s+'(',l+1,r)
    if r<l: dfs(s+')',l,r+1)
dfs('',0,0)
print(len(ans))
for s in ans: print(s)
''',[('3','5\n((()))\n(()())\n(())()\n()(())\n()()()'),('1','1\n()'),('2','2\n(())\n()()')], '左括号不足 n 个时可以添加左括号。|只有右括号数小于左括号数时，才允许添加右括号，直接剪掉非法前缀。','时间 O(n·Cₙ)，递归空间 O(n)，另计输出；Cₙ 为第 n 个卡特兰数。','1 ≤ n ≤ 8。')
add(79,'单词搜索','中等','回溯','判断能否在字符网格中，通过上下左右移动拼出给定单词。同一次搜索中，每个格子最多使用一次。','第一行 m n；随后 m 行，每行一个长度为 n 的字母串；最后一行目标单词。',BOOL, '''
m,n=map(int,input().split())
a=[list(input().strip()) for _ in range(m)]; word=input().strip()
def dfs(x,y,k):
    if not (0<=x<m and 0<=y<n) or a[x][y]!=word[k]: return False
    if k==len(word)-1: return True
    ch=a[x][y]; a[x][y]='#'
    found=any(dfs(x+dx,y+dy,k+1) for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)))
    a[x][y]=ch
    return found
print(str(any(dfs(i,j,0) for i in range(m) for j in range(n))).lower())
''',[('3 4\nABCE\nSFCS\nADEE\nABCCED','true'),('3 4\nABCE\nSFCS\nADEE\nABCB','false'),('1 1\nA\nA','true')], '从每个匹配首字符的位置出发。|访问格子时临时标记，搜索返回后恢复，确保每条路径内不重复使用。','最坏时间 O(mn·3ᴸ)，递归空间 O(L)。','1 ≤ m,n ≤ 6；1 ≤ 单词长度 ≤ 15。')
add(131,'分割回文串','中等','回溯','将非空字符串切分成若干非空片段，每个片段必须是回文串。输出所有分割方案，按片段序列的字典序排列。','输入一个非空小写字符串。',GROUP, '''
s=input().strip(); n=len(s)
pal=[[False]*n for _ in range(n)]
for i in range(n-1,-1,-1):
    for j in range(i,n): pal[i][j]=s[i]==s[j] and (j-i<2 or pal[i+1][j-1])
ans=[]
def dfs(start,path):
    if start==n: ans.append(path.copy()); return
    for end in range(start,n):
        if pal[start][end]:
            path.append(s[start:end+1]); dfs(end+1,path); path.pop()
dfs(0,[]); ans.sort()
print(len(ans))
for row in ans: print(*row)
''',[('aab','2\na a b\naa b'),('a','1\na'),('ab','1\na b')], '先用动态规划判断每个子串是否回文。|枚举下一段终点，只对回文片段继续递归，最终排序。','预处理 O(n²)，枚举和排序最坏 O(n²·2ⁿ)；空间 O(n²)，另计输出。','1 ≤ 字符串长度 ≤ 12。')
add(51,'N 皇后','困难','回溯','在 n×n 棋盘上放置 n 个皇后，使任意两个不同行、不同列、不在同一对角线上。每个方案用 n 个列号表示，第 i 个数是第 i 行皇后的列号，从 0 开始。','输入整数 n。',GROUP, '''
n=int(input()); ans=[]; cols=set(); diag1=set(); diag2=set()
def dfs(row,path):
    if row==n: ans.append(path.copy()); return
    for col in range(n):
        if col in cols or row-col in diag1 or row+col in diag2: continue
        cols.add(col); diag1.add(row-col); diag2.add(row+col); path.append(col)
        dfs(row+1,path)
        path.pop(); cols.remove(col); diag1.remove(row-col); diag2.remove(row+col)
dfs(0,[])
print(len(ans))
for row in ans: print(*row)
''',[('4','2\n1 3 0 2\n2 0 3 1'),('1','1\n0'),('2','0')], '逐行放置，天然保证不同行。|用集合记录已用列号、行减列、行加列，快速排除列与对角线冲突。','搜索时间 O(n!)，递归及标记空间 O(n)，另计输出。','1 ≤ n ≤ 9。')
add(35,'搜索插入位置','简单','二分查找','在严格递增数组中查找 target，存在则输出下标，否则输出保持有序时应插入的下标。',AT,'输出从 0 开始的下标。',arr+'''
target=int(input()); l,r=0,n
while l<r:
    mid=(l+r)//2
    if a[mid]<target: l=mid+1
    else: r=mid
print(l)
''',[('4\n1 3 5 6\n5','2'),('4\n1 3 5 6\n2','1'),('4\n1 3 5 6\n7','4')], '寻找第一个大于等于 target 的位置。|使用左闭右开区间 [l,r)，r 可以取 n 表示插入末尾。','时间 O(log n)，额外空间 O(1)。')
add(74,'搜索二维矩阵','中等','二分查找','每行非递减，并且下一行首元素大于上一行末元素。判断 target 是否存在。',M+'最后一行 target。',BOOL, '''
m,n=map(int,input().split()); a=[list(map(int,input().split())) for _ in range(m)]
target=int(input()); l,r=0,m*n
while l<r:
    mid=(l+r)//2
    if a[mid//n][mid%n]<target: l=mid+1
    else: r=mid
print(str(l<m*n and a[l//n][l%n]==target).lower())
''',[('2 3\n1 3 5\n7 9 11\n9','true'),('2 3\n1 3 5\n7 9 11\n6','false'),('1 1\n1\n1','true')], '整个矩阵可以看作一维有序数组。|一维下标 mid 对应行 mid//n、列 mid%n，直接做二分查找。','时间 O(log(mn))，额外空间 O(1)。','1 ≤ m,n ≤ 100。')
add(34,'在排序数组中查找元素的第一个和最后一个位置','中等','二分查找','给定非递减数组，输出 target 的首次和末次出现位置；不存在时输出 -1 -1。',AT,'输出两个从 0 开始的下标。',arr+'''
from bisect import bisect_left, bisect_right
target=int(input()); left=bisect_left(a,target)
print(left,bisect_right(a,target)-1) if left<n and a[left]==target else print(-1,-1)
''',[('6\n5 7 7 8 8 10\n8','3 4'),('6\n5 7 7 8 8 10\n6','-1 -1'),('2\n1 1\n1','0 1')], '第一次二分定位第一个大于等于 target 的位置。|第二次定位第一个大于 target 的位置，减一就是右端点。','时间 O(log n)，额外空间 O(1)。')
add(33,'搜索旋转排序数组','中等','二分查找','严格递增数组经过某次循环旋转，找到 target 的下标，不存在输出 -1。',AT,'输出下标或 -1。',arr+'''
target=int(input()); l,r=0,n-1
while l<=r:
    mid=(l+r)//2
    if a[mid]==target: print(mid); return
    if a[l]<=a[mid]:
        if a[l]<=target<a[mid]: r=mid-1
        else: l=mid+1
    else:
        if a[mid]<target<=a[r]: l=mid+1
        else: r=mid-1
print(-1)
''',[('7\n4 5 6 7 0 1 2\n0','4'),('7\n4 5 6 7 0 1 2\n3','-1'),('1\n1\n1','0')], '每次二分至少有一半区间有序。|判断目标是否在有序的一半里，据此保留对应区间。','时间 O(log n)，额外空间 O(1)。')
add(153,'寻找旋转排序数组中的最小值','中等','二分查找','严格递增数组经过循环旋转，输出其中最小值。',A,'输出最小值。',arr+'''
l,r=0,n-1
while l<r:
    mid=(l+r)//2
    if a[mid]>a[r]: l=mid+1
    else: r=mid
print(a[l])
''',[('5\n3 4 5 1 2','1'),('4\n1 2 3 4','1'),('1\n7','7')], '比较中点和右端点。|中点较大说明旋转断点在右侧，否则最小值在左侧或就是中点。','时间 O(log n)，额外空间 O(1)。')
add(4,'寻找两个正序数组的中位数','困难','二分查找','两个数组各自非递减，求合并后序列的中位数，不实际合并数组。','第一行 n m；第二行第一个数组；第三行第二个数组。空数组行留空。','输出中位数，允许整数或小数，误差不超过 10⁻⁶。', '''
n,m=map(int,input().split()); a=list(map(int,input().split())); b=list(map(int,input().split()))
if n>m: a,b,n,m=b,a,m,n
left,right,half=0,n,(n+m+1)//2
while left<=right:
    i=(left+right)//2; j=half-i
    al=a[i-1] if i else float('-inf'); ar=a[i] if i<n else float('inf')
    bl=b[j-1] if j else float('-inf'); br=b[j] if j<m else float('inf')
    if al>br: right=i-1
    elif bl>ar: left=i+1
    else:
        print(max(al,bl) if (n+m)%2 else (max(al,bl)+min(ar,br))/2)
        return
''',[('2 1\n1 3\n2','2'),('2 2\n1 2\n3 4','2.5'),('0 1\n\n1','1')], '在较短数组上二分切分点，让左右两侧总数量平衡。|当左右交叉边界均有序时，中位数由左侧最大值和右侧最小值确定。','时间 O(log(min(n,m)+1))，额外空间 O(1)。','0 ≤ n,m ≤ 1000；n+m ≥ 1。')
