param(
    [Parameter(Mandatory=$true)][string]$SourceDir,
    [Parameter(Mandatory=$true)][string]$OutputDir,
    [Parameter(Mandatory=$true)][string]$InnoCompiler,
    [string]$Version = '1.0.16'
)

$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $SourceDir).Path
$compiler = (Resolve-Path -LiteralPath $InnoCompiler).Path
$output = [System.IO.Path]::GetFullPath($OutputDir)
foreach ($item in @('local_server.py', 'launch.pyw', 'runtime\python\pythonw.exe', 'runtime\node.exe', 'dist\assets\app.ico')) {
    if (-not (Test-Path -LiteralPath (Join-Path $source $item) -PathType Leaf)) {
        throw "Missing release file: $item"
    }
}
New-Item -ItemType Directory -Path $output -Force | Out-Null
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $csc /nologo /target:winexe "/win32icon:$(Join-Path $source 'dist\assets\app.ico')" "/out:$(Join-Path $source 'Hot100.exe')" /reference:System.Windows.Forms.dll (Join-Path $PSScriptRoot 'Hot100Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Could not build Hot100 launcher' }
& $compiler /Qp "/DSourceDir=$source" "/DOutputDir=$output" "/DAppVersion=$Version" (Join-Path $PSScriptRoot 'Hot100.iss')
if ($LASTEXITCODE -ne 0) { throw 'Could not build Hot100 installer' }
Get-Item -LiteralPath (Join-Path $output 'Hot100-Windows-x64-Setup.exe')
