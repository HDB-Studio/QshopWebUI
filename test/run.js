const { spawn } = require('child_process');
const http = require('http');

const MYSQL_BIN = 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysqld.exe';
const DATA_DIR = 'C:\\Users\\chcct\\Desktop\\QshopWebUI\\mysql_data';
const PROJECT_DIR = 'C:\\Users\\chcct\\Desktop\\QshopWebUI';

let mysqlProc = null;
let serverProc = null;

console.log('启动中...');

// 启动 MySQL
mysqlProc = spawn(MYSQL_BIN, ['--datadir=' + DATA_DIR, '--port=3306'], {
  stdio: ['ignore', 'pipe', 'pipe']
});

mysqlProc.on('exit', (code) => {
  console.log('MySQL 进程退出, 代码:', code);
});

// 等待 MySQL 启动
function testMySQL(callback) {
  const clientBin = 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe';
  const test = spawn(clientBin, ['-u', 'root', '-e', 'SELECT 1'], {
    stdio: ['ignore', 'ignore', 'ignore']
  });
  test.on('exit', (code) => {
    if (code === 0) {
      console.log('✅ MySQL 已启动');
      callback();
    } else {
      setTimeout(() => testMySQL(callback), 1000);
    }
  });
}

let attempts = 0;
function waitForMySQL() {
  attempts++;
  if (attempts > 30) {
    console.log('❌ MySQL 启动超时');
    process.exit(1);
  }
  testMySQL(startExpress);
}

function startExpress() {
  console.log('🚀 启动 Express 服务器...');
  serverProc = spawn('node', ['server.js'], {
    stdio: 'inherit',
    cwd: PROJECT_DIR
  });
  serverProc.on('exit', (code) => {
    console.log('Express 退出:', code);
  });

  // 测试 API
  setTimeout(testAPI, 3000);
}

function testAPI() {
  const req = http.get('http://localhost:3000/api/health', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('✅ API 正常 -', data);
      console.log('\n========================================');
      console.log('  服务已启动！');
      console.log('  访问: http://localhost:3000');
      console.log('========================================');
    });
  });
  req.on('error', (err) => {
    console.log('⚠️ API 测试失败:', err.message);
    setTimeout(testAPI, 2000);
  });
}

setTimeout(waitForMySQL, 3000);

process.on('SIGINT', () => {
  console.log('\n关闭服务...');
  if (mysqlProc) mysqlProc.kill();
  if (serverProc) serverProc.kill();
  process.exit(0);
});
