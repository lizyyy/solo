# 园区访客通行权限追责台账 API

用于管理园区访客通行权限的追责台账系统，支持从访客预约表、闸机记录、临时车牌截图等数据源建账，完整工作流追踪和审计导出功能。

## 功能特性

### 核心功能
- ✅ **多源数据导入**: 支持访客预约表、闸机记录、临时车牌截图、历史压缩包
- ✅ **原始证据保留**: 保存来源文件、原始行号、解析后标准值
- ✅ **人工改判不覆盖**: 改判记录留存，原始数据不被覆盖

### 工作流引擎
- ✅ **草稿 (DRAFT)**: 初始状态，可编辑
- ✅ **提交 (SUBMITTED)**: 提交审核
- ✅ **驳回 (REJECTED)**: 审核不通过，可重新编辑
- ✅ **二次确认 (SECOND_CONFIRMATION)**: 安保主管二次审核
- ✅ **确认 (CONFIRMED)**: 最终确认归档
- ✅ **冻结 (FROZEN)**: 导出前冻结，防止篡改

### 审计追踪
- ✅ **版本历史**: 每一步变更都记录完整状态
- ✅ **差异对比**: 任意两个版本间的差异可视化
- ✅ **工作流日志**: 记录所有操作、操作人、变更原因

### 安全与导出
- ✅ **角色权限控制**: 操作员、审核员、安保主管、管理员
- ✅ **敏感字段脱敏**: 手机号、身份证号自动脱敏
- ✅ **安保主管视图**: 状态汇总、跨天问题、人工改判一览
- ✅ **CSV/JSON导出**: 支持完整审计链导出

### 边界处理
- ✅ **重复提交检测**: 按车牌+时间自动去重
- ✅ **撤回再提交**: 支持提交后撤回修改
- ✅ **部分失败处理**: 导入时单条失败不影响整体
- ✅ **异常不吞**: 所有错误详细记录，便于追溯

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库

```bash
python init_db.py
```

默认创建以下用户：
| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 系统管理员 |
| operator | operator123 | 操作员 |
| auditor | auditor123 | 审核员 |
| security | security123 | 安保主管 |

### 3. 生成样例数据（可选）

```bash
python generate_sample_data.py
```

会生成三个Excel样例文件：
- `sample_visitor_appointments.xlsx` - 访客预约表
- `sample_gate_records.xlsx` - 闸机记录
- `sample_temp_plates.xlsx` - 临时车牌截图数据

### 4. 运行完整流程演示

```bash
python test_full_flow.py
```

演示完整业务流程：
1. 数据导入（含部分失败、重复检测）
2. 草稿→提交→撤回→重新提交
3. 驳回→人工改判
4. 二次确认→最终确认
5. 临时补录单追加
6. 导出前冻结
7. 版本对比和审计日志
8. 脱敏导出

### 5. 启动API服务

```bash
python main.py
```

或使用 uvicorn:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

访问 API 文档: http://localhost:8000/docs

## API 接口

### 认证接口
- `POST /token` - 获取访问令牌
- `GET /users/me` - 获取当前用户信息
- `POST /users` - 创建新用户（管理员）

### 台账管理
- `GET /ledger` - 台账列表（支持按状态、跨天、人工改判筛选）
- `POST /ledger` - 新建台账
- `GET /ledger/{id}` - 台账详情
- `PUT /ledger/{id}` - 编辑草稿
- `POST /ledger/{id}/submit` - 提交
- `POST /ledger/{id}/reject` - 驳回
- `POST /ledger/{id}/second-confirm` - 二次确认
- `POST /ledger/{id}/confirm` - 最终确认
- `POST /ledger/{id}/withdraw` - 撤回
- `POST /ledger/{id}/freeze` - 冻结
- `POST /ledger/{id}/unfreeze` - 解冻
- `POST /ledger/{id}/manual-judgment` - 人工改判
- `POST /ledger/import/{source_type}` - 导入Excel数据

### 审计追踪
- `GET /ledger/{id}/workflow-logs` - 工作流日志
- `GET /ledger/{id}/version-history` - 版本历史
- `GET /ledger/{id}/compare-versions` - 版本对比
- `POST /ledger/{id}/supplements` - 添加补录单

### 报表导出
- `GET /reports/statistics` - 统计数据
- `GET /reports/security-supervisor-view` - 安保主管视图
- `POST /reports/export/csv` - CSV导出
- `POST /reports/export/json` - JSON导出（含工作流和版本历史）

## 项目结构

```
.
├── main.py                 # 主应用入口
├── app/
│   ├── __init__.py
│   ├── config.py           # 配置
│   ├── database.py         # 数据库连接
│   ├── models.py           # 数据模型
│   ├── schemas.py          # Pydantic模式
│   ├── api/
│   │   ├── __init__.py
│   │   ├── auth.py         # 认证API
│   │   ├── ledger.py       # 台账API
│   │   └── reports.py      # 报表API
│   └── services/
│       ├── __init__.py
│       ├── auth_service.py     # 认证服务
│       ├── import_service.py   # 导入服务
│       ├── workflow_service.py # 工作流服务
│       └── export_service.py   # 导出服务
├── init_db.py              # 数据库初始化
├── generate_sample_data.py # 样例数据生成
├── test_full_flow.py       # 完整流程演示
├── requirements.txt        # 依赖
└── README.md
```

## 核心数据模型

### VisitorLedger (台账主表)
- 访客基本信息、车牌、访问信息
- 权限开通/收回时间
- 跨天标记、权限判定结果
- 状态、人工改判标记

### OriginalEvidence (原始证据)
- 来源类型、文件名、行号
- 原始数据（JSON）
- 解析后数据（JSON）
- 批次号、验证错误

### VersionHistory (版本历史)
- 版本号、操作类型
- 前后状态快照
- 差异摘要
- 操作人、变更原因

### WorkflowLog (工作流日志)
- 动作、状态流转
- 操作人、角色
- 备注、变更原因

## 权限矩阵

| 操作 | 操作员 | 审核员 | 安保主管 | 管理员 |
|------|--------|--------|----------|--------|
| 创建/编辑草稿 | ✓ | ✓ | ✓ | ✓ |
| 提交/撤回 | ✓ | ✓ | ✓ | ✓ |
| 驳回 | | ✓ | ✓ | ✓ |
| 二次确认 | | | ✓ | ✓ |
| 最终确认 | | | ✓ | ✓ |
| 冻结/解冻 | | ✓ | ✓ | ✓ |
| 人工改判 | | ✓ | ✓ | ✓ |
| 安保主管视图 | | | ✓ | ✓ |
| 用户管理 | | | | ✓ |
