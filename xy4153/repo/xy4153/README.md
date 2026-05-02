# 水质整改闭环 API

连锁游泳馆运营督导用的水质整改闭环后端服务。

## 功能特性

- **数据管理**：门店、泳池、采样记录、设备校准的 CRUD 操作
- **CSV 导入**：批量导入门店、泳池、采样记录和设备校准数据
- **整改闭环**：超标工单创建 → 派发整改 → 上传复测 → 申请复开 → 归档
- **规则校验**：采样频次、阈值、校准有效期、同池未闭环工单、复测时间、权限
- **审计追踪**：SQLite 状态版本管理和审计日志
- **审计包导出**：支持 Markdown、CSV、JSON 格式

## 技术栈

- Node.js + TypeScript
- Express.js
- SQLite (better-sqlite3)
- dayjs (日期处理)
- multer (文件上传)
- csv-parser + json2csv (CSV处理)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动。

### 3. 首次启动

首次启动时，系统会自动创建：

- **用户**：admin (管理员)、supervisor (督导)、staff_sunny (阳光游泳馆员工)、staff_bibo (碧波游泳馆员工)
- **门店**：阳光游泳馆、碧波游泳馆
- **泳池**：比赛池、训练池、儿童池 (阳光游泳馆)；大池、小池 (碧波游泳馆)
- **阈值**：余氯(0.3-5.0 mg/L)、pH(7.0-7.8)、浊度(0-5 NTU)

## API 认证

所有 API 请求需要在 Header 中指定操作用户：

```
X-User-Id: <用户ID>
```

### 获取用户 ID

```bash
# 查看所有用户
curl http://localhost:3000/api/users
```

返回示例：
```json
{
  "success": true,
  "data": [
    {
      "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "username": "admin",
      "role": "admin",
      "storeId": null
    },
    ...
  ]
}
```

## CURL 验证流程

### 步骤 1：健康检查

```bash
curl http://localhost:3000/api/health
```

### 步骤 2：获取管理员用户 ID

```bash
# 保存用户 ID 到变量
ADMIN_ID=$(curl -s http://localhost:3000/api/users | node -e "const d=require('fs').readFileSync(0,'utf-8');console.log(JSON.parse(d).data.find(u=>u.username==='admin').id)")
SUPERVISOR_ID=$(curl -s http://localhost:3000/api/users | node -e "const d=require('fs').readFileSync(0,'utf-8');console.log(JSON.parse(d).data.find(u=>u.username==='supervisor').id)")
STAFF_ID=$(curl -s http://localhost:3000/api/users | node -e "const d=require('fs').readFileSync(0,'utf-8');console.log(JSON.parse(d).data.find(u=>u.username==='staff_sunny').id)")

echo "ADMIN_ID: $ADMIN_ID"
echo "SUPERVISOR_ID: $SUPERVISOR_ID"
echo "STAFF_ID: $STAFF_ID"
```

### 步骤 3：查看门店列表

```bash
curl -H "X-User-Id: $ADMIN_ID" http://localhost:3000/api/stores
```

### 步骤 4：查看泳池列表

```bash
# 获取阳光游泳馆的门店 ID
STORE_ID=$(curl -s -H "X-User-Id: $ADMIN_ID" http://localhost:3000/api/stores | node -e "const d=require('fs').readFileSync(0,'utf-8');console.log(JSON.parse(d).data.find(s=>s.name==='阳光游泳馆').id)")
echo "STORE_ID: $STORE_ID"

# 查看该门店的泳池
curl -H "X-User-Id: $ADMIN_ID" http://localhost:3000/api/pools

# 获取比赛池 ID
POOL_ID=$(curl -s -H "X-User-Id: $ADMIN_ID" http://localhost:3000/api/pools | node -e "const d=require('fs').readFileSync(0,'utf-8');console.log(JSON.parse(d).data.find(p=>p.name==='比赛池').id)")
echo "POOL_ID: $POOL_ID"
```

### 步骤 5：上报超标采样记录

```bash
# 上报余氯超标 (阈值: 0.3-5.0 mg/L) - 上报值 0.2 (低于阈值)
curl -X POST http://localhost:3000/api/sample-records \
  -H "X-User-Id: $STAFF_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "'"$STORE_ID"'",
    "poolId": "'"$POOL_ID"'",
    "sampleType": "chlorine",
    "value": 0.2,
    "unit": "mg/L",
    "sampleTime": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
  }'

# 上报 pH 超标 (阈值: 7.0-7.8) - 上报值 8.0 (高于阈值)
curl -X POST http://localhost:3000/api/sample-records \
  -H "X-User-Id: $STAFF_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "'"$STORE_ID"'",
    "poolId": "'"$POOL_ID"'",
    "sampleType": "ph",
    "value": 8.0,
    "unit": "pH",
    "sampleTime": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
  }'

# 查看超标记录
curl -H "X-User-Id: $SUPERVISOR_ID" "http://localhost:3000/api/sample-records?isExceeded=true"
```

### 步骤 6：为超标记录创建整改工单

```bash
# 获取余氯超标记录的 ID
SAMPLE_ID=$(curl -s -H "X-User-Id: $SUPERVISOR_ID" "http://localhost:3000/api/sample-records?isExceeded=true" | node -e "const d=require('fs').readFileSync(0,'utf-8');const s=JSON.parse(d).data.find(x=>x.sampleType==='chlorine');console.log(s?s.id:'')")
echo "SAMPLE_ID: $SAMPLE_ID"

# 创建整改工单 (需要督导或管理员权限)
curl -X POST http://localhost:3000/api/tickets \
  -H "X-User-Id: $SUPERVISOR_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleRecordId": "'"$SAMPLE_ID"'"
  }'

# 查看工单列表
curl -H "X-User-Id: $SUPERVISOR_ID" http://localhost:3000/api/tickets

# 获取工单 ID
TICKET_ID=$(curl -s -H "X-User-Id: $SUPERVISOR_ID" http://localhost:3000/api/tickets | node -e "const d=require('fs').readFileSync(0,'utf-8');const t=JSON.parse(d).data[0];console.log(t?t.id:'')")
echo "TICKET_ID: $TICKET_ID"
```

### 步骤 7：派发整改工单

```bash
# 督导派发给门店员工
curl -X POST "http://localhost:3000/api/tickets/$TICKET_ID/assign" \
  -H "X-User-Id: $SUPERVISOR_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "assignedTo": "张三"
  }'

# 查看工单状态
curl -H "X-User-Id: $STAFF_ID" "http://localhost:3000/api/tickets/$TICKET_ID"
```

### 步骤 8：门店员工开始整改

```bash
# 开始整改
curl -X POST "http://localhost:3000/api/tickets/$TICKET_ID/start-rectification" \
  -H "X-User-Id: $STAFF_ID" \
  -H "Content-Type: application/json" \
  -d '{}'

# 提交整改结果
curl -X POST "http://localhost:3000/api/tickets/$TICKET_ID/submit-rectification" \
  -H "X-User-Id: $STAFF_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "已补充消毒剂，调整余氯浓度至正常范围。检查了加药设备，运行正常。",
    "evidenceUrls": [
      "https://example.com/evidence1.jpg",
      "https://example.com/evidence2.jpg"
    ]
  }'
```

### 步骤 9：督导复测

```bash
# 先上报复测采样记录 (正常余氯值)
curl -X POST http://localhost:3000/api/sample-records \
  -H "X-User-Id: $SUPERVISOR_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "'"$STORE_ID"'",
    "poolId": "'"$POOL_ID"'",
    "sampleType": "chlorine",
    "value": 1.5,
    "unit": "mg/L",
    "sampleTime": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
  }'

# 获取复测记录 ID
RETEST_SAMPLE_ID=$(curl -s -H "X-User-Id: $SUPERVISOR_ID" "http://localhost:3000/api/sample-records" | node -e "const d=require('fs').readFileSync(0,'utf-8');const s=JSON.parse(d).data.find(x=>x.sampleType==='chlorine' && x.value===1.5);console.log(s?s.id:'')")
echo "RETEST_SAMPLE_ID: $RETEST_SAMPLE_ID"

# 提交复测结果 (通过)
curl -X POST "http://localhost:3000/api/tickets/$TICKET_ID/submit-retest" \
  -H "X-User-Id: $SUPERVISOR_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "retestValue": 1.5,
    "retestSampleRecordId": "'"$RETEST_SAMPLE_ID"'",
    "passed": true
  }'
```

### 步骤 10：管理员关闭并归档工单

```bash
# 关闭工单
curl -X POST "http://localhost:3000/api/tickets/$TICKET_ID/close" \
  -H "X-User-Id: $ADMIN_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "closeReason": "复测合格，整改完成"
  }'

# 归档工单
curl -X POST "http://localhost:3000/api/tickets/$TICKET_ID/archive" \
  -H "X-User-Id: $ADMIN_ID" \
  -H "Content-Type: application/json" \
  -d '{}'

# 查看最终工单状态
curl -H "X-User-Id: $ADMIN_ID" "http://localhost:3000/api/tickets/$TICKET_ID"
```

### 步骤 11：导出审计包

```bash
# 导出 JSON 格式审计包
curl -H "X-User-Id: $ADMIN_ID" "http://localhost:3000/api/import-export/audit-package/json?storeId=$STORE_ID"

# 导出 Markdown 格式审计报告
curl -H "X-User-Id: $ADMIN_ID" "http://localhost:3000/api/import-export/audit-package/markdown?storeId=$STORE_ID"

# 导出 CSV 格式
curl -H "X-User-Id: $ADMIN_ID" "http://localhost:3000/api/import-export/audit-package/csv?storeId=$STORE_ID"
```

## CSV 导入示例

### 门店 CSV 格式

```csv
name,address,contactPerson,contactPhone
阳光游泳馆二店,北京市朝阳区阳光路99号,王经理,13800138003
```

导入命令：
```bash
# 创建 stores.csv 文件
echo "name,address,contactPerson,contactPhone
阳光游泳馆二店,北京市朝阳区阳光路99号,王经理,13800138003" > stores.csv

# 导入
curl -X POST http://localhost:3000/api/import-export/stores \
  -H "X-User-Id: $ADMIN_ID" \
  -F "file=@stores.csv"
```

### 泳池 CSV 格式

```csv
storeId,name,type,volume
<门店ID>,跳水池,跳水专用池,1500
```

### 采样记录 CSV 格式

```csv
storeId,poolId,sampleType,value,unit,sampleTime,recordedBy
<门店ID>,<泳池ID>,chlorine,0.5,mg/L,2024-01-15T10:00:00Z,李四
<门店ID>,<泳池ID>,ph,7.5,pH,2024-01-15T10:00:00Z,李四
```

### 设备校准 CSV 格式

```csv
storeId,deviceName,deviceType,serialNumber,calibrationDate,validUntil,calibratedBy
<门店ID>,余氯检测仪,水质检测仪,YCL-001,2024-01-01,2024-12-31,校准机构A
```

## 工单状态流转

```
created (已创建)
    ↓ 派发 (admin/supervisor)
assigned (已派发)
    ↓ 开始整改 (所有角色)
in_progress (整改中)
    ↓ 提交整改 (所有角色)
retest_requested (申请复测)
    ├── 复测通过 → retest_passed → reopen_requested → closed → archived
    └── 复测不通过 → retest_failed → 可重新提交整改
```

## 权限矩阵

| 操作 | admin | supervisor | store_staff |
|------|-------|------------|-------------|
| 创建门店 | ✓ | ✓ | ✗ |
| 创建泳池 | ✓ | ✓ | ✗ |
| 上报采样记录 | ✓ | ✓ | ✓ (仅限所属门店) |
| 创建整改工单 | ✓ | ✓ | ✗ |
| 派发工单 | ✓ | ✓ | ✗ |
| 提交整改 | ✓ | ✓ | ✓ |
| 复测 | ✓ | ✓ | ✗ |
| 关闭工单 | ✓ | 仅限复开后 | ✗ |
| 归档工单 | ✓ | ✗ | ✗ |
| 导出审计包 | ✓ | ✓ | ✗ |

## 阈值配置

默认阈值（可在数据库中调整）：

| 参数 | 最小值 | 最大值 | 单位 |
|------|--------|--------|------|
| 余氯 (chlorine) | 0.3 | 5.0 | mg/L |
| pH (ph) | 7.0 | 7.8 | pH |
| 浊度 (turbidity) | 0.0 | 5.0 | NTU |

## 规则校验

1. **采样频次**：余氯/pH 每日至少4次，浊度至少1次
2. **阈值校验**：自动检测是否超出标准范围
3. **设备校准**：采样时检查设备校准是否在有效期内
4. **同池未闭环工单**：创建新工单时检查是否有同类型未闭环工单
5. **复测时间**：复测需在整改后1-24小时内完成
6. **权限控制**：严格的角色权限校验

## 项目结构

```
src/
├── index.ts              # 应用入口
├── types/
│   └── index.ts          # 类型定义
├── storage/
│   ├── database.ts       # SQLite 数据库初始化
│   ├── storeRepository.ts
│   ├── poolRepository.ts
│   ├── sampleRecordRepository.ts
│   ├── ticketRepository.ts
│   ├── userRepository.ts
│   ├── thresholdRepository.ts
│   ├── deviceCalibrationRepository.ts
│   └── auditRepository.ts
├── state-machine/
│   └── ticketStateMachine.ts  # 工单状态机
├── rules/
│   └── validationRules.ts     # 规则引擎
├── import-export/
│   ├── csvImporter.ts         # CSV 导入
│   └── auditExporter.ts       # 审计包导出
└── routes/
    ├── middleware.ts          # 中间件
    ├── storeRoutes.ts
    ├── poolRoutes.ts
    ├── sampleRecordRoutes.ts
    ├── ticketRoutes.ts
    └── importExportRoutes.ts
```

## 数据库表

- `users` - 用户表
- `stores` - 门店表
- `pools` - 泳池表
- `thresholds` - 阈值配置表
- `device_calibrations` - 设备校准记录表
- `sample_records` - 采样记录表
- `tickets` - 整改工单表
- `audit_logs` - 审计日志表
- `version_records` - 版本记录表

## 许可证

MIT
