const mysql = require('mysql2');
const crypto = require('crypto');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'qshop',
  charset: 'utf8mb4'
});

const materials = [
  'DIAMOND', 'IRON_INGOT', 'GOLD_INGOT', 'COAL', 'EMERALD',
  'ANCIENT_DEBRIS', 'COBBLESTONE', 'DIRT', 'GLASS', 'GRAVEL',
  'SAND', 'REDSTONE', 'LAPIS_LAZULI', 'QUARTZ', 'NETHERRACK',
  'OBSIDIAN', 'TNT', 'DIAMOND_SWORD', 'DIAMOND_PICKAXE',
  'IRON_SWORD', 'IRON_PICKAXE', 'GOLD_SWORD', 'GOLD_PICKAXE',
  'STONE_SWORD', 'WOODEN_SWORD', 'BREAD', 'COOKED_BEEF',
  'COOKED_CHICKEN', 'APPLE', 'GOLDEN_APPLE', 'ENDER_PEARL',
  'BLAZE_ROD', 'GHAST_TEAR', 'MAGMA_CREAM', 'SLIME_BALL',
  'FEATHER', 'LEATHER', 'STRING', 'BONE', 'ROTTEN_FLESH',
  'DIAMOND_CHESTPLATE', 'IRON_CHESTPLATE', 'GOLD_INGOT',
  'PAPER', 'BOOK', 'BOOKSHELF', 'FURNACE', 'CHEST',
  'HOPPER', 'DROPPER', 'DISPENSER', 'RAIL', 'ACTIVATOR_RAIL',
  'DETECTOR_RAIL', 'POWERED_RAIL', 'MINECART', 'CHEST_MINECART',
  'FURNACE_MINECART', 'HOPPER_MINECART', 'TNT_MINECART', 'COMMAND_BLOCK',
  'SHULKER_BOX', 'ENDER_CHEST', 'NETHER_STAR', 'DRAGON_EGG',
  'ELYTRA', 'BEACON', 'CONDUIT', 'SPAWNER', 'NAUTILUS_SHELL',
  'PHANTOM_MEMBRANE', 'TRIDENT', 'CROSSBOW', 'FIREWORK_ROCKET',
  'FIRE_CHARGE', 'ARROW', 'TIPPED_ARROW', 'SPECTRAL_ARROW',
  'ENDER_EYE', 'ENDER_PEARL', 'CLOCK', 'COMPASS', 'RECOVERY_COMPASS',
  'MAP', 'FILLED_MAP', 'WRITABLE_BOOK', 'WRITTEN_BOOK',
  'NAME_TAG', 'LEAD', 'HEART_OF_THE_SEA', 'SHULKER_SHELL',
  'RABBIT_HIDE', 'RABBIT_FOOT', 'FERMENTED_SPIDER_EYE',
  'SPIDER_EYE', 'ENDERMAN_SPAWN_EGG', 'EXPERIENCE_BOTTLE',
  'ENCHANTED_BOOK', 'ENCHANTED_GOLDEN_APPLE', 'CHAIN', 'GUNPOWDER',
  'INK_SAC', 'GLOW_INK_SAC', 'IRON_NUGGET', 'GOLD_NUGGET'
];

const owners = [
  'Alex', 'Steve', 'MineLord', '方块王', '钻石女王',
  '附魔师', 'Notch', '红石工坊', 'CraftMaster', 'BuilderPro',
  'MinerJoe', 'Blacksmith_王', 'Trader01', 'MagicMaker',
  'ToolSmith', '武器商人', '药剂师', '工程师', 'DragonHunter',
  'Enderman_Fan', 'NetherKing', 'FarmerJohn', 'MobHunter',
  'Architect99', 'Builder_2023', '工匠大师', 'PVP_Pro',
  '冒险家', '矿工小张', 'Redstone_wizard', 'SwordMaster',
  'Chef_Minecrafter', '农民小李', 'FisherBob', 'Lumberjack王',
  'CaveExplorer', 'NetherWalker', 'EnderHunter', 'AncientBuilder'
];

const worlds = ['world', 'world_nether', 'world_the_end'];
const shopTypes = ['SELLING', 'BUYING'];
const stacking = [1, 8, 16, 32, 64];
const nbtExamples = [null, null, null, null, null, null, null,
  '{"display":{"Name":"附魔物品"},"Enchantments":[{"id":"minecraft:sharpness","lvl":5}]}',
  '{"display":{"Name":"效率工具"},"Enchantments":[{"id":"minecraft:efficiency","lvl":4}]}',
  '{"display":{"Name":"耐久装备"},"Enchantments":[{"id":"minecraft:unbreaking","lvl":3}]}'
];

const TOTAL = 10000;
const BATCH_SIZE = 1000;

console.log('正在生成 ' + TOTAL + ' 条测试数据...');

function genShop(i) {
  const mat = materials[Math.floor(Math.random() * materials.length)];
  const owner = owners[Math.floor(Math.random() * owners.length)];
  const type = shopTypes[Math.floor(Math.random() * shopTypes.length)];
  const world = worlds[Math.floor(Math.random() * worlds.length)];
  const stack = stacking[Math.floor(Math.random() * stacking.length)];
  const price = Math.round((Math.random() * 498 + 2) * 100) / 100;
  const activity = Math.floor(Math.random() * 200);
  const x = Math.floor((Math.random() - 0.5) * 10000);
  const y = Math.floor(Math.random() * 250) + 10;
  const z = Math.floor((Math.random() - 0.5) * 10000);
  const reasonable = Math.random() > 0.1 ? 1 : 0;
  const nbt = nbtExamples[Math.floor(Math.random() * nbtExamples.length)];

  return [
    'shop_' + i,
    mat,
    mat.replace(/_/g, ' ').toLowerCase(),
    owner,
    price,
    stack,
    type,
    world,
    x, y, z,
    reasonable,
    nbt,
    activity
  ];
}

// 清空现有数据
console.log('清空现有数据...');
connection.query('DELETE FROM shops', (err) => {
  if (err) { console.error('清空失败:', err); process.exit(1); }

  // 分批插入
  let inserted = 0;
  function insertBatch() {
    const end = Math.min(inserted + BATCH_SIZE, TOTAL);
    const rows = [];
    for (let i = inserted; i < end; i++) {
      rows.push(genShop(i));
    }

    const sql = 'INSERT INTO shops (shop_id, material, item_name, owner_name, price, stacking_amount, shop_type, world, x, y, z, price_reasonable, nbt, activity_score) VALUES ?';
    connection.query(sql, [rows], (err, result) => {
      if (err) { console.error('插入失败:', err.message); process.exit(1); }
      inserted = end;
      const percent = Math.floor((inserted / TOTAL) * 100);
      process.stdout.write('\r进度: ' + percent + '% (' + inserted + '/' + TOTAL + ')');

      if (inserted < TOTAL) {
        insertBatch();
      } else {
        process.stdout.write('\n');
        console.log('✅ 数据插入完成！');

        // 统计
        connection.query('SELECT COUNT(*) as total, COUNT(DISTINCT material) as mats, COUNT(DISTINCT owner_name) as owners FROM shops', (err, rows) => {
          if (err) { console.error(err); process.exit(1); }
          console.log('\n========= 数据统计 =========');
          console.log('  商店总数: ' + rows[0].total);
          console.log('  物品种类: ' + rows[0].mats);
          console.log('  店主数量: ' + rows[0].owners);
          console.log('=============================\n');
          connection.end();
        });
      }
    });
  }

  insertBatch();
});
