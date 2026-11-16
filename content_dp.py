add(20,'有效的括号','简单','栈','字符串只包含 ()[]{}。判断所有括号是否类型匹配、顺序正确且全部闭合。',S,BOOL,readstr+'''
stack=[]; pairs={')':'(',']':'[','}':'{'}
for ch in s:
    if ch in '([{': stack.append(ch)
    elif not stack or stack.pop()!=pairs[ch]: print('false'); return
print(str(not stack).lower())
''',[('()[]{}','true'),('([)]','false'),('-','true')], '左括号入栈，右括号必须匹配栈顶。|扫描结束后栈必须为空，未闭合的左括号也不合法。','时间 O(n)，空间 O(n)。','0 ≤ 长度 ≤ 10⁴；只含六种括号。')
add(155,'最小栈','中等','栈','实现 push、pop、top 和 getMin，所有操作均应为常数时间。getMin 返回当前栈中的最小值。','第一行 q；之后 q 行为 push x、pop、top 或 getMin。保证查询和 pop 时栈非空。','每次 top 或 getMin 输出一个整数。', '''
q=int(input()); stack=[]
for _ in range(q):
    op=input().split()
    if op[0]=='push':
        x=int(op[1]); stack.append((x,min(x,stack[-1][1]) if stack else x))
    elif op[0]=='pop': stack.pop()
    elif op[0]=='top': print(stack[-1][0])
    else: print(stack[-1][1])
''',[('7\npush -2\npush 0\npush -3\ngetMin\npop\ntop\ngetMin','-3\n0\n-2'),('2\npush 9\ngetMin','9'),('5\npush 2\npush 2\npop\ngetMin\ntop','2\n2')], '每个栈元素同时保存当前值和截至该层的最小值。|弹栈时历史最小值自动恢复，无需重新扫描。','每次操作 O(1)，空间 O(q)。','1 ≤ q ≤ 10⁴；至少一次查询。')
add(394,'字符串解码','中等','栈','解码 k[片段] 格式的字符串，表示将片段重复 k 次。允许嵌套，例如 2[a3[b]] 表示 abbbabbb。','输入一个非空编码字符串；由小写字母、数字和方括号组成，保证合法。','输出解码后的字符串。', '''
s=input().strip(); stack=[]; current=''; num=0
for ch in s:
    if ch.isdigit(): num=num*10+int(ch)
    elif ch=='[': stack.append((current,num)); current=''; num=0
    elif ch==']':
        prefix,count=stack.pop(); current=prefix+current*count
    else: current+=ch
print(current)
''',[('3[a]2[bc]','aaabcbc'),('3[a2[c]]','accaccacc'),('abc','abc')], '左括号时保存当前前缀和重复次数，开始解析内层。|右括号时弹出外层，把解码片段重复并拼回前缀。','该字符串拼接实现最坏 O(nL)，空间 O(n+L)；L 是展开长度。','编码长度 ≤ 100；展开长度 ≤ 10⁴。')
add(739,'每日温度','中等','栈','对于每一天，计算还要等待多少天才会遇到更高温度。以后没有更高温度则为 0。',A,SEQ,arr+'''
stack=[]; ans=[0]*n
for i,x in enumerate(a):
    while stack and a[stack[-1]]<x:
        j=stack.pop(); ans[j]=i-j
    stack.append(i)
print(*ans)
''',[('8\n73 74 75 71 69 72 76 73','1 1 4 2 1 1 0 0'),('3\n30 30 30','0 0 0'),('3\n30 40 50','1 1 0')], '栈中保留还没有找到更高温度的下标。|遇到更高温度就连续弹出较低温度，并填写距离。','时间 O(n)，空间 O(n)。','1 ≤ n ≤ 10⁵；温度为整数。')
add(84,'柱状图中最大的矩形','困难','栈','柱状图每根柱宽为 1，高度非负。求完全落在柱状图内部的最大轴对齐矩形面积。',A,'输出最大面积。',arr+'''
heights=[0]+a+[0]; stack=[0]; best=0
for i in range(1,len(heights)):
    while heights[stack[-1]]>heights[i]:
        h=heights[stack.pop()]; width=i-stack[-1]-1
        best=max(best,h*width)
    stack.append(i)
print(best)
''',[('6\n2 1 5 6 2 3','10'),('2\n2 4','4'),('3\n0 0 0','0')], '单调递增栈保存柱子下标，两端补零作为哨兵。|某柱出栈时，当前下标和新栈顶就是其左右更低边界，据此计算面积。','时间 O(n)，空间 O(n)。','1 ≤ n ≤ 10⁵；0 ≤ 高度 ≤ 10⁴。')
add(215,'数组中的第K个最大元素','中等','堆','在可含重复值的整数数组中，输出降序排列后的第 k 个元素。重复值也占据位置。','第一行是数组长度 n；第二行是 n 个空格分隔的整数。第三行 k。','输出第 k 大的数。',"# 215. 数组中的第K个最大元素 — 按原题有限值域计数\n# 时间 O(n + U)，U = 20001；固定值域下关于 n 为线性时间。\n# 空间 O(U)；不需要排序，也不依赖 k 的大小。\nimport sys\n\ndef findKthLargest(nums, k):\n    # 原题给定 -10000 <= nums[i] <= 10000，可直接使用固定值域计数。\n    counts = [0] * 20001\n    # 重复元素分别计数，第 k 大不是第 k 个不同值。\n    for value in nums:\n        counts[value + 10000] += 1\n    remaining = k\n    # 从最大值向下扫描；remaining 表示还需跳过多少个元素。\n    for index in range(20000, -1, -1):\n        remaining -= counts[index]\n        # 本值覆盖了目标排名时，就找到了第 k 大。\n        if remaining <= 0:\n            return index - 10000\n\n# ACM 模式：按题面格式读取数组长度、数组和 k。\ndef solve():\n    n = int(input())\n    nums = list(map(int, input().split()))\n    k = int(input())\n    print(findKthLargest(nums, k))\n\nif __name__ == '__main__':\n    solve()\n",[('6\n3 2 1 5 6 4\n2', '5'), ('9\n3 2 3 1 2 4 5 5 6\n4', '4')],'利用原题有限值域统计每个数的出现次数。|从大到小扣除出现次数，累计达到 k 时返回当前数。|每次重复出现都占据一个排名。','时间 O(n + U)，空间 O(U)，U = 20001；原题固定值域下关于 n 为线性时间。','1 <= k <= nums.length <= 10^5；-10^4 <= nums[i] <= 10^4')
add(347,'前 K 个高频元素','中等','堆','统计出现频次并选出前 k 个数字。为确定输出，按频次降序、频次相同时数值升序输出。',A+'第三行 k，不超过不同数字个数。',SEQ,arr+'''
from collections import Counter
import heapq
k=int(input()); count=Counter(a)
answer=heapq.nsmallest(k,count,key=lambda x:(-count[x],x))
print(*answer)
''',[('6\n1 1 1 2 2 3\n2','1 2'),('4\n2 1 2 1\n2','1 2'),('1\n5\n1','5')], '先用哈希表统计频次。|按负频次、数值组成排序键，用堆选择前 k 个；本版明确了并列顺序。','时间 O(n+u log(k+1))，空间 O(u+k)；u 为不同值数量。')
add(295,'数据流的中位数','困难','堆','动态插入整数，并随时查询当前所有数据的中位数。','第一行 q；随后 q 行为 add x 或 median。保证查询时至少已有一个数。','每次 median 输出中位数，误差不超过 10⁻⁶。', '''
import heapq
q=int(input()); low=[]; high=[]
for _ in range(q):
    op=input().split()
    if op[0]=='add':
        x=int(op[1]); heapq.heappush(low,-x)
        heapq.heappush(high,-heapq.heappop(low))
        if len(high)>len(low): heapq.heappush(low,-heapq.heappop(high))
    else:
        print(-low[0] if len(low)>len(high) else (high[0]-low[0])/2)
''',[('5\nadd 1\nadd 2\nmedian\nadd 3\nmedian','1.5\n2'),('2\nadd -1\nmedian','-1'),('3\nadd 2\nadd 2\nmedian','2')], '大根堆保存较小一半，小根堆保存较大一半。|调整堆大小，使较小一半最多多一个元素，中位数从堆顶得到。','插入 O(log n)，查询 O(1)，空间 O(n)。','1 ≤ q ≤ 10⁴；至少一次查询。')
add(121,'买卖股票的最佳时机','简单','贪心算法','每天的股价已知，至多完成一次先买后卖，求最大利润。允许不交易。',A,'输出最大利润。',arr+'''
low=a[0]; best=0
for price in a:
    best=max(best,price-low); low=min(low,price)
print(best)
''',[('6\n7 1 5 3 6 4','5'),('5\n7 6 4 3 1','0'),('1\n4','0')], '扫描时保留之前出现的最低价格。|把今天当成卖出日计算利润，取全局最大值。','时间 O(n)，额外空间 O(1)。','1 ≤ n ≤ 10⁵；股价非负。')
add(55,'跳跃游戏','中等','贪心算法','从下标 0 出发，a[i] 表示从该位置最多能向右跳几步。判断能否到达最后一个下标。',A,BOOL,arr+'''
reach=0
for i,x in enumerate(a):
    if i>reach: print('false'); return
    reach=max(reach,i+x)
print('true')
''',[('5\n2 3 1 1 4','true'),('5\n3 2 1 0 4','false'),('1\n0','true')], '维护当前可以覆盖的最远下标。|若扫描位置超出覆盖范围，则该位置及后续都不可达。','时间 O(n)，额外空间 O(1)。','1 ≤ n ≤ 10⁴；0 ≤ a[i] ≤ 10⁵。')
add(45,'跳跃游戏 II','中等','贪心算法','从下标 0 出发，a[i] 是最大向右跳跃步数。保证能到达最后一个位置，求最少跳跃次数。',A,'输出最少次数。',arr+'''
end=reach=steps=0
for i in range(n-1):
    reach=max(reach,i+a[i])
    if i==end:
        steps+=1; end=reach
print(steps)
''',[('5\n2 3 1 1 4','2'),('1\n0','0'),('4\n1 1 1 1','3')], '把一次跳跃能覆盖的位置视作同一层。|扫描完当前层的右边界才增加步数，并将边界扩展到下一层最远位置。','时间 O(n)，额外空间 O(1)。','1 ≤ n ≤ 10⁴；元素非负且保证可达。')
add(763,'划分字母区间','中等','贪心算法','把小写字符串切分成尽可能多的连续段，要求同一种字母只出现在一个段中。输出各段长度。','输入一行非空小写字符串。',SEQ, '''
s=input().strip(); last={ch:i for i,ch in enumerate(s)}
start=end=0; ans=[]
for i,ch in enumerate(s):
    end=max(end,last[ch])
    if i==end: ans.append(end-start+1); start=i+1
print(*ans)
''',[('ababcbacadefegdehijhklij','9 7 8'),('eccbbbbdec','10'),('abc','1 1 1')], '先记录每个字符最后出现的位置。|当前段必须覆盖段内所有字符的末次位置，扫描到该边界即可切分。','时间 O(n)，空间 O(26)，另计输出。','1 ≤ 长度 ≤ 10⁴。')
add(70,'爬楼梯','简单','动态规划','到达第 n 级台阶，每次可以上 1 级或 2 级。求不同步数组合的数量，顺序不同算不同方案。','输入整数 n。','输出方案数。', '''
n=int(input()); a,b=1,1
for _ in range(n): a,b=b,a+b
print(a)
''',[('3','3'),('1','1'),('5','8')], '到第 i 级的最后一步来自 i−1 或 i−2。|状态转移 f(i)=f(i−1)+f(i−2)，只保留两个前驱。','时间 O(n)，额外空间 O(1)。','1 ≤ n ≤ 45。')
add(118,'杨辉三角','简单','动态规划','生成杨辉三角前 n 行。每行两端为 1，内部位置等于上一行相邻两数之和。','输入整数 n。','输出 n 行，每行整数以空格分隔。', '''
n=int(input()); row=[]
for i in range(n):
    row=[1]+[row[j-1]+row[j] for j in range(1,i)]+([1] if i else [])
    print(*row)
''',[('5','1\n1 1\n1 2 1\n1 3 3 1\n1 4 6 4 1'),('1','1'),('2','1\n1 1')], '逐行生成。|内部元素由上一行两个相邻值相加，两端单独放置 1。','时间 O(n²)，额外空间 O(n)。','1 ≤ n ≤ 30。')
add(198,'打家劫舍','中等','动态规划','一排房屋各有非负金额，不能选择相邻房屋。求可以取得的最大总金额。',A,'输出最大金额。',arr+'''
prev=cur=0
for x in a: prev,cur=cur,max(cur,prev+x)
print(cur)
''',[('4\n1 2 3 1','4'),('5\n2 7 9 3 1','12'),('1\n0','0')], '到当前房屋时，要么不选，沿用前一间最优值。|要么选择当前金额，加上前两间的最优值；取两者最大。','时间 O(n)，额外空间 O(1)。','1 ≤ n ≤ 10⁴；金额非负。')
add(279,'完全平方数','中等','动态规划','把正整数 n 表示成若干完全平方数之和，求最少项数。允许重复使用同一平方数。','输入整数 n。','输出最少项数。', '''
from math import isqrt
n=int(input()); squares=[i*i for i in range(1,isqrt(n)+1)]
dp=[0]+[n+1]*n
for total in range(1,n+1):
    for sq in squares:
        if sq>total: break
        dp[total]=min(dp[total],dp[total-sq]+1)
print(dp[n])
''',[('12','3'),('13','2'),('1','1')], 'dp[x] 表示组成 x 的最少平方数个数。|枚举最后使用的平方数 sq，从 dp[x−sq]+1 转移。','时间 O(n√n)，空间 O(n)。','1 ≤ n ≤ 10⁴。')
add(322,'零钱兑换','中等','动态规划','给定若干正整数面额，每种硬币数量不限。凑出 amount 的最少硬币数是多少？无法凑出时输出 -1。',A+'第二行数组表示面额，第三行 amount。','输出最少数量或 -1。',arr+'''
amount=int(input()); dp=[0]+[amount+1]*amount
for total in range(1,amount+1):
    for coin in a:
        if coin<=total: dp[total]=min(dp[total],dp[total-coin]+1)
print(dp[amount] if dp[amount]<=amount else -1)
''',[('3\n1 2 5\n11','3'),('1\n2\n3','-1'),('1\n1\n0','0')], '设 dp[0]=0，其他金额先标记为不可达。|对每个金额尝试最后一枚硬币，取所有可行前驱的最小值加一。','时间 O(n·amount)，空间 O(amount)。','1 ≤ n ≤ 12；面额为正数；0 ≤ amount ≤ 10⁴。')
add(139,'单词拆分','中等','动态规划','判断字符串能否被拆成字典中的若干单词。每个字典单词可以重复使用，必须覆盖整个字符串。','第一行目标字符串 s；第二行字典词数 n；后续 n 行每行一个单词。',BOOL, '''
s=input().strip(); n=int(input()); words={input().strip() for _ in range(n)}
lengths=sorted({len(w) for w in words}); dp=[True]+[False]*len(s)
for end in range(1,len(s)+1):
    for length in lengths:
        if length>end: break
        if dp[end-length] and s[end-length:end] in words: dp[end]=True; break
print(str(dp[-1]).lower())
''',[('leetcode\n2\nleet\ncode','true'),('catsandog\n5\ncats\ndog\nsand\nand\ncat','false'),('applepenapple\n2\napple\npen','true')], 'dp[i] 表示前 i 个字符能否拆分。|枚举字典中出现过的长度，检查最后一段是否在字典中，且前缀可拆分。','时间 O(|s|·Σ不同词长)，空间 O(|s|+字典字符数)。','1 ≤ |s| ≤ 300；1 ≤ n ≤ 1000；词长 ≤ 20。')
add(300,'最长递增子序列','中等','动态规划','选择一个保持原相对顺序、但不要求连续的严格递增子序列，求最大长度。',A,'输出长度。',arr+'''
from bisect import bisect_left
tails=[]
for x in a:
    i=bisect_left(tails,x)
    if i==len(tails): tails.append(x)
    else: tails[i]=x
print(len(tails))
''',[('8\n10 9 2 5 3 7 101 18','4'),('4\n7 7 7 7','1'),('3\n1 2 3','3')], 'tails[i] 保存长度 i+1 的递增子序列能够达到的最小末尾值。|二分找到第一个不小于当前值的位置并替换，末尾更小更有利于扩展。','时间 O(n log n)，空间 O(n)。')
add(152,'乘积最大子数组','中等','动态规划','在整数数组中选择非空连续子数组，使其元素乘积最大。',A,'输出最大乘积。',arr+'''
hi=lo=best=a[0]
for x in a[1:]:
    hi,lo=max(x,hi*x,lo*x),min(x,hi*x,lo*x)
    best=max(best,hi)
print(best)
''',[('4\n2 3 -2 4','6'),('3\n-2 0 -1','0'),('3\n-2 3 -4','24')], '负数会把最小乘积变成最大乘积。|同时维护以当前位置结尾的最大、最小乘积，使用旧状态同时更新。','时间 O(n)，额外空间 O(1)。','1 ≤ n ≤ 10⁴；任何子数组乘积都在 32 位有符号整数范围内。')
add(416,'分割等和子集','中等','动态规划','判断能否把正整数数组分成两个子集，使两边元素和相等，每个元素恰好属于一边。',A,BOOL,arr+'''
total=sum(a)
if total%2: print('false'); return
target=total//2; dp=[True]+[False]*target
for x in a:
    for j in range(target,x-1,-1): dp[j]=dp[j] or dp[j-x]
print(str(dp[target]).lower())
''',[('4\n1 5 11 5','true'),('4\n1 2 3 5','false'),('2\n1 1','true')], '总和为奇数时直接失败，否则转化为凑出总和的一半。|0/1 背包必须倒序更新容量，防止同一个元素被反复使用。','时间 O(n·sum(a))，空间 O(sum(a))。','1 ≤ n ≤ 200；1 ≤ a[i] ≤ 100。')
add(32,'最长有效括号','困难','动态规划','在只含左右圆括号的字符串中，求最长的连续合法括号片段长度。',S,'输出长度。',readstr+'''
dp=[0]*len(s); best=0
for i in range(1,len(s)):
    if s[i]==')':
        j=i-dp[i-1]-1
        if j>=0 and s[j]=='(':
            dp[i]=dp[i-1]+2+(dp[j-1] if j else 0)
            best=max(best,dp[i])
print(best)
''',[(')()())','4'),('(()','2'),('-','0')], 'dp[i] 表示以 i 结尾的最长合法片段。|若当前是右括号，跳过前面的合法段，寻找可配对左括号，再接上更早的合法段。','时间 O(n)，空间 O(n)。','0 ≤ 长度 ≤ 3×10⁴；只含 ( 和 )。')
add(62,'不同路径','中等','多维动态规划','机器人从 m×n 网格左上角出发，每次只能向右或向下走一格，求到达右下角的路径数量。','输入一行 m n。','输出路径数，使用精确整数。', '''
m,n=map(int,input().split()); dp=[1]*n
for _ in range(1,m):
    for j in range(1,n): dp[j]+=dp[j-1]
print(dp[-1])
''',[('3 7','28'),('3 2','3'),('1 1','1')], '每格路径数来自上方和左方之和。|用一维数组滚动更新，更新前的 dp[j] 是上方，已更新的 dp[j−1] 是左方。','时间 O(mn)，空间 O(n)。','1 ≤ m,n ≤ 100。')
add(64,'最小路径和','中等','多维动态规划','从非负数网格左上角走到右下角，每次只能向右或向下。求经过格子数值总和的最小值，包含起终点。',M,'输出最小路径和。', '''
m,n=map(int,input().split()); a=[list(map(int,input().split())) for _ in range(m)]
dp=[float('inf')]*n; dp[0]=0
for row in a:
    for j,x in enumerate(row): dp[j]=min(dp[j],dp[j-1] if j else float('inf'))+x
print(dp[-1])
''',[('3 3\n1 3 1\n1 5 1\n4 2 1','7'),('1 3\n1 2 3','6'),('1 1\n0','0')], '到当前格子的最优路径一定来自上方或左方的最优路径。|取二者较小值再加当前格子值，使用滚动数组。','时间 O(mn)，空间 O(n)。','1 ≤ m,n ≤ 200；格子数值为 0 到 200。')
add(5,'最长回文子串','中等','多维动态规划','求字符串中最长的连续回文片段。长度相同时，输出起点最小的那一段。','输入一行非空字母或数字字符串。','输出最长回文片段。', '''
s=input().strip(); best=''
for center in range(len(s)):
    for l,r in ((center,center),(center,center+1)):
        while l>=0 and r<len(s) and s[l]==s[r]:
            if r-l+1>len(best): best=s[l:r+1]
            l-=1; r+=1
print(best)
''',[('babad','bab'),('cbbd','bb'),('a','a')], '每个回文都有一个字符中心或两个字符之间的中心。|从各中心向外扩展，按从左到右顺序、只在更长时更新，满足并列取最早。','时间 O(n²)，除结果字符串外空间 O(1)。','1 ≤ 长度 ≤ 1000。')
add(1143,'最长公共子序列','中等','多维动态规划','求两个字符串的最长公共子序列长度。子序列保持相对顺序，但不要求连续。','两行字符串；每行用 - 表示空串。','输出长度。', '''
a=input().strip(); b=input().strip(); a='' if a=='-' else a; b='' if b=='-' else b
dp=[0]*(len(b)+1)
for x in a:
    diag=0
    for j,y in enumerate(b,1):
        old=dp[j]
        dp[j]=diag+1 if x==y else max(dp[j],dp[j-1])
        diag=old
print(dp[-1])
''',[('abcde\nace','3'),('abc\ndef','0'),('-\na','0')], '相同字符可以让前缀的公共子序列长度加一。|不同字符时，取忽略任意一边末字符的较优结果；滚动时保留左上旧值。','时间 O(mn)，空间 O(n)。','0 ≤ 两串长度 ≤ 1000；仅英文字母。')
add(72,'编辑距离','中等','多维动态规划','将第一个字符串变成第二个字符串，可插入、删除或替换一个字符，每步代价为 1。求最少步数。','两行字符串；每行用 - 表示空串。','输出最少操作数。', '''
a=input().strip(); b=input().strip(); a='' if a=='-' else a; b='' if b=='-' else b
dp=list(range(len(b)+1))
for i,x in enumerate(a,1):
    diag=dp[0]; dp[0]=i
    for j,y in enumerate(b,1):
        old=dp[j]
        dp[j]=diag if x==y else 1+min(diag,dp[j],dp[j-1])
        diag=old
print(dp[-1])
''',[('horse\nros','3'),('intention\nexecution','5'),('-\nabc','3')], 'dp[i][j] 表示两个前缀的编辑距离。|末字符相同就沿用左上角；否则在替换、删除、插入三种方案中取最小值加一。','时间 O(mn)，空间 O(n)。','0 ≤ 两串长度 ≤ 500；仅小写字母。')
add(136,'只出现一次的数字','简单','技巧','数组中恰好一个数字出现一次，其余每个数字都出现两次。找出只出现一次的数字。',A,'输出该数字。',arr+'''
ans=0
for x in a: ans^=x
print(ans)
''',[('5\n4 1 2 1 2','4'),('3\n2 2 1','1'),('1\n-3','-3')], '相同数字异或为 0，任何数与 0 异或不变。|把所有数字异或，两两出现的值抵消，只剩答案。','时间 O(n)，额外空间 O(1)。')
add(169,'多数元素','简单','技巧','保证存在出现次数严格超过数组长度一半的数字，找出它。',A,'输出多数元素。',arr+'''
candidate=count=0
for x in a:
    if count==0: candidate=x
    count+=1 if x==candidate else -1
print(candidate)
''',[('3\n3 2 3','3'),('7\n2 2 1 1 1 2 2','2'),('1\n7','7')], '摩尔投票把不同数字两两抵消。|多数元素超过一半，即使和其他元素抵消，也必然保留为最终候选。','时间 O(n)，额外空间 O(1)。')
add(75,'颜色分类','中等','技巧','数组只包含 0、1、2，原地将它们按 0、1、2 的顺序排列。',A,SEQ,arr+'''
low=mid=0; high=n-1
while mid<=high:
    if a[mid]==0:
        a[low],a[mid]=a[mid],a[low]; low+=1; mid+=1
    elif a[mid]==2:
        a[mid],a[high]=a[high],a[mid]; high-=1
    else: mid+=1
print(*a)
''',[('6\n2 0 2 1 1 0','0 0 1 1 2 2'),('3\n2 0 1','0 1 2'),('1\n0','0')], '三个指针划分已确定的 0 区、1 区、未知区和 2 区。|遇到 2 时与尾部交换后不能立刻前进，因为换来的元素尚未检查。','时间 O(n)，额外空间 O(1)。','1 ≤ n ≤ 10⁴；值仅为 0、1、2。')
add(31,'下一个排列','中等','技巧','把数组改为字典序紧接其后的排列；如果已是最大排列，则改成最小排列。允许重复元素。',A,SEQ,arr+'''
i=n-2
while i>=0 and a[i]>=a[i+1]: i-=1
if i>=0:
    j=n-1
    while a[j]<=a[i]: j-=1
    a[i],a[j]=a[j],a[i]
l,r=i+1,n-1
while l<r:
    a[l],a[r]=a[r],a[l]; l+=1; r-=1
print(*a)
''',[('3\n1 2 3','1 3 2'),('3\n3 2 1','1 2 3'),('3\n1 1 5','1 5 1')], '从右往左找到首个上升位置，让该值尽可能小幅增加。|与后缀中最靠右的大于它的值交换，再反转后缀使其最小。','时间 O(n)，额外空间 O(1)。')
add(287,'寻找重复数','中等','技巧','数组长度 n+1，值都在 1 到 n 之间，只有一种数值重复（可能重复多次）。不修改数组，使用常数额外空间找出重复数。',A+'这里第一行是实际数组长度 n+1。','输出重复数字。',arr+'''
slow=fast=a[0]
while True:
    slow=a[slow]; fast=a[a[fast]]
    if slow==fast: break
finder=a[0]
while finder!=slow: finder=a[finder]; slow=a[slow]
print(finder)
''',[('5\n1 3 4 2 2','2'),('5\n3 1 3 4 2','3'),('2\n1 1','1')], '把下标到其值看作链表的下一跳，重复值对应环入口。|快慢指针先在环内相遇，再从起点与相遇点同步前进，找到入口。','时间 O(n)，额外空间 O(1)。','2 ≤ 实际长度 ≤ 10⁵；值在 1 到实际长度−1 之间。')
