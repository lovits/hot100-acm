# LeetCode Hot100 Pro · ACM 增强版

基于 **LeetCode Hot100 Pro v0.1.17** 的源码增强，沿用原有题面、题解和侧栏样式；布局由 VS Code 自行拖动与拆分。

## 安装

从 [GitHub Release](https://github.com/lovits/hot100-acm/releases/tag/vscode-v0.2.0) 下载 VSIX，执行“扩展 → 从 VSIX 安装”。命令面板执行 **Hot100 Pro: 打开刷题台**，进入增强版侧栏。

扩展标识为 `lovits.hot100-practice`。它升级之前的 v0.1.0 插件，与原版 `ShiZiMiao.leetcode` 使用不同命令和侧栏标识。原版仍可保留。

## 增强功能

- 题面顶部增加 **ACM 模式 / 核心代码** 标签。首次默认 ACM，之后记住选择。Python、C++、C 代码按题目、语言、模式分别保存，切换不覆盖已有文件。
- 编辑器工具栏、命令面板提供 **本机运行示例**、**本机评测全部用例**。使用 VS Code 选择的 Python 解释器、C/C++ 构建任务或编译器配置；没有设置时使用系统 PATH。插件不分发 Python、GCC、Clang 或其他编译器。
- 组合筛选专题、算法标签、公司、难度、完成状态、搜索和待复习题目，支持高频排序及清空条件。题目标签和列表显示考察次数；选择公司后切换为该公司次数。
- “刷题统计”中增加 **复习计划**。计划表显示今日及未来两周的新题、复习和逾期任务，可点击打开题目。
- 每日新题目标、复习上限与复习间隔可以修改。默认新题 5 道/天、复习上限 20 道/天；首次完成后第 1、2、4、7、15、30 天复习。逾期完成后顺延后续阶段；同题同日重复通过不重复计数。
- 已完成题目可通过“纳入已有通过题目”开始复习，不补造历史学习日期。复习可重新通过全部本机用例，或手动确认独立完成；打开题目不会计为完成复习。

## 工具链设置

优先读取 VS Code Python 扩展的已选解释器；C/C++ 优先读取构建任务与 `C_Cpp.default.compilerPath`、`.vscode/c_cpp_properties.json`。也可在 VS Code 设置中指定：

- `hot100Pro.pythonPath`
- `hot100Pro.cCompilerPath`
- `hot100Pro.cppCompilerPath`

路径支持空格、`${workspaceFolder}` 和 `${env:变量名}`。Windows 使用 MSVC 时需从已配置开发工具环境启动 VS Code。评测结果面板显示使用的工具链。程序以当前用户身份在本机执行，需信任工作区。

## 原有功能

原版的登录、官方/社区题解、笔记、收藏、官网提交、其他语言支持与核心模式调试逻辑保留。ACM 为完整程序，本机运行测试；核心代码仍可使用原来的官网提交入口。本机通过记录与官网提交来源分别保存。

## 数据和验证

沿用本项目已对照官网的 100 题题面、三语言签名与用例。CodeTop 次数为数据快照，具体来源见 `THIRD_PARTY.md`。本机测试不代表力扣全部隐藏用例。

学习数据保存到 VS Code 的扩展存储，代码保存在工作区 `leetcode/` 中，ACM 文件位于 `leetcode/acm/`。不上传你的草稿或学习计划，官方提交需你主动使用原有入口。升级前请备份工作区文件；本机安装流程已额外备份原有状态。

开发验证：`npm ci`、`npm run compile`、`npm run lint`、`npm run test:unit`、`npm run test:judge`。集成测试使用独立 VS Code 用户目录。VSIX 构建使用 `npm run package`，不包含 node_modules 或编译器。

原有功能的完整说明参见 [上游 README](UPSTREAM-README.md)，源码来源、版本和许可声明见 [UPSTREAM.md](UPSTREAM.md)。非力扣官方产品。
