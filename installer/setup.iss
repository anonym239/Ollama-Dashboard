; Inno-Setup-Skript für das Ollama Dashboard (Windows-Installer)
; Bauen: iscc /DMyAppVersion=1.0.0 installer\setup.iss   (vorher: npm run build)

#define MyAppName "Ollama Dashboard"
#ifndef MyAppVersion
  #define MyAppVersion "1.0.0"
#endif
#define MyAppExe "OllamaDashboard.exe"
#define MyAppUrl "https://github.com/anonym239/Ollama-Dashboard"

[Setup]
AppId={{8F3C2A51-6B7E-4D2A-9C1F-0A5E7B3D9C42}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher=Ollama Dashboard
AppPublisherURL={#MyAppUrl}
AppSupportURL={#MyAppUrl}/issues
AppUpdatesURL={#MyAppUrl}/releases
; Installation ohne Administratorrechte (pro Benutzer)
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=OllamaDashboard-Setup-{#MyAppVersion}
SetupIconFile=..\build\icon.ico
UninstallDisplayIcon={app}\icon.ico
UninstallDisplayName={#MyAppName}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "german"; MessagesFile: "compiler:Languages\German.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
german.OllamaMissing=Ollama ist noch nicht installiert. Ollama wird benötigt, um die KIs lokal auszuführen.%n%nDu kannst es nach der Installation direkt im Dashboard mit einem Klick installieren oder jetzt die Download-Seite öffnen.
english.OllamaMissing=Ollama is not installed yet. Ollama is required to run the AI models locally.%n%nYou can install it with one click from the dashboard or open the download page now.
german.OpenOllamaDownload=Ollama-Download-Seite öffnen (benötigt)
english.OpenOllamaDownload=Open the Ollama download page (required)

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "..\dist\app\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[InstallDelete]
; Den früheren Skill-Ordner bei Updates entfernen (Skills gibt es nicht mehr)
Type: filesandordirs; Name: "{app}\skills"

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"; Tasks: desktopicon

[Run]
Filename: "https://ollama.com/download"; Description: "{cm:OpenOllamaDownload}"; Flags: shellexec postinstall skipifsilent unchecked; Check: not OllamaInstalled
Filename: "{app}\{#MyAppExe}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/IM {#MyAppExe} /F"; Flags: runhidden; RunOnceId: "StopDashboard"

[Code]
function OllamaInstalled: Boolean;
begin
  Result := FileExists(ExpandConstant('{localappdata}\Programs\Ollama\ollama.exe'))
    or FileExists(ExpandConstant('{commonpf}\Ollama\ollama.exe'));
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep = ssPostInstall) and (not WizardSilent) and (not OllamaInstalled) then
    MsgBox(CustomMessage('OllamaMissing'), mbInformation, MB_OK);
end;

