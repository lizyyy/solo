# 数据库迁移审批台

一个用于管理数据库迁移脚本的审批和执行的全栈应用，支持从脚本提交到执行日志的完整追溯链路。

## ✨ 功能特性

### 核心功能
- 📝 **迁移脚本管理**：创建、编辑、删除、查看数据库迁移脚本
- ✅ **审批链路**：支持自定义审批流程，多级审批
- 🔄 **执行与回放**：执行迁移脚本，支持失败回放和人工修正
- 📊 **追溯链**：完整的执行历史时间轴展示
- 📤 **导出功能**：支持导出Excel格式的完整报告

### 数据模型
- **迁移脚本**：基本信息、SQL内容、状态、版本等
- **影响表**：受影响的表、操作类型、预估行数、备份状态
- **执行窗口**：计划执行时间、时区、启用状态
- **回滚脚本**：多版本回滚方案、有效性验证
- **审批链路**：审批步骤、角色、状态、规则
- **执行日志**：执行类型、状态、输出、错误、耗时

### 边界处理
- 🔐 **审批规则校验**：角色不匹配时自动驳回审批
- 🛡️ **回滚脚本验证**：无效脚本阻止执行回滚
- 🔄 **影响表重新计算**：SQL变更后自动更新操作类型

## 🛠️ 技术栈

### 后端
- **FastAPI**: 高性能Python Web框架
- **SQLAlchemy**: ORM框架
- **SQLite**: 默认数据库（支持MySQL/PostgreSQL）
- **Pandas + OpenPyXL**: Excel导出
- **Alembic**: 数据库迁移工具

### 前端
- **Vue 3**: 渐进式JavaScript框架
- **Vue Router 4**: 路由管理
- **Pinia**: 状态管理
- **Element Plus**: UI组件库
- **Axios**: HTTP客户端
- **Vite**: 构建工具

## 📁 项目结构

```
xy10717/
├── backend/                    # 后端服务
│   ├── app/
│   │   ├── api/              # API路由
│   │   │   ├── migration.py    # 迁移脚本接口
│   │   │   ├── approval.py     # 审批链路接口
│   │   │   ├── execution.py    # 执行日志接口
│   │   │   └── export.py       # 导出功能接口
│   │   ├── models/           # 数据模型
│   │   ├── schemas/          # Pydantic模型
│   │   ├── crud/            # 数据库操作
│   │   ├── core/            # 核心配置
│   │   └── initial_data.py    # 初始化数据
│   ├── main.py               # 应用入口
│   ├── requirements.txt       # Python依赖
│   ├── .env.example         # 环境变量示例
│   └── README.md
│
├── frontend/                  # 前端应用
│   ├── src/
│   │   ├── api/             # API封装
│   │   ├── stores/          # Pinia状态
│   │   ├── views/           # 页面组件
│   │   ├── router/          # 路由配置
│   │   ├── App.vue          # 根组件
│   │   └── main.js          # 入口文件
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
│
└── README.md                # 项目说明文档（本文件）
```

## 🚀 快速开始

### 前置要求
- Python 3.8+
- Node.js 16+
- npm 或 yarn

### 1. 启动后端服务

```bash
# 进入后端目录
cd backend

# 安装依赖
pip install -r requirements.txt

# 配置环境变量（可选）
cp .env.example .env
# 编辑 .env 文件

# 启动服务
python main.py
# 或使用 uvicorn
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

后端服务启动在: http://localhost:8000
- API文档: http://localhost:8000/docs
- ReDoc文档: http://localhost:8000/redoc

### 2. 启动前端应用

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务
npm run dev
```

前端应用启动在: http://localhost:3000

### 3. 访问应用
打开浏览器访问: http://localhost:3000

系统会自动初始化示例数据，包括3个示例迁移脚本。

## 📋 功能模块说明

### 1. 迁移脚本列表
- 查看所有迁移脚本
- 按状态筛选
- 查看详情、导出Excel、删除
- 状态说明：草稿 → 待审批 → 已审批 → 执行中 → 成功/失败

### 2. 创建迁移脚本
1. 填写脚本基本信息
2. 编写SQL脚本内容
3. 配置影响表（表名、操作类型、预估行数等）
4. 添加回滚脚本（多版本）
5. 提交保存

### 3. 审批流程
1. **创建审批链路**: 配置审批步骤和角色
   - 例如：DBA → 运维负责人 → 技术总监
2. **启动审批**: 脚本状态变为"待审批"
3. **逐级审批**: 当前步骤审批人进行审批
   - 规则校验：审批人角色必须匹配
   - 不匹配时自动驳回
4. **审批完成**: 所有步骤通过后，脚本状态变为"已审批"

### 4. 执行操作
- **执行迁移**: 启动迁移执行
- **人工修正**: 执行失败时输入修正SQL
- **完成执行**: 更新执行状态和输出
- **回放执行**: 重新执行相同的脚本

### 5. 追溯链
在脚本详情页可以查看完整的追溯链：
- 以时间轴形式展示所有执行历史
- 包含迁移、回滚、回放、人工修正等类型
- 显示每个执行的详细信息（状态、输出、错误等）

### 6. 导出功能
导出的Excel包含以下工作表：
- 基本信息：脚本详情、状态、创建信息等
- 影响表：所有受影响的表及其信息
- 回滚脚本：回滚方案和验证状态
- 执行日志：完整的执行历史记录

## 🔒 规则被挡住的操作示例

### 示例1: 审批人角色不匹配
**场景**: DBA审批步骤配置了规则 `{"required_role": "DBA"}`

1. 运维负责人（wrong_role）尝试审批DBA步骤
2. 系统校验：审批人角色 ≠ 配置的 required_role
3. 自动驳回审批，提示："规则校验失败: 需要 DBA 角色"
4. 审批链路状态变为"已驳回"
5. 迁移脚本状态变为"已驳回"

### 示例2: 回滚脚本无效
**场景**: 回滚脚本的 `is_valid = false`

1. 用户点击"执行回滚"
2. 系统检查回滚脚本有效性
3. 发现无效，阻止执行
4. 提示："回滚脚本无效，请先验证回滚脚本"

### 示例3: 影响表重新计算
**场景**: SQL脚本内容变更后

1. 点击"重新计算影响表"按钮
2. 系统分析SQL脚本：
   - 检测到 `ALTER TABLE` → 操作类型 = ALTER
   - 检测到 `DROP TABLE` → 操作类型 = DROP
   - 检测到 `CREATE TABLE` → 操作类型 = CREATE
3. 自动更新影响表的操作类型字段
4. 提示："重新计算完成"

## 📡 API接口概览

### 迁移脚本 (`/api/migration`)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 获取列表 |
| GET | `/{id}` | 获取详情 |
| POST | `/` | 创建脚本 |
| PUT | `/{id}` | 更新脚本 |
| DELETE | `/{id}` | 删除脚本 |
| POST | `/{id}/recalculate-tables` | 重新计算影响表 |
| POST | `/{id}/affected-tables` | 添加影响表 |
| POST | `/{id}/rollback-scripts` | 添加回滚脚本 |

### 审批链路 (`/api/approval`)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/chain/{migration_id}` | 获取审批链路 |
| POST | `/chain/{migration_id}` | 创建审批链路 |
| POST | `/chain/{chain_id}/start` | 启动审批 |
| POST | `/step/{step_id}/approve` | 审批通过 |
| POST | `/step/{step_id}/reject` | 审批驳回 |

### 执行日志 (`/api/execution`)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/logs` | 获取日志列表 |
| GET | `/logs/{log_id}` | 获取日志详情 |
| POST | `/{migration_id}/start` | 启动执行 |
| POST | `/logs/{log_id}/complete` | 完成执行 |
| POST | `/logs/{log_id}/replay` | 回放执行 |
| POST | `/{migration_id}/manual-fix` | 人工修正 |

### 导出功能 (`/api/export`)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/migration/{id}/excel` | 导出Excel |
| GET | `/migration/{id}/trace` | 获取追溯链数据 |

## 🔧 配置说明

### 后端环境变量
在 `backend/.env` 中配置：

```env
# 数据库连接
DATABASE_URL=sqlite:///./migration.db

# JWT配置（预留）
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### 更换数据库为MySQL

1. 安装依赖：
```bash
pip install pymysql cryptography
```

2. 修改环境变量：
```env
DATABASE_URL=mysql+pymysql://user:password@localhost:3306/migration_db
```

### 前端代理配置
在 `frontend/vite.config.js` 中修改后端服务地址：

```javascript
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://your-backend-server:8000',
      changeOrigin: true
    }
  }
}
```

## 🐳 Docker部署

### 后端Dockerfile
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 前端Dockerfile
```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    environment:
      - DATABASE_URL=sqlite:///./data/migration.db

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
```

## 📖 开发指南

### 添加新功能
1. 在后端 `app/models/` 定义数据模型
2. 在 `app/schemas/` 定义Pydantic模型
3. 在 `app/crud/` 实现数据库操作
4. 在 `app/api/` 创建API路由
5. 在前端 `src/api/` 封装API调用
6. 在 `src/stores/` 添加状态管理
7. 在 `src/views/` 创建页面组件

### 数据库迁移
使用Alembic管理表结构变更：

```bash
cd backend
alembic init alembic
# 修改 alembic.ini 中的数据库连接
alembic revision --autogenerate -m "create_tables"
alembic upgrade head
```

## 🤝 常见问题

### 1. 后端启动失败？
- 检查Python版本是否 >= 3.8
- 检查端口8000是否被占用
- 查看错误日志，确认依赖已安装

### 2. 前端无法连接后端？
- 确认后端服务已启动
- 检查 vite.config.js 中的代理配置
- 查看浏览器控制台的网络请求

### 3. 初始化数据未加载？
- 检查数据库文件权限
- 首次启动会自动初始化
- 可删除 `.db` 文件重新初始化

### 4. 审批被自动驳回？
- 检查审批步骤配置的 rules 字段
- 确认审批人角色与 required_role 匹配
- 查看驳回原因提示

## 📄 许可证

MIT License

## ✨ 致谢

- FastAPI 社区
- Vue.js 团队
- Element Plus 团队

---

**如有问题或建议，欢迎提交 Issue 和 PR！**
