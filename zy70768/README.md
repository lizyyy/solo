# Monorepo Package Boundary Checker API

后端 API 用于检测 Monorepo 中包之间的边界违规情况。

## 技术栈

- **FastAPI**: Web 框架
- **SQLite**: 数据库
- **SQLAlchemy**: ORM
- **Pytest**: 测试框架

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # 应用入口
│   ├── api/                 # API 路由
│   │   ├── packages.py      # 包管理接口
│   │   ├── files.py         # 源文件和导入接口
│   │   ├── rules.py         # 边界规则接口
│   │   └── violations.py    # 违规检测和管理接口
│   ├── core/                # 核心模块
│   │   ├── database.py      # 数据库配置
│   │   └── services.py      # 业务逻辑服务
│   ├── models/              # 数据模型
│   └── schemas/             # Pydantic 模式
├── scripts/
│   ├── __init__.py
│   └── seed_data.py         # 造数脚本
├── tests/
│   ├── __init__.py
│   ├── conftest.py          # pytest 配置
│   └── test_api.py          # API 测试
├── requirements.txt
├── pytest.ini
└── README.md
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

服务启动后访问:
- API 文档: http://localhost:8000/docs
- Redoc: http://localhost:8000/redoc
- 健康检查: http://localhost:8000/health

### 3. 造测试数据

```bash
python scripts/seed_data.py
```

该脚本会创建:
- 5 个包 (pkg-common, pkg-infra, pkg-domain, pkg-app, pkg-api)
- 9 个源文件
- 8 个导入关系（含故意的边界违规）
- 2 条边界规则

## API 接口示例 (curl)

### 包管理

```bash
# 创建包
curl -X POST "http://localhost:8000/packages/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-package",
    "path": "./packages/my-package",
    "description": "我的测试包",
    "layer": "domain",
    "status": "active"
  }'

# 获取所有包
curl "http://localhost:8000/packages/"

# 获取指定包
curl "http://localhost:8000/packages/1"
```

### 源文件和导入

```bash
# 创建源文件
curl -X POST "http://localhost:8000/source-files/" \
  -H "Content-Type: application/json" \
  -d '{
    "package_id": 1,
    "file_path": "./packages/my-package/src/main.py",
    "language": "python"
  }'

# 创建导入关系
curl -X POST "http://localhost:8000/imports/" \
  -H "Content-Type: application/json" \
  -d '{
    "from_file_id": 1,
    "to_file_id": 2,
    "import_statement": "from pkg import something",
    "line_number": 10
  }'
```

### 边界规则

```bash
# 创建边界规则
curl -X POST "http://localhost:8000/rules/" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "forbid_import",
    "from_package_id": 1,
    "to_package_id": 5,
    "description": "禁止 common 包直接依赖 api 包",
    "is_active": true
  }'

# 获取所有规则
curl "http://localhost:8000/rules/"
```

### 违规检测和管理

```bash
# 检测边界违规
curl -X POST "http://localhost:8000/check-boundaries"

# 检测层级违规
curl -X POST "http://localhost:8000/check-layers"

# 获取所有违规
curl "http://localhost:8000/violations/"

# 按状态过滤
curl "http://localhost:8000/violations/?status=open"

# 按类型过滤
curl "http://localhost:8000/violations/?violation_type=cross_boundary"

# 更新违规状态 (推进/撤回/关闭)
curl -X PATCH "http://localhost:8000/violations/1/status" \
  -H "Content-Type: application/json" \
  -d '{
    "to_status": "in_progress",
    "handler": "张三",
    "conclusion": "开始处理此违规，预计明天修复",
    "original_input": "代码评审时发现的跨包依赖问题"
  }'

# 查看状态变更历史
curl "http://localhost:8000/violations/1/history"
```

### 依赖图和循环检测

```bash
# 获取依赖图
curl "http://localhost:8000/dependency-graph"

# 检测循环依赖
curl "http://localhost:8000/circular-dependencies"
```

### 报告和导出

```bash
# 获取违规报告
curl "http://localhost:8000/report"

# 导出 JSON 格式报告
curl "http://localhost:8000/export/json" -o violation_report.json
```

## 核心功能说明

### 1. 依赖图构建

系统会根据包和导入关系自动构建完整的依赖关系图，可用于可视化分析包之间的依赖结构。

### 2. 边界规则校验

支持以下规则类型：
- `forbid_import`: 禁止从 A 包导入到 B 包
- `allow_import`: 允许从 A 包导入到 B 包（白名单模式）

### 3. 循环依赖检测

使用 DFS 算法检测包之间的循环依赖，帮助识别架构问题。

### 4. 分层架构校验

支持基于层级的架构校验（foundation → infrastructure → domain → application → interface），高层不能依赖低层。

### 5. 违规生命周期管理

违规状态流转：
- `open`: 待处理
- `in_progress`: 处理中
- `resolved`: 已解决
- `wontfix`: 不修复
- `closed`: 已关闭

### 6. 异常路径审计

所有状态变更都会记录：
- 处理人
- 处理结论
- 原始输入
- 变更时间

## 运行测试

```bash
# 运行所有测试
pytest

# 运行测试并显示详细输出
pytest -v

# 运行特定测试文件
pytest tests/test_api.py

# 运行特定测试用例
pytest tests/test_api.py::test_boundary_check -v
```

## 数据库表说明

- `packages`: 包信息
- `source_files`: 源文件信息
- `import_paths`: 导入关系
- `boundary_rules`: 边界规则
- `violations`: 违规记录
- `violation_status_history`: 状态变更历史
- `dependency_graph_cache`: 依赖图缓存

## 冲突路径场景示例

典型的边界违规场景：

### 场景 1: 反向依赖
```
pkg-common (foundation 层) → pkg-app (application 层)
- 违反: 底层包不应依赖高层包
```

### 场景 2: 跨层依赖
```
pkg-domain → pkg-api
- 违反: domain 层不应直接依赖 interface 层
```

### 场景 3: 循环依赖
```
pkg-a → pkg-b → pkg-c → pkg-a
- 违反: 检测到循环依赖链
```

通过 API 检测这些违规：
```bash
# 检测边界违规
curl -X POST "http://localhost:8000/check-boundaries"

# 检测分层违规
curl -X POST "http://localhost:8000/check-layers"

# 检测循环依赖
curl "http://localhost:8000/circular-dependencies"
```
