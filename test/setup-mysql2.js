const mysql = require('mysql2');
const fs = require('fs');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  charset: 'utf8mb4'
});

connection.connect((err) => {
  if (err) throw err;
  console.log('[1/4] MySQL 连接成功');

  connection.query('DROP DATABASE IF EXISTS qshop', (err) => {
    if (err) throw err;
    console.log('[2/4] 旧数据库已清理');

    connection.query('CREATE DATABASE qshop DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', (err) => {
      if (err) throw err;
      console.log('[3/4] 数据库 qshop 创建成功');

      connection.changeUser({ database: 'qshop' }, (err) => {
        if (err) throw err;

        // 创建表
        const createShops = `
          CREATE TABLE shops (
            shop_id VARCHAR(100) NOT NULL,
            material VARCHAR(100) NOT NULL,
            item_name VARCHAR(255) NOT NULL,
            owner_name VARCHAR(255) NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            stacking_amount INT DEFAULT 1,
            shop_type ENUM('SELLING','BUYING') NOT NULL,
            world VARCHAR(100) DEFAULT 'world',
            x INT DEFAULT 0,
            y INT DEFAULT 0,
            z INT DEFAULT 0,
            price_reasonable TINYINT(1) DEFAULT 1,
            nbt JSON NULL,
            fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            activity_score INT DEFAULT 0,
            PRIMARY KEY (shop_id),
            KEY idx_material (material),
            KEY idx_owner (owner_name),
            KEY idx_type (shop_type),
            KEY idx_price (price),
            KEY idx_material_type (material, shop_type),
            KEY idx_world (world)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `;

        connection.query(createShops, (err) => {
          if (err) throw err;
          console.log('[4/4] 表 shops 创建成功');

          // 插入演示数据
          const demoShops = [
            ['demo_0', 'DIAMOND', 'Diamond', 'Alex', 203.18, 1, 'SELLING', 'world', -534, 36, 331, 1, null, 100],
            ['demo_1', 'IRON_INGOT', 'Iron Ingot', 'Steve', 131.68, 8, 'BUYING', 'world_nether', -233, 82, 694, 1, null, 90],
            ['demo_2', 'GOLD_INGOT', 'Gold Ingot', 'MineLord', 121.93, 16, 'SELLING', 'world_the_end', 200, 43, -394, 1, null, 85],
            ['demo_3', 'COAL', 'Coal', '方块王', 15.50, 64, 'BUYING', 'world', 150, 65, 200, 1, null, 80],
            ['demo_4', 'EMERALD', 'Emerald', '钻石女王', 185.00, 1, 'SELLING', 'world', -100, 70, -50, 1, null, 75],
            ['demo_5', 'ANCIENT_DEBRIS', 'Ancient Debris', '附魔师', 500.00, 1, 'SELLING', 'world_nether', -50, 20, 100, 0, null, 70],
            ['demo_6', 'COBBLESTONE', 'Cobblestone', '红石工坊', 5.00, 64, 'BUYING', 'world', 300, 64, 400, 1, null, 65],
            ['demo_7', 'DIRT', 'Dirt', 'Notch', 2.50, 64, 'BUYING', 'world', 306, 96, -435, 1, null, 60],
            ['demo_8', 'GLASS', 'Glass', 'Alex', 12.00, 16, 'SELLING', 'world', 400, 68, 500, 1, null, 55],
            ['demo_9', 'GRAVEL', 'Gravel', 'Steve', 8.75, 64, 'BUYING', 'world', -600, 64, -600, 1, null, 50],
            ['demo_10', 'SAND', 'Sand', 'MineLord', 7.50, 64, 'SELLING', 'world', 700, 64, 700, 1, null, 48],
            ['demo_11', 'REDSTONE', 'Redstone', '红石工坊', 25.00, 16, 'SELLING', 'world', 800, 15, 800, 1, null, 45],
            ['demo_12', 'LAPIS_LAZULI', 'Lapis Lazuli', '附魔师', 45.00, 16, 'SELLING', 'world', 900, 30, 900, 1, null, 42],
            ['demo_13', 'QUARTZ', 'Quartz', '方块王', 35.00, 16, 'SELLING', 'world_nether', 100, 45, 200, 1, null, 40],
            ['demo_14', 'NETHERRACK', 'Netherrack', '钻石女王', 3.00, 64, 'BUYING', 'world_nether', 200, 50, 300, 1, null, 38],
            ['demo_15', 'OBSIDIAN', 'Obsidian', 'Notch', 50.00, 1, 'SELLING', 'world', -700, 10, -700, 1, null, 35],
            ['demo_16', 'TNT', 'TNT', 'MineLord', 80.00, 1, 'SELLING', 'world', 1000, 64, 1000, 0, null, 32],
            ['demo_17', 'DIAMOND_SWORD', 'Diamond Sword', 'Alex', 350.00, 1, 'SELLING', 'world', 1100, 70, 1100, 1, '{"display":{"Name":"\\"附魔钻石剑\\""}}', 30],
            ['demo_18', 'DIAMOND_PICKAXE', 'Diamond Pickaxe', '附魔师', 380.00, 1, 'SELLING', 'world', 1200, 64, 1200, 1, '{"display":{"Name":"\\"效率钻石镐\\""}}', 28],
            ['demo_19', 'IRON_SWORD', 'Iron Sword', 'Steve', 85.00, 1, 'SELLING', 'world', 1300, 66, 1300, 1, null, 25],
            ['demo_20', 'IRON_PICKAXE', 'Iron Pickaxe', '钻石女王', 75.00, 1, 'SELLING', 'world', 1400, 68, 1400, 1, null, 22],
            ['demo_21', 'GOLD_SWORD', 'Gold Sword', 'MineLord', 65.00, 1, 'BUYING', 'world_the_end', 1500, 40, 1500, 1, null, 20],
            ['demo_22', 'GOLD_PICKAXE', 'Gold Pickaxe', 'Notch', 55.00, 1, 'BUYING', 'world_the_end', 1600, 45, -1600, 1, null, 18],
            ['demo_23', 'STONE_SWORD', 'Stone Sword', 'Alex', 25.00, 1, 'SELLING', 'world', -1700, 64, -1700, 1, null, 15],
            ['demo_24', 'WOODEN_SWORD', 'Wooden Sword', 'Steve', 15.00, 1, 'SELLING', 'world', 1800, 72, 1800, 1, null, 12],
            ['demo_25', 'BREAD', 'Bread', '方块王', 8.00, 1, 'SELLING', 'world', 1900, 65, 1900, 1, null, 10],
            ['demo_26', 'COOKED_BEEF', 'Cooked Beef', '附魔师', 12.50, 16, 'SELLING', 'world', -2000, 64, -2000, 1, null, 8],
            ['demo_27', 'COOKED_CHICKEN', 'Cooked Chicken', '红石工坊', 10.00, 16, 'SELLING', 'world', 2100, 65, 2100, 1, null, 6],
            ['demo_28', 'APPLE', 'Apple', '钻石女王', 5.00, 16, 'SELLING', 'world', 2200, 68, -2200, 1, null, 5],
            ['demo_29', 'GOLDEN_APPLE', 'Golden Apple', 'Notch', 150.00, 1, 'SELLING', 'world', 2300, 70, 2300, 0, null, 4],
            ['demo_30', 'ENDER_PEARL', 'Ender Pearl', '附魔师', 25.00, 16, 'SELLING', 'world', -2400, 50, -2400, 1, null, 3],
            ['demo_31', 'BLAZE_ROD', 'Blaze Rod', 'MineLord', 40.00, 1, 'SELLING', 'world_nether', 2500, 30, 2500, 1, null, 3],
            ['demo_32', 'GHAST_TEAR', 'Ghast Tear', 'Alex', 60.00, 1, 'SELLING', 'world_nether', -2600, 35, -2600, 1, null, 2],
            ['demo_33', 'MAGMA_CREAM', 'Magma Cream', 'Steve', 35.00, 1, 'SELLING', 'world_nether', 2700, 40, 2700, 1, null, 2],
            ['demo_34', 'SLIME_BALL', 'Slime Ball', '方块王', 20.00, 16, 'SELLING', 'world', -2800, 60, 2800, 1, null, 2],
            ['demo_35', 'FEATHER', 'Feather', '红石工坊', 5.00, 16, 'SELLING', 'world', 2900, 65, -2900, 1, null, 1],
            ['demo_36', 'LEATHER', 'Leather', '钻石女王', 8.00, 16, 'SELLING', 'world', -3000, 70, -3000, 1, null, 1],
            ['demo_37', 'STRING', 'String', 'Notch', 6.00, 16, 'SELLING', 'world', 3100, 68, 3100, 1, null, 1],
            ['demo_38', 'BONE', 'Bone', 'MineLord', 7.00, 16, 'SELLING', 'world', -3200, 64, 3200, 1, null, 1],
            ['demo_39', 'ROTTEN_FLESH', 'Rotten Flesh', 'Alex', 3.00, 16, 'BUYING', 'world', 3300, 66, -3300, 1, null, 1]
          ];

          const sql = 'INSERT INTO shops (shop_id, material, item_name, owner_name, price, stacking_amount, shop_type, world, x, y, z, price_reasonable, nbt, activity_score) VALUES ?';
          connection.query(sql, [demoShops], (err, result) => {
            if (err) throw err;
            console.log('✓ 已插入 ' + result.affectedRows + ' 条演示数据');

            // 创建其他表
            const otherTables = [
              `CREATE TABLE harbor (
                id INT NOT NULL AUTO_INCREMENT,
                world VARCHAR(100) DEFAULT 'world',
                x INT DEFAULT 0,
                y INT DEFAULT 64,
                z INT DEFAULT 0,
                PRIMARY KEY (id)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
              `CREATE TABLE settings (
                setting_key VARCHAR(100) NOT NULL,
                setting_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (setting_key)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
              `CREATE TABLE fetch_log (
                id INT NOT NULL AUTO_INCREMENT,
                fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                shops_count INT DEFAULT 0,
                PRIMARY KEY (id)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
              `CREATE TABLE activity (
                material VARCHAR(100) NOT NULL,
                views INT DEFAULT 0,
                trades INT DEFAULT 0,
                last_visit TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (material)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
            ];

            let tablesDone = 0;
            otherTables.forEach((sql, idx) => {
              connection.query(sql, (err) => {
                if (err) throw err;
                tablesDone++;
                if (tablesDone === otherTables.length) {
                  console.log('✓ 其他辅助表创建成功');
                  console.log('\n========================================');
                  console.log('  ✓ MySQL 数据库完整配置成功！');
                  console.log('  数据库: qshop, 端口: 3306');
                  console.log('  用户: root (空密码)');
                  console.log('========================================');
                  connection.end();
                  process.exit(0);
                }
              });
            });
          });
        });
      });
    });
  });
});
