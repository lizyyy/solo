# 渔船出港申报 API

渔船出港申报后台接口系统，支持出港核验、状态流转、人工修正及历史追溯。

## 技术栈

- Node.js + Express
- SQLite（better-sqlite3）
- UUID

## 项目结构

```
.
├── src/
│   ├── server.js          # 服务器入口
│   ├── database.js        # 数据库初始化
│   ├── services/
│   │   ├── baseDataService.js      # 基础数据服务
│   │   └── declarationService.js   # 申报业务服务
│   └── routes/
│       ├── boats.js        # 渔船路由
│       ├── crew.js         # 船员路由
│       ├── noFishingZones.js # 禁渔区路由
│       ├── declarations.js # 申报路由
│       └── stats.js        # 统计导出路由
├── tests/
│   └── test-main.js        # 测试套件
├── data/                   # 数据目录（自动创建）
└── package.json
```

## 安装与运行

```bash
# 安装依赖
npm install

# 启动服务
npm start
# 或
node src/server.js

# 运行测试
npm test
```

服务将在 `http://localhost:3000` 启动。

## 状态流转

```
pending (待审核)
    │
    ├─── approved (审核通过) ─── out_at_sea (已出港)
    │                                   │
    │                                   ├─── temporary_return (临时返港)
    │                                   │            │
    │                                   │            ├─── out_at_sea_again (再次出港)
    │                                   │            │           │
    │                                   │            │           ├─── temporary_return
    │                                   │            │           └─── returned (已返港)
    │                                   │            │                    │
    │                                   │            └─── returned        │
    │                                   │                                 │
    │                                   └─── returned ─────────────────────
    │                                                         │
    │                                                         └─── completed (完成)
    │
    └─── rejected (拒绝)
```

**终态**: `rejected`、`completed`

## API 接口

### 健康检查

```
GET /health
```

### 渔船管理

```
GET    /api/boats           # 获取所有渔船
GET    /api/boats/:id       # 获取单个渔船
POST   /api/boats           # 创建渔船
PUT    /api/boats/:id       # 更新渔船

# 创建渔船示例：
{
  "name": "渔船一号",
  "registration_number": "CY001",
  "crew_capacity": 5,
  "fuel_tank_capacity": 500
}
```

### 船员管理

```
GET    /api/crew            # 获取所有船员
GET    /api/crew/:id        # 获取单个船员
POST   /api/crew            # 创建船员
PUT    /api/crew/:id        # 更新船员

# 创建船员示例：
{
  "name": "张三",
  "id_card": "110101199001011234",
  "certificate_number": "CERT001",
  "certificate_type": "普通船员"
}
```

### 禁渔区管理

```
GET    /api/no-fishing-zones           # 获取所有禁渔区
GET    /api/no-fishing-zones/:id       # 获取单个禁渔区
POST   /api/no-fishing-zones           # 创建禁渔区
PUT    /api/no-fishing-zones/:id       # 更新禁渔区

# 创建禁渔区示例：
{
  "name": "渤海湾禁渔区",
  "description": "春季禁渔区域",
  "coordinates": [{"lat": 38.0, "lng": 121.0}],
  "start_date": "2026-05-01",
  "end_date": "2026-09-01"
}
```

### 申报管理

```
GET    /api/declarations               # 获取申报列表（支持过滤）
GET    /api/declarations/:id           # 获取申报详情（含关联数据）
POST   /api/declarations               # 创建申报

# 创建申报示例：
{
  "boat_id": "uuid",
  "departure_time": "2026-05-11T06:00:00.000Z",
  "expected_return_time": "2026-05-12T18:00:00.000Z",
  "intended_route": "东海渔场",
  "fuel_amount": 300,
  "crew_ids": ["crew-uuid-1", "crew-uuid-2"]
}

POST   /api/declarations/:id/approve      # 审核通过
POST   /api/declarations/:id/reject       # 审核拒绝
# 拒绝示例：
{ "reason": "船员证件过期" }

POST   /api/declarations/:id/departure    # 记录出港
POST   /api/declarations/:id/return       # 记录返港
# 返港示例：
{
  "actual_return_time": "2026-05-12T17:00:00.000Z",
  "return_reason": "渔获满载",
  "is_temporary": false,
  "remarks": "天气良好"
}

POST   /api/declarations/:id/re-departure # 再次出港
POST   /api/declarations/:id/complete     # 完成申报

POST   /api/declarations/:id/correct-status # 人工修正状态
# 修正示例：
{
  "new_status": "temporary_return",
  "changed_by": "执法人员A",
  "reason": "误操作修正：实际已临时返港"
}

POST   /api/declarations/:id/fuel         # 添加油料记录
# 油料记录示例：
{
  "record_type": "replenishment",
  "amount": 100,
  "remarks": "中途补给"
}
```

### 统计与导出

```
GET    /api/stats                        # 获取统计数据
GET    /api/stats/export                 # 导出申报数据（支持过滤参数）

# 过滤参数：
# - boat_id: 渔船ID
# - status: 状态
# - start_date: 开始日期
# - end_date: 结束日期
```

## 核心特性

### 1. 出港核验
- **船员核验**: 检查船员是否存在且处于激活状态，数量是否超过渔船承载量
- **油料核验**: 检查油料数量是否大于0且不超过油箱容量
- **渔船核验**: 检查渔船是否存在且处于激活状态

### 2. 状态流转规则
- 严格的状态流转控制，防止非法状态变更
- 终态（rejected/completed）不可再次变更
- 所有状态变更都记录历史

### 3. 人工修正机制
- 支持人工修正状态（绕过流转规则）
- 强制要求提供修正原因和操作人
- 修正记录在 `status_history` 中以 `change_type: 'manual_correction'` 标记
- 统计接口可查询被人工修正过的申报数量

### 4. 历史追溯
- 每次状态变更都会记录到 `status_history` 表
- 记录包括：旧状态、新状态、变更类型、操作人、变更原因、时间戳
- 申报详情接口返回完整的状态历史

### 5. 数据持久化
- 使用 SQLite 文件存储，重启后数据不丢失
- 数据文件位于 `data/fishing-boat.db`
- WAL 模式启用，并发性能更好

## 测试覆盖

测试套件包含以下场景：

1. **基础数据管理** - 渔船、船员、禁渔区的 CRUD
2. **出港核验** - 船员数量超限、油料超限、负数油料等边界情况
3. **完整主流程** - 申报→审核→出港→返港→完成
4. **临时返港流程** - 临时返港→再次出港→最终返港
5. **人工修正** - 状态修正、历史记录、统计一致性
6. **状态流转规则** - 非法状态变更拦截
7. **导出一致性** - 数据导出和过滤功能

运行测试：
```bash
npm test
```

## curl 命令示例

### 创建基础数据

```bash
# 创建渔船
curl -X POST http://localhost:3000/api/boats \
  -H "Content-Type: application/json" \
  -d '{"name":"测试船","registration_number":"TEST001","crew_capacity":5,"fuel_tank_capacity":500}'

# 创建船员
curl -X POST http://localhost:3000/api/crew \
  -H "Content-Type: application/json" \
  -d '{"name":"张三","id_card":"110101199001011234","certificate_number":"CERT001"}'
```

### 完整流程

```bash
# 创建申报
curl -X POST http://localhost:3000/api/declarations \
  -H "Content-Type: application/json" \
  -d '{"boat_id":"<船ID>","departure_time":"2026-05-11T06:00:00.000Z","expected_return_time":"2026-05-12T18:00:00.000Z","fuel_amount":300,"crew_ids":["<船员ID>"]}'

# 审核通过
curl -X POST http://localhost:3000/api/declarations/<申报ID>/approve

# 出港
curl -X POST http://localhost:3000/api/declarations/<申报ID>/departure

# 临时返港
curl -X POST http://localhost:3000/api/declarations/<申报ID>/return \
  -H "Content-Type: application/json" \
  -d '{"is_temporary":true,"return_reason":"补充物资"}'

# 再次出港
curl -X POST http://localhost:3000/api/declarations/<申报ID>/re-departure

# 最终返港
curl -X POST http://localhost:3000/api/declarations/<申报ID>/return \
  -H "Content-Type: application/json" \
  -d '{"is_temporary":false,"return_reason":"渔获完成"}'

# 完成申报
curl -X POST http://localhost:3000/api/declarations/<申报ID>/complete

# 人工修正状态
curl -X POST http://localhost:3000/api/declarations/<申报ID>/correct-status \
  -H "Content-Type: application/json" \
  -d '{"new_status":"temporary_return","changed_by":"执法人员A","reason":"误操作修正"}'

# 查看详情（含历史）
curl http://localhost:3000/api/declarations/<申报ID>

# 查看统计
curl http://localhost:3000/api/stats

# 导出数据
curl http://localhost:3000/api/stats/export?status=pending
```

## 数据导出格式

导出数据包含以下字段（服务于业务复核）：

- 申报编号
- 渔船名称
- 渔船注册号
- 计划出港时间
- 计划返港时间
- 航线
- 申报油料
- 当前状态
- 创建时间
- 更新时间

## 注意事项

1. 所有时间字段建议使用 ISO 8601 格式
2. 人工修正时必须提供新状态和修正原因
3. 终态（rejected/completed）无法再次变更，包括人工修正
4. 数据库文件存储在 `data/` 目录下，备份时请一并备份
