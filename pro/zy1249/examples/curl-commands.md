# API Design Reviewer - Curl 命令示例

本文档包含使用 API 设计评审服务的常用 curl 命令示例。

---

## 基础信息

- 服务地址: `http://localhost:3000`
- API 根路径: `/api/v1`
- API 文档: `GET /api/v1/openapi`
- 健康检查: `GET /api/v1/stats/health`

---

## 1. 基础操作

### 1.1 健康检查
```bash
# 检查服务是否正常运行
curl -X GET "http://localhost:3000/api/v1/stats/health" \
  -H "Content-Type: application/json"
```

### 1.2 获取服务信息
```bash
# 获取服务基本信息和可用端点
curl -X GET "http://localhost:3000/" \
  -H "Content-Type: application/json"
```

### 1.3 获取 OpenAPI 文档
```bash
# 获取服务自身的 OpenAPI 规范
curl -X GET "http://localhost:3000/api/v1/openapi" \
  -H "Content-Type: application/json"
```

### 1.4 获取统计信息
```bash
# 获取系统统计信息
curl -X GET "http://localhost:3000/api/v1/stats" \
  -H "Content-Type: application/json"
```

---

## 2. 规则管理

### 2.1 获取所有规则
```bash
# 获取所有可用的评审规则
curl -X GET "http://localhost:3000/api/v1/rules" \
  -H "Content-Type: application/json"
```

### 2.2 按分类筛选规则
```bash
# 获取资源命名规范相关的规则
curl -X GET "http://localhost:3000/api/v1/rules?category=resource-naming" \
  -H "Content-Type: application/json"

# 获取 HTTP 方法规范相关的规则
curl -X GET "http://localhost:3000/api/v1/rules?category=http-method" \
  -H "Content-Type: application/json"

# 获取状态码规范相关的规则
curl -X GET "http://localhost:3000/api/v1/rules?category=status-code" \
  -H "Content-Type: application/json"

# 获取分页过滤规范相关的规则
curl -X GET "http://localhost:3000/api/v1/rules?category=pagination" \
  -H "Content-Type: application/json"

# 获取幂等键规范相关的规则
curl -X GET "http://localhost:3000/api/v1/rules?category=idempotency" \
  -H "Content-Type: application/json"

# 获取错误码规范相关的规则
curl -X GET "http://localhost:3000/api/v1/rules?category=error-code" \
  -H "Content-Type: application/json"

# 获取版本控制规范相关的规则
curl -X GET "http://localhost:3000/api/v1/rules?category=versioning" \
  -H "Content-Type: application/json"
```

### 2.3 按启用状态筛选规则
```bash
# 获取已启用的规则
curl -X GET "http://localhost:3000/api/v1/rules?isEnabled=true" \
  -H "Content-Type: application/json"

# 获取已禁用的规则
curl -X GET "http://localhost:3000/api/v1/rules?isEnabled=false" \
  -H "Content-Type: application/json"
```

---

## 3. 创建评审

### 3.1 上传 OpenAPI 文件创建评审
```bash
# 上传好样例 OpenAPI 文件
curl -X POST "http://localhost:3000/api/v1/reviews" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "openapi=@examples/openapi-good-example.yaml" \
  -F "apiName=用户管理API" \
  -F "apiVersion=1.0.0"

# 上传坏样例 OpenAPI 文件
curl -X POST "http://localhost:3000/api/v1/reviews" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "openapi=@examples/openapi-bad-example.yaml" \
  -F "apiName=错误示例API" \
  -F "apiVersion=1.0.0"
```

### 3.2 同时上传自定义规则配置
```bash
# 使用自定义规则配置创建评审
curl -X POST "http://localhost:3000/api/v1/reviews" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "openapi=@examples/openapi-bad-example.yaml" \
  -F "rules=@examples/api-rules-example.yaml" \
  -F "apiName=带自定义规则的API评审" \
  -F "apiVersion=1.0.0"
```

### 3.3 使用 JSON 格式的 OpenAPI
```bash
# 使用 JSON 格式的 OpenAPI
curl -X POST "http://localhost:3000/api/v1/reviews" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "openapi=@examples/openapi-good-example.json" \
  -F "apiName=JSON格式API" \
  -F "apiVersion=1.0.0"
```

---

## 4. 查询评审

### 4.1 获取评审列表
```bash
# 获取所有评审（默认分页）
curl -X GET "http://localhost:3000/api/v1/reviews" \
  -H "Content-Type: application/json"

# 自定义分页参数
curl -X GET "http://localhost:3000/api/v1/reviews?limit=50&offset=0" \
  -H "Content-Type: application/json"

# 按状态筛选
curl -X GET "http://localhost:3000/api/v1/reviews?status=completed" \
  -H "Content-Type: application/json"
```

### 4.2 获取评审详情
```bash
# 获取单个评审详情（将 REVIEW_ID 替换为实际的评审 ID）
REVIEW_ID="your-review-id-here"
curl -X GET "http://localhost:3000/api/v1/reviews/${REVIEW_ID}" \
  -H "Content-Type: application/json"
```

---

## 5. 评审报告

### 5.1 获取 JSON 格式报告
```bash
# 获取 JSON 格式的评审报告
REVIEW_ID="your-review-id-here"
curl -X GET "http://localhost:3000/api/v1/reviews/${REVIEW_ID}/report" \
  -H "Content-Type: application/json"
```

### 5.2 获取 Markdown 格式报告
```bash
# 获取 Markdown 格式的评审报告
REVIEW_ID="your-review-id-here"
curl -X GET "http://localhost:3000/api/v1/reviews/${REVIEW_ID}/report?format=markdown" \
  -H "Content-Type: application/json"

# 或使用 format=md
curl -X GET "http://localhost:3000/api/v1/reviews/${REVIEW_ID}/report?format=md" \
  -H "Content-Type: application/json"
```

### 5.3 导出报告到文件
```bash
# 导出 JSON 报告到文件
REVIEW_ID="your-review-id-here"
curl -X GET "http://localhost:3000/api/v1/reviews/${REVIEW_ID}/report" \
  -H "Content-Type: application/json" \
  -o "report-${REVIEW_ID}.json"

# 导出 Markdown 报告到文件
curl -X GET "http://localhost:3000/api/v1/reviews/${REVIEW_ID}/report?format=markdown" \
  -H "Content-Type: application/json" \
  -o "report-${REVIEW_ID}.md"
```

---

## 6. 重新运行评审

### 6.1 重新执行评审
```bash
# 重新运行指定的评审（使用最新规则）
REVIEW_ID="your-review-id-here"
curl -X POST "http://localhost:3000/api/v1/reviews/${REVIEW_ID}/rerun" \
  -H "Content-Type: application/json"
```

---

## 7. 删除评审

### 7.1 删除单个评审
```bash
# 删除指定的评审记录
REVIEW_ID="your-review-id-here"
curl -X DELETE "http://localhost:3000/api/v1/reviews/${REVIEW_ID}" \
  -H "Content-Type: application/json"
```

---

## 8. 完整工作流示例

### 8.1 完整评审流程
```bash
#!/bin/bash

# 1. 检查服务状态
echo "=== 检查服务状态 ==="
curl -X GET "http://localhost:3000/api/v1/stats/health"

# 2. 查看可用规则
echo -e "\n=== 查看资源命名规则 ==="
curl -X GET "http://localhost:3000/api/v1/rules?category=resource-naming"

# 3. 创建评审
echo -e "\n=== 创建评审 ==="
RESPONSE=$(curl -s -X POST "http://localhost:3000/api/v1/reviews" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "openapi=@examples/openapi-bad-example.yaml" \
  -F "apiName=测试API" \
  -F "apiVersion=1.0.0")

# 4. 提取评审 ID
REVIEW_ID=$(echo "$RESPONSE" | sed -n 's/.*"id"\s*:\s*"\([^"]*\)".*/\1/p')
echo -e "\n评审 ID: $REVIEW_ID"

# 5. 查看评审详情
echo -e "\n=== 评审详情 ==="
curl -X GET "http://localhost:3000/api/v1/reviews/${REVIEW_ID}"

# 6. 导出 JSON 报告
echo -e "\n=== 导出 JSON 报告 ==="
curl -X GET "http://localhost:3000/api/v1/reviews/${REVIEW_ID}/report" \
  -o "review-report.json"

# 7. 导出 Markdown 报告
echo -e "\n=== 导出 Markdown 报告 ==="
curl -X GET "http://localhost:3000/api/v1/reviews/${REVIEW_ID}/report?format=md" \
  -o "review-report.md"

echo -e "\n=== 完成 ==="
```

---

## 9. 使用 jq 处理响应

### 9.1 提取评审 ID
```bash
# 创建评审并提取 ID
REVIEW_ID=$(curl -s -X POST "http://localhost:3000/api/v1/reviews" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "openapi=@examples/openapi-bad-example.yaml" \
  -F "apiName=测试API" | jq -r '.id')

echo "评审 ID: $REVIEW_ID"
```

### 9.2 查看评审得分
```bash
# 获取评审得分
curl -s -X GET "http://localhost:3000/api/v1/reviews/${REVIEW_ID}" | \
  jq '{
    id: .id,
    apiName: .apiName,
    score: .score,
    issueCounts: .issueCounts
  }'
```

### 9.3 按严重级别筛选问题
```bash
# 获取所有 critical 级别的问题
curl -s -X GET "http://localhost:3000/api/v1/reviews/${REVIEW_ID}" | \
  jq '.issues[] | select(.severity == "critical")'

# 获取所有 error 级别的问题
curl -s -X GET "http://localhost:3000/api/v1/reviews/${REVIEW_ID}" | \
  jq '.issues[] | select(.severity == "error")'
```

---

## 10. 批量操作脚本示例

### 10.1 批量评审多个 OpenAPI 文件
```bash
#!/bin/bash

# 批量评审目录中的所有 OpenAPI 文件
API_DIR="examples/"
OUTPUT_DIR="reports/"

mkdir -p "$OUTPUT_DIR"

for file in "$API_DIR"/openapi-*.yaml; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    api_name="${filename%.yaml}"
    
    echo "正在评审: $filename"
    
    # 创建评审
    REVIEW_ID=$(curl -s -X POST "http://localhost:3000/api/v1/reviews" \
      -H "accept: application/json" \
      -H "Content-Type: multipart/form-data" \
      -F "openapi=@$file" \
      -F "apiName=$api_name" | jq -r '.id')
    
    # 导出报告
    if [ -n "$REVIEW_ID" ] && [ "$REVIEW_ID" != "null" ]; then
      curl -s -X GET "http://localhost:3000/api/v1/reviews/${REVIEW_ID}/report?format=md" \
        -o "$OUTPUT_DIR/$api_name-report.md"
      
      curl -s -X GET "http://localhost:3000/api/v1/reviews/${REVIEW_ID}/report" \
        -o "$OUTPUT_DIR/$api_name-report.json"
      
      echo "报告已保存: $OUTPUT_DIR/$api_name-report.*"
    fi
  fi
done

echo "批量评审完成"
```

---

## 附录：常见 HTTP 状态码说明

| 状态码 | 含义 | 常见场景 |
|--------|------|----------|
| 200 | OK | 成功执行 GET、PUT、PATCH 操作 |
| 201 | Created | 成功执行 POST 创建操作 |
| 204 | No Content | 成功执行 DELETE 操作 |
| 400 | Bad Request | 请求参数错误 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突 |
| 500 | Internal Server Error | 服务器内部错误 |
