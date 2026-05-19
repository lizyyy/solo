# 访问日志爬虫过滤保留样本后端API

基于 FastAPI + SQLite 的访问日志爬虫过滤系统，帮助运营团队在导入报表前自动识别并分离爬虫流量。

## 核心功能

- **日志解析**: 支持 Nginx 格式和 JSON 格式访问日志
- **规则匹配**: 基于 User-Agent、IP、路径等多维度规则
- **可疑分组**: IP + User-Agent 维度自动分组
- **置信度评分**: 0-1 分制标识爬虫可能性
- **人工修正**: 支持运营人员手动修正误判
- **保留样本导出**: CSV 格式导出审核样本
- **净化报告生成**: 统计分析爬虫比例、TOP 爬虫来源等
- **审计日志**: 所有操作留痕，可追溯

## 快速启动

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动，自动创建 SQLite 数据库 `crawler_filter.db`。

### 3. 查看 API 文档

访问 Swagger UI: `http://localhost:8000/docs`

## 造数生成测试数据

### 生成模拟访问日志

```bash
python generate_test_data.py
```

将在当前目录生成 `test_access.log`，包含 200 条模拟日志，约 40% 为爬虫流量。

## cURL 主流程示例

### 1. 导入日志文件

```bash
curl -X POST "http://localhost:8000/api/logs/import?operator=admin" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test_access.log"
```

响应示例:
```json
{
  "success": 198,
  "failed": 2,
  "batch_id": "a1b2c3d4",
  "message": "导入完成，批次ID: a1b2c3d4"
}
```

### 1.1 单条创建访问日志

```bash
curl -X POST "http://localhost:8000/api/logs" \
  -H "Content-Type: application/json" \
  -d '{
    "ip": "192.168.1.100",
    "user_agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
    "path": "/api/data",
    "method": "GET",
    "status_code": 200,
    "referer": "https://example.com"
  }'
```

响应示例:
```json
{
  "id": 1,
  "is_crawler": true,
  "crawler_confidence": 0.95,
  "status": "classified",
  "message": "日志创建成功"
}
```

### 2. 查询日志列表

```bash
# 查询所有日志
curl "http://localhost:8000/api/logs?page=1&page_size=50"

# 只查爬虫日志
curl "http://localhost:8000/api/logs?is_crawler=true"

# 查询待审核日志
curl "http://localhost:8000/api/logs?status=pending_review"

# 按 IP 筛选
curl "http://localhost:8000/api/logs?ip=192.168.1"
```

### 3. 查看单条日志详情（含审计历史）

```bash
curl "http://localhost:8000/api/logs/1"
```

### 4. 人工修正（批量）

```bash
curl -X POST "http://localhost:8000/api/logs/manual-correction" \
  -H "Content-Type: application/json" \
  -d '{
    "log_ids": [1, 2, 3],
    "is_crawler": false,
    "operator": "zhang_san",
    "reason": "误判，实际是内部员工访问"
  }'
```

### 5. 撤回日志（异常路径处理）

```bash
curl -X POST "http://localhost:8000/api/logs/withdraw?operator=zhang_san&reason=这部分日志数据异常，需要重新导入" \
  -H "Content-Type: application/json" \
  -d '[4, 5, 6]'
```

### 6. 导出样本用于审核

```bash
curl "http://localhost:8000/api/logs/export/sample?sample_size=100&status=pending_review" \
  -o audit_samples.csv
```

### 7. 导出净化后的日志（已排除爬虫）

```bash
curl "http://localhost:8000/api/logs/export/purified?exclude_crawler=true&exclude_withdrawn=true" \
  -o purified_logs.csv
```

### 8. 管理过滤规则

```bash
# 创建规则
curl -X POST "http://localhost:8000/api/rules" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "block_scrapy",
    "rule_type": "user_agent",
    "pattern": "Scrapy",
    "confidence": 1.0,
    "description": "Scrapy 爬虫特征"
  }'

# 查看所有规则
curl "http://localhost:8000/api/rules"

# 删除规则
curl -X DELETE "http://localhost:8000/api/rules/1"
```

### 9. 净化报告管理

```bash
# 查看报告列表
curl "http://localhost:8000/api/reports"

# 查看单个报告
curl "http://localhost:8000/api/reports/1"

# 推进状态 processing -> reviewing
curl -X POST "http://localhost:8000/api/reports/1/advance-status" \
  -H "Content-Type: application/json" \
  -d '{
    "report_id": 1,
    "status": "reviewing",
    "operator": "zhang_san",
    "reason": "开始人工审核"
  }'

# 关闭报告
curl -X POST "http://localhost:8000/api/reports/1/close?operator=zhang_san&reason=审核完成"
```

### 10. 查看统计看板

```bash
curl "http://localhost:8000/api/statistics/dashboard"
```

### 11. 查看审计日志

```bash
curl "http://localhost:8000/api/audit-logs?page=1&page_size=50"
```

### 12. 导入失败日志处理（异常路径保留原始输入）

```bash
# 查询所有失败日志
curl "http://localhost:8000/api/failed-logs?page=1&page_size=50"

# 按批次ID查询失败日志
curl "http://localhost:8000/api/failed-logs?batch_id=a1b2c3d4"

# 按处理状态筛选
curl "http://localhost:8000/api/failed-logs?resolution_status=pending"

# 查看单条失败日志详情（含原始输入、错误信息、处理人）
curl "http://localhost:8000/api/failed-logs/1"

# 标记处理完成（保留处理结论）
curl -X PUT "http://localhost:8000/api/failed-logs/1/resolve" \
  -H "Content-Type: application/json" \
  -d '{
    "resolution_status": "manually_fixed",
    "resolution_note": "已手动解析并重新导入，原始格式缺少User-Agent字段",
    "resolved_by": "zhang_san"
  }'
```

失败日志表保存的关键信息：
- `raw_content`: 完整的原始错误输入
- `error_type`: 错误类型（parse_error/ValueError等）
- `error_message`: 具体错误信息
- `operator`: 操作人（谁导入的）
- `line_number`: 所在行号
- `resolution_status`: 处理状态
- `resolution_note`: 处理结论备注
- `resolved_by`: 处理人

## 冲突路径与异常处理

### 状态流转限制

```bash
# 有效的状态流转路径:
- processing → reviewing → completed → closed
           → closed

# 无效流转会返回 400 错误
```

### 审计追踪

所有修改操作（人工修正、撤回、状态变更）都会记录到 `audit_logs` 表，包含：
- 操作人
- 操作时间
- 旧值
- 新值
- 原因说明

### 错误响应示例

```bash
# 尝试获取不存在的日志
curl "http://localhost:8000/api/logs/999999"
# 响应: {"detail": "日志不存在"} (HTTP 404

# 尝试非法状态流转
curl -X POST "http://localhost:8000/api/reports/1/advance-status" \
  -H "Content-Type: application/json" \
  -d '{"report_id": 1, "status": "invalid", "operator": "admin"}'
# 响应: {"detail": "无法从 closed 转换到 invalid"} (HTTP 400)
```

## pytest 测试

### 运行所有测试

```bash
pytest test_main.py -v
```

### 运行指定测试

```bash
pytest test_main.py::test_import_logs -v
```

### 生成覆盖率报告

```bash
pytest test_main.py --cov=. --cov-report=html
```

## 数据库表结构

### access_logs（访问日志表）

- id: 主键
- ip: 访问 IP
- user_agent: 用户代理
- path: 请求路径
- method: 请求方法
- status_code: HTTP 状态码
- request_time: 请求时间
- referer: 来源页面
- response_time: 响应时间
- raw_log: 原始日志
- is_crawler: 是否爬虫
- crawler_confidence: 爬虫置信度
- crawler_type: 爬虫类型（匹配原因
- group_id: 分组ID
- status: 状态（pending_review/classified/manually_corrected/withdrawn）
- created_at, updated_at: 时间戳

### filter_rules（过滤规则表）

- id: 主键
- name: 规则名称
- rule_type: 规则类型（user_agent/ip/path）
- pattern: 匹配模式
- is_active: 是否启用
- confidence: 置信度权重
- description: 描述

### purification_reports（净化报告表）

- id: 主键
- batch_id: 批次ID
- total_logs: 总日志数
- crawler_count: 爬虫数
- human_count: 人类访问数
- pending_count: 待审核数
- status: 报告状态
- created_by: 创建人

### audit_logs（审计日志表）

- id: 主键
- log_id: 关联日志ID
- report_id: 关联报告ID
- action: 操作类型
- operator: 操作人
- old_value: 旧值
- new_value: 新值
- reason: 原因
- created_at: 创建时间

## 爬虫检测逻辑

### 内置检测规则

1. **User-Agent 关键词匹配 (0.95分)
   - bot, crawler, spider, slurp, robot, scrapy, selenium 等
   
2. **User-Agent 库检测 (0.98分)
   - 使用 user-agents 库专业检测

3. **可疑路径匹配 (0.7分)
   - /robots.txt, /sitemap.xml, /admin, /wp-, .env, .git 等

4. **可疑 HTTP 方法 (0.3分)
   - HEAD, OPTIONS, TRACE 方法

5. **自定义规则**
   - 用户可添加正则表达式规则

### 置信度计算

- 多规则命中时置信度累加，上限 1.0
- 置信度 >= 0.5 标记为爬虫
- 置信度 >= 0.8 自动标记为已分类
- 置信度 0.5-0.8 进入待审核状态
