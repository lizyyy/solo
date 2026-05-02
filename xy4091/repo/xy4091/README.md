# 血袋临期调拨台

医院输血科值班员专用的本地后端 API 服务，用于血袋库存管理、病区申请、智能匹配和状态流转。

## 功能特性

- **血袋入库**: 支持单条录入和批量 CSV 导入
- **病区申请**: 支持不同紧急程度的用血申请
- **智能匹配**: 血型兼容性匹配 + 临期优先策略
- **状态流转**: 可用 → 预留 → 出库 → 释放/取消
- **温控异常拦截**: 自动检测温度异常血袋，禁止出库
- **临期优先**: 优先推荐即将过期的血袋，减少浪费
- **审计查询**: 完整的操作日志记录
- **报告导出**: 支持 Markdown/CSV 值班报告

## 技术栈

- Node.js + TypeScript
- Express (Web 框架)
- SQLite (数据持久化)
- better-sqlite3 (SQLite 驱动)
- Jest (测试框架)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 创建数据目录

```bash
mkdir -p data
```

### 3. 初始化示例数据 (可选)

```bash
npm run seed
```

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 或者编译后启动
npm run build
npm start
```

服务默认运行在 `http://localhost:3000`

### 5. 运行测试

```bash
npm test
```

---

## API 端点完整流程示例

### 环境准备

```bash
# 设置基础 URL 变量
BASE_URL=http://localhost:3000/api
```

### 步骤 1: 健康检查

```bash
curl -X GET "$BASE_URL/health"
```

预期响应:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "...",
    "service": "血袋临期调拨台",
    "version": "1.0.0"
  },
  "timestamp": "..."
}
```

### 步骤 2: 创建病区

```bash
# 创建内科 ICU
curl -X POST "$BASE_URL/wards" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "内科ICU",
    "code": "ICU-01",
    "department": "内科",
    "floor": 5,
    "contactPerson": "张医生",
    "contactPhone": "13800138001"
  }'

# 创建急诊科
curl -X POST "$BASE_URL/wards" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "急诊科",
    "code": "ER-01",
    "department": "急诊",
    "floor": 1,
    "contactPerson": "李医生",
    "contactPhone": "13800138002"
  }'
```

获取病区列表:
```bash
curl -X GET "$BASE_URL/wards"
```

### 步骤 3: 血袋入库

#### 方式 A: 单条录入

```bash
# 计算日期 (30天后过期, 10天前采集)
EXPIRY_DATE=$(date -v+30d -u +"%Y-%m-%dT%H:%M:%SZ")
COLLECTION_DATE=$(date -v-10d -u +"%Y-%m-%dT%H:%M:%SZ")

# A+ 型红细胞 (常规库存)
curl -X POST "$BASE_URL/blood-bags" \
  -H "Content-Type: application/json" \
  -d "{
    \"bloodType\": \"A+\",
    \"componentType\": \"RED_CELL\",
    \"volume\": 200,
    \"donorId\": \"D001\",
    \"collectionDate\": \"$COLLECTION_DATE\",
    \"expiryDate\": \"$EXPIRY_DATE\",
    \"crossMatchStatus\": \"COMPATIBLE\",
    \"initialTemperature\": 4.0,
    \"notes\": \"常规库存\"
  }"

# A+ 型红细胞 (临期, 2天后过期)
EXPIRY_SOON=$(date -v+2d -u +"%Y-%m-%dT%H:%M:%SZ")
COLLECTION_OLD=$(date -v-28d -u +"%Y-%m-%dT%H:%M:%SZ")

curl -X POST "$BASE_URL/blood-bags" \
  -H "Content-Type: application/json" \
  -d "{
    \"bloodType\": \"A+\",
    \"componentType\": \"RED_CELL\",
    \"volume\": 200,
    \"donorId\": \"D002\",
    \"collectionDate\": \"$COLLECTION_OLD\",
    \"expiryDate\": \"$EXPIRY_SOON\",
    \"crossMatchStatus\": \"COMPATIBLE\",
    \"initialTemperature\": 3.8,
    \"notes\": \"临期血袋\"
  }"

# B+ 型红细胞
curl -X POST "$BASE_URL/blood-bags" \
  -H "Content-Type: application/json" \
  -d "{
    \"bloodType\": \"B+\",
    \"componentType\": \"RED_CELL\",
    \"volume\": 200,
    \"donorId\": \"D003\",
    \"collectionDate\": \"$COLLECTION_DATE\",
    \"expiryDate\": \"$EXPIRY_DATE\",
    \"crossMatchStatus\": \"COMPATIBLE\",
    \"initialTemperature\": 4.1,
    \"notes\": \"\"
  }"

# AB+ 型血浆
curl -X POST "$BASE_URL/blood-bags" \
  -H "Content-Type: application/json" \
  -d "{
    \"bloodType\": \"AB+\",
    \"componentType\": \"PLASMA\",
    \"volume\": 250,
    \"donorId\": \"D004\",
    \"collectionDate\": \"$COLLECTION_DATE\",
    \"expiryDate\": \"$(date -v+360d -u +"%Y-%m-%dT%H:%M:%SZ")\",
    \"crossMatchStatus\": \"NOT_REQUIRED\",
    \"initialTemperature\": -25.0,
    \"notes\": \"新鲜冰冻血浆\"
  }"
```

#### 方式 B: 批量 CSV 导入

查看示例 CSV 文件:
```bash
cat data/sample_inventory.csv
```

导入 CSV:
```bash
# 读取 CSV 文件内容
CSV_CONTENT=$(cat data/sample_inventory.csv)

# 导入
curl -X POST "$BASE_URL/reports/import" \
  -H "Content-Type: application/json" \
  -d "{
    \"csvContent\": \"bloodType,componentType,volume,donorId,collectionDate,expiryDate,crossMatchStatus,initialTemperature,notes
A+,RED_CELL,200,D020,2026-04-20T10:00:00Z,2026-05-20T10:00:00Z,COMPATIBLE,4.0,CSV导入测试1
B+,PLASMA,250,D021,2026-04-15T09:00:00Z,2027-04-15T09:00:00Z,NOT_REQUIRED,-25.0,CSV导入测试2\",
    \"operator\": \"张值班\"
  }"
```

CSV 字段说明:
| 字段 | 说明 | 示例 |
|------|------|------|
| bloodType | 血型 | A+, B-, O+, AB+ |
| componentType | 成分类型 | RED_CELL(红细胞), PLASMA(血浆) |
| volume | 容量 (ml) | 200 |
| donorId | 献血者ID | D001 |
| collectionDate | 采集日期 (ISO) | 2026-04-20T10:00:00Z |
| expiryDate | 有效期 (ISO) | 2026-05-20T10:00:00Z |
| crossMatchStatus | 配血状态 | COMPATIBLE, PENDING, NOT_REQUIRED |
| initialTemperature | 初始温度 | 4.0 |
| notes | 备注 | 常规库存 |

### 步骤 4: 查询血袋库存

```bash
# 获取所有血袋
curl -X GET "$BASE_URL/blood-bags"

# 筛选 A+ 型血袋
curl -X GET "$BASE_URL/blood-bags?bloodType=A%2B"

# 筛选可用状态
curl -X GET "$BASE_URL/blood-bags?status=AVAILABLE"

# 查看临期血袋 (48小时内)
curl -X GET "$BASE_URL/blood-bags?isExpiringSoon=true&expiringWithinHours=48"

# 查看有温控异常的血袋
curl -X GET "$BASE_URL/blood-bags?hasTemperatureAnomaly=true"
```

### 步骤 5: 病区申请用血

首先获取病区 ID:
```bash
# 获取病区列表
curl -X GET "$BASE_URL/wards"

# 保存第一个病区 ID
WARD_ID=$(curl -s "$BASE_URL/wards" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).data[0].id)")
```

创建用血申请:
```bash
# 内科 ICU 申请 A+ 型红细胞 2 袋 (紧急)
curl -X POST "$BASE_URL/applications" \
  -H "Content-Type: application/json" \
  -d "{
    \"wardId\": \"$WARD_ID\",
    \"patientName\": \"王建国\",
    \"patientId\": \"P20260502001\",
    \"bloodType\": \"A+\",
    \"componentType\": \"RED_CELL\",
    \"quantity\": 2,
    \"urgency\": \"URGENT\",
    \"clinicalDiagnosis\": \"上消化道出血\",
    \"specialRequirements\": null,
    \"crossMatchRequired\": true,
    \"requestedBy\": \"张医生\",
    \"notes\": \"夜班紧急申请\"
  }"
```

紧急程度选项:
- `ROUTINE`: 常规
- `URGENT`: 紧急
- `EMERGENCY`: 急诊抢救

查询申请单:
```bash
# 获取所有申请单
curl -X GET "$BASE_URL/applications"

# 按状态筛选
curl -X GET "$BASE_URL/applications?status=PENDING"

# 按紧急程度筛选
curl -X GET "$BASE_URL/applications?urgency=URGENT"
```

### 步骤 6: 智能匹配推荐

```bash
# 获取申请单 ID
APP_ID=$(curl -s "$BASE_URL/applications?status=PENDING" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).data[0].id)")

# 查看匹配结果 (GET, 仅查询不更新状态)
curl -X GET "$BASE_URL/applications/$APP_ID/match"
```

匹配规则说明:
1. **血型兼容**: 基于输血相容性规则
   - A+ 可接受: A+, A-, O+, O-
   - O- (万能供血者): 可输给所有血型
   - AB+ (万能受血者): 可接受所有血型

2. **临期优先**: 即将过期的血袋优先推荐
   - 24小时内到期: 最高优先级
   - 48小时内到期: 次高优先级

3. **温控检查**: 温度异常血袋自动排除
   - 红细胞保存温度: 2-6℃
   - 温度波动超过 2℃ 标记异常

匹配响应示例:
```json
{
  "success": true,
  "data": {
    "applicationId": "...",
    "matchedBags": [
      {
        "bloodBagId": "...",
        "bloodType": "A+",
        "componentType": "RED_CELL",
        "expiryDate": "2026-05-04T...",
        "hoursUntilExpiry": 47.5,
        "crossMatchStatus": "COMPATIBLE",
        "hasTemperatureAnomaly": false,
        "matchScore": 100,
        "matchReason": "血型完全匹配; 临期优先(48小时内到期); 交叉配血相容"
      },
      ...
    ],
    "score": 95,
    "canFulfill": true,
    "missingQuantity": 0,
    "warnings": []
  },
  "timestamp": "..."
}
```

### 步骤 7: 确认匹配并预留血袋

#### 方式 A: 自动匹配预留

```bash
# 执行匹配并更新申请状态为 MATCHED
curl -X POST "$BASE_URL/applications/$APP_ID/match" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "李值班",
    "notes": "夜班确认匹配"
  }'

# 查看更新后的申请单状态
curl -X GET "$BASE_URL/applications/$APP_ID"
```

#### 方式 B: 直接预留 (自动匹配)

```bash
# 直接执行预留操作 (会自动匹配最合适的血袋)
curl -X POST "$BASE_URL/applications/$APP_ID/reserve" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "李值班",
    "notes": "夜班预留血袋"
  }'
```

#### 方式 C: 手动指定血袋预留

```bash
# 先获取可用的 A+ 型血袋 ID
curl -X GET "$BASE_URL/blood-bags?bloodType=A%2B&status=AVAILABLE"

# 手动指定血袋 ID 预留
curl -X POST "$BASE_URL/applications/$APP_ID/reserve" \
  -H "Content-Type: application/json" \
  -d '{
    "bloodBagIds": ["血袋ID1", "血袋ID2"],
    "operator": "李值班",
    "notes": "手动选择血袋"
  }'
```

验证预留结果:
```bash
# 查看申请单状态 (应为 RESERVED)
curl -X GET "$BASE_URL/applications/$APP_ID"

# 查看血袋状态 (应为 RESERVED)
curl -X GET "$BASE_URL/blood-bags?status=RESERVED"
```

### 步骤 8: 温度记录 (可选)

值班期间记录血袋温度:
```bash
# 获取一个血袋 ID
BAG_ID=$(curl -s "$BASE_URL/blood-bags?status=RESERVED" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).data[0].id)")

# 添加温度记录 (正常温度)
curl -X POST "$BASE_URL/blood-bags/$BAG_ID/temperature" \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 3.8,
    "location": "夜班检查"
  }'

# 添加异常温度记录 (会触发警告)
curl -X POST "$BASE_URL/blood-bags/$BAG_ID/temperature" \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 8.0,
    "location": "异常测试"
  }'
```

温控规则:
- 正常范围: 1-6℃
- 异常情况:
  - 温度 < 1℃ 或 > 6℃
  - 30分钟至4小时内温度波动超过 2℃

温控异常的血袋无法预留/出库!

### 步骤 9: 血袋出库发放

```bash
# 获取申请单 ID (确保状态为 RESERVED)
curl -X GET "$BASE_URL/applications?status=RESERVED"

# 执行出库
curl -X POST "$BASE_URL/applications/$APP_ID/issue" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "李值班",
    "notes": "交予病区护士"
  }'
```

验证出库结果:
```bash
# 查看申请单状态 (应为 ISSUED)
curl -X GET "$BASE_URL/applications/$APP_ID"

# 查看血袋状态 (应为 ISSUED)
curl -X GET "$BASE_URL/blood-bags?status=ISSUED"
```

### 步骤 10: 取消申请 (可选)

如果申请单不需要了，可以取消:

```bash
# 创建一个新的测试申请单
TEST_APP=$(curl -s -X POST "$BASE_URL/applications" \
  -H "Content-Type: application/json" \
  -d "{
    \"wardId\": \"$WARD_ID\",
    \"patientName\": \"测试患者\",
    \"patientId\": \"TEST001\",
    \"bloodType\": \"B+\",
    \"componentType\": \"RED_CELL\",
    \"quantity\": 1,
    \"urgency\": \"ROUTINE\",
    \"clinicalDiagnosis\": \"测试\",
    \"crossMatchRequired\": true,
    \"requestedBy\": \"测试\"
  }" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).data.id)")

# 取消申请
curl -X POST "$BASE_URL/applications/$TEST_APP/cancel" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "李值班",
    "notes": "患者病情稳定，暂不需要"
  }'
```

如果申请单已预留血袋，取消时会自动释放血袋。

### 步骤 11: 审计查询

```bash
# 获取所有审计日志
curl -X GET "$BASE_URL/audit"

# 按实体类型筛选
curl -X GET "$BASE_URL/audit?entityType=APPLICATION"
curl -X GET "$BASE_URL/audit?entityType=BLOOD_BAG"

# 按操作类型筛选
curl -X GET "$BASE_URL/audit?action=ISSUE"
curl -X GET "$BASE_URL/audit?action=RESERVE"

# 按操作人筛选
curl -X GET "$BASE_URL/audit?operator=李值班"

# 按时间范围筛选
curl -X GET "$BASE_URL/audit?startDate=$(date -v-1d -u +"%Y-%m-%dT%H:%M:%SZ")&endDate=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
```

### 步骤 12: 导出报告

#### 导出库存 CSV

```bash
# 导出当前库存为 CSV (浏览器会触发下载)
curl -X GET "$BASE_URL/reports/inventory/csv" -o inventory.csv

# 查看导出的文件
cat inventory.csv
```

#### 生成值班报告

```bash
# 生成 Markdown 格式报告 (默认)
curl -X GET "$BASE_URL/reports/shift-report" -o shift_report.md

# 生成 CSV 格式报告
curl -X GET "$BASE_URL/reports/shift-report?format=csv" -o shift_report.csv

# 指定时间范围
curl -X GET "$BASE_URL/reports/shift-report?startDate=$(date -v-12h -u +"%Y-%m-%dT%H:%M:%SZ")&endDate=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
```

查看 Markdown 报告:
```bash
cat shift_report.md
```

报告包含:
1. 库存概览 (按血型统计)
2. 状态统计 (可用/预留/出库/过期)
3. 临期血袋明细 (48小时内)
4. 本班申请单列表
5. 本班出库记录

### 步骤 13: 查看血型兼容性表

```bash
curl -X GET "$BASE_URL/reports/blood-type-compatibility"
```

---

## 状态流转图

### 血袋状态

```
AVAILABLE (可用)
    │
    ├──► RESERVE ──► RESERVED (预留)
    │                   │
    │                   ├──► RELEASE ──► AVAILABLE
    │                   │
    │                   └──► ISSUE ────► ISSUED (出库)
    │
    ├──► ISSUE ────► ISSUED (直接出库)
    │
    ├──► EXPIRE ───► EXPIRED (过期)
    │
    └──► QUARANTINE ─► QUARANTINE (隔离)
```

### 申请单状态

```
PENDING (待处理)
    │
    ├──► MATCH ──► MATCHED (已匹配)
    │                  │
    │                  └──► RESERVE ──► RESERVED (已预留)
    │                                         │
    │                                         └──► ISSUE ──► ISSUED (已出库)
    │
    ├──► RESERVE ──► RESERVED (跳过匹配直接预留)
    │
    ├──► CANCEL ──► CANCELLED (已取消)
    │
    └──► REJECT ──► REJECTED (已拒绝)
```

---

## 数据模型

### BloodBag (血袋)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| bloodType | enum | 血型: A+, A-, B+, B-, AB+, AB-, O+, O- |
| componentType | enum | 成分类型: RED_CELL, PLASMA, PLATELET, CRYOPRECIPITATE |
| volume | number | 容量 (ml) |
| donorId | string | 献血者 ID |
| collectionDate | string | 采集日期 (ISO) |
| expiryDate | string | 有效期 (ISO) |
| crossMatchStatus | enum | 配血状态: PENDING, COMPATIBLE, INCOMPATIBLE, NOT_REQUIRED |
| temperatureRecords | array | 温控记录 |
| status | enum | 状态: AVAILABLE, RESERVED, ISSUED, EXPIRED, QUARANTINE |
| reservedForApplicationId | string | 预留的申请单 ID |
| issuedToWardId | string | 出库到的病区 ID |

### Application (申请单)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| wardId | string | 病区 ID |
| patientName | string | 患者姓名 |
| patientId | string | 患者 ID |
| bloodType | enum | 需求血型 |
| componentType | enum | 需求成分类型 |
| quantity | number | 需求数量 |
| urgency | enum | 紧急程度: ROUTINE, URGENT, EMERGENCY |
| clinicalDiagnosis | string | 临床诊断 |
| crossMatchRequired | boolean | 是否需要交叉配血 |
| status | enum | 状态: PENDING, MATCHED, RESERVED, ISSUED, CANCELLED, REJECTED |
| reservedBloodBagIds | array | 已预留血袋 ID 列表 |
| issuedBloodBagIds | array | 已出库血袋 ID 列表 |

---

## 项目结构

```
├── src/
│   ├── index.ts              # 入口文件
│   ├── app.ts                # Express 应用配置
│   ├── types/                # 类型定义
│   │   ├── index.ts
│   │   ├── common.ts
│   │   ├── bloodBag.ts
│   │   ├── application.ts
│   │   ├── ward.ts
│   │   └── auditLog.ts
│   ├── storage/              # 数据存储层
│   │   ├── index.ts
│   │   ├── database.ts       # SQLite 连接和初始化
│   │   ├── bloodBagStorage.ts
│   │   ├── applicationStorage.ts
│   │   ├── wardStorage.ts
│   │   └── auditLogStorage.ts
│   ├── services/             # 业务逻辑层
│   │   ├── index.ts
│   │   ├── stateMachine.ts   # 状态机
│   │   ├── matchingEngine.ts # 匹配规则引擎
│   │   └── importExport.ts   # 导入导出
│   └── routes/               # API 路由
│       ├── index.ts
│       ├── bloodBags.ts
│       ├── applications.ts
│       ├── wards.ts
│       ├── audit.ts
│       └── reports.ts
├── tests/
│   └── api.test.ts           # 集成测试
├── scripts/
│   └── seed.ts               # 示例数据脚本
├── data/
│   └── sample_inventory.csv  # 示例 CSV
├── package.json
├── tsconfig.json
└── jest.config.js
```

---

## 常见问题

### Q: 如何修改服务端口?

设置环境变量:
```bash
PORT=8080 npm run dev
```

### Q: 数据库文件存储在哪里?

默认路径: `data/bloodbank.db`

可通过环境变量修改:
```bash
DB_PATH=/path/to/custom.db npm run dev
```

### Q: 温控异常的血袋如何处理?

温控异常的血袋会被自动标记，无法进行预留和出库操作。需要:
1. 检查血袋实际状态
2. 如果确认异常，手动将状态改为 `QUARANTINE` (隔离)
3. 如果是误报，可添加新的正常温度记录

### Q: 临期血袋的定义是什么?

- 默认: 48 小时内到期的血袋
- 可通过 `expiringWithinHours` 参数自定义
- 匹配时临期血袋会优先推荐

### Q: 支持哪些血型?

8 种常见血型:
- A+, A-
- B+, B-
- AB+, AB-
- O+, O-

---

## License

MIT
