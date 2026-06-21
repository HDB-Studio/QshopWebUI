const { spawn } = require('child_process');
const fs = require('fs');

const CLIENT_BIN = 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe';

console.log('[1/2] 删除并重建 qshop 数据库...');
const dropDb = spawn(CLIENT_BIN, ['-u', 'root', '-e', 'DROP DATABASE IF EXISTS qshop; CREATE DATABASE qshop DEFAULT CHARACTER SET utf8mb4;'], {
  stdio: 'inherit'
});

dropDb.on('close', (code) => {
  if (code !== 0) {
    console.error('重建数据库失败');
    process.exit(code);
  }
  console.log('✓ 数据库 qshop 重建成功');

  console.log('[2/2] 导入 schema.sql 表结构...');
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
    console.log('✓ 表结构和演示数据导入成功！');

    const checkProc = spawn(CLIENT_BIN, ['-u', 'root', 'qshop', '-e', 'SELECT COUNT(*) AS total FROM shops;'], {
      stdio: 'inherit'
    });
    checkProc.on('close', () => {
      console.log('\n========================================');
      console.log('  ✓ MySQL 数据库完整配置成功！');
      console.log('  数据库: qshop');
      console.log('  用户: root (空密码)');
      console.log('  端口: 3306');
      console.log('========================================');
      process.exit(0);
    });
  });
});
