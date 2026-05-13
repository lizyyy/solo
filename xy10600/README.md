# 🏪 门店价签变更审计系统

全栈 Web 应用，解决设备离线时价签变更说不清的问题。

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd /Users/mac/pro/solo/workspaces/xy10600
npm install
```

### 2. 启动服务

```bash
npm start
```

服务启动后访问：
- **Web 界面**: http://localhost:3000
- **健康检查**: http://localhost:3000/api/health

### 3. 生成演示数据

```bash
npm run seed
```

这会创建 4 条演示路径的数据（见下文）。

---

## 📦 系统功能

### 核心数据模型

| 数据 | 说明 |
|------|------|
| `price_changes` | 价签变更主记录 |
| `esl_changes` | 电子价签变更记录 |
| `cashier_changes` | 收银价变更记录 |
| `promotions` | 促销活动 |
| `rollback_records` | 回滚补发记录 |
| `price_discrepancies` | 价差审计 |
| `audit_timeline` | 审计时间线（每次操作都可追溯） |

### 规则覆盖

| 规则 | 说明 |
|------|------|
| 促销活动拦截 | 商品存在活跃促销时，调价会被拦截 |
| 设备离线异常 | 电子价签设备离线时，记录异常并触发人工修正 |
| 收银同步失败 | 收银系统同步失败时，记录异常 |
| 价差自动检测 | ESL 与收银价不一致时，自动生成价差记录 |
| 回滚补发流程 | 支持回滚变更，并标记补发状态 |
| 重复操作幂等 | 相同 `request_id` 重复提交时，返回原结果 |

---

## 🎭 四条演示路径

执行 `npm run seed` 会自动创建以下演示数据：

### 路径 1: 成功变更 (SUCCESS)
- 商品: 农夫山泉550ml (SKU001)
- 流程: 提交 → ESL 同步成功 → 收银同步成功 → 完成
- 结果: `SUCCESS`

### 路径 2: 促销拦截 (INTERCEPTED)
- 商品: 可口可乐330ml (SKU002)
- 流程: 提交时检测到存在"五一劳动节促销" → 拦截变更
- 结果: `INTERCEPTED`
- 演示了强制提交（`force: true`）可绕过拦截

### 路径 3: 人工修正 (MANUAL_CORRECTION_REQUIRED)
- 商品: 康师傅红烧牛肉面 (SKU003)
- 流程: 提交 → ESL-C-001 离线 → POS-004 失败 → 触发价差检测
- 结果: `MANUAL_CORRECTION_REQUIRED`
- 随后演示了: 回滚 → 补发

### 路径 4: 重复提交幂等 (IDEMPOTENT)
- 商品: 伊利纯牛奶250ml (SKU004)
- 流程: 首次提交成功 → 相同 `request_id` 再次提交
- 结果: 第二次返回 `idempotent: true`，不会重复操作

---

## 🌐 Web 界面使用

### 主界面功能
- **顶部统计**: 变更总数、今日、成功、需人工修正、待处理价差
- **筛选条件**: 状态、商品编码、操作员、日期范围
- **操作按钮**: 新建变更、批量导入、导出CSV

### 列表字段
- ID、商品编码、商品名称、原价、新价、状态、操作员、请求ID、时间、操作

### 详情页面
点击「查看」进入详情，可看到：
- 基本信息
- 电子价签变更明细（哪个设备、状态、错误）
- 收银价变更明细（哪个终端、状态、错误）
- 促销活动信息
- 价差审计记录
- **📜 审计时间线**（完整的操作历史）

### 详情页操作
- **回滚**: 将变更标记为 `ROLLED_BACK`，ESL/Cashier 状态同步更新
- **补发**: 标记为 `REISSUED`，记录补发次数

---

## 🔌 REST API 调用

### 1. 健康检查
```bash
curl http://localhost:3001/api/health
```

### 2. 获取变更列表
```bash
# 全部
curl http://localhost:3000/api/price-changes

# 筛选
curl "http://localhost:3000/api/price-changes?status=MANUAL_CORRECTION_REQUIRED&operator=张三"
```

### 3. 获取单条详情
```bash
curl http://localhost:3000/api/price-changes/1
```

### 4. 创建价签变更
```bash
curl -X POST http://localhost:3001/api/price-changes \
  -H "Content-Type: application/json" \
  -d '{
    "product_code": "SKU999",
    "product_name": "测试商品",
    "old_price": 10.00,
    "new_price": 15.00,
    "operator": "测试员",
    "reason": "测试调价",
    "devices": [{"device_id": "ESL-TEST-001"}],
    "terminals": [{"terminal_id": "POS-TEST-001"}],
    "request_id": "REQ_TEST_001"
  }'
```

### 5. 模拟各种场景

```bash
# 模拟设备离线
curl -X POST http://localhost:3001/api/price-changes \
  -H "Content-Type: application/json" \
  -d '{
    "product_code": "SKU-OFF",
    "product_name": "离线测试",
    "old_price": 10.00,
    "new_price": 12.00,
    "operator": "测试员",
    "devices": [{"device_id": "ESL-OFF-001", "simulate_offline": true}],
    "terminals": [{"terminal_id": "POS-001"}]
  }'

# 模拟收银失败
curl -X POST http://localhost:3001/api/price-changes \
  -H "Content-Type: application/json" \
  -d '{
    "product_code": "SKU-CASH",
    "product_name": "收银失败测试",
    "old_price": 8.00,
    "new_price": 10.00,
    "operator": "测试员",
    "devices": [{"device_id": "ESL-001"}],
    "terminals": [{"terminal_id": "POS-FAIL-001", "simulate_failure": true}]
  }'

# 先创建一个促销活动（下次调价会被拦截）
curl -X POST http://localhost:3001/api/price-changes \
  -H "Content-Type: application/json" \
  -d '{
    "product_code": "SKU-PROMO",
    "product_name": "促销商品",
    "old_price": 20.00,
    "new_price": 15.00,
    "operator": "促销管理员",
    "reason": "五一促销",
    "promotion": {
      "promotion_name": "五一狂欢购",
      "rule_type": "DISCOUNT",
      "effect_start": "2026-05-01",
      "effect_end": "2026-05-31"
    },
    "devices": [{"device_id": "ESL-PROMO-001"}],
    "terminals": [{"terminal_id": "POS-PROMO-001"}]
  }'

# 对 SKU-PROMO 再次调价（会被拦截）
curl -X POST http://localhost:3001/api/price-changes \
  -H "Content-Type: application/json" \
  -d '{
    "product_code": "SKU-PROMO",
    "product_name": "促销商品",
    "old_price": 15.00,
    "new_price": 18.00,
    "operator": "调价员",
    "reason": "恢复原价",
    "devices": [{"device_id": "ESL-PROMO-001"}],
    "terminals": [{"terminal_id": "POS-PROMO-001"}]
  }'

# 使用 force: true 绕过拦截
curl -X POST http://localhost:3001/api/price-changes \
  -H "Content-Type: application/json" \
  -d '{
    "product_code": "SKU-PROMO",
    "product_name": "促销商品",
    "old_price": 15.00,
    "new_price": 18.00,
    "operator": "管理员",
    "reason": "强制恢复",
    "force": true,
    "devices": [{"device_id": "ESL-PROMO-001"}],
    "terminals": [{"terminal_id": "POS-PROMO-001"}]
  }'
```

### 6. 幂等测试
```bash
# 第一次
curl -X POST http://localhost:3001/api/price-changes \
  -H "Content-Type: application/json" \
  -d '{"product_code":"SKU-IDEMP","old_price":5,"new_price":6,"operator":"test","request_id":"REQ_IDEMP_001"}'

# 第二次（相同 request_id）
curl -X POST http://localhost:3001/api/price-changes \
  -H "Content-Type: application/json" \
  -d '{"product_code":"SKU-IDEMP","old_price":5,"new_price":6,"operator":"test","request_id":"REQ_IDEMP_001"}'
# 返回: {"idempotent": true, ...}
```

### 7. 回滚
```bash
curl -X POST http://localhost:3001/api/price-changes/3/rollback \
  -H "Content-Type: application/json" \
  -d '{"rollback_by":"管理员","rollback_reason":"价格错误","reissue":true}'
```

### 8. 补发
```bash
curl -X POST http://localhost:3001/api/price-changes/3/reissue \
  -H "Content-Type: application/json" \
  -d '{"operator":"管理员"}'
```

### 9. 统计数据
```bash
curl http://localhost:3000/api/statistics
```

### 10. 导出 CSV
```bash
# 全部导出
curl -o export.csv "http://localhost:3000/api/export/price-changes"

# 带筛选条件导出
curl -o failed.csv "http://localhost:3000/api/export/price-changes?status=MANUAL_CORRECTION_REQUIRED"
```

### 11. 批量导入
准备 `import.csv`:
```csv
product_code,product_name,old_price,new_price,reason,device_id,terminal_id
SKU-BATCH-01,批量商品1,10.00,12.00,批量调价,ESL-B01,POS-B01
SKU-BATCH-02,批量商品2,20.00,22.00,批量调价,ESL-B02,POS-B02
```

```bash
curl -X POST http://localhost:3001/api/price-changes/batch \
  -F "file=@import.csv" \
  -F "operator=批量操作员"
```

---

## 📊 报告查看

### 查看价差审计
访问 Web 界面，状态筛选为「需人工修正」，点击详情查看：
- 电子价签价 vs 收银价
- 价差金额
- 发现时间 / 解决时间
- 状态（OPEN / RESOLVED）

### 查看审计时间线
任意记录详情底部都有 **📜 审计时间线**，包含：
- SUBMITTED（提交）
- PROMOTION_INTERCEPTED（促销拦截）
- DEVICE_OFFLINE（设备离线）
- CASHIER_FAILURE（收银失败）
- PRICE_DISCREPANCY_DETECTED（价差检测）
- COMPLETED（处理完成）
- ROLLED_BACK（回滚）
- REISSUED（补发）
- DUPLICATE_SUBMISSION（重复提交）

每条都记录了：操作人、时间、详细信息。

---

## 💾 数据持久化

- 数据库文件: `data/audit.db`（SQLite）
- 重启服务后数据**不会丢失**
- 删除此文件可重置所有数据

---

## 📂 项目结构

```
xy10600/
├── package.json          # 依赖配置
├── README.md            # 本文档
├── server/
│   ├── index.js         # Express 服务入口
│   ├── database.js      # 数据库初始化
│   ├── services.js      # 业务逻辑（规则引擎）
│   └── seed.js          # 演示数据生成器
├── public/
│   └── index.html       # 前端单页应用
├── data/                # SQLite 数据库目录
└── uploads/             # 批量导入临时文件
```

---

## 🔧 故障排查

| 问题 | 解决 |
|------|------|
| 端口 3001 被占用 | 改 `server/index.js` 中的 `PORT` |
| 数据不显示 | 先执行 `npm run seed` 生成数据 |
| 导出乱码 | CSV 带 BOM，Excel 可正常打开 |
| 想重置数据 | 删除 `data/audit.db` 后重启服务 |
