@echo off
set MYSQL_HOME=C:\Progra~1\MySQL\MYSQLS~1.4
set MYSQL_DATA=C:\mysql_data

echo [1/3] 清空数据目录...
if exist "%MYSQL_DATA%" rmdir /s /q "%MYSQL_DATA%"
mkdir "%MYSQL_DATA%"

echo [2/3] 初始化 MySQL 数据库...
cd /d "%MYSQL_HOME%\bin"
mysqld.exe --initialize-insecure --datadir="%MYSQL_DATA%" --basedir="%MYSQL_HOME%"

echo [3/3] 启动 MySQL 服务器...
start "MySQL Server" mysqld.exe --datadir="%MYSQL_DATA%" --port=3306 --console

echo ========================================
echo   MySQL 初始化完成！
echo   现在可以导入数据库了
echo ========================================
timeout /t 5
