# 司法社工对账服务

一个用于司法社工日常考勤对账的后端服务，自动比对签到、请假和定位数据，支持人工复核和报告导出。

## 功能特性

- **数据导入**: 支持CSV签到数据、JSON请假数据、定位轨迹数据、人员信息导入（文件上传和JSON两种方式）
- **自动比对**: 自动检测超时未签、请假覆盖、轨迹缺口、定位异常等差异
- **差异溯源**: 每条差异记录来源和证据信息
- **人员等级**: 支持A/B/C三级人员分类统计
- **人工复核**: 支持批量复核，放行/驳回/要求补材料
- **人工修正**: 支持对自动比对结果进行人工修正并记录原因
- **重新计算**: 复核改动后重新计算汇总数据
- **报告导出**: 支持Excel多工作表和CSV格式导出
- **模板下载**: 提供各类型数据导入模板下载

## 技术栈

- Node.js + TypeScript
- Express (Web框架)
- Multer (文件上传)
- ExcelJS (Excel导出)
- json2csv (CSV导出)
- csv-parser (CSV解析)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

服务将在 http://localhost:3000 启动

### 3. 快速体验（一键导入样例数据）

```bash
# 1. 导入样例数据（人员、签到、请假、定位）
curl -X POST http://localhost:3000/api/reconciliation/import/sample-data

# 2. 执行对账，获取对账编号
RECONCILE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/reconciliation/reconcile)
RECONCILIATION_ID=$(echo $RECONCILE_RESPONSE | sed 's/.*"reconciliationId":"\([^"]*\)".*/\1/')
echo "对账编号: $RECONCILIATION_ID"

# 3. 查看对账结果汇总
curl "http://localhost:3000/api/reconciliation/records/$RECONCILIATION_ID/summary"

# 4. 查看所有差异记录
curl "http://localhost:3000/api/reconciliation/records/$RECONCILIATION_ID/with-differences"

# 5. 导出Excel报告
curl -o reconciliation-report.xlsx "http://localhost:3000/api/reconciliation/export/excel/$RECONCILIATION_ID"

# 6. 导出CSV明细
curl -o reconciliation-details.csv "http://localhost:3000/api/reconciliation/export/csv/$RECONCILIATION_ID"
```

### 4. 完整业务流程示例（真实数据导入）

```bash
# ========== 步骤1: 下载导入模板 ==========
# 下载人员信息模板
curl -o persons_template.json http://localhost:3000/api/reconciliation/import/template/persons

# 下载签到数据模板(CSV)
curl -o attendance_template.csv http://localhost:3000/api/reconciliation/import/template/attendance

# 下载请假数据模板
curl -o leave_template.json http://localhost:3000/api/reconciliation/import/template/leave

# 下载定位数据模板
curl -o location_template.json http://localhost:3000/api/reconciliation/import/template/location

# ========== 步骤2: 导入人员信息 ==========
curl -X POST http://localhost:3000/api/reconciliation/import/persons \
  -H "Content-Type: application/json" \
  -d '[{
    "id": "P001",
    "name": "张三",
    "idCard": "110101199001010001",
    "level": "A",
    "department": "第一司法所",
    "manager": "王主任"
  }]'

# ========== 步骤3: 导入签到数据（两种方式） ==========
# 方式A: CSV文件上传
curl -X POST http://localhost:3000/api/reconciliation/import/attendance \
  -F "attendance=@attendance_template.csv"

# 方式B: JSON直接导入
curl -X POST http://localhost:3000/api/reconciliation/import/attendance/json \
  -H "Content-Type: application/json" \
  -d '[{
    "personId": "P001",
    "personName": "张三",
    "date": "2024-01-15",
    "signInTime": "09:05",
    "signOutTime": "17:55",
    "expectedSignInTime": "09:00",
    "expectedSignOutTime": "18:00",
    "status": "normal",
    "source": "签到系统"
  }]'

# ========== 步骤4: 导入请假数据 ==========
curl -X POST http://localhost:3000/api/reconciliation/import/leave/json \
  -H "Content-Type: application/json" \
  -d '[{
    "personId": "P001",
    "personName": "张三",
    "leaveType": "sick",
    "startDate": "2024-01-15",
    "endDate": "2024-01-15",
    "reason": "身体不适",
    "status": "approved",
    "approver": "王主任",
    "source": "请假系统"
  }]'

# ========== 步骤5: 导入定位数据 ==========
curl -X POST http://localhost:3000/api/reconciliation/import/location/json \
  -H "Content-Type: application/json" \
  -d '[{
    "personId": "P001",
    "personName": "张三",
    "date": "2024-01-15",
    "tracePoints": [
      {
        "timestamp": "2024-01-15 08:30:00",
        "latitude": 39.9042,
        "longitude": 116.4074,
        "location": "司法所",
        "isAnomaly": false
      }
    ],
    "isComplete": true,
    "source": "定位系统"
  }]'

# ========== 步骤6: 执行对账 ==========
RECONCILE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/reconciliation/reconcile \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-01-15"}')
RECONCILIATION_ID=$(echo $RECONCILE_RESPONSE | sed 's/.*"reconciliationId":"\([^"]*\)".*/\1/')
echo "对账编号: $RECONCILIATION_ID"

# ========== 步骤7: 人工复核 ==========
# 先获取所有待复核记录
RECORDS=$(curl -s "http://localhost:3000/api/reconciliation/records/$RECONCILIATION_ID")
RECORD_IDS=$(echo $RECORDS | sed 's/\[{\"id\":\"\([^\"]*\)\".*/\1/')

# 批量复核通过
curl -X POST http://localhost:3000/api/reconciliation/review \
  -H "Content-Type: application/json" \
  -d "{
    \"reconciliationId\": \"$RECONCILIATION_ID\",
    \"recordIds\": [\"$RECORD_IDS\"],
    \"status\": \"approved\",
    \"comment\": \"情况属实，予以通过\",
    \"operatorId\": \"admin001\",
    \"operatorName\": \"管理员\"
  }"

# ========== 步骤8: 人工修正（针对特殊情况） ==========
# 假设某条记录需要人工修正状态
curl -X POST http://localhost:3000/api/reconciliation/correct \
  -H "Content-Type: application/json" \
  -d "{
    \"reconciliationId\": \"$RECONCILIATION_ID\",
    \"recordId\": \"$RECORD_IDS\",
    \"newStatus\": \"normal\",
    \"reason\": \"系统设备故障导致签到延迟，实际正常出勤，已核实\",
    \"operatorId\": \"admin001\",
    \"operatorName\": \"管理员\"
  }"

# ========== 步骤9: 重新计算汇总 ==========
curl -X POST "http://localhost:3000/api/reconciliation/recalculate/$RECONCILIATION_ID"

# ========== 步骤10: 导出最终报告 ==========
curl -o final-report.xlsx "http://localhost:3000/api/reconciliation/export/excel/$RECONCILIATION_ID"
```

## API 接口

### 健康检查
```
GET /health
```

### 数据导入接口

#### 下载导入模板
```
GET  /api/reconciliation/import/template/:type
# type: attendance | leave | location | persons
```

#### 一键导入样例数据
```
POST /api/reconciliation/import/sample-data
```

#### 导入人员信息
```
POST /api/reconciliation/import/persons
Content-Type: application/json
Body: Person[]
```

#### 导入签到数据（CSV文件上传）
```
POST /api/reconciliation/import/attendance
Content-Type: multipart/form-data
Form: attendance=@file.csv
```

#### 导入签到数据（JSON）
```
POST /api/reconciliation/import/attendance/json
Content-Type: application/json
Body: AttendanceRecord[]
```

#### 导入请假数据（JSON文件上传）
```
POST /api/reconciliation/import/leave
Content-Type: multipart/form-data
Form: leave=@file.json
```

#### 导入请假数据（JSON）
```
POST /api/reconciliation/import/leave/json
Content-Type: application/json
Body: LeaveRecord[]
```

#### 导入定位数据（JSON文件上传）
```
POST /api/reconciliation/import/location
Content-Type: multipart/form-data
Form: location=@file.json
```

#### 导入定位数据（JSON）
```
POST /api/reconciliation/import/location/json
Content-Type: application/json
Body: LocationTrace[]
```

### 对账管理接口

#### 执行对账
```
POST /api/reconciliation/reconcile
Content-Type: application/json
Body: { "date": "2024-01-15" }
```

#### 获取所有对账编号
```
GET  /api/reconciliation/reconciliation-ids
```

#### 获取对账记录
```
GET  /api/reconciliation/records/:reconciliationId
```

#### 获取对账汇总
```
GET  /api/reconciliation/records/:reconciliationId/summary
```

#### 获取差异记录
```
GET  /api/reconciliation/records/:reconciliationId/with-differences
```

#### 获取单条记录详情
```
GET  /api/reconciliation/record/:recordId
```

### 复核管理接口

#### 批量复核
```
POST /api/reconciliation/review
Content-Type: application/json
Body: {
  "reconciliationId": "RC202401150001",
  "recordIds": ["id1", "id2"],
  "status": "approved",          // pending | approved | rejected | need_supplement
  "comment": "复核意见",
  "operatorId": "操作员ID",
  "operatorName": "操作员姓名"
}
```

#### 人工修正
```
POST /api/reconciliation/correct
Content-Type: application/json
Body: {
  "reconciliationId": "RC202401150001",
  "recordId": "record-id",
  "newStatus": "normal",         // normal | late | absent | leave | exception
  "reason": "修正原因说明",
  "operatorId": "操作员ID",
  "operatorName": "操作员姓名"
}
```

#### 重新计算
```
POST /api/reconciliation/recalculate/:reconciliationId
```

### 报告导出接口

#### 导出Excel报告（多工作表）
```
GET  /api/reconciliation/export/excel/:reconciliationId
```

#### 导出CSV明细
```
GET  /api/reconciliation/export/csv/:reconciliationId
```

## 样例数据说明

样例数据包含5名社区矫正对象：

| ID | 姓名 | 等级 | 情况说明 |
|----|------|------|----------|
| P001 | 张三 | A级 | 正常签到，定位正常 |
| P002 | 李四 | A级 | 签到超时，定位异常（可作为人工修正示范） |
| P003 | 王五 | B级 | 全天未签到，无定位 |
| P004 | 赵六 | B级 | 半天签到，有请假记录覆盖 |
| P005 | 钱七 | C级 | 正常签到，定位轨迹不完整 |

## 差异类型说明

| 类型 | 说明 | 严重程度 |
|------|------|----------|
| timeout_no_sign | 超时未签/未签退 | 高/中 |
| leave_overlap | 请假覆盖 | 低 |
| trace_gap | 轨迹缺口/不完整 | 高/中 |
| location_anomaly | 定位异常 | 中 |
| manual_correction | 人工修正 | 低 |

## 复核状态

- pending: 待复核
- approved: 已通过（放行）
- rejected: 已驳回（退回）
- need_supplement: 需补材料

## 导入文件格式说明

### 签到CSV格式
```csv
personId,personName,date,signInTime,signOutTime,expectedSignInTime,expectedSignOutTime,status,source,location,remark
P001,张三,2024-01-15,09:05,17:55,09:00,18:00,normal,签到系统,,
```

### 请假JSON格式
```json
[{
  "personId": "P001",
  "personName": "张三",
  "leaveType": "sick",
  "startDate": "2024-01-15",
  "endDate": "2024-01-15",
  "startTime": "09:00",
  "endTime": "18:00",
  "reason": "身体不适",
  "status": "approved",
  "approver": "王主任",
  "approveTime": "2024-01-14 16:00",
  "source": "请假系统"
}]
```

### 定位JSON格式
```json
[{
  "personId": "P001",
  "personName": "张三",
  "date": "2024-01-15",
  "tracePoints": [
    {
      "timestamp": "2024-01-15 08:30:00",
      "latitude": 39.9042,
      "longitude": 116.4074,
      "location": "司法所",
      "accuracy": 10,
      "isAnomaly": false,
      "anomalyReason": ""
    }
  ],
  "totalDistance": 0,
  "anomalyCount": 0,
  "isComplete": true,
  "source": "定位系统"
}]
```

## 项目结构

```
├── src/
│   ├── types/           # 类型定义
│   ├── store/           # 数据存储
│   ├── services/        # 业务服务
│   ├── routes/          # API路由
│   └── server.ts        # 服务入口
├── uploads/             # 临时上传目录
├── exports/             # 导出文件目录
├── package.json
├── tsconfig.json
└── README.md
```

## 构建和部署

```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm start
```
