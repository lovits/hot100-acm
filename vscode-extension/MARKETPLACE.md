# Hot100 ACM

<img src="https://raw.githubusercontent.com/lovits/hot100-acm/main/vscode-extension/resources/hot100-acm.png" width="96" height="96" alt="Hot100 ACM Logo">

[![MIT](https://img.shields.io/badge/license-MIT-blue)](https://github.com/lovits/hot100-acm/blob/main/vscode-extension/LICENSE)
[![Marketplace](https://img.shields.io/badge/VS_Code-Marketplace-007ACC)](https://marketplace.visualstudio.com/items?itemName=lovits.hot100-practice)
[![GitHub](https://img.shields.io/badge/source-GitHub-181717)](https://github.com/lovits/hot100-acm)

在 VS Code 中浏览、编写和测试 Hot100 算法题，安排每日练习与间隔复习。

## 功能

| 功能 | 说明 |
| --- | --- |
| 两种代码模式 | ACM 完整程序、力扣核心代码，分别保存草稿 |
| 语言选择 | 每次打开题目选择语言，在原生编辑器编写代码 |
| 本机测试 | ACM 多语言本机运行；Case 面板示例、自定义用例与结果展示 |
| 题库筛选 | 按专题、算法标签、公司、难度和状态组合筛选，支持搜索、高频排序 |
| 题目信息 | 题面、题解、标签、提示、相关企业和考察次数 |
| 学习管理 | 收藏、笔记、刷题进度、月历与间隔复习，可修改目标、重置计划 |
| 使用说明 | 点击左侧“运行与提交说明”，直接阅读带表格的格式化说明和快捷键 |

## 可选的私网同步

桌面端和插件可通过自行部署的服务器同步学习进度、计划、代码和笔记。服务器支持 Docker 的云主机或自建 Linux，使用 Tailscale 私网 HTTPS；[按步骤配置服务器和多台设备](https://github.com/lovits/hot100-acm/blob/main/docs/private-sync.md)。默认不启用：在命令面板运行“Hot100: 配置个人私网同步”，输入自己的设备名、私网 IP 和令牌。配置时可选择复用本机桌面端配置；令牌存于 VS Code Secret Storage。离线时保留本地数据，代码冲突保留恢复副本。

## 开始使用

```sh
code --install-extension lovits.hot100-practice
```

也可以把下面这句话交给 Codex、DeepSeek Harness 或其他具备本机操作能力的 Agent：

> 请在我指定的 VS Code 或兼容扩展的 IDE 中，从扩展市场安装 Hot100 ACM（发布者 lovits，扩展标识 lovits.hot100-practice），确认安装成功；如需选择 IDE，请先列出本机可用的 IDE 让我选择。

这句话用于让 Agent 执行安装；插件安装到目标编辑器中。若该编辑器无法访问 Visual Studio Marketplace，可从 [GitHub Release](https://github.com/lovits/hot100-acm/releases/tag/vscode-v0.2.88) 下载 VSIX，通过编辑器的“从 VSIX 安装”完成安装。兼容性以目标编辑器实际支持为准。

1. 安装扩展并打开保存练习代码的工作区。
2. 从 Hot100 ACM 侧栏选择题目及语言。
3. 选择 ACM 或核心代码模式，编写代码后运行示例、自定义用例或全部用例评测。
4. 核心代码可登录力扣后提交官网。其他语言保留对应的原有测试、提交流程。

ACM 使用本机对应语言的工具链，无需登录力扣。目前已接入 Python、C++、C、Java、Go、JavaScript、TypeScript、Rust、Ruby、PHP、Swift、Kotlin、Scala 和 C#；只需安装所选语言的编译器或解释器及其必要运行时，让 VS Code 能从 PATH 找到它们。例如 Java 使用 JDK（`javac` / `java`），Go 使用 `go`。Python 和 C/C++ 也支持读取 VS Code 的解释器或编译配置。未安装对应工具链时会显示提示，不会改用其他语言运行。

代码区下方的 **Hot100 测试** 面板提供 **Case 1、Case 2、＋**。示例自动填入，点击“＋”新增自定义用例；ACM 填写多行标准输入和可选期望输出，核心代码按参数字段填写。用例按题目和模式保存在本机，可切换、编辑或删除自定义用例。点击“测试”运行当前 Case，“运行全部用例”运行面板中的全部 Case，在“测试结果”查看输出或错误。核心代码测试与提交使用力扣官方服务，需要登录。

**运行与完成进度**：ACM 执行“本机运行并评测”或“提交”，会保存代码并运行题库内置的全部评测用例；全部通过后在题库打勾，更新总进度、难度统计及学习记录。与 LeetCode 通过共用同一题的完成状态，重复通过不会把同一道题重复计数。只运行示例或自定义 Case 不标记整题完成，未填写期望输出时只显示运行结果。

## 界面预览

打开题目默认左侧题面、右侧代码；ACM 与核心代码模式切换复用代码分组。

![Hot100 ACM VS Code 插件](https://raw.githubusercontent.com/lovits/hot100-acm/main/docs/images/vscode-extension.png)

## 快捷键

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

运行与提交需聚焦题目代码编辑器；测试面板内也可以直接点击按钮。

Case 面板及本机运行快捷键从 0.2.83 起提供。

## 数据来源

题目参考 [力扣 Hot100](https://leetcode.cn/studyplan/top-100-liked/)，高频与企业考察次数来自 [CodeTop](https://codetop.cc/)。随包数据为快照，非实时更新；当前快照为北京时间 2026-11-17。

## 链接

- [项目仓库](https://github.com/lovits/hot100-acm)
- [插件主页](https://github.com/lovits/hot100-acm/tree/main/vscode-extension)
- [问题反馈](https://github.com/lovits/hot100-acm/issues)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=lovits.hot100-practice)
- [VSIX 下载](https://github.com/lovits/hot100-acm/releases/tag/vscode-v0.2.88)
- [完整运行与提交说明](https://github.com/lovits/hot100-acm/blob/main/vscode-extension/运行与提交说明.html)

**分类**：Education / Programming Languages · **扩展标识**：`lovits.hot100-practice`
