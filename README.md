# QshopWebUI

> Minecraft 商店系统 Web 管理面板（PostgreSQL + Node.js + Express）

专为 Minecraft 服务器设计的商店查询与管理系统。支持 **系统商店** 与 **玩家商店** 分离、出售与收购双模式、库存语义化显示、中文名称翻译，以及与 QSFilterPlugin 的双向同步。

---

## 功能特色

- 🗄️ **PostgreSQL 数据库** — 真正的关系型数据库存储，含 pg_trgm 模糊搜索索引
- 🏛️ **系统商店 vs 玩家商店** — 系统商店无限库存；玩家商店可配置购买/库存上限
- 🛒 **双交易模式** — 出售（SELLING） + 收购（BUYING），数据字段、统计卡片、样式均区分
- 📊 **库存语义化显示** — 无限 / 正常 / 低库存 三态，含颜色高亮与脉冲动画
- 🌐 **中文名称翻译** — material 自动转换中文名（`DIAMOND_PICKAXE` → 钻石镐）
- 🔌 **QSFilterPlugin 连接** — 通过 HTTP API 与 Minecraft 服务器双向同步，含定时轮询 + WebHook
- 🔐 **管理员权限控制** — bcrypt 哈希密码、会话登录、API Token 校验
- 💾 **自动备份系统** — 支持每日/分钟级定时备份、文件命名模板、自动清理过期文件
- 🎨 **Neo-Brutalism 主题** — 粗边框 + 硬阴影的视觉风格
- 📱 **响应式布局** — 支持桌面、平板、手机

---

## 快速启动（一键启动）

### Windows

双击运行：

```
start.bat
```

脚本会自动：
1. 检查 Node.js
2. 首次运行时自动安装依赖（`npm install`）
3. 读取 `.env` 配置
4. 启动服务器（默认 http://0.0.0.0:3000/）

### 手动启动

```bash
npm install
npm start
```

启动成功后，终端会显示类似信息：

```
✅ PostgreSQL 连接成功！数据库: qshop
┌───────────────────────────────────────────────────────────┐
│              QshopWebUI 服务器启动成功！                    │
│  管理面板:  http://localhost:3000                           │
│  API 地址:  http://localhost:3000/api/shops                │
│  健康检查:  http://localhost:3000/api/health               │
└───────────────────────────────────────────────────────────┘
```

打开浏览器访问 http://localhost:3000 即可使用。

---

## 环境要求

| 组件 | 推荐版本 |
|------|---------|
| Node.js | >= 14.0（推荐 18+） |
| PostgreSQL | >= 12（推荐 15+） |
| 浏览器 | Chrome / Edge / Firefox / Safari 最新版 |

---

## 安装与配置

### 第 1 步：安装依赖

在项目根目录执行：

```bash
npm install
```

自动安装以下依赖：
- `express` — Web 服务器框架
- `pg` — PostgreSQL 驱动（支持连接池）
- `bcryptjs` — 密码哈希（管理员登录）
- `body-parser` — JSON 请求体解析
- `cors` — 跨域支持
- `helmet` — 安全响应头
- `dotenv` — 环境变量管理
- `cookie-parser` — Cookie 解析

### 第 2 步：准备 PostgreSQL 数据库

1. 登录到 PostgreSQL（使用 psql 或 pgAdmin）
2. 创建数据库：

```sql
CREATE DATABASE qshop;
```

3. （推荐）启用 pg_trgm 扩展以启用模糊搜索加速：

```sql
\c qshop
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

> 首次启动服务时，会自动创建 `shops`、`harbor`、`settings`、`fetch_log`、`activity`、`users`、`sessions`、`announcements` 等数据表。

### 第 3 步：配置环境变量

复制 `.env.example` 为 `.env`，修改其中的配置：

```bash
cp .env.example .env
```

至少需要填写以下关键配置：

```
DB_HOST=localhost           # 数据库服务器地址
DB_PORT=5432                # 数据库端口（PostgreSQL 默认 5432）
DB_USER=postgres            # 数据库用户名
DB_PASSWORD=你的密码        # 数据库密码
DB_NAME=qshop               # 数据库名称

SERVER_PORT=3000            # Web 服务端口
SERVER_HOST=0.0.0.0         # 监听地址（0.0.0.0 允许外部访问）

QSFILTER_ENABLED=true       # 是否连接真实的 QSFilterPlugin 服务器
QSFILTER_URL=http://127.0.0.1:8765  # 插件地址

ADMIN_USERNAME=admin        # 管理员账号
ADMIN_PASSWORD=你的密码      # 管理员密码（bcrypt 存储，不会明文保存）
```

修改 `.env` 后，**需要重启服务** 才能生效。

### 第 4 步：启动服务器

```bash
npm start
```

---

## 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                     浏览器前端（HTML/CSS/JS）                 │
│  商店列表 / 搜索 / 详情 / 管理面板 / 实时统计                 │
└────────────────────┬─────────────────────────────────────────┘
                     │ REST API (/api/*)
                     ▼
┌──────────────────────────────────────────────────────────────┐
│                 Node.js Express (server.js)                  │
│  • 路由处理        • 会话认证        • 缓存（内存）           │
│  • 请求日志        • 管理员权限        • WebHook 推送         │
│  • 定时备份        • 定时同步        • 平滑重启               │
└────────────────────┬─────────────────────────────────────────┘
                     │ pg (PostgreSQL 连接池)
                     ▼
┌──────────────────────────────────────────────────────────────┐
│                      PostgreSQL 数据库                        │
│  shops / harbor / settings / fetch_log / activity            │
│  users / sessions / announcements                             │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│              QSFilterPlugin (Minecraft 服务器)                │
│  通过 HTTP API 提供商店数据，支持双向同步                     │
└──────────────────────────────────────────────────────────────┘
```

---

## REST API 参考

### 商店与数据查询

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/shops` | 获取商店列表（支持搜索、分页、筛选、排序） |
| `GET` | `/api/shops/:id` | 获取单个商店详情 |
| `GET` | `/api/materials` | 获取所有物品类型及统计 |
| `GET` | `/api/owners` | 获取所有店主 |
| `GET` | `/api/worlds` | 获取所有世界 |
| `GET` | `/api/harbor` | 获取港口坐标 |
| `GET` | `/api/stats` | 获取统计数据（系统 vs 玩家、出售 vs 收购） |
| `GET` | `/api/stats/realtime` | 获取实时统计（绕过缓存，直接查数据库） |
| `GET` | `/api/health` | 健康检查（返回 200 OK） |

### 搜索与筛选参数

```
GET /api/shops?q=diamond                        # 关键词搜索
GET /api/shops?material=DIAMOND_ORE             # 按物品筛选
GET /api/shops?owner_name=Steve                 # 按店主筛选
GET /api/shops?shop_type=SELLING                # 按类型筛选（SELLING 出售 / BUYING 收购）
GET /api/shops?shop_kind=system                 # 按类别筛选（system 系统 / player 玩家）
GET /api/shops?page=2&pageSize=24               # 分页
GET /api/shops?sort=price_asc                   # 排序：price_asc / price_desc / stock_asc / stock_desc / relevance
GET /api/shops?min_price=1&max_price=100        # 价格区间

# 组合使用
GET /api/shops?q=钻石&shop_type=SELLING&sort=price_asc&page=1&pageSize=24
```

### 数据管理（需要管理员登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/shops` | 批量导入/更新商店（JSON 数组） |
| `DELETE` | `/api/shops/:id` | 删除单个商店 |
| `POST` | `/api/clear` | 清空所有数据（需 `confirm: true`） |
| `POST` | `/api/import/demo` | 生成演示数据 |
| `PUT` | `/api/harbor` | 更新港口坐标 |

### 备份与恢复

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/backup` | 立即触发一次备份 |
| `GET` | `/api/backups` | 获取备份文件列表 |
| `GET` | `/api/backup/:filename` | 下载指定备份文件 |
| `DELETE` | `/api/backup/:filename` | 删除指定备份文件 |
| `POST` | `/api/restore/:filename` | 从指定备份文件恢复 |

### 管理员与配置

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/login` | 管理员登录（JSON Body: `{ username, password }`） |
| `POST` | `/api/auth/logout` | 注销登录 |
| `GET` | `/api/auth/me` | 获取当前登录用户信息 |
| `GET` | `/api/admin/config` | 获取当前环境变量（仅 admin 可见） |
| `POST` | `/api/admin/config` | 修改配置（写回 .env，需重启生效） |
| `POST` | `/api/server/restart` | 触发服务平滑重启 |

### 公告

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/announcements` | 获取公告列表 |
| `POST` | `/api/announcements` | 发布新公告（admin） |
| `PUT` | `/api/announcements/:id` | 更新公告（admin） |
| `DELETE` | `/api/announcements/:id` | 删除公告（admin） |

### 认证方式

所有需要管理员权限的接口，可通过以下任一方式认证：

1. **Cookie（浏览器登录后自动携带）**
2. **请求头**：`x-session: <session_id>`
3. **请求头**：`x-api-token: <在 .env 中配置的 API_TOKEN>`

---

## 数据库表结构

| 表名 | 说明 |
|------|------|
| `shops` | 商店主表（核心数据，含 material/item_name/price/world/坐标/库存/类型/类别等） |
| `harbor` | 港口坐标表（地图定位用） |
| `settings` | 系统设置表（键值对） |
| `fetch_log` | API 请求日志表（记录每次同步/拉取） |
| `activity` | 物品活跃度统计表（记录点击/浏览行为，用于高热度排序） |
| `users` | 用户表（管理员账号，bcrypt 哈希密码） |
| `sessions` | 会话表（登录状态，含过期时间） |
| `announcements` | 公告表（服务器重启仍保留） |

### 主要索引优化

- `shops(material)` — 物品分类索引
- `shops(owner_name)` — 店主索引
- `shops(shop_type)` — 交易类型索引（出售/收购）
- `shops(shop_kind)` — 商店类别索引（系统/玩家）
- `shops(price)` — 价格索引（排序优化）
- `shops(material, shop_type, shop_kind)` — 组合索引
- pg_trgm GIN 索引 — material / item_name / owner_name 的模糊搜索加速

---

## 自动备份系统

### 工作原理

服务端内置备份调度器，支持两种触发模式：

1. **定时触发**（`daily` / `weekly` / `monthly` + `BACKUP_TIME`）
2. **分钟级触发**（`BACKUP_INTERVAL_MINUTES`，1-60 分钟）

备份文件为 JSON 格式，包含所有表的数据。文件名默认模板：

```
qshop-{type}-{date}-{time}-{random}.json
```

支持的占位符：`{type}`、`{date}`、`{time}`、`{ts}`、`{random}`。

### 保留与清理

- 超过 `BACKUP_RETENTION_DAYS`（默认 30 天）的备份会被自动清理
- 但至少保留 `BACKUP_MIN_KEEP`（默认 10 个）最近的备份
- 确保磁盘不会被无限增长的备份占满

### 手动触发

在管理面板的"数据管理"页面点击「立即备份」，或调用：

```
POST /api/backup
```

---

## 管理面板使用

### 首次登录

1. 启动服务后，访问 http://localhost:3000/
2. 点击页面右上角的「管理」进入管理面板
3. 使用 `.env` 中配置的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录
4. 登录成功后即可使用：
   - 数据管理（清空、导入、备份、恢复）
   - 环境变量实时编辑（页面上直接改 .env）
   - 服务器一键重启（平滑重启，当前请求完成后切换新进程）
   - 实时统计（直查数据库，15 秒自动刷新）
   - 公告发布 / 编辑 / 删除

### 管理员密码安全

- 密码使用 `bcrypt` 哈希存储，数据库中不保存明文
- 会话在 `SESSION_TIMEOUT` 秒（默认 3600 秒 = 1 小时）后自动失效
- 建议生产环境启用 `REQUIRE_AUTH=true`（默认已开启）

---

## 文件结构

```
QshopWebUI/
├── index.html              # 主页面（由服务器提供）
├── css/style.css           # 样式表（Neo-Brutalism 主题）
├── js/                     # 前端 JavaScript 模块
├── item/                   # Minecraft 物品图标（PNG）
├── errormt/                # 贴图加载失败时的备用图片
│
├── server.js               # Express 服务器主入口（含路由/数据库/备份/认证）
├── package.json            # npm 项目配置
├── start.bat               # 一键启动脚本（Windows）
│
├── .env.example            # 环境变量示例（提交到 git）
├── .env                    # 实际环境变量（不提交，本地保留）
├── .gitignore              # git 忽略规则
│
├── logs/                   # 日志输出目录（运行后自动创建）
└── backups/                # 备份文件目录（运行后自动创建）
```

---

## 常见问题

### Q: 无法连接到 PostgreSQL？

检查：
1. PostgreSQL 服务是否启动（`net start postgresql` 或对应服务）
2. `.env` 中的 `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` 是否正确
3. 是否已创建数据库 `qshop`（如未创建，使用 `CREATE DATABASE qshop;`）
4. 确认 `pg_hba.conf` 允许你的连接方式（md5 或 scram-sha-256）

### Q: 浏览器显示搜索错误？

1. 打开开发者工具（F12），查看 Console 报错
2. 查看 Network 面板，确认 `/api/shops` 请求返回 200
3. 确认 Node.js 服务器仍在运行，并查看终端日志

### Q: 修改 .env 后没有生效？

修改 `.env` 后**必须重启服务**。可以使用管理面板的「一键重启」按钮，或手动：

```bash
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
npm start
```

### Q: QSFilterPlugin 无法连接？

1. 确认 Minecraft 服务器上已安装并启动 QSFilterPlugin 插件
2. 确认插件的 HTTP 端口（默认 8765）未被防火墙阻挡
3. 尝试直接用浏览器访问 `http://插件服务器IP:8765/api/health`，看是否返回成功
4. 如无法连接真实插件，可将 `.env` 中 `QSFILTER_ENABLED=false`，使用本地演示数据

### Q: 备份文件太多占磁盘？

- 默认备份保留 30 天，并至少保留最近 10 个
- 可以修改 `.env` 中的 `BACKUP_RETENTION_DAYS`（如改为 7）和 `BACKUP_MIN_KEEP`
- 也可以调整 `BACKUP_INTERVAL_MINUTES` 降低备份频率（0 表示仅每日定时）

---

## 升级说明

本版本已从原先的 `localStorage` 存储升级为 **PostgreSQL 关系型数据库**。

### 主要改进

- ✅ **真实 SQL 查询** — 支持复杂 WHERE / ORDER BY / LIMIT / JOIN
- ✅ **连接池** — 高性能连接管理，支持并发请求
- ✅ **pg_trgm 模糊搜索** — material / item_name / owner_name 的高效中文关键词搜索
- ✅ **内存缓存** — 高频查询缓存，减轻数据库压力，自动过期
- ✅ **自动备份与恢复** — 定时备份、一键恢复、文件命名模板、保留策略
- ✅ **平滑重启** — 重启不中断当前请求，确保高可用
- ✅ **会话认证** — bcrypt 密码哈希、会话超时、API Token
- ✅ **中文本地化** — 物品名自动中文翻译、全中文界面

---

## License

MIT
