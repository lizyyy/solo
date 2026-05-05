# 仓库盘点管理系统

一个轻量级的仓库盘点小后台，专为网络不稳定的盘点场景设计。支持离线草稿队列、自动同步、冲突检测和解决。

## 功能特性

### 离线优先 (Offline First)
- 盘点员在货架边网络不稳时，新增/修改盘点记录会先保存到浏览器 `localStorage` 草稿队列
- 自动监听网络状态，恢复网络后自动同步
- 也可手动点击「同步全部」按钮进行同步

### 状态区分
列表中每条记录清晰显示状态：
- 🟢 **已同步**：数据已保存到后端 SQLite 数据库
- 🟡 **草稿**：仅保存在本地 localStorage，尚未同步
- 🔵 **同步中**：正在与服务器同步
- 🔴 **冲突**：数据版本不一致，需手动解决

### 冲突检测与解决
当同一 SKU 被其他人修改过时：
- 后端检测版本号冲突，返回差异对比
- 前端展示「本地修改」vs「服务器当前」数据对比
- 提供两种解决方式：
  - **保留服务器版本**：放弃本地修改，使用服务器数据
  - **用本地覆盖服务器**：强制使用本地数据覆盖服务器

### 其他功能
- **种子数据**：预设 10 条示例库存记录，开箱即用
- **同步日志**：记录所有同步操作，便于追溯
- **异常提示**：Toast 提示操作结果
- **导出 Markdown 对账报告**：一键导出库存明细、汇总统计、最近日志
- **搜索过滤**：按 SKU、商品名称、库位搜索；按状态筛选

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML/CSS/JavaScript (无框架依赖) |
| 本地存储 | 浏览器 localStorage |
| 后端 | Node.js + Express |
| 数据库 | SQLite (better-sqlite3) |

## 项目结构

```
.
├── public/
│   └── index.html      # 前端单页面应用
├── server.js           # 后端服务
├── seed.js             # 种子数据
├── package.json        # 项目配置
└── inventory.db        # SQLite 数据库 (运行后自动生成)
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化种子数据

```bash
npm run seed
```

会导入 10 条示例库存记录：
- SKU001 ~ SKU010
- 包含蓝牙耳机、智能手表、充电宝等常见商品
- 预设部分账实不符的数据用于测试

### 3. 启动服务

```bash
npm start
```

服务启动后访问：**http://localhost:3000**

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/inventory | 获取所有库存记录 |
| GET | /api/inventory/:sku | 获取单个 SKU 详情 |
| POST | /api/sync/batch | 批量同步草稿（支持冲突检测） |
| POST | /api/sync/resolve | 解决冲突 |
| GET | /api/sync/logs | 获取同步日志 |
| GET | /api/report/markdown | 导出 Markdown 对账报告 |

### 同步接口冲突检测逻辑

后端使用**乐观锁**机制：
1. 每条记录有 `version` 字段，每次更新自动 +1
2. 客户端同步时携带 `clientVersion`
3. 如果 `clientVersion !== serverVersion`，返回冲突
4. 冲突时返回差异数据 `diff`，包含本地和服务器的对比

### 冲突响应示例

```json
{
  "success": true,
  "conflicts": [
    {
      "sku": "SKU001",
      "local": { "actual_qty": 50, "version": 1 },
      "server": { "actual_qty": 45, "version": 2 },
      "diff": {
        "actual_qty": { "local": 50, "server": 45 }
      }
    }
  ]
}
```

## 使用流程

### 正常盘点流程
1. 打开页面，查看库存列表
2. 点击「新增盘点」或「编辑」修改记录
3. 网络在线时自动同步；离线时保存到草稿
4. 网络恢复后自动同步，或手动点击「同步全部」

### 冲突解决流程
1. 同步时发现冲突，记录标记为「冲突」状态
2. 点击「解决冲突」查看差异对比
3. 选择「保留服务器版本」或「用本地覆盖服务器」
4. 确认后冲突解决，数据同步完成

### 离线模式测试
1. 断开网络（可在浏览器开发者工具 Network 标签页选择 Offline）
2. 新增或编辑记录，会提示「已保存到草稿队列」
3. 查看「草稿队列」标签页，数据保存在 localStorage
4. 恢复网络，会自动同步草稿

### 导出对账报告
1. 点击右上角「导出报告」按钮
2. 自动下载 `.md` 格式的报告
3. 报告包含：
   - 生成时间
   - 汇总统计（SKU 总数、库存总量、账实不符数量）
   - 库存明细表（含差异标注）
   - 最近同步日志

## 数据库表结构

### inventory_records (库存记录表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| sku | TEXT | SKU 编码 (唯一) |
| product_name | TEXT | 商品名称 |
| location | TEXT | 库位 |
| expected_qty | INTEGER | 账面数量 |
| actual_qty | INTEGER | 实际数量 |
| unit | TEXT | 单位 |
| operator | TEXT | 操作人 |
| remark | TEXT | 备注 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |
| version | INTEGER | 版本号 (用于乐观锁) |

### sync_logs (同步日志表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| action | TEXT | 操作类型 (create/update/resolve) |
| sku | TEXT | SKU 编码 |
| local_qty | INTEGER | 本地数量 |
| server_qty | INTEGER | 服务器数量 |
| result | TEXT | 结果 (success/conflict/error) |
| operator | TEXT | 操作人 |
| created_at | DATETIME | 创建时间 |

## 本地存储结构

前端使用 localStorage 存储以下数据：

| Key | 说明 |
|-----|------|
| inventory_drafts | 草稿队列数组 |
| inventory_conflicts | 待解决的冲突数组 |
| inventory_server_data | 服务器数据缓存 |

草稿数据结构示例：
```javascript
{
  sku: "SKU001",
  product_name: "无线蓝牙耳机 Pro",
  actual_qty: 50,
  expected_qty: 50,
  status: "pending",
  savedAt: "2026-05-05T10:00:00.000Z",
  operator: "盘点员A",
  clientVersion: 1
}
```

## 注意事项

1. **数据安全**：本系统为本地演示项目，未做用户认证和权限控制
2. **浏览器兼容**：使用了 `AbortSignal.timeout` 等现代 API，建议使用 Chrome/Edge 最新版
3. **localStorage 限制**：浏览器 localStorage 通常有 5MB 限制，适用于中小型盘点任务
4. **多用户冲突**：多个盘点员同时修改同一 SKU 时会触发冲突检测

## License

MIT
