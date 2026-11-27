#ifndef SourceDir
  #error SourceDir must be supplied
#endif
#ifndef OutputDir
  #error OutputDir must be supplied
#endif
#ifndef AppVersion
  #define AppVersion "1.0.16"
#endif
#ifndef ProbePort
  #define ProbePort "18765"
#endif

[Setup]
AppId={{B2BCB95B-B847-4537-B3CC-1CB47CB8D47E}
AppName=Hot100 ACM 刷题台
AppVersion={#AppVersion}
AppPublisher=Hot100 ACM
DefaultDirName={code:DefaultDirectory}
DefaultGroupName=Hot100 ACM
DisableProgramGroupPage=yes
OutputDir={#OutputDir}
OutputBaseFilename=Hot100-Windows-x64-Setup
SetupIconFile={#SourceDir}\dist\assets\app.ico
UninstallDisplayIcon={app}\Hot100.exe
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
WizardStyle=modern
CloseApplications=no
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "chinesesimp"; MessagesFile: "ChineseSimplified.isl"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"
Name: "startmenuicon"; Description: "创建开始菜单快捷方式"

[Icons]
Name: "{autodesktop}\Hot100 ACM"; Filename: "{app}\Hot100.exe"; WorkingDir: "{app}"; IconFilename: "{app}\dist\assets\app.ico"; Tasks: desktopicon
Name: "{group}\Hot100 ACM"; Filename: "{app}\Hot100.exe"; WorkingDir: "{app}"; Tasks: startmenuicon

[Run]
Filename: "{app}\Hot100.exe"; Description: "启动 Hot100 ACM 刷题台"; Flags: nowait postinstall skipifsilent

[Code]
function IsHot100Running: Boolean;
var
  Request: Variant;
  ResponseText: String;
  StatusCode: Integer;
begin
  Result := False;
  try
    Request := CreateOleObject('WinHttp.WinHttpRequest.5.1');
    Request.SetTimeouts(1000, 1000, 1000, 1000);
    Request.SetProxy(1);
    Request.Open('GET', 'http://127.0.0.1:{#ProbePort}/api/health', False);
    Request.Send();
    ResponseText := Request.ResponseText;
    StatusCode := Request.Status;
    Result := (StatusCode = 200) and (Pos('hot100-acm-local-v2', ResponseText) > 0);
  except
    { A stopped service is expected on a clean install. }
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  if IsHot100Running then
    Result := '检测到 Hot100 仍在运行。请先保存所有未保存的代码，并关闭 Hot100 和其本地服务，然后重新运行安装程序。';
end;

function DefaultDirectory(Param: String): String;
begin
  if DirExists('F:\') then
    Result := 'F:\Hot100'
  else
    Result := ExpandConstant('{localappdata}\Programs\Hot100');
end;

procedure CopyTree(const Source, Destination: String);
var
  FindRec: TFindRec;
  SourcePath, DestinationPath: String;
begin
  if not ForceDirectories(Destination) then
    RaiseException('无法创建程序备份目录：' + Destination);
  if FindFirst(AddBackslash(Source) + '*', FindRec) then
  try
    repeat
      if (FindRec.Name <> '.') and (FindRec.Name <> '..') then begin
        SourcePath := AddBackslash(Source) + FindRec.Name;
        DestinationPath := AddBackslash(Destination) + FindRec.Name;
        if (FindRec.Attributes and $400) <> 0 then
          RaiseException('程序备份遇到链接，请先手动备份：' + SourcePath);
        if (FindRec.Attributes and FILE_ATTRIBUTE_DIRECTORY) <> 0 then
          CopyTree(SourcePath, DestinationPath)
        else if not FileCopy(SourcePath, DestinationPath, False) then
          RaiseException('程序备份失败：' + SourcePath);
      end;
    until not FindNext(FindRec);
  finally
    FindClose(FindRec);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  InstallPath, BackupPath: String;
  Suffix: Integer;
begin
  if CurStep <> ssInstall then exit;
  InstallPath := RemoveBackslashUnlessRoot(ExpandConstant('{app}'));
  if not DirExists(InstallPath) then exit;
  BackupPath := InstallPath + '-backup-' + GetDateTimeString('yyyymmdd-hhnnss', '-', ':');
  Suffix := 0;
  while DirExists(BackupPath) do begin
    Suffix := Suffix + 1;
    BackupPath := InstallPath + '-backup-' + GetDateTimeString('yyyymmdd-hhnnss', '-', ':') + '-' + IntToStr(Suffix);
  end;
  CopyTree(InstallPath, BackupPath);
  Log('Previous application backed up to ' + BackupPath);
end;
