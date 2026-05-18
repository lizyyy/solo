# 🚁 低空巡检平台 - 航线临时禁飞 API

基于 Node.js + Express + SQLite 构建的航线临时禁飞管理服务，支持完整的禁飞申请、审批、恢复、冲突检测、批量导入校验等功能。

## ✨ 核心特性

- ✅ **完整状态流转**: 禁飞申请 → 已禁飞 → 已恢复
- ✅ **时间冲突检测**: 自动检测同航线时间重叠的禁飞记录
- ✅ **旧任务取消标记**: 禁飞生效时标记是否取消该航线旧任务
- ✅ **行级数据校验**: 批量导入时逐行校验，保留校验结果
- ✅ **操作历史追溯**: 完整记录每次状态变更的操作人和备注
- ✅ **CSV导出功能**: 支持导出禁飞记录列表

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 初始化种子数据

```bash
npm run seed
```

执行后会创建测试数据，包含：
- 3条巡检航线（A/B/C区）
- 3台无人机设备
- 3位申请人（运维部、安全部、飞行调度中心）
- 3条不同状态的禁飞记录

### 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

## 📡 API 接口说明

### 基础信息

```bash
# 健康检查
curl http://localhost:3000/api/health

# 获取状态说明
curl http://localhost:3000/api/no-fly/status-info

# 获取参考数据（航线、无人机、申请人列表）
curl http://localhost:3000/api/no-fly/reference
```

### 禁飞记录管理

```bash
# 创建禁飞申请
curl -X POST http://localhost:3000/api/no-fly \
  -H "Content-Type: application/json" \
  -d '{
    "route_id": "航线ID",
    "drone_id": "无人机ID（可选）",
    "start_time": "2024-01-01T00:00:00.000Z",
    "end_time": "2024-01-02T00:00:00.000Z",
    "applicant_id": "申请人ID",
    "reason": "禁飞原因说明（至少5个字符）",
    "cancel_older_tasks": true
  }'

# 获取禁飞记录列表
curl http://localhost:3000/api/no-fly

# 按状态筛选
curl "http://localhost:3000/api/no-fly?status=approved"

# 按航线筛选
curl "http://localhost:3000/api/no-fly?route_id=xxx"

# 获取单条记录详情（含历史记录）
curl http://localhost:3000/api/no-fly/{记录ID}

# 获取单条记录的历史变更
curl http://localhost:3000/api/no-fly/{记录ID}/history
```

### 状态流转

```bash
# 审批通过（禁飞生效）
curl -X PATCH http://localhost:3000/api/no-fly/{记录ID}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "operator": "审批人姓名",
    "remark": "审批意见"
  }'

# 恢复通航
curl -X PATCH http://localhost:3000/api/no-fly/{记录ID}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "restored",
    "operator": "操作人姓名",
    "remark": "恢复原因"
  }'
```

### 批量导入与校验

```bash
# 批量导入禁飞记录
curl -X POST http://localhost:3000/api/no-fly/import \
  -H "Content-Type: application/json" \
  -d '{
    "rows": [
      {
        "route_code": "ROUTE-A-001",
        "drone_code": "DRONE-M300-001",
        "applicant_name": "张三",
        "start_time": "2024-01-01T00:00:00.000Z",
        "end_time": "2024-01-02T00:00:00.000Z",
        "reason": "禁飞原因",
        "cancel_older_tasks": true
      }
    ],
    "batchId": "可选批次ID"
  }'

# 获取导入校验结果
curl http://localhost:3000/api/no-fly/import/{批次ID}/validation
```

### 导出功能

```bash
# 导出所有禁飞记录为CSV
curl http://localhost:3000/api/no-fly/export -o no_fly_records.csv

# 按状态筛选导出
curl "http://localhost:3000/api/no-fly/export?status=approved" -o approved_records.csv
```

## 🧪 运行验收测试

```bash
npm test
```

测试场景包括：
1. ✅ **完整状态流转**: 创建申请 → 查看详情 → 审批通过 → 恢复通航 → 查看历史
2. ✅ **时间冲突检测**: 创建已生效禁飞记录 → 再次创建时间重叠记录 → 验证冲突检测
3. ✅ **导入坏行校验**: 批量导入包含合法数据和坏数据 → 验证行级校验结果
4. ✅ **列表详情对齐**: 筛选列表 → 验证列表与详情数据一致性 → 导出CSV

## 📊 状态说明

| 状态值 | 状态说明 | 可流转到 |
|--------|----------|----------|
| `pending` | 禁飞申请（待审批） | `approved`, `flowable` |
| `approved` | 已禁飞（生效中） | `restored` |
| `restored` | 已恢复（禁飞解除） | 无（最终状态） |
| `flowable` | 可飞（驳回申请） | `pending` |

## 🗄️ 数据库结构

### 主要数据表

1. **routes** - 航线表
2. **drones** - 无人机表
3. **applicants** - 申请人表
4. **no_fly_records** - 禁飞记录表
5. **no_fly_history** - 禁飞历史表
6. **import_validation** - 导入校验记录表

数据库文件位置：`./data/database.db`

## 📂 项目结构

```
.
├── src/
│   ├── app.js                 # 应用入口
│   ├── database/
│   │   └── init.js            # 数据库初始化
│   ├── models/
│   │   └── NoFlyRecord.js     # 数据模型和校验逻辑
│   ├── repositories/
│   │   ├── NoFlyRepository.js # 禁飞数据访问
│   │   └── ReferenceRepository.js # 参考数据访问
│   ├── services/
│   │   └── NoFlyService.js    # 业务逻辑层
│   ├── controllers/
│   │   └── NoFlyController.js # 控制器
│   ├── routes/
│   │   └── noFlyRoutes.js     # 路由配置
│   └── scripts/
│       ├── seed.js            # 种子数据脚本
│       └── test.js            # 验收测试脚本
├── data/                      # 数据库文件目录
├── package.json
└── README.md
```

## ⚠️ 边界处理说明

1. **静默覆盖防护**: 创建新禁飞记录前自动检测时间冲突，检测到冲突时返回错误信息，不会覆盖旧记录
2. **旧任务取消标记**: `cancel_older_tasks` 字段标记禁飞生效后是否需要取消该航线旧任务
3. **非法状态拦截**: 不允许直接从 `restored`（已恢复）变更为其他状态
4. **行级校验**: 批量导入时每条数据独立校验，合法数据入库，坏数据保留校验错误信息

## 🔧 开发模式

```bash
# 使用 nodemon 启动（代码变更自动重启）
npm run dev
```

## 📝 日志说明

- 数据库连接状态
- API请求错误
- 禁飞审批通过时的旧任务取消提示

---

**验收顺序**: `npm install` → `npm run seed` → `npm start` → `npm test`