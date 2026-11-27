# Hot100 ACM 刷题台

[![VS Code](https://img.shields.io/badge/VS%20Code-v0.2.87-007ACC)](https://github.com/lovits/hot100-acm/releases/tag/vscode-v0.2.87)
[![Desktop](https://img.shields.io/badge/Desktop-v1.0.17-4285F4)](https://github.com/lovits/hot100-acm/releases/tag/v1.0.17)
[![GitHub Issues](https://img.shields.io/github/issues/lovits/hot100-acm)](https://github.com/lovits/hot100-acm/issues)

把 Hot100 算法练习、ACM 输入输出训练和间隔复习放进日常刷题流程。

本仓库提供两种使用方式：**独立桌面刷题台**和 **VS Code 插件**。桌面版支持 Python、C++、C；VS Code 插件支持多语言 ACM 本机运行与核心代码官方测试，学习进度默认保存在本机；本仓库的同步功能可选择自行部署远程服务器。

## 跨设备同步

桌面版 v1.0.17 支持自行部署同步服务，通过 Tailscale 私网在 Mac 和 Windows 之间同步学习数据。两台设备需连接同一个同步服务；VS Code 插件的数据保存在本机，不参与桌面端同步。服务器可使用任意支持 Docker 的云主机或自建 Linux；部署、连接和备份说明见[自建远程同步指南](docs/private-sync.md)。

请使用下方的 v1.0.17 正式安装包。连接已有数据的设备前，建议先备份本机学习数据。

## 选择使用方式

| | 桌面刷题台 | VS Code 插件 |
| --- | --- | --- |
| 适合场景 | 打开独立应用，直接进入刷题界面 | 在熟悉的 VS Code 编辑器中练习 |
| 界面 | 左侧题目，右侧代码和测试区域 | 题库侧栏、左侧题面、右侧原生代码编辑器 |
| 本机测试 | 运行示例、自定义测试、提交本地评测 | 示例、自定义用例、全部用例评测 |
| 官网提交 | 以本机评测为主，可打开原题 | 核心代码模式登录力扣后提交官网 |
| 获取方式 | [macOS / Windows 安装包](https://github.com/lovits/hot100-acm/releases/tag/v1.0.17) | [离线 VSIX](https://github.com/lovits/hot100-acm/releases/tag/vscode-v0.2.87) |

## 安装

### VS Code：安装 0.2.87

从 [GitHub Release](https://github.com/lovits/hot100-acm/releases/tag/vscode-v0.2.87) 下载 `hot100-practice-0.2.87.vsix`，在 VS Code 扩展面板选择“从 VSIX 安装”，或运行：

```sh
code --install-extension ./hot100-practice-0.2.87.vsix --force
```

安装后打开保存练习代码的文件夹，从活动栏进入 Hot100 ACM。插件的学习数据保存在本机，不参与桌面端同步。

### 桌面版：下载后启动

| 平台 | 下载 |
| --- | --- |
| macOS · Apple Silicon | [Hot100-macOS-arm64.dmg](https://github.com/lovits/hot100-acm/releases/download/v1.0.17/Hot100-macOS-arm64.dmg) |
| macOS · Intel | [Hot100-macOS-x64.dmg](https://github.com/lovits/hot100-acm/releases/download/v1.0.17/Hot100-macOS-x64.dmg) |
| Windows · x64 | [Hot100-Windows-x64-Setup.exe](https://github.com/lovits/hot100-acm/releases/download/v1.0.17/Hot100-Windows-x64-Setup.exe) |

macOS 打开 DMG 后将 `Hot100.app` 拖入“应用程序”；Windows 运行安装程序并选择安装位置。桌面包与插件独立发布，分别在对应 Release 中更新。

## 功能

### 桌面刷题台

- **直接刷题**：启动进入题目与代码界面，点击左上角题库名称打开选题侧栏。
- **两种模式**：ACM 模式训练完整输入输出，核心代码模式练习力扣函数或类接口。
- **本机运行**：支持 Python、C++、C，查看测试输入、输出、通过情况与错误信息。
- **组合选题**：按难度、完成状态、专题、公司筛选，支持搜索和高频排序。
- **题目信息**：查看算法标签、相关企业、考察次数、提示与原题链接。
- **练习记录**：自动保存代码草稿和本地进度，支持收藏、计时和布局调整。

### VS Code 插件

- **原生编辑**：使用 VS Code 编辑器、快捷键和本机工具链，ACM 与核心代码分别保留草稿。
- **题库筛选**：专题、算法标签、公司、难度、完成状态等条件可以组合使用，每类条件单选。
- **统一排序入口**：侧栏顶部“分组方式”提供按专题、按难度、按题号、高频优先；选定公司后，高频优先使用该公司考察次数。
- **运行与提交**：Case 面板提供示例、加号新建自定义用例和结果展示；ACM 多语言本机评测，核心代码登录力扣后测试与提交。
- **学习计划**：月历展示实际练习记录，按历史完成记录安排间隔复习；支持修改目标、勾选复习完成和手动重置计划。
- **收藏与笔记**：保留题目收藏、个人笔记及刷题统计。
- **HTML 使用说明**：点击侧栏“运行与提交说明”，直接打开包含功能、执行命令和快捷键的页面。

## 界面预览

### 桌面刷题台

题面、代码编辑区和测试区域在同一窗口中展示。

![Hot100 ACM 桌面刷题台](docs/images/desktop-workbench.png)

### VS Code 插件

题库侧栏、左侧题面和右侧代码编辑器；截图来自实际使用场景。

![Hot100 ACM VS Code 插件](docs/images/vscode-extension.png)

## 运行、测试与提交

ACM 模式编写包含输入输出的完整程序；核心代码模式按题目模板实现函数或类。

ACM 使用本机对应语言的工具链，无需登录力扣。目前已接入 Python、C++、C、Java、Go、JavaScript、TypeScript、Rust、Ruby、PHP、Swift、Kotlin、Scala 和 C#；只需安装所选语言的编译器或解释器及其必要运行时，让 VS Code 能从 PATH 找到它们。例如 Java 使用 JDK（`javac` / `java`），Go 使用 `go`。Python 和 C/C++ 也支持读取 VS Code 的解释器或编译配置。未安装对应工具链时会显示提示，不会改用其他语言运行。

代码区下方的 **Hot100 测试** 面板提供 **Case 1、Case 2、＋**。示例自动填入，点击“＋”新增自定义用例；ACM 填写多行标准输入和可选期望输出，核心代码按参数字段填写。用例按题目和模式保存在本机，可切换、编辑或删除自定义用例。点击“测试”运行当前 Case，“运行全部用例”运行面板中的全部 Case，在“测试结果”查看输出或错误。核心代码测试与提交使用力扣官方服务，需要登录。

**运行与完成进度**：ACM 执行“本机运行并评测”或“提交”，会保存代码并运行题库内置的全部评测用例；全部通过后在题库打勾，更新总进度、难度统计及学习记录。与 LeetCode 通过共用同一题的完成状态，重复通过不会把同一道题重复计数。只运行示例或自定义 Case 不标记整题完成，未填写期望输出时只显示运行结果。

先聚焦题目代码文件，通过命令面板执行：

| 命令 | 功能 |
| --- | --- |
| `Hot100 ACM: 本机运行并评测` | 保存代码，评测题库全部用例，通过后打勾 |
| `Hot100 ACM: 本机自定义用例` | 打开 Case 面板，点击“＋”添加输入 |
| `Hot100 ACM: 本机评测全部用例` | 评测题库全部用例并更新完成记录 |
| `LeetCode: 提交代码` | ACM 本机全部评测；核心代码提交官网 |

| 功能 | macOS | Windows / Linux |
| --- | --- | --- |
| 命令面板 | `Cmd + Shift + P` | `Ctrl + Shift + P` |
| 测试当前 Case（ACM 本机／核心代码官方） | `Cmd + Option + T` | `Ctrl + Alt + T` |
| 提交（ACM 本机全部评测／核心代码官网） | `Cmd + Option + S` | `Ctrl + Alt + S` |
| 下一题 | `Cmd + Option + →` | `Ctrl + Alt + →` |
| 搜索题目 | `Cmd + Option + F` | `Ctrl + Alt + F` |
| 每日一题 | `Cmd + Option + D` | `Ctrl + Alt + D` |
| 随机抽题 | `Cmd + Option + R` | `Ctrl + Alt + R` |
| 复习错题 | `Cmd + Option + W` | `Ctrl + Alt + W` |
| 打开题目笔记 | `Cmd + Option + N` | `Ctrl + Alt + N` |
| 收藏／取消收藏 | `Cmd + Option + L` | `Ctrl + Alt + L` |
| 打开 Case 测试面板 | `Cmd + Option + U` | `Ctrl + Alt + U` |
| 运行面板全部 Case | `Cmd + Option + Shift + T` | `Ctrl + Alt + Shift + T` |
| 本机运行并评测（通过后打勾） | `Cmd + Option + Enter` | `Ctrl + Alt + Enter` |

更多说明见插件侧栏的 **运行与提交说明**。Case 面板及本机运行快捷键从插件 0.2.83 起提供。

## 题库与高频数据来源

- **题目来源**：[力扣 LeetCode Hot 100](https://leetcode.cn/studyplan/top-100-liked/)。题目说明、难度、标签及核心代码接口参考官方原题；ACM 模式补充本地输入输出格式。
- **高频与企业考察次数来源**：[CodeTop](https://codetop.cc/)。当前随包快照时间为 `2026-11-16T19:24:01+00:00`（北京时间 **2026-11-17**），并非实时统计。公司筛选下展示对应公司的次数，未指定公司时使用总次数。
- **核对记录**：题目逐题检查见 [leetcode-per-question-audit.json](reference/leetcode-per-question-audit.json)，插件核对记录见 [vscode-official-audit.json](reference/vscode-official-audit.json)。

## 从源码运行

安装 Python 3 后，在仓库根目录启动本地服务：

```sh
python3 local_server.py
```

浏览器打开 <http://127.0.0.1:18765>。本机评测还需要 Node.js，以及所选语言对应的解释器或编译器。

插件源码位于 [vscode-extension](vscode-extension/)，使用 `npm ci`、`npm run compile` 构建。

## 链接与许可

- [项目仓库](https://github.com/lovits/hot100-acm) · [插件主页](https://github.com/lovits/hot100-acm/tree/main/vscode-extension) · [问题反馈](https://github.com/lovits/hot100-acm/issues)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=lovits.hot100-practice) · [全部 Release](https://github.com/lovits/hot100-acm/releases)
- 插件保留原作者署名和 MIT 许可，见 [LICENSE](vscode-extension/LICENSE)、[上游版权说明](vscode-extension/UPSTREAM.md)与[原始声明快照](vscode-extension/licenses/upstream/)。
- 题目、图示、商标及第三方依赖的权利归各自权利人所有，不随代码的 MIT 许可转移。详情见 [THIRD_PARTY.md](vscode-extension/THIRD_PARTY.md)。本项目非力扣或 CodeTop 官方产品。
