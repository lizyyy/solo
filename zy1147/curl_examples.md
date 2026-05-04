# 敏感内容审核服务 - CURL 示例

## 基础信息

- **服务地址**: http://localhost:8000
- **API 前缀**: /api/v1
- **API 文档**: http://localhost:8000/docs

---

## 1. 健康检查

```bash
# 检查服务状态
curl http://localhost:8000/health

# 检查根路径
curl http://localhost:8000/
```

---

## 2. 文本检测

### 2.1 单条文本检测

```bash
# 检测包含敏感词的文本
curl -X POST http://localhost:8000/api/v1/detect/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "今天去赌博，赢了很多钱"
  }'

# 检测正常文本
curl -X POST http://localhost:8000/api/v1/detect/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "您好，我是客服小张，有什么可以帮助您的？"
  }'

# 检测变体绕过 - 空格插入
curl -X POST http://localhost:8000/api/v1/detect/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "今天去赌 博，赢了很多钱"
  }'

# 检测变体绕过 - 符号插入
curl -X POST http://localhost:8000/api/v1/detect/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "今天去赌*场赌_博"
  }'

# 检测全角字符
curl -X POST http://localhost:8000/api/v1/detect/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "今天去賭博"
  }'

# 检测辱骂攻击
curl -X POST http://localhost:8000/api/v1/detect/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "你这个傻逼，滚蛋！"
  }'
```

### 2.2 批量文本检测

```bash
curl -X POST http://localhost:8000/api/v1/detect/batch \
  -H "Content-Type: application/json" \
  -d '{
    "texts": [
      "今天去赌博",
      "我是客服，有什么可以帮助您的",
      "你这个傻逼",
      "运营团队正在处理",
      "我想买枪支"
    ]
  }'
```

### 2.3 重新加载词库

```bash
curl -X POST http://localhost:8000/api/v1/detect/reload
```

### 2.4 获取检测统计

```bash
curl http://localhost:8000/api/v1/detect/stats
```

---

## 3. 词库管理

### 3.1 敏感词管理

```bash
# 获取敏感词列表
curl "http://localhost:8000/api/v1/lexicon/words?page=1&page_size=20"

# 按分类筛选
curl "http://localhost:8000/api/v1/lexicon/words?category=gambling&page=1&page_size=20"

# 按严重级别筛选
curl "http://localhost:8000/api/v1/lexicon/words?severity=high&page=1&page_size=20"

# 关键词搜索
curl "http://localhost:8000/api/v1/lexicon/words?keyword=赌博&page=1&page_size=20"

# 获取单个敏感词详情（替换 {id} 为实际 ID）
curl http://localhost:8000/api/v1/lexicon/words/1

# 创建新敏感词
curl -X POST http://localhost:8000/api/v1/lexicon/words \
  -H "Content-Type: application/json" \
  -d '{
    "word": "测试敏感词",
    "category": "other",
    "severity": "medium",
    "description": "这是一个测试敏感词",
    "suggestion": "建议人工审核"
  }'

# 更新敏感词（替换 {id} 为实际 ID）
curl -X PUT http://localhost:8000/api/v1/lexicon/words/1 \
  -H "Content-Type: application/json" \
  -d '{
    "severity": "high",
    "description": "更新后的描述"
  }'

# 删除敏感词（替换 {id} 为实际 ID）
curl -X DELETE http://localhost:8000/api/v1/lexicon/words/1
```

### 3.2 同义词管理

```bash
# 获取同义词列表
curl "http://localhost:8000/api/v1/lexicon/synonyms?page=1&page_size=20"

# 按敏感词 ID 筛选
curl "http://localhost:8000/api/v1/lexicon/synonyms?sensitive_word_id=1&page=1&page_size=20"

# 创建同义词
curl -X POST http://localhost:8000/api/v1/lexicon/synonyms \
  -H "Content-Type: application/json" \
  -d '{
    "synonym": "赌钱",
    "sensitive_word_id": 1
  }'

# 删除同义词（替换 {id} 为实际 ID）
curl -X DELETE http://localhost:8000/api/v1/lexicon/synonyms/1
```

### 3.3 白名单管理

```bash
# 获取白名单列表
curl "http://localhost:8000/api/v1/lexicon/whitelist?page=1&page_size=20"

# 创建白名单词条
curl -X POST http://localhost:8000/api/v1/lexicon/whitelist \
  -H "Content-Type: application/json" \
  -d '{
    "term": "赌博罪",
    "reason": "法律术语，不是敏感内容",
    "context": "法律相关"
  }'

# 删除白名单词条（替换 {id} 为实际 ID）
curl -X DELETE http://localhost:8000/api/v1/lexicon/whitelist/1
```

### 3.4 导入词库

```bash
# 导入 CSV 文件
curl -X POST "http://localhost:8000/api/v1/lexicon/import/csv?category=other&severity=medium" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@data/seed/sensitive_words.csv"

# 导入 JSON 文件
curl -X POST http://localhost:8000/api/v1/lexicon/import/json \
  -H "Content-Type: multipart/form-data" \
  -F "file=@your_lexicon.json"
```

### 3.5 版本管理

```bash
# 获取版本列表
curl http://localhost:8000/api/v1/lexicon/versions

# 创建新版本
curl -X POST "http://localhost:8000/api/v1/lexicon/versions/create?description=初始版本&is_rollback_point=true"
```

---

## 4. 历史记录

```bash
# 获取检测历史列表
curl "http://localhost:8000/api/v1/history/list?page=1&page_size=20"

# 筛选敏感内容
curl "http://localhost:8000/api/v1/history/list?is_sensitive=true&page=1&page_size=20"

# 筛选待复核内容
curl "http://localhost:8000/api/v1/history/list?review_status=pending&page=1&page_size=20"

# 获取单个检测记录详情（替换 {id} 为实际 ID）
curl http://localhost:8000/api/v1/history/1

# 获取统计概览
curl http://localhost:8000/api/v1/history/stats/summary

# 按时间范围获取统计
curl "http://localhost:8000/api/v1/history/stats/summary?start_date=2024-01-01&end_date=2024-12-31"

# 删除检测记录（替换 {id} 为实际 ID）
curl -X DELETE http://localhost:8000/api/v1/history/1
```

---

## 5. 人工复核

```bash
# 获取复核记录列表
curl http://localhost:8000/api/v1/review/list

# 按检测 ID 筛选
curl "http://localhost:8000/api/v1/review/list?detection_id=1"

# 按复核结果筛选
curl "http://localhost:8000/api/v1/review/list?review_result=false_positive"

# 提交复核
curl -X POST http://localhost:8000/api/v1/review/submit \
  -H "Content-Type: application/json" \
  -d '{
    "detection_id": 1,
    "review_result": "false_positive",
    "reviewer": "admin",
    "comment": "这是正常的业务词汇，不是敏感内容",
    "add_to_whitelist": true
  }'

# 标记误报
curl -X POST http://localhost:8000/api/v1/review/false-positive \
  -H "Content-Type: application/json" \
  -d '{
    "detection_id": 1,
    "reason": "正常业务词汇",
    "reviewer": "admin",
    "add_to_whitelist": true
  }'

# 确认敏感
curl -X POST http://localhost:8000/api/v1/review/confirm-sensitive \
  -H "Content-Type: application/json" \
  -d '{
    "detection_id": 1,
    "comment": "确认是敏感内容",
    "reviewer": "admin",
    "add_to_sensitive_words": true
  }'
```

---

## 6. 报告导出

### 6.1 导出 JSON

```bash
# 导出所有记录
curl -o report.json http://localhost:8000/api/v1/export/report/json

# 导出敏感内容
curl -o sensitive_report.json "http://localhost:8000/api/v1/export/report/json?is_sensitive=true"

# 按时间范围导出
curl -o report.json "http://localhost:8000/api/v1/export/report/json?start_date=2024-01-01&end_date=2024-12-31"

# 按复核状态导出
curl -o pending_report.json "http://localhost:8000/api/v1/export/report/json?review_status=pending"
```

### 6.2 导出 CSV

```bash
# 导出所有记录
curl -o report.csv http://localhost:8000/api/v1/export/report/csv

# 导出敏感内容
curl -o sensitive_report.csv "http://localhost:8000/api/v1/export/report/csv?is_sensitive=true"
```

### 6.3 导出 Markdown

```bash
# 导出所有记录
curl -o report.md http://localhost:8000/api/v1/export/report/markdown

# 导出敏感内容
curl -o sensitive_report.md "http://localhost:8000/api/v1/export/report/markdown?is_sensitive=true"
```

---

## 7. 完整工作流示例

### 步骤 1: 启动服务并导入词库

```bash
# 1. 启动服务（在另一个终端）
# uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 2. 导入敏感词库
curl -X POST "http://localhost:8000/api/v1/lexicon/import/csv?category=other&severity=medium" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@data/seed/sensitive_words.csv"

# 3. 导入白名单
curl -X POST "http://localhost:8000/api/v1/lexicon/import/csv?category=other&severity=medium" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@data/seed/whitelist.csv"

# 4. 重新加载词库缓存
curl -X POST http://localhost:8000/api/v1/detect/reload
```

### 步骤 2: 检测文本

```bash
# 检测可疑文本
curl -X POST http://localhost:8000/api/v1/detect/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "用户说：我想去赌博，赢点钱花花"
  }'

# 检测正常客服文本
curl -X POST http://localhost:8000/api/v1/detect/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "客服：您好，赌博罪是刑法规定的罪名，请您遵守法律"
  }'
```

### 步骤 3: 查看历史和复核

```bash
# 查看待复核列表
curl "http://localhost:8000/api/v1/history/list?review_status=pending&page=1&page_size=10"

# 查看检测详情（替换 {id}）
curl http://localhost:8000/api/v1/history/1

# 标记误报并添加到白名单
curl -X POST http://localhost:8000/api/v1/review/false-positive \
  -H "Content-Type: application/json" \
  -d '{
    "detection_id": 1,
    "reason": "这是在讨论法律问题，不是在宣传赌博",
    "reviewer": "operator_001",
    "add_to_whitelist": true
  }'

# 确认敏感内容
curl -X POST http://localhost:8000/api/v1/review/confirm-sensitive \
  -H "Content-Type: application/json" \
  -d '{
    "detection_id": 2,
    "comment": "确认是赌博宣传内容",
    "reviewer": "operator_001",
    "add_to_sensitive_words": false
  }'
```

### 步骤 4: 导出报告

```bash
# 导出本周审核报告
curl -o weekly_report.md "http://localhost:8000/api/v1/export/report/markdown?start_date=2024-01-01&end_date=2024-01-07"

# 导出所有误报记录
curl -o false_positives.csv "http://localhost:8000/api/v1/export/report/csv?review_status=false_positive"
```
