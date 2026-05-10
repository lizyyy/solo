# 客服补发跟进系统

一个完整的客服补发单状态跟踪系统，支持状态流转、失败重试、历史版本、操作日志、导入导出、批量操作和权限控制。

## 🚀 一键启动（最简单方式）

**默认使用 SQLite，无需安装任何数据库！**

```bash
# 1. 安装依赖
pip3 install -r requirements.txt

# 2. 初始化种子数据（创建用户和示例数据）
python3 seeds.py

# 3. 启动服务
uvicorn app.main:app --reload
```

访问 **http://localhost:8000/docs** 即可体验完整功能。

---

## 🔑 默认账号

运行 `python3 seeds.py` 后可用：

| 用户名 | 密码 | 角色 | 权限 |
|--------|------|------|------|
| admin | admin123 | 管理员 | 全部权限（包括用户管理） |
| manager | manager123 | 经理 | 除用户管理外全部 |
| cs01 | cs123456 | 客服 | 补发单CRUD |
| cs02 | cs123456 | 客服 | 补发单CRUD |
| operator01 | op123456 | 运营 | 查看和状态变更 |

> ⚠️ **安全提示**：系统没有公开注册功能，所有用户必须由管理员通过 `/api/users` 端点创建。

---

## 🔐 角色权限矩阵

| 操作 | admin | manager | cs | operator |
|------|:-----:|:-------:|:--:|:--------:|
| 登录 | ✅ | ✅ | ✅ | ✅ |
| 创建补发单 | ✅ | ✅ | ✅ | ❌ |
| 查看补发单 | ✅ | ✅ | ✅ | ✅ |
| 修改补发单 | ✅ | ✅ | ✅ | ❌ |
| 状态变更 | ✅ | ✅ | ✅ | ✅ |
| 批量操作 | ✅ | ✅ | ❌ | ❌ |
| 导入导出 | ✅ | ✅ | ❌ | ❌ |
| 查看日志 | ✅ | ✅ | ❌ | ❌ |
| 用户管理 | ✅ | ❌ | ❌ | ❌ |

---

## 其他启动方式

### 方式一：使用启动脚本

```bash
# SQLite 模式（推荐，最简单）
bash start.sh dev

# Docker 模式（需要 Docker）
bash start.sh docker
```

### 方式二：Docker Compose（生产环境推荐）

```bash
# 启动 PostgreSQL 和 pgAdmin
docker-compose up -d

# 修改 .env，注释掉 SQLite，启用 PostgreSQL
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reissue_tracker

# 初始化和启动
pip3 install -r requirements.txt
python3 seeds.py
uvicorn app.main:app --reload
```

访问：
- API 文档: http://localhost:8000/docs
- pgAdmin: http://localhost:5050 (admin@example.com / admin123)

---

## 主要 API 端点

### 认证
```
POST /api/auth/login      登录（获取 JWT）
GET  /api/auth/me         获取当前用户信息
```

### 用户管理（管理员专属）
```
GET    /api/users         用户列表
POST   /api/users         创建用户
GET    /api/users/{id}    用户详情
PUT    /api/users/{id}    更新用户
DELETE /api/users/{id}    禁用用户
```

### 补发单管理
```
GET    /api/reissues                 列表（支持分页/搜索/筛选）
POST   /api/reissues                 创建
GET    /api/reissues/{id}            详情
PUT    /api/reissues/{id}            更新
POST   /api/reissues/{id}/status     状态变更
GET    /api/reissues/{id}/status-history  状态流转历史
GET    /api/reissues/{id}/history    版本历史（完整快照）
DELETE /api/reissues/{id}            删除
```

### 批量操作（经理以上）
```
POST /api/batch/assign  批量分配
POST /api/batch/cancel  批量取消
POST /api/batch/retry   批量重试
```

### 导入导出（经理以上）
```
GET  /api/export/excel  导出 Excel
GET  /api/export/csv    导出 CSV
POST /api/import        导入 Excel
```

### 日志和统计
```
GET  /api/logs              操作日志（管理员）
GET  /api/failed-tasks      失败任务列表（管理员）
POST /api/failed-tasks/{id}/retry  重试失败任务
GET  /api/statistics        统计数据
```

---

## 状态流转

```
PENDING（待处理）
    ↓
PROCESSING（处理中）
    ↓
SHIPPED（已发货）
    ↓
DELIVERED（已送达）
    ↓
COMPLETED（已完成）

FAILED（失败）→ 可重试或取消
CANCELLED（已取消）→ 终止
```

---

## 项目结构

```
.
├── app/
│   ├── main.py              FastAPI 入口
│   ├── config.py            配置管理
│   ├── database.py          数据库连接
│   ├── models.py            SQLAlchemy 模型
│   ├── schemas.py           Pydantic 模型
│   ├── security.py          JWT 和密码哈希
│   ├── services.py          业务逻辑
│   └── routers/
│       ├── auth.py          认证接口
│       ├── users.py         用户管理
│       ├── reissues.py      补发单管理
│       ├── batch.py         批量操作
│       ├── export_import.py 导入导出
│       └── logs.py          日志和错误
├── tests/                   测试用例
├── seeds.py                 种子数据
├── docker-compose.yml       Docker Compose
├── requirements.txt         依赖
└── .env                     环境配置
```

---

## 运行测试

```bash
# 运行所有测试
python3 -m pytest tests/ -v

# 运行特定测试文件
python3 -m pytest tests/test_auth.py -v

# 生成覆盖率报告
python3 -m pytest tests/ --cov=app
```

---

## 技术栈

- **FastAPI**: 现代异步 Web 框架
- **PostgreSQL**: 关系型数据库
- **SQLite**: 开发/测试数据库
- **SQLAlchemy**: ORM
- **Pydantic**: 数据验证
- **JWT**: 认证
- **pytest**: 测试框架
- **openpyxl**: Excel 导入导出

---

## 故障排查

### 数据库连接失败
```
# 检查 PostgreSQL 是否运行
docker-compose ps

# 查看日志
docker-compose logs db
```

### 端口被占用
```
# 修改 docker-compose.yml 中的端口映射
```

### 测试失败
```bash
# 测试使用 SQLite 内存数据库，不需要 PostgreSQL
python3 -m pytest tests/
```

---

## 开发命令

```bash
# 代码格式化
black app/ tests/

# 类型检查
mypy app/

# 运行服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
