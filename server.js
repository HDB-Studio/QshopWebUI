
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');

let bcrypt = null;
try { bcrypt = require('bcryptjs'); } catch (e) {  }

// 配置

const os = require('os');
const totalCores = Math.max(1, os.cpus().length || 4);

function clampNumber(v, min, max, def) {
  const n = parseFloat(v);
  if (isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

const CONFIG = {
  PORT: parseInt(process.env.PORT || process.env.SERVER_PORT || '3000'),
  HOST: process.env.SERVER_HOST || '0.0.0.0',
  PUBLIC_URL: process.env.PUBLIC_URL || '',

  // --- 数据库位置 / 连接 ---
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432'),
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'qshop',
  DB_POOL_MIN: parseInt(process.env.DB_POOL_MIN || '5'),
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX || '20'),

  // --- 日志位置 ---
  LOG_DIR: process.env.LOG_DIR || path.join(__dirname, 'logs'),

  // --- 资源限制 ---
  DATABASE_MEMORY_LIMIT_GB: clampNumber(process.env.DATABASE_MEMORY_LIMIT, 0.5, 256, 1),
  CPU_CORE_LIMIT: clampNumber(process.env.CPU_CORE_LIMIT, 1, totalCores, Math.max(1, Math.floor(totalCores * 0.8))),
  SYSTEM_TOTAL_CORES: totalCores,

  // --- 认证 / 管理员 ---
  API_TOKEN: process.env.API_TOKEN || '',
  REQUIRE_AUTH: process.env.REQUIRE_AUTH !== 'false',
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
  SESSION_TIMEOUT: parseInt(process.env.SESSION_TIMEOUT || '3600'),

  MAX_BATCH_SIZE: parseInt(process.env.MAX_BATCH_SIZE || '5000000'),
  MAX_PAGE_SIZE: parseInt(process.env.MAX_PAGE_SIZE || '200'),
  DEFAULT_PAGE_SIZE: parseInt(process.env.DEFAULT_PAGE_SIZE || '60'),

  // === 性能关键: 缓存 TTL (毫秒) ===
  CACHE_TTL_TOP: 15 * 1000,
  CACHE_TTL_STATS: 30 * 1000,
  CACHE_TTL_MATERIALS: 2 * 60 * 1000,
  CACHE_TTL_SEARCH: 3 * 1000,
  CACHE_TTL_OWNERS: 60 * 1000,
  CACHE_TTL_WORLDS: 60 * 1000,
  CACHE_TTL_CONFIG: 5 * 60 * 1000,
  CACHE_TTL_HEALTH: 5 * 1000,

  ACTIVITY_FLUSH_INTERVAL: 10 * 1000,
  SEARCH_DEDUP_WINDOW: 500,
  REQUEST_BODY_LIMIT: process.env.REQUEST_BODY_LIMIT || '10mb',

  // === QSFilterPlugin — Minecraft 服务器连接 ===
  QSFILTER_ENABLED: process.env.QSFILTER_ENABLED !== 'false',
  QSFILTER_URL: process.env.QSFILTER_URL || 'http://127.0.0.1:8765',
  QSFILTER_TIMEOUT: parseInt(process.env.QSFILTER_TIMEOUT || '5000'),
  QSFILTER_SYNC_INTERVAL: parseInt(process.env.QSFILTER_SYNC_INTERVAL || '60'),
  QSFILTER_MAX_RETRIES: parseInt(process.env.QSFILTER_MAX_RETRIES || '3'),
  QSFILTER_RETRY_DELAY: parseInt(process.env.QSFILTER_RETRY_DELAY || '1000'),

  // === 定时任务 / 同步 ===
  SYNC_SCHEDULE_TIMES: (process.env.SYNC_SCHEDULE_TIMES || '00:00').split(',').map(s => s.trim()).filter(Boolean),
  SYNC_MAX_RETRIES: parseInt(process.env.SYNC_MAX_RETRIES || '3'),
  SYNC_RETRY_INTERVAL: parseInt(process.env.SYNC_RETRY_INTERVAL || '60'),
  INCREMENTAL_SYNC_ENABLED: process.env.INCREMENTAL_SYNC_ENABLED !== 'false',
  WEBHOOK_MAX_LATENCY: parseInt(process.env.WEBHOOK_MAX_LATENCY || '180'),

  // === 定时分配（自动触发分配操作，间隔 N 分钟） ===
  ALLOCATE_ENABLED: process.env.ALLOCATE_ENABLED !== 'false' && process.env.ALLOCATE_ENABLED !== undefined,
  ALLOCATE_INTERVAL_MINUTES: parseInt(process.env.ALLOCATE_INTERVAL_MINUTES || '0'), // 0 表示禁用

  // === 玩家商店限制（系统商店不受以下限制） ===
  PLAYER_SHOP_MAX_BUY: parseInt(process.env.PLAYER_SHOP_MAX_BUY || '1000'),
  PLAYER_SHOP_MAX_STOCK: parseInt(process.env.PLAYER_SHOP_MAX_STOCK || '2000'),
  PLAYER_SHOP_LOW_STOCK_THRESHOLD: parseInt(process.env.PLAYER_SHOP_LOW_STOCK_THRESHOLD || '10'),

  // === 备份与恢复 ===
  BACKUP_ENABLED: process.env.BACKUP_ENABLED !== 'false',
  BACKUP_SCHEDULE: process.env.BACKUP_SCHEDULE || 'daily',
  BACKUP_TIME: process.env.BACKUP_TIME || '02:00',
  // 分钟级备份间隔（1-60，0 表示不使用分钟级，仅依赖 BACKUP_TIME）
  BACKUP_INTERVAL_MINUTES: (() => {
    const n = parseInt(process.env.BACKUP_INTERVAL_MINUTES || '0');
    if (!Number.isFinite(n)) return 0;
    return Math.min(60, Math.max(0, n));
  })(),
  BACKUP_DIR: process.env.BACKUP_DIR || path.join(__dirname, 'backups'),
  // 备份文件命名模板：支持 {type} {date} {time} {ts} {random}
  BACKUP_FILE_TEMPLATE: process.env.BACKUP_FILE_TEMPLATE || 'qshop-{type}-{date}-{time}-{random}.json',
  BACKUP_CLEANUP_ENABLED: process.env.BACKUP_CLEANUP_ENABLED !== 'false',
  BACKUP_RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
  BACKUP_MIN_KEEP: parseInt(process.env.BACKUP_MIN_KEEP || '10'),
  // 备份完成通知（系统内消息）
  BACKUP_NOTIFY_ENABLED: process.env.BACKUP_NOTIFY_ENABLED !== 'false',

  // === 统计与监控 ===
  STATS_ENABLED: process.env.STATS_ENABLED !== 'false',
  STATS_CACHE_TTL: parseInt(process.env.STATS_CACHE_TTL || '10'),
  ALERT_ENABLED: process.env.ALERT_ENABLED !== 'false'
};

// === 中文名称翻译表 (Minecraft material → 中文) ===
// 用于在物品列表和详情页中显示更友好的中文名称
const MATERIAL_ZH_CN = {
  // 方块
  STONE: '石头', GRANITE: '花岗岩', POLISHED_GRANITE: '磨制花岗岩',
  DIORITE: '闪长岩', POLISHED_DIORITE: '磨制闪长岩',
  ANDESITE: '安山岩', POLISHED_ANDESITE: '磨制安山岩',
  GRASS_BLOCK: '草方块', DIRT: '泥土', COARSE_DIRT: '砂土', PODZOL: '灰化土',
  COBBLESTONE: '圆石', OAK_PLANKS: '橡木木板', SPRUCE_PLANKS: '云杉木板',
  BIRCH_PLANKS: '白桦木板', JUNGLE_PLANKS: '丛林木木板',
  ACACIA_PLANKS: '金合欢木板', DARK_OAK_PLANKS: '深色橡木木板',
  OAK_SAPLING: '橡木树苗', SPRUCE_SAPLING: '云杉树苗',
  BIRCH_SAPLING: '白桦树苗', JUNGLE_SAPLING: '丛林木树苗',
  ACACIA_SAPLING: '金合欢树苗', DARK_OAK_SAPLING: '深色橡木树苗',
  BEDROCK: '基岩', SAND: '沙子', RED_SAND: '红沙', GRAVEL: '砂砾',
  GOLD_ORE: '金矿石', IRON_ORE: '铁矿石', COAL_ORE: '煤矿石',
  NETHER_GOLD_ORE: '下界金矿石', DIAMOND_ORE: '钻石矿石',
  DEEPSLATE_DIAMOND_ORE: '深板岩钻石矿石', REDSTONE_ORE: '红石矿石',
  DEEPSLATE_REDSTONE_ORE: '深板岩红石矿石', EMERALD_ORE: '绿宝石矿石',
  COPPER_ORE: '铜矿石', LAPIS_ORE: '青金石矿石', IRON_BLOCK: '铁块',
  GOLD_BLOCK: '金块', DIAMOND_BLOCK: '钻石块', NETHERITE_BLOCK: '下界合金块',
  EMERALD_BLOCK: '绿宝石块', REDSTONE_BLOCK: '红石块',
  LAPIS_BLOCK: '青金石块', COAL_BLOCK: '煤块', COPPER_BLOCK: '铜块',
  RAW_IRON_BLOCK: '粗铁块', RAW_GOLD_BLOCK: '粗金块', RAW_COPPER_BLOCK: '粗铜块',
  OBSIDIAN: '黑曜石', CRYING_OBSIDIAN: '哭泣的黑曜石',
  GLASS: '玻璃', GLASS_PANE: '玻璃板', TNT: 'TNT', SPONGE: '海绵',
  WET_SPONGE: '湿海绵', WHITE_CONCRETE: '白色混凝土',
  ORANGE_CONCRETE: '橙色混凝土', MAGENTA_CONCRETE: '品红色混凝土',
  LIGHT_BLUE_CONCRETE: '淡蓝色混凝土', YELLOW_CONCRETE: '黄色混凝土',
  LIME_CONCRETE: '黄绿色混凝土', PINK_CONCRETE: '粉红色混凝土',
  GRAY_CONCRETE: '灰色混凝土', LIGHT_GRAY_CONCRETE: '浅灰色混凝土',
  CYAN_CONCRETE: '青色混凝土', PURPLE_CONCRETE: '紫色混凝土',
  BLUE_CONCRETE: '蓝色混凝土', BROWN_CONCRETE: '棕色混凝土',
  GREEN_CONCRETE: '绿色混凝土', RED_CONCRETE: '红色混凝土',
  BLACK_CONCRETE: '黑色混凝土',
  // 原木/木头
  OAK_LOG: '橡木原木', SPRUCE_LOG: '云杉原木', BIRCH_LOG: '白桦原木',
  JUNGLE_LOG: '丛林木原木', ACACIA_LOG: '金合欢原木',
  DARK_OAK_LOG: '深色橡木原木', MANGROVE_LOG: '红树原木',
  CHERRY_LOG: '樱花原木', BAMBOO_BLOCK: '竹块',
  OAK_WOOD: '橡木', SPRUCE_WOOD: '云杉木', BIRCH_WOOD: '白桦木',
  STRIPPED_OAK_LOG: '去皮橡木原木', STRIPPED_SPRUCE_LOG: '去皮云杉原木',
  STRIPPED_BIRCH_LOG: '去皮白桦原木', STRIPPED_JUNGLE_LOG: '去皮丛林木原木',
  // 树叶/植物
  OAK_LEAVES: '橡树叶', SPRUCE_LEAVES: '云杉树叶', BIRCH_LEAVES: '白桦树叶',
  JUNGLE_LEAVES: '丛林木树叶', ACACIA_LEAVES: '金合欢树叶',
  DARK_OAK_LEAVES: '深色橡木树叶',
  // 矿石 & 资源
  COAL: '煤炭', IRON_INGOT: '铁锭', GOLD_INGOT: '金锭', COPPER_INGOT: '铜锭',
  RAW_IRON: '粗铁', RAW_GOLD: '粗金', RAW_COPPER: '粗铜',
  DIAMOND: '钻石', NETHERITE_INGOT: '下界合金锭', EMERALD: '绿宝石',
  REDSTONE: '红石', LAPIS_LAZULI: '青金石', QUARTZ: '下界石英',
  AMETHYST_SHARD: '紫水晶碎片', GLOWSTONE_DUST: '萤石粉', ECHO_SHARD: '回响碎片',
  // 食物
  APPLE: '苹果', GOLDEN_APPLE: '金苹果', ENCHANTED_GOLDEN_APPLE: '附魔金苹果',
  BREAD: '面包', BEEF: '生牛肉', COOKED_BEEF: '熟牛肉', PORKCHOP: '生猪排',
  COOKED_PORKCHOP: '熟猪排', CHICKEN: '生鸡肉', COOKED_CHICKEN: '熟鸡肉',
  MUTTON: '生羊肉', COOKED_MUTTON: '熟羊肉', COD: '生鳕鱼', COOKED_COD: '熟鳕鱼',
  SALMON: '生鲑鱼', COOKED_SALMON: '熟鲑鱼', POTATO: '马铃薯',
  BAKED_POTATO: '烤马铃薯', CARROT: '胡萝卜', GOLDEN_CARROT: '金胡萝卜',
  BEETROOT: '甜菜根', SWEET_BERRIES: '甜浆果', GLOW_BERRIES: '发光浆果',
  CHORUS_FRUIT: '紫颂果', POPPED_CHORUS_FRUIT: '爆裂紫颂果',
  HONEY_BOTTLE: '蜂蜜瓶', HONEYCOMB: '蜜脾', MILK_BUCKET: '牛奶桶',
  PUMPKIN: '南瓜', CARVED_PUMPKIN: '雕刻过的南瓜', MELON: '西瓜', MELON_SLICE: '西瓜片',
  COOKIE: '曲奇', CAKE: '蛋糕', PUMPKIN_PIE: '南瓜派', RABBIT_STEW: '兔肉煲',
  BEETROOT_SOUP: '甜菜汤', MUSHROOM_STEW: '蘑菇煲',
  SUSPICIOUS_STEW: '迷之炖菜', RABBIT_HIDE: '兔子皮', RABBIT_FOOT: '兔子脚',
  // 工具 & 武器
  WOODEN_SWORD: '木剑', STONE_SWORD: '石剑', IRON_SWORD: '铁剑',
  GOLDEN_SWORD: '金剑', DIAMOND_SWORD: '钻石剑', NETHERITE_SWORD: '下界合金剑',
  WOODEN_PICKAXE: '木镐', STONE_PICKAXE: '石镐', IRON_PICKAXE: '铁镐',
  GOLDEN_PICKAXE: '金镐', DIAMOND_PICKAXE: '钻石镐', NETHERITE_PICKAXE: '下界合金镐',
  WOODEN_AXE: '木斧', STONE_AXE: '石斧', IRON_AXE: '铁斧', GOLDEN_AXE: '金斧',
  DIAMOND_AXE: '钻石斧', NETHERITE_AXE: '下界合金斧',
  WOODEN_SHOVEL: '木锹', STONE_SHOVEL: '石锹', IRON_SHOVEL: '铁锹',
  GOLDEN_SHOVEL: '金锹', DIAMOND_SHOVEL: '钻石锹', NETHERITE_SHOVEL: '下界合金锹',
  WOODEN_HOE: '木锄', STONE_HOE: '石锄', IRON_HOE: '铁锄', GOLDEN_HOE: '金锄',
  DIAMOND_HOE: '钻石锄', NETHERITE_HOE: '下界合金锄',
  BOW: '弓', CROSSBOW: '弩', TRIDENT: '三叉戟', SHIELD: '盾牌',
  ARROW: '箭', SPECTRAL_ARROW: '光灵箭', TIPPED_ARROW: '药箭',
  FIREWORK_ROCKET: '烟花火箭', FIREWORK_STAR: '烟火之星',
  // 盔甲
  LEATHER_HELMET: '皮革帽子', LEATHER_CHESTPLATE: '皮革外套',
  LEATHER_LEGGINGS: '皮革裤子', LEATHER_BOOTS: '皮革靴子',
  CHAINMAIL_HELMET: '锁链头盔', CHAINMAIL_CHESTPLATE: '锁链胸甲',
  CHAINMAIL_LEGGINGS: '锁链护腿', CHAINMAIL_BOOTS: '锁链靴子',
  IRON_HELMET: '铁头盔', IRON_CHESTPLATE: '铁胸甲',
  IRON_LEGGINGS: '铁护腿', IRON_BOOTS: '铁靴子',
  GOLDEN_HELMET: '金头盔', GOLDEN_CHESTPLATE: '金胸甲',
  GOLDEN_LEGGINGS: '金护腿', GOLDEN_BOOTS: '金靴子',
  DIAMOND_HELMET: '钻石头盔', DIAMOND_CHESTPLATE: '钻石胸甲',
  DIAMOND_LEGGINGS: '钻石护腿', DIAMOND_BOOTS: '钻石靴子',
  NETHERITE_HELMET: '下界合金头盔', NETHERITE_CHESTPLATE: '下界合金胸甲',
  NETHERITE_LEGGINGS: '下界合金护腿', NETHERITE_BOOTS: '下界合金靴子',
  ELYTRA: '鞘翅', TURTLE_HELMET: '海龟壳',
  // 物品
  EGG: '鸡蛋', STRING: '线', FEATHER: '羽毛', GUNPOWDER: '火药',
  BONE: '骨头', BONE_MEAL: '骨粉', SUGAR: '糖', PAPER: '纸',
  BOOK: '书', WRITABLE_BOOK: '书与笔', WRITTEN_BOOK: '成书',
  COMPASS: '指南针', RECOVERY_COMPASS: '追溯指南针', CLOCK: '钟',
  MAP: '地图', FILLED_MAP: '已填充地图', LEATHER: '皮革',
  ROTTEN_FLESH: '腐肉', SPIDER_EYE: '蜘蛛眼', FERMENTED_SPIDER_EYE: '发酵蛛眼',
  BLAZE_ROD: '烈焰棒', BLAZE_POWDER: '烈焰粉',
  ENDER_PEARL: '末影珍珠', ENDER_EYE: '末影之眼',
  GHAST_TEAR: '恶魂之泪', MAGMA_CREAM: '岩浆膏', SLIME_BALL: '粘液球',
  PHANTOM_MEMBRANE: '幻翼膜', SCUTE: '鳞甲',
  PRISMARINE_SHARD: '海晶碎片', PRISMARINE_CRYSTALS: '海晶砂',
  RABBIT: '生兔肉', COOKED_RABBIT: '熟兔肉',
  HONEYCOMB: '蜜脾', DRAGON_EGG: '龙蛋', DRAGON_BREATH: '龙息',
  // 矿物块
  GOLD_INGOT: '金锭', IRON_INGOT: '铁锭',
  // 下界与末地
  NETHERRACK: '下界岩', SOUL_SAND: '灵魂沙', SOUL_SOIL: '灵魂土',
  NETHER_QUARTZ_ORE: '下界石英矿石', QUARTZ_BLOCK: '石英块',
  GLOWSTONE: '萤石', CRYING_OBSIDIAN: '哭泣的黑曜石',
  ANCIENT_DEBRIS: '远古残骸', MAGMA_BLOCK: '岩浆块',
  BASALT: '玄武岩', POLISHED_BASALT: '磨制玄武岩', BLACKSTONE: '黑石',
  POLISHED_BLACKSTONE: '磨制黑石', CRIMSON_NYLIUM: '诡异菌岩',
  WARPED_NYLIUM: '绯红菌岩', CRIMSON_STEM: '绯红菌柄',
  WARPED_STEM: '诡异菌柄', CRIMSON_PLANKS: '绯红木木板',
  WARPED_PLANKS: '诡异木木板', SHROOMLIGHT: '菌光体',
  END_STONE: '末地石', END_STONE_BRICKS: '末地石砖', PURPUR_BLOCK: '紫珀块',
  PURPUR_PILLAR: '紫珀柱',
  // 其他常用
  TORCH: '火把', SOUL_TORCH: '灵魂火把', LANTERN: '灯笼',
  SOUL_LANTERN: '灵魂灯笼', JACK_O_LANTERN: '南瓜灯',
  CHEST: '箱子', TRAPPED_CHEST: '陷阱箱', BARREL: '木桶',
  SHULKER_BOX: '潜影盒', FURNACE: '熔炉', BLAST_FURNACE: '高炉',
  SMOKER: '烟熏炉', CRAFTING_TABLE: '工作台', CARTOGRAPHY_TABLE: '制图台',
  FLETCHING_TABLE: '制箭台', SMITHING_TABLE: '锻造台',
  GRINDSTONE: '砂轮', STONECUTTER: '切石机',
  BREWING_STAND: '酿造台', CAULDRON: '炼药锅', ENCHANTING_TABLE: '附魔台',
  ANVIL: '铁砧', CHIPPED_ANVIL: '轻微损坏的铁砧', DAMAGED_ANVIL: '严重损坏的铁砧',
  ENDER_CHEST: '末影箱', DISPENSER: '发射器', DROPPER: '投掷器',
  HOPPER: '漏斗', COMPARATOR: '红石比较器', REPEATER: '红石中继器',
  LEVER: '拉杆', STONE_BUTTON: '石质按钮', OAK_BUTTON: '橡木按钮',
  TRIPWIRE_HOOK: '绊线钩', PISTON: '活塞', STICKY_PISTON: '粘性活塞',
  SLIME_BLOCK: '粘液块', HONEY_BLOCK: '蜂蜜块', WHITE_WOOL: '白色羊毛',
  // 药水
  POTION: '药水', SPLASH_POTION: '喷溅药水', LINGERING_POTION: '滞留药水',
  // 桶
  BUCKET: '桶', WATER_BUCKET: '水桶', LAVA_BUCKET: '岩浆桶',
  POWDER_SNOW_BUCKET: '细雪桶', AXOLOTL_BUCKET: '美西螈桶',
  TROPICAL_FISH_BUCKET: '热带鱼桶', PUFFERFISH_BUCKET: '河豚桶',
  COD_BUCKET: '鳕鱼桶', SALMON_BUCKET: '鲑鱼桶',
  // 旗帜
  WHITE_BANNER: '白色旗帜', ORANGE_BANNER: '橙色旗帜',
  MAGENTA_BANNER: '品红色旗帜', LIGHT_BLUE_BANNER: '淡蓝色旗帜',
  YELLOW_BANNER: '黄色旗帜', LIME_BANNER: '黄绿色旗帜',
  PINK_BANNER: '粉红色旗帜', GRAY_BANNER: '灰色旗帜',
  LIGHT_GRAY_BANNER: '浅灰色旗帜', CYAN_BANNER: '青色旗帜',
  PURPLE_BANNER: '紫色旗帜', BLUE_BANNER: '蓝色旗帜',
  BROWN_BANNER: '棕色旗帜', GREEN_BANNER: '绿色旗帜',
  RED_BANNER: '红色旗帜', BLACK_BANNER: '黑色旗帜',
  // 附魔书 / 书
  ENCHANTED_BOOK: '附魔书', BOOKSHELF: '书架',
  // 染料
  WHITE_DYE: '白色染料', ORANGE_DYE: '橙色染料', MAGENTA_DYE: '品红色染料',
  LIGHT_BLUE_DYE: '淡蓝色染料', YELLOW_DYE: '黄色染料',
  LIME_DYE: '黄绿色染料', PINK_DYE: '粉红色染料',
  GRAY_DYE: '灰色染料', LIGHT_GRAY_DYE: '浅灰色染料',
  CYAN_DYE: '青色染料', PURPLE_DYE: '紫色染料', BLUE_DYE: '蓝色染料',
  BROWN_DYE: '棕色染料', GREEN_DYE: '绿色染料',
  RED_DYE: '红色染料', BLACK_DYE: '黑色染料',
  // 种子
  WHEAT_SEEDS: '小麦种子', BEETROOT_SEEDS: '甜菜种子',
  MELON_SEEDS: '西瓜种子', PUMPKIN_SEEDS: '南瓜种子',
  // 经验瓶 / 命名牌
  EXPERIENCE_BOTTLE: '附魔瓶', NAME_TAG: '命名牌',
  // 其他
  TOTEM_OF_UNDYING: '不死图腾', HEART_OF_THE_SEA: '海洋之心',
  NAUTILUS_SHELL: '鹦鹉螺壳', FIRE_CHARGE: '火焰弹',
  END_CRYSTAL: '末影水晶', FERMENTED_SPIDER_EYE: '发酵蛛眼',
  MUSIC_DISC_13: '唱片 - 13', MUSIC_DISC_CAT: '唱片 - cat',
  MUSIC_DISC_BLOCKS: '唱片 - blocks', MUSIC_DISC_CHIRP: '唱片 - chirp',
  MUSIC_DISC_FAR: '唱片 - far', MUSIC_DISC_MALL: '唱片 - mall',
  MUSIC_DISC_MELLOHI: '唱片 - mellohi', MUSIC_DISC_STAL: '唱片 - stal',
  MUSIC_DISC_STRAD: '唱片 - strad', MUSIC_DISC_WARD: '唱片 - ward',
  MUSIC_DISC_11: '唱片 - 11', MUSIC_DISC_WAIT: '唱片 - wait',
  MUSIC_DISC_OTHERSIDE: '唱片 - otherside', MUSIC_DISC_5: '唱片 - 5',
  MUSIC_DISC_PIGSTEP: '唱片 - pigstep', MUSIC_DISC_RELIC: '唱片 - relic'
};
// 中文名称获取函数：优先查找翻译表，其次 material 格式化
function getMaterialCnName(material) {
  if (!material) return '未知物品';
  const key = String(material).toUpperCase();
  if (MATERIAL_ZH_CN[key]) return MATERIAL_ZH_CN[key];
  // 备用：将 SNAKE_CASE 转换为可读形式
  const readable = key.toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  return readable;
}

// 统一日志工具（logger.info / warn / error + 时间戳 + 颜色）
//   - 所有请求 / 响应 / Webhook 事件均通过此工具打印
//   - 控制台同时输出，可选文件日志 (LOG_DIR)

const LOG_TO_CONSOLE = process.env.LOG_TO_CONSOLE !== 'false';
const LOG_LEVEL = (process.env.LOG_LEVEL || 'INFO').toUpperCase(); // INFO / WARN / ERROR / SILENT
const LOG_COLOR = process.env.LOG_COLOR !== 'false';
const LOG_LEVELS = { SILENT: 0, ERROR: 1, WARN: 2, INFO: 3 };
const COLORS = {
  reset: '\x1b[0m', dim: '\x1b[2m',
  cyan: '\x1b[36m', green: '\x1b[32m',
  yellow: '\x1b[33m', red: '\x1b[31m',
  magenta: '\x1b[35m', white: '\x1b[37m'
};
function ts() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
const logger = {
  info(msg, ...extra) {
    if (LOG_LEVELS[LOG_LEVEL] < LOG_LEVELS.INFO) return;
    if (!LOG_TO_CONSOLE) return;
    const line = `${COLORS.dim}[${ts()}]${COLORS.reset} ${COLORS.cyan}[INFO]${COLORS.reset} ${COLORS.white}${msg}${COLORS.reset}`;
    extra.length ? console.log(line, ...extra) : console.log(line);
  },
  warn(msg, ...extra) {
    if (LOG_LEVELS[LOG_LEVEL] < LOG_LEVELS.WARN) return;
    if (!LOG_TO_CONSOLE) return;
    const line = `${COLORS.dim}[${ts()}]${COLORS.reset} ${COLORS.yellow}[WARN]${COLORS.reset} ${COLORS.white}${msg}${COLORS.reset}`;
    extra.length ? console.warn(line, ...extra) : console.warn(line);
  },
  error(msg, ...extra) {
    if (LOG_LEVELS[LOG_LEVEL] < LOG_LEVELS.ERROR) return;
    if (!LOG_TO_CONSOLE) return;
    const line = `${COLORS.dim}[${ts()}]${COLORS.reset} ${COLORS.red}[ERROR]${COLORS.reset} ${COLORS.white}${msg}${COLORS.reset}`;
    extra.length ? console.error(line, ...extra) : console.error(line);
  },
  req(req, statusCode, ms) {
    if (LOG_LEVELS[LOG_LEVEL] < LOG_LEVELS.INFO) return;
    if (!LOG_TO_CONSOLE) return;
    const methodColor = req.method === 'GET' ? COLORS.green : (req.method === 'POST' ? COLORS.magenta : COLORS.cyan);
    const statusColor = statusCode >= 500 ? COLORS.red : (statusCode >= 400 ? COLORS.yellow : COLORS.green);
    const addr = (req.headers && req.headers['x-forwarded-for']) ||
                 (req.connection && req.connection.remoteAddress) ||
                 (req.ip) || 'unknown';
    console.log(
      `${COLORS.dim}[${ts()}]${COLORS.reset} ${methodColor}${req.method}${COLORS.reset} ` +
      `${COLORS.white}${req.originalUrl || req.url}${COLORS.reset} ` +
      `${statusColor}${statusCode}${COLORS.reset} ` +
      `${COLORS.dim}${ms}ms · ${String(addr).split(',')[0].trim()}${COLORS.reset}`
    );
  }
};

// --- 配置边界二次验证 + 异常处理 ---
const CONFIG_WARNINGS = [];
try {
  if (process.env.DATABASE_MEMORY_LIMIT !== undefined && process.env.DATABASE_MEMORY_LIMIT !== '') {
    const raw = parseFloat(process.env.DATABASE_MEMORY_LIMIT);
    if (!isNaN(raw) && raw < 0.5) {
      CONFIG_WARNINGS.push(`DATABASE_MEMORY_LIMIT=${raw} GB 小于最小值 0.5 GB，已自动调整为 1 GB`);
    }
  }
  if (process.env.CPU_CORE_LIMIT !== undefined && process.env.CPU_CORE_LIMIT !== '') {
    const raw = parseFloat(process.env.CPU_CORE_LIMIT);
    if (!isNaN(raw) && raw < 1) {
      CONFIG_WARNINGS.push(`CPU_CORE_LIMIT=${raw} 小于最小值 1，已自动调整为 ${Math.max(1, Math.floor(totalCores * 0.8))}`);
    }
    if (!isNaN(raw) && raw > totalCores) {
      CONFIG_WARNINGS.push(`CPU_CORE_LIMIT=${raw} 超过系统核心数 ${totalCores}，已自动调整为 ${totalCores}`);
    }
  }
} catch (e) {
  CONFIG_WARNINGS.push('配置解析出现异常: ' + e.message + '（已使用默认值继续）');
}

// --- 日志目录初始化 ---
const fs = require('fs');
try {
  if (!fs.existsSync(CONFIG.LOG_DIR)) fs.mkdirSync(CONFIG.LOG_DIR, { recursive: true });
} catch (e) {
  try {
    const fallback = path.join(__dirname, 'logs');
    if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
    CONFIG.LOG_DIR = fallback;
    CONFIG_WARNINGS.push('LOG_DIR 初始化失败，已回退到默认目录: ' + fallback);
  } catch (e2) {  }
}

function writeAuditLog(event, payload) {
  try {
    const line = JSON.stringify({
      time: new Date().toISOString(),
      event,
      payload: payload || {}
    }) + '\n';
    fs.appendFileSync(path.join(CONFIG.LOG_DIR, 'audit.log'), line);
  } catch (e) {  }
}

// 数据库连接池

const pool = new Pool({
  host: CONFIG.DB_HOST,
  port: CONFIG.DB_PORT,
  user: CONFIG.DB_USER,
  password: CONFIG.DB_PASSWORD,
  database: CONFIG.DB_NAME,
  min: CONFIG.DB_POOL_MIN,
  max: CONFIG.DB_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  application_name: 'qshop-webui'
});

pool.on('error', (err) => { console.error('[POOL-ERR]', err.message); });
pool.on('connect', (client) => {
  client.query("SET search_path = public").catch(() => {});
});

const dbStatus = { connected: false, tablesReady: false, lastError: null };

// QSFilterPlugin — Minecraft 服务器 HTTP 客户端

const http = require('http');
const url = require('url');

// QSFilter 连接状态
const qsfilterStatus = {
  enabled: CONFIG.QSFILTER_ENABLED,
  connected: false,        // 最近一次健康检查是否成功
  qs_available: false,     // Minecraft QuickShop 是否正常连接
  last_success_at: null,   // 上次成功请求时间戳
  last_error: null,        // 上次错误信息
  last_error_at: null,     // 上次错误时间
  latency_ms: 0,           // 上次请求耗时
  total_requests: 0,       // 总请求数
  total_errors: 0,         // 总失败次数
  last_sync_stats: null,   // 最近一次同步的统计数据
  base_url: CONFIG.QSFILTER_URL,
  // === 定时轮询 ===
  polling_interval: CONFIG.QSFILTER_SYNC_INTERVAL * 1000,
  polling_enabled: CONFIG.QSFILTER_ENABLED && CONFIG.QSFILTER_SYNC_INTERVAL > 0,
  polling_last_at: null,
  polling_last_count: 0,
  polling_error_count: 0,
  // === WebHook ===
  webhook_enabled: false,     // 是否收到过 WebHook（表示插件已配置）
  webhook_last_at: null,      // 最近一次 WebHook 时间
  webhook_last_event: null,   // 最近一次事件类型
  webhook_event_count: 0,     // 总事件数
  webhook_error_count: 0,     // 处理失败次数
  webhook_url: null           // 收到的来源地址（用于调试）
};

// 同步任务状态（定时全量同步 + 失败重试）

const syncStatus = {
  history: [],                 // 最近 N 次同步记录（时间倒序）
  maxHistory: 50,
  lastFullSync_at: null,       // 最近一次全量同步时间
  lastFullSync_ok: false,      // 是否成功
  lastFullSync_shops: 0,       // 同步到的商店数
  lastFullSync_durationMs: 0,  // 执行耗时
  retryCount: 0,               // 当前重试次数
  nextScheduledTimes: [],      // 计算出的下一次各定时点（Date 对象）
  nextBackupTime: null         // 下一次备份时间
};

// 同步历史记录
function recordSyncHistory(success, shopCount, durationMs, source, errorMsg) {
  try {
    const entry = {
      time: Date.now(),
      source: source,              // 'scheduled' / 'manual' / 'retry'
      success: !!success,
      shop_count: Number(shopCount) || 0,
      duration_ms: Number(durationMs) || 0,
      error: errorMsg || null
    };
    syncStatus.history.unshift(entry);
    if (syncStatus.history.length > syncStatus.maxHistory) syncStatus.history.length = syncStatus.maxHistory;
    if (success) {
      syncStatus.lastFullSync_at = entry.time;
      syncStatus.lastFullSync_ok = true;
      syncStatus.lastFullSync_shops = entry.shop_count;
      syncStatus.lastFullSync_durationMs = entry.duration_ms;
      syncStatus.retryCount = 0;
    }
    // 写入日志
    writeAuditLog('sync_' + (success ? 'success' : 'error'), entry);
  } catch (e) {  }
}

// 请求统计（按小时 / 按路径 / 按商店类型 / 按世界）

const requestStats = {
  byHour: new Map(),          // 'YYYY-MM-DD HH' -> { count, port_requests, shops_viewed }
  byShopType: new Map(),      // 'SELLING' / 'BUYING' / 'MATERIAL' -> count
  byWorld: new Map(),         // world_name -> count
  byMaterial: new Map(),      // material -> count
  total_today: 0,
  last_reset_date: new Date().toISOString().slice(0, 10),
  recentEvents: [],           // 最近 N 次事件（可视化滚动用）
  maxRecent: 100
};

// 记录请求统计（在每个请求处理中调用）
function recordRequest(path, extra) {
  try {
    if (!CONFIG.STATS_ENABLED) return;
    const now = new Date();
    const hourKey = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH -> 改一下格式
    const hourKeyDisplay = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0');

    // 跨天重置
    const today = now.toISOString().slice(0, 10);
    if (today !== requestStats.last_reset_date) {
      requestStats.byHour.clear();
      requestStats.byShopType.clear();
      requestStats.byWorld.clear();
      requestStats.byMaterial.clear();
      requestStats.total_today = 0;
      requestStats.last_reset_date = today;
    }

    const hour = requestStats.byHour.get(hourKeyDisplay) || { count: 0, port_requests: 0, shops_viewed: 0 };
    hour.count++;
    // 简单的启发式: 如果路径带 port/shop/price 关键字，计入端口请求
    if (path && /\/api\/(shops|price|items|qsfilter)/i.test(path)) hour.port_requests++;
    requestStats.byHour.set(hourKeyDisplay, hour);
    requestStats.total_today++;

    // extra 参数补充
    if (extra && typeof extra === 'object') {
      if (extra.shop_type) {
        requestStats.byShopType.set(extra.shop_type, (requestStats.byShopType.get(extra.shop_type) || 0) + 1);
      }
      if (extra.world) {
        requestStats.byWorld.set(extra.world, (requestStats.byWorld.get(extra.world) || 0) + 1);
      }
      if (extra.material) {
        requestStats.byMaterial.set(extra.material, (requestStats.byMaterial.get(extra.material) || 0) + 1);
      }
    }

    // 滚动事件日志（保留最近 100 条）
    if (path && /\/api\/shops|\/api\/price|\/api\/items|\/webhook\//i.test(path)) {
      requestStats.recentEvents.unshift({
        time: now.getTime(),
        path: path
      });
      if (requestStats.recentEvents.length > requestStats.maxRecent) requestStats.recentEvents.length = requestStats.maxRecent;
    }
  } catch (e) {  }
}

// WebHook 事件去重 / 幂等（避免重复处理同一事件）

const webhookIdempotency = {
  recentEvents: new Map(),    // eventKey -> timestamp
  maxKeys: 1000
};

function isWebHookDuplicate(eventName, body) {
  try {
    if (!body) return false;
    let key = eventName + ':';
    if (body.shop_id !== undefined) key += 'sid=' + body.shop_id;
    if (body.shop && body.shop.shop_id !== undefined) key += ':shop_sid=' + body.shop.shop_id;
    if (body.shop && body.shop.price !== undefined) key += ':price=' + body.shop.price;
    if (body.price !== undefined) key += ':price=' + body.price;
    if (body.shop && body.shop.shop_type) key += ':type=' + body.shop.shop_type;
    const now = Date.now();
    const prev = webhookIdempotency.recentEvents.get(key);
    if (prev && now - prev < 2000) return true; // 2 秒内相同内容视为重复
    webhookIdempotency.recentEvents.set(key, now);
    // 清理老条目
    if (webhookIdempotency.recentEvents.size > webhookIdempotency.maxKeys) {
      const cutoff = now - 10000;
      for (const [k, t] of webhookIdempotency.recentEvents) {
        if (t < cutoff) webhookIdempotency.recentEvents.delete(k);
      }
    }
    return false;
  } catch (e) { return false; }
}

// 备份管理

const backupStatus = {
  history: [],                 // 最近 N 次备份记录
  maxHistory: 100,
  isRunning: false,            // 当前是否正在执行备份
  lastBackup_at: null,
  lastBackup_ok: false,
  lastBackup_file: null,
  nextBackupTime: null
};

// 初始化备份目录
function ensureBackupDir() {
  try {
    if (!fs.existsSync(CONFIG.BACKUP_DIR)) {
      fs.mkdirSync(CONFIG.BACKUP_DIR, { recursive: true });
    }
    // 验证目录可写
    const testFile = path.join(CONFIG.BACKUP_DIR, '.write_test_' + Date.now());
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return { ok: true, path: CONFIG.BACKUP_DIR };
  } catch (e) {
    // 尝试回退到默认位置
    try {
      const fallback = path.join(__dirname, 'backups');
      if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
      return { ok: true, path: fallback, fallback: true, warning: e.message };
    } catch (e2) {
      return { ok: false, error: e.message };
    }
  }
}

// 备份命名规范: 按 CONFIG.BACKUP_FILE_TEMPLATE 模板生成
// 支持占位符: {type} {date} {time} {ts} {random}
// 注意: {ts} = Unix 毫秒时间戳，确保绝对唯一；{random} = 6 位随机字串，避免同一毫秒内冲突
function generateBackupFileName(type) {
  const now = new Date();
  const datePart = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  const timePart = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
  const tsPart = String(Date.now());
  const randPart = Math.random().toString(36).slice(2, 8);
  const typePart = type || 'manual';

  let tpl = String(CONFIG.BACKUP_FILE_TEMPLATE || 'qshop-{type}-{date}-{time}-{random}.json');
  tpl = tpl
    .replace(/\{type\}/g, typePart)
    .replace(/\{date\}/g, datePart)
    .replace(/\{time\}/g, timePart)
    .replace(/\{ts\}/g, tsPart)
    .replace(/\{random\}/g, randPart);

  // 文件名清洗: 移除非法字符（防止路径注入）
  const safe = tpl.replace(/[\\/:*?"<>|]/g, '_');
  // 确保后缀为 .json
  return safe.endsWith('.json') ? safe : safe + '.json';
}

// 执行完整备份（导出所有核心数据）
async function performBackup(type, operator) {
  if (backupStatus.isRunning) return { success: false, error: '已有备份任务正在执行，请稍后重试' };
  backupStatus.isRunning = true;
  const startTs = Date.now();
  try {
    const dirResult = ensureBackupDir();
    if (!dirResult.ok) throw new Error('备份目录不可用: ' + dirResult.error);
    const backupDir = dirResult.path;

    const fileName = generateBackupFileName(type || 'manual');
    const filePath = path.join(backupDir, fileName);

    // 从数据库导出核心表数据
    const data = {
      meta: {
        version: '1.0',
        backup_type: type || 'manual',
        operator: operator || 'system',
        created_at: new Date().toISOString(),
        server_time: Date.now(),
        config: {
          db_name: CONFIG.DB_NAME,
          qsfilter_url: qsfilterStatus.base_url,
          shop_count: shopStore.totalShops
        }
      },
      tables: {
        shops: [],
        activity: [],
        users: [],
        settings: []
      },
      cache: {
        shop_store: Array.from(shopStore.shops.values())
      }
    };

    // 如果数据库连接可用，从数据库拉取
    if (dbStatus.connected) {
      try {
        const r1 = await pool.query('SELECT * FROM shops ORDER BY shop_id');
        data.tables.shops = r1.rows;
      } catch (e) { data.tables.shops = []; }
      try {
        const r2 = await pool.query('SELECT * FROM activity');
        data.tables.activity = r2.rows;
      } catch (e) { data.tables.activity = []; }
      try {
        const r3 = await pool.query("SELECT id, username, role, active, created_at, last_login FROM users");
        data.tables.users = r3.rows;
      } catch (e) { data.tables.users = []; }
      try {
        const r4 = await pool.query('SELECT setting_key, setting_value FROM settings');
        data.tables.settings = r4.rows;
      } catch (e) { data.tables.settings = []; }
    }

    // 写入文件
    const jsonStr = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, jsonStr, 'utf8');
    const fileSize = fs.statSync(filePath).size;

    const durationMs = Date.now() - startTs;
    const entry = {
      time: Date.now(),
      type: type || 'manual',
      file_name: fileName,
      file_path: filePath,
      size_bytes: fileSize,
      size_mb: Number((fileSize / 1024 / 1024).toFixed(2)),
      duration_ms: durationMs,
      shop_count: shopStore.totalShops,
      user_count: data.tables.users.length,
      setting_count: data.tables.settings.length,
      operator: operator || 'system',
      success: true
    };
    backupStatus.history.unshift(entry);
    if (backupStatus.history.length > backupStatus.maxHistory) backupStatus.history.length = backupStatus.maxHistory;
    backupStatus.lastBackup_at = entry.time;
    backupStatus.lastBackup_ok = true;
    backupStatus.lastBackup_file = filePath;

    // 写入审计日志
    writeAuditLog('backup_success', entry);
    return { success: true, file: fileName, path: filePath, size_bytes: fileSize, duration_ms: durationMs, backup_dir: backupDir };
  } catch (e) {
    const entry = {
      time: Date.now(),
      type: type || 'manual',
      success: false,
      error: e.message,
      operator: operator || 'system'
    };
    backupStatus.history.unshift(entry);
    if (backupStatus.history.length > backupStatus.maxHistory) backupStatus.history.length = backupStatus.maxHistory;
    writeAuditLog('backup_error', entry);
    return { success: false, error: e.message };
  } finally {
    backupStatus.isRunning = false;
  }
}

// 读取备份文件列表（从磁盘扫描）
function listBackupFiles() {
  try {
    const dirResult = ensureBackupDir();
    if (!dirResult.ok) return { success: false, error: dirResult.error };
    const backupDir = dirResult.path;
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json') && f.startsWith('qshop-'));
    const result = [];
    for (const f of files) {
      try {
        const filePath = path.join(backupDir, f);
        const stat = fs.statSync(filePath);
        let meta = null;
        // 尝试读取元信息（只解析开头一小段）
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const obj = JSON.parse(content);
          meta = obj.meta || {};
        } catch (e) { /* ignore parse error */ }
        result.push({
          file_name: f,
          file_path: filePath,
          size_bytes: stat.size,
          size_mb: Number((stat.size / 1024 / 1024).toFixed(2)),
          created_at: stat.mtime.getTime(),
          created_at_display: new Date(stat.mtime).toISOString(),
          backup_type: meta ? (meta.backup_type || 'unknown') : 'unknown',
          operator: meta ? (meta.operator || 'system') : 'system',
          shop_count: meta && meta.config ? meta.config.shop_count : null
        });
      } catch (e) { /* skip */ }
    }
    // 倒序，最新的在最前
    result.sort((a, b) => b.created_at - a.created_at);
    return { success: true, files: result, backup_dir: backupDir };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// 执行恢复：读取指定备份文件，清库并重新写入（先不删除原库，只是覆盖写入）
async function performRestore(fileName, operator) {
  try {
    const dirResult = ensureBackupDir();
    if (!dirResult.ok) return { success: false, error: '备份目录不可用: ' + dirResult.error };
    const backupDir = dirResult.path;
    const filePath = path.join(backupDir, fileName);
    if (!fs.existsSync(filePath)) return { success: false, error: '备份文件不存在: ' + fileName };

    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    if (!data || !data.tables) return { success: false, error: '备份文件格式不正确' };

    // 如果数据库连接不可用，只恢复内存缓存（shopStore）
    let dbRestored = false;
    let restoredShops = 0;
    let restoredUsers = 0;
    let restoredSettings = 0;

    if (dbStatus.connected && data.tables.shops && data.tables.shops.length > 0) {
      try {
        // 使用事务原子写入
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          // 清空 shops 表并重新插入
          await client.query('TRUNCATE TABLE shops RESTART IDENTITY');
          const insertBatch = data.tables.shops;
          for (let i = 0; i < insertBatch.length; i++) {
            const s = insertBatch[i];
            try {
              await client.query(
                'INSERT INTO shops (shop_id, material, item_name, owner_uuid, owner_name, world, x, y, z, price, stacking_amount, shop_type, price_reasonable, nbt, quantity, activity_score, fetched_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)',
                [
                  s.shop_id, s.material, s.item_name, s.owner_uuid, s.owner_name,
                  s.world, s.x, s.y, s.z, s.price, s.stacking_amount,
                  s.shop_type, s.price_reasonable !== false, s.nbt || null, s.quantity || 0,
                  s.activity_score || 0, s.fetched_at || new Date().toISOString(),
                  s.updated_at || new Date().toISOString()
                ]
              );
              restoredShops++;
            } catch (e) { /* 单条失败跳过 */ }
          }
          // activity 表
          try { await client.query('TRUNCATE TABLE activity RESTART IDENTITY'); } catch (e) {}
          if (data.tables.activity && data.tables.activity.length > 0) {
            for (let i = 0; i < data.tables.activity.length; i++) {
              const a = data.tables.activity[i];
              try { await client.query('INSERT INTO activity (material, views, last_view) VALUES ($1,$2,$3)', [a.material, a.views || 1, a.last_view || new Date().toISOString()]); } catch (e) {}
            }
          }
          // users 表（保留现有 admin 用户，不覆盖）
          if (data.tables.users && data.tables.users.length > 0) {
            for (let i = 0; i < data.tables.users.length; i++) {
              const u = data.tables.users[i];
              try {
                await client.query(
                  'INSERT INTO users (username, password_hash, role, active, created_at, last_login) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (username) DO NOTHING',
                  [u.username, u.password_hash || '', u.role || 'user', u.active !== false, u.created_at || new Date().toISOString(), u.last_login || null]
                );
                restoredUsers++;
              } catch (e) {}
            }
          }
          // settings 表
          if (data.tables.settings && data.tables.settings.length > 0) {
            for (let i = 0; i < data.tables.settings.length; i++) {
              const s = data.tables.settings[i];
              try {
                await client.query('INSERT INTO settings (setting_key, setting_value) VALUES ($1,$2) ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2', [s.setting_key, s.setting_value]);
                restoredSettings++;
              } catch (e) {}
            }
          }
          await client.query('COMMIT');
          dbRestored = true;
        } catch (txErr) {
          await client.query('ROLLBACK');
          throw txErr;
        } finally {
          client.release();
        }
      } catch (e) {
        dbRestored = false;
        writeAuditLog('restore_db_error', { error: e.message, file: fileName });
      }
    }

    // 恢复内存缓存 shopStore
    if (data.cache && data.cache.shop_store && data.cache.shop_store.length > 0) {
      shopStore.shops.clear();
      shopStore.byMaterial.clear();
      shopStore.byItemId.clear();
      shopStore.byOwner.clear();
      shopStore.byWorld.clear();
      shopStore.byType.clear();
      shopStore.byType.set('SELLING', new Set());
      shopStore.byType.set('BUYING', new Set());
      for (const shop of data.cache.shop_store) {
        if (!shop || shop.shop_id === undefined || shop.shop_id === null) continue;
        const id = Number(shop.shop_id);
        shop.material = shop.material ? String(shop.material).toUpperCase() : 'UNKNOWN';
        shop.item_id = shop.item_id || String(shop.material).toLowerCase();
        shop.item_name = shop.item_name || shop.material;
        shop.owner_name = shop.owner_name || 'unknown';
        shop.shop_type = shop.shop_type || 'SELLING';
        shop.price = Number(shop.price) || 0;
        shop.stacking_amount = shop.stacking_amount !== undefined ? Number(shop.stacking_amount) : 1;
        shop.price_reasonable = shop.price_reasonable !== false;
        shop.world = shop.world || 'world';
        shopStore.shops.set(id, shop);
        if (shop.material) {
          if (!shopStore.byMaterial.has(shop.material)) shopStore.byMaterial.set(shop.material, new Set());
          shopStore.byMaterial.get(shop.material).add(id);
        }
        if (shop.item_id) {
          if (!shopStore.byItemId.has(shop.item_id)) shopStore.byItemId.set(shop.item_id, new Set());
          shopStore.byItemId.get(shop.item_id).add(id);
        }
        if (shop.owner_name) {
          if (!shopStore.byOwner.has(shop.owner_name)) shopStore.byOwner.set(shop.owner_name, new Set());
          shopStore.byOwner.get(shop.owner_name).add(id);
        }
        if (shop.world) {
          if (!shopStore.byWorld.has(shop.world)) shopStore.byWorld.set(shop.world, new Set());
          shopStore.byWorld.get(shop.world).add(id);
        }
        if (shop.shop_type) {
          if (!shopStore.byType.has(shop.shop_type)) shopStore.byType.set(shop.shop_type, new Set());
          shopStore.byType.get(shop.shop_type).add(id);
        }
      }
      shopStore.totalShops = shopStore.shops.size;
      shopStore.sellingCount = shopStore.byType.get('SELLING') ? shopStore.byType.get('SELLING').size : 0;
      shopStore.buyingCount = shopStore.byType.get('BUYING') ? shopStore.byType.get('BUYING').size : 0;
      shopStore.ownersCount = shopStore.byOwner.size;
      shopStore.worldsCount = shopStore.byWorld.size;
      shopStore.materialsCount = shopStore.byMaterial.size;
      shopStore.lastFullSyncAt = Date.now();
      shopStore.lastUpdateAt = Date.now();
      shopStore.lastUpdateSource = 'restore';
    }

    writeAuditLog('restore_success', { file: fileName, operator: operator || 'system', shops_restored: shopStore.totalShops, db_restored: dbRestored });
    return {
      success: true,
      file: fileName,
      db_restored: dbRestored,
      cache_restored: shopStore.totalShops > 0,
      stats: {
        shops_from_db: restoredShops,
        shops_in_cache: shopStore.totalShops,
        users_restored: restoredUsers,
        settings_restored: restoredSettings
      }
    };
  } catch (e) {
    writeAuditLog('restore_error', { error: e.message, file: fileName, operator: operator || 'system' });
    return { success: false, error: e.message };
  }
}

// 删除指定备份文件
function deleteBackupFile(fileName) {
  try {
    const dirResult = ensureBackupDir();
    if (!dirResult.ok) return { success: false, error: dirResult.error };
    const filePath = path.join(dirResult.path, fileName);
    if (!fs.existsSync(filePath)) return { success: false, error: '备份文件不存在' };
    fs.unlinkSync(filePath);
    return { success: true, file: fileName };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// 清理过期备份（保留最近 N 天 + 至少 M 个）
function cleanupOldBackups() {
  try {
    const list = listBackupFiles();
    if (!list.success) return list;
    const now = Date.now();
    const cutoffMs = CONFIG.BACKUP_RETENTION_DAYS * 24 * 3600 * 1000;
    let deleted = 0;
    // 保留最近 BACKUP_MIN_KEEP 个，剩下的超过保留期才删除
    const filesSorted = list.files || [];
    for (let i = 0; i < filesSorted.length; i++) {
      if (i < CONFIG.BACKUP_MIN_KEEP) continue; // 最近 N 个永远保留
      const f = filesSorted[i];
      if ((now - f.created_at) > cutoffMs) {
        try {
          fs.unlinkSync(f.file_path);
          deleted++;
        } catch (e) { /* ignore */ }
      }
    }
    writeAuditLog('backup_cleanup', { deleted: deleted, retention_days: CONFIG.BACKUP_RETENTION_DAYS, min_keep: CONFIG.BACKUP_MIN_KEEP });
    return { success: true, deleted: deleted };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// 商店数据内存缓存 store (从 QSFilterPlugin 定时拉取 + WebHook 实时更新)
//   - 主要数据: shops Map<shop_id, shopObject>
//   - 辅助索引: 按 material / owner / world / shop_type
// ============================================================
const shopStore = {
  shops: new Map(),                  // shop_id (number) -> 完整 shop 对象
  byMaterial: new Map(),             // material -> Set<shop_id>
  byItemId: new Map(),               // item_id -> Set<shop_id>
  byOwner: new Map(),                // owner_name -> Set<shop_id>
  byWorld: new Map(),                // world -> Set<shop_id>
  byType: new Map([['SELLING', new Set()], ['BUYING', new Set()]]),
  totalShops: 0,
  sellingCount: 0,
  buyingCount: 0,
  ownersCount: 0,
  worldsCount: 0,
  materialsCount: 0,
  lastFullSyncAt: null,
  lastUpdateAt: null,
  lastUpdateSource: null              // 'poll' / 'webhook'
};

// ----- 索引更新辅助函数 -----
function _addToIndex(map, key, shopId) {
  if (!key) return;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(shopId);
}
function _removeFromIndex(map, key, shopId) {
  if (!map.has(key)) return;
  map.get(key).delete(shopId);
  if (map.get(key).size === 0) map.delete(key);
}

// 把一家商店写入缓存（新建/更新）
function upsertShop(shop, sourceHint) {
  if (!shop || shop.shop_id === undefined || shop.shop_id === null) return;
  const id = Number(shop.shop_id);
  const prev = shopStore.shops.get(id);
  // 如果之前存在，先从索引移除
  if (prev) {
    _removeFromIndex(shopStore.byMaterial, prev.material, id);
    _removeFromIndex(shopStore.byItemId, prev.item_id, id);
    _removeFromIndex(shopStore.byOwner, prev.owner_name, id);
    _removeFromIndex(shopStore.byWorld, prev.world, id);
    _removeFromIndex(shopStore.byType, prev.shop_type, id);
  }
  // 规范化字段：确保关键字段存在且类型正确
  shop.material = shop.material ? String(shop.material).toUpperCase() : (shop.item_id ? String(shop.item_id).toUpperCase() : 'UNKNOWN');
  shop.item_id = shop.item_id ? String(shop.item_id).toLowerCase() : shop.material.toLowerCase();
  shop.item_name = shop.item_name || shop.material;
  shop.owner_name = shop.owner_name || 'unknown';
  shop.shop_type = shop.shop_type ? String(shop.shop_type).toUpperCase() : 'SELLING';
  shop.price = Number(shop.price) || 0;
  shop.stacking_amount = shop.stacking_amount !== undefined ? Number(shop.stacking_amount) : 1;
  shop.price_reasonable = shop.price_reasonable !== false;
  shop.price_ratio = shop.price_ratio !== undefined ? Number(shop.price_ratio) : 1.0;
  shop.weighted_avg_price = shop.weighted_avg_price !== undefined ? Number(shop.weighted_avg_price) : shop.price;
  shop.activity_score = shop.activity_score !== undefined ? Number(shop.activity_score) : 1;
  shop.world = shop.world || 'world';
  shop.x = shop.x !== undefined ? Number(shop.x) : 0;
  shop.y = shop.y !== undefined ? Number(shop.y) : 0;
  shop.z = shop.z !== undefined ? Number(shop.z) : 0;
  shop.fetched_at = shop.fetched_at || Date.now();

  // -------- 系统商店 vs 玩家商店区分 --------
  // is_system_shop=true: 由系统插件配置，拥有无限库存 & 无限收购能力
  // is_system_shop=false/null: 玩家商店，必须受 max_buy / max_stock 约束
  shop.is_system_shop = Boolean(shop.is_system_shop);
  // 系统商店标志识别：owner_name 包含 [System]/[系统]/Admin 或 material 前缀 SYSTEM
  if (!shop.is_system_shop && shop.owner_name) {
    const n = String(shop.owner_name).toLowerCase();
    if (n.includes('[system]') || n.includes('[系统]') || n === 'admin' || n === 'system') {
      shop.is_system_shop = true;
    }
  }

  // 玩家商店：规范化数量字段 —— null/undefined/空 视为 "未设置"（保持 null，前端显示—）
  // 负数 → 视为 "无限"（保留 -1）；正数 → 使用实际数值
  let qtyRaw = shop.quantity;
  if (shop.is_system_shop) {
    // 系统商店：保持无限
    shop.quantity = -1;
    shop.max_buy_quantity = -1;
    shop.max_stock_capacity = -1;
  } else {
    // 玩家商店：解析 quantity 为实际数值
    if (qtyRaw === null || qtyRaw === undefined || qtyRaw === '') {
      // 未设定数量 —— 保持 null（表示"未设置/未知"，前端显示—）
      shop.quantity = null;
    } else {
      const n = Number(qtyRaw);
      if (!Number.isFinite(n) || n < 0) {
        // 负数或非法值 —— 保持 null（不伪造为默认上限）
        shop.quantity = null;
      } else {
        shop.quantity = Math.floor(n);
      }
    }
    shop.max_buy_quantity = Number(CONFIG.PLAYER_SHOP_MAX_BUY);
    shop.max_stock_capacity = Number(CONFIG.PLAYER_SHOP_MAX_STOCK);
  }

  // 加入 store 和各索引
  shopStore.shops.set(id, shop);
  _addToIndex(shopStore.byMaterial, shop.material, id);
  _addToIndex(shopStore.byItemId, shop.item_id, id);
  _addToIndex(shopStore.byOwner, shop.owner_name, id);
  _addToIndex(shopStore.byWorld, shop.world, id);
  _addToIndex(shopStore.byType, shop.shop_type, id);

  shopStore.totalShops = shopStore.shops.size;
  shopStore.sellingCount = shopStore.byType.get('SELLING') ? shopStore.byType.get('SELLING').size : 0;
  shopStore.buyingCount = shopStore.byType.get('BUYING') ? shopStore.byType.get('BUYING').size : 0;
  shopStore.ownersCount = shopStore.byOwner.size;
  shopStore.worldsCount = shopStore.byWorld.size;
  shopStore.materialsCount = shopStore.byMaterial.size;

  shopStore.lastUpdateAt = Date.now();
  shopStore.lastUpdateSource = sourceHint || 'webhook';
}

// 删除一家商店
function deleteShop(shopId) {
  const id = Number(shopId);
  const shop = shopStore.shops.get(id);
  if (!shop) return false;
  _removeFromIndex(shopStore.byMaterial, shop.material, id);
  _removeFromIndex(shopStore.byItemId, shop.item_id, id);
  _removeFromIndex(shopStore.byOwner, shop.owner_name, id);
  _removeFromIndex(shopStore.byWorld, shop.world, id);
  _removeFromIndex(shopStore.byType, shop.shop_type, id);
  shopStore.shops.delete(id);
  shopStore.totalShops = shopStore.shops.size;
  shopStore.sellingCount = shopStore.byType.get('SELLING') ? shopStore.byType.get('SELLING').size : 0;
  shopStore.buyingCount = shopStore.byType.get('BUYING') ? shopStore.byType.get('BUYING').size : 0;
  shopStore.ownersCount = shopStore.byOwner.size;
  shopStore.worldsCount = shopStore.byWorld.size;
  shopStore.materialsCount = shopStore.byMaterial.size;
  shopStore.lastUpdateAt = Date.now();
  shopStore.lastUpdateSource = 'webhook';
  return true;
}

// 批量刷新（轮询拉取到新数据时调用）—— 先清再填，保持简洁
function bulkLoadShops(shopsArray) {
  shopStore.shops.clear();
  shopStore.byMaterial.clear();
  shopStore.byItemId.clear();
  shopStore.byOwner.clear();
  shopStore.byWorld.clear();
  shopStore.byType.clear();
  shopStore.byType.set('SELLING', new Set());
  shopStore.byType.set('BUYING', new Set());

  let selling = 0, buying = 0;
  if (Array.isArray(shopsArray)) {
    for (const s of shopsArray) {
      if (!s || s.shop_id === undefined || s.shop_id === null) continue;
      // 规范化字段
      s.material = s.material ? String(s.material).toUpperCase() : (s.item_id ? String(s.item_id).toUpperCase() : 'UNKNOWN');
      s.item_id = s.item_id ? String(s.item_id).toLowerCase() : s.material.toLowerCase();
      s.item_name = s.item_name || s.material;
      s.owner_name = s.owner_name || 'unknown';
      s.shop_type = s.shop_type ? String(s.shop_type).toUpperCase() : 'SELLING';
      s.price = Number(s.price) || 0;
      s.stacking_amount = s.stacking_amount !== undefined ? Number(s.stacking_amount) : 1;
      s.price_reasonable = s.price_reasonable !== false;
      s.price_ratio = s.price_ratio !== undefined ? Number(s.price_ratio) : 1.0;
      s.weighted_avg_price = s.weighted_avg_price !== undefined ? Number(s.weighted_avg_price) : s.price;
      s.activity_score = s.activity_score !== undefined ? Number(s.activity_score) : 1;
      s.world = s.world || 'world';
      s.x = s.x !== undefined ? Number(s.x) : 0;
      s.y = s.y !== undefined ? Number(s.y) : 0;
      s.z = s.z !== undefined ? Number(s.z) : 0;
      s.fetched_at = s.fetched_at || Date.now();

      // -------- 系统商店 vs 玩家商店区分 --------
      s.is_system_shop = Boolean(s.is_system_shop);
      if (!s.is_system_shop && s.owner_name) {
        const n = String(s.owner_name).toLowerCase();
        if (n.includes('[system]') || n.includes('[系统]') || n === 'admin' || n === 'system') {
          s.is_system_shop = true;
        }
      }
      if (s.is_system_shop) {
        s.quantity = -1;
        s.max_buy_quantity = -1;
        s.max_stock_capacity = -1;
      } else {
        const raw = s.quantity;
        if (raw === null || raw === undefined || raw === '') {
          s.quantity = null; // 未设置 —— 保持 null，前端显示 "—"
        } else {
          const n = Number(raw);
          if (!Number.isFinite(n) || n < 0) {
            s.quantity = null; // 非法值 —— 保持 null
          } else {
            s.quantity = Math.floor(n);
          }
        }
        s.max_buy_quantity = Number(CONFIG.PLAYER_SHOP_MAX_BUY);
        s.max_stock_capacity = Number(CONFIG.PLAYER_SHOP_MAX_STOCK);
      }

      const id = Number(s.shop_id);
      shopStore.shops.set(id, s);
      _addToIndex(shopStore.byMaterial, s.material, id);
      _addToIndex(shopStore.byItemId, s.item_id, id);
      _addToIndex(shopStore.byOwner, s.owner_name, id);
      _addToIndex(shopStore.byWorld, s.world, id);
      _addToIndex(shopStore.byType, s.shop_type, id);
      if (s.shop_type === 'SELLING') selling++;
      if (s.shop_type === 'BUYING') buying++;
    }
  }
  shopStore.totalShops = shopStore.shops.size;
  shopStore.sellingCount = selling;
  shopStore.buyingCount = buying;
  shopStore.ownersCount = shopStore.byOwner.size;
  shopStore.worldsCount = shopStore.byWorld.size;
  shopStore.materialsCount = shopStore.byMaterial.size;
  shopStore.lastFullSyncAt = Date.now();
  shopStore.lastUpdateAt = Date.now();
  shopStore.lastUpdateSource = 'poll';
}

// 按条件查询（支持搜索/过滤/排序/分页）
function queryShops(opts) {
  opts = opts || {};
  // 注意：show_all 参数的默认值需要特殊处理。
  // - 未传入（undefined）→ 默认显示所有（不做 price_reasonable 过滤）
  // - 显式传入 'false' / false → 仅显示价格合理的
  // - 显式传入 'true' / true → 显示所有
  const _show_allRaw = opts.show_all;  // 未处理的原始值（可能为 undefined）
  const { keyword = '', material = '', shop_type = '', owner = '', world = '',
          min_price = '', max_price = '', sort = '', page = 1, pageSize = 30 } = opts;
  const show_all = _show_allRaw;

  let candidateIds;
  const kw = keyword && typeof keyword === 'string' ? keyword.trim().toLowerCase() : '';
  const mat = material ? String(material).trim().toUpperCase() : '';
  const st = shop_type ? String(shop_type).trim().toUpperCase() : '';
  const ow = owner ? String(owner).trim().toLowerCase() : '';
  const wd = world ? String(world).trim() : '';
  const minP = (min_price !== undefined && min_price !== '' && !isNaN(Number(min_price))) ? Number(min_price) : null;
  const maxP = (max_price !== undefined && max_price !== '' && !isNaN(Number(max_price))) ? Number(max_price) : null;

  // --- 从索引快速缩小范围 ---
  let seedSet = null;
  if (st === 'SELLING' || st === 'BUYING') seedSet = new Set(shopStore.byType.get(st) || []);
  if (mat) {
    const s = new Set(shopStore.byMaterial.get(mat) || []);
    seedSet = seedSet ? new Set([...seedSet].filter(x => s.has(x))) : s;
  }
  if (ow) {
    let s = null;
    for (const [k, set] of shopStore.byOwner.entries()) {
      if (k && k.toLowerCase().indexOf(ow) >= 0) {
        s = s ? new Set([...s, ...set]) : new Set(set);
      }
    }
    if (s) seedSet = seedSet ? new Set([...seedSet].filter(x => s.has(x))) : s;
  }
  if (wd) {
    let s = null;
    for (const [k, set] of shopStore.byWorld.entries()) {
      if (k && k.indexOf(wd) >= 0) {
        s = s ? new Set([...s, ...set]) : new Set(set);
      }
    }
    if (s) seedSet = seedSet ? new Set([...seedSet].filter(x => s.has(x))) : s;
  }

  // 收集候选对象数组
  let results = [];
  if (seedSet) {
    seedSet.forEach(id => { const s = shopStore.shops.get(id); if (s) results.push(s); });
  } else {
    results = Array.from(shopStore.shops.values());
  }

  // --- 价格过滤 ---
  if (minP !== null) results = results.filter(s => s.price !== undefined && Number(s.price) >= minP);
  if (maxP !== null) results = results.filter(s => s.price !== undefined && Number(s.price) <= maxP);

  // --- 关键词模糊匹配（item_name / material / owner_name）---
  if (kw) {
    results = results.filter(s =>
      (s.item_name && String(s.item_name).toLowerCase().indexOf(kw) >= 0) ||
      (s.material && String(s.material).toLowerCase().indexOf(kw) >= 0) ||
      (s.owner_name && String(s.owner_name).toLowerCase().indexOf(kw) >= 0)
    );
  }

  // --- show_all: 只有显式传入 show_all=false 才按价格合理性过滤 ---
  // show_all 为 undefined / null / true / 'true' → 显示所有
  // show_all 为 false / 'false' → 仅显示价格合理的
  const isExplicitNoShowAll = (show_all === false || (typeof show_all === 'string' && show_all.toLowerCase() === 'false'));
  if (isExplicitNoShowAll) {
    results = results.filter(s => s.price_reasonable);
  }

  // --- 排序 ---
  const s = (sort || '').toLowerCase();
  if (s === 'price_asc') {
    results.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  } else if (s === 'price_desc') {
    results.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
  } else if (s === 'ratio_asc' || s === 'ratio') {
    results.sort((a, b) => (Number(a.price_ratio) || 0) - (Number(b.price_ratio) || 0));
  } else if (s === 'amount') {
    results.sort((a, b) => (Number(b.stacking_amount) || 0) - (Number(a.stacking_amount) || 0));
  } else if (s === 'shop_id') {
    results.sort((a, b) => Number(a.shop_id) - Number(b.shop_id));
  }

  const total = results.length;
  const pSize = Math.min(Math.max(1, Number(pageSize) || 30), 500);
  const pNum = Math.max(1, Number(page) || 1);
  const start = (pNum - 1) * pSize;
  const pageItems = results.slice(start, start + pSize);

  return {
    shops: pageItems,
    total: total,
    page: pNum,
    limit: pSize,
    total_pages: Math.max(1, Math.ceil(total / pSize))
  };
}

// 按 item_id 查价格统计（与插件 2.4 格式兼容）
function getPriceByItemId(itemId) {
  const key = String(itemId || '').trim().toLowerCase();
  if (!key) return null;
  const ids = shopStore.byItemId.get(key);
  let material = null;
  let item_name = null;
  if (ids && ids.size > 0) {
    const first = shopStore.shops.get(ids.values().next().value);
    if (first) { material = first.material; item_name = first.item_name; }
  } else {
    // 尝试按 material 精确匹配（大写）
    const matKey = key.toUpperCase();
    const matIds = shopStore.byMaterial.get(matKey);
    if (!matIds || matIds.size === 0) return null;
    const first = shopStore.shops.get(matIds.values().next().value);
    if (first) { material = first.material; item_name = first.item_name; }
  }
  const shops = ids ? Array.from(ids).map(id => shopStore.shops.get(id)) : [];

  const sellingShops = shops.filter(s => s && s.shop_type === 'SELLING');
  const buyingShops = shops.filter(s => s && s.shop_type === 'BUYING');

  let sellingMin = -1, sellingMax = -1, sellingAvg = -1;
  if (sellingShops.length > 0) {
    const prices = sellingShops.map(s => Number(s.price)).filter(p => !isNaN(p));
    sellingMin = Math.min(...prices);
    sellingMax = Math.max(...prices);
    sellingAvg = Number((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2));
  }
  let buyingMin = -1, buyingMax = -1, buyingAvg = -1;
  if (buyingShops.length > 0) {
    const prices = buyingShops.map(s => Number(s.price)).filter(p => !isNaN(p));
    buyingMin = Math.min(...prices);
    buyingMax = Math.max(...prices);
    buyingAvg = Number((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2));
  }

  // 加权均价（weighted_avg_price 字段插件已经算好，取最小比率的值）
  let weightedAvg = -1;
  const reasonable = shops.filter(s => s && s.price_reasonable);
  if (reasonable.length > 0) {
    const prices = reasonable.map(s => Number(s.price)).filter(p => !isNaN(p));
    weightedAvg = Number((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2));
  } else if (shops.length > 0) {
    const prices = shops.map(s => Number(s.weighted_avg_price)).filter(p => !isNaN(p) && p > 0);
    if (prices.length > 0) weightedAvg = Number((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2));
  }

  return {
    material: material || key.toUpperCase(),
    item_id: key,
    item_name: item_name || '',
    weighted_avg_price: weightedAvg,
    current_shop_count: shops.length,
    selling_shop_count: sellingShops.length,
    selling_min_price: sellingMin,
    selling_max_price: sellingMax,
    selling_avg_price: sellingAvg,
    buying_shop_count: buyingShops.length,
    buying_min_price: buyingMin,
    buying_max_price: buyingMax,
    buying_avg_price: buyingAvg
  };
}

// 解析 QSFILTER_URL
function parseQsUrl() {
  try {
    const u = url.parse(CONFIG.QSFILTER_URL);
    return {
      protocol: u.protocol || 'http:',
      hostname: u.hostname || '127.0.0.1',
      port: parseInt(u.port) || 8765,
      base: (u.protocol || 'http:') + '//' + (u.hostname || '127.0.0.1') + ':' + (u.port || 8765)
    };
  } catch (e) {
    return { protocol: 'http:', hostname: '127.0.0.1', port: 8765, base: 'http://127.0.0.1:8765' };
  }
}
const QSURL_INFO = parseQsUrl();
qsfilterStatus.base_url = QSURL_INFO.base;

// 通用 HTTP GET 请求 (带超时、重试、错误处理)
function qsfilterGET(apiPath) {
  return new Promise((resolve, reject) => {
    if (!qsfilterStatus.enabled) {
      return reject(new Error('QSFilterPlugin 连接未启用 (QSFILTER_ENABLED=false)'));
    }
    qsfilterStatus.total_requests++;

    const startAt = Date.now();
    const fullPath = '/api' + apiPath;
    const options = {
      hostname: QSURL_INFO.hostname,
      port: QSURL_INFO.port,
      path: fullPath,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'QshopWebUI/5.0 (+http://' + CONFIG.HOST + ':' + CONFIG.PORT + ')'
      },
      timeout: CONFIG.QSFILTER_TIMEOUT
    };

    let done = false;
    let timeoutHandle = null;

    function cleanup() {
      if (timeoutHandle) { clearTimeout(timeoutHandle); timeoutHandle = null; }
    }

    const req = http.request(options, (res) => {
      const code = res.statusCode;
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        cleanup();
        if (done) return;
        done = true;

        const latency = Date.now() - startAt;
        qsfilterStatus.latency_ms = latency;

        if (code >= 200 && code < 300) {
          try {
            const json = JSON.parse(data);
            qsfilterStatus.connected = true;
            qsfilterStatus.last_success_at = Date.now();
            qsfilterStatus.last_error = null;
            resolve({ status: code, data: json, latency_ms: latency });
          } catch (parseErr) {
            qsfilterStatus.total_errors++;
            qsfilterStatus.last_error = '响应无法解析为 JSON: ' + parseErr.message;
            qsfilterStatus.last_error_at = Date.now();
            reject(new Error('QSFilter 返回了无效 JSON (HTTP ' + code + ')'));
          }
        } else if (code === 404) {
          qsfilterStatus.total_errors++;
          qsfilterStatus.last_error = 'API 路径未找到: ' + fullPath + ' (HTTP 404)';
          qsfilterStatus.last_error_at = Date.now();
          reject(new Error('QSFilter API 路径未找到: ' + fullPath + ' (请确认插件版本是否正确)'));
        } else {
          qsfilterStatus.total_errors++;
          qsfilterStatus.last_error = 'HTTP 错误 ' + code + ': ' + data.substring(0, 200);
          qsfilterStatus.last_error_at = Date.now();
          reject(new Error('QSFilter 返回 HTTP ' + code));
        }
      });
    });

    req.on('error', (err) => {
      cleanup();
      if (done) return;
      done = true;
      qsfilterStatus.connected = false;
      qsfilterStatus.qs_available = false;
      qsfilterStatus.total_errors++;
      qsfilterStatus.last_error = err.code === 'ECONNREFUSED'
        ? '连接被拒绝: ' + QSURL_INFO.hostname + ':' + QSURL_INFO.port + ' (请确认 Minecraft 服务器和 QSFilterPlugin 插件已启动)'
        : err.code === 'ETIMEDOUT'
        ? '连接超时 (' + CONFIG.QSFILTER_TIMEOUT + 'ms): ' + QSURL_INFO.hostname + ':' + QSURL_INFO.port
        : err.code === 'ENOTFOUND'
        ? '无法解析域名: ' + QSURL_INFO.hostname + ' (请检查 DNS 配置)'
        : err.message || String(err);
      qsfilterStatus.last_error_at = Date.now();
      reject(new Error(qsfilterStatus.last_error));
    });

    timeoutHandle = setTimeout(() => {
      if (done) return;
      done = true;
      qsfilterStatus.connected = false;
      qsfilterStatus.qs_available = false;
      qsfilterStatus.total_errors++;
      qsfilterStatus.last_error = '请求超时 (' + CONFIG.QSFILTER_TIMEOUT + 'ms): ' + QSURL_INFO.base + fullPath;
      qsfilterStatus.last_error_at = Date.now();
      req.destroy(new Error('timeout'));
      reject(new Error(qsfilterStatus.last_error));
    }, CONFIG.QSFILTER_TIMEOUT);

    req.on('timeout', () => {
      if (done) return;
      req.destroy(new Error('timeout'));
    });

    req.end();
  });
}

// 带自动重试的请求封装
async function qsfilterRequest(apiPath) {
  let lastErr = null;
  for (let attempt = 0; attempt <= CONFIG.QSFILTER_MAX_RETRIES; attempt++) {
    try {
      const result = await qsfilterGET(apiPath);
      return result;
    } catch (err) {
      lastErr = err;
      if (attempt < CONFIG.QSFILTER_MAX_RETRIES) {
        await new Promise(r => setTimeout(r, CONFIG.QSFILTER_RETRY_DELAY));
      }
    }
  }
  throw lastErr || new Error('QSFilter 请求失败');
}

// 健康检查（更新连接状态）
async function qsfilterHealthCheck() {
  try {
    const r = await qsfilterRequest('/health');
    if (r.data && r.data.qs_available !== undefined) {
      qsfilterStatus.qs_available = !!r.data.qs_available;
    }
    qsfilterStatus.connected = true;
    return {
      success: true,
      connected: true,
      qs_available: qsfilterStatus.qs_available,
      latency_ms: r.latency_ms,
      data: r.data
    };
  } catch (err) {
    qsfilterStatus.connected = false;
    qsfilterStatus.qs_available = false;
    return {
      success: false,
      connected: false,
      qs_available: false,
      error: err.message,
      last_error_at: qsfilterStatus.last_error_at
    };
  }
}

// 单次同步（用于定时任务和手动同步，失败返回 false）
async function qsfilterSyncOnce() {
  try {
    if (!qsfilterStatus.enabled) {
      return { success: false, error: 'QSFilter 未启用' };
    }
    const result = await qsfilterSyncFromPlugin();
    if (result && result.success !== false) {
      return { success: true, count: shopStore.totalShops };
    }
    return { success: false, error: result && result.error ? result.error : '同步失败' };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

// 从 QSFilter 拉取统计数据（用于状态显示）
async function qsfilterSyncStats() {
  try {
    const r = await qsfilterRequest('/stats');
    qsfilterStatus.last_sync_stats = r.data;
    return r.data;
  } catch (err) {
    qsfilterStatus.last_sync_stats = null;
    return null;
  }
}

// 启动时执行一次健康检查，然后按配置的间隔轮询
// ============================================================
// 从 QSFilterPlugin 拉取商店全量数据（替换本地缓存）
//   GET http://插件IP:8765/api/shops?show_all=true&limit=200
// ============================================================
async function qsfilterSyncFromPlugin() {
  try {
    // 使用 show_all=true 拉取全部商店
    const r = await qsfilterRequest('/shops?show_all=true&limit=500');
    const shops = (r.data && Array.isArray(r.data.shops)) ? r.data.shops :
                  Array.isArray(r.data) ? r.data : [];
    // ✅ 关键修复：只有 QSFilter 返回有效数据时才替换内存/数据库
    // 空数组时不调用 bulkLoadShops，保留从数据库加载的数据
    if (shops.length > 0) {
      bulkLoadShops(shops);
    }

    // ✅ 关键修复：同步写入数据库（持久化，防止重启后数据丢失
    if (dbStatus.connected && shops.length > 0) {
      try {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          // 先清空旧数据（原子替换）
          await client.query('DELETE FROM shops');
          // 批量插入新数据
          for (const s of shops) {
            try {
              const id = s.shop_id !== undefined && s.shop_id !== null ? Number(s.shop_id) : null;
              const material = String(s.material || 'UNKNOWN').toUpperCase();
              const itemName = String(s.item_name || s.material || 'Unknown');
              const ownerName = String(s.owner_name || 'unknown');
              const ownerUuid = s.owner_uuid || null;
              const price = Number(s.price) || 0;
              const stackingAmount = s.stacking_amount !== undefined ? Number(s.stacking_amount) : 1;
              const shopType = String(s.shop_type || 'SELLING').toUpperCase();
              const world = String(s.world || 'world');
              const x = Number(s.x) || 0;
              const y = Number(s.y) || 0;
              const z = Number(s.z) || 0;
              const isSystemShop = Boolean(s.is_system_shop) ||
                (ownerName && (ownerName.toLowerCase().includes('[system]') || ownerName.toLowerCase().includes('[系统]') || ownerName.toLowerCase() === 'admin' || ownerName.toLowerCase() === 'system'));
              let quantity;
              if (isSystemShop) {
                quantity = -1;
              } else {
                const raw = s.quantity;
                if (raw === null || raw === undefined || raw === '') quantity = null;
                else {
                  const n = Number(raw);
                  quantity = (Number.isFinite(n) && n >= 0) ? Math.floor(n) : null;
                }
              }
              const activityScore = Number(s.activity_score) || 0;
              const reasonable = s.price_reasonable !== false;
              if (id !== null) {
                await client.query(
                  'INSERT INTO shops (shop_id, material, item_name, owner_name, owner_uuid, price, stacking_amount, shop_type, world, x, y, z, price_reasonable, nbt, quantity, activity_score, fetched_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())',
                  [id, material, itemName, ownerName, ownerUuid, price, stackingAmount, shopType, world, x, y, z, reasonable, s.nbt || null, quantity, activityScore]
                );
              }
            } catch (rowErr) { /* 单条记录失败，继续下一条 */ }
          }
          await client.query('COMMIT');
        } catch (txErr) {
          await client.query('ROLLBACK');
          console.error('❌ QSFilter 数据写入数据库失败:', txErr.message);
        } finally {
          client.release();
        }
      } catch (connErr) { /* 数据库写入失败不影响内存数据 */ }
    }
    qsfilterStatus.polling_last_at = Date.now();
    qsfilterStatus.polling_last_count = shops.length;
    qsfilterStatus.connected = true;
    qsfilterStatus.last_success_at = Date.now();
    qsfilterStatus.last_sync_stats = {
      total: shops.length,
      selling: shopStore.sellingCount,
      buying: shopStore.buyingCount,
      materials: shopStore.materialsCount,
      owners: shopStore.ownersCount,
      worlds: shopStore.worldsCount
    };
    return { success: true, count: shops.length, latency_ms: r.latency_ms };
  } catch (err) {
    qsfilterStatus.polling_error_count++;
    qsfilterStatus.connected = false;
    qsfilterStatus.qs_available = false;
    qsfilterStatus.last_error = err.message || String(err);
    qsfilterStatus.last_error_at = Date.now();
    return { success: false, error: err.message };
  }
}

// ============================================================
// 启动轮询 + 健康检查
// ============================================================
function startQsfilterSyncLoop() {
  if (!qsfilterStatus.enabled) {
    console.log('ℹ️  QSFilterPlugin 未启用 (QSFILTER_ENABLED=false) — 使用本地数据库数据');
    return;
  }

  console.log('');
  console.log('🌐 QSFilterPlugin 连接已启用');
  console.log('   目标地址: ' + QSURL_INFO.base);
  console.log('   请求超时: ' + CONFIG.QSFILTER_TIMEOUT + ' ms');
  console.log('   自动同步: ' + (CONFIG.QSFILTER_SYNC_INTERVAL > 0 ? '每 ' + CONFIG.QSFILTER_SYNC_INTERVAL + ' 秒' : '已禁用'));
  console.log('   重试策略: 最多 ' + CONFIG.QSFILTER_MAX_RETRIES + ' 次');
  console.log('');
  console.log('   → 插件 config.yml 建议配置:');
  console.log('     lf-api-url: "http://<你的前端服务器IP>:' + CONFIG.PORT + '"');
  console.log('     webhook:');
  console.log('       url: "http://<你的前端服务器IP>:' + CONFIG.PORT + '"');
  console.log('');
  console.log('   → 前端 Webhook 端点（接收 MC 事件推送）:');
  console.log('     POST /webhook/shop-create    — 新建商店');
  console.log('     POST /webhook/shop-delete    — 删除商店');
  console.log('     POST /webhook/shop-price     — 修改价格');
  console.log('     POST /webhook/shop-type      — 修改交易类型');
  console.log('     （兼容路径） POST /api/webhook/shop-{create|delete|price|type}');
  console.log('');

  // 立即执行：健康检查 + 首次全量同步
  qsfilterHealthCheck().then(hc => {
    if (hc.success) {
      console.log('✅ QSFilterPlugin 已连接 (耗时 ' + hc.latency_ms + 'ms, qs_available=' + hc.qs_available + ')');
      qsfilterSyncFromPlugin().then(r => {
        if (r.success) {
          console.log('   ↳ 首次同步完成: ' + r.count + ' 家商店 (耗时 ' + r.latency_ms + 'ms)');
        } else {
          console.log('   ⚠️  首次同步失败: ' + r.error);
        }
      });
    } else {
      console.log('⚠️  QSFilterPlugin 连接失败: ' + hc.error);
      console.log('   提示: 请确认 Minecraft 服务器已启动、QSFilterPlugin 插件已安装并启用');
      console.log('   插件默认监听端口: 8765');
      console.log('   如需修改目标地址，编辑 .env QSFILTER_URL=... 并重启 Node.js');
    }
  });

  // 定时轮询：按配置间隔执行
  if (CONFIG.QSFILTER_SYNC_INTERVAL > 0) {
    setInterval(() => {
      qsfilterHealthCheck();
      if (qsfilterStatus.connected) {
        qsfilterSyncFromPlugin();
      }
    }, Math.max(30000, CONFIG.QSFILTER_SYNC_INTERVAL * 1000));
  } else {
    // 不做数据同步，但保持健康检查
    setInterval(() => { qsfilterHealthCheck(); }, 30000);
  }
}

// ============================================================
// 工具函数
// ============================================================
function respErr(res, status, msg, err) {
  if (err && err.message) {
    if (shouldLogError(err.message)) {
      console.error('[ERR]', msg || err.message);
    }
  } else if (msg && shouldLogError(msg)) {
    console.error('[ERR]', msg);
  }
  res.status(status).json({ success: false, error: msg });
}
function safeParseJSON(str, fb) {
  if (!str) return fb;
  try { return JSON.parse(str); } catch (e) { return fb; }
}
function castSettingValue(val, type) {
  if (val === null || val === undefined) return null;
  if (type === 'number') return Number(val) || 0;
  if (type === 'boolean') return val === true || val === 'true' || val === 1;
  return String(val);
}

// ============================================================
// 激进内存缓存 (支持 TTL + invalidate)
// ============================================================
const cache = new Map();
function cacheGet(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) { cache.delete(key); return null; }
  return e.value;
}
function cacheSet(key, value, ttlMs) {
  cache.set(key, { value, expires: Date.now() + ttlMs });
}
function cacheInvalidate(prefix) {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}
function cacheClearAll() { cache.clear(); }
setInterval(() => {
  const now = Date.now();
  let n = 0;
  for (const [k, v] of cache.entries()) {
    if (now > v.expires) { cache.delete(k); n++; }
  }
}, 60 * 1000);

// ============================================================
// 搜索请求合并 (Dedup): 500ms 内相同 query 复用同一 Promise
// ============================================================
const pendingSearches = new Map();
function dedupSearch(queryKey, executor) {
  if (pendingSearches.has(queryKey)) return pendingSearches.get(queryKey);
  const promise = executor().finally(() => {
    setTimeout(() => pendingSearches.delete(queryKey), 100);
  });
  pendingSearches.set(queryKey, promise);
  return promise;
}

// ============================================================
// 预聚合: 活动访问计数器 (内存累加 → 每 10s flush DB)
// ============================================================
const activityBuffer = new Map(); // material -> inc count
function recordActivity(material) {
  if (!material) return;
  const key = String(material).toUpperCase();
  activityBuffer.set(key, (activityBuffer.get(key) || 0) + 1);
}
setInterval(async () => {
  if (activityBuffer.size === 0 || !dbStatus.connected) return;
  const snapshot = Array.from(activityBuffer.entries());
  activityBuffer.clear();
  try {
    // 批量 UPSERT: 用单个 WITH 语句
    const values = snapshot.map(([mat, cnt], i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(',');
    const params = [];
    snapshot.forEach(([mat, cnt]) => { params.push(mat, cnt); });
    await pool.query(
      `INSERT INTO activity (material, views) VALUES ${values}
       ON CONFLICT (material) DO UPDATE SET views = activity.views + EXCLUDED.views, last_visit = CURRENT_TIMESTAMP`,
      params
    );
    // 同时更新 shops.activity_score (取前 200 个高频材料)
    snapshot.sort((a, b) => b[1] - a[1]);
    const topMats = snapshot.slice(0, 200).map(([m]) => m);
    if (topMats.length > 0) {
      await pool.query(`UPDATE shops SET activity_score = activity_score + 1 WHERE material = ANY($1::text[])`, [topMats]);
    }
    cacheInvalidate('top:');
    cacheInvalidate('stats:');
    cacheInvalidate('activity:');
  } catch (e) {
    console.warn('[ACTIVITY-FLUSH]', e.message);
  }
}, CONFIG.ACTIVITY_FLUSH_INTERVAL);

// ============================================================
// 表初始化 (PostgreSQL)
// ============================================================
async function autoInitTables() {
  try {
    const { rows } = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    const existing = new Set(rows.map(r => r.tablename));

    if (!existing.has('shops')) {
      await pool.query(`CREATE TABLE shops (
        shop_id VARCHAR(128) NOT NULL PRIMARY KEY,
        material VARCHAR(128) NOT NULL,
        item_name VARCHAR(256) NOT NULL,
        owner_name VARCHAR(128) NOT NULL,
        owner_uuid VARCHAR(64) DEFAULT NULL,
        price NUMERIC(18,2) NOT NULL DEFAULT 0,
        stacking_amount INTEGER NOT NULL DEFAULT 1,
        shop_type VARCHAR(16) NOT NULL DEFAULT 'SELLING',
        world VARCHAR(128) DEFAULT 'world',
        x INTEGER DEFAULT 0, y INTEGER DEFAULT 0, z INTEGER DEFAULT 0,
        price_reasonable BOOLEAN DEFAULT TRUE,
        nbt JSONB DEFAULT NULL,
        quantity INTEGER DEFAULT -1,
        activity_score INTEGER NOT NULL DEFAULT 0,
        fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      console.log('[INIT] shops 表已创建');
    }
    if (!existing.has('settings')) {
      await pool.query(`CREATE TABLE settings (
        id SERIAL PRIMARY KEY, setting_key VARCHAR(128) NOT NULL UNIQUE,
        setting_value TEXT DEFAULT NULL, setting_type VARCHAR(32) DEFAULT 'string',
        description VARCHAR(256) DEFAULT NULL, is_protected BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    }
    if (!existing.has('harbor'))
      await pool.query(`CREATE TABLE harbor (id SERIAL PRIMARY KEY, world VARCHAR(64) DEFAULT 'world', x INTEGER DEFAULT 0, y INTEGER DEFAULT 0, z INTEGER DEFAULT 0)`);
    if (!existing.has('activity'))
      await pool.query(`CREATE TABLE activity (material VARCHAR(128) NOT NULL PRIMARY KEY, views INTEGER NOT NULL DEFAULT 1, last_visit TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    if (!existing.has('fetch_log'))
      await pool.query(`CREATE TABLE fetch_log (id SERIAL PRIMARY KEY, time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, added INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL DEFAULT 0, source VARCHAR(64) DEFAULT 'manual', remark VARCHAR(256) DEFAULT NULL)`);

    if (!existing.has('users')) {
      await pool.query(`CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(64) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'user',
        email VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMPTZ,
        active BOOLEAN DEFAULT TRUE
      )`);
    }
    if (!existing.has('sessions')) {
      await pool.query(`CREATE TABLE sessions (
        session_id VARCHAR(64) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(64) NOT NULL,
        ip VARCHAR(64),
        user_agent VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMPTZ NOT NULL
      )`);
    }
    if (!existing.has('seed_audit')) {
      await pool.query(`CREATE TABLE seed_audit (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(64),
        username VARCHAR(64),
        ip VARCHAR(64),
        action VARCHAR(32) NOT NULL,
        target_count INTEGER DEFAULT 0,
        inserted_count INTEGER DEFAULT 0,
        status VARCHAR(32),
        elapsed_ms INTEGER DEFAULT 0,
        message VARCHAR(512),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    }
    // ✅ 公告数据持久化表
    if (!existing.has('announcements')) {
      await pool.query(`CREATE TABLE announcements (
        id VARCHAR(128) PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        author VARCHAR(64) DEFAULT 'system',
        priority VARCHAR(16) DEFAULT 'normal',
        published BOOLEAN DEFAULT TRUE,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )`);
    }
    // ✅ 系统通知 / 备份日志表（统一结构化）
    if (!existing.has('system_notifications')) {
      await pool.query(`CREATE TABLE system_notifications (
        id SERIAL PRIMARY KEY,
        type VARCHAR(32) NOT NULL,       -- backup / info / warning / error
        status VARCHAR(32) NOT NULL,     -- running / success / failed
        title VARCHAR(200) DEFAULT NULL,
        message TEXT DEFAULT NULL,
        file_name VARCHAR(255) DEFAULT NULL,
        file_path VARCHAR(512) DEFAULT NULL,
        size_bytes BIGINT DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        operator VARCHAR(64) DEFAULT 'system',
        extra JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    }
    if (!existing.has('backup_logs_idx'))
      await pool.query('CREATE INDEX IF NOT EXISTS idx_system_notifications_type_created ON system_notifications (type, created_at DESC)');

    // 默认 settings
    const { rows: sCount } = await pool.query("SELECT COUNT(*) AS c FROM settings");
    if (parseInt(sCount[0].c) === 0) {
      const defaults = [
        ['app_name', 'QshopWebUI', 'string'],
        ['items_per_page', '12', 'number'],
        ['default_sort', 'relevance', 'string'],
        ['enable_3d', 'true', 'boolean'],
        ['enable_search', 'true', 'boolean'],
        ['enable_activity', 'true', 'boolean'],
        ['search_min_length', '2', 'number'],
        ['max_batch_size', '5000', 'number'],
        ['log_retention', '30', 'number'],
        ['api_rate_limit', '1000', 'number'],
        ['require_auth', 'true', 'boolean'],
        ['admin_username', 'admin', 'string'],
        ['admin_password', bcrypt ? await bcrypt.hash(CONFIG.ADMIN_PASSWORD, 10) : 'CHANGE-ON-LOGIN', 'string'],
        ['session_timeout', '3600', 'number']
      ];
      for (const [k, v, t] of defaults) {
        await pool.query("INSERT INTO settings (setting_key, setting_value, setting_type) VALUES ($1,$2,$3) ON CONFLICT (setting_key) DO NOTHING", [k, v, t]);
      }
    }
    // 默认港口
    const { rows: hCount } = await pool.query("SELECT COUNT(*) AS c FROM harbor");
    if (parseInt(hCount.c) === 0)
      await pool.query("INSERT INTO harbor (world,x,y,z) VALUES ('world',0,64,0)");

    // 默认管理员用户 (users 表)
    try {
      const { rows: uCount } = await pool.query("SELECT COUNT(*) AS c FROM users");
      if (parseInt(uCount[0].c) === 0) {
        const pwHash = bcrypt ? await bcrypt.hash(CONFIG.ADMIN_PASSWORD, 10) : 'plaintext-please-login';
        await pool.query(
          "INSERT INTO users (username, password_hash, role, email, last_login) VALUES ($1,$2,$3,$4,NULL)",
          [CONFIG.ADMIN_USERNAME, pwHash, 'admin', 'admin@localhost']
        );
        console.log('[INIT] 默认管理员用户创建: admin');
      }
    } catch (e) { console.warn('[INIT-USERS]', e.message); }

    // 扩展 & 索引
    try { await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm"); } catch(e){}
    await ensureIndexes();

    // updated_at 触发器
    try {
      const { rows: tr } = await pool.query("SELECT tgname FROM pg_trigger WHERE tgrelid='shops'::regclass AND tgname='trg_shops_updated'");
      if (tr.length === 0) {
        await pool.query(`CREATE OR REPLACE FUNCTION fn_update_modified() RETURNS TRIGGER AS $$
          BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$ LANGUAGE plpgsql`);
        await pool.query('CREATE TRIGGER trg_shops_updated BEFORE UPDATE ON shops FOR EACH ROW EXECUTE FUNCTION fn_update_modified()');
      }
    } catch(e) {}

    dbStatus.tablesReady = true;
  } catch (err) {
    console.warn('[INIT]', err.message);
  }
}

async function ensureIndexes() {
  const exists = new Set();
  try {
    const { rows } = await pool.query("SELECT indexname FROM pg_indexes WHERE tablename = 'shops'");
    rows.forEach(r => exists.add(r.indexname));
  } catch(e){}
  const create = async (name, sql) => {
    if (exists.has(name)) return;
    try { await pool.query(sql); console.log('[INDEX]', name); }
    catch(e){ /* 已存在或无权限 */ }
  };
  // 单列 B-tree
  await create('idx_shops_material', 'CREATE INDEX idx_shops_material ON shops (material)');
  await create('idx_shops_owner', 'CREATE INDEX idx_shops_owner ON shops (owner_name)');
  await create('idx_shops_shop_type', 'CREATE INDEX idx_shops_shop_type ON shops (shop_type)');
  await create('idx_shops_price', 'CREATE INDEX idx_shops_price ON shops (price)');
  await create('idx_shops_world', 'CREATE INDEX idx_shops_world ON shops (world)');
  await create('idx_shops_activity', 'CREATE INDEX idx_shops_activity ON shops (activity_score DESC)');
  // 复合 B-tree (TOP 查询 / 带过滤的 TOP)
  await create('idx_shops_activity_price', 'CREATE INDEX idx_shops_activity_price ON shops (activity_score DESC, price ASC)');
  await create('idx_shops_mat_activity', 'CREATE INDEX idx_shops_mat_activity ON shops (material, activity_score DESC, price ASC)');
  await create('idx_shops_owner_activity', 'CREATE INDEX idx_shops_owner_activity ON shops (owner_name, activity_score DESC)');
  await create('idx_shops_type_activity', 'CREATE INDEX idx_shops_type_activity ON shops (shop_type, activity_score DESC)');
  // JSONB
  try { await create('idx_shops_nbt', 'CREATE INDEX idx_shops_nbt ON shops USING GIN (nbt)'); } catch(e){}
  // pg_trgm (模糊搜索)
  try {
    await create('idx_shops_mat_trgm', "CREATE INDEX idx_shops_mat_trgm ON shops USING GIN (material gin_trgm_ops)");
    await create('idx_shops_item_trgm', "CREATE INDEX idx_shops_item_trgm ON shops USING GIN (item_name gin_trgm_ops)");
    await create('idx_shops_owner_trgm', "CREATE INDEX idx_shops_owner_trgm ON shops USING GIN (owner_name gin_trgm_ops)");
  } catch(e){}
  // 部分索引 (热点)
  await create('idx_shops_hot', 'CREATE INDEX idx_shops_hot ON shops (activity_score DESC, price ASC) WHERE activity_score > 50');
  // activity / fetch_log
  try {
    const { rows: ar } = await pool.query("SELECT indexname FROM pg_indexes WHERE tablename='activity'");
    if (!ar.some(r => r.indexname === 'idx_activity_views'))
      await pool.query('CREATE INDEX idx_activity_views ON activity (views DESC)');
    const { rows: fr } = await pool.query("SELECT indexname FROM pg_indexes WHERE tablename='fetch_log'");
    if (!fr.some(r => r.indexname === 'idx_fetch_log_time'))
      await pool.query('CREATE INDEX idx_fetch_log_time ON fetch_log (time DESC)');
  } catch(e){}
}

function tryConnectDB() {
  return pool.query('SELECT 1').then(async (res) => {
    dbStatus.connected = true;
    console.log(`✅ PostgreSQL 已连接: ${CONFIG.DB_USER}@${CONFIG.DB_HOST}/${CONFIG.DB_NAME}`);
    for (let i = 0; i < CONFIG.DB_POOL_MIN - 1; i++) pool.connect().then(c => c.release()).catch(()=>{});
    await autoInitTables();
    // ✅ 关键修复：从数据库加载商店数据到内存（防止重启后数据丢失）
    try {
      const { rows } = await pool.query('SELECT * FROM shops ORDER BY shop_id');
      if (rows.length > 0) {
        bulkLoadShops(rows);
        console.log(`   ↳ 从数据库加载: ${shopStore.totalShops} 家商店`);
      } else {
        console.log('   ↳ 数据库中暂无商店数据（等待 QSFilter 同步）');
      }
    } catch (e) {
      console.error('   ⚠ 从数据库加载商店失败:', e.message);
    }
  }).catch(err => {
    dbStatus.connected = false; dbStatus.lastError = err.message;
    console.error('❌ PostgreSQL 连接失败:', err.message);
  });
}

// === 全局错误抑制与去重 ===
// 防止相同错误消息在短时间内反复刷屏（例如定时任务失败、数据库连接失败等）
const errorDedupWindow = new Map(); // key: 'err_msg', value: lastLogAt
function shouldLogError(msg) {
  const key = String(msg || '').substring(0, 120);
  const now = Date.now();
  const last = errorDedupWindow.get(key);
  if (last && now - last < 30000) return false; // 30 秒内相同消息只记一次
  errorDedupWindow.set(key, now);
  if (errorDedupWindow.size > 500) {
    for (const k of errorDedupWindow.keys()) {
      if (now - errorDedupWindow.get(k) > 60000) errorDedupWindow.delete(k);
      if (errorDedupWindow.size <= 300) break;
    }
  }
  return true;
}
process.on('unhandledRejection', (reason, p) => {
  const msg = reason && reason.message ? reason.message : String(reason);
  if (shouldLogError(msg)) {
    console.error('[UNHANDLED-REJECTION]', msg);
  }
});
process.on('uncaughtException', (err) => {
  const msg = err && err.message ? err.message : String(err);
  if (shouldLogError(msg)) {
    console.error('[UNCAUGHT-EXCEPTION]', msg);
  }
});
tryConnectDB();
setInterval(() => { if (!dbStatus.connected) tryConnectDB(); }, 8000);

// 启动 QSFilterPlugin 同步循环
startQsfilterSyncLoop();

// ============================================================
// 认证
// ============================================================
const sessions = new Map();
function checkAPIAuth(req) {
  if (!CONFIG.API_TOKEN || CONFIG.API_TOKEN.length < 8) return true;
  const t = req.headers['x-api-token'] || req.headers['x-api-key'];
  if (!t || t.length !== CONFIG.API_TOKEN.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(String(t)), Buffer.from(String(CONFIG.API_TOKEN))); }
  catch(e) { return false; }
}
function requireAdmin(req) {
  if (!CONFIG.REQUIRE_AUTH) return true;
  const sid = req.headers['x-session'];
  if (sid && sessions.has(String(sid))) {
    const s = sessions.get(String(sid));
    if (Date.now() < s.expiresAt) {
      // 支持 role: admin / 仅 username === ADMIN_USERNAME 两种模式
      if (s.role === 'admin') return true;
      if (s.username === CONFIG.ADMIN_USERNAME) return true;
    }
  }
  return false;
}

const app = express();

// —— HTTP 请求日志中间件（每条请求都会打印到控制台） ——
app.use((req, res, next) => {
  // 跳过 OPTIONS 与某些静态资源（item/*.png）高频访问日志以减少噪音
  if (req.method === 'OPTIONS') { next(); return; }
  const t0 = Date.now();
  res.on('finish', () => {
    logger.req(req, res.statusCode, Date.now() - t0);
  });
  next();
});

app.use(bodyParser.json({ limit: CONFIG.REQUEST_BODY_LIMIT }));
app.use(bodyParser.urlencoded({ extended: true, limit: CONFIG.REQUEST_BODY_LIMIT }));
app.use((req, res, next) => {
  // 简单 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-token, x-api-key, x-session');
  next();
});

// ============================================================
// 静态资源 + HTTP 缓存头
// ============================================================
app.use(express.static(path.join(__dirname, '.'), {
  maxAge: '10m',        // HTML/CSS/JS: 10min 强缓存
  etag: true,           // ETag: 文件变化自动失效
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'public, max-age=60'); // 1 min
  }
}));

// ============================================================
// 公告系统 (Announcements)
//  - GET /api/announcements: 所有人可访问，返回已发布公告
//  - POST /api/announcements: admin 创建
//  - PUT /api/announcements/:id: admin 编辑
//  - DELETE /api/announcements/:id: admin 删除
// ============================================================

// 公告存储（内存 + 启动时从默认数据初始化，无需额外依赖）
const announcements = new Map(); // id -> {id, title, content, author, createdAt, updatedAt, published, priority}

// 初始化 3 条默认公告
(function initAnnouncements() {
  const defaults = [
    {
      title: '欢迎来到 Qshop 商店系统',
      content: '本站收集 Minecraft 服务器中 QuickShop 插件的商店数据，提供物品价格查询、店主信息、历史趋势等功能。\n\n使用左侧"物品浏览"可查看所有物品汇总数据，"商店浏览"查看各单家商店详情。',
      priority: 'high'
    },
    {
      title: '关于 WebHook 实时同步',
      content: '当 MC 服务器上的 QSFilter 插件正确配置 WebHook URL 后，所有商店新增/删除/价格变动将实时推送到本站。\n\n当前同步状态可在"信息统计"页查看。',
      priority: 'normal'
    },
    {
      title: '管理员公告测试',
      content: '这是一条普通公告，用于测试公告列表展示。\n\n系统时间基于服务器本地时间。',
      priority: 'normal'
    }
  ];
  let i = 0;
  defaults.forEach((a, idx) => {
    const id = 'ann_' + (Date.now() - (defaults.length - idx - 1) * 60000);
    announcements.set(id, {
      id,
      title: a.title,
      content: a.content,
      author: 'system',
      createdAt: Date.now() - (defaults.length - idx - 1) * 3600 * 1000,
      updatedAt: Date.now() - (defaults.length - idx - 1) * 3600 * 1000,
      published: true,
      priority: a.priority || 'normal'
    });
  });
})();

// GET 列表
app.get('/api/announcements', (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    // admin 可以看到所有（包括未发布），普通用户只能看到已发布
    const isAdmin = requireAdmin(req);
    let all = Array.from(announcements.values());
    if (!isAdmin) all = all.filter(a => a.published);
    // 排序: priority (high > normal) -> createdAt desc
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    all.sort((a, b) => {
      const pa = priorityOrder[a.priority] !== undefined ? priorityOrder[a.priority] : 1;
      const pb = priorityOrder[b.priority] !== undefined ? priorityOrder[b.priority] : 1;
      if (pa !== pb) return pa - pb;
      return b.createdAt - a.createdAt;
    });
    res.json({ success: true, total: all.length, results: all, is_admin: isAdmin });
  } catch (e) { respErr(res, 500, '获取公告失败', e); }
});

// POST 创建
app.post('/api/announcements', (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!requireAdmin(req)) return res.status(403).json({ success: false, error: '需要管理员权限' });
    const body = req.body || {};
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    if (!title || title.length > 200) return res.status(400).json({ success: false, error: '标题不能为空且长度需不超过 200' });
    if (!content || content.length > 10000) return res.status(400).json({ success: false, error: '内容不能为空且长度需不超过 10000' });
    const now = Date.now();
    const id = 'ann_' + now + '_' + Math.random().toString(36).slice(2, 8);
    const ann = {
      id,
      title,
      content,
      author: body.author || (sessions.get(String(req.headers['x-session']))?.username) || 'admin',
      createdAt: now,
      updatedAt: now,
      published: body.published === false ? false : true,
      priority: body.priority || 'normal'
    };
    announcements.set(id, ann);
    res.json({ success: true, data: ann });
  } catch (e) { respErr(res, 500, '创建公告失败', e); }
});

// PUT 编辑
app.put('/api/announcements/:id', (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!requireAdmin(req)) return res.status(403).json({ success: false, error: '需要管理员权限' });
    const id = String(req.params.id);
    if (!announcements.has(id)) return res.status(404).json({ success: false, error: '公告不存在' });
    const body = req.body || {};
    const ann = announcements.get(id);
    if (body.title !== undefined) {
      const t = String(body.title).trim();
      if (!t || t.length > 200) return res.status(400).json({ success: false, error: '标题无效' });
      ann.title = t;
    }
    if (body.content !== undefined) {
      const c = String(body.content).trim();
      if (!c || c.length > 10000) return res.status(400).json({ success: false, error: '内容无效' });
      ann.content = c;
    }
    if (body.published !== undefined) ann.published = body.published === false ? false : true;
    if (body.priority !== undefined) ann.priority = String(body.priority);
    ann.updatedAt = Date.now();
    announcements.set(id, ann);
    res.json({ success: true, data: ann });
  } catch (e) { respErr(res, 500, '编辑公告失败', e); }
});

// DELETE 删除
app.delete('/api/announcements/:id', (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!requireAdmin(req)) return res.status(403).json({ success: false, error: '需要管理员权限' });
    const id = String(req.params.id);
    if (!announcements.has(id)) return res.status(404).json({ success: false, error: '公告不存在' });
    announcements.delete(id);
    res.json({ success: true });
  } catch (e) { respErr(res, 500, '删除公告失败', e); }
});

// ============================================================
// /api/shops/top — 首页热点 (最高频, 最需快)
// ============================================================
app.get('/api/shops/top', async (req, res) => {
  const t0 = Date.now();
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    const limit = Math.min(parseInt(req.query.limit) || 12, 100);
    const material = req.query.material ? String(req.query.material).toUpperCase() : null;

    // 从 shopStore 取数据
    let candidates;
    if (material) {
      const ids = shopStore.byMaterial.get(material);
      candidates = ids ? Array.from(ids).map(id => shopStore.shops.get(id)).filter(Boolean) : [];
    } else {
      candidates = Array.from(shopStore.shops.values());
    }
    // 按活跃度/价格排序
    candidates.sort((a, b) => {
      const diff = (Number(b.activity_score) || 0) - (Number(a.activity_score) || 0);
      if (Math.abs(diff) > 0.001) return diff;
      return (Number(a.price) || 0) - (Number(b.price) || 0);
    });
    const results = candidates.slice(0, limit);
    res.setHeader('Cache-Control', 'public, max-age=5');
    res.json({
      success: true,
      source: 'cache',
      qs_available: qsfilterStatus.qs_available,
      results,
      total: results.length,
      last_sync_at: shopStore.lastFullSyncAt,
      last_update_at: shopStore.lastUpdateAt,
      elapsed_ms: Date.now() - t0
    });
  } catch (err) { respErr(res, 500, '操作失败', err); }
});

// ============================================================
// /api/qsfilter/status — QSFilter 连接状态查询
// ============================================================
app.get('/api/qsfilter/status', async (req, res) => {
  try {
    res.json({
      success: true,
      enabled: qsfilterStatus.enabled,
      connected: qsfilterStatus.connected,
      qs_available: qsfilterStatus.qs_available,
      base_url: qsfilterStatus.base_url,
      latency_ms: qsfilterStatus.latency_ms,
      total_requests: qsfilterStatus.total_requests,
      total_errors: qsfilterStatus.total_errors,
      last_success_at: qsfilterStatus.last_success_at,
      last_error: qsfilterStatus.last_error,
      last_error_at: qsfilterStatus.last_error_at,
      last_sync_stats: qsfilterStatus.last_sync_stats,
      polling: {
        interval_sec: Math.floor(qsfilterStatus.polling_interval / 1000),
        last_at: qsfilterStatus.polling_last_at,
        last_count: qsfilterStatus.polling_last_count,
        error_count: qsfilterStatus.polling_error_count
      },
      webhook: {
        enabled: qsfilterStatus.webhook_enabled,
        last_at: qsfilterStatus.webhook_last_at,
        last_event: qsfilterStatus.webhook_last_event,
        event_count: qsfilterStatus.webhook_event_count,
        error_count: qsfilterStatus.webhook_error_count,
        source: qsfilterStatus.webhook_url
      },
      cache: {
        total_shops: shopStore.totalShops,
        selling_shops: shopStore.sellingCount,
        buying_shops: shopStore.buyingCount,
        unique_owners: shopStore.ownersCount,
        unique_worlds: shopStore.worldsCount,
        unique_materials: shopStore.materialsCount,
        last_full_sync_at: shopStore.lastFullSyncAt,
        last_update_at: shopStore.lastUpdateAt
      }
    });
  } catch (err) { respErr(res, 500, '操作失败', err); }
});

// ============================================================
// /api/qsfilter/reconnect — 强制重新连接
// ============================================================
app.post('/api/qsfilter/reconnect', async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ success: false, error: '需要管理员权限' });
  try {
    if (!qsfilterStatus.enabled) {
      return res.json({ success: false, error: 'QSFilterPlugin 未启用 (QSFILTER_ENABLED=false)' });
    }
    // 立即执行健康检查 + 数据同步
    const hc = await qsfilterHealthCheck();
    const sync = await qsfilterSyncFromPlugin();
    res.json({
      success: hc.success && sync.success,
      connected: hc.connected,
      qs_available: hc.qs_available,
      latency_ms: hc.latency_ms,
      last_error: hc.error,
      shop_count: sync.count,
      stats: {
        total: shopStore.totalShops,
        selling: shopStore.sellingCount,
        buying: shopStore.buyingCount,
        materials: shopStore.materialsCount,
        owners: shopStore.ownersCount,
        worlds: shopStore.worldsCount
      }
    });
  } catch (err) { respErr(res, 500, '重连操作失败', err); }
});

// ============================================================
// WebHook 端点 (QSFilterPlugin 在 MC 服务器事件变化时主动推送)
//   插件配置 plugins/QSFilterPlugin/config.yml:
//     webhook:
//       url: "http://<前端服务器IP>:<端口>"
//   事件类型: shop-create / shop-delete / shop-price / shop-type
//   插件异步发送（5 秒超时），返回任意 2xx 视为成功
// ============================================================

// 通用: 读取 POST body 并解析 JSON
function _webhookHandler(eventName) {
  return async (req, res) => {
    try {
      // 诊断日志：记录 webhook 到达时间和来源
      const srcAddr = req.headers['x-forwarded-for'] || (req.connection && req.connection.remoteAddress) || null;
      if (shouldLogError('webhook_' + eventName + '_first')) {
        console.log('[WebHook] 收到事件: ' + eventName + '，来源: ' + srcAddr);
      }

      const body = req.body;
      if (!body || typeof body !== 'object') {
        qsfilterStatus.webhook_error_count++;
        console.error('[WebHook][' + eventName + '] body 格式错误（非 JSON 对象），来源: ' + srcAddr);
        return res.status(400).json({ success: false, error: 'body 必须为 JSON 对象' });
      }

      // 幂等检查：避免重复事件被处理多次
      if (isWebHookDuplicate(eventName, body)) {
        return res.status(200).json({ success: true, event: eventName, note: 'duplicate_ignored', received_at: Date.now() });
      }

      qsfilterStatus.webhook_enabled = true;
      qsfilterStatus.webhook_last_at = Date.now();
      qsfilterStatus.webhook_last_event = eventName;
      qsfilterStatus.webhook_event_count++;
      qsfilterStatus.webhook_url = srcAddr;
      // 记录到请求统计
      recordRequest('/webhook/' + eventName);

      // 根据事件类型处理
      if (eventName === 'shop-create') {
        // body: { shop_id, owner_uuid, owner_name, world, x, y, z, material, item_name, item_id, price, stacking_amount, shop_type, ... }
        upsertShop(body, 'webhook:create');
      } else if (eventName === 'shop-delete') {
        // body: { shop_id }
        if (body.shop_id === undefined || body.shop_id === null) {
          qsfilterStatus.webhook_error_count++;
          return res.status(400).json({ success: false, error: '缺少 shop_id 字段' });
        }
        const ok = deleteShop(body.shop_id);
        if (!ok) {
          // 非关键错误：可能是轮询时还没这条，但没关系
          console.log('[WebHook] shop-delete: shop_id=' + body.shop_id + ' 不在缓存中（可能还没同步）');
        }
      } else if (eventName === 'shop-price') {
        // body: { shop_id, old_price, new_price, shop: {...当前完整数据} }
        if (body.shop && body.shop.shop_id !== undefined) {
          upsertShop(body.shop, 'webhook:price');
        } else if (body.shop_id !== undefined) {
          // 插件只推送了 id + 价格 —— 尝试更新缓存
          const existing = shopStore.shops.get(Number(body.shop_id));
          if (existing) {
            existing.price = body.new_price !== undefined ? body.new_price : existing.price;
            upsertShop(existing, 'webhook:price');
          }
        }
      } else if (eventName === 'shop-type') {
        // body: { shop_id, old_type, new_type, shop: {...} }
        if (body.shop && body.shop.shop_id !== undefined) {
          upsertShop(body.shop, 'webhook:type');
        } else if (body.shop_id !== undefined) {
          const existing = shopStore.shops.get(Number(body.shop_id));
          if (existing) {
            existing.shop_type = body.new_type || existing.shop_type;
            upsertShop(existing, 'webhook:type');
          }
        }
      }

      // 返回 200 —— 插件认为成功
      res.status(200).json({ success: true, event: eventName, received_at: Date.now() });
    } catch (err) {
      qsfilterStatus.webhook_error_count++;
      console.error('[WebHook][' + eventName + '] 处理失败:', err.message);
      res.status(200).json({ success: true, event: eventName, _note: '收到但未处理' });
    }
  };
}

app.post('/webhook/shop-create', _webhookHandler('shop-create'));
app.post('/webhook/shop-delete', _webhookHandler('shop-delete'));
app.post('/webhook/shop-price', _webhookHandler('shop-price'));
app.post('/webhook/shop-type', _webhookHandler('shop-type'));

// 也允许插件直接配置为 /api/webhook/xxx（以防路径歧义）
app.post('/api/webhook/shop-create', _webhookHandler('shop-create'));
app.post('/api/webhook/shop-delete', _webhookHandler('shop-delete'));
app.post('/api/webhook/shop-price', _webhookHandler('shop-price'));
app.post('/api/webhook/shop-type', _webhookHandler('shop-type'));

// ============================================================
// /api/shops/search — 从缓存查询（不再代理到插件）
//   支持: keyword, material, shop_type, owner, world, min_price, max_price,
//         sort (price/ratio/amount/shop_id), page, pageSize, show_all
// ============================================================
app.get('/api/shops/search', async (req, res) => {
  const t0 = Date.now();
  try {
    const keyword = req.query.keyword ? String(req.query.keyword).trim() : '';
    const q = queryShops({
      keyword: keyword,
      material: req.query.material,
      shop_type: req.query.shop_type,
      owner: req.query.owner,
      world: req.query.world,
      min_price: req.query.min_price,
      max_price: req.query.max_price,
      sort: req.query.sort,
      page: req.query.page,
      pageSize: req.query.pageSize,
      show_all: req.query.show_all
    });

    res.status(200).json({
      success: true,
      source: 'cache',
      qs_available: qsfilterStatus.qs_available,
      total: q.total,
      page: q.page,
      limit: q.limit,
      total_pages: q.total_pages,
      shops: q.shops,
      elapsed_ms: Date.now() - t0,
      last_sync_at: shopStore.lastFullSyncAt,
      last_update_at: shopStore.lastUpdateAt
    });
  } catch (err) { respErr(res, 500, '搜索失败', err); }
});

// ============================================================
// /api/price/:item_id — 物品价格查询 (代理到 QSFilterPlugin)
// 返回加权平均价、最低价、最高价、当前上架数量、收购价格等
// ============================================================
app.get('/api/price/:item_id', async (req, res) => {
  const t0 = Date.now();
  try {
    const itemId = String(req.params.item_id).trim();
    if (!itemId) return res.status(400).json({ success: false, error: 'item_id 不能为空' });

    // 从内存缓存聚合统计
    const result = getPriceByItemId(itemId);
    if (!result || !result.current_shop_count || result.current_shop_count === 0) {
      return res.status(200).json({
        success: true,
        note: '该物品暂无商店数据（可能还未同步或物品不存在）',
        item_id: itemId.toLowerCase(),
        material: itemId.toUpperCase(),
        weighted_avg_price: -1,
        current_shop_count: 0,
        selling_shop_count: 0,
        selling_min_price: -1,
        selling_max_price: -1,
        selling_avg_price: -1,
        buying_shop_count: 0,
        buying_min_price: -1,
        buying_max_price: -1,
        buying_avg_price: -1,
        qs_available: qsfilterStatus.qs_available,
        last_sync_at: shopStore.lastFullSyncAt,
        elapsed_ms: Date.now() - t0
      });
    }

    res.status(200).json({
      success: true,
      source: 'cache',
      qs_available: qsfilterStatus.qs_available,
      material: result.material,
      item_id: result.item_id,
      item_name: result.item_name,
      weighted_avg_price: result.weighted_avg_price,
      current_shop_count: result.current_shop_count,
      selling_shop_count: result.selling_shop_count,
      selling_min_price: result.selling_min_price,
      selling_max_price: result.selling_max_price,
      selling_avg_price: result.selling_avg_price,
      buying_shop_count: result.buying_shop_count,
      buying_min_price: result.buying_min_price,
      buying_max_price: result.buying_max_price,
      buying_avg_price: result.buying_avg_price,
      last_sync_at: shopStore.lastFullSyncAt,
      last_update_at: shopStore.lastUpdateAt,
      elapsed_ms: Date.now() - t0
    });
  } catch (err) { respErr(res, 500, '价格查询失败', err); }
});

// ============================================================
// /api/shops — 从缓存查询商店列表（支持筛选 / 排序 / 分页）
//   查询参数: q, material, shop_type, owner, world, min_price, max_price,
//              sort (price_asc | price_desc | ratio | amount | shop_id | newest),
//              page, pageSize, show_all (true=显示所有，默认只显示价格合理的)
// ============================================================
app.get('/api/shops', async (req, res) => {
  const t0 = Date.now();
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });

    const q = queryShops({
      keyword: req.query.q,
      material: req.query.material,
      shop_type: req.query.shop_type,
      owner: req.query.owner,
      world: req.query.world,
      min_price: req.query.min_price,
      max_price: req.query.max_price,
      sort: req.query.sort,
      page: req.query.page,
      pageSize: req.query.pageSize,
      show_all: req.query.show_all
    });

    // —— 增强字段：价格格式化 + 物品中文名称 + 图片路径 ——
    const THRESHOLD_SMALL = 0.01;
    const THRESHOLD_LARGE = 1000000;
    const IMAGE_BASE = 'item'; // 注意：项目目录为 item/ 而不是 items/
    let _errDetect = null;
    const processedShops = q.shops.map(s => {
      // item_id 规范化（与前端 items/{item_id}.png 匹配）
      let itemId = null;
      try {
        itemId = s.item_id
          ? String(s.item_id).toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_:-]/g, '')
          : null;
      } catch (e) { _errDetect = e; itemId = null; }
      if (!itemId && s.material) {
        try { itemId = String(s.material).toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_:-]/g, ''); }
        catch (e) { _errDetect = e; }
      }

      // 物品显示名称（优先 item_name 中文，其次翻译表，最后 material 可读形式）
      let displayName = null;
      try {
        if (s.item_name && String(s.item_name).trim() !== '') {
          const rawName = String(s.item_name).trim();
          // 如果已含中文，直接使用；否则尝试翻译表
          if (/[\u4e00-\u9fa5]/.test(rawName)) {
            displayName = rawName;
          } else {
            displayName = getMaterialCnName(s.material);
          }
        } else if (s.material) {
          displayName = getMaterialCnName(s.material);
        }
      } catch (e) { _errDetect = e; displayName = null; }

      // 价格格式处理（避免溢出）
      let rawPrice = Number(s.price);
      let priceNum = (Number.isFinite(rawPrice) && rawPrice >= 0) ? rawPrice : 0;
      let priceDisplay;
      try {
        if (priceNum === 0) priceDisplay = '0';
        else if (priceNum < THRESHOLD_SMALL) priceDisplay = priceNum.toExponential(2);
        else if (priceNum >= THRESHOLD_LARGE) priceDisplay = priceNum.toExponential(2);
        else priceDisplay = priceNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } catch (e) { _errDetect = e; priceDisplay = String(priceNum); }

      return Object.assign({}, s, {
        shop_cn_name: displayName, // 显示名称（用于卡片标题）
        item_image: itemId ? (IMAGE_BASE + '/' + itemId + '.png') : null,
        price_display: priceDisplay,
        price_raw: priceNum
      });
    });

    res.status(200).json({
      success: true,
      source: 'cache',
      qs_available: qsfilterStatus.qs_available,
      results: processedShops,
      total: q.total,
      page: q.page,
      page_size: q.limit,
      total_pages: q.total_pages,
      last_sync_at: shopStore.lastFullSyncAt,
      last_update_at: shopStore.lastUpdateAt,
      elapsed_ms: Date.now() - t0
    });
  } catch (err) { console.error('/api/shops', err); res.status(500).json({ success: false, error: '操作失败' }); }
});

// ============================================================
// 单个店铺 CRUD
// ============================================================
app.get('/api/shops/:id', async (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    const { rows } = await pool.query('SELECT * FROM shops WHERE shop_id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: '店铺不存在' });
    const r = rows[0];
    r.nbt = r.nbt ? (typeof r.nbt === 'string' ? safeParseJSON(r.nbt, null) : r.nbt) : null;
    r.price_reasonable = r.price_reasonable !== false;
    res.json({ success: true, shop: r });
  } catch (err) { respErr(res, 500, '操作失败', err); }
});

app.post('/api/shops', async (req, res) => {
  const t0 = Date.now();
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!requireAdmin(req)) return res.status(403).json({ success: false, error: '权限不足' });
    let input = req.body; if (!Array.isArray(input)) input = [input];
    if (input.length > CONFIG.MAX_BATCH_SIZE) return res.status(400).json({ success: false, error: '单次最多 ' + CONFIG.MAX_BATCH_SIZE + ' 条' });

    let added = 0, updated = 0;
    for (const entry of input) {
      const shopId = entry.shop_id || ('auto_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
      const data = {
        material: String(entry.material || 'UNKNOWN').toUpperCase(),
        item_name: String(entry.item_name || entry.name || entry.material || 'Unknown'),
        owner_name: String(entry.owner_name || entry.owner || 'Unknown'),
        owner_uuid: entry.owner_uuid || null,
        price: Number(entry.price) || 0,
        stacking_amount: Number(entry.stacking_amount) || 1,
        shop_type: String(entry.shop_type || 'SELLING').toUpperCase() === 'BUYING' ? 'BUYING' : 'SELLING',
        world: String(entry.world || 'world'),
        x: Number(entry.x) || 0, y: Number(entry.y) || 0, z: Number(entry.z) || 0,
        price_reasonable: !(entry.price_reasonable === false || entry.price_reasonable === 0),
        nbt: entry.nbt ? (typeof entry.nbt === 'string' ? entry.nbt : JSON.stringify(entry.nbt)) : null,
        quantity: entry.quantity !== undefined ? Number(entry.quantity) : -1,
        activity_score: Number(entry.activity_score) || 0
      };
      const { rowCount } = await pool.query(`INSERT INTO shops (shop_id, material, item_name, owner_name, owner_uuid, price, stacking_amount, shop_type, world, x, y, z, price_reasonable, nbt, quantity, activity_score)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT (shop_id) DO UPDATE SET material=EXCLUDED.material, item_name=EXCLUDED.item_name, owner_name=EXCLUDED.owner_name, owner_uuid=EXCLUDED.owner_uuid, price=EXCLUDED.price, stacking_amount=EXCLUDED.stacking_amount, shop_type=EXCLUDED.shop_type, world=EXCLUDED.world, x=EXCLUDED.x, y=EXCLUDED.y, z=EXCLUDED.z, price_reasonable=EXCLUDED.price_reasonable, nbt=EXCLUDED.nbt, quantity=EXCLUDED.quantity, activity_score=EXCLUDED.activity_score`,
        [shopId, data.material, data.item_name, data.owner_name, data.owner_uuid, data.price, data.stacking_amount, data.shop_type, data.world, data.x, data.y, data.z, data.price_reasonable, data.nbt, data.quantity, data.activity_score]);
      added++;
    }
    const { rows: tr } = await pool.query('SELECT COUNT(*) AS cnt FROM shops');
    await pool.query("INSERT INTO fetch_log (added, updated, total, source) VALUES ($1,$2,$3,$4)", [added, updated, parseInt(tr[0].cnt), 'api']);
    cacheClearAll();
    res.json({ success: true, added, updated, total: parseInt(tr[0].cnt), elapsed_ms: Date.now() - t0 });
  } catch (err) { respErr(res, 500, '操作失败', err); }
});

app.put('/api/shops/:id', async (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!requireAdmin(req)) return res.status(403).json({ success: false, error: '权限不足' });
    const e = req.body || {};
    await pool.query(`UPDATE shops SET material=$1, item_name=$2, owner_name=$3, owner_uuid=$4, price=$5, stacking_amount=$6, shop_type=$7, world=$8, x=$9, y=$10, z=$11, price_reasonable=$12, nbt=$13, quantity=$14, activity_score=$15 WHERE shop_id=$16`,
      [String(e.material || 'UNKNOWN').toUpperCase(), String(e.item_name || e.name || 'Unknown'), String(e.owner_name || e.owner || 'Unknown'), e.owner_uuid || null,
       Number(e.price) || 0, Number(e.stacking_amount) || 1, String(e.shop_type || 'SELLING').toUpperCase() === 'BUYING' ? 'BUYING' : 'SELLING',
       String(e.world || 'world'), Number(e.x) || 0, Number(e.y) || 0, Number(e.z) || 0,
       !(e.price_reasonable === false || e.price_reasonable === 0),
       e.nbt ? (typeof e.nbt === 'string' ? e.nbt : JSON.stringify(e.nbt)) : null,
       e.quantity !== undefined ? Number(e.quantity) : -1, Number(e.activity_score) || 0, req.params.id]);
    cacheClearAll();
    res.json({ success: true });
  } catch (err) { respErr(res, 500, '操作失败', err); }
});

app.delete('/api/shops/:id', async (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!requireAdmin(req)) return res.status(403).json({ success: false, error: '权限不足' });
    const r = await pool.query('DELETE FROM shops WHERE shop_id = $1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ success: false, error: '店铺不存在' });
    cacheClearAll();
    res.json({ success: true, deleted: r.rowCount });
  } catch (err) { respErr(res, 500, '操作失败', err); }
});

app.delete('/api/shops', async (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!requireAdmin(req)) return res.status(403).json({ success: false, error: '权限不足' });
    const { confirm } = req.body || {};
    if (!confirm) return res.status(400).json({ success: false, error: '必须设置 confirm: true' });
    const { rows } = await pool.query('SELECT COUNT(*) AS cnt FROM shops');
    await pool.query('TRUNCATE TABLE shops RESTART IDENTITY');
    try { await pool.query('TRUNCATE TABLE activity RESTART IDENTITY'); } catch(e){}
    cacheClearAll();
    res.json({ success: true, cleared: parseInt(rows[0].cnt) });
  } catch (err) { respErr(res, 500, '操作失败', err); }
});

// ============================================================
// /api/shops/seed — 批量生成测试数据 + 强制终止
// ============================================================
const seedRuntime = {
  isRunning: false, shouldStop: false, cancelled: false,
  terminated: false, progress: 0, inserted: 0, total: 0,
  startedAt: null, endedAt: null, lastMessage: '',
  lastInsertId: '' // 用于追踪最后一个 seed 前缀，清理
};

function getClientIP(req) {
  const f = req.headers['x-forwarded-for'];
  if (f) return (Array.isArray(f) ? f[0] : String(f).split(',')[0]).trim();
  return (req.connection && req.connection.remoteAddress) || req.ip || 'unknown';
}

async function getSessionUsername(req) {
  const sid = req.headers['x-session'];
  if (sessions.has(String(sid))) return sessions.get(String(sid)).username;
  // 尝试从数据库 sessions 表查
  if (sid) {
    try {
      const r = await pool.query("SELECT username FROM sessions WHERE session_id = $1 AND expires_at > NOW() LIMIT 1", [String(sid)]);
      if (r.rows.length > 0) return r.rows[0].username;
    } catch (e) { /* ignore */ }
  }
  return null;
}

app.post('/api/shops/seed', async (req, res) => {
  const t0 = Date.now();
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!requireAdmin(req)) return res.status(403).json({ success: false, error: '权限不足' });
    if (seedRuntime.isRunning) return res.status(429).json({ success: false, error: '已有批量任务进行中' });

    seedRuntime.isRunning = true;
    seedRuntime.shouldStop = false;
    seedRuntime.cancelled = false;
    seedRuntime.terminated = false;
    seedRuntime.progress = 0;
    seedRuntime.inserted = 0;
    seedRuntime.startedAt = new Date();
    seedRuntime.endedAt = null;

    let requested = parseInt(req.body.count);
    if (!requested || isNaN(requested) || requested <= 0) requested = 1000000;
    if (requested > CONFIG.MAX_BATCH_SIZE) {
      seedRuntime.isRunning = false;
      return res.status(400).json({ success: false, error: '单次数量超出限制 (最大 ' + CONFIG.MAX_BATCH_SIZE + ')' });
    }
    const count = requested;
    seedRuntime.total = count;
    const mode = req.body.mode || 'append';
    const seedPrefix = 'seed_' + Date.now().toString(36);
    seedRuntime.lastInsertId = seedPrefix;

    const sessionId = req.headers['x-session'] || 'anonymous';
    const username = await getSessionUsername(req) || sessionId;
    const clientIP = getClientIP(req);

    const materials = ['DIAMOND_SWORD','DIAMOND_PICKAXE','IRON_INGOT','GOLD_INGOT','COBBLESTONE','STONE','DIRT','GRASS_BLOCK','SAND','GRAVEL','DIAMOND','EMERALD','LAPIS_LAZULI','REDSTONE','COAL','OBSIDIAN','ENDER_PEARL'];
    const owners = ['Alex','Steve','MineLord','方块王','钻石女王','附魔师','Notch','红石工坊','CraftMaster','BuilderPro','MinerJoe','铁匠老王'];
    const worlds = ['world','world_nether','world_the_end'];
    const types = ['SELLING','BUYING'];
    const stacking = [1,8,16,32,64];

    if (mode === 'replace') {
      try { await pool.query('TRUNCATE TABLE shops RESTART IDENTITY'); } catch(e) { await pool.query('DELETE FROM shops'); }
      try { await pool.query('TRUNCATE TABLE activity RESTART IDENTITY'); } catch(e) {}
    }

    const BATCH = count > 500000 ? 5000 : count > 100000 ? 4000 : count > 10000 ? 2000 : 500;
    let inserted = 0;
    let stoppedAfterInsert = 0;

    const ac = new AbortController();
    for (let start = 0; start < count; start += BATCH) {
      if (seedRuntime.shouldStop) {
        seedRuntime.cancelled = true;
        stoppedAfterInsert = inserted;
        break;
      }
      const end = Math.min(start + BATCH, count);
      const batchSize = end - start;
      const ph = []; const params = []; let p = 1;
      for (let bi = 0; bi < batchSize; bi++) {
        ph.push(`($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`);
        const mat = materials[(Math.random()*materials.length)|0];
        const owner = owners[(Math.random()*owners.length)|0];
        params.push(seedPrefix + '_' + start + '_' + bi,
          mat, mat.replace(/_/g,' ').toLowerCase(), owner, null,
          Math.round((Math.random()*498+2)*100)/100,
          stacking[(Math.random()*5)|0],
          types[(Math.random()*2)|0], worlds[(Math.random()*3)|0],
          ((Math.random()-0.5)*20000)|0, ((Math.random()*200)|0)+10, ((Math.random()-0.5)*20000)|0,
          Math.random() > 0.05, null, Math.random() > 0.1 ? -1 : ((Math.random()*5000)|0)+1,
          (Math.random()*200)|0);
      }
      const sql = `INSERT INTO shops (shop_id, material, item_name, owner_name, owner_uuid, price, stacking_amount, shop_type, world, x, y, z, price_reasonable, nbt, quantity, activity_score) VALUES ${ph.join(',')} ON CONFLICT (shop_id) DO NOTHING`;
      try {
        await pool.query(sql, params);
        inserted += batchSize;
        seedRuntime.inserted = inserted;
        seedRuntime.progress = Math.min(99, Math.round((end/count)*100));
      } catch(e) { console.warn('[SEED]', e.message); }
      await new Promise(r => setTimeout(r, 0));
    }

    const elapsed = Date.now() - t0;
    seedRuntime.progress = seedRuntime.cancelled ? Math.min(99, seedRuntime.progress) : 100;
    seedRuntime.isRunning = false;
    seedRuntime.shouldStop = false;
    seedRuntime.endedAt = new Date();
    cacheClearAll();

    try {
      await pool.query(
        "INSERT INTO seed_audit (session_id, username, ip, action, target_count, inserted_count, status, elapsed_ms, message) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [String(sessionId), username, clientIP,
          seedRuntime.terminated ? 'terminate' : (seedRuntime.cancelled ? 'cancel' : 'seed'),
          count, inserted,
          seedRuntime.terminated ? 'terminated' : (seedRuntime.cancelled ? 'cancelled' : 'success'),
          elapsed,
          seedRuntime.terminated ? '已强制终止并清理数据' : '']
      );
    } catch (e) {}
    writeAuditLog('seed', { action: seedRuntime.terminated ? 'terminate' : (seedRuntime.cancelled ? 'cancel' : 'seed'), count, inserted: inserted, elapsed_ms: elapsed, user: username, ip: clientIP });

    if (seedRuntime.terminated) {
      return res.json({ success: true, inserted, count, mode, terminated: true, cancelled: true, elapsed_ms: elapsed });
    }
    if (seedRuntime.cancelled) {
      return res.json({ success: true, inserted, count, mode, cancelled: true, stopped_at: stoppedAfterInsert, elapsed_ms: elapsed });
    }
    res.json({ success: true, inserted, count, mode, elapsed_ms: elapsed });
  } catch(err) {
    seedRuntime.isRunning = false;
    seedRuntime.shouldStop = false;
    respErr(res, 500, '操作失败', err);
  }
});

// === 强制终止 + 清理所有 seed 生成数据 (事务保证原子性) ===
app.post('/api/shops/seed/terminate', async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ success: false, error: '权限不足' });
  const t0 = Date.now();
  const wasRunning = seedRuntime.isRunning;
  const clientIP = getClientIP(req);
  const sessionId = req.headers['x-session'] || 'anonymous';
  const username = (await getSessionUsername(req)) || sessionId;

  // 先设置终止标志
  seedRuntime.shouldStop = true;
  seedRuntime.terminated = true;

  let deletedCount = 0;
  try {
    // 等待正在执行的批次结束
    let wait = 0;
    while (seedRuntime.isRunning && wait < 5000) {
      await new Promise(r => setTimeout(r, 100));
      wait += 100;
    }

    // === 事务: 清理所有与 seed 相关的商店数据 + activity ===
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // 查找 seed_ 前缀产生的数据
      const prefix = seedRuntime.lastInsertId && seedRuntime.lastInsertId.length > 0
        ? seedRuntime.lastInsertId.substring(0, seedRuntime.lastInsertId.lastIndexOf('_') || 5)
        : 'seed_';
      const { rows: c1 } = await client.query("SELECT COUNT(*) AS c FROM shops WHERE shop_id LIKE 'seed_%'");
      const target = parseInt(c1[0].c) || 0;
      await client.query("DELETE FROM shops WHERE shop_id LIKE 'seed_%'");
      await client.query("DELETE FROM activity WHERE material IN (SELECT DISTINCT material FROM shops WHERE shop_id LIKE 'seed_%')");
      deletedCount = target;
      await client.query('COMMIT');
    } catch (txErr) {
      try { await client.query('ROLLBACK'); } catch (r) {}
      throw txErr;
    } finally { client.release(); }

    cacheClearAll();
    seedRuntime.progress = 0;
    seedRuntime.inserted = 0;
    seedRuntime.isRunning = false;

    try {
      await pool.query(
        "INSERT INTO seed_audit (session_id, username, ip, action, target_count, inserted_count, status, elapsed_ms, message) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [String(sessionId), username, clientIP, 'terminate', deletedCount, deletedCount, 'success', Date.now() - t0, '已清理 ' + deletedCount + ' 条 seed 数据']
      );
    } catch (e) {}
    writeAuditLog('seed_terminate', { user: username, ip: clientIP, deleted: deletedCount, elapsed_ms: Date.now() - t0 });

    res.json({
      success: true,
      terminated: true,
      was_running: wasRunning,
      deleted: deletedCount,
      elapsed_ms: Date.now() - t0,
      message: '批量任务已终止，已清理 ' + deletedCount + ' 条 seed 生成数据'
    });
  } catch (err) {
    seedRuntime.isRunning = false;
    respErr(res, 500, '终止失败: ' + (err.message || err), err);
  }
});

app.get('/api/shops/seed/progress', (req, res) => {
  res.json({
    running: seedRuntime.isRunning,
    progress: seedRuntime.progress,
    inserted: seedRuntime.inserted,
    total: seedRuntime.total,
    cancelled: seedRuntime.cancelled,
    terminated: seedRuntime.terminated,
    started_at: seedRuntime.startedAt,
    message: seedRuntime.lastMessage
  });
});

// ============================================================
// 材料 / 所有者 / 世界 / 港口
// ============================================================
app.get('/api/materials', async (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!dbStatus.connected) return res.json({ success: true, materials: [], total: 0 });
    const cached = cacheGet('materials:v1');
    if (cached) return res.json({ success: true, materials: cached, total: cached.length, cached: true });
    const { rows } = await pool.query(`SELECT material, COUNT(*) AS shops, COALESCE(SUM(activity_score),0) AS activity FROM shops GROUP BY material ORDER BY shops DESC LIMIT 500`);
    cacheSet('materials:v1', rows, CONFIG.CACHE_TTL_MATERIALS);
    res.json({ success: true, materials: rows, total: rows.length });
  } catch(err){ respErr(res, 500, '操作失败', err); }
});
app.get('/api/owners', async (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!dbStatus.connected) return res.json({ success: true, owners: [] });
    const cached = cacheGet('owners:v1');
    if (cached) return res.json({ success: true, owners: cached, cached: true });
    const { rows } = await pool.query('SELECT owner_name, COUNT(*) AS shops FROM shops GROUP BY owner_name ORDER BY shops DESC LIMIT 500');
    cacheSet('owners:v1', rows, CONFIG.CACHE_TTL_OWNERS);
    res.json({ success: true, owners: rows });
  } catch(err){ respErr(res, 500, '操作失败', err); }
});
app.get('/api/worlds', async (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!dbStatus.connected) return res.json({ success: true, worlds: [] });
    const cached = cacheGet('worlds:v1');
    if (cached) return res.json({ success: true, worlds: cached, cached: true });
    const { rows } = await pool.query('SELECT world, COUNT(*) AS shops FROM shops GROUP BY world ORDER BY shops DESC');
    cacheSet('worlds:v1', rows, CONFIG.CACHE_TTL_WORLDS);
    res.json({ success: true, worlds: rows });
  } catch(err){ respErr(res, 500, '操作失败', err); }
});
app.get('/api/harbor', async (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!dbStatus.connected) return res.json({ success: true, harbor: { world: 'world', x: 0, y: 64, z: 0 } });
    const { rows } = await pool.query('SELECT world, x, y, z FROM harbor LIMIT 1');
    res.json({ success: true, harbor: rows[0] || { world: 'world', x: 0, y: 64, z: 0 } });
  } catch(err){ res.json({ success: true, harbor: { world: 'world', x: 0, y: 64, z: 0 } }); }
});
app.put('/api/harbor', async (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!requireAdmin(req)) return res.status(403).json({ success: false, error: '权限不足' });
    const { world = 'world', x = 0, y = 64, z = 0 } = req.body;
    const r = await pool.query('UPDATE harbor SET world=$1,x=$2,y=$3,z=$4 WHERE id=1', [world, x, y, z]);
    if (r.rowCount === 0) await pool.query('INSERT INTO harbor (world,x,y,z) VALUES ($1,$2,$3,$4)', [world, x, y, z]);
    cacheClearAll();
    res.json({ success: true, harbor: { world, x, y, z } });
  } catch(err){ respErr(res, 500, '操作失败', err); }
});

// ============================================================
// /api/items — 物品堆叠聚合列表 (分页 + 搜索 + 筛选 + 排序)
// 每个物品聚合为 1 行：总商店数、店主数、世界数、价格区间、SELLING/BUYING 数量、活跃度
// 数据来源: shopStore 内存缓存（由定时轮询 / WebHook 实时更新）
// ============================================================
app.get('/api/items', async (req, res) => {
  const t0 = Date.now();
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });

    const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
    const shop_type = req.query.shop_type ? String(req.query.shop_type).toUpperCase() : null;
    const world = req.query.world ? String(req.query.world).trim() : null;
    logger.info('GET /api/items — 查询:' + (q || '(空)') + ', shop_type:' + (shop_type || 'ALL') + ', world:' + (world || 'ALL'));
    const min_price = (req.query.min_price !== undefined && req.query.min_price !== '' && !isNaN(Number(req.query.min_price))) ? Number(req.query.min_price) : null;
    const max_price = (req.query.max_price !== undefined && req.query.max_price !== '' && !isNaN(Number(req.query.max_price))) ? Number(req.query.max_price) : null;
    const sort = req.query.sort || 'shops_desc';
    const pageNum = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(parseInt(req.query.pageSize) || 30, 200);

    // 从 shopStore 取出所有 material 并聚合
    const aggregates = new Map();  // material -> agg object
    shopStore.shops.forEach((shop, _id) => {
      // 过滤
      if (shop_type && shop.shop_type !== shop_type) return;
      if (world && (!shop.world || String(shop.world).toLowerCase().indexOf(world.toLowerCase()) < 0)) return;
      if (q && q.length >= 2) {
        const inMaterial = (shop.material || '').toLowerCase().indexOf(q) >= 0;
        const inName = (shop.item_name || '').toLowerCase().indexOf(q) >= 0;
        const inOwner = (shop.owner_name || '').toLowerCase().indexOf(q) >= 0;
        if (!inMaterial && !inName && !inOwner) return;
      }
      const price = Number(shop.price) || 0;

      let agg = aggregates.get(shop.material);
      if (!agg) {
        agg = {
          material: shop.material,
          item_name: shop.item_name || shop.material,
          total_shops: 0,
          owners: new Set(),
          worlds: new Set(),
          selling_shops: 0,
          buying_shops: 0,
          selling_prices: [],
          buying_prices: [],
          total_activity: 0
        };
        aggregates.set(shop.material, agg);
      }
      agg.total_shops++;
      if (shop.owner_name) agg.owners.add(shop.owner_name);
      if (shop.world) agg.worlds.add(shop.world);
      if (shop.shop_type === 'SELLING') {
        agg.selling_shops++;
        agg.selling_prices.push(price);
      } else if (shop.shop_type === 'BUYING') {
        agg.buying_shops++;
        agg.buying_prices.push(price);
      }
      agg.total_activity += (Number(shop.activity_score) || 0);
    });

    let items = Array.from(aggregates.values()).map(agg => {
      const minSell = agg.selling_prices.length > 0 ? Math.min(...agg.selling_prices) : null;
      const maxSell = agg.selling_prices.length > 0 ? Math.max(...agg.selling_prices) : null;
      const avgSell = agg.selling_prices.length > 0
        ? Number((agg.selling_prices.reduce((a, b) => a + b, 0) / agg.selling_prices.length).toFixed(2))
        : null;
      const minBuy = agg.buying_prices.length > 0 ? Math.min(...agg.buying_prices) : null;
      const maxBuy = agg.buying_prices.length > 0 ? Math.max(...agg.buying_prices) : null;
      const avgBuy = agg.buying_prices.length > 0
        ? Number((agg.buying_prices.reduce((a, b) => a + b, 0) / agg.buying_prices.length).toFixed(2))
        : null;
      // 物品图片路径：item/<lowercase_material>.png
      const imageName = agg.material
        ? String(agg.material).toLowerCase().replace(/[^a-z0-9_-]/g, '')
        : null;
      // 中文名称：优先 item_name（非英文），其次用翻译表，最后 material 可读形式
      let cnName = null;
      if (agg.item_name && agg.item_name !== agg.material) {
        const cn = /[\u4e00-\u9fa5]/.test(agg.item_name);
        cnName = cn ? agg.item_name : getMaterialCnName(agg.material);
      } else {
        cnName = getMaterialCnName(agg.material);
      }
      // 价格显示：千分位 + 2 位小数
      let priceDisplay = null;
      if (avgSell != null && !isNaN(avgSell)) {
        try { priceDisplay = Number(avgSell).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
        catch (e) { priceDisplay = Number(avgSell).toFixed(2); }
      }
      return {
        material: agg.material,
        item_name: agg.item_name,
        shop_cn_name: cnName,                // 显示名称（中文优先）
        item_image: imageName ? 'item/' + imageName + '.png' : null, // 物品贴图
        price_display: priceDisplay,         // 格式化后的均价
        total_shops: agg.total_shops,
        owner_count: agg.owners.size,
        world_count: agg.worlds.size,
        selling_shops: agg.selling_shops,
        buying_shops: agg.buying_shops,
        avg_price: avgSell,
        min_price: minSell,
        max_price: maxSell,
        avg_sell_price: avgSell,
        min_sell_price: minSell,
        max_sell_price: maxSell,
        avg_buy_price: avgBuy,
        min_buy_price: minBuy,
        max_buy_price: maxBuy,
        total_activity: agg.total_activity
      };
    });

    // price 区间过滤 (在聚合完成后应用)
    if (min_price !== null) items = items.filter(i => i.min_price !== null && i.min_price >= min_price);
    if (max_price !== null) items = items.filter(i => i.max_price !== null && i.max_price <= max_price);

    // 排序
    switch (sort) {
      case 'price_asc':  items.sort((a, b) => (a.avg_price || 0) - (b.avg_price || 0)); break;
      case 'price_desc': items.sort((a, b) => (b.avg_price || 0) - (a.avg_price || 0)); break;
      case 'shops_asc':  items.sort((a, b) => a.total_shops - b.total_shops); break;
      case 'shops_desc': items.sort((a, b) => b.total_shops - a.total_shops); break;
      case 'owners_desc':items.sort((a, b) => b.owner_count - a.owner_count); break;
      case 'activity_desc': items.sort((a, b) => b.total_activity - a.total_activity); break;
      case 'name_asc':   items.sort((a, b) => (a.material || '').localeCompare(b.material || '')); break;
      case 'name_desc':  items.sort((a, b) => (b.material || '').localeCompare(a.material || '')); break;
      default:           items.sort((a, b) => b.total_shops - a.total_shops);
    }

    const total = items.length;
    const startIdx = (pageNum - 1) * pageSize;
    const pageItems = items.slice(startIdx, startIdx + pageSize);
    logger.info('GET /api/items — 返回 ' + pageItems.length + ' / 共 ' + total + ' 条，耗时 ' + (Date.now() - t0) + 'ms');

    res.status(200).json({
      success: true,
      source: 'cache',
      qs_available: qsfilterStatus.qs_available,
      results: pageItems,
      total,
      page: pageNum,
      page_size: pageSize,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
      last_sync_at: shopStore.lastFullSyncAt,
      last_update_at: shopStore.lastUpdateAt,
      elapsed_ms: Date.now() - t0
    });
  } catch(err){ respErr(res, 500, '操作失败', err); }
});

// ============================================================
// /api/items/:material — 物品详情页：所有该物品的商店 (分页 + 筛选 + 排序)
// 顶部返回聚合统计；同时提供 /api/price/:item_id 的调用作为更详细的价格数据
// ============================================================
app.get('/api/items/:material', async (req, res) => {
  const t0 = Date.now();
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });

    const material = String(req.params.material).trim();
    const matUpper = material.toUpperCase();
    const matLower = material.toLowerCase();
    logger.info('GET /api/items/:material — ' + matUpper + ' (' + (getMaterialCnName(matUpper) || '') + ')');

    const shop_type = req.query.shop_type ? String(req.query.shop_type).toUpperCase() : null;
    const world = req.query.world ? String(req.query.world).trim() : null;
    const owner = req.query.owner ? String(req.query.owner).trim() : null;
    const min_price = (req.query.min_price !== undefined && req.query.min_price !== '' && !isNaN(Number(req.query.min_price))) ? Number(req.query.min_price) : null;
    const max_price = (req.query.max_price !== undefined && req.query.max_price !== '' && !isNaN(Number(req.query.max_price))) ? Number(req.query.max_price) : null;
    const sort = req.query.sort || 'price_asc';
    const pageNum = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(parseInt(req.query.pageSize) || 25, 500);

    // 先从缓存取与物品相关的商店
    let ids = shopStore.byMaterial.get(matUpper) || new Set();
    // 兼容小写查询：可能用户按 item_name 搜
    if (ids.size === 0) {
      for (const [m, setIds] of shopStore.byMaterial.entries()) {
        if (m && m.toLowerCase() === matLower) { ids = setIds; break; }
      }
    }
    // 再兼容 item_id
    if (ids.size === 0) {
      for (const [idKey, setIds] of shopStore.byItemId.entries()) {
        if (idKey && idKey.toLowerCase() === matLower) { ids = setIds; break; }
      }
    }

    // 过滤和收集
    const shops = [];
    const owners = new Set();
    const worlds = new Set();
    let sellingShops = 0, buyingShops = 0;
    const sellPrices = [], buyPrices = [];

    ids.forEach(id => {
      const s = shopStore.shops.get(id);
      if (!s) return;
      if (shop_type && s.shop_type !== shop_type) return;
      if (world && (!s.world || String(s.world).toLowerCase().indexOf(world.toLowerCase()) < 0)) return;
      if (owner && (!s.owner_name || String(s.owner_name).toLowerCase().indexOf(owner.toLowerCase()) < 0)) return;
      const p = Number(s.price) || 0;
      if (min_price !== null && p < min_price) return;
      if (max_price !== null && p > max_price) return;
      shops.push(s);
      if (s.owner_name) owners.add(s.owner_name);
      if (s.world) worlds.add(s.world);
      if (s.shop_type === 'SELLING') { sellingShops++; sellPrices.push(p); }
      if (s.shop_type === 'BUYING')  { buyingShops++;  buyPrices.push(p); }
    });

    // 排序
    switch (sort) {
      case 'price_asc':     shops.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0)); break;
      case 'price_desc':    shops.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0)); break;
      case 'owner_asc':     shops.sort((a, b) => (a.owner_name || '').localeCompare(b.owner_name || '')); break;
      case 'activity_desc': shops.sort((a, b) => (Number(b.activity_score) || 0) - (Number(a.activity_score) || 0)); break;
      case 'quantity_desc': shops.sort((a, b) => {
        // null/空/负数 → -Infinity（排在最后）；正数 → 实际数值
        const qa = (a.quantity === null || a.quantity === undefined || a.quantity === '' || Number(a.quantity) < 0) ? -Infinity : Number(a.quantity);
        const qb = (b.quantity === null || b.quantity === undefined || b.quantity === '' || Number(b.quantity) < 0) ? -Infinity : Number(b.quantity);
        return qb - qa;
      }); break;
      case 'world_asc':     shops.sort((a, b) => (a.world || '').localeCompare(b.world || '')); break;
      case 'newest':        shops.sort((a, b) => new Date(b.fetched_at || 0) - new Date(a.fetched_at || 0)); break;
    }

    const total = shops.length;
    const startIdx = (pageNum - 1) * pageSize;
    const rawPageShops = shops.slice(startIdx, startIdx + pageSize);

    // 对每家商店添加显示增强字段
    const pageShops = rawPageShops.map(s => {
      const rawPrice = Number(s.price);
      const priceNum = Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : 0;
      let priceDisplay;
      try {
        if (priceNum >= 1000000 || priceNum < 0.01 && priceNum > 0) {
          priceDisplay = priceNum.toExponential(2);
        } else {
          priceDisplay = priceNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
      } catch (e) { priceDisplay = priceNum.toFixed(2); }
      const imageName = s.material
        ? String(s.material).toLowerCase().replace(/[^a-z0-9_-]/g, '')
        : null;
      // —— 库存语义字段（关键修复: 区分系统商店 & 玩家商店 & 未设置）——
      // 系统商店 (is_system_shop=true): 始终显示无限
      // 玩家商店: quantity=null → 显示 "—"（未设置）；quantity=正数 → 显示实际数值
      let qNum = null;
      let isInfinite = false;
      let isLowStock = false;
      let stockText = '';
      let stockLabel = s.shop_type === 'BUYING' ? '收购量' : '库存量';

      if (s.is_system_shop) {
        qNum = -1;
        isInfinite = true;
        stockText = '无限';
      } else {
        // quantity 为 null/undefined/空 → 未设置（不伪造默认值）
        if (s.quantity === null || s.quantity === undefined || s.quantity === '') {
          qNum = null;
          stockText = '—';
        } else {
          const n = Number(s.quantity);
          if (Number.isFinite(n) && n >= 0) {
            qNum = Math.floor(n);
            stockText = String(qNum);
            isLowStock = qNum <= Number(CONFIG.PLAYER_SHOP_LOW_STOCK_THRESHOLD);
          } else {
            qNum = null;
            stockText = '—';
          }
        }
        isInfinite = false;
      }

      // 中文名称：优先 item_name（含中文），否则翻译表
      let cnName = getMaterialCnName(s.material) || null;
      if (s.item_name && /[\u4e00-\u9fa5]/.test(s.item_name)) cnName = s.item_name;

      return Object.assign({}, s, {
        shop_cn_name: cnName,
        item_image: imageName ? 'item/' + imageName + '.png' : null,
        price_display: priceDisplay,
        price_raw: priceNum,
        quantity_num: qNum,
        is_infinite: isInfinite,
        is_low_stock: isLowStock,
        stock_text: stockText,
        stock_label: stockLabel,
        is_system_shop: Boolean(s.is_system_shop),
        max_buy_quantity: s.max_buy_quantity || Number(CONFIG.PLAYER_SHOP_MAX_BUY),
        max_stock_capacity: s.max_stock_capacity || Number(CONFIG.PLAYER_SHOP_MAX_STOCK)
      });
    });

    const firstMat = shops[0] ? shops[0].material : matUpper;
    const firstItemName = shops[0] ? (shops[0].item_name || shops[0].material) : matUpper;
    const itemCnName = getMaterialCnName(firstMat);
    logger.info('GET /api/items/:material — ' + firstMat + '，total=' + total + ' shops，selling=' + sellingShops + '/buying=' + buyingShops);

    const avgSell = sellPrices.length > 0 ? Number((sellPrices.reduce((a, b) => a + b, 0) / sellPrices.length).toFixed(2)) : null;
    const minSell = sellPrices.length > 0 ? Math.min(...sellPrices) : null;
    const maxSell = sellPrices.length > 0 ? Math.max(...sellPrices) : null;
    const avgBuy = buyPrices.length > 0 ? Number((buyPrices.reduce((a, b) => a + b, 0) / buyPrices.length).toFixed(2)) : null;
    const minBuy = buyPrices.length > 0 ? Math.min(...buyPrices) : null;
    const maxBuy = buyPrices.length > 0 ? Math.max(...buyPrices) : null;

    res.status(200).json({
      success: true,
      source: 'cache',
      qs_available: qsfilterStatus.qs_available,
      material: firstMat,
      item_name: firstItemName,
      shop_cn_name: itemCnName,
      stats: {
        total_shops: total,
        owner_count: owners.size,
        world_count: worlds.size,
        selling_shops: sellingShops,
        buying_shops: buyingShops,
        avg_sell_price: avgSell,
        min_sell_price: minSell,
        max_sell_price: maxSell,
        avg_buy_price: avgBuy,
        min_buy_price: minBuy,
        max_buy_price: maxBuy,
        total_activity: shops.reduce((sum, s) => sum + (Number(s.activity_score) || 0), 0)
      },
      shops: pageShops,
      total,
      page: pageNum,
      page_size: pageSize,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
      last_sync_at: shopStore.lastFullSyncAt,
      last_update_at: shopStore.lastUpdateAt,
      elapsed_ms: Date.now() - t0
    });
  } catch(err){ respErr(res, 500, '操作失败', err); }
});

// ============================================================
// /api/stats — 统计 (数据来源: shopStore 内存缓存)
// ============================================================
app.get('/api/stats', async (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    const materials = shopStore.byMaterial.size;
    let totalActivity = 0;
    shopStore.shops.forEach(s => { totalActivity += (Number(s.activity_score) || 0); });
    const stats = {
      total_shops: shopStore.totalShops,
      total_materials: shopStore.materialsCount || materials,
      total_owners: shopStore.ownersCount || shopStore.byOwner.size,
      total_worlds: shopStore.worldsCount || shopStore.byWorld.size,
      total_requests: qsfilterStatus.total_requests,
      total_activity: totalActivity,
      selling_shops: shopStore.sellingCount,
      buying_shops: shopStore.buyingCount
    };
    res.json({
      success: true,
      source: 'cache',
      qs_available: qsfilterStatus.qs_available,
      stats,
      last_sync_at: shopStore.lastFullSyncAt,
      last_update_at: shopStore.lastUpdateAt
    });
  } catch(err){ respErr(res, 500, '操作失败', err); }
});

// ============================================================
// /api/log / /api/activity
// ============================================================
app.get('/api/log', async (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!dbStatus.connected) return res.json({ success: true, logs: [] });
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const { rows } = await pool.query('SELECT * FROM fetch_log ORDER BY time DESC LIMIT $1', [limit]);
    res.json({ success: true, logs: rows });
  } catch(err){ respErr(res, 500, '操作失败', err); }
});

app.put('/api/activity/:material', (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    const mat = String(req.params.material).toUpperCase();
    recordActivity(mat); // 放入内存 buffer, 每 10s flush
    res.json({ success: true, material: mat });
  } catch(err){ respErr(res, 500, '操作失败', err); }
});

app.get('/api/activity', async (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!dbStatus.connected) return res.json({ success: true, activity: [] });
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const { rows } = await pool.query('SELECT * FROM activity ORDER BY views DESC LIMIT $1', [limit]);
    res.json({ success: true, activity: rows });
  } catch(err){ respErr(res, 500, '操作失败', err); }
});

// ============================================================
// /api/settings
// ============================================================
app.get('/api/settings', async (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!dbStatus.connected) return res.json({ success: true, settings: {} });
    const { rows } = await pool.query('SELECT setting_key, setting_value, setting_type, description, is_protected FROM settings ORDER BY setting_key');
    const settings = {};
    for (const row of rows) {
      const key = String(row.setting_key).toLowerCase();
      const isProtected = row.is_protected === true || key.includes('password') || key.includes('token') || key.includes('secret');
      if (isProtected) settings[row.setting_key] = { value: '******', type: row.setting_type, description: row.description, protected: true };
      else settings[row.setting_key] = { value: castSettingValue(row.setting_value, row.setting_type), type: row.setting_type, description: row.description, protected: false };
    }
    res.json({ success: true, settings, total: Object.keys(settings).length });
  } catch(err){ respErr(res, 500, '操作失败', err); }
});
app.put('/api/settings', async (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!requireAdmin(req)) return res.status(403).json({ success: false, error: '权限不足' });
    const updates = req.body; if (!updates || typeof updates !== 'object') return res.status(400).json({ success: false, error: '请求体必须是对象' });
    let updated = 0;
    for (const key in updates) {
      if (!updates.hasOwnProperty(key)) continue;
      const val = updates[key];
      const type = typeof val === 'number' ? 'number' : typeof val === 'boolean' ? 'boolean' : 'string';
      const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      await pool.query("INSERT INTO settings (setting_key, setting_value, setting_type) VALUES ($1,$2,$3) ON CONFLICT (setting_key) DO UPDATE SET setting_value=$2, setting_type=$3, updated_at=CURRENT_TIMESTAMP", [key, strVal, type]);
      updated++;
    }
    cacheClearAll();
    res.json({ success: true, updated });
  } catch(err){ respErr(res, 500, '操作失败', err); }
});

// ============================================================
// /api/config — 轻量配置 (5min 强缓存)
// ============================================================
app.get('/api/config', async (req, res) => {
  const cached = cacheGet('config:v1');
  if (cached) return res.json({ success: true, config: cached, cached: true });
  const base = { app_name: 'QshopWebUI', default_page_size: CONFIG.DEFAULT_PAGE_SIZE, max_page_size: CONFIG.MAX_PAGE_SIZE, search_min_length: 2, max_batch_size: CONFIG.MAX_BATCH_SIZE, require_auth: CONFIG.REQUIRE_AUTH, database_connected: dbStatus.connected };
  try {
    if (dbStatus.connected) {
      const { rows } = await pool.query("SELECT setting_key, setting_value, setting_type FROM settings");
      for (const row of rows) if (row.setting_key in base) base[row.setting_key] = castSettingValue(row.setting_value, row.setting_type);
    }
  } catch(e){}
  cacheSet('config:v1', base, CONFIG.CACHE_TTL_CONFIG);
  res.json({ success: true, config: base });
});

// ============================================================
// /api/admin/config — 读取 / 写入 .env（仅限管理员）
// /api/server/restart — 重启服务器
// /api/stats/realtime — 从数据库实时读取数量统计
// ============================================================
const ENV_PATH = path.join(__dirname, '.env');
const ENV_BAK_PATH = path.join(__dirname, '.env.bak.' + Date.now());
// 可在前端编辑的配置白名单（带类型、默认值、分组与中文描述）
const ENV_EDIT_SCHEMA = [
  // === 服务器 ===
  { key: 'PORT', type: 'number', default: 3000, group: 'server', label: 'HTTP 监听端口', min: 1, max: 65535 },
  { key: 'SERVER_HOST', type: 'string', default: '0.0.0.0', group: 'server', label: '绑定地址' },
  { key: 'PUBLIC_URL', type: 'string', default: '', group: 'server', label: '外部公开访问地址 (例: http://localhost:3000)' },
  // === 数据库 ===
  { key: 'DB_HOST', type: 'string', default: 'localhost', group: 'db', label: '数据库主机' },
  { key: 'DB_PORT', type: 'number', default: 5432, group: 'db', label: '数据库端口' },
  { key: 'DB_USER', type: 'string', default: 'postgres', group: 'db', label: '数据库用户' },
  { key: 'DB_NAME', type: 'string', default: 'qshop', group: 'db', label: '数据库名称' },
  { key: 'DB_POOL_MIN', type: 'number', default: 5, group: 'db', label: '连接池最小值', min: 1, max: 200 },
  { key: 'DB_POOL_MAX', type: 'number', default: 20, group: 'db', label: '连接池最大值', min: 1, max: 500 },
  // === 认证 ===
  { key: 'REQUIRE_AUTH', type: 'boolean', default: true, group: 'auth', label: '启用管理员认证' },
  { key: 'ADMIN_USERNAME', type: 'string', default: 'admin', group: 'auth', label: '管理员用户名' },
  { key: 'SESSION_TIMEOUT', type: 'number', default: 3600, group: 'auth', label: '会话超时 (秒)', min: 60, max: 86400 },
  // === QSFilter ===
  { key: 'QSFILTER_ENABLED', type: 'boolean', default: true, group: 'qsfilter', label: '启用 QSFilter 插件' },
  { key: 'QSFILTER_URL', type: 'string', default: 'http://127.0.0.1:8765', group: 'qsfilter', label: 'QSFilter 服务地址' },
  { key: 'QSFILTER_TIMEOUT', type: 'number', default: 5000, group: 'qsfilter', label: '请求超时 (ms)', min: 500, max: 60000 },
  { key: 'QSFILTER_SYNC_INTERVAL', type: 'number', default: 60, group: 'qsfilter', label: '同步间隔 (秒)', min: 5, max: 3600 },
  { key: 'QSFILTER_MAX_RETRIES', type: 'number', default: 3, group: 'qsfilter', label: '最大重试次数', min: 0, max: 20 },
  // === 日志 ===
  { key: 'LOG_TO_CONSOLE', type: 'boolean', default: true, group: 'log', label: '输出到控制台' },
  { key: 'LOG_LEVEL', type: 'string', default: 'INFO', group: 'log', label: '日志级别 (INFO/WARN/ERROR/SILENT)' },
  // === 分配调度 ===
  { key: 'ALLOCATE_ENABLED', type: 'boolean', default: true, group: 'allocate', label: '启用定时分配' },
  { key: 'ALLOCATE_INTERVAL_MINUTES', type: 'number', default: 0, group: 'allocate', label: '分配间隔 (分钟)', min: 0, max: 1440 },
  // === 玩家商店限制 ===
  { key: 'PLAYER_SHOP_MAX_BUY', type: 'number', default: 1000, group: 'shop', label: '玩家单次收购上限', min: 1, max: 1000000 },
  { key: 'PLAYER_SHOP_MAX_STOCK', type: 'number', default: 2000, group: 'shop', label: '玩家库存上限', min: 1, max: 10000000 },
  { key: 'PLAYER_SHOP_LOW_STOCK_THRESHOLD', type: 'number', default: 10, group: 'shop', label: '低库存阈值', min: 0, max: 100000 },
  // === 备份 ===
  { key: 'BACKUP_ENABLED', type: 'boolean', default: true, group: 'backup', label: '启用备份' },
  { key: 'BACKUP_SCHEDULE', type: 'string', default: 'daily', group: 'backup', label: '备份周期 (daily/weekly)' },
  { key: 'BACKUP_TIME', type: 'string', default: '02:00', group: 'backup', label: '备份时间 (HH:MM)' },
  { key: 'BACKUP_INTERVAL_MINUTES', type: 'number', default: 0, group: 'backup', label: '分钟级备份间隔 (0-60，0=关闭)', min: 0, max: 60 },
  { key: 'BACKUP_FILE_TEMPLATE', type: 'string', default: 'qshop-{type}-{date}-{time}-{random}.json', group: 'backup', label: '备份文件命名模板' },
  { key: 'BACKUP_RETENTION_DAYS', type: 'number', default: 30, group: 'backup', label: '备份保留天数', min: 1, max: 3650 },
  { key: 'BACKUP_MIN_KEEP', type: 'number', default: 10, group: 'backup', label: '最少保留备份数', min: 1, max: 1000 }
];
const ENV_GROUP_LABELS = {
  server: '🖥️  服务器', db: '📦 数据库', auth: '🔐 认证与权限',
  qsfilter: '🔌 QSFilter 插件', log: '📋 日志',
  allocate: '⏰ 定时分配', shop: '🛒 商店限制', backup: '💾 备份与恢复'
};

function coerceEnvValue(schema, raw) {
  if (raw === null || raw === undefined || raw === '') return schema.default;
  if (schema.type === 'boolean') {
    const s = String(raw).toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  if (schema.type === 'number') {
    const n = Number(raw);
    if (!Number.isFinite(n)) return schema.default;
    if (schema.min !== undefined && n < schema.min) return schema.min;
    if (schema.max !== undefined && n > schema.max) return schema.max;
    return n;
  }
  return String(raw);
}

function readEnvFile() {
  try {
    if (fs.existsSync(ENV_PATH)) return String(fs.readFileSync(ENV_PATH, 'utf8'));
  } catch (e) {}
  return '';
}
function writeEnvFile(content) {
  fs.writeFileSync(ENV_PATH, content, 'utf8');
}
function parseEnvContent(content) {
  const result = {};
  if (!content) return result;
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) return;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) return;
    const key = trimmed.substring(0, idx).trim();
    let val = trimmed.substring(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    result[key] = val;
  });
  return result;
}
function buildEnvContent(currentRaw, updates, schemaKeys) {
  const existing = parseEnvContent(currentRaw);
  // 先从原内容保留行（避免破坏注释和非受管字段）
  const lines = currentRaw ? currentRaw.split(/\r?\n/) : [];
  const used = {};
  const schemaKeySet = new Set(schemaKeys);
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.substring(0, idx).trim();
    if (!schemaKeySet.has(key)) continue;
    if (updates && Object.prototype.hasOwnProperty.call(updates, key)) {
      const schema = ENV_EDIT_SCHEMA.find(s => s.key === key);
      const newVal = coerceEnvValue(schema || { type: 'string', default: updates[key] }, updates[key]);
      if (schema && schema.type === 'boolean') lines[i] = `${key}=${newVal ? 'true' : 'false'}`;
      else if (schema && schema.type === 'string') lines[i] = `${key}=${String(newVal)}`;
      else lines[i] = `${key}=${String(newVal)}`;
      used[key] = true;
    } else if (Object.prototype.hasOwnProperty.call(existing, key)) {
      used[key] = true;
    }
  }
  // 为未写入的 schema 字段追加新行（避免破坏现有结构）
  const toAppend = [];
  for (const schema of ENV_EDIT_SCHEMA) {
    if (used[schema.key]) continue;
    const wantVal = (updates && Object.prototype.hasOwnProperty.call(updates, schema.key))
      ? updates[schema.key]
      : (existing[schema.key] !== undefined ? existing[schema.key] : schema.default);
    const coerced = coerceEnvValue(schema, wantVal);
    const formatted = schema.type === 'boolean' ? (coerced ? 'true' : 'false')
      : schema.type === 'string' ? String(coerced)
      : String(coerced);
    // 追加分组标题注释
    toAppend.push(`${schema.key}=${formatted}`);
    used[schema.key] = true;
  }
  if (toAppend.length) {
    if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('');
    lines.push('# === 由管理界面自动添加 ===');
    toAppend.forEach(line => lines.push(line));
  }
  return lines.join('\n') + '\n';
}

app.get('/api/admin/config', async (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!requireAdmin(req)) return res.status(403).json({ success: false, error: '权限不足' });
    const raw = readEnvFile();
    const current = parseEnvContent(raw);
    const fields = ENV_EDIT_SCHEMA.map(s => {
      const rawVal = current[s.key];
      const value = coerceEnvValue(s, rawVal !== undefined ? rawVal : s.default);
      return { key: s.key, type: s.type, value, default: s.default, group: s.group, label: s.label, min: s.min, max: s.max, in_file: rawVal !== undefined };
    });
    const groups = {};
    for (const f of fields) { (groups[f.group] = groups[f.group] || []).push(f); }
    res.json({ success: true, env_path: ENV_PATH, groups, group_labels: ENV_GROUP_LABELS });
  } catch (e) { respErr(res, 500, '读取配置失败', e); }
});

app.post('/api/admin/config', async (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!requireAdmin(req)) return res.status(403).json({ success: false, error: '权限不足' });
    const updates = req.body && typeof req.body === 'object' ? req.body : {};
    if (!updates || !Object.keys(updates).length) return res.status(400).json({ success: false, error: '更新内容为空' });

    // 只允许白名单内的 key
    const schemaKeys = ENV_EDIT_SCHEMA.map(s => s.key);
    const filtered = {};
    const invalid = [];
    for (const key of Object.keys(updates)) {
      const schema = ENV_EDIT_SCHEMA.find(s => s.key === key);
      if (!schema) { invalid.push(key); continue; }
      filtered[key] = coerceEnvValue(schema, updates[key]);
    }

    const raw = readEnvFile();
    // 备份（保留最近 1 份）
    try {
      if (raw && raw.length) fs.writeFileSync(path.join(__dirname, '.env.bak'), raw, 'utf8');
    } catch (e) {}
    const newContent = buildEnvContent(raw, filtered, schemaKeys);
    writeEnvFile(newContent);
    logger.info('[Admin] .env 已更新: ' + Object.keys(filtered).join(', ') + (invalid.length ? ' (跳过非法字段: ' + invalid.join(', ') + ')' : ''));
    res.json({ success: true, updated: Object.keys(filtered).length, keys: Object.keys(filtered), need_restart: true, skipped: invalid });
  } catch (e) { respErr(res, 500, '写入配置失败', e); }
});

app.post('/api/server/restart', async (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!requireAdmin(req)) return res.status(403).json({ success: false, error: '权限不足' });
    logger.info('[Admin] 发起服务器重启 (来自 ' + ((req.headers && req.headers['x-forwarded-for']) || (req.connection && req.connection.remoteAddress) || 'local') + ')');
    res.status(200).json({ success: true, message: '服务器将在 1.5 秒后重启，请稍后刷新页面', restart_at: Date.now() + 1500 });
    // 先写一个重启标记文件（可选），然后在子进程中重启自身
    setTimeout(() => {
      try {
        const nodeBin = process.argv[0];
        const script = process.argv[1];
        logger.info('[Server] 正在重启：' + nodeBin + ' ' + script);
        // 关闭当前 HTTP server（如仍在监听），然后 exec 自己
        if (httpServer && typeof httpServer.close === 'function') {
          try { httpServer.close(() => {}); } catch (e) {}
        }
        const { spawn } = require('child_process');
        const child = spawn(nodeBin, [script], {
          stdio: 'inherit',
          cwd: __dirname,
          detached: true
        });
        child.unref();
        // 1 秒后强制退出当前进程
        setTimeout(() => process.exit(0), 1000);
      } catch (e) {
        console.error('[Server] 重启失败:', e.message);
      }
    }, 1500);
  } catch (e) {
    logger.error('[Server] 重启处理异常:', e.message);
    if (!res.headersSent) res.status(500).json({ success: false, error: '重启失败: ' + e.message });
  }
});

// —— 实时数量统计（完全绕过内存缓存，直接查数据库）——
app.get('/api/stats/realtime', async (req, res) => {
  try {
    if (!checkAPIAuth(req)) return res.status(401).json({ success: false, error: '无效 API Token' });
    if (!requireAdmin(req)) return res.status(403).json({ success: false, error: '权限不足' });
    const t0 = Date.now();
    let totalShops = 0;
    let totalMaterials = 0;
    let totalSelling = 0;
    let totalBuying = 0;
    let totalOwners = 0;
    let totalWorlds = 0;
    let totalActivity = 0;
    let avgPrice = null;
    let minPrice = null;
    let maxPrice = null;

    try {
      const { rows: r1 } = await pool.query("SELECT COUNT(*) AS c FROM shops");
      totalShops = Number(r1[0].c) || 0;
      const { rows: r2 } = await pool.query("SELECT COUNT(DISTINCT material) AS c FROM shops");
      totalMaterials = Number(r2[0].c) || 0;
      const { rows: r3 } = await pool.query("SELECT shop_type, COUNT(*) AS c FROM shops GROUP BY shop_type");
      r3.forEach(r => {
        const t = String(r.shop_type || '').toUpperCase();
        if (t === 'SELLING') totalSelling = Number(r.c) || 0;
        else if (t === 'BUYING') totalBuying = Number(r.c) || 0;
      });
      const { rows: r4 } = await pool.query("SELECT COUNT(DISTINCT owner_name) AS c FROM shops");
      totalOwners = Number(r4[0].c) || 0;
      const { rows: r5 } = await pool.query("SELECT COUNT(DISTINCT world) AS c FROM shops");
      totalWorlds = Number(r5[0].c) || 0;
      const { rows: r6 } = await pool.query("SELECT SUM(activity_score) AS total, AVG(price) AS avg, MIN(price) AS min, MAX(price) AS max FROM shops");
      if (r6[0]) {
        totalActivity = Number(r6[0].total) || 0;
        avgPrice = r6[0].avg !== null && r6[0].avg !== undefined ? Number(r6[0].avg) : null;
        minPrice = r6[0].min !== null && r6[0].min !== undefined ? Number(r6[0].min) : null;
        maxPrice = r6[0].max !== null && r6[0].max !== undefined ? Number(r6[0].max) : null;
      }
    } catch (e) {
      logger.warn('[Stats] 实时查询数据库异常: ' + e.message);
      totalShops = shopStore.totalShops || 0;
      totalMaterials = shopStore.materialsCount || 0;
    }
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      elapsed_ms: Date.now() - t0,
      source: 'database',
      stats: {
        total_shops: totalShops,
        total_materials: totalMaterials,
        total_selling: totalSelling,
        total_buying: totalBuying,
        total_owners: totalOwners,
        total_worlds: totalWorlds,
        total_activity: totalActivity,
        avg_price: avgPrice,
        min_price: minPrice,
        max_price: maxPrice
      },
      // 提供一份 "记忆中" 的值用于对比（辅助判断缓存/数据库偏差）
      memory: {
        total_shops: shopStore.totalShops || 0,
        total_materials: shopStore.materialsCount || 0
      }
    });
  } catch (e) { respErr(res, 500, '查询失败', e); }
});

// ============================================================
// /api/health — 健康检查
// ============================================================
app.get('/api/health', async (req, res) => {
  const t0 = Date.now();
  try {
    // 从内存缓存读取最新状态（不需要每次查数据库）
    const stats = {
      success: true,
      status: qsfilterStatus.enabled
        ? (qsfilterStatus.connected ? 'online' : 'degraded')
        : (dbStatus.connected ? 'online' : 'degraded'),
      version: '5.0.0',
      timestamp: new Date().toISOString(),
      response_time_ms: Date.now() - t0,
      qsfilter: {
        enabled: qsfilterStatus.enabled,
        connected: qsfilterStatus.connected,
        qs_available: qsfilterStatus.qs_available,
        base_url: qsfilterStatus.base_url,
        latency_ms: qsfilterStatus.latency_ms,
        last_success_at: qsfilterStatus.last_success_at,
        last_error: qsfilterStatus.last_error,
        polling: {
          last_at: qsfilterStatus.polling_last_at,
          last_count: qsfilterStatus.polling_last_count,
          error_count: qsfilterStatus.polling_error_count,
          interval_sec: Math.floor(qsfilterStatus.polling_interval / 1000)
        },
        webhook: {
          enabled: qsfilterStatus.webhook_enabled,
          last_at: qsfilterStatus.webhook_last_at,
          last_event: qsfilterStatus.webhook_last_event,
          event_count: qsfilterStatus.webhook_event_count,
          error_count: qsfilterStatus.webhook_error_count,
          source: qsfilterStatus.webhook_url
        }
      },
      cache: {
        total_shops: shopStore.totalShops,
        selling_shops: shopStore.sellingCount,
        buying_shops: shopStore.buyingCount,
        unique_owners: shopStore.ownersCount,
        unique_worlds: shopStore.worldsCount,
        unique_materials: shopStore.materialsCount,
        last_full_sync_at: shopStore.lastFullSyncAt,
        last_update_at: shopStore.lastUpdateAt,
        last_update_source: shopStore.lastUpdateSource
      },
      database: {
        connected: dbStatus.connected
      }
    };
    res.status(200).json(stats);
  } catch(err) {
    res.status(200).json({ success: true, status: 'error', error: err.message, response_time_ms: Date.now() - t0 });
  }
});

// ============================================================
// 定时任务状态（用于调度器内部状态跟踪）
// ============================================================
const scheduleState = {
  _lastAllocateAt: null   // 最近一次定时分配触发时间
};

// ============================================================
// performAllocate — 执行分配操作（可由定时或手动触发）
//   实际业务中：这里可连接 MC 服务器的 API 触发分配动作。
//   目前实现为：记录请求统计 + 日志输出
// ============================================================
async function performAllocate(source) {
  const t0 = Date.now();
  try {
    // 1) 记录到请求统计
    const curHour = new Date().toISOString().substring(0, 13); // 'YYYY-MM-DD HH'
    requestStats.total_requests++;
    requestStats.total_allocate_requests = (requestStats.total_allocate_requests || 0) + 1;
    const hourStats = requestStats.byHour.get(curHour) || { requests: 0, items_request: 0, shops_request: 0 };
    hourStats.requests++;
    requestStats.byHour.set(curHour, hourStats);

    // 2) 如需实际调用 MC 服务器分配 API，可在此处实现：
    //   例如：await http.request('http://mc-server:8080/api/allocate', {...})

    // 3) 返回结果
    return {
      success: true,
      source: source || 'manual',
      elapsed_ms: Date.now() - t0,
      total_shops: shopStore.totalShops,
      unique_materials: shopStore.materialsCount,
      triggered_at: Date.now()
    };
  } catch (e) {
    return {
      success: false,
      error: e.message,
      elapsed_ms: Date.now() - t0
    };
  }
}

// 手动分配 API
app.post('/api/allocate', async (req, res) => {
  try {
    if (!requireAdmin(req)) return res.status(403).json({ success: false, error: '需要管理员权限' });
    const result = await performAllocate('manual');
    res.status(200).json(result);
  } catch (e) { respErr(res, 500, '分配失败', e); }
});

// 分配配置查询（供前端展示定时分配状态）
app.get('/api/allocate/config', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      enabled: CONFIG.ALLOCATE_ENABLED,
      interval_minutes: CONFIG.ALLOCATE_INTERVAL_MINUTES,
      last_triggered_at: scheduleState._lastAllocateAt,
      total_allocate_requests: requestStats.total_allocate_requests || 0
    });
  } catch (e) { respErr(res, 500, '查询失败', e); }
});

// ============================================================
// 定时任务调度器（每分钟检查是否到了预设的同步/备份时间点）
// ============================================================
function scheduleMinuteChecker() {
  // 每次 setTimeout 到下一分钟的 0 秒
  function tick() {
    try {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const curTime = hh + ':' + mm;

      // 1) 检查是否到了配置的同步时间点
      const syncTimes = CONFIG.SYNC_SCHEDULE_TIMES || [];
      if (syncTimes.indexOf(curTime) >= 0 && qsfilterStatus.enabled) {
        // 触发全量同步（异步执行，不阻塞主线程）
        (async () => {
          try {
            const t0 = Date.now();
            let result = null;
            let retries = 0;
            while (retries < CONFIG.SYNC_MAX_RETRIES) {
              result = await qsfilterSyncOnce();
              if (result && result.success) break;
              retries++;
              if (retries < CONFIG.SYNC_MAX_RETRIES) {
                await new Promise(r => setTimeout(r, CONFIG.SYNC_RETRY_INTERVAL * 1000));
              }
            }
            if (result && result.success) {
              recordSyncHistory(true, shopStore.totalShops, Date.now() - t0, 'scheduled', null);
            } else {
              recordSyncHistory(false, 0, Date.now() - t0, 'scheduled', result ? result.error : 'unknown');
            }
          } catch (e) { /* ignore */ }
        })();
      }

      // 2) 检查是否到了备份时间
      if (CONFIG.BACKUP_ENABLED && curTime === CONFIG.BACKUP_TIME) {
        (async () => {
          const result = await performBackup('scheduled', 'system');
          if (CONFIG.BACKUP_CLEANUP_ENABLED) cleanupOldBackups();
        })();
      }

      // 2b) 分钟级备份间隔（BACKUP_INTERVAL_MINUTES = 1~60，0 表示不使用）
      // 使用"总分钟数 % 间隔 === 0"确保按固定间隔触发，并通过 _lastMinuteBackupAt 防重复
      try {
        const interval = Number(CONFIG.BACKUP_INTERVAL_MINUTES) || 0;
        if (CONFIG.BACKUP_ENABLED && interval >= 1 && interval <= 60) {
          const totalMinutes = now.getHours() * 60 + now.getMinutes();
          if (totalMinutes % interval === 0) {
            // 确保在同一个备份分钟内只执行一次（因为调度器每秒可能运行多次）
            const minuteKey = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + ' ' + now.getHours() + ':' + now.getMinutes();
            if (scheduleState._lastMinuteBackupKey !== minuteKey) {
              scheduleState._lastMinuteBackupKey = minuteKey;
              (async () => {
                try {
                  const t0 = Date.now();
                  console.log('[分钟备份] 第 ' + totalMinutes + ' 分钟触发（间隔 ' + interval + ' 分钟）...');
                  const result = await performBackup('minute', 'system');
                  if (result.success) {
                    console.log('[分钟备份] ✅ 完成: ' + result.file + ' (' + (result.size_bytes / 1024).toFixed(1) + ' KB, 耗时 ' + Math.round(result.duration_ms) + 'ms)');
                  } else {
                    console.log('[分钟备份] ❌ 失败: ' + result.error);
                  }
                  if (CONFIG.BACKUP_CLEANUP_ENABLED) cleanupOldBackups();
                } catch (e) {
                  console.log('[分钟备份] 执行异常: ' + e.message);
                }
              })();
            }
          }
        }
      } catch (e) { /* ignore */ }

      // 3) 定时分配：每隔 ALLOCATE_INTERVAL_MINUTES 分钟执行一次
      try {
        const allocateInterval = Number(CONFIG.ALLOCATE_INTERVAL_MINUTES) || 0;
        if (allocateInterval > 0 && CONFIG.ALLOCATE_ENABLED) {
          const minuteOfDay = now.getHours() * 60 + now.getMinutes();
          if (minuteOfDay % allocateInterval === 0) {
            if (!scheduleState._lastAllocateAt || (Date.now() - scheduleState._lastAllocateAt) > (allocateInterval - 1) * 60 * 1000) {
              scheduleState._lastAllocateAt = Date.now();
              (async () => {
                try {
                  const t0 = Date.now();
                  const result = await performAllocate('scheduled');
                  console.log('[定时分配] 已触发（' + allocateInterval + ' 分钟间隔），用时 ' + Math.round((Date.now() - t0) / 1000) + 's，结果: ' + (result && result.success ? '成功' : '失败'));
                } catch (e) {
                  console.log('[定时分配] 执行异常:', e.message);
                }
              })();
            }
          }
        }
      } catch (e) { /* ignore */ }

      // 4) 每分钟清理过期请求统计（超过 24 小时的）
      try {
        const hours = Array.from(requestStats.byHour.keys()).sort();
        const now2 = new Date();
        const todayStr = now2.getFullYear() + '-' +
          String(now2.getMonth() + 1).padStart(2, '0') + '-' +
          String(now2.getDate()).padStart(2, '0');
        // 只保留今天的（key 以 'YYYY-MM-DD ' 开头的）
        for (const h of hours) {
          if (!h.startsWith(todayStr)) requestStats.byHour.delete(h);
        }
      } catch (e) { /* ignore */ }
    } catch (e) { /* ignore */ }

    // 计算到下一分钟 0 秒的等待
    const now2 = new Date();
    const nextMin = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate(), now2.getHours(), now2.getMinutes() + 1, 0, 50);
    setTimeout(tick, Math.max(1000, nextMin.getTime() - now2.getTime()));
  }
  // 启动
  const now = new Date();
  const nextMin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + 1, 0, 50);
  setTimeout(tick, Math.max(1000, nextMin.getTime() - now.getTime()));
}

// ============================================================
// 同步状态 & 手动同步 API
// ============================================================
app.get('/api/sync/status', (req, res) => {
  try {
    // 计算下次同步时间
    const now = new Date();
    const times = CONFIG.SYNC_SCHEDULE_TIMES || [];
    const nextAt = [];
    for (const t of times) {
      const [h, m] = t.split(':').map(Number);
      let next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
      if (next.getTime() <= now.getTime()) next = new Date(next.getTime() + 24 * 3600 * 1000);
      nextAt.push(next.getTime());
    }
    // 备份下次时间
    let nextBackupAt = null;
    if (CONFIG.BACKUP_ENABLED && CONFIG.BACKUP_TIME) {
      const [bh, bm] = CONFIG.BACKUP_TIME.split(':').map(Number);
      let nb = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bh, bm, 0);
      if (nb.getTime() <= now.getTime()) nb = new Date(nb.getTime() + 24 * 3600 * 1000);
      nextBackupAt = nb.getTime();
    }
    res.json({
      success: true,
      last_full_sync_at: syncStatus.lastFullSync_at,
      last_full_sync_ok: syncStatus.lastFullSync_ok,
      last_full_sync_shops: syncStatus.lastFullSync_shops,
      last_full_sync_duration_ms: syncStatus.lastFullSync_durationMs,
      sync_schedule_times: times,
      next_sync_at_list: nextAt,
      next_backup_at: nextBackupAt,
      retry_count: syncStatus.retryCount,
      max_retries: CONFIG.SYNC_MAX_RETRIES,
      history: syncStatus.history.slice(0, 20)
    });
  } catch (e) { respErr(res, 500, '操作失败', e); }
});

// 手动触发同步
app.post('/api/sync/now', async (req, res) => {
  try {
    if (!qsfilterStatus.enabled) return res.status(400).json({ success: false, error: 'QSFilter 未启用' });
    const t0 = Date.now();
    const result = await qsfilterSyncOnce();
    if (result && result.success) {
      recordSyncHistory(true, shopStore.totalShops, Date.now() - t0, 'manual', null);
      res.json({ success: true, shops_count: shopStore.totalShops, duration_ms: Date.now() - t0 });
    } else {
      recordSyncHistory(false, 0, Date.now() - t0, 'manual', result ? result.error : 'unknown');
      res.status(500).json({ success: false, error: result ? result.error : '同步失败' });
    }
  } catch (e) { respErr(res, 500, '操作失败', e); }
});

// ============================================================
// 统计数据 API（用于前端"信息统计"标签页）
// ============================================================
app.get('/api/stats/requests', (req, res) => {
  recordRequest('/api/stats/requests');
  try {
    // 按小时输出 24 小时数据（即使没有数据也要返回空的小时项）
    const now = new Date();
    const hours = [];
    for (let i = 23; i >= 0; i--) {
      const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - i, 0, 0);
      const key = t.getFullYear() + '-' +
        String(t.getMonth() + 1).padStart(2, '0') + '-' +
        String(t.getDate()).padStart(2, '0') + ' ' +
        String(t.getHours()).padStart(2, '0');
      const data = requestStats.byHour.get(key);
      hours.push({
        hour: String(t.getHours()).padStart(2, '0') + ':00',
        hour_key: key,
        count: data ? data.count : 0,
        port_requests: data ? data.port_requests : 0,
        shops_viewed: data ? data.shops_viewed : 0
      });
    }

    // 按商店类型
    const shopTypes = [];
    requestStats.byShopType.forEach((v, k) => shopTypes.push({ type: k, count: v }));

    // 按世界
    const worlds = [];
    requestStats.byWorld.forEach((v, k) => worlds.push({ world: k, count: v }));

    // 按物品（只取前 20 个最热门的）
    const materialsList = [];
    requestStats.byMaterial.forEach((v, k) => materialsList.push({ material: k, count: v }));
    materialsList.sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      total_today: requestStats.total_today,
      today_date: requestStats.last_reset_date,
      by_hour: hours,
      by_shop_type: shopTypes,
      by_world: worlds,
      by_material_top: materialsList.slice(0, 20),
      qsfilter: {
        connected: qsfilterStatus.connected,
        polling_count: qsfilterStatus.polling_last_count,
        polling_last_at: qsfilterStatus.polling_last_at,
        webhook_event_count: qsfilterStatus.webhook_event_count,
        webhook_last_at: qsfilterStatus.webhook_last_at,
        webhook_last_event: qsfilterStatus.webhook_last_event
      },
      cache: {
        total_shops: shopStore.totalShops,
        selling_shops: shopStore.sellingCount,
        buying_shops: shopStore.buyingCount,
        unique_materials: shopStore.materialsCount,
        unique_owners: shopStore.ownersCount,
        unique_worlds: shopStore.worldsCount
      },
      recent_events: requestStats.recentEvents.slice(0, 30)
    });
  } catch (e) { respErr(res, 500, '操作失败', e); }
});

// ============================================================
// 备份管理 API
// ============================================================
app.get('/api/backup/status', (req, res) => {
  try {
    res.json({
      success: true,
      config: {
        enabled: CONFIG.BACKUP_ENABLED,
        schedule: CONFIG.BACKUP_SCHEDULE,
        backup_time: CONFIG.BACKUP_TIME,
        backup_interval_minutes: CONFIG.BACKUP_INTERVAL_MINUTES,
        backup_dir: CONFIG.BACKUP_DIR,
        retention_days: CONFIG.BACKUP_RETENTION_DAYS,
        min_keep: CONFIG.BACKUP_MIN_KEEP,
        cleanup_enabled: CONFIG.BACKUP_CLEANUP_ENABLED
      },
      status: {
        is_running: backupStatus.isRunning,
        last_backup_at: backupStatus.lastBackup_at,
        last_backup_ok: backupStatus.lastBackup_ok,
        last_backup_file: backupStatus.lastBackup_file,
        history: backupStatus.history.slice(0, 20)
      }
    });
  } catch (e) { respErr(res, 500, '操作失败', e); }
});

app.get('/api/backup/list', (req, res) => {
  try {
    const result = listBackupFiles();
    if (!result.success) return res.status(500).json(result);
    res.json({ success: true, backup_dir: result.backup_dir, files: result.files, total: result.files.length });
  } catch (e) { respErr(res, 500, '操作失败', e); }
});

app.post('/api/backup/now', async (req, res) => {
  try {
    const result = await performBackup('manual', req.body && req.body.operator ? req.body.operator : 'admin');
    if (result.success) res.json(result);
    else res.status(500).json(result);
  } catch (e) { respErr(res, 500, '操作失败', e); }
});

app.post('/api/backup/restore', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.file) return res.status(400).json({ success: false, error: '缺少 file 参数' });
    const result = await performRestore(body.file, body.operator || 'admin');
    if (result.success) res.json(result);
    else res.status(500).json(result);
  } catch (e) { respErr(res, 500, '操作失败', e); }
});

app.delete('/api/backup/:file', (req, res) => {
  try {
    const file = String(req.params.file || '').trim();
    if (!file) return res.status(400).json({ success: false, error: '缺少 file 参数' });
    // 简单的安全检查，不允许 ../
    if (file.indexOf('..') >= 0 || file.indexOf('/') >= 0 || file.indexOf('\\') >= 0) {
      return res.status(400).json({ success: false, error: '非法文件名' });
    }
    const result = deleteBackupFile(file);
    if (result.success) res.json(result);
    else res.status(500).json(result);
  } catch (e) { respErr(res, 500, '操作失败', e); }
});

app.post('/api/backup/cleanup', (req, res) => {
  try {
    const result = cleanupOldBackups();
    res.json(result);
  } catch (e) { respErr(res, 500, '操作失败', e); }
});

// ============================================================
// 管理员增强：高级筛选 & 批量操作 & 导入导出
// ============================================================
// 高级筛选（支持多条件组合、模糊搜索、价格范围、时间范围）
app.get('/api/admin/shops/search', async (req, res) => {
  try {
    if (!dbStatus.connected) return res.json({ success: true, shops: [], total: 0 });

    const keyword = req.query.q ? String(req.query.q).trim() : '';
    const material = req.query.material ? String(req.query.material).toUpperCase() : '';
    const owner = req.query.owner ? String(req.query.owner) : '';
    const world = req.query.world ? String(req.query.world) : '';
    const shop_type = req.query.shop_type ? String(req.query.shop_type).toUpperCase() : '';
    const min_price = req.query.min_price !== undefined && req.query.min_price !== '' ? parseFloat(req.query.min_price) : null;
    const max_price = req.query.max_price !== undefined && req.query.max_price !== '' ? parseFloat(req.query.max_price) : null;
    const min_activity = req.query.min_activity !== undefined && req.query.min_activity !== '' ? parseInt(req.query.min_activity) : null;
    const only_reasonable = req.query.reasonable === 'true';
    const pageNum = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(parseInt(req.query.pageSize) || 50, 500);
    const offset = (pageNum - 1) * pageSize;

    // 构造 SQL
    const where = [];
    const params = [];
    if (keyword && keyword.length >= 1) {
      const kw = '%' + keyword.toLowerCase() + '%';
      where.push('(LOWER(material) LIKE $' + (params.length + 1) + ' OR LOWER(item_name) LIKE $' + (params.length + 2) + ' OR LOWER(owner_name) LIKE $' + (params.length + 3) + ')');
      params.push(kw, kw, kw);
    }
    if (material) { where.push('material = $' + (params.length + 1)); params.push(material); }
    if (owner) { where.push('LOWER(owner_name) LIKE $' + (params.length + 1)); params.push('%' + owner.toLowerCase() + '%'); }
    if (world) { where.push('LOWER(world) LIKE $' + (params.length + 1)); params.push('%' + world.toLowerCase() + '%'); }
    if (shop_type) { where.push('shop_type = $' + (params.length + 1)); params.push(shop_type); }
    if (min_price !== null && !isNaN(min_price)) { where.push('price >= $' + (params.length + 1)); params.push(min_price); }
    if (max_price !== null && !isNaN(max_price)) { where.push('price <= $' + (params.length + 1)); params.push(max_price); }
    if (min_activity !== null && !isNaN(min_activity)) { where.push('activity_score >= $' + (params.length + 1)); params.push(min_activity); }
    if (only_reasonable) where.push('price_reasonable = true');

    const whereSql = where.length > 0 ? ' WHERE ' + where.join(' AND ') : '';

    // 分页查询
    const { rows: shopRows } = await pool.query(
      'SELECT * FROM shops ' + whereSql + ' ORDER BY activity_score DESC, shop_id ASC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2),
      [...params, pageSize, offset]
    );
    const { rows: cntRows } = await pool.query('SELECT COUNT(*) AS c FROM shops ' + whereSql, params);
    const total = parseInt(cntRows[0].c) || 0;

    res.json({ success: true, shops: shopRows, total, page: pageNum, page_size: pageSize });
  } catch (e) { respErr(res, 500, '操作失败', e); }
});

// 批量更新：批量设置价格、批量修改类型、批量删除
app.post('/api/admin/shops/batch', async (req, res) => {
  try {
    if (!dbStatus.connected) return res.status(500).json({ success: false, error: '数据库未连接' });
    const body = req.body || {};
    const ids = Array.isArray(body.ids) ? body.ids : [];
    const action = String(body.action || '').toLowerCase();

    if (ids.length === 0) return res.status(400).json({ success: false, error: '缺少 ids 列表' });
    if (ids.length > 5000) return res.status(400).json({ success: false, error: '批量操作最多 5000 条' });

    const paramIds = ids.map(id => Number(id)).filter(id => !isNaN(id));

    if (action === 'delete') {
      const placeholders = paramIds.map((_, i) => '$' + (i + 1)).join(',');
      const { rowCount } = await pool.query('DELETE FROM shops WHERE shop_id IN (' + placeholders + ')', paramIds);
      // 同步清理缓存中对应的商店
      for (const id of paramIds) deleteShop(id);
      return res.json({ success: true, action: 'delete', deleted_count: rowCount });
    }

    if (action === 'set_price' && body.price !== undefined) {
      const newPrice = Number(body.price);
      if (isNaN(newPrice) || newPrice < 0) return res.status(400).json({ success: false, error: 'price 必须是非负数' });
      const placeholders = paramIds.map((_, i) => '$' + (i + 1)).join(',');
      const { rowCount } = await pool.query(
        'UPDATE shops SET price = $' + (paramIds.length + 1) + ', updated_at = NOW() WHERE shop_id IN (' + placeholders + ')',
        [...paramIds, newPrice]
      );
      // 同步更新缓存
      for (const id of paramIds) {
        const shop = shopStore.shops.get(id);
        if (shop) { shop.price = newPrice; upsertShop(shop, 'batch:set_price'); }
      }
      return res.json({ success: true, action: 'set_price', updated_count: rowCount, new_price: newPrice });
    }

    if (action === 'set_type' && body.shop_type) {
      const newType = String(body.shop_type).toUpperCase();
      if (newType !== 'SELLING' && newType !== 'BUYING') return res.status(400).json({ success: false, error: 'shop_type 必须是 SELLING 或 BUYING' });
      const placeholders = paramIds.map((_, i) => '$' + (i + 1)).join(',');
      const { rowCount } = await pool.query(
        'UPDATE shops SET shop_type = $' + (paramIds.length + 1) + ', updated_at = NOW() WHERE shop_id IN (' + placeholders + ')',
        [...paramIds, newType]
      );
      for (const id of paramIds) {
        const shop = shopStore.shops.get(id);
        if (shop) { shop.shop_type = newType; upsertShop(shop, 'batch:set_type'); }
      }
      return res.json({ success: true, action: 'set_type', updated_count: rowCount, new_type: newType });
    }

    if (action === 'set_reasonable' && body.reasonable !== undefined) {
      const val = body.reasonable === true || String(body.reasonable).toLowerCase() === 'true';
      const placeholders = paramIds.map((_, i) => '$' + (i + 1)).join(',');
      const { rowCount } = await pool.query(
        'UPDATE shops SET price_reasonable = $' + (paramIds.length + 1) + ', updated_at = NOW() WHERE shop_id IN (' + placeholders + ')',
        [...paramIds, val]
      );
      for (const id of paramIds) {
        const shop = shopStore.shops.get(id);
        if (shop) { shop.price_reasonable = val; upsertShop(shop, 'batch:set_reasonable'); }
      }
      return res.json({ success: true, action: 'set_reasonable', updated_count: rowCount, reasonable: val });
    }

    return res.status(400).json({ success: false, error: '不支持的 action' });
  } catch (e) { respErr(res, 500, '操作失败', e); }
});

// ============================================================
// 数据导出（CSV/JSON）- 支持按条件筛选导出
// ============================================================
app.get('/api/export/shops', async (req, res) => {
  try {
    if (!dbStatus.connected) return res.status(500).json({ success: false, error: '数据库未连接' });
    const format = (req.query.format || 'json').toLowerCase(); // csv / json
    const keyword = req.query.q ? String(req.query.q).trim() : '';
    const material = req.query.material ? String(req.query.material).toUpperCase() : '';
    const owner = req.query.owner ? String(req.query.owner) : '';
    const world = req.query.world ? String(req.query.world) : '';
    const shop_type = req.query.shop_type ? String(req.query.shop_type).toUpperCase() : '';

    const where = [];
    const params = [];
    if (keyword && keyword.length >= 1) {
      const kw = '%' + keyword.toLowerCase() + '%';
      where.push('(LOWER(material) LIKE $1 OR LOWER(item_name) LIKE $2 OR LOWER(owner_name) LIKE $3)');
      params.push(kw, kw, kw);
    }
    if (material) { where.push('material = $' + (params.length + 1)); params.push(material); }
    if (owner) { where.push('LOWER(owner_name) LIKE $' + (params.length + 1)); params.push('%' + owner.toLowerCase() + '%'); }
    if (world) { where.push('LOWER(world) LIKE $' + (params.length + 1)); params.push('%' + world.toLowerCase() + '%'); }
    if (shop_type) { where.push('shop_type = $' + (params.length + 1)); params.push(shop_type); }
    const whereSql = where.length > 0 ? ' WHERE ' + where.join(' AND ') : '';

    const { rows } = await pool.query(
      'SELECT shop_id, material, item_name, owner_name, owner_uuid, price, stacking_amount, shop_type, world, x, y, z, price_reasonable, activity_score, fetched_at, updated_at FROM shops ' + whereSql + ' ORDER BY shop_id ASC',
      params
    );

    writeAuditLog('export_shops', { count: rows.length, format: format });

    if (format === 'csv') {
      // 生成 CSV
      const header = ['shop_id', 'material', 'item_name', 'owner_name', 'owner_uuid', 'price', 'stacking_amount', 'shop_type', 'world', 'x', 'y', 'z', 'price_reasonable', 'activity_score', 'fetched_at', 'updated_at'];
      const escapeCsv = (v) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      };
      let csv = header.join(',') + '\n';
      for (const row of rows) {
        const line = header.map(h => escapeCsv(row[h])).join(',');
        csv += line + '\n';
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="shops_' + Date.now() + '.csv"');
      res.send('\ufeff' + csv); // BOM for Excel
      return;
    }

    // 默认 JSON
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="shops_' + Date.now() + '.json"');
    res.json({ success: true, export_time: new Date().toISOString(), total: rows.length, shops: rows });
  } catch (e) { respErr(res, 500, '操作失败', e); }
});

// 数据导入（支持 CSV / JSON）
app.post('/api/import/shops', async (req, res) => {
  try {
    if (!dbStatus.connected) return res.status(500).json({ success: false, error: '数据库未连接' });
    const body = req.body || {};
    const format = (body.format || 'json').toLowerCase();
    const conflict_mode = (body.conflict_mode || 'skip').toLowerCase(); // skip / overwrite / error
    const data = body.data; // JSON 数据 / CSV 字符串

    if (!data) return res.status(400).json({ success: false, error: 'data 不能为空' });

    let shopList = [];

    if (format === 'csv') {
      // 简单解析 CSV
      const lines = String(data).split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) return res.status(400).json({ success: false, error: 'CSV 内容为空或格式错误' });
      const parseCsvLine = (line) => {
        const result = [];
        let cur = '';
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (c === '"') {
            if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
            else inQuote = !inQuote;
          } else if (c === ',' && !inQuote) {
            result.push(cur);
            cur = '';
          } else cur += c;
        }
        result.push(cur);
        return result;
      };
      const headers = parseCsvLine(lines[0]).map(h => h.trim());
      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        const row = {};
        for (let j = 0; j < headers.length; j++) row[headers[j]] = values[j];
        shopList.push(row);
      }
    } else {
      // JSON 格式：支持 { shops: [...] } 或 直接数组
      if (Array.isArray(data)) shopList = data;
      else if (Array.isArray(data.shops)) shopList = data.shops;
      else return res.status(400).json({ success: false, error: 'JSON 数据必须是数组或含 shops 字段' });
    }

    if (shopList.length === 0) return res.status(400).json({ success: false, error: '没有有效的数据' });
    if (shopList.length > 50000) return res.status(400).json({ success: false, error: '单次导入最多 50000 条' });

    let inserted = 0, updated = 0, skipped = 0, errors = 0;
    const errorDetails = [];

    // 逐行验证和导入（简单事务：不使用事务，每条单独处理）
    for (let i = 0; i < shopList.length; i++) {
      const row = shopList[i];
      try {
        // 数据验证
        const sid = row.shop_id !== undefined && row.shop_id !== null && row.shop_id !== '' ? Number(row.shop_id) : null;
        const material = String(row.material || row.item_id || 'UNKNOWN').toUpperCase().slice(0, 100);
        const item_name = String(row.item_name || material).slice(0, 200);
        const owner_name = String(row.owner_name || 'unknown').slice(0, 100);
        const owner_uuid = String(row.owner_uuid || '').slice(0, 100);
        const price = parseFloat(row.price);
        const stacking_amount = row.stacking_amount !== undefined ? parseInt(row.stacking_amount) : 1;
        const shop_type = (String(row.shop_type || 'SELLING')).toUpperCase();
        const world = String(row.world || 'world').slice(0, 100);
        const x = row.x !== undefined ? Number(row.x) : 0;
        const y = row.y !== undefined ? Number(row.y) : 0;
        const z = row.z !== undefined ? Number(row.z) : 0;
        const reasonable = row.price_reasonable !== undefined ? row.price_reasonable !== false : true;
        const activity_score = row.activity_score !== undefined ? Number(row.activity_score) : 1;

        if (isNaN(price) || price < 0) { skipped++; if (errorDetails.length < 50) errorDetails.push({ row: i, error: 'price 无效' }); continue; }
        if (shop_type !== 'SELLING' && shop_type !== 'BUYING') { skipped++; continue; }

        if (sid !== null) {
          // 检查是否已存在
          const { rows: existing } = await pool.query('SELECT shop_id FROM shops WHERE shop_id = $1', [sid]);
          if (existing.length > 0) {
            if (conflict_mode === 'overwrite') {
              await pool.query(
                'UPDATE shops SET material=$1,item_name=$2,owner_name=$3,owner_uuid=$4,price=$5,stacking_amount=$6,shop_type=$7,world=$8,x=$9,y=$10,z=$11,price_reasonable=$12,activity_score=$13,updated_at=NOW() WHERE shop_id=$14',
                [material, item_name, owner_name, owner_uuid, price, stacking_amount, shop_type, world, x, y, z, reasonable, activity_score, sid]
              );
              updated++;
            } else if (conflict_mode === 'skip') {
              skipped++;
            } else {
              errors++;
              if (errorDetails.length < 50) errorDetails.push({ row: i, shop_id: sid, error: '已存在的 shop_id' });
            }
          } else {
            await pool.query(
              'INSERT INTO shops (shop_id, material, item_name, owner_name, owner_uuid, price, stacking_amount, shop_type, world, x, y, z, price_reasonable, activity_score, fetched_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())',
              [sid, material, item_name, owner_name, owner_uuid, price, stacking_amount, shop_type, world, x, y, z, reasonable, activity_score]
            );
            inserted++;
          }
        } else {
          // 没有 shop_id，直接新增
          const { rows: newRows } = await pool.query(
            'INSERT INTO shops (material, item_name, owner_name, owner_uuid, price, stacking_amount, shop_type, world, x, y, z, price_reasonable, activity_score, fetched_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW()) RETURNING shop_id',
            [material, item_name, owner_name, owner_uuid, price, stacking_amount, shop_type, world, x, y, z, reasonable, activity_score]
          );
          inserted++;
        }
      } catch (rowErr) {
        errors++;
        if (errorDetails.length < 50) errorDetails.push({ row: i, error: rowErr.message });
      }
    }

    writeAuditLog('import_shops', {
      total: shopList.length,
      inserted: inserted,
      updated: updated,
      skipped: skipped,
      errors: errors,
      conflict_mode: conflict_mode,
      format: format
    });
    res.json({
      success: true,
      total: shopList.length,
      inserted: inserted,
      updated: updated,
      skipped: skipped,
      errors: errors,
      error_details: errorDetails
    });
  } catch (e) { respErr(res, 500, '操作失败', e); }
});

// 仪表盘：管理员首页概览数据
app.get('/api/admin/dashboard', async (req, res) => {
  try {
    if (!dbStatus.connected) {
      return res.json({
        success: true,
        from_cache: true,
        cache: {
          total_shops: shopStore.totalShops,
          selling_shops: shopStore.sellingCount,
          buying_shops: shopStore.buyingCount,
          unique_materials: shopStore.materialsCount,
          unique_owners: shopStore.ownersCount,
          unique_worlds: shopStore.worldsCount
        },
        qsfilter: {
          connected: qsfilterStatus.connected,
          webhook_enabled: qsfilterStatus.webhook_enabled,
          webhook_event_count: qsfilterStatus.webhook_event_count,
          polling_last_at: qsfilterStatus.polling_last_at
        }
      });
    }

    const results = {};

    // 从数据库
    try {
      const { rows } = await pool.query(`
        SELECT COUNT(*) AS total_shops,
               COUNT(CASE WHEN shop_type='SELLING' THEN 1 END) AS selling_shops,
               COUNT(CASE WHEN shop_type='BUYING' THEN 1 END) AS buying_shops,
               COUNT(DISTINCT material) AS unique_materials,
               COUNT(DISTINCT owner_name) AS unique_owners,
               COUNT(DISTINCT world) AS unique_worlds,
               ROUND(AVG(price)::numeric, 2) AS avg_price,
               MIN(price) AS min_price,
               MAX(price) AS max_price,
               COALESCE(SUM(activity_score), 0) AS total_activity
        FROM shops
      `);
      results.database_summary = rows[0];
    } catch (e) { results.database_summary = null; }

    // 价格分布（按价格区间统计）
    try {
      const { rows } = await pool.query(`
        SELECT
          COUNT(CASE WHEN price < 1 THEN 1 END) AS r1,
          COUNT(CASE WHEN price >= 1 AND price < 10 THEN 1 END) AS r2,
          COUNT(CASE WHEN price >= 10 AND price < 100 THEN 1 END) AS r3,
          COUNT(CASE WHEN price >= 100 AND price < 1000 THEN 1 END) AS r4,
          COUNT(CASE WHEN price >= 1000 THEN 1 END) AS r5
        FROM shops
      `);
      results.price_distribution = rows[0];
    } catch (e) { results.price_distribution = null; }

    // 活跃店主前 10
    try {
      const { rows } = await pool.query('SELECT owner_name, COUNT(*) AS shop_count, COALESCE(SUM(activity_score),0) AS total_activity FROM shops GROUP BY owner_name ORDER BY shop_count DESC LIMIT 10');
      results.top_owners = rows;
    } catch (e) { results.top_owners = []; }

    // 最常见的物品前 10
    try {
      const { rows } = await pool.query('SELECT material, COUNT(*) AS shop_count, ROUND(AVG(price)::numeric,2) AS avg_price FROM shops GROUP BY material ORDER BY shop_count DESC LIMIT 10');
      results.top_materials = rows;
    } catch (e) { results.top_materials = []; }

    res.json({
      success: true,
      ...results,
      cache_stats: {
        total_shops: shopStore.totalShops,
        selling_shops: shopStore.sellingCount,
        buying_shops: shopStore.buyingCount,
        unique_materials: shopStore.materialsCount,
        unique_owners: shopStore.ownersCount,
        unique_worlds: shopStore.worldsCount
      },
      qsfilter_status: {
        enabled: qsfilterStatus.enabled,
        connected: qsfilterStatus.connected,
        base_url: qsfilterStatus.base_url,
        polling_last_at: qsfilterStatus.polling_last_at,
        polling_last_count: qsfilterStatus.polling_last_count,
        webhook_enabled: qsfilterStatus.webhook_enabled,
        webhook_event_count: qsfilterStatus.webhook_event_count,
        webhook_last_at: qsfilterStatus.webhook_last_at
      },
      request_stats: {
        total_today: requestStats.total_today
      }
    });
  } catch (e) { respErr(res, 500, '操作失败', e); }
});

// 认证接口

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ success: false, error: '请输入用户名和密码' });

    let ok = false;
    let role = 'user';

    // 1) 先从数据库 users 表查
    try {
      const { rows } = await pool.query(
        "SELECT id, username, password_hash, role, active FROM users WHERE username = $1 LIMIT 1",
        [String(username)]
      );
      if (rows.length > 0 && rows[0].active !== false) {
        const user = rows[0];
        const pwd = user.password_hash;
        if (pwd && pwd.startsWith('$2') && bcrypt) ok = await bcrypt.compare(password, pwd);
        else ok = password === pwd;
        role = user.role || 'user';
        if (ok) {
          try { await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]); } catch (e) {}
        }
      }
    } catch(e) {  }

    // 2) 回退到 settings / 环境变量配置 (用于初始管理员)
    if (!ok) {
      try {
        const { rows } = await pool.query("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('admin_username','admin_password')");
        const cfg = {}; rows.forEach(r => cfg[r.setting_key] = r.setting_value);
        if (username === (cfg.admin_username || 'admin')) {
          const pwd = cfg.admin_password;
          if (pwd && pwd.startsWith('$2') && bcrypt) ok = await bcrypt.compare(password, pwd);
          else ok = password === pwd;
          role = 'admin';
        }
      } catch(e){}
    }
    if (!ok && username === CONFIG.ADMIN_USERNAME) {
      if (CONFIG.ADMIN_PASSWORD.startsWith('$2') && bcrypt) ok = await bcrypt.compare(password, CONFIG.ADMIN_PASSWORD);
      else ok = password === CONFIG.ADMIN_PASSWORD;
      role = 'admin';
    }

    if (ok) {
      const sid = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + CONFIG.SESSION_TIMEOUT * 1000;
      sessions.set(sid, { username, role, expiresAt });
      // 写入 sessions 表 (持久化)
      try {
        await pool.query(
          "INSERT INTO sessions (session_id, username, ip, user_agent, created_at, expires_at) VALUES ($1,$2,$3,$4,$5,$6)",
          [sid, username, getClientIP(req), (req.headers['user-agent'] || '').substring(0, 255), new Date(), new Date(expiresAt)]
        );
      } catch(e) {  }
      writeAuditLog('login', { username, ip: getClientIP(req), success: true });
      return res.json({
        success: true,
        session_id: sid,
        expires_in: CONFIG.SESSION_TIMEOUT,
        username,
        role,
        is_admin: role === 'admin'
      });
    }
    writeAuditLog('login', { username, ip: getClientIP(req), success: false });
    res.status(401).json({ success: false, error: '用户名或密码错误' });
  } catch(err) { respErr(res, 500, '操作失败', err); }
});
app.post('/api/auth/logout', (req, res) => {
  const sid = req.headers['x-session'];
  if (sid && sessions.has(String(sid))) sessions.delete(String(sid));
  res.json({ success: true });
});
app.get('/api/auth/status', (req, res) => {
  const sid = req.headers['x-session'];
  let authed = !CONFIG.REQUIRE_AUTH;
  let role = 'guest';
  let username = null;
  if (sid && sessions.has(String(sid))) {
    const s = sessions.get(String(sid));
    if (Date.now() < s.expiresAt) { authed = true; username = s.username; role = s.role || 'user'; }
  }
  res.json({
    success: true,
    authenticated: authed,
    require_auth: CONFIG.REQUIRE_AUTH,
    role,
    username,
    is_admin: role === 'admin'
  });
});
app.put('/api/auth/change-password', async (req, res) => {
  try {
    if (!requireAdmin(req)) return res.status(403).json({ success: false, error: '权限不足' });
    const { current_password, new_password } = req.body || {};
    let oldOk = false;
    try {
      const { rows } = await pool.query("SELECT setting_value FROM settings WHERE setting_key = 'admin_password'");
      if (rows.length >= 1) {
        const pwd = rows[0].setting_value;
        if (pwd && pwd.startsWith('$2') && bcrypt) oldOk = await bcrypt.compare(current_password, pwd);
        else oldOk = current_password === pwd;
      }
    } catch(e){}
    if (!oldOk) return res.status(401).json({ success: false, error: '旧密码不正确' });
    const hashed = bcrypt ? await bcrypt.hash(new_password, 10) : new_password;
    await pool.query("UPDATE settings SET setting_value = $1, setting_type = 'string' WHERE setting_key = 'admin_password'", [hashed]);
    res.json({ success: true });
  } catch(err){ respErr(res, 500, '操作失败', err); }
});

// === 用户注册 (role-based) ===
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email } = req.body || {};
    if (!username || !password) return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
    const u = String(username).trim();
    if (u.length < 3 || u.length > 64) return res.status(400).json({ success: false, error: '用户名长度 3-64 字符' });
    if (password.length < 6) return res.status(400).json({ success: false, error: '密码至少 6 个字符' });
    if (!/^[a-zA-Z0-9_.-]+$/.test(u)) return res.status(400).json({ success: false, error: '用户名只能包含字母、数字、下划线、点、短横' });

    // 防 SQL 注入: 避免常见注入模式
    const suspicious = /('|--|\/\*|\*\/|drop\s|insert\s|update\s|delete\s|select\s|union\s|;|\bnull\b|xp_)/i;
    if (suspicious.test(u) || (email && suspicious.test(email))) {
      return res.status(400).json({ success: false, error: '用户名/邮箱包含非法字符' });
    }

    const hashed = bcrypt ? await bcrypt.hash(password, 10) : password;
    const role = 'user';

    try {
      const { rows: exist } = await pool.query("SELECT COUNT(*) AS c FROM users WHERE username = $1", [u]);
      if (parseInt(exist[0].c) > 0) return res.status(409).json({ success: false, error: '用户名已被占用' });
      await pool.query(
        "INSERT INTO users (username, password_hash, role, email, created_at, updated_at, last_login, active) VALUES ($1,$2,$3,$4,$5,$5,NULL,TRUE)",
        [u, hashed, role, email ? String(email).substring(0, 255) : null, new Date()]
      );
    } catch (e) {
      // 唯一约束冲突
      if (String(e.message).includes('unique') || String(e.message).includes('duplicate'))
        return res.status(409).json({ success: false, error: '用户名已被占用' });
      throw e;
    }
    writeAuditLog('register', { username: u, ip: getClientIP(req), success: true });
    res.json({ success: true, message: '注册成功，请登录', username: u, role });
  } catch(err) { respErr(res, 500, '注册失败', err); }
});

// === 当前用户信息 ===
app.get('/api/auth/me', async (req, res) => {
  const sid = req.headers['x-session'];
  if (sid && sessions.has(String(sid))) {
    const s = sessions.get(String(sid));
    if (Date.now() < s.expiresAt) {
      return res.json({ success: true, username: s.username, role: s.role || 'user', is_admin: s.role === 'admin' });
    }
  }
  res.json({ success: true, username: null, role: 'guest', is_admin: false });
});

// ============================================================
// 首页
// ============================================================
app.get('/', (req, res) => { recordRequest('/'); res.sendFile(path.join(__dirname, 'index.html')); });

// ============================================================
// 启动
// ============================================================
// 启动定时任务调度器（每分钟检查是否到达同步/备份时间点）
try { scheduleMinuteChecker(); } catch(e) { console.error('定时任务启动失败:', e.message); }
const httpServer = app.listen(CONFIG.PORT, CONFIG.HOST, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║            QshopWebUI v5.0 — PostgreSQL 高性能后端            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('  🎯 监听地址    : http://' + CONFIG.HOST + ':' + CONFIG.PORT);
  console.log('  🗄️  数据库位置  : ' + CONFIG.DB_HOST + ':' + CONFIG.DB_PORT + ' / ' + CONFIG.DB_NAME);
  console.log('  📁 日志目录    : ' + CONFIG.LOG_DIR);
  console.log('');
  console.log('  ────────────── 系统资源配置 ──────────────');
  console.log('  💾 数据库内存上限 : ' + CONFIG.DATABASE_MEMORY_LIMIT_GB.toFixed(1) + ' GB');
  console.log('  🔧 CPU 核心限制  : ' + CONFIG.CPU_CORE_LIMIT + ' / 系统总核心 ' + CONFIG.SYSTEM_TOTAL_CORES);
  console.log('  📊 连接池大小    : ' + CONFIG.DB_POOL_MIN + ' ~ ' + CONFIG.DB_POOL_MAX);
  console.log('');
  console.log('  ────────────── 安全与认证 ──────────────');
  console.log('  🔐 需要管理员权限: ' + (CONFIG.REQUIRE_AUTH ? '是 (admin 账户可操作)' : '否'));
  console.log('  👤 默认管理员    : ' + CONFIG.ADMIN_USERNAME + (CONFIG.API_TOKEN ? '  (API Token 已启用)' : ''));
  console.log('  🕐 会话有效期    : ' + (CONFIG.SESSION_TIMEOUT) + ' 秒');
  console.log('');
  console.log('  ────────────── 功能接口 ──────────────');
  console.log('  POST /api/shops/seed           → 生成测试数据 (自定义数量)');
  console.log('  POST /api/shops/seed/terminate → 强制终止 + 清空 seed 数据 (原子事务)');
  console.log('  GET  /api/shops/seed/progress  → 生成进度查询');
  console.log('  POST /api/auth/login           → 管理员登录 (返回 session_id)');
  console.log('  POST /api/auth/logout          → 登出');
  console.log('  POST /api/auth/register        → 用户注册 (用户名/密码/邮箱 验证)');
  console.log('  GET  /api/auth/me              → 当前用户信息');
  console.log('  GET  /api/health               → 健康检查');
  console.log('');
  console.log('  QSFilter enabled :', CONFIG.QSFILTER_ENABLED ? 'YES' : 'NO');
  console.log('  QSFilter server  :', CONFIG.QSFILTER_URL);
  console.log('  Poll interval    :', CONFIG.QSFILTER_SYNC_INTERVAL, 'sec');
  console.log('  Retry policy     :', CONFIG.SYNC_MAX_RETRIES, 'times /', CONFIG.SYNC_RETRY_INTERVAL, 'sec');
  console.log('  Daily sync times :', CONFIG.SYNC_SCHEDULE_TIMES.join(', '));
  console.log('');
  console.log('  ---------- Backup / Restore ----------');
  console.log('  Backup enabled   :', CONFIG.BACKUP_ENABLED ? 'YES' : 'NO');
  console.log('  Backup dir       :', CONFIG.BACKUP_DIR);
  console.log('  Backup time      :', CONFIG.BACKUP_TIME, '(cycle:', CONFIG.BACKUP_SCHEDULE + ')');
  console.log('  Retention policy :', CONFIG.BACKUP_RETENTION_DAYS, 'days / min', CONFIG.BACKUP_MIN_KEEP);
  console.log('');
  console.log('  ---------- Stats & Monitoring ----------');
  console.log('  Request stats    :', CONFIG.STATS_ENABLED ? 'Enabled' : 'Disabled');
  console.log('  Error alerts     :', CONFIG.ALERT_ENABLED ? 'Enabled' : 'Disabled');
  console.log('');
  if (CONFIG_WARNINGS.length > 0) {
    console.log('  ⚠️   配置警告:');
    for (const w of CONFIG_WARNINGS) console.log('     - ' + w);
    console.log('');
  }
  console.log('  ✅ 服务器已启动，可通过浏览器访问 ' + (CONFIG.PUBLIC_URL || 'http://localhost:' + CONFIG.PORT));
  console.log('');
});
