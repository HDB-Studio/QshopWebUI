const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const MYSQL_HOME = 'C:\\Program Files\\MySQL\\MySQL Server 8.4';
const MYSQL_DATA = 'C:\\mysql_data';
const MYSQL_BIN = path.join(MYSQL_HOME, 'bin', 'mysqld.exe');
const CLIENT_BIN = path.join(MYSQL_HOME, 'bin', 'mysql.exe');

// 1. 清空并创建数据目录
if (fs.existsSync(MYSQL_DATA)) {
  fs.rmSync(MYSQL_DATA, { recursive: true, force: true });
}
fs.mkdirSync(MYSQL_DATA, { recursive: true });
console.log('[1/4] 数据目录创建: ' + MYSQL_DATA);

// 2. 初始化数据库
const init = spawn(MYSQL_BIN, ['--initialize-insecure', '--datadir=' + MYSQL_DATA, '--basedir=' + MYSQL_HOME], {
  stdio: 'inherit'
});

init.on('close', (code) => {
  if (code !== 0) {
    console.error('初始化失败，退出码: ' + code);
    process.exit(code);
  }
  console.log('[2/4] 数据库初始化完成');

  // 3. 启动 MySQL 服务器
  console.log('[3/4] 启动 MySQL 服务器...');
  const server = spawn(MYSQL_BIN, ['--datadir=' + MYSQL_DATA, '--port=3306', '--console'], {
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: true
  });
  server.unref();

  // 等待服务器启动
  setTimeout(() => {
    console.log('[4/4] 创建 qshop 数据库并导入表结构...');
    const createDb = spawn(CLIENT_BIN, ['-u', 'root', '-e', 'CREATE DATABASE qshop DEFAULT CHARACTER SET utf8mb4;'], {
      stdio: 'inherit'
    });
    createDb.on('close', (code) => {
      if (code !== 0) {
        console.error('创建数据库失败');
        process.exit(code);
      }
      console.log('✓ 数据库 qshop 创建成功');

      // 导入 schema.sql
      const schemaPath = 'C:\\Users\\chcct\\Desktop\\QshopWebUI\\schema.sql';
      const importProc = spawn(CLIENT_BIN, ['-u', 'root', 'qshop'], {
        stdio: ['pipe', 'inherit', 'inherit']
      });
      fs.createReadStream(schemaPath).pipe(importProc.stdin);
      importProc.on('close', (code2) => {
        if (code2 !== 0) {
          console.error('导入表结构失败');
          process.exit(code2);
        }
        console.log('\n========================================');
        console.log('  ✓ MySQL 安装和配置完成！');
        console.log('  数据库: qshop (root, 空密码)');
        console.log('  服务器: localhost:3306');
        console.log('  数据目录: ' + MYSQL_DATA);
        console.log('========================================');
        process.exit(0);
      });
    });
  }, 5000);
});
