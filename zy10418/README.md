# 合成旅程注册 API

本地可运行的端到端巡检旅程注册系统，用于将散落在各个脚本仓库中的巡检旅程集中管理。

## 技术栈

- **FastAPI**: REST API 框架
- **SQLAlchemy**: ORM 和数据持久化
- **SQLite**: 本地数据库
- **Pydantic**: 数据验证

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动 API 服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动。

### 3. 运行自检程序（另开终端）

```bash
python self_check.py
```

这将自动执行所有功能测试，包括：
- 健康检查
- 创建示例旅程
- 查询旅程列表
- 获取旅程详情
- 添加失败样本
- 人工修正流程
- 导出旅程数据
- 频率冲突检测
- 状态推进

### 4. 运行单元测试

```bash
pytest test_journey_api.py -v
```

### 5. 访问 API 文档

启动服务后，在浏览器中访问：
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## API 接口说明

### 旅程管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/journeys` | 创建新旅程 |
| GET | `/api/journeys` | 查询旅程列表（支持按状态、频率过滤） |
| GET | `/api/journeys/{id}` | 获取单个旅程详情 |
| PUT | `/api/journeys/{id}/status` | 更新旅程状态 |
| DELETE | `/api/journeys/{id}` | 归档（软删除）旅程 |

### 核心功能

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/journeys/{id}/validate` | 重新验证旅程 |
| POST | `/api/journeys/{id}/failure-sample` | 添加失败样本 |
| POST | `/api/journeys/{id}/manual-correction` | 应用人工修正 |
| GET | `/api/journeys/{id}/export` | 导出旅程数据 |

### 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |

## 数据模型

### 旅程 (Journey)

```json
{
  "name": "用户登录流程巡检",
  "description": "端到端测试用户从登录到查看 dashboard",
  "steps": [...],
  "dependent_services": [...],
  "run_frequency": "hourly"
}
```

### 步骤 (Step)

```json
{
  "step_id": "step_001",
  "name": "访问登录页",
  "action": "navigate_to_url",
  "params": {"url": "https://example.com/login"},
  "expected_result": "页面加载成功",
  "timeout": 30
}
```

### 依赖服务 (Dependent Service)

```json
{
  "service_name": "auth_service",
  "service_type": "authentication",
  "endpoint": "https://auth.example.com",
  "health_check": "/health"
}
```

### 失败样本 (Failure Sample)

```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "error_type": "timeout_error",
  "error_message": "页面加载超时",
  "context": {"url": "https://example.com"},
  "step_id": "step_001"
}
```

## 核心功能说明

### 1. 步骤校验

创建旅程时自动验证：
- 步骤 ID 唯一性
- 必填字段（名称、操作）完整性
- 生成详细的校验报告

### 2. 依赖映射

自动建立：
- 服务 → 步骤 的映射关系
- 步骤 → 服务 的映射关系
- 识别未映射的服务和步骤

### 3. 频率冲突检测

检测相同运行频率的旅程，避免调度冲突。

### 4. 失败样本归档

- 支持存储多个失败样本
- 保留错误上下文信息
- 自动限制最大样本数（50个）

### 5. 人工修正流程

- 记录所有修正历史
- 支持修正：步骤、依赖服务、运行频率、描述
- 修正后自动重新校验
- 保留原始输入和处理结论

### 6. 注册报告

每次创建/更新旅程时自动生成详细报告，包含：
- 验证摘要
- 依赖分析
- 频率冲突检测
- 改进建议

## 旅程状态

- `draft`: 草稿
- `validating`: 验证中
- `valid`: 已验证（有效）
- `invalid`: 无效（需修正）
- `active`: 运行中
- `suspended`: 已暂停
- `archived`: 已归档

## 使用示例

### 创建旅程

```bash
curl -X POST "http://localhost:8000/api/journeys" \
  -H "Content-Type: application/json" \
  -d @- << EOF
{
  "name": "我的测试旅程",
  "description": "这是一个示例",
  "steps": [
    {
      "step_id": "step_001",
      "name": "访问首页",
      "action": "navigate",
      "timeout": 30
    }
  ],
  "run_frequency": "daily"
}
EOF
```

### 应用人工修正

```python
import requests

correction = {
    "correction_type": "step_fix",
    "field": "steps",
    "old_value": original_steps,
    "new_value": corrected_steps,
    "reason": "修正了空的步骤名称",
    "corrected_by": "运维工程师"
}

response = requests.post(
    "http://localhost:8000/api/journeys/1/manual-correction",
    json=correction
)
```

## 项目结构

```
.
├── main.py              # 主程序（API + 数据模型 + 业务逻辑）
├── test_journey_api.py  # 单元测试
├── self_check.py        # 自检脚本
├── sample_data.py       # 示例数据
├── requirements.txt     # 依赖列表
└── README.md           # 本文档
```

首次运行后会自动生成：
- `journey_registry.db`: SQLite 数据库文件
- `journey_export_{id}.json`: 导出的旅程数据文件

## 异常处理

所有 API 接口都包含完整的异常处理：
- 参数验证错误（400）
- 资源不存在（404）
- 重复创建（409）
- 服务器内部错误（500）
- 异常响应中保留原始输入和详细错误信息

## 运维建议

1. 定期导出旅程数据进行备份
2. 监控失败样本，及时发现系统问题
3. 利用注册报告持续改进旅程质量
4. 人工修正后重新验证并更新状态
5. 注意运行频率的合理分配，避免冲突
