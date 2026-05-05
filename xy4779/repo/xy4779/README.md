# FastAPI 路由体检服务

一个用于检测 FastAPI 路由冲突的本地服务，能够检测动态参数截获、重复路径、HTTP 方法冲突和不可达路由等问题。

## 功能特性

- **动态参数截获检测**: 检测静态路径是否被动态路径提前截获（如 `/users/me` 被 `/users/{user_id}` 截获）
- **重复路径检测**: 检测相同路径和方法的重复定义
- **方法冲突检测**: 检测同一路径相同方法的多次定义
- **不可达路由检测**: 检测永远不会被匹配的路由
- **修复顺序建议**: 按优先级提供修复建议
- **多格式导出**: 支持 JSON 和 Markdown 格式导出报告
- **SQLite 持久化**: 所有数据保存在本地 SQLite 数据库

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
- ReDoc: http://localhost:8000/redoc

### 3. 加载 Seed 数据（可选）

```bash
python seed.py
```

这会创建一些示例服务，包含各种路由冲突问题，方便测试。

## API 使用示例（curl）

### 创建服务并提交路由清单

```bash
curl -X POST http://localhost:8000/services \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user-gateway-service",
    "routes": [
      {"path": "/users/{user_id}", "method": "GET", "order_index": 0},
      {"path": "/users/me", "method": "GET", "order_index": 1},
      {"path": "/reports/{date}", "method": "GET", "order_index": 2},
      {"path": "/reports/latest", "method": "GET", "order_index": 3}
    ]
  }'
```

### 列出所有服务

```bash
curl http://localhost:8000/services
```

### 获取单个服务详情

```bash
curl http://localhost:8000/services/1
```

### 运行路由体检

```bash
curl -X POST http://localhost:8000/services/1/health-check
```

### 获取体检记录列表

```bash
curl http://localhost:8000/services/1/health-checks
```

### 获取单次体检详情

```bash
curl http://localhost:8000/health-checks/1
```

### 获取体检摘要

```bash
curl http://localhost:8000/health-checks/1/summary
```

### 获取修复顺序建议

```bash
curl http://localhost:8000/health-checks/1/fix-suggestions
```

### 导出 JSON 格式报告

```bash
curl http://localhost:8000/health-checks/1/export?format=json
```

### 导出 Markdown 格式报告

```bash
curl http://localhost:8000/health-checks/1/export?format=markdown
```

### 删除服务

```bash
curl -X DELETE http://localhost:8000/services/1
```

## 完整使用流程示例

```bash
# 1. 创建一个有问题的服务
curl -X POST http://localhost:8000/services \
  -H "Content-Type: application/json" \
  -d '{
    "name": "problematic-service",
    "routes": [
      {"path": "/users/{user_id}", "method": "GET", "order_index": 0},
      {"path": "/users/me", "method": "GET", "order_index": 1},
      {"path": "/users/{user_id}", "method": "GET", "order_index": 2},
      {"path": "/reports/{date}", "method": "GET", "order_index": 3},
      {"path": "/reports/latest", "method": "GET", "order_index": 4}
    ]
  }'

# 2. 运行体检
curl -X POST http://localhost:8000/services/1/health-check

# 3. 查看问题摘要
curl http://localhost:8000/health-checks/1/summary

# 4. 查看修复建议
curl http://localhost:8000/health-checks/1/fix-suggestions

# 5. 导出 Markdown 报告
curl http://localhost:8000/health-checks/1/export?format=markdown
```

## 检测的问题类型

| 问题类型 | 严重程度 | 说明 |
|---------|---------|------|
| `dynamic_param_capture` | critical | 静态路径被动态路径提前截获 |
| `unreachable` | critical | 路由永远不会被匹配 |
| `duplicate_path` | high | 相同路径和方法重复定义 |
| `method_conflict` | high | 同一路径相同方法多次定义 |

## 修复建议优先级

1. **Critical (严重)**:
   - 动态参数截获问题
   - 不可达路由问题

2. **High (高)**:
   - 重复路径问题
   - 方法冲突问题

## 运行测试

```bash
pytest -v
```

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py           # FastAPI 主应用
│   ├── database.py       # 数据库模型和配置
│   ├── schemas.py      # Pydantic 模型
│   ├── analyzer.py     # 路由分析器核心逻辑
│   └── exporter.py   # JSON/Markdown 导出
├── tests/
│   ├── __init__.py
│   ├── test_routes.py    # API 路由测试
│   └── test_analyzer.py   # 分析器单元测试
├── seed.py               # 种子数据
├── requirements.txt
└── README.md
```

## 常见问题场景

### 场景 1: 静态路径被动态参数截获

**问题代码:**
```python
# ❌ 错误的顺序
@app.get("/users/{user_id}")
def get_user(user_id: int):
    ...

@app.get("/users/me")  # 永远不会被匹配！
def get_current_user():
    ...
```

**修复方案:**
```python
# ✅ 正确的顺序
@app.get("/users/me")
def get_current_user():
    ...

@app.get("/users/{user_id}")
def get_user(user_id: int):
    ...
```

### 场景 2: 重复路径定义

**问题代码:**
```python
@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/health")  # 重复定义！
def another_health_check():
    return {"status": "healthy"}
```

**修复方案:**
移除其中一个重复的路由定义。

### 场景 3: 不可达路由

**问题代码:**
```python
@app.get("/{catch_all}")  # 捕获所有路径
def catch_all(path: str):
    ...

@app.get("/specific")   # 永远不会被匹配！
def specific():
    ...
```

**修复方案:**
将更具体的路由放在前面，或者修改通配路由的路径模式。

## License

MIT License
