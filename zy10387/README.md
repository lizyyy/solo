# API 异常样本库

标准化的 API 异常样本管理系统，支持脱敏、分类、复现、关联修复和历史追溯。

## 核心特性

### 数据对象
- **异常请求**: HTTP方法、API端点、原始请求/响应载荷
- **脱敏载荷**: 自动识别并脱敏敏感字段（密码、Token等）
- **错误分类**: 10种标准错误分类（认证、授权、校验、限流等）
- **复现步骤**: 记录复现步骤和复现结果
- **关联修复**: 关联 Issue ID 和修复描述
- **保留期限**: 支持设置样本保留天数，到期自动标记

### 核心规则
1. **样本脱敏**: 自动识别并脱敏敏感字段
2. **Hash去重**: 相同特征的异常自动去重，避免脏数据
3. **状态机管理**: 严格的状态流转校验
4. **历史追溯**: 完整记录每个状态变更和操作人
5. **到期清理**: 自动标记过期样本

### 状态流转
```
CREATED → VALIDATED → CLASSIFIED → REPRODUCING → REPRODUCED → FIXING → FIXED → ARCHIVED
                                                                             ↓
                                                                          EXPIRED (自动)
```

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── database.py      # 数据库配置
│   ├── models.py        # 数据模型和枚举定义
│   ├── schemas.py       # Pydantic 请求/响应模型
│   ├── services.py      # 业务逻辑（脱敏、Hash、状态管理）
│   └── api.py           # API 路由
├── examples/
│   ├── success_flow.py  # 成功流示例脚本
│   └── problem_flow.py  # 问题流示例脚本
├── main.py              # 应用入口
├── requirements.txt     # 依赖列表
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动。

### 3. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/samples` | 创建异常样本 |
| GET | `/api/samples` | 查询样本列表 |
| GET | `/api/samples/{id}` | 获取样本详情 |
| POST | `/api/samples/{id}/validate` | 校验样本 |
| POST | `/api/samples/{id}/classify` | 分类样本 |
| POST | `/api/samples/{id}/reproduce/start` | 开始复现 |
| POST | `/api/samples/{id}/reproduce` | 提交复现结果 |
| POST | `/api/samples/{id}/fix/start` | 开始修复 |
| POST | `/api/samples/{id}/fix` | 提交修复结果 |
| POST | `/api/samples/{id}/archive` | 归档样本 |
| POST | `/api/samples/cleanup` | 清理过期样本 |

## 运行示例

### 安装 requests 库

```bash
pip install requests
```

### 运行成功流示例（完整生命周期）

```bash
python examples/success_flow.py
```

展示: 创建 → 校验 → 分类 → 复现 → 修复 → 归档 → 历史查询

### 运行问题流示例（边界情况）

```bash
python examples/problem_flow.py
```

展示: 重复提交去重、状态流转错误、复现失败无法修复、查询不存在样本等

## 数据持久化

使用 SQLite 数据库，数据文件 `api_exception_samples.db` 自动创建在项目根目录。

重启服务后，所有状态、历史记录、操作人信息都会保留。

## 错误分类枚举

| 分类 | 说明 |
|------|------|
| `authentication` | 认证错误 |
| `authorization` | 授权错误 |
| `validation` | 参数校验错误 |
| `rate_limit` | 限流错误 |
| `timeout` | 超时错误 |
| `internal_error` | 内部服务错误 |
| `dependency_failure` | 依赖服务失败 |
| `data_integrity` | 数据完整性问题 |
| `not_found` | 资源不存在 |
| `other` | 其他错误 |
