const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const MYSQL_HOME = 'C:\\Program Files\\MySQL\\MySQL Server 8.4';
const MYSQL_DATA = 'C:\\Users\\chcct\\Desktop\\QshopWebUI\\mysql_data';
const MYSQL_BIN = path.join(MYSQL_HOME, 'bin', 'mysqld.exe');
const MYSQL_CLIENT = path.join(MYSQL_HOME, 'bin', 'mysql.exe');

let mysqlProcess = null;
let serverProcess = null;

console.log('========================================');
console.log('  QshopWebUI 启动中...');
console.log('========================================\n');

// 1. 检查数据目录是否已初始化，如果没有则初始化
if (!fs.existsSync(path.join(MYSQL_DATA, 'mysql'))) {
  console.log('[1/4] 初始化 MySQL 数据库...');
  const init = spawn(MYSQL_BIN, ['--initialize-insecure', '--datadir=' + MYSQL_DATA], {
    stdio: 'inherit',
    cwd: MYSQL_DATA
  });
  init.on('exit', (code) => {
    if (code === 0) {
      console.log('✅ MySQL 初始化完成');
      startMySQL();
    } else {
      console.error('❌ MySQL 初始化失败，退出码:', code);
      process.exit(1);
    }
  });
} else {
  console.log('[1/4] MySQL 已初始化，跳过');
  startMySQL();
}

function startMySQL() {
  console.log('\n[2/4] 启动 MySQL 服务器...');
  mysqlProcess = spawn(MYSQL_BIN, ['--datadir=' + MYSQL_DATA, '--port=3306'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: MYSQL_DATA
  });

  mysqlProcess.stdout.on('data', (data) => {
    process.stdout.write('[MySQL] ' + data.toString());
  });
  mysqlProcess.stderr.on('data', (data) => {
    process.stderr.write('[MySQL] ' + data.toString());
  });

  mysqlProcess.on('exit', (code) => {
    console.log('\n[MySQL] 进程退出, 代码:', code);
  });

  // 等待 MySQL 启动
  let attempts = 0;
  const maxAttempts = 30;
  setTimeout(function check() {
    attempts++;
    const checkProc = spawn(MYSQL_CLIENT, ['-u', 'root', '-e', 'SELECT 1'], {
      stdio: ['ignore', 'ignore', 'ignore']
    });
    checkProc.on('exit', (code) => {
      if (code === 0) {
        console.log('✅ MySQL 已启动并可连接');
        importData();
      } else if (attempts < maxAttempts) {
        process.stdout.write('.');
        setTimeout(check, 1000);
      } else {
        console.log('\n❌ MySQL 启动超时');
        process.exit(1);
      }
    });
  }, 2000);
}

function importData() {
  // 检查数据库是否存在
  console.log('\n[3/4] 检查/创建数据库...');
  const checkDb = spawn(MYSQL_CLIENT, ['-u', 'root', '-e', 'USE qshop; SELECT COUNT(*) FROM shops;'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let checkOutput = '';
  checkDb.stdout.on('data', (d) => { checkOutput += d.toString(); });
  checkDb.stderr.on('data', (d) => { checkOutput += d.toString(); });
  checkDb.on('exit', (code) => {
    if (code === 0 && checkOutput.includes('COUNT')) {
      console.log('✅ 数据库 qshop 已存在');
      startExpress();
    } else {
      // 创建数据库并导入数据
      console.log('  创建数据库 qshop...');
      const createDb = spawn(MYSQL_CLIENT, ['-u', 'root', '-e', 'CREATE DATABASE IF NOT EXISTS qshop DEFAULT CHARACTER SET utf8mb4;'], {
        stdio: 'inherit'
      });
      createDb.on('exit', (c) => {
        if (c === 0) {
          console.log('  导入表结构和演示数据...');
          const importProc = spawn(MYSQL_CLIENT, ['-u', 'root', 'qshop'], {
            stdio: ['pipe', 'inherit', 'inherit']
          });
          const schemaPath = 'C:\\Users\\chcct\\Desktop\\QshopWebUI\\setup-db.sql';
          fs.createReadStream(schemaPath).pipe(importProc.stdin);
          importProc.on('exit', (c2) => {
            if (c2 === 0) {
              console.log('✅ 数据导入完成');
              startExpress();
            } else {
              // 用 JavaScript 直接建表和插入数据
              console.log('  用 JavaScript 建表...');
              setupWithJS();
            }
          });
        } else {
          console.log('  创建数据库失败，尝试用 JavaScript...');
          setupWithJS();
        }
      });
    }
  });
}

function setupWithJS() {
  const mysql = require('mysql2');
  const conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    charset: 'utf8mb4'
  });
  conn.connect((err) => {
    if (err) { console.error('连接失败:', err); process.exit(1); }
    conn.query('CREATE DATABASE IF NOT EXISTS qshop DEFAULT CHARACTER SET utf8mb4', (err) => {
      if (err) { console.error(err); process.exit(1); }
      conn.changeUser({ database: 'qshop' }, (err) => {
        if (err) { console.error(err); process.exit(1); }
        const createTable = `CREATE TABLE IF NOT EXISTS shops (
          shop_id VARCHAR(100) NOT NULL,
          material VARCHAR(100) NOT NULL,
          item_name VARCHAR(255) NOT NULL,
          owner_name VARCHAR(255) NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          stacking_amount INT DEFAULT 1,
          shop_type ENUM('SELLING','BUYING') NOT NULL DEFAULT 'SELLING',
          world VARCHAR(100) DEFAULT 'world',
          x INT DEFAULT 0,
          y INT DEFAULT 0,
          z INT DEFAULT 0,
          price_reasonable TINYINT(1) DEFAULT 1,
          activity_score INT DEFAULT 0,
          fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (shop_id),
          KEY idx_material (material),
          KEY idx_owner (owner_name),
          KEY idx_type (shop_type),
          KEY idx_price (price)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
        conn.query(createTable, (err) => {
          if (err) { console.error('建表失败:', err); process.exit(1); }
          // 插入演示数据
          const shops = [
            ['demo_0', 'DIAMOND', 'Diamond', 'Alex', 203.18, 1, 'SELLING', 'world', -534, 36, 331],
            ['demo_1', 'IRON_INGOT', 'Iron Ingot', 'Steve', 131.68, 8, 'BUYING', 'world_nether', -233, 82, 694],
            ['demo_2', 'GOLD_INGOT', 'Gold Ingot', 'MineLord', 121.93, 16, 'SELLING', 'world_the_end', 200, 43, -394],
            ['demo_3', 'COAL', 'Coal', '方块王', 15.50, 64, 'BUYING', 'world', 150, 65, 200],
            ['demo_4', 'EMERALD', 'Emerald', '钻石女王', 185.00, 1, 'SELLING', 'world', -100, 70, -50],
            ['demo_5', 'ANCIENT_DEBRIS', 'Ancient Debris', '附魔师', 500.00, 1, 'SELLING', 'world_nether', -50, 20, 100],
            ['demo_6', 'COBBLESTONE', 'Cobblestone', '红石工坊', 5.00, 64, 'BUYING', 'world', 300, 64, 400],
            ['demo_7', 'DIRT', 'Dirt', 'Notch', 2.50, 64, 'BUYING', 'world', 306, 96, -435],
            ['demo_8', 'GLASS', 'Glass', 'Alex', 12.00, 16, 'SELLING', 'world', 400, 68, 500],
            ['demo_9', 'GRAVEL', 'Gravel', 'Steve', 8.75, 64, 'BUYING', 'world', -600, 64, -600],
            ['demo_10', 'SAND', 'Sand', 'MineLord', 7.50, 64, 'SELLING', 'world', 700, 64, 700],
            ['demo_11', 'REDSTONE', 'Redstone', '红石工坊', 25.00, 16, 'SELLING', 'world', 800, 15, 800],
            ['demo_12', 'LAPIS_LAZULI', 'Lapis Lazuli', '附魔师', 45.00, 16, 'SELLING', 'world', 900, 30, 900],
            ['demo_13', 'QUARTZ', 'Quartz', '方块王', 35.00, 16, 'SELLING', 'world_nether', 100, 45, 200],
            ['demo_14', 'NETHERRACK', 'Netherrack', '钻石女王', 3.00, 64, 'BUYING', 'world_nether', 200, 50, 300],
            ['demo_15', 'OBSIDIAN', 'Obsidian', 'Notch', 50.00, 1, 'SELLING', 'world', -700, 10, -700],
            ['demo_16', 'TNT', 'TNT', 'MineLord', 80.00, 1, 'SELLING', 'world', 1000, 64, 1000],
            ['demo_17', 'DIAMOND_SWORD', 'Diamond Sword', 'Alex', 350.00, 1, 'SELLING', 'world', 1100, 70, 1100],
            ['demo_18', 'DIAMOND_PICKAXE', 'Diamond Pickaxe', '附魔师', 380.00, 1, 'SELLING', 'world', 1200, 64, 1200],
            ['demo_19', 'IRON_SWORD', 'Iron Sword', 'Steve', 85.00, 1, 'SELLING', 'world', 1300, 66, 1300],
            ['demo_20', 'IRON_PICKAXE', 'Iron Pickaxe', '钻石女王', 75.00, 1, 'SELLING', 'world', 1400, 68, 1400],
            ['demo_21', 'GOLD_SWORD', 'Gold Sword', 'MineLord', 65.00, 1, 'BUYING', 'world_the_end', 1500, 40, 1500],
            ['demo_22', 'GOLD_PICKAXE', 'Gold Pickaxe', 'Notch', 55.00, 1, 'BUYING', 'world_the_end', 1600, 45, -1600],
            ['demo_23', 'BREAD', 'Bread', '方块王', 8.00, 1, 'SELLING', 'world', 1900, 65, 1900],
            ['demo_24', 'APPLE', 'Apple', '附魔师', 5.00, 1, 'SELLING', 'world', 2200, 68, -2200],
            ['demo_25', 'ENDER_PEARL', 'Ender Pearl', 'Alex', 25.00, 16, 'SELLING', 'world', -2400, 50, -2400],
            ['demo_26', 'BLAZE_ROD', 'Blaze Rod', 'MineLord', 40.00, 1, 'SELLING', 'world_nether', 2500, 30, 2500],
            ['demo_27', 'SLIME_BALL', 'Slime Ball', '方块王', 20.00, 16, 'SELLING', 'world', -2800, 60, 2800],
            ['demo_28', 'FEATHER', 'Feather', '红石工坊', 5.00, 16, 'SELLING', 'world', 2900, 65, -2900],
            ['demo_29', 'LEATHER', 'Leather', '钻石女王', 8.00, 16, 'SELLING', 'world', -3000, 70, -3000],
            ['demo_30', 'STRING', 'String', 'Notch', 6.00, 16, 'SELLING', 'world', 3100, 68, 3100],
            ['demo_31', 'BONE', 'Bone', 'MineLord', 7.00, 16, 'SELLING', 'world', -3200, 64, 3200],
            ['demo_32', 'ROTTEN_FLESH', 'Rotten Flesh', 'Alex', 3.00, 16, 'BUYING', 'world', 3300, 66, -3300]
          ];
          const sql = 'INSERT IGNORE INTO shops (shop_id, material, item_name, owner_name, price, stacking_amount, shop_type, world, x, y, z, price_reasonable, activity_score) VALUES ?';
          const values = shops.map(s => [...s, 1, 50]);
          conn.query(sql, [values], (err, result) => {
            if (err) { console.error('插入失败:', err); process.exit(1); }
            console.log('✅ 已插入 ' + result.affectedRows + ' 条演示数据');
            conn.end();
            startExpress();
          });
        });
      });
    });
  });
}

function startExpress() {
  console.log('\n[4/4] 启动 Express 服务器...');
  serverProcess = spawn('node', ['server.js'], {
    stdio: 'inherit',
    cwd: 'C:\\Users\\chcct\\Desktop\\QshopWebUI'
  });
  serverProcess.on('exit', (code) => {
    console.log('Express 服务器退出, 代码:', code);
  });

  setTimeout(() => {
    console.log('\n========================================');
    console.log('  ✅ QshopWebUI 启动完成！');
    console.log('  访问地址: http://localhost:3000');
    console.log('========================================\n');
  }, 3000);
}

// 清理子进程
process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  if (mysqlProcess) mysqlProcess.kill();
  if (serverProcess) serverProcess.kill();
  setTimeout(() => process.exit(0), 1000);
});
