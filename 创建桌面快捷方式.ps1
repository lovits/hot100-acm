$ErrorActionPreference = 'Stop'
$deliveryRoot = $PSScriptRoot
$pythonCandidates = @('D:\Miniconda3\pythonw.exe')
$pythonCommand = Get-Command pythonw.exe -ErrorAction SilentlyContinue
if ($pythonCommand) { $pythonCandidates += $pythonCommand.Source }
$pythonLauncher = $pythonCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $pythonLauncher) { throw '未找到 Python。请先安装 Python 3，再重新运行本脚本。' }
$desktopDirectory = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopDirectory 'Hot100 ACM 刷题.lnk'
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
$shortcut.TargetPath = $pythonLauncher
$shortcut.Arguments = '"' + (Join-Path $deliveryRoot 'launch.pyw') + '"'
$shortcut.WorkingDirectory = $deliveryRoot
$shortcut.IconLocation = (Join-Path $deliveryRoot 'dist\assets\app-hot100oj.ico') + ',0'
$shortcut.Description = 'Hot100 ACM 本地刷题 · Python · 100 道详细题解'
$shortcut.WindowStyle = 7
$shortcut.Save()
Write-Output ('已创建：' + $shortcutPath)
