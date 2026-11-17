# Hot100 刷题台 · VS Code

在 VS Code 原生编辑器中练习 Leetcode 热题 100。支持 **Python、C++、C**，提供 **ACM** 与 **核心代码** 两种模式，代码和进度保存在本机。

## 安装与使用

1. 从 [GitHub Release](https://github.com/lovits/hot100-acm/releases/tag/vscode-v0.1.0) 下载 `hot100-practice-0.1.0.vsix`。
2. VS Code 扩展面板右上角菜单 → **从 VSIX 安装**，选择文件。
3. 命令面板执行 **Hot100: 打开刷题台**，或从左侧 Hot100 图标选择题目。
4. 左侧看题，右侧使用 VS Code 原生编辑器写代码；切换语言或模式后创建独立草稿。
5. **运行示例**检查当前题目的示例；**提交测试**运行随题库提供的全部测试。结果显示在“Hot100 测试结果”输出面板。

点击题面顶部的 **Leetcode 热题 100** 搜索题号、题名、算法类别或公司。列表和题面显示难度、类别、考察次数，公司记录可展开查看。自定义用例使用 JSON：ACM 为 `{"input":"…\n","output":"…\n"}`；核心模式为 `{"args":[…],"expected":…}`，设计类题使用 `ops`、`args`、`expected`。

## 运行环境

- Python：PATH 中可用的 `python3`（Windows 也可设置环境变量 `HOT100_PYTHON` 指向 `python.exe`）。
- C++：PATH 中可用的 `g++`，支持 C++17。
- C：PATH 中可用的 `gcc`，支持 C11。
- macOS 可安装 Xcode Command Line Tools；Windows 可使用 MSYS2 的 GCC；Linux 安装 Python3 和 GCC/G++。
- 支持桌面 VS Code，不支持 vscode.dev 的纯浏览器环境。SSH/WSL 中编译器与草稿位于远程扩展宿主。

不需要力扣账号，不上传你的代码。官方题面中的图片需要联网加载；题库、编译与测试不依赖云判题。代码以本机用户身份执行，首次需信任工作区。

## 题库与核对

基于桌面版 v1.0.11。100 题题单、题名、难度、标签、完整题面及 Python/C++/C 官方签名于 2026-11-17 从力扣官网重新核对。ACM 模式显示对应的输入输出说明。频次沿用该版本的 CodeTop 快照，不代表力扣官方统计。

核对报告：[vscode-official-audit.json](https://github.com/lovits/hot100-acm/blob/main/reference/vscode-official-audit.json)。本地测试不等于力扣全部私有隐藏测试，也不会向力扣提交。

## 验证范围

- Python、C++：各 100 题、1083 个核心及 ACM 用例。
- C 核心模式：100 题、533 个用例；另对照官网示例。
- C ACM：5 道不同输入形态的题目、28 个用例；编译错误、错误答案、运行超时检查。
- 真实 VS Code 扩展宿主：三语言 × 两种模式，验证编辑、保存、运行、提交、切换后的草稿恢复及编译错误反馈。

## 隐私与数据

无遥测。草稿存放于 VS Code 的扩展全局存储目录；通过记录保存在 VS Code 全局状态中，不会覆盖桌面版或网页版数据。删除或更换 VS Code 用户数据目录前请自行备份。时间为本机实际运行耗时，不作为跨设备性能比较。

## 开发

在本仓库根目录的 `vscode-extension` 目录执行 `npm ci`。`npm test` 检查三语言评测；`node test/run-host.js` 运行扩展宿主集成测试（测试文件中的 VS Code 可执行文件路径须按本机修改）；`npm run package` 生成 VSIX。测试参考解不随 VSIX 分发。发布步骤见 [PUBLISHING.md](https://github.com/lovits/hot100-acm/blob/main/vscode-extension/PUBLISHING.md)。

非力扣官方产品。题目来源及第三方许可见 `THIRD_PARTY.md`。
