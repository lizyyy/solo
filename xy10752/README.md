# 工单SLA时钟系统

一个完整的工单SLA（服务等级协议）管理系统，包含后端API和前端管理界面。

## 功能特性

### 核心功能
- **工单管理**: 创建、编辑、查询工单，支持多种优先级和状态
- **SLA计时**: 自动计算SLA剩余时间，考虑工作时间和节假日
- **暂停/恢复**: 支持多种暂停原因（等待客户、第三方依赖、审批等）
- **SLA补偿**: 支持人工调整SLA时间
- **工单升级**: 支持多级工单升级流程
- **审批流程**: 内置审批功能，支持审批通过/拒绝

### 四条SLA路径
1. **成功路径**: 工单在SLA时间内完成
2. **拦截路径**: SLA因外部原因暂停（等待客户、第三方等）
3. **补偿路径**: 因特殊情况申请SLA补偿，增加可用时间
4. **人工复核**: SLA超时或紧急工单需要人工审核处理

### 报表导出
- 单个工单详情导出（含时间线、暂停记录、升级记录、审批记录）
- 批量工单汇总报表导出
- 导出格式为Excel，非研发人员友好，含中文表头和详细说明

## 技术栈

### 后端
- **FastAPI**: 高性能Python Web框架
- **SQLAlchemy**: ORM数据库工具
- **SQLite**: 轻量级数据库
- **Pandas + OpenPyXL**: Excel报表生成

### 前端
- **Vue 3**: 渐进式JavaScript框架
- **Element Plus**: Vue 3组件库
- **Vue Router**: 路由管理
- **Pinia**: 状态管理
- **Axios**: HTTP客户端
- **Day.js**: 日期时间处理

## 项目结构

```
xy10752/
├── backend/                 # 后端项目
│   ├── app/
│   │   ├── api/            # API路由
│   │   │   ├── tickets.py   # 工单相关API
│   │   │   ├── config.py    # 配置相关API
│   │   │   └── export.py    # 导出相关API
│   │   ├── services/        # 业务服务
│   │   │   ├── sla_calculator.py  # SLA计算引擎
│   │   │   └── report_exporter.py # 报表导出服务
│   │   ├── models.py       # 数据模型
│   │   ├── schemas.py      # Pydantic模式
│   │   ├── database.py     # 数据库配置
│   │   └── main.py         # 应用入口
│   └── requirements.txt     # Python依赖
├── frontend/                # 前端项目
│   ├── src/
│   │   ├── views/          # 页面组件
│   │   │   ├── TicketList.vue    # 工单列表
│   │   │   ├── TicketDetail.vue  # 工单详情
│   │   │   └── Config.vue         # 系统配置
│   │   ├── router/         # 路由配置
│   │   ├── utils/          # 工具函数
│   │   ├── App.vue         # 根组件
│   │   └── main.js         # 入口文件
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## 快速开始

### 后端启动

1. 进入后端目录并安装依赖：
```bash
cd backend
pip install -r requirements.txt
```

2. 启动服务：
```bash
cd app
python main.py
```

后端服务将在 `http://localhost:8000` 启动

API文档地址：`http://localhost:8000/docs`

### 前端启动

1. 进入前端目录并安装依赖：
```bash
cd frontend
npm install
```

2. 启动开发服务器：
```bash
npm run dev
```

前端服务将在 `http://localhost:3000` 启动

## 核心功能说明

### SLA计算引擎
- 支持自定义工作时间（如9:00-18:00）
- 支持自定义工作日（如周一至周五）
- 自动排除节假日
- 暂停期间不计入SLA时间
- 支持补偿时间叠加

### 暂停原因管理
- 等待客户回复
- 等待第三方支持
- 等待补充信息
- 节假日暂停
- 审批流程中

### 报表导出字段
**工单主表**：
- 工单编号、工单标题、优先级、工单状态
- SLA规则、SLA状态、已用工时、剩余工时
- 暂停总时长、暂停次数、升级次数、审批次数
- 创建人、处理人、创建时间、解决时间、关闭时间
- 解决用时、SLA结果（达标/超时）

**时间线记录**：
- 事件时间、事件类型、事件标题、事件详情
- 操作人、对SLA影响、操作前后剩余工时

## 初始数据

系统首次启动时会自动创建以下示例数据：

**SLA规则**：
- 标准SLA（普通优先级：24小时解决）
- 紧急SLA（高优先级：8小时解决）
- 24x7 SLA（紧急优先级：4小时解决）

**暂停原因**：
- 等待客户回复
- 等待第三方支持
- 等待补充信息
- 节假日暂停
- 审批流程中

**节假日**：2025年主要节假日（元旦、春节、清明、劳动节、端午、国庆）

## API端点

### 工单API
- `GET /api/tickets/` - 获取工单列表
- `GET /api/tickets/{id}` - 获取工单详情
- `POST /api/tickets/` - 创建工单
- `PUT /api/tickets/{id}` - 更新工单
- `POST /api/tickets/{id}/pause` - 暂停SLA
- `POST /api/tickets/{id}/resume` - 恢复SLA
- `POST /api/tickets/{id}/compensation` - 申请SLA补偿
- `GET /api/tickets/{id}/sla-paths` - 获取SLA路径状态

### 配置API
- `GET /api/config/sla-rules` - 获取SLA规则列表
- `POST /api/config/sla-rules` - 创建SLA规则
- `GET /api/config/pause-reasons` - 获取暂停原因
- `POST /api/config/pause-reasons` - 创建暂停原因
- `GET /api/config/holidays` - 获取节假列表
- `POST /api/config/holidays` - 创建节假日

### 导出API
- `GET /api/export/ticket/{id}` - 导出单个工单报表
- `GET /api/export/tickets` - 导出工单汇总报表
- `POST /api/export/selected` - 导出选中工单报表

## 使用说明

1. **创建工单**：在工单列表页面点击"新建工单"，填写工单信息并选择SLA规则
2. **暂停SLA**：选择需要暂停的工单，点击"暂停"按钮并选择暂停原因
3. **SLA补偿**：进入工单详情页，点击"SLA补偿"按钮申请补偿时间
4. **工单升级**：在工单详情页点击"工单升级"，选择升级类型和级别
5. **审批流程**：提交审批申请后，在快速审批栏处理审批
6. **导出报表**：在工单列表选择要导出的工单，点击导出按钮，或在详情页导出单个工单报表

## 注意事项

- 数据库默认使用SQLite，生产环境建议切换到PostgreSQL或MySQL
- 首次启动会自动创建示例数据，包括SLA规则、暂停原因和节假日
- SLA计算仅考虑工作时间，非工作时间不计入计时
- 暂停期间SLA时钟停止，恢复后继续计时
