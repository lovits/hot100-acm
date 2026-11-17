# Hot100 ACM 刷题台

离线 Hot 100 算法练习桌面应用，支持 C、C++、Python，ACM 和核心代码模式、测试用例、自动保存与本地进度。

## VS Code 插件

新增 [Hot100 VS Code 插件](vscode-extension/README.md)，使用原生编辑器，支持 Python/C++/C 的 ACM 与核心代码模式。[下载可安装的 VSIX](https://github.com/lovits/hot100-acm/releases/tag/vscode-v0.2.8)。插件与桌面应用独立编号，桌面版仍为 v1.0.11。

插件使用方法见 [运行与提交说明](vscode-extension/运行与提交说明.md)。

## 启动

需要 Python 3。编辑器、Pyodide 与题库资源已包含在 `dist/`。

```powershell
python launch.pyw
```

默认进入做题页面，点击左上角“LeetCode 热题 100”可选择题目。学习进度和代码保存在本机。

## 构建发行包

发行包和桌面应用构建材料见 GitHub Releases。

## 第三方材料

本源码包不含第三方作者的全文题解与配图。原始文章仅获准本机个人学习使用。Monaco、Pyodide、KaTeX 等组件的许可见各自目录。

## Windows 轻量发行版（v1.0.2）

Windows 启动修复与轻量版。

- 修复原进度目录被移动或磁盘断开时无法启动的问题：备份原目录配置，回退本机默认进度目录并提示。原目录数据不删除。
- 本地服务退出时立即报告错误，避免启动器继续等待；本机健康检查绕过系统代理。
- 移除源码中的开发者机器绝对路径。
- Windows 主包使用系统默认浏览器，内置 Python 与 Node，无需另装 Python，无内置 Electron 浏览器。

下载 `Hot100-Windows-x64-release.zip`，完整解压后双击 `Hot100/Start-Hot100.vbs`。双击 `Create-Desktop-Shortcut.vbs` 创建桌面入口。不要直接在 ZIP 内启动。

Python 练习开箱可用。C/C++ 用户额外下载 `Hot100-Windows-C-Cpp-addon.zip`，解压到同一目录，合并 Hot100 文件夹；附带完整离线编译工具，体积较大。也可使用 PATH 中已有的 gcc/g++。

macOS 用户继续使用 v1.0.1。本版没有重建 macOS 应用。


## v1.0.6 逐题核对与性能

以力扣官方 Hot100 的 100 道题、248 个官网示例为核对基线，标签无中文译名时使用官方原名，消除空标签；约束与核心接口对齐原题，ACM 输入输出格式保留明确的本地序列化说明。逐题差异与验证记录见 `reference/leetcode-per-question-audit.json`，官网示例数据及各语言结果见 `reference/leetcode-official-*.json` 和 `reference/official-*-check-*.json`。

五个筛选项保持单行，窄抽屉可横向滑动。编辑器保留最近 8 份模型及其撤销历史，更早草稿的文字、光标继续保存在原学习数据中。本机性能对照见 `reference/performance-check.json`。

复核入口：`node verify_official.cjs python3`、`node verify_official.cjs cpp`、`node verify_official_acm.cjs`、`node verify_judge_rules.cjs`。这些检查不等于力扣的全部隐藏测试。

## VS Code 插件代码来源与许可

插件保留上游原作者署名与 MIT 许可声明，详见 [版权与来源说明](vscode-extension/UPSTREAM.md)、[MIT 许可全文](vscode-extension/LICENSE)及[原始声明快照](vscode-extension/licenses/upstream/)。第三方题目、图片及依赖的权利说明见 [THIRD_PARTY.md](vscode-extension/THIRD_PARTY.md)。
