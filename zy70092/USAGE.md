# 公交失物招领 API 服务 - 使用说明

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

### 3. 运行测试

打开新终端窗口：

```bash
npm test
```

## API 端点总览

### 基础接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/statuses | 获取所有状态定义 |

### 规则管理（可复查）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/rules | 获取所有规则 |
| PUT | /api/rules/:name | 更新规则值 |

### 线路车辆管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/bus-routes | 获取所有线路车辆 |
| POST | /api/bus-routes | 创建线路车辆 |

### 保管点管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/storage-points | 获取所有保管点 |

### 失物管理（核心）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/lost-items | 查询失物列表（支持多条件筛选） |
| GET | /api/lost-items/:id | 获取失物详情 |
| POST | /api/lost-items | 登记失物 |
| POST | /api/lost-items/:id/bind-route | 绑定线路车辆 |
| POST | /api/lost-items/:id/transfer | 发起保管流转 |
| POST | /api/lost-items/:id/confirm-arrival | 确认到达保管点 |
| GET | /api/lost-items/:id/history | 获取完整历史记录 |

### 认领管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/claims | 查询认领申请 |
| GET | /api/claims/:id | 获取认领详情 |
| POST | /api/claims | 提交认领申请 |
| POST | /api/claims/:id/review | 审核认领申请 |
| POST | /api/claims/:id/confirm-pickup | 确认领取 |

### 逾期处理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/process-overdue | 处理所有逾期失物 |

### 审计日志

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/audit-logs | 查询审计日志（支持按实体筛选） |

## 业务流程说明

### 完整主流程

```
司机上交失物
    ↓
POST /api/lost-items (登记)
    ↓
状态: REGISTERED
    ↓
POST /api/lost-items/:id/bind-route (绑定线路车辆)
    ↓
POST /api/lost-items/:id/transfer (发起流转)
    ↓
状态: IN_TRANSIT
    ↓
POST /api/lost-items/:id/confirm-arrival (确认到达)
    ↓
状态: IN_STORAGE
    ↓
POST /api/claims (乘客认领申请)
    ↓
状态: CLAIM_PENDING
    ↓
POST /api/claims/:id/review (审核通过)
    ↓
状态: CLAIMED
    ↓
POST /api/claims/:id/confirm-pickup (确认领取)
    ↓
流程完成
```

## 状态说明

### 失物状态 (ITEM_STATUSES)

- **REGISTERED**: 已登记，刚上交
- **IN_TRANSIT**: 运输中，正在流转
- **IN_STORAGE**: 在库，可认领
- **CLAIM_PENDING**: 认领审核中
- **CLAIMED**: 已认领
- **OVERDUE_NOTICE**: 逾期通知中
- **DONATED**: 已捐赠
- **DISCARDED**: 已丢弃

### 认领状态 (CLAIM_STATUSES)

- **PENDING**: 待审核
- **APPROVED**: 已批准
- **REJECTED**: 已拒绝
- **PICKED_UP**: 已领取

## 默认规则（可配置）

| 规则名 | 默认值 | 说明 |
|--------|--------|------|
| overdue_notice_days | 15 | 多少天后发送逾期通知 |
| overdue_donation_days | 90 | 多少天后捐赠 |
| claim_review_timeout_hours | 72 | 认领审核超时时间（小时） |
| min_claim_evidence_required | 2 | 认领所需最小证据数量 |
| storage_transfer_auto_approval | false | 保管流转是否自动审批 |

## 默认保管点

1. 公交总站失物招领处 (storage_001)
2. 东区中转站 (storage_002)
3. 西区中转站 (storage_003)

## curl 示例命令

### 1. 健康检查

```bash
curl http://localhost:3000/api/health
```

### 2. 获取规则列表

```bash
curl http://localhost:3000/api/rules
```

### 3. 更新规则

```bash
curl -X PUT http://localhost:3000/api/rules/overdue_notice_days \
  -H "Content-Type: application/json" \
  -H "x-operator: admin" \
  -d '{"value": "20"}'
```

### 4. 创建线路车辆

```bash
curl -X POST http://localhost:3000/api/bus-routes \
  -H "Content-Type: application/json" \
  -H "x-operator: admin" \
  -d '{
    "route_number": "101",
    "vehicle_number": "京A12345",
    "driver_name": "张师傅"
  }'
```

### 5. 登记失物

```bash
curl -X POST http://localhost:3000/api/lost-items \
  -H "Content-Type: application/json" \
  -H "x-operator: 张师傅" \
  -d '{
    "item_name": "黑色钱包",
    "description": "内有身份证和银行卡",
    "item_category": "钱包",
    "photos": ["http://example.com/photo1.jpg", "http://example.com/photo2.jpg"],
    "driver_name": "张师傅",
    "found_time": "2024-01-15T10:30:00Z",
    "current_storage_point_id": "storage_001",
    "estimated_value": 500,
    "special_marks": "左上角有磨损"
  }'
```

### 6. 查询失物

```bash
# 获取所有失物
curl http://localhost:3000/api/lost-items

# 按状态筛选
curl "http://localhost:3000/api/lost-items?status=IN_STORAGE"

# 按名称模糊查询
curl "http://localhost:3000/api/lost-items?item_name=钱包"

# 按线路查询
curl "http://localhost:3000/api/lost-items?route_number=101"
```

### 7. 绑定线路车辆

```bash
curl -X POST http://localhost:3000/api/lost-items/{ITEM_ID}/bind-route \
  -H "Content-Type: application/json" \
  -H "x-operator: admin" \
  -d '{"bus_route_id": "{ROUTE_ID}"}'
```

### 8. 发起保管流转

```bash
curl -X POST http://localhost:3000/api/lost-items/{ITEM_ID}/transfer \
  -H "Content-Type: application/json" \
  -H "x-operator: 管理员" \
  -d '{
    "to_storage_point_id": "storage_002",
    "reason": "物品分类存放",
    "notes": "需要转到东区中转站"
  }'
```

### 9. 确认到达

```bash
curl -X POST http://localhost:3000/api/lost-items/{ITEM_ID}/confirm-arrival \
  -H "Content-Type: application/json" \
  -H "x-operator: 东区中转站管理员"
```

### 10. 提交认领申请

```bash
curl -X POST http://localhost:3000/api/claims \
  -H "Content-Type: application/json" \
  -H "x-operator: 乘客自助" \
  -d '{
    "lost_item_id": "{ITEM_ID}",
    "claimant_name": "李先生",
    "claimant_phone": "13800138000",
    "claimant_id_number": "110101199001011234",
    "claim_description": "上周三乘坐101路时丢失的，钱包里有我的身份证",
    "proof_photos": ["http://example.com/proof1.jpg"]
  }'
```

### 11. 审核认领

```bash
# 审核通过
curl -X POST http://localhost:3000/api/claims/{CLAIM_ID}/review \
  -H "Content-Type: application/json" \
  -H "x-operator: 审核员小王" \
  -d '{
    "approved": true,
    "review_notes": "身份核实无误，物品描述匹配"
  }'

# 审核拒绝
curl -X POST http://localhost:3000/api/claims/{CLAIM_ID}/review \
  -H "Content-Type: application/json" \
  -H "x-operator: 审核员小王" \
  -d '{
    "approved": false,
    "review_notes": "描述不符，物品特征不匹配"
  }'
```

### 12. 确认领取

```bash
curl -X POST http://localhost:3000/api/claims/{CLAIM_ID}/confirm-pickup \
  -H "Content-Type: application/json" \
  -H "x-operator: 发件员小李"
```

### 13. 处理逾期物品

```bash
curl -X POST http://localhost:3000/api/process-overdue \
  -H "Content-Type: application/json" \
  -H "x-operator: 系统管理员"
```

### 14. 查看完整历史

```bash
curl http://localhost:3000/api/lost-items/{ITEM_ID}/history
```

### 15. 查看审计日志

```bash
# 所有日志
curl http://localhost:3000/api/audit-logs

# 按实体类型筛选
curl "http://localhost:3000/api/audit-logs?entity_type=lost_items"

# 按具体实体筛选
curl "http://localhost:3000/api/audit-logs?entity_type=lost_items&entity_id={ITEM_ID}"
```

## 关键规则说明

### 1. 照片要求
- 登记失物必须至少提供一张照片
- 避免因照片缺失导致认领困难

### 2. 重复认领防止
- 一个失物只能有一个待审核的认领申请
- 已认领的失物无法再次申请

### 3. 状态流转规则
- 只有 `IN_STORAGE` 状态的物品才能被认领
- 只有 `IN_TRANSIT` 状态才能确认到达
- 已认领、已捐赠的物品无法流转

### 4. 逾期处理
- 超过 `overdue_notice_days` (默认15天) 发送通知
- 超过 `overdue_donation_days` (默认90天) 自动捐赠

### 5. 审计追踪
- 所有关键操作都记录在 `audit_logs` 表
- 可以按实体类型和ID查询完整操作历史
- 操作者通过 `x-operator` 请求头标识

## 项目结构

```
.
├── server.js          # Express 服务器和 API 路由
├── services.js        # 业务服务层
├── rules.js           # 规则定义和状态检查
├── database.js        # 数据库初始化和管理
├── tests/
│   └── run-tests.js   # 集成测试
├── data.db            # SQLite 数据库文件（运行后创建）
├── package.json       # 项目配置
└── USAGE.md           # 本文档
```

## 数据模型关系图

```
bus_routes (线路车辆)
    │
    └─── 1:N ── lost_items (失物)
                       │
                       ├── 1:N ── storage_transfers (保管流转)
                       ├── 1:N ── claims (认领记录)
                       ├── 1:N ── overdue_processing (逾期处理)
                       └── 1:N ── audit_logs (审计日志)

storage_points (保管点)
    │
    └─── 1:N ── lost_items.current_storage_point_id
    │
    └─── 1:N ── storage_transfers.from_storage_point_id
    │
    └─── 1:N ── storage_transfers.to_storage_point_id

rules (规则配置)
    └── 所有业务规则可配置、可复查

audit_logs (审计日志)
    └── 所有实体的操作记录
```

## 下一步该查哪里？

1. **想了解当前规则配置？** → `GET /api/rules`
2. **想查看所有失物？** → `GET /api/lost-items`
3. **想追踪某件失物的完整历史？** → `GET /api/lost-items/:id/history`
4. **想查看谁做了什么操作？** → `GET /api/audit-logs`
5. **想处理逾期物品？** → `POST /api/process-overdue`
6. **想修改规则？** → `PUT /api/rules/:name`

## 运行测试

确保服务正在运行后：

```bash
npm test
```

测试覆盖：
- 基础功能验证
- 线路车辆绑定
- 失物登记
- 保管流转
- 认领申请和审核
- 多条件查询
- 边界情况验证
- 规则配置更新

## 注意事项

1. 操作者通过请求头 `x-operator` 标识，建议所有写操作都设置此字段
2. 数据库文件 `data.db` 会在首次运行时创建
3. 所有状态变更都有审计日志，可复查
4. 规则配置存储在数据库中，修改后立即生效
5. 建议定期调用 `POST /api/process-overdue` 处理逾期物品（可通过定时任务）
