# 浏览器兼容豁免失败样例追踪后端API

## 项目概述

基于 FastAPI + SQLite 的浏览器兼容豁免管理系统，用于追踪前端兼容检查中的失败样例、豁免申请和复核流转。

## 核心功能

- **浏览器矩阵校验**：验证浏览器版本是否在兼容矩阵内
- **豁免到期管理**：自动检测豁免是否过期
- **失败样例归档**：保留所有兼容测试失败记录
- **复核流转**：支持申请 -> 审核 -> 生效的状态流转
- **结论导出**：支持导出Excel格式的兼容结论报告

## 快速启动

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动，API文档可访问 `http://localhost:8000/docs`

### 3. 生成测试数据

```bash
python seed_data.py
```

## API 主流程 (curl 示例)

### 创建失败样例

```bash
curl -X POST "http://localhost:8000/api/v1/failures" \
  -H "Content-Type: application/json" \
  -d '{
    "page_path": "/checkout/payment",
    "browser_matrix": {
      "chrome": "<90",
      "firefox": "<88",
      "ie": "11"
    },
    "failure_cases": [
      {
        "case_id": "PAY-001",
        "description": "支付按钮无法点击",
        "browser": "ie",
        "browser_version": "11",
        "screenshot_url": null
      }
    ],
    "reporter": "qa001"
  }'
```

### 查询失败样例列表

```bash
curl "http://localhost:8000/api/v1/failures?page_path=/checkout"
```

### 申请豁免

```bash
curl -X POST "http://localhost:8000/api/v1/exemptions" \
  -H "Content-Type: application/json" \
  -d '{
    "failure_id": 1,
    "exemption_reason": "IE11用户占比低于0.1%，技术改造成本过高",
    "exempt_browsers": ["ie"],
    "expire_days": 30,
    "applicant": "dev001"
  }'
```

### 审核豁免

```bash
curl -X PUT "http://localhost:8000/api/v1/exemptions/1/review" \
  -H "Content-Type: application/json" \
  -d '{
    "review_result": "approved",
    "review_comment": "同意豁免，请注意30天后跟进",
    "reviewer": "leader001"
  }'
```

### 人工修正结论

```bash
curl -X PUT "http://localhost:8000/api/v1/failures/1/conclusion" \
  -H "Content-Type: application/json" \
  -d '{
    "conclusion": "fixed",
    "conclusion_note": "已通过polyfill修复兼容问题",
    "operator": "dev002"
  }'
```

### 撤回豁免

```bash
curl -X DELETE "http://localhost:8000/api/v1/exemptions/1?operator=dev001"
```

### 导出兼容结论

```bash
curl -o report.xlsx "http://localhost:8000/api/v1/export?start_date=2024-01-01&end_date=2024-12-31"
```

## 冲突路径示例

### 豁免到期后尝试使用

```bash
# 先创建一个已过期的豁免（通过seed_data.py生成）
curl "http://localhost:8000/api/v1/failures/1"
# 响应中会显示 exemption_status: "expired"
```

### 重复申请豁免

```bash
# 对同一失败样例重复申请
curl -X POST "http://localhost:8000/api/v1/exemptions" \
  -H "Content-Type: application/json" \
  -d '{
    "failure_id": 1,
    "exemption_reason": "重复申请",
    "exempt_browsers": ["ie"],
    "expire_days": 30,
    "applicant": "dev001"
  }'
# 响应: 409 Conflict - "该失败样例已有生效中的豁免"
```

### 审核已处理的豁免

```bash
# 对已通过的豁免再次审核
curl -X PUT "http://localhost:8000/api/v1/exemptions/1/review" \
  -H "Content-Type: application/json" \
  -d '{
    "review_result": "rejected",
    "review_comment": "驳回",
    "reviewer": "leader002"
  }'
# 响应: 409 Conflict - "豁免申请已处理，无法重复审核"
```

## 运行测试

```bash
pytest tests/ -v
```

## 数据模型

### FailureCase (失败样例)
- id: 主键
- page_path: 页面路径
- browser_matrix: 浏览器兼容矩阵 (JSON)
- failure_cases: 失败用例列表 (JSON)
- reporter: 报告人
- conclusion: 兼容结论 (pending/fixed/exempted/closed)
- conclusion_note: 结论说明
- created_at: 创建时间
- updated_at: 更新时间

### Exemption (豁免申请)
- id: 主键
- failure_id: 关联失败样例ID
- exemption_reason: 豁免原因
- exempt_browsers: 豁免浏览器列表 (JSON)
- expire_at: 到期时间
- applicant: 申请人
- status: 状态 (pending/approved/rejected/withdrawn)
- review_result: 审核结果
- review_comment: 审核意见
- reviewer: 审核人
- reviewed_at: 审核时间
- created_at: 创建时间

### AuditLog (审计日志)
- id: 主键
- operation_type: 操作类型
- resource_type: 资源类型
- resource_id: 资源ID
- operator: 操作人
- original_input: 原始输入 (JSON)
- process_result: 处理结果 (JSON)
- created_at: 创建时间
