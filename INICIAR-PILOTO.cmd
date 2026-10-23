@echo off
cd /d "%~dp0"
set SIGEIA_MODE=pilot
node scripts\start.mjs
pause
