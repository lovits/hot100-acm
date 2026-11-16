Windows 启动修复与轻量版。

- 修复原进度目录被移动或磁盘断开时无法启动的问题：备份原目录配置，回退本机默认进度目录并提示。原目录数据不删除。
- 本地服务退出时立即报告错误，避免启动器继续等待；本机健康检查绕过系统代理。
- 移除源码中的开发者机器绝对路径。
- Windows 主包使用系统默认浏览器，内置 Python 与 Node，无需另装 Python，无内置 Electron 浏览器。

下载 `Hot100-Windows-x64-release.zip`，完整解压后双击 `Hot100/Start-Hot100.vbs`。双击 `Create-Desktop-Shortcut.vbs` 创建桌面入口。不要直接在 ZIP 内启动。

Python 练习开箱可用。C/C++ 用户额外下载 `Hot100-Windows-C-Cpp-addon.zip`，解压到同一目录，合并 Hot100 文件夹；附带完整离线编译工具，体积较大。也可使用 PATH 中已有的 gcc/g++。

macOS 用户继续使用 v1.0.1。本版没有重建 macOS 应用。
