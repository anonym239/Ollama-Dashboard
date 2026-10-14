@echo off
title Ollama Dashboard
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js wurde nicht gefunden. Bitte installiere Node.js von https://nodejs.org
  echo Oder nutze den Installer aus den GitHub-Releases - der braucht kein Node.js.
  pause
  exit /b 1
)
node server.js
pause
