# QshopWebUI - 商店系统 v2（PostgreSQL + Node.js + Express）

一个为 Minecraft 服务器设计的商店管理系统，支持**系统商店**与**玩家商店**分离、出售与收购双模式、库存/收购上限、中文名称显示、一键启动。

## 功能特色

- 🗃️ **PostgreSQL 数据库** - 真正的关系型数据库存储（支持 MySQL 配置切换）
- 🏛️ **系统商店 vs 玩家商店** - 系统商店无限库存/收购；玩家商店可配置 `max_buy_quantity` / `max_stock_capacity`
- 🛒 **双交易模式** - 出售（SELLING） + 收购（BUYING），数据字段、统计卡片、样式均区分
- 📊 **库存语义化显示** - 无限 / 正常 / 低库存三态，含颜色高亮与脉冲动画
- 🌐 **中文名称翻译** - material 自动转换中文名（`DIAMOND_PICKAXE → 钻石镐`）
- 🔗 **Webhook / 轮询** - 与 QSFilterPlugin 双向同步，支持实时事件推送
- 🎨 **Neo-Brutalism 主题** - 粗边框 + 硬阴影的视觉风格
- 📱 **响应式布局** - 支持桌面、平板、手机

## 快速启动（一键启动）

Windows 下双击运行：

```
start.bat
```

脚本会自动：
1. 检查 Node.js
2. 首次运行时自动 `npm install`
3. 自动读取 `.env` 配置
4. 启动服务器，默认 http://0.0.0.0:3000/

---

手动启动：

```bash
npm install
npm start
```


## 系统架构

```
┌───────────────────────┐     ┌───────────────────────┐     ┌───────────────────────┐
│      浏览器前端        │────▶│   Node.js Express     │────▶│      MySQL 数据库     │
│  (HTML/CSS/JS 原生)   │     │   (server.js)         │     │   (qshop 数据库)      │
└───────────────────────┘     └───────────────────────┘     └───────────────────────┘
         ↑                                ↑                                ↑
         │ REST API (/api/*)              │ mysql2 / mysql2/promise        │ 表结构见 schema.sql
         │                                │                                │
         └────────────────────────────────┴────────────────────────────────┘
```

## 环境要求

| 组件 | 推荐版本 |
|------|---------|
| Node.js | >= 14.0 |
| MySQL | >= 5.7（推荐 8.0+） |
| 浏览器 | Chrome / Edge / Firefox / Safari 最新版 |

## 快速开始（3 步）

### 第 1 步：安装 Node.js 依赖

在项目根目录执行：

```bash
npm install
```

这会自动安装：
- `express` - Web 服务器
- `mysql2` - MySQL 驱动（支持 Promise）
- `body-parser` - JSON 请求体解析
- `cors` - 跨域支持
- `dotenv` - 环境变量管理

### 第 2 步：创建 MySQL 数据库

**方式 A：命令行导入**
```bash
mysql -u root -p < schema.sql
```

**方式 B：使用 MySQL Workbench / phpMyAdmin**
1. 登录到 MySQL 管理界面
2. 点击 "File → Open SQL Script"
3. 选择 `schema.sql` 并执行（闪电图标）

**方式 C：手动执行**
```sql
CREATE DATABASE qshop DEFAULT CHARACTER SET utf8mb4;
USE qshop;
-- 然后复制 schema.sql 的内容执行
```

### 第 3 步：启动服务器

```bash
npm start
```

看到类似输出就表示成功：

```
✅ MySQL 连接成功！数据库: qshop
┌─────────────────────────────────────────────────────┐
│          QshopWebUI 服务器启动成功！                   │
│  管理面板:  http://localhost:3000                     │
│  API 地址:  http://localhost:3000/api/shops           │
│  健康检查:  http://localhost:3000/api/health          │
└─────────────────────────────────────────────────────┘
```

在浏览器打开 http://localhost:3000 即可使用！

### 修改数据库连接

复制 `.env.example` 为 `.env`，然后修改为你的 MySQL 配置：

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的密码
DB_NAME=qshop
SERVER_PORT=3000
```

## REST API 参考

### 商店相关

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/shops` | 获取所有商店（支持搜索/分页/筛选） |
| `GET` | `/api/shops/:id` | 获取单个商店详情 |
| `POST` | `/api/shops` | 批量导入/更新商店（JSON 数组） |
| `DELETE` | `/api/shops/:id` | 删除单个商店 |
| `POST` | `/api/clear` | 清空所有数据（需 `confirm:true`） |

### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/materials` | 获取所有物品类型及统计 |
| `GET` | `/api/harbor` | 获取港口坐标 |
| `PUT` | `/api/harbor` | 更新港口坐标 |
| `GET` | `/api/stats` | 获取统计数据 |
| `GET` | `/api/log` | 获取最近请求日志 |
| `GET` | `/api/health` | 健康检查（返回 200 OK） |

### 搜索参数示例

```
# 关键词搜索
GET /api/shops?q=diamond

# 按 material 筛选
GET /api/shops?material=DIAMOND

# 按 shop_type 筛选
GET /api/shops?shop_type=SELLING

# 分页
GET /api/shops?page=2&pageSize=12

# 排序
GET /api/shops?sort=price_asc      # 价格升序
GET /api/shops?sort=price_desc     # 价格降序
GET /api/shops?sort=owner          # 按店主排序
GET /api/shops?sort=relevance      # 相关度排序（默认）

# 组合使用
GET /api/shops?q=diamond&shop_type=SELLING&sort=price_asc&page=1&pageSize=20
```

## 数据库表结构

| 表名 | 说明 |
|------|------|
| `shops` | 商店主表（核心数据，含 material/item_name/price/world/坐标等） |
| `harbor` | 港口坐标表 |
| `settings` | 系统设置表 |
| `fetch_log` | API 请求日志表 |
| `activity` | 物品活跃度统计表 |

### 索引

```
shops.shop_id            主键
shops.material           分类索引
shops.owner_name         店主索引
shops.shop_type          类型索引
shops.price              价格索引（排序优化）
shops.(material, shop_type) 组合索引
shops.material + item_name + owner_name 全文索引
```

## 文件结构

```
QshopWebUI/
├── index.html         主页面（由服务器提供）
├── style.css          样式表（Neo-Brutalism 主题）
├── app.js             前端应用逻辑（UI渲染/搜索）
├── db.js              前端数据层（调用后端 API，含 localStorage 降级）
│
├── server.js          Express 服务器 + MySQL 连接池
├── schema.sql         数据库表结构（含演示数据）
├── package.json       npm 项目配置
├── .env.example       环境变量示例
├── .env               实际环境变量（忽略到版本控制）
│
└── 文档说明.md
```

## 常见问题

**Q: 无法连接到 MySQL？**

检查：
1. MySQL 服务是否启动（`services.msc` 或 `brew services start mysql`）
2. `.env` 文件中的用户名和密码是否正确
3. 端口是否正确（默认 3306）
4. 是否已创建数据库 `qshop`（先执行 schema.sql）

**Q: 浏览器显示搜索错误？**

1. 打开开发者工具（F12）查看 Console 报错
2. 检查 Network 面板，看 `/api/shops` 请求是否返回 200
3. 确保 Node.js 服务器仍在运行

**Q: 如何重置演示数据？**

```bash
# 方案 A：重新导入 schema.sql
mysql -u root -p < schema.sql

# 方案 B：通过管理面板
1. 打开 http://localhost:3000
2. 切换到 "数据管理"
3. 点击「清空所有数据」然后「生成演示数据」
```

## 升级说明

此版本由原先的 `localStorage` 存储升级为 MySQL 关系型数据库。

### 主要改进

- ✅ **真实 SQL 查询** - 支持复杂 WHERE/ORDER BY/LIMIT
- ✅ **连接池** - 高性能连接管理，支持并发请求
- ✅ **全文索引** - 对 material/item_name/owner_name 的高效搜索
- ✅ **事务支持** - 批量操作原子性
- ✅ **异步/await** - 现代化 Promise API
- ✅ **自动降级** - 后端不可用时自动降级到 localStorage

## License

MIT
