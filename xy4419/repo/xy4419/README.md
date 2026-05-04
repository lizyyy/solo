# Camera Repair Tool - 二手相机维修铺本地管理工具

一个专为二手相机维修铺设计的本地管理工具，支持数据扫描导入、异常检测、状态管理和数据导出。

## 功能特性

- **数据扫描**：扫描送修单 CSV、快门测试 CSV、配件到货 JSON 和维修照片目录
- **归档存储**：按机身编号统一归档到 SQLite 数据库
- **异常检测**：自动识别快门次数异常、配件未到、照片缺失、同机身重复送修
- **状态管理**：标记客户已通知、更新订单状态
- **数据导出**：导出 Markdown 交接单和完整 JSON 审计包
- **HTTP 接口**：提供本地 REST API 用于查询和管理数据

## 项目结构

```
.
├── src/
│   ├── index.js          # 主入口文件
│   ├── cli.js            # 命令行工具
│   ├── server.js         # HTTP 服务
│   ├── database.js       # 数据库模块
│   ├── scanner.js        # 数据扫描模块
│   ├── service.js        # 业务逻辑模块
│   └── exporter.js       # 数据导出模块
├── examples/
│   ├── repair_orders.csv      # 送修单样例
│   ├── shutter_tests.csv      # 快门测试样例
│   ├── accessories.json       # 配件到货样例
│   └── photos/                 # 维修照片目录样例
├── package.json
└── README.md
```

## 安装

```bash
npm install
```

## 快速开始

### 1. 扫描样例数据

```bash
# 扫描所有样例数据
node src/cli.js scan \
  --orders examples/repair_orders.csv \
  --shutter examples/shutter_tests.csv \
  --accessories examples/accessories.json \
  --photos examples/photos
```

### 2. 运行异常检测

```bash
node src/cli.js recheck --list
```

### 3. 查看订单列表

```bash
node src/cli.js status
```

### 4. 导出交接单

```bash
# 在控制台打印交接单
node src/cli.js export --handover R2026001 --print

# 导出为文件
node src/cli.js export --handover R2026001 --output ./output
```

### 5. 启动 HTTP 服务

```bash
npm start
```

服务启动后访问 http://localhost:3000 查看 API 文档。

## 命令行使用

### scan - 扫描数据

```bash
# 扫描送修单
node src/cli.js scan --orders <csv文件路径>

# 扫描快门测试
node src/cli.js scan --shutter <csv文件路径>

# 扫描配件到货
node src/cli.js scan --accessories <json文件路径>

# 扫描维修照片目录
node src/cli.js scan --photos <目录路径>

# 组合扫描
node src/cli.js scan \
  --orders orders.csv \
  --shutter tests.csv \
  --accessories parts.json \
  --photos ./photos
```

### recheck - 异常检测

```bash
# 运行所有异常检测
node src/cli.js recheck

# 运行检测并列出未解决的异常
node src/cli.js recheck --list

# 标记异常为已解决
node src/cli.js recheck --resolve <异常ID>
```

### status - 订单状态管理

```bash
# 列出所有订单
node src/cli.js status

# 更新订单状态
node src/cli.js status <订单号> --set <状态>

# 状态选项: pending, in_progress, waiting_parts, completed, cancelled
node src/cli.js status R2026001 --set in_progress
```

### notify - 客户通知管理

```bash
# 标记为已通知
node src/cli.js notify <订单号>

# 标记为未通知
node src/cli.js notify <订单号> --status no
```

### export - 数据导出

```bash
# 打印交接单到控制台
node src/cli.js export --handover <订单号> --print

# 导出交接单到文件
node src/cli.js export --handover <订单号> --output ./output

# 导出完整审计包
node src/cli.js export --audit --output ./output
```

## HTTP API 接口

服务默认运行在 http://localhost:3000

### 查询接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/` | API 根目录，列出所有接口 |
| GET | `/api/orders` | 获取所有订单 |
| GET | `/api/orders?status=pending` | 按状态筛选订单 |
| GET | `/api/orders/:orderNo` | 获取订单完整详情 |
| GET | `/api/orders/serial/:serial` | 按机身编号查询订单 |
| GET | `/api/anomalies` | 获取未解决的异常列表 |
| GET | `/api/stats` | 获取统计信息 |
| GET | `/api/orders/:orderNo/handover` | 获取交接单 (JSON格式) |
| GET | `/api/orders/:orderNo/handover?format=markdown` | 获取交接单 (纯Markdown) |
| GET | `/api/audit` | 获取完整审计包 |

### 操作接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/scan` | 执行数据扫描 (需提供文件路径) |
| POST | `/api/recheck` | 重新运行异常检测 |
| POST | `/api/orders/:orderNo/notify` | 标记客户已通知 |
| PUT | `/api/orders/:orderNo/status` | 更新订单状态 |
| POST | `/api/anomalies/:id/resolve` | 标记异常为已解决 |

### API 使用示例

```bash
# 获取所有订单
curl http://localhost:3000/api/orders

# 获取订单详情
curl http://localhost:3000/api/orders/R2026001

# 按机身编号查询
curl http://localhost:3000/api/orders/serial/NIK789456123

# 标记客户已通知
curl -X POST http://localhost:3000/api/orders/R2026001/notify \
  -H "Content-Type: application/json" \
  -d '{"status": true}'

# 更新订单状态
curl -X PUT http://localhost:3000/api/orders/R2026001/status \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'

# 重新运行异常检测
curl -X POST http://localhost:3000/api/recheck
```

## 数据格式说明

### 送修单 CSV 格式

| 字段 | 说明 |
|------|------|
| order_no | 订单号 (唯一) |
| body_serial | 机身编号 |
| customer_name | 客户姓名 |
| customer_phone | 客户电话 |
| camera_model | 相机型号 |
| problem_description | 问题描述 |
| receive_date | 接收日期 |
| estimated_cost | 预计费用 |
| status | 状态 |
| notified | 是否已通知客户 (0/1) |

### 快门测试 CSV 格式

| 字段 | 说明 |
|------|------|
| test_id | 测试编号 (唯一) |
| body_serial | 机身编号 |
| test_date | 测试日期 |
| shutter_count | 快门次数 |
| shutter_speed | 测试快门速度 |
| accuracy_result | 准确性结果 |
| notes | 备注 |

### 配件到货 JSON 格式

```json
[
  {
    "part_id": "P2026001",
    "body_serial": "NIK789456123",
    "part_name": "快门组件",
    "part_number": "NIK-SH-D750",
    "ordered_date": "2026-04-28",
    "arrived_date": "2026-04-30",
    "quantity": 1,
    "cost": 850.00,
    "status": "arrived"
  }
]
```

### 维修照片命名规范

照片文件名中建议包含机身编号，系统会自动识别：

- `{机身编号}_before.jpg` - 维修前照片
- `{机身编号}_after.jpg` - 维修后照片
- `{机身编号}_damage.jpg` - 损坏照片
- `{机身编号}_test.jpg` - 测试照片

例如：`NIK789456123_before_repair.jpg`

## 异常检测规则

| 异常类型 | 检测规则 |
|----------|----------|
| 快门次数异常 | 快门次数 < 0 或 > 1,000,000 |
| 配件未到货 | 配件状态非 'arrived' 且无到货日期 |
| 照片缺失 | 进行中订单无关联照片 |
| 重复送修 | 同一机身编号存在多个活跃订单 |

## 订单状态

| 状态 | 说明 |
|------|------|
| pending | 待处理 |
| in_progress | 维修中 |
| waiting_parts | 等待配件 |
| completed | 已完成 |
| cancelled | 已取消 |

## 数据库说明

数据存储在当前目录的 `repair_data.db` SQLite 文件中。

主要数据表：

- `repair_orders` - 送修单
- `shutter_tests` - 快门测试记录
- `accessories` - 配件记录
- `repair_photos` - 照片记录
- `anomalies` - 异常记录

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | HTTP 服务端口 | 3000 |
| DB_PATH | 数据库文件路径 | ./repair_data.db |

## 许可证

MIT
