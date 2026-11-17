/**
 * sanitizePathSegment 单测（发版前审查 #2 路径穿越修复）。
 * 接口字段（titleSlug/questionId）拼进文件路径/终端命令前必须过白名单清洗；
 * 正常 slug（kebab-case）与数字题号恒等不变（不影响既有文件名兼容）。
 */
import { test } from 'node:test';
import * as assert from 'node:assert';
import { sanitizePathSegment } from '../utils/pathSafety';

test('sanitizePathSegment：正常 slug/题号恒等不变', () => {
    assert.strictEqual(sanitizePathSegment('two-sum'), 'two-sum');
    assert.strictEqual(sanitizePathSegment('binary-tree-inorder-traversal'), 'binary-tree-inorder-traversal');
    assert.strictEqual(sanitizePathSegment('1'), '1');
    assert.strictEqual(sanitizePathSegment('94'), '94');
    assert.strictEqual(sanitizePathSegment('3sum'), '3sum');
    assert.strictEqual(sanitizePathSegment('word_search_ii'), 'word_search_ii');
});

test('sanitizePathSegment：路径穿越与分隔符收敛为下划线', () => {
    // 白名单外字符（含 `.` 与路径分隔符）逐字符替换为 _
    assert.strictEqual(sanitizePathSegment('../../etc/passwd'), '______etc_passwd');
    assert.strictEqual(sanitizePathSegment('a/../../b'), 'a_______b');
    assert.strictEqual(sanitizePathSegment('..\\..\\windows'), '______windows');
    assert.strictEqual(sanitizePathSegment('a\nb'), 'a_b');
    assert.strictEqual(sanitizePathSegment('a`b'), 'a_b');
    assert.strictEqual(sanitizePathSegment('a$(id)b'), 'a__id_b');  // $/( /) 各收敛为 _
});

test('sanitizePathSegment：清洗后为空时回退 fallback', () => {
    // 白名单外字符一律替换为 _（非删除），所以仅当输入本身为空时清洗结果才为空
    assert.strictEqual(sanitizePathSegment('', 'problem'), 'problem');
    assert.strictEqual(sanitizePathSegment(null, '0'), '0');
    assert.strictEqual(sanitizePathSegment(undefined), 'item');
    assert.strictEqual(sanitizePathSegment(undefined, 'problem'), 'problem');
    assert.strictEqual(sanitizePathSegment(123), '123');  // 非字符串先 String() 再清洗
    // 纯非法字符输入清洗为纯下划线（无穿越能力，无需回退）：
    // `.` 也在白名单外（`..` 是路径穿越的核心字符，必须收敛）
    assert.strictEqual(sanitizePathSegment('///'), '___');
    assert.strictEqual(sanitizePathSegment('..'), '__');
    assert.strictEqual(sanitizePathSegment('../'), '___');
});

test('sanitizePathSegment：中文/空格/引号全部收敛', () => {
    assert.strictEqual(sanitizePathSegment('两数之和'), '____');  // 4 个汉字 → 4 个下划线
    assert.strictEqual(sanitizePathSegment('a b'), 'a_b');
    assert.strictEqual(sanitizePathSegment('a"b'), 'a_b');
    assert.strictEqual(sanitizePathSegment("a'b"), 'a_b');
    assert.strictEqual(sanitizePathSegment('a%b'), 'a_b');  // cmd 的 %VAR% 展开字符
    assert.strictEqual(sanitizePathSegment('a^b'), 'a_b');  // cmd 转义字符
});
