/**
 * 路径片段安全化（纯逻辑，无 vscode 依赖）。
 * 接口字段（titleSlug/questionId 等）拼进文件路径/文件名前必须过此函数：
 * 异常/污染值含 `../`、路径分隔符、换行、反引号时，path.join 会越出目标目录写文件，
 * 拼进终端命令还会被 shell 解释。白名单外字符统一替换为 `_`（与视频缓存 videoId
 * 的 `[^A-Za-z0-9_-]` 白名单同一策略）；正常 slug（kebab-case/数字 id）恒等不变，
 * 不影响既有文件名兼容。
 */

/** 允许出现在路径片段中的字符：ASCII 字母数字 + 连字符 + 下划线 */
const SAFE_SEGMENT_RE = /[^A-Za-z0-9_-]/g;

/**
 * 把任意字符串收敛为安全的路径片段：白名单外字符替换为 `_`；
 * 清洗后为空（输入全是非法字符）时回退为 `fallback`（缺省 `item`）。
 */
export function sanitizePathSegment(raw: unknown, fallback = 'item'): string {
	const s = typeof raw === 'string' ? raw : String(raw ?? '');
	const cleaned = s.replace(SAFE_SEGMENT_RE, '_');
	return cleaned || fallback;
}
