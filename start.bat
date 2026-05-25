@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title 随心记

echo.
echo    ╔══════════════════════════╗
echo    ║    随 心 记  启 动 中   ║
echo    ╚══════════════════════════╝
echo.

:: 关闭旧进程
taskkill /f /im electron.exe >nul 2>&1

:: 启动 Vite
echo [1/2] 启动开发服务器...
start /b cmd /c "npx vite --port 5173 --force >nul 2>&1"

:: 等待 Vite 就绪（最多 20 秒）
for /l %%i in (1,1,20) do (
  timeout /t 1 /nobreak >nul
  curl -s -o nul http://localhost:5173 2>nul && goto ready
)

echo [错误] Vite 启动超时，请检查 Node.js 是否已安装
pause
exit /b 1

:ready
echo [2/2] 启动随心记...
start /b cmd /c "npx electron . >nul 2>&1"
echo    ✓ 随心记已启动！
timeout /t 2 >nul
exit
