修复进度目录恢复提示。

- 原目录不可用但默认目录有进度时，直接加载已有进度，不再弹出恢复错误。
- 不向用户显示英文内部异常，诊断写入后台日志；原目录配置仍备份保存。
- 保留损坏进度文件的原有恢复警告，避免覆盖真实的数据损坏提示。
- 完整关闭旧后台后启动新版，刷新页面以连接新服务；不要同时运行多个版本。

Windows 主包完整解压后运行 Hot100/Start-Hot100.vbs；移动应用文件夹后重新运行 Create-Desktop-Shortcut.vbs 更新桌面入口。

C/C++ 离线扩展包沿用 [v1.0.2 扩展包](https://github.com/lovits/hot100-acm/releases/download/v1.0.2/Hot100-Windows-C-Cpp-addon.zip)，与本版兼容。使用已有 gcc/g++ 的电脑无需下载扩展包。
