# OpenAPI变更裁决API

用于接口评审时裁决契约变更是否为破坏性变更的后端服务。

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI主应用，路由定义
│   ├── models.py        # SQLAlchemy数据模型
│   ├── schemas.py       # Pydantic请求/响应模型
│   ├── crud.py          # 数据库操作
│   ├── services.py      # 业务逻辑（差异分析、风险评估）
│   └── database.py      # 数据库连接配置
├── tests/
│   └── test_api.py      # 测试用例
├── quick_check.py       # 快速自检脚本
├── requirements.txt     # 依赖包
└── README.md
```

## 数据模型

核心字段：
- `api_path`: 接口路径
- `old_contract`: 旧契约
- `new_contract`: 新契约
- `caller`: 调用方标识
- `risk_level`: 风险等级（safe/low/medium/high/critical）
- `change_category`: 变更分类（documentation_only/compatible/breaking/unknown）
- `status`: 裁决状态（created/analyzing/awaiting_confirmation/confirmed/appealed/rejected/approved/deferred/completed）
- `raw_input`: 原始输入（失败路径保留）
- `processing_basis`: 处理依据
- `final_conclusion`: 最终结论
- `manual_override`: 人工修正记录

## API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/changes/ | 创建契约变更并自动分析 |
| GET | /api/v1/changes/{id} | 查询单条变更记录 |
| GET | /api/v1/changes/ | 分页查询变更列表（支持多条件过滤） |
| PATCH | /api/v1/changes/{id}/status | 更新裁决状态 |
| PATCH | /api/v1/changes/{id}/correct | 人工修正并重新计算 |
| POST | /api/v1/changes/{id}/defer | 延期裁决 |
| POST | /api/v1/changes/{id}/report | 生成裁决报告 |
| GET | /api/v1/changes/{id}/reports | 查询变更的所有报告 |
| GET | /api/v1/export/ | 导出变更数据 |
| GET | /health | 健康检查 |

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行自检脚本

```bash
python quick_check.py
```

### 3. 启动服务

```bash
python -m uvicorn app.main:app --reload
```

### 4. 访问API文档

```
http://127.0.0.1:8000/docs
```

## 运行测试

```bash
pytest tests/test_api.py -v
```

测试覆盖场景：
- ✓ 正常流程（文档变更、兼容变更、破坏性变更）
- ✓ 脏数据处理（缺失字段、空契约）
- ✓ 重复请求处理
- ✓ 人工修正后重新计算
- ✓ 状态流转
- ✓ 过滤查询与分页
- ✓ 报告生成与导出
- ✓ 异常处理

## 核心规则

1. **契约差异分析**:
   - 识别文档字段变更（description, summary, title等）
   - 识别兼容变更（新增可选字段）
   - 识别破坏性变更（字段类型改变、必填字段增加、字段删除）

2. **风险分级**:
   - `safe`: 仅文档变更或兼容变更少
   - `low`: 少量兼容变更
   - `medium`: 1项破坏性变更
   - `high`: 2-4项破坏性变更
   - `critical`: 5项以上破坏性变更或有字段删除

3. **状态流转**:
   - `created` → `analyzing` → `awaiting_confirmation` → `confirmed` → `completed`
   - 支持 `appealed`（申诉）、`deferred`（延期）等状态

4. **失败路径**:
   - 保留原始输入（`raw_input`）
   - 记录处理依据（`processing_basis`）
   - 记录最终结论（`final_conclusion`）
   - 记录错误信息（`error_message`）
