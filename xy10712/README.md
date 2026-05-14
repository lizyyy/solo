# 邮件模板灰度发布系统

全栈Web应用，实现邮件模板的灰度发布流程，包含变量校验、测试收件人、灰度批次追踪、审批记录、差异预览、统计卡片等功能。

## 功能特性

### 核心流程
- ✅ **成功路径**：模板创建 → 审批 → 创建批次 → 变量校验 → 灰度发布 → 全量发送
- ✅ **拦截路径**：发现问题随时拦截批次
- ✅ **补偿路径**：失败邮件自动补偿重发
- ✅ **人工复核**：异常批次转入人工处理

### 主要功能
1. **模板管理**：模板创建、版本控制、差异对比、审批流程
2. **批次管理**：多阶段灰度发布、测试收件人、邮件变量校验
3. **审批中心**：模板审批、批次审批、补偿审批
4. **数据导出**：Excel/CSV格式导出，非研发友好
5. **统计面板**：发送指标、成功率、月度趋势
6. **操作日志**：完整的操作追踪记录

## 技术栈

### 后端
- FastAPI 0.104.1
- SQLAlchemy 2.0.23
- Pydantic 2.5.0
- SQLite
- Pandas + OpenPyXL（导出）

### 前端
- Vue 3.3.11
- Element Plus 2.4.4
- Vue Router 4.2.5
- Pinia 2.1.7
- Axios 1.6.2
- ECharts 5.4.3
- Vite 5.0.8

## 项目结构

```
xy10712/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── database.py      # 数据库配置
│   │   ├── models.py        # 数据模型
│   │   ├── schemas.py       # Pydantic模式
│   │   ├── services.py      # 业务逻辑
│   │   └── main.py          # API入口
│   ├── requirements.txt
│   └── .env
└── frontend/
    ├── src/
    │   ├── main.js
    │   ├── App.vue
    │   ├── api/
    │   │   └── index.js
    │   ├── router/
    │   │   └── index.js
    │   └── views/
    │       ├── Dashboard.vue
    │       ├── Templates.vue
    │       ├── TemplateDetail.vue
    │       ├── Batches.vue
    │       ├── BatchDetail.vue
    │       └── Approvals.vue
    ├── package.json
    ├── vite.config.js
    └── index.html
```

## 快速开始

### 后端启动

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动服务
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端API文档：http://localhost:8000/docs

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务
npm run dev
```

前端访问：http://localhost:3000

## 使用指南

### 1. 创建邮件模板
1. 进入「模板管理」页面
2. 点击「新建模板」，填写模板名称、主题、内容
3. 定义变量（支持字符串、邮箱、数字、日期类型）
4. 提交审批

### 2. 审批模板
1. 进入「审批中心」页面
2. 查看待审批的模板
3. 点击通过或拒绝（可填写备注）

### 3. 创建发送批次
1. 进入「批次管理」页面
2. 点击「新建批次」，选择已审批的模板
3. 添加测试收件人（用于验证）
4. 设置灰度阶段数量
5. 添加正式收件人及变量值
6. 创建批次

### 4. 变量校验
1. 进入批次详情页面
2. 查看变量校验结果
3. 如有变量变更，点击「重新校验」
4. 校验通过后可推进灰度

### 5. 灰度发布
1. 在批次列表点击「更多操作」→「推进灰度」
2. 系统按阶段逐步发送邮件
3. 可随时点击「拦截批次」停止发送
4. 失败邮件可启动补偿流程

### 6. 数据导出
1. 在批次列表选择要导出的批次
2. 点击「更多操作」→「导出数据」
3. 下载Excel文件，包含：
   - 批次概览（统计信息）
   - 邮件详情（每个收件人的发送状态）
   - 变量值（便于排查问题）

## 数据模型

### 核心实体关系
```
EmailTemplate (1) ──→ (n) TemplateVersion
     │
     │ 1
     │
     └──→ (n) EmailBatch
             │
             │ 1
             │
             ├──→ (n) EmailRecord
             │       │
             │       │ 1
             │       │
             │       └──→ (n) VariableValidation
             │
             ├──→ (n) ApprovalRecord
             └──→ (n) BatchLog
```

### 状态机

#### 模板状态
```
draft → pending_review → approved
                    ↘→ rejected
```

#### 批次状态
```
pending → validating → ready → in_progress → success
                 ↓          ↓          ↓
          validation_failed  ├─→ partial_success
                           ↓          ↓
                           ├─→ failed
                           ├─→ intercepted
                           ├─→ compensating → compensated
                           └─→ manual_review
```

#### 邮件状态
```
pending → sending → success
              ↓
              ├─→ failed → retry → ...
              └─→ intercepted
```

## API接口

### 统计
- `GET /api/statistics` - 获取统计数据

### 模板
- `GET /api/templates` - 获取模板列表
- `POST /api/templates` - 创建模板
- `GET /api/templates/{id}` - 获取模板详情
- `GET /api/templates/{id}/versions` - 获取模板版本
- `GET /api/templates/{id}/diff` - 版本差异对比

### 批次
- `GET /api/batches` - 获取批次列表
- `POST /api/batches` - 创建批次
- `GET /api/batches/{id}` - 获取批次详情
- `GET /api/batches/{id}/emails` - 获取批次邮件列表
- `GET /api/batches/{id}/validations` - 获取变量校验结果
- `POST /api/batches/{id}/recalculate-validations` - 重新校验变量
- `POST /api/batches/{id}/advance-stage` - 推进灰度阶段
- `POST /api/batches/{id}/intercept` - 拦截批次
- `POST /api/batches/{id}/compensate` - 启动补偿
- `POST /api/batches/{id}/manual-review` - 转入人工复核
- `GET /api/batches/{id}/logs` - 获取操作日志
- `GET /api/batches/{id}/export` - 导出批次数据

### 审批
- `GET /api/approvals` - 获取审批列表
- `POST /api/approvals` - 创建审批
- `POST /api/approvals/{id}/action` - 审批操作

## 变量校验规则

系统支持以下变量类型和校验规则：

| 类型 | 校验规则 |
|------|----------|
| string | 必填检查 |
| email | 邮箱格式验证 |
| number | 数字格式验证 |
| date | ISO日期格式验证 |

所有变量支持正则表达式自定义校验（通过pattern字段配置）。

## 导出字段说明

### 邮件详情Sheet
| 字段 | 说明 |
|------|------|
| 收件人邮箱 | 邮件接收地址 |
| 收件人姓名 | 收件人显示名称 |
| 是否测试邮件 | 是/否 |
| 灰度阶段 | 所属发送阶段 |
| 发送状态 | 待发送/发送中/成功/失败/已拦截 |
| 发送时间 | 实际发送时间 |
| 错误信息 | 失败原因 |
| 创建时间 | 记录创建时间 |
| 变量 - * | 每个变量单独一列 |

### 概览Sheet
- 批次名称、模板名称、灰度阶段、邮件总数、已发送、成功数、失败数、拦截数等统计指标

## 部署建议

### 生产环境配置
1. 数据库：SQLite → PostgreSQL/MySQL
2. 跨域：配置CORS白名单
3. 认证：添加用户认证和权限控制
4. 邮件服务：集成实际邮件发送服务（如SendGrid、AWS SES）
5. 异步任务：使用Celery处理邮件发送
6. 监控：添加发送监控和告警

### 扩展建议
- 支持富文本编辑器（如TinyMCE）
- 增加模板预览功能
- 支持定时发送
- 增加A/B测试功能
- 集成更多邮件服务商

## 许可证

MIT
