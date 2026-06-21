@echo off
chcp 65001 >nul
title Qshop WebUI - 商店系统 Web 前端
setlocal

echo =======================================================
echo     Qshop WebUI - 商店系统 v2.0 (一键启动)
echo =======================================================
echo.

cd /d "%~dp0"

rem ---------- Node 检查 ----------
where node >nul 2>&1
if errorlevel 1 (
  echo [错误] 未检测到 Node.js。
  echo        请先到 https://nodejs.org/zh-cn/download 安装 LTS 版本。
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%i in ('node -v') do set NODE_V=%%i
echo [Info] Node.js 版本: %NODE_V%

rem ---------- 依赖检查 ----------
if not exist "node_modules\express" (
  echo [Info] 未安装依赖，开始执行 npm install ...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [错误] npm install 失败。
    pause
    exit /b 2
  )
  echo [Info] 依赖安装完成。
) else (
  echo [Info] 依赖已就绪。
)

rem ---------- 环境变量默认值 ----------
if "%PORT%"=="" set PORT=3000
if "%SERVER_HOST%"=="" set SERVER_HOST=0.0.0.0

rem ---------- 启动 ----------
echo.
echo [Info] 启动 QshopWebUI 服务器 ...
echo [Info] 监听地址: http://%SERVER_HOST%:%PORT%/
echo [Info] 按 Ctrl+C 停止服务器。
echo.
echo =======================================================
echo.

call node server.js

echo.
echo [Info] 服务器已停止。
pause
endlocal
