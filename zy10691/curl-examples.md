# cURL 示例

## 基础命令

### 1. 健康检查
```bash
curl http://localhost:3000/health
```

### 2. 获取仓库列表
```bash
curl http://localhost:3000/api/repositories
```

### 3. 获取漏洞规则列表
```bash
curl http://localhost:3000/api/vulnerability-rules
```

## 扫描结果操作

### 4. 获取扫描结果列表
```bash
# 获取所有结果
curl http://localhost:3000/api/scan-results

# 分页获取
curl "http://localhost:3000/api/scan-results?page=1&limit=10"

# 按状态筛选
curl "http://localhost:3000/api/scan-results?status=OPEN"

# 按仓库筛选
curl "http://localhost:3000/api/scan-results?repository_id=1"

# 按文件路径模糊搜索
curl "http://localhost:3000/api/scan-results?file_path=config"
```

### 5. 提交新的扫描结果
```bash
curl -X POST http://localhost:3000/api/scan-results \
  -H "Content-Type: application/json" \
  -d '{
    "repository_id": 1,
    "rule_id": "SQLI-001",
    "file_path": "src/api/search.js",
    "line_number": 56,
    "commit_hash": "abcdef123456"
  }'
```

## 复核操作

### 6. 提交复核（进入复核中状态）
```bash
curl -X POST http://localhost:3000/api/scan-results/1/review \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "zhang.san",
    "review_type": "SUBMIT",
    "comment": "请团队复核此SQL注入漏洞"
  }'
```

### 7. 关闭漏洞（标记为误报）
```bash
curl -X POST http://localhost:3000/api/scan-results/1/review \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "li.si",
    "review_type": "CLOSE",
    "comment": "经核实，此处使用ORM框架，参数已正确转义，确认为误报"
  }'
```

### 8. 重新打开漏洞
```bash
curl -X POST http://localhost:3000/api/scan-results/1/review \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "wang.wu",
    "review_type": "REOPEN",
    "comment": "扫描规则升级，需要重新评估此漏洞"
  }'
```

### 9. 获取漏洞的复核历史记录
```bash
curl http://localhost:3000/api/scan-results/3/reviews
```

## 边界情况测试

### 10. 相同条件重复提交（应保持原有误报状态）
```bash
curl -X POST http://localhost:3000/api/scan-results \
  -H "Content-Type: application/json" \
  -d '{
    "repository_id": 2,
    "rule_id": "AUTH-003",
    "file_path": "config/database.js",
    "line_number": 15,
    "commit_hash": "xyz789abc123"
  }'
```

### 11. 同一规则但不同commit（应创建新记录）
```bash
curl -X POST http://localhost:3000/api/scan-results \
  -H "Content-Type: application/json" \
  -d '{
    "repository_id": 2,
    "rule_id": "AUTH-003",
    "file_path": "config/database.js",
    "line_number": 15,
    "commit_hash": "new_commit_hash"
  }'
```

### 12. 同一规则但不同文件路径（应创建新记录）
```bash
curl -X POST http://localhost:3000/api/scan-results \
  -H "Content-Type: application/json" \
  -d '{
    "repository_id": 2,
    "rule_id": "AUTH-003",
    "file_path": "src/config/database.js",
    "line_number": 15,
    "commit_hash": "xyz789abc123"
  }'
```
