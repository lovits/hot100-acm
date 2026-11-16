"""Build structured lessons, readable commented programs and real sample traces."""
import ast
import io
import json
import re
import sys
import tokenize
from collections import deque
from pathlib import Path
from lesson_notes import ROWS, COMMENTS

ROOT = Path(__file__).parent
BASE = ROOT / 'reference' / 'base-problems.json'
if not BASE.exists():
    BASE.write_bytes((ROOT / 'dist/problems.json').read_bytes())
problems = json.loads(BASE.read_text(encoding='utf-8'))
rows = ROWS.replace('|p|', 'len(p)').replace('|s|', 'len(s)').replace('|t|', 'len(t)')
lessons = {}
for row in rows.splitlines():
    if row.strip():
        parts = row.split('|')
        assert len(parts) == 7, parts
        lessons[int(parts[0])] = parts[1:]
official_questions = {int(x['questionFrontendId']): x for x in json.loads((ROOT / 'reference/question-links.json').read_text(encoding='utf-8'))}
links = {key: value['titleSlug'] for key, value in official_questions.items()}

class Expand(ast.NodeTransformer):
    """Unparse splits compound lines; also expand ternary statements into clear branches."""
    def visit_Assign(self, node):
        self.generic_visit(node)
        if isinstance(node.value, ast.IfExp):
            value = node.value
            return ast.If(value.test, [ast.Assign(node.targets, value.body)], [ast.Assign(node.targets, value.orelse)])
        return node

    def visit_Return(self, node):
        self.generic_visit(node)
        if isinstance(node.value, ast.IfExp):
            value = node.value
            return ast.If(value.test, [ast.Return(value.body)], [ast.Return(value.orelse)])
        return node

    def visit_Expr(self, node):
        self.generic_visit(node)
        if isinstance(node.value, ast.IfExp):
            value = node.value
            return ast.If(value.test, [ast.Expr(value.body)], [ast.Expr(value.orelse)])
        return node


NAMES = {'a':'numbers','b':'other','ans':'answer','l':'left','r':'right','nxt':'next_node',
         'pre':'preorder','ino':'inorder','lm':'left_max','rm':'right_max','lo':'minimum',
         'hi':'maximum','sq':'square','pal':'is_palindrome','diag':'previous_diagonal',
         'num':'repeat_count','q':'queue','cur':'current','s':'text'}
SPECIAL = {
11:{'a':'heights'},42:{'a':'heights'},73:{'a':'matrix'},54:{'a':'matrix'},48:{'a':'matrix'},
240:{'a':'matrix','i':'row','j':'col'},74:{'a':'matrix'},64:{'a':'matrix'},200:{'a':'grid'},994:{'a':'grid'},79:{'a':'board'},
160:{'a':'head_a','b':'head_b','p':'pointer_a','q':'pointer_b'},21:{'a':'head_a','b':'head_b'},
2:{'a':'head_a','b':'head_b'},148:{'a':'head_a','b':'head_b'},101:{'a':'left_node','b':'right_node'},
98:{'lo':'lower_bound','hi':'upper_bound'},543:{'l':'left_depth','r':'right_depth'},236:{'l':'left_found','r':'right_found'},
208:{'q':'operation_count'},146:{'q':'operation_count'},155:{'q':'operation_count'},295:{'q':'operation_count'},
207:{'a':'course','b':'prerequisite'},438:{'p':'pattern'},22:{'l':'left_count','r':'right_count'},
4:{'a':'first','b':'second','al':'first_left','ar':'first_right','bl':'second_left','br':'second_right'},
70:{'a':'ways','b':'next_ways'},1143:{'a':'first','b':'second'},72:{'a':'first','b':'second'},
739:{'a':'temperatures'},53:{'cur':'ending_best'},198:{'cur':'best_previous','prev':'best_two_back'},
152:{'hi':'ending_max','lo':'ending_min'},35:{'a':'numbers'},347:{'count':'frequencies'},
}
GLOSSARY = {
'write':'下一个非零数字应放入的下标；它之前已按原相对顺序放好非零数。',
'read':'当前正在扫描的输入下标，遇到零只移动它，不移动 write。',
'numbers':'读入的整数序列；元素含义与允许修改方式以本题题面为准。',
'matrix':'按行读入的二维整数矩阵，下标先行后列。',
'board':'字符棋盘；回溯中把当前路径已用格暂时改为 #，返回时恢复。',
'first_row':'第一行原本是否有零，保留后才能把第一行借作其他列的标记。',
'first_col':'第一列原本是否有零，最后依据它决定是否清空第一列。',
'cache':'按最近使用次序排列的键值字典；左端最久未用、右端最近使用。',
'capacity':'缓存允许保留的最多键数，超出时淘汰最左端。',
'root':'当前整棵树或前缀树的根，所有搜索从这里出发。',
'node':'当前处理节点；树题通过 left/right 访问孩子，Trie 中通过字符访问下一层。',
'heap':'维护候选值的最小堆，heap[0] 是当前堆中最小值。',
'low':'较小部分的边界或状态；在数据流中位数中是存负数的大根堆。',
'high':'较大部分的边界或状态；在数据流中位数中是存原值的小根堆。',
'ways':'当前台阶数的方案数，初始为 f(0)=1。',
'next_ways':'下一台阶的方案数，与 ways 一起滚动到下一对相邻状态。',
'row':'当前行号或这一行的内容；杨辉三角中保留上一轮生成的整行。',
'best_previous':'前一间房为止的最大金额，可以选择不偷前一间。',
'best_two_back':'前两间房为止的最大金额，与当前房金额相加不会违反相邻限制。',
'mid':'当前中点或扫描指针；颜色分类中它是尚未处理区域的左边界。',
'slow':'慢指针或慢下标，每次沿 next 或数组映射前进一步。',
'fast':'快指针或快下标，每次沿映射前进两步，用于追赶或寻找中点。',
'finder':'找环的第二阶段从原起点出发的指针，与相遇指针同速到达入口。',
'left':'当前区间或窗口的左边界；是否包含端点见相应循环条件。',
'right':'当前区间或窗口的右边界；是否包含端点见相应循环条件。',
'answer':'累计答案或已经收集的结果；最后按本题输出格式打印。',
'best':'截至当前已处理范围内找到的最优答案。',
'seen':'已经遍历过的数字到其原数组下标的映射。',
'last':'字符最近一次出现的位置；763 题预先记录最终出现的位置。',
'prefix':'已经处理部分的前缀状态（和或乘积），与当前算法定义一致。',
'suffix':'当前下标右侧所有元素的乘积，不含当前元素。',
'stack':'显式栈；保存待处理节点、下标或未匹配的符号，后进先出。',
'queue':'队列；保存将要访问的节点或位置，先进先出。',
'dp':'状态数组；每个下标对应的含义、初值和转移见上方核心思想。',
'path':'当前分支已经作出的选择；递归返回后撤销本层新增项。',
'used':'各输入下标是否已在当前排列路径中使用。',
'counts':'当前祖先路径上的前缀和出现次数，离开节点时恢复。',
'count':'次数或票数，具体计数对象见本题核心思想与更新语句。',
'missing':'窗口还缺的目标字符总次数；为零表示已覆盖目标。',
'need':'目标字符缺额，负值表示窗口中该字符有富余。',
'window':'当前固定窗口内每个字符的出现次数。',
'dummy':'虚拟头节点，用来统一头部与中间位置的连接操作，不属于输出。',
'tail':'已构造或已连接部分的最后一个节点。',
'prev':'当前节点之前、或已经反转段的头节点，见对应重连步骤。',
'next_node':'修改 next 前保存的原后继，保证未处理链不丢失。',
'cursor':'前序序列中下一个尚未建树的根节点位置。',
'position':'节点值到中序下标的字典，避免反复线性搜索。',
'degree':'每门课仍未完成的前置依赖数量。',
'reach':'已经扫描的可达位置所能抵达的最远下标。',
'end':'当前跳跃层或当前分段的右边界。',
'tails':'tails[k] 是长度 k+1 递增子序列的最小可能结尾。',
'carry':'上一位十进制相加留下的进位，进入下一位继续使用。',
'previous_diagonal':'滚动数组覆盖前保存的上一行、上一列状态。',
'ending_max':'必须以当前数字结尾的子数组最大乘积。',
'ending_min':'必须以当前数字结尾的子数组最小乘积，供负数翻转使用。',
'ending_best':'必须以当前数字结尾的最大非空子数组和。',
}

HELPERS = {
'class Node:':'一个节点保存数值以及指向其他节点的引用；引用不同于数值本身。',
'def build(values):':'按输入顺序尾插建链。虚拟头不输出，返回第一个真实节点。',
'def show(head):':'沿 next 取值输出；仅用于无环链表，空链输出 EMPTY。',
'def read_tree():':'按层序读取；null 表示没有节点，队列只为真实节点分配左右孩子。',
'def show_tree(root):':'层序序列化保留内部 null；只移除末尾多余空节点占位。',
}

def rename(code, mapping):
    tokens = list(tokenize.generate_tokens(io.StringIO(code).readline))
    return tokenize.untokenize([t._replace(string=mapping.get(t.string,t.string)) if t.type==tokenize.NAME else t for t in tokens])


def explain_names(text, mapping):
    # Keep the teaching text and comments consistent with the readable program.
    return re.sub(r'(?<![A-Za-z0-9_])[A-Za-z_][A-Za-z0-9_]*(?![A-Za-z0-9_])',
                  lambda match: mapping.get(match.group(), match.group()), text)


def readable(p, lesson):
    source=p['solution'].replace('list(map(int, input().split()))','list(map(int, sys.stdin.readline().split()))')
    code = ast.unparse(ast.fix_missing_locations(Expand().visit(ast.parse(source))))
    mapping = {**NAMES, **SPECIAL.get(p['id'],{})}
    # Avoid collisions with meaningful variables that already exist in a program.
    existing = {node.id for node in ast.walk(ast.parse(code)) if isinstance(node,ast.Name)}
    mapping = {k:v for k,v in mapping.items() if k in existing and (v not in existing or v==k)}
    lines=[]
    for line in code.splitlines():
        stripped=line.strip(); indent=line[:len(line)-len(line.lstrip())]
        note=None
        for pattern, text in COMMENTS[p['id']]:
            if stripped.startswith(pattern):
                note=text;break
        if stripped in HELPERS:note=HELPERS[stripped]
        if stripped=='def solve():':note='完整 ACM 入口：读入题面约定的数据，计算答案，再写标准输出。'
        if ('input()' in stripped or 'sys.stdin.readline()' in stripped) and note is None:
            note='按空白分隔这一行并转成整数；空行可解析为空序列。' if 'sys.stdin.readline()' in stripped else ('按本题输入格式读取这一行；split 按空白分隔，整数用 int 转换。' if '.split()' in stripped else ('读取一个整数，含义与范围见题目输入格式。' if 'int(input())' in stripped else '读取本题约定的一行文本，随后按题面规则处理。'))
        if stripped.startswith('if __name__'):note='直接运行此文件时执行 solve；不需要在线判题平台提供 Solution 类。'
        if stripped.startswith('print(') and note is None:note='只输出题目要求的结果；调试信息请写入 sys.stderr。'
        if stripped=='path.pop()' and note is None:note='撤销本层选择，使下一个分支从相同状态开始。'
        if note:lines.append(indent+'# '+explain_names(note,mapping))
        lines.append(line)
    header=f"# {p['id']}. {p['title']} — {lesson[0]}\n# {p['complexity']}\n# 核心思想：{explain_names(lesson[2],mapping)}\n\n"
    return header+rename('\n'.join(lines)+'\n',mapping), mapping


def compact(value, depth=0):
    if isinstance(value,(str,int,float,bool,type(None))):return repr(value)[:95]
    if hasattr(value,'val'):
        parts=['val='+str(value.val)]
        for k in ('next','left','right','random'):
            if hasattr(value,k):
                other=getattr(value,k);parts.append(k+'='+('None' if other is None else str(other.val)))
        return 'Node('+', '.join(parts)+')'
    if depth>1:return '…'
    if isinstance(value,dict):return '{'+', '.join(compact(k,2)+': '+compact(v,depth+1) for k,v in list(value.items())[:5])+(' …' if len(value)>5 else '')+'}'
    if isinstance(value,(list,tuple,set,deque)):
        seq=list(value)
        if isinstance(value,set):seq=sorted(seq,key=str)
        return '['+', '.join(compact(v,depth+1) for v in seq[:7])+(' …' if len(seq)>7 else '')+']'
    return None


def sample_trace(p, code):
    filename=f'hot100_{p["id"]}.py'; lines=code.splitlines()
    marked={}
    for i,line in enumerate(lines):
        if line.lstrip().startswith('#') and i+1<len(lines):
            statement=lines[i+1].strip()
            if statement and not statement.startswith(('#','def ','class ','import ','from ','print(','if __name__')) and 'input()' not in statement:
                marked[i+2]=line.strip()[2:]
    events=[]; counter=0
    def trace(frame,event,arg):
        nonlocal counter
        if frame.f_code.co_filename!=filename:return trace
        if event=='line' and frame.f_lineno in marked and frame.f_code.co_name not in ('build','read_tree','show','show_tree','__init__','<module>'):
            counter+=1
            values=[]
            for key,val in frame.f_locals.items():
                if key.startswith('_') or key in ('sys','self'):continue
                summary=compact(val)
                if summary is not None:values.append(key+' = '+summary)
            events.append({'step':counter,'line':frame.f_lineno,'code':lines[frame.f_lineno-1].strip(),'explanation':marked[frame.f_lineno], 'state':'\n'.join(values[-10:])})
            if len(events)>300:events.pop(140)
        return trace
    old_in,old_out=sys.stdin,sys.stdout
    output=io.StringIO()
    try:
        sys.stdin=io.StringIO(p['tests'][0]['input']+'\n');sys.stdout=output
        sys.settrace(trace)
        exec(compile(code,filename,'exec'),{'__name__':'__main__'})
    finally:
        sys.settrace(None);sys.stdin,sys.stdout=old_in,old_out
    assert output.getvalue().split()==p['tests'][0]['output'].split() or p.get('judge')=='float',(p['id'],output.getvalue())
    return {'input':p['tests'][0]['input'],'output':output.getvalue().strip(),'totalSteps':counter,
            'note':'以下状态来自本页代码实际执行样例 1；显示的是到达该行、尚未执行该行时的局部变量。较长轨迹展示开头 10 步和最后 5 步。',
            'rows':events if len(events)<=15 else events[:10]+events[-5:]}


def variables(code):
    names=[]
    tree=ast.parse(code)
    for node in ast.walk(tree):
        if isinstance(node,ast.Name) and isinstance(node.ctx,ast.Store) and node.id in GLOSSARY and node.id not in names:names.append(node.id)
    return [{'name':key,'meaning':GLOSSARY[key]} for key in names[:8]]


def enrich():
    for p in problems:
        official = official_questions[p['id']]
        p['title'] = official['translatedTitle']
        p['difficulty'] = {'EASY':'简单','MEDIUM':'中等','HARD':'困难'}[official['difficulty']]
        # The study-plan directory displays nameTranslated in this exact order.
        # Keep untranslated placeholders so its three-tag / N+ grouping also agrees.
        p['topicTags'] = [tag['nameTranslated'] or '' for tag in official['topicTags']]
        lesson=lessons[p['id']]; code,mapping=readable(p,lesson)
        lesson=[explain_names(part,mapping) for part in lesson]
        # Trace the same canonical source that copy/download/editor loading use.
        p['solution']=code
        structure=[]
        if p['category']=='链表' and p['id']!=146:
            structure=['Node 的 val 存数值，next 保存下一个节点的引用；None 表示链表结束。build 用虚拟头和尾指针按输入顺序创建节点，返回 dummy.next。',
                       '算法中的节点相等指同一个对象；两个节点即使 val 相等，也不代表相交或相遇。',
                       '普通结果沿 next 收集 val 后以空格分隔打印，空链用 EMPTY。环形链表只输出判环结果或入口下标，不能一直沿 next 打印。',
                       p['input'],p['output']]
        if p['category']=='二叉树':
            structure=['Node 保存 val、left、right；None 表示缺少孩子。输入使用层序而非完全二叉树下标：队列每取出一个真实父节点，依次消费左右两个 token，null 不入队。',
                       '例如 1 null 2 3 表示根 1 没有左孩子、右孩子为 2，而 3 是节点 2 的左孩子。空根用 null。',
                       '输出树结构时广度优先生成数值和 null，只删末尾连续 null，内部空位不能删除。只求数值结果的题按对应输出格式打印。',p['input'],p['output']]
        # The comments explain individual lines; the steps describe the overall flow.
        steps=[explain_names(step,mapping) for step in p['idea']]
        p['solutions']=[{'id':'recommended','title':lesson[0],'summary':lesson[2],
            'meaning':p['statement'],'inputExplanation':p['input'],'outputExplanation':p['output'],'constraints':p['constraints'],
            'naive':lesson[1],'insight':lesson[2],'variables':variables(code),'steps':list(dict.fromkeys(steps)),
            'walkthrough':sample_trace(p,code),'correctness':lesson[3],
            'complexity':{'summary':p['complexity'],'reason':lesson[5],
                          'scope':'复杂度按核心算法计；ACM 解析所保存的输入、节点构造、输出列表和序列化内存另计。Python 哈希表操作按期望时间分析。'},
            'pitfalls':[lesson[4]],'structure':structure,'code':code,
            'references':[{'title':f'力扣原题：{p["title"]}','url':f'https://leetcode.cn/problems/{links[p["id"]]}/'},
                          {'title':'力扣题解入口（联网查看）','url':f'https://leetcode.cn/problems/{links[p["id"]]}/solutions/'}]}]
        if p['id']==3:p['solutions'][0]['references'].append({'title':'力扣：从暴力检查到滑动窗口','url':'https://leetcode.cn/articles/longest-substring-without-repeating-characters/'})
        if p['id']==1:p['solutions'][0]['references'].append({'title':'力扣官方：两数之和','url':'https://leetcode.cn/problems/two-sum/solutions/434597/liang-shu-zhi-he-by-leetcode-solution/'})
        p['sourceUrl']=p['solutions'][0]['references'][0]['url']
    (ROOT/'dist/problems.json').write_text(json.dumps(problems,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Built {len(problems)} structured lessons; {sum(len(p["solutions"][0]["walkthrough"]["rows"]) for p in problems)} trace rows.')

if __name__=='__main__':enrich()
