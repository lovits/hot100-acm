# Windows 安装器构建

需要 Windows x64、Python 3、Node.js、.NET Framework 4.x 自带的 C# 编译器，以及 Inno Setup 6。先准备与当前源码匹配的便携 Windows 发布包，并解压到一个临时目录。`SourceDir` 必须指向其中包含 `local_server.py`、`dist` 和 `runtime` 的 `Hot100` 目录。

在仓库根目录的 PowerShell 中运行：

```powershell
.\scripts\windows-installer\build_installer.ps1 `
  -SourceDir 'C:\build\Hot100' `
  -OutputDir 'C:\build\publish' `
  -InnoCompiler 'C:\Program Files (x86)\Inno Setup 6\ISCC.exe' `
  -Version '1.0.16'
```

脚本会在临时 `SourceDir` 内编译启动器，并生成 `Hot100-Windows-x64-Setup.exe`。构建输入不得包含学习数据、云端同步凭据或其他个人文件。生成后应先在隔离目录测试安装、升级备份、已有服务运行时的提示以及卸载保留用户数据，再发布。

简体中文界面翻译来自 [Inno Setup Chinese Simplified Translation](https://github.com/kira-96/Inno-Setup-Chinese-Simplified-Translation)，使用 MIT 许可证，见本目录的 `ChineseSimplified.LICENSE`。
