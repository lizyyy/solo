# 数据驻留审批区域规则后端 API

基于 FastAPI + SQLite 实现的数据驻留合规审批系统，用于跨区域客户上线前的数据驻留要求确认。

## 核心功能

### 1. 区域规则校验
- 按区域和数据类型校验合规要求
- 风险等级评估（LOW/MEDIUM/HIGH）
- 跨境传输许可检查

### 2. 审批流程
- 审批提交与状态管理
- 幂等性支持（防止重复提交）
- 状态流转控制（pending → needs_review → approved/rejected/blocked）

### 3. 阻塞归因
- 标准化阻塞分类
- 详细阻塞原因记录
- 可追溯的审批历史

### 4. 报告导出
- 结构化审批报告生成
- TXT 格式导出下载
- 完整审计信息

## 错误响应分类

调用方可通过 `error_code` 字段区分错误类型：

| 错误码 | 说明 | HTTP 状态码 |
|--------|------|-------------|
| `missing_field` | 缺少必填字段 | 400 |
| `invalid_status` | 状态不允许操作 | 400 |
| `needs_manual_review` | 需要人工复核 | 400 |
| `already_processed` | 已处理完毕 | 409 |
| `tenant_not_found` | 租户不存在 | 404 |
| `region_rule_not_found` | 区域规则不存在 | 404 |

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI 路由入口
│   ├── models.py        # SQLAlchemy 数据模型
│   ├── schemas.py       # Pydantic 请求/响应模型
│   ├── services.py      # 核心业务逻辑
│   └── database.py      # 数据库连接配置
├── requirements.txt     # 依赖列表
├── self_test.py         # 自检脚本
└── data_residency.db    # SQLite 数据库（运行后自动生成）
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- API 文档: http://localhost:8000/docs
- Redoc 文档: http://localhost:8000/redoc

### 3. 运行自检脚本

```bash
python self_test.py
```

自检脚本将自动完成：
- ✓ 租户数据导入
- ✓ 区域规则配置
- ✓ 规则校验测试
- ✓ 审批提交与幂等性验证
- ✓ 筛选查询功能
- ✓ 审批推进与阻塞归因
- ✓ 报告生成与导出
- ✓ 元数据接口验证

## 主要 API 接口

### 租户管理
- `POST /api/tenants` - 创建租户
- `GET /api/tenants/{tenant_id}` - 查询租户

### 区域规则
- `POST /api/region-rules` - 创建区域规则
- `GET /api/region-rules/{region_code}` - 查询区域规则
- `GET /api/validate-region/{region_code}/{data_type}` - 校验区域规则

### 审批流程
- `POST /api/approvals` - 提交审批请求
- `GET /api/approvals/{request_id}` - 查询审批详情
- `PUT /api/approvals/{request_id}/review` - 审批处理
- `POST /api/approvals/filter` - 筛选审批列表

### 报告管理
- `POST /api/reports` - 生成审批报告
- `GET /api/reports/{report_id}` - 获取报告详情
- `GET /api/reports/{report_id}/export` - 导出报告文件

### 元数据
- `GET /api/block-categories` - 获取阻塞原因分类
- `GET /api/statuses` - 获取审批状态列表

## 数据模型说明

### 审批状态 (ApprovalStatus)
- `pending` - 待审批
- `approved` - 已通过
- `rejected` - 已拒绝
- `blocked` - 已阻塞
- `needs_review` - 需要人工复核

### 阻塞分类 (BlockReasonCategory)
- `data_classification` - 数据分类问题
- `region_compliance` - 区域合规问题
- `cross_border` - 跨境传输问题
- `customer_policy` - 客户策略问题
- `technical_limitation` - 技术限制问题

## 使用示例

### 1. 提交审批请求

```python
import requests

response = requests.post("http://localhost:8000/api/approvals", json={
    "request_id": "REQ2024001",
    "tenant_id": "TENANT001",
    "target_region": "CN-EAST",
    "data_type": "personal_data",
    "data_volume_gb": 50,
    "idempotency_key": "unique-key-001"
})
print(response.json())
```

### 2. 审批处理（阻塞）

```python
response = requests.put("http://localhost:8000/api/approvals/REQ2024001/review", json={
    "status": "blocked",
    "approver": "审批人姓名",
    "approval_comment": "需要进一步审查",
    "block_reason": "该数据类型涉及敏感个人信息",
    "block_category": "data_classification"
})
```

### 3. 生成并导出报告

```python
# 生成报告
report_resp = requests.post("http://localhost:8000/api/reports", json={
    "approval_id": 1,
    "generated_by": "系统管理员"
})
report_id = report_resp.json()['report_id']

# 导出报告
export_resp = requests.get(f"http://localhost:8000/api/reports/{report_id}/export")
with open(f"{report_id}.txt", "w") as f:
    f.write(export_resp.text)
```

## 技术栈

- **FastAPI**: 现代、高性能的 Web 框架
- **SQLAlchemy**: Python ORM 工具
- **SQLite**: 轻量级关系型数据库
- **Pydantic**: 数据验证库
- **Uvicorn**: ASGI 服务器
