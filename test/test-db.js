const { spawn } = require('child_process');

const CLIENT_BIN = 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe';

// 先检查表结构
const check = spawn(CLIENT_BIN, ['-u', 'root', 'qshop', '-e', 'DESCRIBE shops;'], {
  stdio: 'inherit'
});

check.on('close', () => {
  // 直接测试插入中文
  const test = spawn(CLIENT_BIN, ['-u', 'root', 'qshop', '-e', "INSERT INTO shops (shop_id, material, item_name, owner_name, price, shop_type) VALUES ('test1', 'DIAMOND', 'Diamond', '方块王', 100.00, 'SELLING');"], {
    stdio: 'inherit'
  });
  test.on('close', (code) => {
    console.log('插入测试完成，退出码: ' + code);
    process.exit(code);
  });
});
