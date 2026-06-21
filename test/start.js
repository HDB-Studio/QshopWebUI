const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const MYSQL_HOME = 'C:\\Program Files\\MySQL\\MySQL Server 8.4';
const MYSQL_DATA = 'C:\\mysql_data';
const MYSQL_BIN = path.join(MYSQL_HOME, 'bin', 'mysqld.exe');
const MYSQL_CLIENT = path.join(MYSQL_HOME, 'bin', 'mysql.exe');

let mysqlProcess = null;
let serverProcess = null;

console.log('========================================');
console.log('  正在启动 QshopWebUI...');
console.log('========================================\n');

// 1. 启动 MySQL
console.log('[1/3] 启动 MySQL 数据库...');
mysqlProcess = spawn(MYSQL_BIN, ['--datadir=' + MYSQL_DATA, '--port=3306'], {
  stdio: ['ignore', 'pipe', 'pipe']
});

mysqlProcess.stdout.on('data', (data) => {
  process.stdout.write('[MySQL] ' + data.toString());
});
mysqlProcess.stderr.on('data', (data) => {
  process.stderr.write('[MySQL] ' + data.toString());
});

mysqlProcess.on('error', (err) => {
  console.error('MySQL 启动失败:', err.message);
});

mysqlProcess.on('exit', (code) => {
  console.log('MySQL 进程退出, 代码:', code);
});

// 2. 等待 MySQL 就绪
let attempts = 0;
const maxAttempts = 20;
function waitForMySQL() {
  attempts++;
  const check = spawn(MYSQL_CLIENT, ['-u', 'root', '-e', 'SELECT 1'], {
    stdio: ['ignore', 'ignore', 'ignore']
  });
  check.on('exit', (code) => {
    if (code === 0) {
      console.log('✅ MySQL 已就绪');
      startExpress();
    } else if (attempts < maxAttempts) {
      process.stdout.write('.');
      setTimeout(waitForMySQL, 1000);
    } else {
      console.log('\n❌ MySQL 启动超时，请手动检查');
      process.exit(1);
    }
  });
}

function startExpress() {
  console.log('\n[2/3] 启动 Express 服务器...');
  serverProcess = spawn('node', ['server.js'], {
    stdio: 'inherit',
    cwd: require('path').join(__dirname, '..')
  });

  serverProcess.on('exit', (code) => {
    console.log('Express 服务器退出, 代码:', code);
  });
}

setTimeout(() => {
  process.stdout.write('  等待 MySQL 启动 ');
  waitForMySQL();
}, 2000);

// 3. 清理子进程
process.on('SIGINT', () => {
  console.log('\n\n正在关闭服务...');
  if (mysqlProcess) mysqlProcess.kill();
  if (serverProcess) serverProcess.kill();
  setTimeout(() => process.exit(0), 1000);
});

process.on('SIGTERM', () => {
  if (mysqlProcess) mysqlProcess.kill();
  if (serverProcess) serverProcess.kill();
  process.exit(0);
});
