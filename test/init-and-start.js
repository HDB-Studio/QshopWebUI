const mysql = require('mysql2');
const { spawn } = require('child_process');

const conn = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  charset: 'utf8mb4'
});

conn.connect((err) => {
  if (err) { console.error('MySQL 连接失败:', err.message); process.exit(1); }
  console.log('✅ MySQL 连接成功');

  // 创建数据库
  conn.query('CREATE DATABASE IF NOT EXISTS qshop DEFAULT CHARACTER SET utf8mb4', (err) => {
    if (err) { console.error(err); process.exit(1); }

    conn.changeUser({ database: 'qshop' }, (err) => {
      if (err) { console.error(err); process.exit(1); }

      // 创建 shops 表
      const createShops = `CREATE TABLE IF NOT EXISTS shops (
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

      conn.query(createShops, (err) => {
        if (err) { console.error('建表失败:', err.message); process.exit(1); }

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
          ['demo_23', 'STONE_SWORD', 'Stone Sword', 'Alex', 25.00, 1, 'SELLING', 'world', -1700, 64, -1700],
          ['demo_24', 'WOODEN_SWORD', 'Wooden Sword', 'Steve', 15.00, 1, 'SELLING', 'world', 1800, 72, 1800],
          ['demo_25', 'BREAD', 'Bread', '方块王', 8.00, 1, 'SELLING', 'world', 1900, 65, 1900],
          ['demo_26', 'COOKED_BEEF', 'Cooked Beef', '附魔师', 12.50, 16, 'SELLING', 'world', -2000, 64, -2000],
          ['demo_27', 'COOKED_CHICKEN', 'Cooked Chicken', '红石工坊', 10.00, 16, 'SELLING', 'world', 2100, 65, 2100],
          ['demo_28', 'APPLE', 'Apple', '钻石女王', 5.00, 16, 'SELLING', 'world', 2200, 68, -2200],
          ['demo_29', 'GOLDEN_APPLE', 'Golden Apple', 'Notch', 150.00, 1, 'SELLING', 'world', 2300, 70, 2300],
          ['demo_30', 'ENDER_PEARL', 'Ender Pearl', '附魔师', 25.00, 16, 'SELLING', 'world', -2400, 50, -2400],
          ['demo_31', 'BLAZE_ROD', 'Blaze Rod', 'MineLord', 40.00, 1, 'SELLING', 'world_nether', 2500, 30, 2500],
          ['demo_32', 'GHAST_TEAR', 'Ghast Tear', 'Alex', 60.00, 1, 'SELLING', 'world_nether', -2600, 35, -2600],
          ['demo_33', 'MAGMA_CREAM', 'Magma Cream', 'Steve', 35.00, 1, 'SELLING', 'world_nether', 2700, 40, 2700],
          ['demo_34', 'SLIME_BALL', 'Slime Ball', '方块王', 20.00, 16, 'SELLING', 'world', -2800, 60, 2800],
          ['demo_35', 'FEATHER', 'Feather', '红石工坊', 5.00, 16, 'SELLING', 'world', 2900, 65, -2900],
          ['demo_36', 'LEATHER', 'Leather', '钻石女王', 8.00, 16, 'SELLING', 'world', -3000, 70, -3000],
          ['demo_37', 'STRING', 'String', 'Notch', 6.00, 16, 'SELLING', 'world', 3100, 68, 3100],
          ['demo_38', 'BONE', 'Bone', 'MineLord', 7.00, 16, 'SELLING', 'world', -3200, 64, 3200],
          ['demo_39', 'ROTTEN_FLESH', 'Rotten Flesh', 'Alex', 3.00, 16, 'BUYING', 'world', 3300, 66, -3300]
        ];

        const sql = 'INSERT IGNORE INTO shops (shop_id, material, item_name, owner_name, price, stacking_amount, shop_type, world, x, y, z, price_reasonable, activity_score) VALUES ?';
        const values = shops.map(s => [...s, 1, 50]);

        conn.query(sql, [values], (err, result) => {
          if (err) { console.error('插入失败:', err.message); process.exit(1); }
          console.log('✅ 已插入 ' + result.affectedRows + ' 条演示数据');
          conn.end();

          // 启动 Express 服务器
          console.log('🚀 启动 Express 服务器...');
          const server = spawn('node', ['server.js'], {
            stdio: 'inherit',
            cwd: require('path').join(__dirname, '..')
          });
          server.on('exit', (code) => {
            console.log('服务器退出, 代码:', code);
          });
        });
      });
    });
  });
});
