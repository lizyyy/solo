# 提示词模板审批台

一个偏技术方向的全栈Web应用，用于管理和审批LLM提示词模板，解决团队将提示词写在代码中需要重新发布服务的问题。

## 功能特性

### 核心功能
- **模板列表筛选**：支持按场景、状态、关键词搜索筛选
- **详情时间线**：完整记录版本、审批、灰度、效果等全生命周期
- **批量导入**：支持Excel/CSV批量导入模板
- **报告下载**：导出单模板或全量模板报告

### 规则引擎
- **模板版本化**：每个模板支持多版本管理
- **变量校验**：自动校验提示词中的变量是否定义
- **审批发布**：草稿 → 待审批 → 已批准 → 灰度中 → 已发布
- **灰度回滚**：支持灰度发布和效果不达标时回滚
- **效果对比**：记录效果指标并与基准值对比

## 技术栈

### 后端
- **框架**：Python Flask
- **数据库**：SQLite (本地持久化)
- **ORM**：Flask-SQLAlchemy
- **导出**：Pandas + OpenPyXL

### 前端
- **框架**：React 18
- **构建工具**：Vite
- **组件库**：Ant Design 5
- **路由**：React Router
- **HTTP**：Axios

## 项目结构

```
prompt-approval-platform/
├── backend/
│   ├── app.py              # Flask应用主入口
│   ├── models.py           # 数据库模型
│   ├── requirements.txt    # Python依赖
│   ├── data/              # SQLite数据库文件
│   └── exports/           # 导出文件目录
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # 主应用组件
│   │   ├── main.jsx       # 入口文件
│   │   ├── index.css      # 样式
│   │   ├── api/           # API封装
│   │   └── pages/         # 页面组件
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## 快速开始

### 方式一：使用启动脚本（推荐）

```bash
# 赋予执行权限
chmod +x start.sh

# 启动服务
./start.sh
```

### 方式二：手动启动

#### 1. 启动后端服务

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动服务 (默认端口 5000)
python app.py
```

#### 2. 启动前端服务

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务 (默认端口 3000)
npm run dev
```

## 访问应用

- 前端页面：http://localhost:3000
- 后端API：http://localhost:5000

## API接口

### 模板管理
- `GET /api/templates` - 获取模板列表（分页、筛选）
- `GET /api/templates/:id` - 获取模板详情
- `POST /api/templates` - 创建新模板
- `POST /api/templates/:id/versions` - 创建新版本
- `POST /api/templates/:id/submit` - 提交审批
- `POST /api/templates/:id/approve` - 审批通过
- `POST /api/templates/:id/reject` - 驳回审批
- `POST /api/templates/:id/gray` - 开始灰度
- `POST /api/templates/:id/rollback` - 灰度回滚
- `POST /api/templates/:id/publish` - 正式发布
- `POST /api/templates/:id/effect` - 添加效果记录

### 导入导出
- `POST /api/templates/import` - 批量导入模板
- `GET /api/templates/export` - 导出全部模板
- `GET /api/templates/:id/export` - 导出单模板版本

### 通用接口
- `GET /api/scenarios` - 获取场景列表
- `GET /api/stats` - 获取统计数据

## 数据模型

### PromptTemplate (提示词模板)
- id: 主键
- template_id: 模板ID（唯一）
- name: 模板名称
- description: 描述
- scenario: 适用场景
- status: 状态 (draft/pending_approval/approved/gray/published/rejected)
- current_version: 当前版本号
- created_at: 创建时间
- updated_at: 更新时间
- created_by: 创建人

### TemplateVersion (模板版本)
- id: 主键
- template_id: 模板ID
- version: 版本号
- content: 提示词内容
- variables: 变量定义（JSON）
- created_at: 创建时间
- created_by: 创建人
- changelog: 变更说明

### ApprovalRecord (审批记录)
- id: 主键
- template_id: 模板ID
- version: 版本号
- approver: 审批人
- opinion: 审批意见
- status: 审批状态
- created_at: 创建时间
- approved_at: 审批时间

### GrayRecord (灰度记录)
- id: 主键
- template_id: 模板ID
- version: 版本号
- traffic_percent: 灰度流量百分比
- start_time: 开始时间
- end_time: 结束时间
- status: 状态
- created_by: 创建人
- rolled_back: 是否已回滚
- rollback_reason: 回滚原因

### EffectRecord (效果记录)
- id: 主键
- template_id: 模板ID
- version: 版本号
- metric_name: 指标名称
- metric_value: 指标值
- baseline_value: 基准值
- sample_size: 样本量
- recorded_at: 记录时间
- notes: 备注

## 演示数据

应用首次启动时会自动创建5个演示模板，覆盖不同状态和场景：
- 客服智能回复模板（已发布）
- 代码审查助手（灰度中）
- 文档摘要生成器（待审批）
- 专业翻译模板（已批准）
- 数据分析报告（草稿）

## 数据持久化

所有数据存储在 `backend/data/prompts.db` SQLite数据库中，重启服务后数据不会丢失。

## 注意事项

1. 首次启动需要安装Python和Node.js依赖
2. 后端默认端口5000，前端默认端口3000
3. 数据库文件会自动创建，无需手动配置
4. 演示数据仅在首次启动时创建，后续重启不会覆盖现有数据
