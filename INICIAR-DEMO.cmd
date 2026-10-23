@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js 22 o superior desde https://nodejs.org y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)
node scripts\start.mjs --demo
pause
