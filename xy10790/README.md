# 在线课程进度管理系统

全栈工具，包含 Python 后端和 Vue 前端，用于管理学员进度、章节解锁、测验成绩、补学任务、证书资格和学习报表。

## 功能特性

### 后端 API
- **学员进度管理**：创建、查询、更新学员学习进度
- **补学任务管理**：复核补学任务，处理异常情况
- **证书资格管理**：人工确认证书资格
- **数据导出**：导出学员进度、补学任务、证书资格数据为 Excel
- **操作日志**：记录所有操作历史和错误信息
- **幂等处理**：支持请求幂等性，防止重复提交

### 前端界面
- **数据概览**：统计面板，快捷操作入口
- **学员进度**：筛选表格、详情查看、新增进度
- **补学任务**：复核抽屉、错误明细、异常处理
- **证书资格**：人工确认功能
- **报表导出**：导出数据、下载历史
- **操作日志**：操作历史、错误详情

## 技术栈

### 后端
- Python 3.x
- FastAPI - Web 框架
- SQLAlchemy - ORM
- SQLite - 数据库
- Pandas/OpenPyXL - Excel 导出

### 前端
- Vue 3 + Vite
- Element Plus - UI 组件库
- Vue Router - 路由管理
- Pinia - 状态管理
- Axios - HTTP 客户端

## 快速开始

### 后端启动

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动服务 (默认端口 8000)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API 文档：http://localhost:8000/docs

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器 (默认端口 3000)
npm run dev
```

访问：http://localhost:3000

## 项目结构

```
.
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI 入口
│   │   ├── models.py        # SQLAlchemy 模型
│   │   ├── schemas.py       # Pydantic 数据模型
│   │   ├── services.py      # 业务逻辑
│   │   └── database.py      # 数据库配置
│   ├── requirements.txt     # Python 依赖
│   └── course_progress.db   # SQLite 数据库 (运行后生成)
├── frontend/
│   ├── src/
│   │   ├── main.js          # Vue 入口
│   │   ├── App.vue          # 根组件
│   │   ├── router/          # 路由配置
│   │   ├── api/             # API 调用
│   │   └── views/           # 页面组件
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── exports/                 # 导出文件目录
└── README.md
```

## 数据库模型

1. **StudentProgress** - 学员进度主表
2. **ChapterUnlock** - 章节解锁情况
3. **QuizScore** - 测验成绩
4. **RemedialTask** - 补学任务（含异常标记）
5. **CertificateEligibility** - 证书资格
6. **LearningReport** - 学习报表导出记录
7. **OperationLog** - 操作日志
8. **IdempotentRequest** - 幂等请求记录

## 核心 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/progress | 创建学员进度 |
| GET | /api/progress | 查询学员进度列表 |
| GET | /api/progress/{id} | 查询进度详情 |
| PUT | /api/progress/{id} | 更新进度 |
| POST | /api/remedial-tasks/review | 复核补学任务 |
| GET | /api/remedial-tasks/abnormal | 获取异常任务列表 |
| POST | /api/certificates/confirm | 确认证书资格 |
| GET | /api/certificates | 获取证书列表 |
| POST | /api/export | 导出数据 |
| GET | /api/reports | 获取导出历史 |
| GET | /api/reports/{id}/download | 下载报表 |
| GET | /api/operation-logs | 获取操作日志 |
| GET | /api/statistics | 获取统计数据 |

## 重要特性

### 1. 幂等处理
- 支持 `X-Request-ID` 请求头实现幂等性
- 相同请求 ID 的重复请求会返回第一次的结果

### 2. 补学任务异常处理
- 任务支持 `is_abnormal` 异常标记
- 异常原因记录在 `abnormal_reason` 字段
- 复核操作记录操作人和备注

### 3. 证书资格人工确认
- 支持人工审核证书资格
- 记录确认人、确认时间和备注
- 保留历史审核记录

### 4. 操作日志
- 所有关键操作都有日志记录
- 记录操作前后的数据变化
- 支持错误信息追踪

### 5. 数据持久化
- 使用 SQLite 数据库
- 重启服务后历史数据和导出文件保留
- 导出文件存储在 `exports/` 目录
