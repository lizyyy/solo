# 文件处理沙箱API - 测试指南

## 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

---

## 测试流程

### 1. 健康检查

```bash
curl http://localhost:3000/health
```

---

### 2. 创建解析规则

```bash
curl -X POST http://localhost:3000/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "用户数据校验规则",
    "description": "用于校验用户导入的CSV数据",
    "columns": [
      { "name": "name", "required": true, "minLength": 2, "maxLength": 50 },
      { "name": "email", "required": true, "type": "email" },
      { "name": "age", "required": true, "type": "number" },
      { "name": "phone", "required": false }
    ],
    "createdBy": "admin"
  }'
```

**查看规则列表:**
```bash
curl http://localhost:3000/api/rules
```

---

### 3. 上传文件

```bash
curl -X POST http://localhost:3000/api/files/upload \
  -F "file=@test-data.csv" \
  -F "uploadedBy=test-user"
```

**查看文件列表:**
```bash
curl http://localhost:3000/api/files
```

---

### 4. 创建解析任务

将下面的 `FILE_ID` 和 `RULE_ID` 替换为前面步骤返回的实际ID

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "FILE_ID",
    "ruleId": "RULE_ID",
    "triggeredBy": "test-user"
  }'
```

**查看任务列表:**
```bash
curl http://localhost:3000/api/tasks
```

**查看任务进度:**
```bash
curl http://localhost:3000/api/tasks/TASK_ID/progress
```

---

### 5. 验证幂等性（重复提交）

**再次提交相同的任务（应该返回已存在）:**
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "FILE_ID",
    "ruleId": "RULE_ID",
    "triggeredBy": "test-user"
  }'
```

---

### 6. 查看失败行记录

```bash
curl "http://localhost:3000/api/failed-rows?taskId=TASK_ID"
```

**查看单个失败行详情:**
```bash
curl http://localhost:3000/api/failed-rows/FAILED_ROW_ID
```

---

### 7. 人工修正失败行

```bash
curl -X PATCH http://localhost:3000/api/failed-rows/FAILED_ROW_ID/fix \
  -H "Content-Type: application/json" \
  -d '{
    "fixedData": {
      "name": "李四",
      "email": "lisi@example.com",
      "age": "30",
      "phone": "13900139000"
    },
    "fixedBy": "operator"
  }'
```

---

### 8. 查看解析摘要

```bash
curl "http://localhost:3000/api/summaries?taskId=TASK_ID"
```

---

### 9. 导出解析报告

```bash
curl -o parse-report.json "http://localhost:3000/api/summaries/SUMMARY_ID/export"
```

---

### 10. 申请发布

```bash
curl -X POST http://localhost:3000/api/publish-requests \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "FILE_ID",
    "taskId": "TASK_ID",
    "requestedBy": "test-user",
    "reason": "数据校验完成，符合发布要求"
  }'
```

**查看发布申请列表:**
```bash
curl http://localhost:3000/api/publish-requests
```

---

### 11. 审批发布申请

**批准:**
```bash
curl -X POST http://localhost:3000/api/publish-requests/REQUEST_ID/approve \
  -H "Content-Type: application/json" \
  -d '{
    "reviewedBy": "admin",
    "comment": "数据质量良好，同意发布"
  }'
```

**拒绝:**
```bash
curl -X POST http://localhost:3000/api/publish-requests/REQUEST_ID/reject \
  -H "Content-Type: application/json" \
  -d '{
    "reviewedBy": "admin",
    "comment": "存在数据质量问题，需要重新处理"
  }'
```

---

## 关键特性验证

### 沙箱隔离
- 文件默认处于沙箱环境 (`isSandbox: true`)
- 只能在沙箱环境中进行解析
- 只有审批通过后才会移出沙箱 (`isSandbox: false`)

### 失败行保留
- 每条失败行包含:
  - 原始输入数据 (`originalData`)
  - 校验依据 (`processingBasis`)
  - 最终结论 (`conclusion`)

### 幂等性保证
- 相同的 `fileId + ruleId` 重复创建任务，不会重复执行
- 相同的 `fileId + taskId` 重复申请发布，不会重复创建

### 摘要导出
- 包含总体统计（成功/失败行数、成功率）
- 包含错误分类统计
- 包含按列错误统计
- 包含失败行详情

---

## 完整测试脚本

将以下内容保存为 `test.sh` 并执行:

```bash
#!/bin/bash
BASE_URL="http://localhost:3000"

echo "=== 1. 健康检查 ==="
curl ${BASE_URL}/health
echo -e "\n"

echo "=== 2. 创建解析规则 ==="
RULE_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "用户数据校验规则",
    "columns": [
      { "name": "name", "required": true, "minLength": 2 },
      { "name": "email", "required": true, "type": "email" },
      { "name": "age", "required": true, "type": "number" }
    ]
  }')
echo $RULE_RESPONSE
RULE_ID=$(echo $RULE_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "规则ID: $RULE_ID"
echo -e "\n"

echo "=== 3. 上传文件 ==="
FILE_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/files/upload \
  -F "file=@test-data.csv" \
  -F "uploadedBy=test-user")
echo $FILE_RESPONSE
FILE_ID=$(echo $FILE_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "文件ID: $FILE_ID"
echo -e "\n"

sleep 1

echo "=== 4. 创建解析任务 ==="
TASK_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/tasks \
  -H "Content-Type: application/json" \
  -d "{\"fileId\": \"$FILE_ID\", \"ruleId\": \"$RULE_ID\"}")
echo $TASK_RESPONSE
TASK_ID=$(echo $TASK_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "任务ID: $TASK_ID"
echo -e "\n"

sleep 2

echo "=== 5. 检查任务进度 ==="
curl ${BASE_URL}/api/tasks/${TASK_ID}/progress
echo -e "\n"

echo "=== 6. 验证幂等性（重复提交） ==="
curl -s -X POST ${BASE_URL}/api/tasks \
  -H "Content-Type: application/json" \
  -d "{\"fileId\": \"$FILE_ID\", \"ruleId\": \"$RULE_ID\"}"
echo -e "\n"

echo "=== 7. 查看失败行 ==="
curl "${BASE_URL}/api/failed-rows?taskId=${TASK_ID}"
echo -e "\n"

echo "=== 8. 查看摘要 ==="
curl "${BASE_URL}/api/summaries?taskId=${TASK_ID}"
echo -e "\n"
```
