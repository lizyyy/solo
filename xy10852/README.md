# 通知偏好管理系统

## 项目概述

这是一个全栈Web应用，用于解决多入口场景下的用户通知偏好管理。系统实现了完整的偏好同步、异常处理、状态追踪和数据导出功能。

## 核心功能

### 业务规则引擎
- **来源优先级机制**：不同来源的偏好设置具有不同的优先级（用户设置 > 管理员 > API > 营销活动 > 批量导入）
- **偏好合并**：合并多个来源的偏好设置
- **发送前校验**：发送通知前自动校验用户偏好
- **变更快照**：完整记录每次偏好变更的前后状态
- **拦截报告**：统计和分析通知拦截情况

### 数据模型
- **用户偏好**：记录用户对不同渠道和场景的偏好设置
- **通知渠道**：短信(SMS)、邮件(EMAIL)、站内信(IN_APP)
- **业务场景**：交易通知、营销通知、安全通知、系统通知
- **来源入口**：用户设置、管理员面板、批量导入、API、营销活动
- **发送拦截**：记录每次发送校验结果
- **变更历史**：完整的审计日志
- **异常队列**：处理同步过程中的异常

## 技术栈

### 后端
- **框架**：FastAPI
- **数据库**：SQLite (可扩展为PostgreSQL/MySQL)
- **ORM**：SQLAlchemy
- **数据验证**：Pydantic

### 前端
- **框架**：React 18
- **构建工具**：Vite
- **样式**：Tailwind CSS
- **路由**：React Router
- **HTTP客户端**：Axios
- **图标**：Lucide React

## 快速开始

### 前置要求
- Python 3.8+
- Node.js 16+ (用于前端)

### 一键启动
```bash
# 给启动脚本执行权限
chmod +x start.sh

# 启动完整系统（自动安装依赖、运行测试、启动前后端）
./start.sh

# 仅运行核心规则测试
./start.sh test

# 仅启动后端
./start.sh backend

# 仅启动前端
./start.sh frontend
```

### 手动安装

#### 后端安装
```bash
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动服务
uvicorn main:app --reload
```

#### 前端安装
```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

#### 运行测试
```bash
cd backend
source venv/bin/activate
cd ..
python3 tests/test_core_rules.py
```

## 访问地址

启动成功后，可通过以下地址访问：

- **前端界面**：http://localhost:3000
- **后端API**：http://localhost:8000
- **API文档**：http://localhost:8000/docs

## 功能模块

### 1. 仪表盘 (Dashboard)
- 系统概览统计
- 最近偏好变更
- 异常队列预览
- 实时统计数据

### 2. 偏好管理 (Preferences)
- 查看和筛选用户偏好
- 新增偏好设置
- 按渠道、场景、状态筛选

### 3. 异常队列 (Anomalies)
- 查看所有异常记录
- 异常状态管理（待处理、重试中、已解决）
- 状态推进按钮
- 异常详情查看

### 4. 历史轨迹 (History)
- 完整的变更历史记录
- 变更前后对比
- 快照数据查看
- 操作人追踪

### 5. 数据导出 (Export)
- 支持多种导出格式(JSON、CSV、Excel)
- 按用户、渠道、场景筛选
- 支持导出偏好、历史、拦截、异常数据

## API接口

### 偏好相关
- `POST /api/v1/preferences` - 创建偏好
- `GET /api/v1/preferences` - 获取偏好列表
- `GET /api/v1/preferences/{id}` - 获取偏好详情
- `POST /api/v1/preferences/merge` - 合并偏好

### 校验相关
- `POST /api/v1/preferences/validate` - 发送前校验
- `GET /api/v1/preferences/interceptions` - 获取拦截记录
- `GET /api/v1/preferences/interceptions/report` - 拦截报告

### 异常相关
- `GET /api/v1/preferences/anomalies` - 获取异常队列
- `POST /api/v1/preferences/anomalies/advance` - 推进异常状态

### 导出相关
- `POST /api/v1/preferences/export/preferences` - 导出偏好
- `POST /api/v1/preferences/export/history` - 导出历史
- `POST /api/v1/preferences/export/interceptions` - 导出拦截
- `POST /api/v1/preferences/export/anomalies` - 导出异常

### 统计相关
- `GET /api/v1/preferences/stats/summary` - 统计概览

## 核心规则测试

项目包含完整的测试套件，验证以下核心功能：

1. **来源优先级机制** - 高优先级来源覆盖低优先级
2. **偏好合并功能** - 合并多个来源的元数据
3. **发送前校验规则** - 多种拦截场景验证
4. **变更历史与快照** - 完整的审计记录
5. **异常状态推进** - 异常生命周期管理
6. **拦截报告统计** - 拦截率和规则统计

运行测试：
```bash
python3 tests/test_core_rules.py
```

## 项目结构

```
notification-preference/
├── backend/                 # 后端服务
│   ├── app/
│   │   ├── api/           # API路由
│   │   ├── core/          # 核心配置
│   │   ├── models/        # 数据模型
│   │   ├── schemas/       # Pydantic模式
│   │   └── services/     # 业务逻辑
│   ├── main.py           # 应用入口
│   ├── requirements.txt   # Python依赖
│   └── .env            # 环境配置
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── pages/        # 页面组件
│   │   ├── services/     # API服务
│   │   └── types/        # TypeScript类型
│   ├── package.json     # Node依赖
│   └── vite.config.ts   # Vite配置
├── tests/                  # 测试文件
│   └── test_core_rules.py # 核心规则测试
├── start.sh               # 启动脚本
└── README.md             # 项目文档
```

## 配置说明

### 后端配置 (backend/.env)
```env
DATABASE_URL=sqlite:///./notification_preference.db
API_V1_STR=/api/v1
PROJECT_NAME=通知偏好API
```

### 前端配置
前端通过Vite代理配置，API请求自动转发到后端8000端口。

## 扩展建议

1. **数据库扩展**：可将SQLite替换为PostgreSQL/MySQL以支持生产环境
2. **认证授权**：添加JWT/OAuth2认证机制
3. **消息队列**：集成Redis/RabbitMQ处理异步任务
4. **缓存层**：添加Redis缓存热点数据
5. **监控告警**：集成Prometheus/Grafana监控
6. **批量处理**：支持大规模用户偏好批量导入导出

## 许可证

MIT License
