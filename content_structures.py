LINK = '''import sys
sys.setrecursionlimit(100000)

class Node:
    def __init__(self, val=0, next=None):
        self.val, self.next = val, next

def build(values):
    dummy = tail = Node()
    for v in values:
        tail.next = Node(v)
        tail = tail.next
    return dummy.next

def show(head):
    values = []
    while head:
        values.append(head.val)
        head = head.next
    print(*values) if values else print('EMPTY')
'''
def whole(prefix, body):
    return prefix + '\ndef solve():\n' + textwrap.indent(textwrap.dedent(body).strip(), '    ') + '\n\nif __name__ == "__main__":\n    solve()\n'
def al(id,title,diff,statement,inp,out,body,tests,idea,complexity,constraints='0 ≤ 链表长度 ≤ 10⁴；空链表的数值行留空。'):
    add(id,title,diff,'链表',statement,inp,out,whole(LINK,body),tests,idea,complexity,constraints)
L='第一行 n；第二行是链表从头到尾的 n 个整数（n=0 时留空）。'
LR='n = int(input())\nhead = build(list(map(int, input().split())))\n'
al(160,'相交链表','简单','两条无环链表可能共享同一段尾链表。判断它们是否相交，若相交输出交点的值，否则输出 -1。相交指节点对象相同，而非数值相同。','第一行 n m c，分别为 A 独有段、B 独有段、共享尾段的长度；接下来三行依次给出三段数值，空段留空。','输出交点值，或 -1。', '''
n, m, c = map(int, input().split())
a = build(list(map(int, input().split())))
b = build(list(map(int, input().split())))
common = build(list(map(int, input().split())))
def attach(head):
    if not head: return common
    tail = head
    while tail.next: tail = tail.next
    tail.next = common
    return head
a, b = attach(a), attach(b)
p, q = a, b
while p is not q:
    p = p.next if p else b
    q = q.next if q else a
print(p.val if p else -1)
''',[('2 3 3\n4 1\n5 6 1\n8 4 5','8'),('1 1 0\n1\n1\n','-1'),('0 0 1\n\n\n7','7')], '先将公共尾段构造成同一组节点。|两个指针走到末尾后转向另一条链表，走过相同总路程后会在交点或空节点相遇。','算法时间 O(n+m+c)，额外空间 O(1)，另计输入建链。')
al(206,'反转链表','简单','将单向链表的连接方向全部反转，并输出新的链表。',L,SEQ,LR+'''
prev = None
while head:
    nxt = head.next
    head.next = prev
    prev, head = head, nxt
show(prev)
''',[('5\n1 2 3 4 5','5 4 3 2 1'),('1\n7','7'),('0\n','EMPTY')], '保留前驱、当前节点和原后继。|让当前节点指向前驱，再同时向原后继推进。','时间 O(n)，算法额外空间 O(1)。')
al(234,'回文链表','简单','判断链表从前向后与从后向前读出的数值是否一致。',L,BOOL,LR+'''
slow = fast = head
while fast and fast.next:
    slow, fast = slow.next, fast.next.next
prev = None
while slow:
    nxt = slow.next
    slow.next = prev
    prev, slow = slow, nxt
while prev:
    if head.val != prev.val:
        print('false'); return
    head, prev = head.next, prev.next
print('true')
''',[('4\n1 2 2 1','true'),('2\n1 2','false'),('0\n','true')], '快慢指针定位中点。|反转后半段并与前半段逐个比较；本程序不再使用原链表，因此无需恢复。','时间 O(n)，算法额外空间 O(1)。')
CYCLE=LR+'''pos = int(input())
nodes = []
cur = head
while cur:
    nodes.append(cur)
    cur = cur.next
if pos >= 0: nodes[-1].next = nodes[pos]
'''
CI=L+'第三行 pos：尾节点连接的下标，-1 表示无环。下标从 0 开始。'
al(141,'环形链表','简单','判断单向链表中是否存在环。读取 pos 后应先构造链表，再使用快慢指针检测。',CI,BOOL,CYCLE+'''
slow = fast = head
while fast and fast.next:
    slow, fast = slow.next, fast.next.next
    if slow is fast:
        print('true'); return
print('false')
''',[('4\n3 2 0 -4\n1','true'),('1\n1\n-1','false'),('1\n1\n0','true')], '慢指针每轮走一步，快指针走两步。|有环时会在环中相遇；快指针到空节点则无环。','时间 O(n)，算法额外空间 O(1)。')
al(142,'环形链表 II','中等','找到链表环的入口，输出入口在原输入序列中的下标。无环输出 -1。先构造链表，再检测入口。',CI,'输出入口下标或 -1。',CYCLE+'''
slow = fast = head
while fast and fast.next:
    slow, fast = slow.next, fast.next.next
    if slow is fast:
        p, index = head, 0
        while p is not slow:
            p, slow = p.next, slow.next
            index += 1
        print(index); return
print(-1)
''',[('4\n3 2 0 -4\n1','1'),('2\n1 2\n0','0'),('1\n1\n-1','-1')], '先通过快慢指针找到环内相遇点。|另一个指针从头出发，两者每次都走一步，再次相遇即入口。','时间 O(n)，算法额外空间 O(1)。')
TWO='第一行 n m；第二行是第一条链表的 n 个值；第三行是第二条链表的 m 个值。空链表行留空。'
TR='n, m = map(int, input().split())\na = build(list(map(int, input().split())))\nb = build(list(map(int, input().split())))\n'
al(21,'合并两个有序链表','简单','将两个非递减链表合并为一个非递减链表，复用原节点。',TWO,SEQ,TR+'''
dummy = tail = Node()
while a and b:
    if a.val <= b.val: tail.next, a = a, a.next
    else: tail.next, b = b, b.next
    tail = tail.next
tail.next = a or b
show(dummy.next)
''',[('3 3\n1 2 4\n1 3 4','1 1 2 3 4 4'),('0 1\n\n0','0'),('0 0\n\n','EMPTY')], '用虚拟头节点简化连接。|每次连接较小头节点，最后把未耗尽的一条直接接上。','时间 O(n+m)，算法额外空间 O(1)。')
al(2,'两数相加','中等','两条非空链表以低位在前的顺序表示非负整数。把两个数相加，以同样顺序输出结果链表。',TWO,SEQ,TR+'''
dummy = tail = Node()
carry = 0
while a or b or carry:
    total = carry
    if a: total += a.val; a = a.next
    if b: total += b.val; b = b.next
    carry, digit = divmod(total, 10)
    tail.next = Node(digit)
    tail = tail.next
show(dummy.next)
''',[('3 3\n2 4 3\n5 6 4','7 0 8'),('2 1\n9 9\n1','0 0 1'),('1 1\n0\n0','0')], '从低位逐位求和，保留进位。|两条链表都结束后，也要处理最后一次进位。','时间 O(max(n,m))，输出空间 O(max(n,m))。','1 ≤ n,m ≤ 100；节点值为 0 到 9。')
al(19,'删除链表的倒数第 N 个结点','中等','删除链表倒数第 k 个节点，输出删除后的链表。',L+'第三行是 k，保证 1 ≤ k ≤ n。',SEQ,LR+'''
k = int(input())
dummy = Node(0, head)
fast = slow = dummy
for _ in range(k): fast = fast.next
while fast.next: fast, slow = fast.next, slow.next
slow.next = slow.next.next
show(dummy.next)
''',[('5\n1 2 3 4 5\n2','1 2 3 5'),('1\n1\n1','EMPTY'),('2\n1 2\n2','2')], '两个指针从虚拟头出发，让快指针先走 k 步。|同步前进，快指针到尾部时，慢指针指向待删节点的前驱。','时间 O(n)，算法额外空间 O(1)。','1 ≤ k ≤ n ≤ 10⁴。')
al(24,'两两交换链表中的节点','中等','交换链表中每一对相邻节点的位置。若节点总数为奇数，最后一个节点不动；不能只交换数值。',L,SEQ,LR+'''
dummy = prev = Node(0, head)
while prev.next and prev.next.next:
    first, second = prev.next, prev.next.next
    first.next = second.next
    second.next = first
    prev.next = second
    prev = first
show(dummy.next)
''',[('4\n1 2 3 4','2 1 4 3'),('3\n1 2 3','2 1 3'),('0\n','EMPTY')], '保留每一对节点之前的前驱。|依次调整两节点与前后链段的连接，再将前驱移到交换后的后一个节点。','时间 O(n)，算法额外空间 O(1)。')
al(25,'K 个一组翻转链表','困难','每连续 k 个节点为一组反转。末尾不足 k 个节点时保持原顺序，不能只交换数值。',L+'第三行是正整数 k。',SEQ,LR+'''
k = int(input())
dummy = before = Node(0, head)
while True:
    end = before
    for _ in range(k):
        end = end.next
        if not end: show(dummy.next); return
    after = end.next
    prev, cur = after, before.next
    while cur is not after:
        nxt = cur.next
        cur.next = prev
        prev, cur = cur, nxt
    old_start = before.next
    before.next = end
    before = old_start
''',[('5\n1 2 3 4 5\n2','2 1 4 3 5'),('5\n1 2 3 4 5\n3','3 2 1 4 5'),('1\n9\n1','9')], '反转之前先探测这一组是否有足够 k 个节点。|组内反转后，把原头作为下一组前驱，注意保留组后节点。','时间 O(n)，算法额外空间 O(1)。','1 ≤ k ≤ n ≤ 5000。')
al(138,'随机链表的复制','中等','每个节点除 next 外还有一个 random 指针。创建不与原链表共享任何节点的深拷贝，并输出拷贝的结构。','第一行 n；随后 n 行为 value randomIndex，randomIndex 为 0 起始下标，-1 表示空指针。','第一行 n；后续每行输出拷贝节点的 value randomIndex。', '''
n = int(input())
rows = [list(map(int, input().split())) for _ in range(n)]
nodes = [Node(v) for v, _ in rows]
for i, (_, r) in enumerate(rows):
    nodes[i].next = nodes[i + 1] if i + 1 < n else None
    nodes[i].random = nodes[r] if r >= 0 else None
clones = {node: Node(node.val) for node in nodes}
for node in nodes:
    clones[node].next = clones.get(node.next)
    clones[node].random = clones.get(node.random)
copied = [clones[node] for node in nodes]
index = {node: i for i, node in enumerate(copied)}
print(n)
for node in copied: print(node.val, index.get(node.random, -1))
''',[('3\n7 -1\n13 0\n11 1','3\n7 -1\n13 0\n11 1'),('1\n1 0','1\n1 0'),('0','0')], '第一轮建立原节点到新节点的映射。|第二轮通过映射连接 next 与 random。标准输出只能检查结构，节点独立性需对照代码检查。','时间 O(n)，额外空间 O(n)。','0 ≤ n ≤ 1000；randomIndex 为 -1 或有效下标。')
al(148,'排序链表','中等','将无环链表按节点值非递减排序，要求 O(n log n) 时间复杂度。',L,SEQ,LR+'''
def merge(a, b):
    dummy = tail = Node()
    while a and b:
        if a.val <= b.val: tail.next, a = a, a.next
        else: tail.next, b = b, b.next
        tail = tail.next
    tail.next = a or b
    return dummy.next
def sort(node):
    if not node or not node.next: return node
    slow, fast = node, node.next
    while fast and fast.next: slow, fast = slow.next, fast.next.next
    right = slow.next
    slow.next = None
    return merge(sort(node), sort(right))
show(sort(head))
''',[('4\n4 2 1 3','1 2 3 4'),('5\n-1 5 3 4 0','-1 0 3 4 5'),('0\n','EMPTY')], '快慢指针从中间切断链表。|分别归并排序左右两段，再通过指针合并。','时间 O(n log n)，递归空间 O(log n)。')
al(23,'合并 K 个升序链表','困难','将 k 条非递减链表合并成一条非递减链表。','第一行 k；随后 k 行，每行先给出长度，再给出该链表的各个值。',SEQ, '''
import heapq
k = int(input())
heap = []
for i in range(k):
    row = list(map(int, input().split()))
    node = build(row[1:])
    if node: heapq.heappush(heap, (node.val, i, node))
dummy = tail = Node()
while heap:
    _, i, node = heapq.heappop(heap)
    tail.next = node
    tail = node
    if node.next: heapq.heappush(heap, (node.next.val, i, node.next))
show(dummy.next)
''',[('3\n3 1 4 5\n3 1 3 4\n2 2 6','1 1 2 3 4 4 5 6'),('2\n0\n1 3','3'),('0','EMPTY')], '小根堆只保存每条链表当前的头节点。|弹出最小节点后，把它的后继放回堆；链表编号用于解决数值相等时的比较。','时间 O(N log(k+1))，堆空间 O(k)；N 为总节点数。','0 ≤ k ≤ 10⁴；总节点数 ≤ 10⁴。')
add(146,'LRU 缓存','中等','链表','实现容量有限的最近最少使用缓存。get 读取并更新最近使用顺序；put 插入或修改，超容量时淘汰最久未访问的键。','第一行 capacity q；随后 q 行为 get key 或 put key value。','对每次 get 输出一行结果；不存在时输出 -1。', '''
from collections import OrderedDict
capacity, q = map(int, input().split())
cache = OrderedDict()
for _ in range(q):
    op = input().split()
    key = int(op[1])
    if op[0] == 'get':
        print(cache.get(key, -1))
        if key in cache: cache.move_to_end(key)
    else:
        cache[key] = int(op[2])
        cache.move_to_end(key)
        if len(cache) > capacity: cache.popitem(last=False)
''',[('2 6\nput 1 1\nput 2 2\nget 1\nput 3 3\nget 2\nget 3','1\n-1\n3'),('1 4\nput 1 2\nput 1 3\nget 1\nget 2','3\n-1'),('1 1\nget 9','-1')], 'OrderedDict 同时维护键查询与访问顺序，相当于哈希表加双向链表。|每次访问移到末尾，超出容量时从头部淘汰。','每次操作期望 O(1)，空间 O(capacity)。','1 ≤ capacity,q ≤ 10⁴；至少有一次 get。')

TREE='''import sys
from collections import deque
sys.setrecursionlimit(100000)

class Node:
    def __init__(self, val):
        self.val = val
        self.left = self.right = None

def read_tree():
    values = input().split()
    if not values or values[0] == 'null': return None
    root = Node(int(values[0]))
    queue, i = deque([root]), 1
    while queue and i < len(values):
        node = queue.popleft()
        for side in ('left', 'right'):
            if i < len(values) and values[i] != 'null':
                child = Node(int(values[i]))
                setattr(node, side, child)
                queue.append(child)
            i += 1
    return root

def show_tree(root):
    queue, ans = deque([root]), []
    while queue:
        node = queue.popleft()
        if node is None: ans.append('null')
        else:
            ans.append(str(node.val))
            queue.extend((node.left, node.right))
    while len(ans) > 1 and ans[-1] == 'null': ans.pop()
    print(' '.join(ans))
'''
TI='第一行是二叉树的层序序列，空节点写作 null，末尾的 null 可省略；仅 null 表示空树。序列按非空节点依次填写左右孩子，不是完全二叉树下标。'
TO='输出层序序列，空节点为 null，省略末尾多余的 null；空树输出 null。'
def at(id,title,diff,statement,inp,out,body,tests,idea,complexity,constraints='0 ≤ 节点数 ≤ 1000；节点值为整数。'):
    add(id,title,diff,'二叉树',statement,inp,out,whole(TREE,body),tests,idea,complexity,constraints)
at(94,'二叉树的中序遍历','简单','按照左子树、当前节点、右子树的顺序输出树中的节点。',TI,SEQ, '''
root = read_tree()
stack, ans, cur = [], [], root
while cur or stack:
    while cur: stack.append(cur); cur = cur.left
    cur = stack.pop()
    ans.append(cur.val)
    cur = cur.right
print(*ans) if ans else print('EMPTY')
''',[('1 null 2 3','1 3 2'),('null','EMPTY'),('1','1')], '用栈模拟递归，不断沿左孩子入栈。|没有左孩子时弹出节点访问，再转到右子树。','时间 O(n)，空间 O(h)；h 为树高。')
at(104,'二叉树的最大深度','简单','树的深度是从根到叶子的最长路径包含的节点数。空树深度为 0。',TI,'输出最大深度。', '''
root = read_tree()
def depth(node):
    return 0 if not node else 1 + max(depth(node.left), depth(node.right))
print(depth(root))
''',[('3 9 20 null null 15 7','3'),('null','0'),('1 null 2','2')], '空节点深度为 0。|非空节点的深度是左右子树深度最大值加 1。','时间 O(n)，递归空间 O(h)。')
at(226,'翻转二叉树','简单','交换每个节点的左右子树，得到原树的镜像。',TI,TO, '''
root = read_tree()
def invert(node):
    if node:
        node.left, node.right = node.right, node.left
        invert(node.left); invert(node.right)
invert(root)
show_tree(root)
''',[('4 2 7 1 3 6 9','4 7 2 9 6 3 1'),('null','null'),('1 2','1 null 2')], '交换当前节点的左右孩子。|递归地对两个子树执行相同操作。','时间 O(n)，递归空间 O(h)。')
at(101,'对称二叉树','简单','判断二叉树是否关于根节点左右镜像对称。',TI,BOOL, '''
root = read_tree()
def mirror(a, b):
    if not a or not b: return a is b
    return a.val == b.val and mirror(a.left, b.right) and mirror(a.right, b.left)
print(str(not root or mirror(root.left, root.right)).lower())
''',[('1 2 2 3 4 4 3','true'),('1 2 2 null 3 null 3','false'),('null','true')], '成对比较镜像位置的节点。|值相同、外侧子树对称、内侧子树对称，三项都成立才对称。','时间 O(n)，递归空间 O(h)。')
at(543,'二叉树的直径','简单','直径是任意两个节点之间最长路径的边数，路径不要求经过根。',TI,'输出直径；空树输出 0。', '''
root = read_tree()
best = 0
def depth(node):
    nonlocal best
    if not node: return 0
    l, r = depth(node.left), depth(node.right)
    best = max(best, l + r)
    return max(l, r) + 1
depth(root)
print(best)
''',[('1 2 3 4 5','3'),('1','0'),('null','0')], '计算每个节点的左右子树深度。|经过该节点的最长路径有 leftDepth + rightDepth 条边，取全局最大值。','时间 O(n)，递归空间 O(h)。')
at(102,'二叉树的层序遍历','中等','从上到下逐层访问二叉树，每层从左到右。',TI,'先输出层数；随后每层一行，值用空格分隔。', '''
root = read_tree()
q = deque([root]) if root else deque()
rows = []
while q:
    row = []
    for _ in range(len(q)):
        node = q.popleft(); row.append(node.val)
        if node.left: q.append(node.left)
        if node.right: q.append(node.right)
    rows.append(row)
print(len(rows))
for row in rows: print(*row)
''',[('3 9 20 null null 15 7','3\n3\n9 20\n15 7'),('null','0'),('1','1\n1')], '队列按发现顺序保存节点。|每轮固定当前队列长度，只处理这一层，然后开始下一层。','时间 O(n)，空间 O(n)。')
at(108,'将有序数组转换为二叉搜索树','简单','将严格递增数组构造成高度平衡的二叉搜索树。为得到唯一输出，每段必须选择中间偏左的元素作为根。',A,TO, '''
n = int(input())
a = list(map(int, input().split()))
def make(l, r):
    if l > r: return None
    mid = (l + r) // 2
    node = Node(a[mid])
    node.left, node.right = make(l, mid - 1), make(mid + 1, r)
    return node
show_tree(make(0, n - 1))
''',[('5\n-10 -3 0 5 9','0 -10 5 null -3 null 9'),('2\n1 3','1 null 3'),('1\n0','0')], '每段取中间偏左元素为根，使左右规模相差至多 1。|对左右子数组递归建树。','时间 O(n)，递归空间 O(log n)，另计树存储。','1 ≤ n ≤ 1000；数组严格递增。')
at(98,'验证二叉搜索树','中等','验证每个节点的左子树所有值都严格小于它，右子树所有值都严格大于它。重复值不合法。',TI,BOOL, '''
root = read_tree()
def check(node, lo, hi):
    if not node: return True
    return lo < node.val < hi and check(node.left, lo, node.val) and check(node.right, node.val, hi)
print(str(check(root, float('-inf'), float('inf'))).lower())
''',[('2 1 3','true'),('5 1 4 null null 3 6','false'),('2 2 3','false')], '向下传递每个节点允许的开区间。|左子树更新上界，右子树更新下界；不能只比较父子值。','时间 O(n)，递归空间 O(h)。')
at(230,'二叉搜索树中第 K 小的元素','中等','给定合法、无重复值的二叉搜索树，输出第 k 小的节点值，k 从 1 开始。',TI+'第二行是 k。','输出节点值。', '''
root = read_tree()
k = int(input())
stack, cur = [], root
while cur or stack:
    while cur: stack.append(cur); cur = cur.left
    cur = stack.pop()
    k -= 1
    if k == 0: print(cur.val); return
    cur = cur.right
''',[('3 1 4 null 2\n1','1'),('3 1 4 null 2\n3','3'),('1\n1','1')], '二叉搜索树的中序序列递增。|迭代中序遍历到第 k 个节点即可停止。','时间 O(h+k)，空间 O(h)。','1 ≤ k ≤ 节点数 ≤ 1000。')
at(199,'二叉树的右视图','中等','站在树的右侧，从上到下输出每层最右边可见的节点。',TI,SEQ, '''
root = read_tree()
q, ans = (deque([root]) if root else deque()), []
while q:
    size = len(q)
    for i in range(size):
        node = q.popleft()
        if i == size - 1: ans.append(node.val)
        if node.left: q.append(node.left)
        if node.right: q.append(node.right)
print(*ans) if ans else print('EMPTY')
''',[('1 2 3 null 5 null 4','1 3 4'),('1 2','1 2'),('null','EMPTY')], '进行从左到右的层序遍历。|每层最后一个出队节点就是右侧可见节点。','时间 O(n)，空间 O(n)。')
at(114,'二叉树展开为链表','中等','原地把二叉树改成仅使用 right 指针的链表；所有 left 为空，顺序与原树前序遍历一致。',TI,SEQ, '''
root = read_tree()
cur = root
while cur:
    if cur.left:
        tail = cur.left
        while tail.right: tail = tail.right
        tail.right = cur.right
        cur.right, cur.left = cur.left, None
    cur = cur.right
ans, cur = [], root
while cur: ans.append(cur.val); cur = cur.right
print(*ans) if ans else print('EMPTY')
''',[('1 2 5 3 4 null 6','1 2 3 4 5 6'),('null','EMPTY'),('1','1')], '把原右子树接到左子树最右节点之后。|将左子树整体挪到右侧，继续向右处理。','时间 O(n)，算法额外空间 O(1)，另计输出。')
at(105,'从前序与中序遍历序列构造二叉树','中等','给出同一棵树的前序、中序序列，所有值互不相同。重建并输出二叉树。','第一行 n；第二行前序；第三行中序。',TO, '''
n = int(input())
pre = list(map(int, input().split()))
ino = list(map(int, input().split()))
position = {v: i for i, v in enumerate(ino)}
cursor = 0
def make(l, r):
    nonlocal cursor
    if l > r: return None
    value = pre[cursor]; cursor += 1
    node = Node(value); mid = position[value]
    node.left, node.right = make(l, mid - 1), make(mid + 1, r)
    return node
show_tree(make(0, n - 1))
''',[('5\n3 9 20 15 7\n9 3 15 20 7','3 9 20 null null 15 7'),('1\n-1\n-1','-1'),('2\n1 2\n2 1','1 2')], '前序中未使用的第一个值是当前子树根。|通过中序下标划分左右范围，递归构造；哈希表避免反复查找。','时间 O(n)，空间 O(n)。','1 ≤ n ≤ 1000；保证输入对应合法树。')
at(437,'路径总和 III','中等','统计节点值之和为 target 的非空路径数量。路径只能从父节点向子节点延伸，但不要求从根开始或在叶子结束。',TI+'第二行 target。','输出路径数。', '''
root = read_tree()
target = int(input())
counts = {0: 1}
def dfs(node, prefix):
    if not node: return 0
    prefix += node.val
    ans = counts.get(prefix - target, 0)
    counts[prefix] = counts.get(prefix, 0) + 1
    ans += dfs(node.left, prefix) + dfs(node.right, prefix)
    counts[prefix] -= 1
    if counts[prefix] == 0: del counts[prefix]
    return ans
print(dfs(root, 0))
''',[('10 5 -3 3 2 null 11 3 -2 null 1\n8','3'),('0 0 0\n0','5'),('null\n0','0')], '沿当前根到节点路径维护前缀和频次。|用当前和减 target 查询起点；返回父节点时撤销频次，防止跨分支计数。','时间 O(n)，空间 O(h)。')
at(236,'二叉树的最近公共祖先','中等','给定树中两个不同节点 p、q，求它们最深的公共祖先。一个节点可以是它自己的祖先，节点值唯一。',TI+'第二行 p q，均保证存在。','输出最近公共祖先的值。', '''
root = read_tree()
p, q = map(int, input().split())
def lca(node):
    if not node or node.val in (p, q): return node
    l, r = lca(node.left), lca(node.right)
    if l and r: return node
    return l or r
print(lca(root).val)
''',[('3 5 1 6 2 0 8 null null 7 4\n5 1','3'),('3 5 1 6 2 0 8 null null 7 4\n5 4','5'),('1 2\n1 2','1')], '当前节点是 p 或 q 时直接返回。|若左右子树分别找到目标，当前节点即最近祖先；否则上传非空的一侧。','时间 O(n)，递归空间 O(h)。','2 ≤ 节点数 ≤ 1000；节点值唯一。')
at(124,'二叉树中的最大路径和','困难','任意选择一条非空简单路径，每个节点最多经过一次，路径可以先向上再向下。求路径上的最大节点值之和。',TI,'输出最大路径和。', '''
root = read_tree()
best = float('-inf')
def gain(node):
    nonlocal best
    if not node: return 0
    left, right = max(0, gain(node.left)), max(0, gain(node.right))
    best = max(best, node.val + left + right)
    return node.val + max(left, right)
gain(root)
print(best)
''',[('-10 9 20 null null 15 7','42'),('-3','-3'),('1 2 3','6')], '向父节点只能提供一条单边路径的贡献，负贡献舍弃。|在每个节点将两边正贡献连接，更新全局答案；全负数时仍要选一个节点。','时间 O(n)，递归空间 O(h)。','1 ≤ 节点数 ≤ 1000。')
