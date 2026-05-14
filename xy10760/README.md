# 审批规则模拟器

一个完整的全栈审批规则模拟系统，包含Python FastAPI后端和Vue前端。

## 功能特性

### 核心数据模型
- **申请单**: 存储申请单的基本信息
- **规则版本**: 管理不同版本的审批规则
- **命中条件**: 定义规则触发的条件
- **审批人**: 审批人员信息管理
- **跳过原因**: 审批跳过原因配置
- **模拟结果**: 存储每次模拟的完整结果

### 关键功能
1. **幂等性保证**: 重复请求不会创建重复数据
2. **审批人异常检测**: 自动检测审批人是否存在或已停用
3. **跳过原因人工确认**: 支持对跳过原因进行人工复核
4. **模拟发布**: 支持将模拟结果发布生效
5. **Excel导出**: 导出友好的Excel报表，非技术人员也能看懂

### 前端页面
- **模拟列表**: 筛选表格，支持按申请单、规则版本、状态等筛选
- **复核抽屉**: 右侧抽屉展示完整模拟详情，包含所有关联数据
- **错误明细**: 专门展示审批人异常和系统错误信息
- **数据管理**: 统一管理所有基础数据（申请单、规则、条件、审批人等）

## 项目结构

```
├── backend/                 # Python后端
│   ├── app/
│   │   ├── __init__.py
│   │   ├── database.py     # 数据库配置
│   │   ├── models.py       # 数据模型
│   │   ├── schemas.py      # Pydantic模式
│   │   ├── services.py     # 业务逻辑
│   │   ├── export_service.py # Excel导出服务
│   │   └── routers.py      # API路由
│   ├── requirements.txt    # Python依赖
│   └── main.py            # 入口文件
└── frontend/              # Vue前端
    ├── src/
    │   ├── components/
    │   │   ├── SimulationList.vue    # 模拟列表页
    │   │   ├── SimulationDetail.vue  # 详情复核抽屉
    │   │   └── DataManagement.vue    # 数据管理页
    │   ├── api.js         # API封装
    │   ├── App.vue        # 主应用
    │   └── main.js        # 入口文件
    ├── index.html
    ├── package.json
    └── vite.config.js
```

## 快速开始

### 后端启动

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端API文档: http://localhost:8000/docs

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务
npm run dev
```

前端访问: http://localhost:3000

## API接口

### 模拟结果
- `POST /api/simulations` - 创建模拟（幂等）
- `GET /api/simulations` - 查询模拟列表（支持筛选）
- `GET /api/simulations/{id}` - 获取模拟详情
- `POST /api/simulations/{id}/confirm-skip` - 确认跳过原因
- `POST /api/simulations/{id}/publish` - 发布模拟结果
- `GET /api/simulations/{id}/export` - 导出Excel

### 基础数据
- 申请单: `GET/POST /api/applications`
- 规则版本: `GET/POST /api/rule-versions`
- 命中条件: `GET/POST /api/hit-conditions`
- 审批人: `GET/POST /api/approvers`
- 跳过原因: `GET/POST /api/skip-reasons`

## 导出Excel说明

导出的Excel包含以下工作表，全部使用友好的中文名称：

1. **模拟结果概览**: 模拟ID、状态、审批结果、跳过信息、发布状态等
2. **申请单信息**: 申请单号、申请人、部门、金额等
3. **规则版本信息**: 版本号、规则名称、描述等
4. **命中条件**: 所有命中的条件明细
5. **审批人信息**: 审批人列表及状态
6. **错误明细**: 审批人异常和系统错误详情

## 使用说明

1. **创建模拟**: 在模拟列表页点击"新建模拟"，选择相关数据后提交
2. **查看详情**: 点击列表中的"查看详情"，在右侧抽屉查看完整信息
3. **确认跳过**: 如果模拟有跳过原因，可点击"确认跳过"进行人工确认
4. **发布模拟**: 确认无误后点击"发布"使结果生效
5. **导出报表**: 点击"导出"按钮下载Excel报表

## 技术栈

- **后端**: FastAPI + SQLAlchemy + SQLite + OpenPyXL
- **前端**: Vue 3 + Element Plus + Axios + Vite
