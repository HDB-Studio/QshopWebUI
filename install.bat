@echo off
echo [1/2] 正在刷新环境变量...
set PATH=C:\Program Files\nodejs;%PATH%

echo [2/2] 正在安装 Node.js 依赖 (npm install)...
cd /d C:\Users\chcct\Desktop\QshopWebUI
call npm install
echo.
echo ========================================
echo   安装完成！现在可以启动服务器了。
echo   请运行: npm start
echo ========================================
echo.
pause
