/**
 * 提交历史 URL 归一化（纯逻辑，无 vscode 依赖，可直接单测）。
 * submissionList 的 url 字段来自接口，可能为相对路径、缺失、或异常/污染值——
 * openExternal 前必须收敛为 leetcode.cn 域的绝对 https 地址：
 * - 绝对 URL 仅接受 `https://leetcode.cn/` 前缀（防任意站点/javascript:/file: 直通系统浏览器）
 * - `/problems/` 形态的相对路径拼到 leetcode.cn 根域（其他相对形态拼根域是 404，丢弃）
 * - 其余一律回退为按 slug+id 构造的提交页（永远有可用的兜底地址）
 */

/** 归一化提交详情 URL：返回 leetcode.cn 域的绝对 https 地址（永不为 null/空串） */
export function normalizeSubmissionUrl(rawUrl: unknown, titleSlug: string, submissionId: string | number): string {
    let url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (url && !/^https:\/\/leetcode\.cn\//i.test(url)) {
        const pathPart = url.startsWith('/') ? url : `/${url}`;
        url = /^\/problems\//.test(pathPart) ? 'https://leetcode.cn' + pathPart : '';
    }
    if (!url) {
        url = `https://leetcode.cn/problems/${titleSlug}/submissions/${submissionId}/`;
    }
    return url;
}
