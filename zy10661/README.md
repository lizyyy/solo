# 保险理赔后台材料补交通知 API

## 项目概述

保险理赔材料补交通知管理系统，支持三种流程：
- **正常流程 (NORMAL)**：标准材料补交流程
- **驳回流程 (REJECT)**：材料不符合要求被驳回
- **人工复核流程 (MANUAL)**：需要人工介入审核

核心状态：
- `PENDING`：待补交
- `NOTIFIED`：已通知
- `COMPLETED`：已补齐
- `OVERDUE`：已超期

## 技术栈

- Node.js + Express
- SQLite (better-sqlite3)
- 依赖：json2csv, csv-parser, multer, uuid

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 生成测试数据

```bash
npm run seed
```

### 4. 启动服务

```bash
npm start
# 或开发模式
npm run dev
```

服务地址: http://localhost:3000

## API 接口说明

### 通知管理

#### 创建通知
```bash
curl -X POST http://localhost:3000/api/notices \
  -H "Content-Type: application/json" \
  -d '{
    "claim_id": "claim-uuid",
    "channel": "SMS",
    "deadline": "2024-12-31T23:59:59",
    "flow_type": "NORMAL",
    "operator_id": "OP001",
    "operator_name": "张经理",
    "remark": "请补交身份证复印件",
    "materials": [
      {"material_code": "DOC001", "material_name": "身份证复印件", "quantity": 1}
    ]
  }'
```

#### 通知列表
```bash
curl http://localhost:3000/api/notices

# 按状态筛选
curl "http://localhost:3000/api/notices?status=PENDING"

# 按流程筛选
curl "http://localhost:3000/api/notices?flow_type=NORMAL"
```

#### 通知详情
```bash
curl http://localhost:3000/api/notices/{notice_id}
```

#### 更新状态
```bash
curl -X PATCH http://localhost:3000/api/notices/{notice_id}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "NOTIFIED",
    "operator_id": "OP001",
    "operator_name": "张经理",
    "remark": "已发送短信通知"
  }'
```

#### 发送催办
```bash
curl -X POST http://localhost:3000/api/notices/{notice_id}/remind \
  -H "Content-Type: application/json" \
  -d '{
    "operator_id": "OP001",
    "operator_name": "张经理"
  }'
```

#### 材料补齐
```bash
curl -X POST http://localhost:3000/api/notices/{notice_id}/complete-materials \
  -H "Content-Type: application/json" \
  -d '{
    "claim_id": "claim-uuid",
    "material_ids": ["material-uuid-1", "material-uuid-2"],
    "operator_id": "OP001",
    "operator_name": "张经理"
  }'
```

### 流程操作

#### 驳回通知
```bash
curl -X POST http://localhost:3000/api/notices/{notice_id}/reject \
  -H "Content-Type: application/json" \
  -d '{
    "operator_id": "OP001",
    "operator_name": "张经理",
    "reason": "身份证复印件不清晰，请重新提供"
  }'
```

#### 转人工复核
```bash
curl -X POST http://localhost:3000/api/notices/{notice_id}/manual-review \
  -H "Content-Type: application/json" \
  -d '{
    "operator_id": "OP001",
    "operator_name": "张经理",
    "reason": "材料存在疑点，需要人工核实"
  }'
```

### 历史与冲突

#### 查看历史记录
```bash
curl http://localhost:3000/api/notices/{notice_id}/history
```

#### 查看冲突记录
```bash
curl http://localhost:3000/api/notices/{notice_id}/conflicts
```

#### 解决冲突
```bash
curl -X POST http://localhost:3000/api/notices/conflicts/{conflict_id}/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "已联系客户确认，属于系统误发催办",
    "resolved_by": "OP001"
  }'
```

### 导入导出

#### 导出 CSV
```bash
curl http://localhost:3000/api/notices/export/csv -o notices.csv
```

#### 导入 CSV
```bash
curl -X POST http://localhost:3000/api/import/csv \
  -F "file=@test-import.csv" \
  -F "operator_id=OP001"
```

#### 查看坏行记录
```bash
curl http://localhost:3000/api/import/bad-rows
```

### 系统操作

#### 检查超期
```bash
curl -X POST http://localhost:3000/api/system/check-overdue
```

## 验收测试流程

### 1. 完整流转测试

```bash
# 1. 创建理赔案
CLAIM_RESP=$(curl -s -X POST http://localhost:3000/api/claims \
  -H "Content-Type: application/json" \
  -d '{
    "claim_no": "CLM-TEST-001",
    "customer_name": "测试用户",
    "customer_phone": "13900139001",
    "policy_no": "POL-TEST-001",
    "incident_type": "意外医疗"
  }')
echo $CLAIM_RESP | jq .
CLAIM_ID=$(echo $CLAIM_RESP | jq -r .data.id)

# 2. 创建通知
NOTICE_RESP=$(curl -s -X POST http://localhost:3000/api/notices \
  -H "Content-Type: application/json" \
  -d "{
    \"claim_id\": \"$CLAIM_ID\",
    \"channel\": \"SMS\",
    \"deadline\": \"2024-12-31T23:59:59\",
    \"flow_type\": \"NORMAL\",
    \"operator_id\": \"OP001\",
    \"operator_name\": \"张经理\",
    \"materials\": [
      {\"material_code\": \"DOC001\", \"material_name\": \"身份证复印件\"},
      {\"material_code\": \"DOC002\", \"material_name\": \"医院诊断证明\"}
    ]
  }")
echo $NOTICE_RESP | jq .
NOTICE_ID=$(echo $NOTICE_RESP | jq -r .data.id)

# 3. 标记为已通知
curl -X PATCH http://localhost:3000/api/notices/$NOTICE_ID/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "NOTIFIED",
    "operator_id": "OP001",
    "operator_name": "张经理"
  }' | jq .

# 4. 发送催办
curl -X POST http://localhost:3000/api/notices/$NOTICE_ID/remind \
  -H "Content-Type: application/json" \
  -d '{
    "operator_id": "OP001",
    "operator_name": "张经理"
  }' | jq .

# 5. 获取材料ID
DETAIL=$(curl -s http://localhost:3000/api/notices/$NOTICE_ID)
MATERIAL_IDS=$(echo $DETAIL | jq -r '.data.materials[].id')

# 6. 材料补齐
curl -X POST http://localhost:3000/api/notices/$NOTICE_ID/complete-materials \
  -H "Content-Type: application/json" \
  -d "{
    \"claim_id\": \"$CLAIM_ID\",
    \"material_ids\": $MATERIAL_IDS,
    \"operator_id\": \"OP001\",
    \"operator_name\": \"张经理\"
  }" | jq .

# 7. 查看历史记录
curl http://localhost:3000/api/notices/$NOTICE_ID/history | jq .
```

### 2. 冲突记录测试（客户补交后仍催办）

```bash
# 1. 创建测试数据
CLAIM_RESP=$(curl -s -X POST http://localhost:3000/api/claims \
  -H "Content-Type: application/json" \
  -d '{
    "claim_no": "CLM-CONFLICT-001",
    "customer_name": "冲突测试用户",
    "customer_phone": "13900139002"
  }')
CLAIM_ID=$(echo $CLAIM_RESP | jq -r .data.id)

# 2. 创建通知
NOTICE_RESP=$(curl -s -X POST http://localhost:3000/api/notices \
  -H "Content-Type: application/json" \
  -d "{
    \"claim_id\": \"$CLAIM_ID\",
    \"channel\": \"SMS\",
    \"deadline\": \"2024-12-31T23:59:59\",
    \"flow_type\": \"NORMAL\",
    \"operator_id\": \"OP001\",
    \"operator_name\": \"张经理\",
    \"materials\": [{\"material_code\": \"DOC001\", \"material_name\": \"身份证复印件\"}]
  }")
NOTICE_ID=$(echo $NOTICE_RESP | jq -r .data.id)

# 3. 标记为已通知
curl -X PATCH http://localhost:3000/api/notices/$NOTICE_ID/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "NOTIFIED",
    "operator_id": "OP001",
    "operator_name": "张经理"
  }' > /dev/null

# 4. 材料补齐（通知状态变为 COMPLETED）
DETAIL=$(curl -s http://localhost:3000/api/notices/$NOTICE_ID)
MATERIAL_IDS=$(echo $DETAIL | jq -r '[.data.materials[].id]')
curl -X POST http://localhost:3000/api/notices/$NOTICE_ID/complete-materials \
  -H "Content-Type: application/json" \
  -d "{
    \"claim_id\": \"$CLAIM_ID\",
    \"material_ids\": $MATERIAL_IDS,
    \"operator_id\": \"OP001\",
    \"operator_name\": \"张经理\"
  }" > /dev/null

# 5. 模拟系统继续发送催办（触发冲突检测）
curl -X POST http://localhost:3000/api/notices/$NOTICE_ID/remind \
  -H "Content-Type: application/json" \
  -d '{
    "operator_id": "OP001",
    "operator_name": "张经理"
  }' | jq .

# 6. 查看冲突记录
curl http://localhost:3000/api/notices/$NOTICE_ID/conflicts | jq .

# 7. 查看历史记录（冲突已被记录）
curl http://localhost:3000/api/notices/$NOTICE_ID/history | jq .
```

### 3. 导入坏行测试

```bash
# 1. 导入测试 CSV（包含多条坏数据）
IMPORT_RESULT=$(curl -s -X POST http://localhost:3000/api/import/csv \
  -F "file=@test-import.csv" \
  -F "operator_id=OP001")
echo $IMPORT_RESULT | jq .

# 2. 查看坏行详情
curl http://localhost:3000/api/import/bad-rows | jq .

# 3. 验证成功导入的数据
curl http://localhost:3000/api/notices | jq '.data | length'
```

### 4. 列表、详情、历史、导出互相对齐

```bash
# 1. 列表
echo "=== 通知列表 ==="
curl http://localhost:3000/api/notices | jq '.data[0]'

# 2. 详情
NOTICE_ID=$(curl -s http://localhost:3000/api/notices | jq -r '.data[0].id')
echo "=== 通知详情 ==="
curl http://localhost:3000/api/notices/$NOTICE_ID | jq .

# 3. 历史
echo "=== 历史记录 ==="
curl http://localhost:3000/api/notices/$NOTICE_ID/history | jq '.data | length'

# 4. 导出
echo "=== 导出 CSV ==="
curl -s http://localhost:3000/api/notices/export/csv | head -5
```

## 运行完整测试

```bash
# 安装依赖
npm install

# 初始化数据库
npm run init-db

# 生成测试数据
npm run seed

# 启动服务
npm start

# 新开终端运行测试脚本
npm test
```

## 数据库结构

- `claims`: 理赔案表
- `material_items`: 材料项表
- `notice_records`: 通知记录表
- `history_logs`: 历史操作日志
- `conflict_records`: 冲突记录（重复催办等）
- `import_bad_rows`: 导入坏行记录
