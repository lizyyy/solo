# 分支保护例外API (Branch Protection Exception API)

用于管理分支保护例外申请的后端服务，支持完整的审批流程、窗口管理、恢复校验和审计追踪。

## 技术栈

- **Python 3.8+**
- **FastAPI** - Web框架
- **SQLAlchemy** - ORM
- **SQLite** - 本地数据库

## 核心功能

### 数据模型
- **Repository (仓库)** - 代码仓库信息
- **BranchRule (分支规则)** - 分支保护配置
- **ExceptionRequest (例外申请)** - 放开保护申请
- **Approval (审批)** - 审批记录
- **ReleaseWindow (放开窗口)** - 保护放开时间段
- **RestoreAction (恢复动作)** - 保护恢复记录
- **AuditRecord (审计记录)** - 操作审计

### 核心规则
- ✅ **幂等性保证** - 相同幂等键的请求只处理一次
- ✅ **状态机保护** - 严格的状态流转校验
- ✅ **窗口到期检测** - 自动检测过期窗口
- ✅ **重复恢复校验** - 防止重复恢复操作
- ✅ **异常追踪** - 所有异常路径保留原始输入和结论
- ✅ **审计导出** - 完整的审计报告导出

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload
```

服务将在 `http://localhost:8000` 启动

### 3. 访问API文档

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### 4. 运行测试脚本

```bash
python test_api.py
```

测试脚本会自动完成:
- 创建样例数据（仓库、分支规则）
- 创建例外申请
- 验证幂等性
- 推进状态流程（审批、启动窗口、拒绝）
- 测试恢复和重复恢复
- 测试人工修正
- 查看审计记录
- 导出审计报告

## API接口

### 仓库管理
- `POST /repositories/` - 创建仓库
- `GET /repositories/` - 查询仓库列表
- `GET /repositories/{id}` - 查询单个仓库

### 分支规则
- `POST /branch-rules/` - 创建分支规则
- `GET /repositories/{id}/branch-rules/` - 查询仓库的分支规则

### 例外申请
- `POST /exception-requests/` - 创建申请（幂等）
- `GET /exception-requests/` - 查询申请列表
- `GET /exception-requests/{id}` - 查询单个申请详情

### 状态推进
- `POST /exception-requests/{id}/approve` - 审批申请
- `POST /exception-requests/{id}/reject` - 拒绝申请
- `POST /exception-requests/{id}/start-window` - 启动放开窗口
- `POST /exception-requests/{id}/restore` - 恢复分支保护

### 异常处理
- `POST /exception-requests/{id}/manual-correction` - 人工修正状态

### 审计导出
- `GET /audit-records/` - 查询审计记录
- `POST /export/audit-report` - 导出审计报告

## 状态流转

```
pending ──► approved ──► active ──► restored
   │          │           │
   ▼          ▼           ▼
rejected  cancelled    expired
```

## 验收要点

### 1. 正常流程
- 创建申请 → 审批 → 启动窗口 → 恢复保护
- 每个步骤状态正确更新
- 审计记录完整

### 2. 幂等性验证
- 使用相同的 `request_idempotency_key` 重复提交
- 确认不会创建新申请
- 返回已存在的申请
- 审计记录中标记重复请求

### 3. 状态保护
- 已审批的申请无法重复审批
- 已恢复的申请无法再次恢复
- 非pending状态无法被拒绝
- 异常操作在审计记录中标记为abnormal

### 4. 报告导出
- 导出的报告包含所有申请
- 异常事件有明确标记
- 包含原始输入和处理结论

## 审计报告说明

导出的JSON报告包含：
- 申请基本信息（申请人、原因、时长等）
- 审批信息（审批人、时间）
- 窗口信息（开始、结束时间）
- 恢复信息（恢复人、方式、时间）
- 异常事件列表（所有非normal的操作）
- 原始请求输入
- 详细处理说明

## 项目结构

```
.
├── main.py              # FastAPI应用主入口
├── models.py            # SQLAlchemy数据模型
├── schemas.py           # Pydantic请求/响应模式
├── crud.py              # 业务逻辑和数据操作
├── database.py          # 数据库配置
├── test_api.py          # 完整测试脚本
├── requirements.txt     # Python依赖
└── branch_protection.db # SQLite数据库（运行后生成）
```
