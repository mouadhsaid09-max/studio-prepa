@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js n'est pas installe. Telechargez-le sur https://nodejs.org puis relancez. & pause & exit /b)
if not exist node_modules (echo Installation... & call npm install)
node server.js
pause
