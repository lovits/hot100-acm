/**
 * normalizeSubmissionUrl 单测（发版前审查 #5 外链域名修复）。
 * 提交历史 URL 仅接受 leetcode.cn 域；接口污染值不得直通系统浏览器。
 */
import { test } from 'node:test';
import * as assert from 'node:assert';
import { normalizeSubmissionUrl } from '../utils/submissionUrl';

test('normalizeSubmissionUrl：leetcode.cn 绝对地址原样保留', () => {
    assert.strictEqual(
        normalizeSubmissionUrl('https://leetcode.cn/submissions/12345/', 'two-sum', '12345'),
        'https://leetcode.cn/submissions/12345/'
    );
    assert.strictEqual(
        normalizeSubmissionUrl('https://leetcode.cn/problems/two-sum/submissions/9/', 'two-sum', '9'),
        'https://leetcode.cn/problems/two-sum/submissions/9/'
    );
});

test('normalizeSubmissionUrl：/problems/ 相对路径拼根域', () => {
    assert.strictEqual(
        normalizeSubmissionUrl('/problems/two-sum/submissions/7/', 'two-sum', '7'),
        'https://leetcode.cn/problems/two-sum/submissions/7/'
    );
    // 无前导斜杠的形态补上后同样处理
    assert.strictEqual(
        normalizeSubmissionUrl('problems/two-sum/submissions/7/', 'two-sum', '7'),
        'https://leetcode.cn/problems/two-sum/submissions/7/'
    );
});

test('normalizeSubmissionUrl：任意站点/非 https 一律回退构造地址', () => {
    const fallback = 'https://leetcode.cn/problems/two-sum/submissions/42/';
    assert.strictEqual(normalizeSubmissionUrl('https://evil.example/phish', 'two-sum', '42'), fallback);
    assert.strictEqual(normalizeSubmissionUrl('http://evil.example/', 'two-sum', '42'), fallback);
    // 大小写绕过尝试：前缀须精确匹配 leetcode.cn
    assert.strictEqual(normalizeSubmissionUrl('https://LEETCODE.CN.evil.example/', 'two-sum', '42'), fallback);
    assert.strictEqual(normalizeSubmissionUrl('https://leetcode.cn.evil.example/', 'two-sum', '42'), fallback);
});

test('normalizeSubmissionUrl：伪协议与异常值回退构造地址', () => {
    const fallback = 'https://leetcode.cn/problems/two-sum/submissions/1/';
    assert.strictEqual(normalizeSubmissionUrl('javascript:alert(1)', 'two-sum', '1'), fallback);
    assert.strictEqual(normalizeSubmissionUrl('file:///C:/Windows/System32/calc.exe', 'two-sum', '1'), fallback);
    assert.strictEqual(normalizeSubmissionUrl('', 'two-sum', '1'), fallback);
    assert.strictEqual(normalizeSubmissionUrl('   ', 'two-sum', '1'), fallback);
    assert.strictEqual(normalizeSubmissionUrl(null, 'two-sum', '1'), fallback);
    assert.strictEqual(normalizeSubmissionUrl(undefined, 'two-sum', '1'), fallback);
    assert.strictEqual(normalizeSubmissionUrl(12345, 'two-sum', '1'), fallback);
    // 非 /problems/ 的相对路径拼根域是 404，同样回退
    assert.strictEqual(normalizeSubmissionUrl('/submissions/1/', 'two-sum', '1'), fallback);
});

test('normalizeSubmissionUrl：提交 id 允许数字类型', () => {
    assert.strictEqual(
        normalizeSubmissionUrl(undefined, 'two-sum', 999),
        'https://leetcode.cn/problems/two-sum/submissions/999/'
    );
});
