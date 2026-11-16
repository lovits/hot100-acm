import json, textwrap, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).parent
problems = []
def add(id, title, difficulty, category, statement, inp, out, code, tests, idea, complexity, constraints='1 ≤ n ≤ 10⁴；整数绝对值不超过 10⁹。'):
    code = textwrap.dedent(code).strip()
    if 'def solve():' not in code:
        code = 'import sys\n\ndef solve():\n' + textwrap.indent(code, '    ') + '\n\nif __name__ == "__main__":\n    solve()'
    problems.append(dict(id=id,title=title,difficulty=difficulty,category=category,statement=statement,input=inp,output=out,solution=code+'\n',tests=[dict(input=a,output=b) for a,b in tests],idea=idea.split('|'),complexity=complexity,constraints=constraints))

A='第一行是数组长度 n；第二行是 n 个空格分隔的整数。'
AT=A+'第三行是整数 target。'
M='第一行是行数 m 和列数 n；接下来 m 行，每行 n 个整数。'
SEQ='输出一行空格分隔的整数；空序列输出 EMPTY。'
BOOL='输出 true 或 false（小写）。'
GROUP='第一行输出方案数；后续每行一个方案，元素以空格分隔，空方案输出 EMPTY。方案按字典序排列。'
S='输入一行字符串；用单个 - 表示空字符串。'
readstr="s = input().strip()\ns = '' if s == '-' else s"
arr='n = int(input())\na = list(map(int, input().split()))'

add(1,'两数之和','简单','哈希','在整数序列中找到两个不同位置，使对应数字之和为 target。保证恰有一组答案，输出较小下标和较大下标，下标从 0 开始。',AT,'输出两个下标，以空格分隔。', '''
n = int(input())
nums = list(map(int, input().split()))
target = int(input())
seen = {}
for i, x in enumerate(nums):
    # 先查找再记录，避免同一元素使用两次
    if target - x in seen:
        print(seen[target - x], i)
        return
    seen[x] = i
''',[('4\n2 7 11 15\n9','0 1'),('3\n3 2 4\n6','1 2'),('2\n3 3\n6','0 1'),('4\n-3 4 3 90\n0','0 2')], '遍历数组时，哈希表保存已经见过的数字及下标。|对于当前值 x，查询 target − x 是否出现过；若出现，即得到两个不同位置。|必须先查询再插入，才能正确处理两个相等数字。','时间 O(n)，空间 O(n)。','2 ≤ n ≤ 10⁴；恰好存在一组答案。')
add(49,'字母异位词分组','中等','哈希','将只含小写字母的单词按字母组成分组；各组内单词排序，各组按排序后的单词序列排序。空单词写作 -。','第一行 n；后续 n 行，每行一个单词。',GROUP, '''
from collections import defaultdict
n = int(input())
groups = defaultdict(list)
for _ in range(n):
    word = input().strip()
    groups[''.join(sorted(word))].append(word)
answer = sorted(sorted(g) for g in groups.values())
print(len(answer))
for g in answer:
    print(*g)
''',[('6\neat\ntea\ntan\nate\nnat\nbat','3\nate eat tea\nbat\nnat tan'),('1\na','1\na'),('2\n-\n-','1\n- -')], '把单词排序后的字符串作为哈希键。|相同键的单词进入同一组；最后排序，以满足本题的确定输出格式。','时间 O(nk log k + nk log n)，空间 O(nk)；k 为最长单词长度。','1 ≤ n ≤ 10⁴；每个单词长度 ≤ 100。')
add(128,'最长连续序列','中等','哈希','求数组中由连续整数构成的最长序列长度。数字在原数组中不必相邻，重复数字不重复计数。',A,'输出最长长度。', '''
''' + arr + '''
values = set(a)
best = 0
for x in values:
    if x - 1 not in values:
        y = x
        while y in values:
            y += 1
        best = max(best, y - x)
print(best)
''',[('6\n100 4 200 1 3 2','4'),('5\n0 1 1 2 3','4'),('1\n7','1')], '将数字放进集合，自动去重。|只有前驱 x − 1 不在集合时，才从 x 开始向后计数，避免重复扫描。','期望时间 O(n)，空间 O(n)。')
add(283,'移动零','简单','双指针','将所有 0 移到数组末尾，保持其他数字的相对顺序。要求在原数组中修改。',A,SEQ,arr+'''
write = 0
for read in range(n):
    if a[read] != 0:
        a[write], a[read] = a[read], a[write]
        write += 1
print(*a)
''',[('5\n0 1 0 3 12','1 3 12 0 0'),('1\n0','0'),('3\n1 2 3','1 2 3')], '写指针指向下一个非零数应放的位置。|读指针遇到非零数时交换到写指针处，然后推进写指针。','时间 O(n)，额外空间 O(1)。')
add(11,'盛最多水的容器','中等','双指针','数组中的每个值代表该位置竖线的高度。选择两条竖线，容器面积是两线距离乘以较矮高度，求最大面积。',A,'输出最大面积。',arr+'''
l, r, best = 0, n - 1, 0
while l < r:
    best = max(best, (r - l) * min(a[l], a[r]))
    if a[l] < a[r]: l += 1
    else: r -= 1
print(best)
''',[('9\n1 8 6 2 5 4 8 3 7','49'),('2\n1 1','1'),('3\n0 0 0','0')], '从两端开始计算面积。|移动较短的一侧，才可能在宽度减小时找到更高的短板。','时间 O(n)，额外空间 O(1)。','2 ≤ n ≤ 10⁵；0 ≤ 高度 ≤ 10⁴。')
add(15,'三数之和','中等','双指针','从数组中选取三个不同位置，使数字之和为 0。输出所有不重复的数值三元组，每组内部升序。',A,GROUP,arr+'''
a.sort()
ans = []
for i in range(n - 2):
    if i and a[i] == a[i - 1]: continue
    l, r = i + 1, n - 1
    while l < r:
        total = a[i] + a[l] + a[r]
        if total < 0: l += 1
        elif total > 0: r -= 1
        else:
            ans.append((a[i], a[l], a[r]))
            l += 1
            r -= 1
            while l < r and a[l] == a[l - 1]: l += 1
            while l < r and a[r] == a[r + 1]: r -= 1
print(len(ans))
for row in ans: print(*row)
''',[('6\n-1 0 1 2 -1 -4','2\n-1 -1 2\n-1 0 1'),('4\n0 0 0 0','1\n0 0 0'),('3\n1 2 3','0')], '先排序，枚举三元组的第一个数字。|剩下两个数字用双指针逼近目标；枚举和指针移动时都跳过重复值。','时间 O(n²)，排序额外空间 O(n)，另计输出。','3 ≤ n ≤ 3000。')
add(42,'接雨水','困难','双指针','非负整数数组表示宽度均为 1 的柱子高度。下雨后，求柱子之间能积存的雨水总量。',A,'输出总水量。',arr+'''
l, r, lm, rm, ans = 0, n - 1, 0, 0, 0
while l <= r:
    if lm <= rm:
        lm = max(lm, a[l])
        ans += lm - a[l]
        l += 1
    else:
        rm = max(rm, a[r])
        ans += rm - a[r]
        r -= 1
print(ans)
''',[('12\n0 1 0 2 1 0 1 3 2 1 2 1','6'),('6\n4 2 0 3 2 5','9'),('3\n1 2 3','0')], '维护左右已扫描区域的最高柱。|较小的一侧决定该侧当前位置的蓄水上界，累计高度差并向内移动。','时间 O(n)，额外空间 O(1)。','1 ≤ n ≤ 2×10⁴；高度非负。')
add(3,'无重复字符的最长子串','中等','滑动窗口','找出字符串中不含重复字符的最长连续片段，输出它的长度。',S,'输出最大长度。',readstr+'''
last = {}
left = best = 0
for right, ch in enumerate(s):
    left = max(left, last.get(ch, -1) + 1)
    best = max(best, right - left + 1)
    last[ch] = right
print(best)
''',[('abcabcbb','3'),('bbbbb','1'),('-','0')], '窗口左端不能越过已经排除的区域。|记录字符最近出现位置，遇到重复时将左端移到上次出现位置之后。','时间 O(n)，空间 O(字符集大小)。','0 ≤ 字符串长度 ≤ 5×10⁴；字符为英文字母和数字。')
add(438,'找到字符串中所有字母异位词','中等','滑动窗口','在 s 中寻找所有与 p 字母组成相同的连续片段，输出起点下标，从 0 开始。','两行分别是非空小写字符串 s 和 p。',SEQ, '''
from collections import Counter
s, p = input().strip(), input().strip()
need, window = Counter(p), Counter()
k, ans = len(p), []
for i, ch in enumerate(s):
    window[ch] += 1
    if i >= k:
        old = s[i - k]
        window[old] -= 1
        if not window[old]: del window[old]
    if window == need: ans.append(i - k + 1)
print(*ans) if ans else print('EMPTY')
''',[('cbaebabacd\nabc','0 6'),('abab\nab','0 1 2'),('a\naa','EMPTY')], '维护长度等于 p 的窗口字符频次。|窗口右移时加入新字符、移除旧字符；频次一致则记录左端。','时间 O(26n)，空间 O(26)。','1 ≤ |s|, |p| ≤ 3×10⁴；仅小写字母。')
add(560,'和为 K 的子数组','中等','子串','统计和恰好等于 k 的非空连续子数组数量。数组可以包含负数。',A+'第三行是 k。','输出子数组个数。',arr+'''
k = int(input())
count = {0: 1}
total = answer = 0
for x in a:
    total += x
    answer += count.get(total - k, 0)
    count[total] = count.get(total, 0) + 1
print(answer)
''',[('3\n1 1 1\n2','2'),('3\n1 -1 0\n0','3'),('1\n0\n0','1')], '子数组和等于两个前缀和之差。|统计当前前缀和减 k 在过去出现的次数；初始前缀和 0 的次数是 1。','时间 O(n)，空间 O(n)。')
add(239,'滑动窗口最大值','困难','子串','长度为 k 的窗口从数组左端逐格滑到右端。依次输出每个窗口中的最大值。',A+'第三行是窗口长度 k。',SEQ,arr+'''
from collections import deque
k = int(input())
q, ans = deque(), []
for i, x in enumerate(a):
    while q and q[0] <= i - k: q.popleft()
    while q and a[q[-1]] <= x: q.pop()
    q.append(i)
    if i >= k - 1: ans.append(a[q[0]])
print(*ans)
''',[('8\n1 3 -1 -3 5 3 6 7\n3','3 3 5 5 6 7'),('3\n2 1 3\n1','2 1 3'),('2\n4 4\n2','4')], '双端队列保存值递减的下标。|删除过期队首与不可能再成为最大值的队尾，队首就是当前答案。','时间 O(n)，空间 O(k)。','1 ≤ k ≤ n ≤ 10⁵。')
add(76,'最小覆盖子串','困难','子串','求 s 中包含 t 全部字符及其出现次数的最短连续片段。并列时取起点最小者；不存在则输出 EMPTY。','两行分别为非空字符串 s 和 t。','输出最短片段或 EMPTY。', '''
from collections import Counter
s, t = input().strip(), input().strip()
need = Counter(t)
missing, left = len(t), 0
best = (len(s) + 1, 0)
for right, ch in enumerate(s):
    if need[ch] > 0: missing -= 1
    need[ch] -= 1
    while missing == 0:
        if right - left + 1 < best[0]: best = (right - left + 1, left)
        need[s[left]] += 1
        if need[s[left]] > 0: missing += 1
        left += 1
print(s[best[1]:best[1] + best[0]] if best[0] <= len(s) else 'EMPTY')
''',[('ADOBECODEBANC\nABC','BANC'),('a\naa','EMPTY'),('aa\naa','aa')], '用频次表记录窗口还缺多少字符。|右端扩展至覆盖全部字符，再尽量收缩左端并更新最短答案。','时间 O(|s|+|t|)，空间 O(字符集大小)。','1 ≤ |s|, |t| ≤ 10⁵；英文字母，区分大小写。')
add(53,'最大子数组和','中等','普通数组','在整数数组中选择一个非空连续子数组，使元素和最大。',A,'输出最大和。',arr+'''
cur = best = a[0]
for x in a[1:]:
    cur = max(x, cur + x)
    best = max(best, cur)
print(best)
''',[('9\n-2 1 -3 4 -1 2 1 -5 4','6'),('3\n-3 -1 -2','-1'),('1\n5','5')], '记录以当前位置结尾的最大子数组和。|若接上前一段反而更差，就从当前位置重新开始。','时间 O(n)，额外空间 O(1)。')
add(56,'合并区间','中等','普通数组','合并所有有交集的闭区间，包括端点相接的区间。结果按左端点升序输出。','第一行 n；随后 n 行，每行两个整数 l r，满足 l ≤ r。','第一行是合并后的区间数；随后每行一个区间。', '''
n = int(input())
intervals = sorted(list(map(int, input().split())) for _ in range(n))
ans = []
for l, r in intervals:
    if ans and l <= ans[-1][1]: ans[-1][1] = max(ans[-1][1], r)
    else: ans.append([l, r])
print(len(ans))
for row in ans: print(*row)
''',[('4\n1 3\n2 6\n8 10\n15 18','3\n1 6\n8 10\n15 18'),('2\n1 4\n4 5','1\n1 5'),('1\n0 0','1\n0 0')], '按左端点排序，使可能重叠的区间相邻。|能相接就扩展当前右端点，否则开始一个新区间。','时间 O(n log n)，空间 O(n)。')
add(189,'轮转数组','中等','普通数组','将数组向右循环移动 k 个位置，要求原地完成。',A+'第三行是非负整数 k。',SEQ,arr+'''
k = int(input()) % n
def reverse(l, r):
    while l < r:
        a[l], a[r] = a[r], a[l]
        l += 1
        r -= 1
reverse(0, n - 1)
reverse(0, k - 1)
reverse(k, n - 1)
print(*a)
''',[('7\n1 2 3 4 5 6 7\n3','5 6 7 1 2 3 4'),('3\n1 2 3\n0','1 2 3'),('2\n1 2\n5','2 1')], '先将 k 对 n 取模。|反转整个数组，再分别反转前 k 个和后 n−k 个元素。','时间 O(n)，额外空间 O(1)。')
add(238,'除了自身以外数组的乘积','中等','普通数组','对每个位置，求数组中除了该位置以外所有数字的乘积。不允许使用除法。',A,SEQ,arr+'''
ans = [1] * n
prefix = 1
for i in range(n):
    ans[i] = prefix
    prefix *= a[i]
suffix = 1
for i in range(n - 1, -1, -1):
    ans[i] *= suffix
    suffix *= a[i]
print(*ans)
''',[('4\n1 2 3 4','24 12 8 6'),('3\n0 2 3','6 0 0'),('2\n0 0','0 0')], '答案是左侧前缀积乘右侧后缀积。|第一次遍历写入前缀积，第二次逆向遍历乘上后缀积，零值也能自然处理。','时间 O(n)，除输出外空间 O(1)。','2 ≤ n ≤ 10⁴；各前缀、后缀及答案乘积在 32 位有符号整数范围内。')
add(41,'缺失的第一个正数','困难','普通数组','找出数组中没有出现的最小正整数。要求线性时间和常数额外空间。',A,'输出最小缺失正整数。',arr+'''
for i in range(n):
    while 1 <= a[i] <= n and a[a[i] - 1] != a[i]:
        j = a[i] - 1
        a[i], a[j] = a[j], a[i]
for i in range(n):
    if a[i] != i + 1:
        print(i + 1)
        return
print(n + 1)
''',[('4\n3 4 -1 1','2'),('3\n1 2 0','3'),('2\n1 1','2')], '答案一定在 1 到 n+1 之间。|把范围内的数字 x 交换到下标 x−1 的位置；首次不匹配的位置即答案。','时间 O(n)，额外空间 O(1)。')
add(73,'矩阵置零','中等','矩阵','若矩阵某位置原本为 0，则将它所在的整行、整列全部改为 0。要求原地修改。',M,'按原尺寸输出矩阵，每行一行。', '''
m, n = map(int, input().split())
a = [list(map(int, input().split())) for _ in range(m)]
first_row = any(x == 0 for x in a[0])
first_col = any(row[0] == 0 for row in a)
for i in range(1, m):
    for j in range(1, n):
        if a[i][j] == 0: a[i][0] = a[0][j] = 0
for i in range(1, m):
    for j in range(1, n):
        if a[i][0] == 0 or a[0][j] == 0: a[i][j] = 0
if first_row: a[0] = [0] * n
if first_col:
    for row in a: row[0] = 0
for row in a: print(*row)
''',[('3 3\n1 1 1\n1 0 1\n1 1 1','1 0 1\n0 0 0\n1 0 1'),('1 2\n0 1','0 0'),('1 1\n2','2')], '借用首行、首列记录哪些行列需要置零。|先保存首行首列原本是否有零，最后再处理它们，避免标记污染。','时间 O(mn)，额外空间 O(1)。','1 ≤ m,n ≤ 200。')
add(54,'螺旋矩阵','中等','矩阵','从矩阵左上角出发，按顺时针螺旋顺序访问所有元素。',M,SEQ, '''
m, n = map(int, input().split())
a = [list(map(int, input().split())) for _ in range(m)]
top, bottom, left, right, ans = 0, m - 1, 0, n - 1, []
while top <= bottom and left <= right:
    ans.extend(a[top][left:right + 1]); top += 1
    for i in range(top, bottom + 1): ans.append(a[i][right])
    right -= 1
    if top <= bottom:
        ans.extend(a[bottom][left:right + 1][::-1]); bottom -= 1
    if left <= right:
        for i in range(bottom, top - 1, -1): ans.append(a[i][left])
        left += 1
print(*ans)
''',[('3 3\n1 2 3\n4 5 6\n7 8 9','1 2 3 6 9 8 7 4 5'),('1 3\n1 2 3','1 2 3'),('3 1\n1\n2\n3','1 2 3')], '维护上下左右四个尚未访问的边界。|每走完一条边就收缩边界，走下边和左边前检查是否仍有元素。','时间 O(mn)，除输出外空间 O(1)。','1 ≤ m,n ≤ 100。')
add(48,'旋转图像','中等','矩阵','把 n×n 的方阵原地顺时针旋转 90 度。','第一行 n；随后 n 行，每行 n 个整数。','输出旋转后的 n 行矩阵。', '''
n = int(input())
a = [list(map(int, input().split())) for _ in range(n)]
for i in range(n):
    for j in range(i + 1, n): a[i][j], a[j][i] = a[j][i], a[i][j]
for row in a:
    row.reverse()
    print(*row)
''',[('3\n1 2 3\n4 5 6\n7 8 9','7 4 1\n8 5 2\n9 6 3'),('1\n9','9'),('2\n1 2\n3 4','3 1\n4 2')], '先沿主对角线转置矩阵。|再反转每一行，就完成顺时针旋转。','时间 O(n²)，额外空间 O(1)。','1 ≤ n ≤ 100。')
add(240,'搜索二维矩阵 II','中等','矩阵','矩阵各行从左到右、各列从上到下均非递减。判断 target 是否存在。',M+'最后一行是 target。',BOOL, '''
m, n = map(int, input().split())
a = [list(map(int, input().split())) for _ in range(m)]
target = int(input())
i, j = 0, n - 1
while i < m and j >= 0:
    if a[i][j] == target:
        print('true'); return
    if a[i][j] > target: j -= 1
    else: i += 1
print('false')
''',[('3 3\n1 4 7\n2 5 8\n3 6 9\n6','true'),('2 2\n1 3\n2 4\n5','false'),('1 1\n1\n1','true')], '从右上角开始，当前位置是本行最大、本列最小。|过大则左移排除一列，过小则下移排除一行。','时间 O(m+n)，额外空间 O(1)。','1 ≤ m,n ≤ 300。')

for module in ('content_structures.py','content_search.py','content_dp.py'):
    exec(compile((ROOT/module).read_text(encoding='utf-8'),module,'exec'))

assert len(problems) == 100, len(problems)
assert len({p['id'] for p in problems}) == 100
for index, p in enumerate(problems):
    p['order'] = index + 1
    p['template'] = 'import sys\n\n\ndef solve():\n    # 按左侧「输入格式」读取数据\n    # 在这里实现你的算法，并将答案输出到标准输出\n    pass\n\n\nif __name__ == "__main__":\n    solve()\n'
    if p['id'] == 1:
        p['template'] = 'import sys\n\n\ndef solve():\n    n = int(input())\n    nums = list(map(int, input().split()))\n    target = int(input())\n\n    # 在这里实现你的算法\n    # 输出两个下标，用空格分隔\n\n\nif __name__ == "__main__":\n    solve()\n'
    p['judge'] = 'float' if p['id'] in (4,295) else 'tokens'
    p['sampleCount'] = 2

if __name__ == '__main__':
    from concurrent.futures import ThreadPoolExecutor
    def verify(job):
        p,i,t = job
        result = subprocess.run([sys.executable,'-X','utf8','-c',p['solution']],input=t['input']+'\n',text=True,capture_output=True,timeout=5,encoding='utf-8')
        actual,expected=result.stdout.split(),t['output'].split()
        ok = actual == expected
        if p['judge']=='float' and len(actual)==len(expected):
            try: ok=all(abs(float(a)-float(b))<=1e-6 for a,b in zip(actual,expected))
            except ValueError: ok=False
        if result.returncode or not ok: return dict(id=p['id'],case=i,expected=t['output'],actual=result.stdout,error=result.stderr)
    jobs=[(p,i,t) for p in problems for i,t in enumerate(p['tests'])]
    with ThreadPoolExecutor(max_workers=8) as pool: errors=[e for e in pool.map(verify,jobs) if e]
    if errors:
        print(json.dumps(errors,ensure_ascii=False,indent=2)); sys.exit(1)
    (ROOT/'dist/problems.json').write_text(json.dumps(problems,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f'PASS: {len(problems)} problems, {len(jobs)} independently specified cases; problems.json written.')
