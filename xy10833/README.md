# 🚦 功能开关 API 控制台

一个面向技术的全栈功能开关管理系统，支持灰度发布、变更审批、版本回滚等功能。

## ✨ 功能特性

### 🎛️ 功能开关管理
- 创建、编辑、删除功能开关
- 启用/禁用开关状态管理
- 版本号自动递增

### 🎯 灰度规则
- 按百分比灰度
- 白名单用户
- 白名单地区
- 用户组灰度

### 📋 变更审批流程
- 创建变更单
- 变更内容对比（变更前 vs 变更后）
- 审批/拒绝变更
- 变更历史记录

### ⏪ 版本回滚
- 完整的版本历史
- 一键回滚到任意版本
- 回滚原因记录

### 📊 审计与统计
- 命中记录追踪
- 读取来源审计
- 实时统计面板
- 导出功能

## 🏗️ 项目结构

```
.
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI 主入口
│   │   ├── core/           # 核心模块
│   │   │   └── database.py # 数据库配置
│   │   ├── models/         # SQLAlchemy 数据模型
│   │   ├── schemas/        # Pydantic 数据结构
│   │   ├── services/       # 业务逻辑层
│   │   ├── api/            # API 路由
│   │   └── demo_data.py   # 演示数据初始化
│   └── requirements.txt     # Python 依赖
├── frontend/
│   └── dist/
│       └── index.html      # 单页应用
└── start.sh               # 启动脚本
```

## 🚀 快速开始

### 方式一：使用启动脚本

```bash
chmod +x start.sh
./start.sh
```

### 方式二：手动启动

```bash
# 安装后端依赖
cd backend
pip install -r requirements.txt

# 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 访问应用

- 前端控制台：http://localhost:8000
- API 文档：http://localhost:8000/docs
- 数据库文件：backend/feature_flags.db

## 📡 API 接口

### 功能开关
- `GET /api/feature-flags` - 获取开关列表
- `POST /api/feature-flags` - 创建新开关
- `GET /api/feature-flags/{id}` - 获取开关详情
- `PUT /api/feature-flags/{id}` - 更新开关
- `DELETE /api/feature-flags/{id}` - 删除开关
- `POST /api/feature-flags/evaluate/{key}` - 评估开关
- `POST /api/feature-flags/{id}/rollback` - 回滚版本

### 变更单
- `GET /api/change-orders` - 获取变更单列表
- `POST /api/change-orders` - 创建变更单
- `POST /api/change-orders/{id}/approve` - 审批变更单

### 统计与其他
- `GET /api/statistics` - 获取统计数据
- `GET /api/hit-records` - 获取命中记录
- `GET /api/read-sources` - 获取读取来源
- `POST /api/export` - 导出数据

## 🎮 演示数据

系统启动时会自动创建演示数据，包括：

- 5个功能开关（支付系统、AI推荐、新版UI、实时通知、数据导出）
- 4个读取来源（Web前端、移动APP、后端服务、脚本任务）
- 200+条命中记录
- 2个待审批变更单

## 🛠️ 技术栈

### 后端
- **FastAPI** - 现代、高性能的 Web 框架
- **SQLAlchemy** - ORM 数据库工具
- **SQLite** - 轻量级数据库（持久化存储）
- **Pydantic** - 数据验证

### 前端
- **原生 HTML/CSS/JavaScript**
- **响应式设计**
- **无需构建工具**

## 📝 使用说明

1. **创建功能开关**
   - 点击"新建开关"按钮
   - 填写名称、Key、描述
   - 设置灰度规则（百分比、白名单等）

2. **审批变更**
   - 在"变更单"标签页查看待审批变更
   - 点击"查看"查看变更详情
   - 对比变更前后内容
   - 点击"批准"或"拒绝"

3. **版本回滚**
   - 在开关详情页查看版本历史
   - 点击"回滚"按钮
   - 填写回滚原因确认

4. **查看统计**
   - 首页统计面板显示实时数据
   - "命中记录"标签页查看详细命中日志

## 🔄 数据持久化

所有数据存储在 `backend/feature_flags.db` SQLite 数据库文件中，重启服务后数据不会丢失。
