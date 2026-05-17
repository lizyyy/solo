# 模型评测复核API - curl使用示例

## 基础信息
- 服务地址: http://localhost:3000
- API根路径: /api/v1/review

---

## 1. 健康检查

```bash
curl http://localhost:3000/health
```

---

## 2. 评测批次管理

### 创建评测批次
```bash
curl -X POST http://localhost:3000/api/v1/review/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batchName": "GPT-4对话评测-202401",
    "modelName": "GPT-4",
    "evaluationType": "对话质量评测",
    "createdBy": "张三"
  }'
```

### 获取所有评测批次
```bash
curl http://localhost:3000/api/v1/review/batches
```

### 获取单个评测批次详情
```bash
# 替换 {batchId} 为实际的批次ID
curl http://localhost:3000/api/v1/review/batches/{batchId}
```

---

## 3. 评测样本管理

### 创建评测样本
```bash
# 替换 {batchId} 为实际的批次ID
curl -X POST http://localhost:3000/api/v1/review/samples \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "{batchId}",
    "content": "用户问题: 请解释什么是人工智能？",
    "originalScore": 85,
    "modelOutput": "人工智能是计算机科学的一个分支...",
    "expectedOutput": "人工智能（AI）是计算机科学的重要分支...",
    "metadata": {
      "category": "科普",
      "difficulty": "中等"
    }
  }'
```

### 获取样本及其复核记录
```bash
# 替换 {sampleId} 为实际的样本ID
curl http://localhost:3000/api/v1/review/samples/{sampleId}
```

---

## 4. 复核记录管理

### 创建复核记录（不改分）
```bash
# 替换 {sampleId} 和 {batchId} 为实际ID
curl -X POST http://localhost:3000/api/v1/review/reviews \
  -H "Content-Type: application/json" \
  -d '{
    "sampleId": "{sampleId}",
    "batchId": "{batchId}",
    "reviewerId": "reviewer_001",
    "reviewerName": "李四",
    "reviewOpinion": "回答准确，逻辑清晰，无需改分",
    "processingBasis": "依据评测标准第3条，回答完整性达标"
  }'
```

### 创建复核记录（改分）
```bash
# 替换 {sampleId} 和 {batchId} 为实际ID
curl -X POST http://localhost:3000/api/v1/review/reviews \
  -H "Content-Type: application/json" \
  -d '{
    "sampleId": "{sampleId}",
    "batchId": "{batchId}",
    "reviewerId": "reviewer_001",
    "reviewerName": "李四",
    "reviewOpinion": "回答缺少关键知识点，需要扣分",
    "revisedScore": 70,
    "processingBasis": "依据评测标准第2条，回答不完整扣15分",
    "rawInput": {
      "originalRequest": "改分申请",
      "attachments": ["评测标准文档.pdf"]
    }
  }'
```

### 获取单个复核记录
```bash
# 替换 {reviewId} 为实际的复核ID
curl http://localhost:3000/api/v1/review/reviews/{reviewId}
```

### 获取批次下所有复核记录
```bash
# 替换 {batchId} 为实际的批次ID
curl http://localhost:3000/api/v1/review/batches/{batchId}/reviews
```

---

## 5. 状态管理

### 更新复核状态
```bash
# 替换 {reviewId} 为实际的复核ID
curl -X PATCH http://localhost:3000/api/v1/review/reviews/{reviewId}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "reviewed",
    "updatedBy": "王五"
  }'
```

**状态可选值:**
- pending: 待复核
- under_review: 复核中
- reviewed: 已复核
- revised: 已改判
- cancelled: 已取消

---

## 6. 人工改判

### 人工修正分数
```bash
# 替换 {reviewId} 为实际的复核ID
curl -X PATCH http://localhost:3000/api/v1/review/reviews/{reviewId}/correct \
  -H "Content-Type: application/json" \
  -d '{
    "revisedScore": 95,
    "reviewOpinion": "经专家组复核，原评分偏低，现调整为95分",
    "reviewerId": "senior_reviewer_001",
    "reviewerName": "赵六（高级评审）",
    "processingBasis": "专家组评审意见，符合优秀标准"
  }'
```

---

## 7. 异常处理

### 记录异常处理
```bash
# 替换 {reviewId} 为实际的复核ID
curl -X PATCH http://localhost:3000/api/v1/review/reviews/{reviewId}/exception \
  -H "Content-Type: application/json" \
  -d '{
    "exceptionMessage": "样本内容存在争议，无法正常评分",
    "processingBasis": "提交争议处理委员会，标记为异常样本",
    "rawInput": {
      "submitter": "李四",
      "exceptionType": "content_dispute"
    }
  }'
```

---

## 8. 报告导出

### 生成批次报告
```bash
# 替换 {batchId} 为实际的批次ID
curl -X POST http://localhost:3000/api/v1/review/reports/generate/{batchId} \
  -H "Content-Type: application/json" \
  -d '{
    "generatedBy": "管理员"
  }'
```

### 导出批次报告（JSON格式，业务友好）
```bash
curl -X POST http://localhost:3000/api/v1/review/reports/export/batch \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "{batchId}",
    "format": "json",
    "generatedBy": "管理员"
  }'
```

### 导出批次报告（CSV格式，可直接用Excel打开）
```bash
curl -X POST http://localhost:3000/api/v1/review/reports/export/batch \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "{batchId}",
    "format": "csv",
    "generatedBy": "管理员"
  }' --output review_report.csv
```

### 导出单个样本复核详情（JSON）
```bash
# 替换 {sampleId} 为实际的样本ID
curl -X POST http://localhost:3000/api/v1/review/reports/export/sample/{sampleId} \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json",
    "generatedBy": "管理员"
  }'
```

### 导出单个样本复核详情（CSV）
```bash
# 替换 {sampleId} 为实际的样本ID
curl -X POST http://localhost:3000/api/v1/review/reports/export/sample/{sampleId} \
  -H "Content-Type: application/json" \
  -d '{
    "format": "csv",
    "generatedBy": "管理员"
  }' --output sample_report.csv
```

---

## 完整工作流示例

```bash
# 1. 创建批次
BATCH_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/review/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batchName": "完整流程测试批次",
    "modelName": "GPT-4",
    "evaluationType": "综合评测",
    "createdBy": "张三"
  }')
BATCH_ID=$(echo $BATCH_RESPONSE | jq -r '.data.batchId')
echo "创建的批次ID: $BATCH_ID"

# 2. 创建样本
SAMPLE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/review/samples \
  -H "Content-Type: application/json" \
  -d "{
    \"batchId\": \"$BATCH_ID\",
    \"content\": \"测试问题\",
    \"originalScore\": 80,
    \"modelOutput\": \"测试回答\"
  }")
SAMPLE_ID=$(echo $SAMPLE_RESPONSE | jq -r '.data.sampleId')
echo "创建的样本ID: $SAMPLE_ID"

# 3. 创建复核记录并改分
REVIEW_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/review/reviews \
  -H "Content-Type: application/json" \
  -d "{
    \"sampleId\": \"$SAMPLE_ID\",
    \"batchId\": \"$BATCH_ID\",
    \"reviewerId\": \"r001\",
    \"reviewerName\": \"李四\",
    \"reviewOpinion\": \"回答质量优秀，加分\",
    \"revisedScore\": 90
  }")
REVIEW_ID=$(echo $REVIEW_RESPONSE | jq -r '.data.reviewId')
echo "创建的复核ID: $REVIEW_ID"

# 4. 查看样本及其复核记录
echo "=== 样本复核详情 ==="
curl "http://localhost:3000/api/v1/review/samples/$SAMPLE_ID"

# 5. 导出报告
echo -e "\n=== 导出CSV报告 ==="
curl -X POST "http://localhost:3000/api/v1/review/reports/export/batch" \
  -H "Content-Type: application/json" \
  -d "{\"batchId\": \"$BATCH_ID\", \"format\": \"csv\", \"generatedBy\": \"测试人员\"}" \
  --output test_report.csv

echo "报告已导出到 test_report.csv"
```

---

## 注意事项

1. 所有ID字段均为UUID格式
2. 分数范围为0-100
3. 导出的CSV文件采用UTF-8编码，可直接用Excel打开
4. 异常处理时会保留原始输入和处理依据，便于追溯
