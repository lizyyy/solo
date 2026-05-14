# 简历解析复核系统

## 项目概述

基于 FastAPI + Vue3 的全栈招聘简历解析复核 Web 系统，实现简历上传、自动解析、岗位匹配、人工复核、差异对比、数据导出等完整流程。

## 核心功能

### 业务流程
- **成功路径**：简历上传 → 自动解析 → 岗位匹配 → 人工复核 → 导出交付
- **拦截路径**：解析置信度过低 → 标记为拦截 → 进入人工复核
- **补偿路径**：部分字段解析失败 → 补偿处理 → 人工确认
- **复核路径**：所有可编辑字段支持人工修改 → 记录版本历史 → 可追溯

### 主要模块

#### 1. 数据看板 (Dashboard)
- 简历总数、解析成功数、待复核数、平均匹配度统计
- 状态分布饼图
- 技能热度 TOP10 柱状图
- 近30天简历上传趋势折线图

#### 2. 简历管理
- 简历文件上传
- 自动解析（模拟）
- 岗位自动/手动匹配
- 状态筛选与列表展示

#### 3. 简历详情
- 基本信息展示
- 解析结果查看
- 版本历史追踪
- **差异对比**：任意两个版本之间字段差异可视化
- **人工复核**：所有字段可编辑修改，记录复核人
- **重新计算匹配度**：字段变化后可重新计算岗位匹配度

#### 4. 岗位管理
- 岗位 CRUD
- 技能要求配置
- 学历/经验要求设置

#### 5. 数据导出
- 按状态、日期范围筛选
- Excel/CSV 两种格式
- 字段名中文友好化，非研发同事可直接使用
- 支持预览导出内容
- 导出后自动标记状态

## 技术栈

### 后端
- **框架**: FastAPI
- **数据库**: SQLite (SQLAlchemy ORM)
- **导出**: Pandas + OpenPyXL
- **差异对比**: 内置字段级别对比

### 前端
- **框架**: Vue 3 (Composition API)
- **构建工具**: Vite
- **UI 组件**: Element Plus
- **状态管理**: Pinia
- **图表**: ECharts
- **路由**: Vue Router

## 项目结构

```
xy10792/
├── backend/                    # 后端项目
│   ├── app/
│   │   ├── api/               # API 路由
│   │   │   ├── resumes.py     # 简历相关接口
│   │   │   ├── jobs.py        # 岗位相关接口
│   │   │   ├── export.py      # 导出相关接口
│   │   │   └── statistics.py  # 统计相关接口
│   │   ├── core/              # 核心配置
│   │   │   ├── config.py      # 配置管理
│   │   │   └── database.py    # 数据库连接
│   │   ├── models/            # 数据模型
│   │   ├── schemas/           # Pydantic 模式
│   │   ├── services/          # 业务逻辑
│   │   │   ├── parse_service.py    # 解析服务
│   │   │   ├── match_service.py    # 匹配服务
│   │   │   ├── export_service.py   # 导出服务
│   │   │   └── statistics_service.py # 统计服务
│   │   └── main.py            # 应用入口
│   ├── requirements.txt       # Python 依赖
│   └── start.sh               # 启动脚本
│
└── frontend/                   # 前端项目
    ├── src/
    │   ├── views/             # 页面组件
    │   │   ├── Dashboard.vue  # 数据看板
    │   │   ├── Resumes.vue    # 简历列表
    │   │   ├── ResumeDetail.vue # 简历详情
    │   │   ├── Jobs.vue       # 岗位管理
    │   │   └── Export.vue     # 数据导出
    │   ├── store/             # 状态管理
    │   ├── router/            # 路由配置
    │   ├── utils/             # 工具函数
    │   └── main.js            # 入口文件
    ├── package.json           # Node 依赖
    └── vite.config.js         # Vite 配置
```

## 快速开始

### 后端启动

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动服务 (方式1)
bash start.sh

# 启动服务 (方式2)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端服务启动后，访问 API 文档：
- Swagger: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务
npm run dev
```

前端访问：http://localhost:3000

## 数据模型

### 简历 (Resume)
- id: 主键
- filename: 文件名
- file_path: 文件路径
- file_hash: 文件哈希
- status: 状态（待解析/解析成功/解析拦截/解析补偿/待人工复核/复核完成/已导出）
- matched_job_id: 匹配岗位ID
- match_score: 匹配度

### 解析结果 (ParseResult)
- id: 主键
- resume_id: 关联简历ID
- version: 版本号
- 个人信息字段：姓名、电话、邮箱、年龄、性别、学历、学校、专业等
- skills: 技能列表
- work_experience: 工作经历
- education_experience: 教育经历
- project_experience: 项目经历
- parse_source: 解析来源（自动/人工/补偿）
- confidence_score: 解析置信度
- created_by: 创建人

### 岗位 (JobPosition)
- id: 主键
- name: 岗位名称
- department: 所属部门
- required_skills: 所需技能列表
- required_experience: 经验要求
- required_education: 学历要求
- description: 岗位描述
- is_active: 是否启用

### 复核记录 (ReviewRecord)
- id: 主键
- resume_id: 关联简历ID
- reviewer: 复核人
- review_comment: 复核意见
- changes_made: 修改内容（JSON）
- review_time: 复核时间

## 核心特性说明

### 1. 版本管理与差异对比
每个简历的每次解析/修改都会生成新版本，支持：
- 版本历史查看
- 任意两个版本的字段级别对比
- 差异高亮显示（新增/删除/修改）

### 2. 岗位匹配算法
匹配度计算维度：
- 技能匹配：40%权重
- 经验匹配：30%权重
- 学历匹配：20%权重
- 基础分：10%

### 3. 导出友好化
导出文件采用中文字段名，例如：
- "姓名" 而非 "name"
- "联系电话" 而非 "phone"
- "岗位匹配度(%)" 而非 "match_score"

### 4. 状态流转
```
待解析 → 解析成功  → 匹配岗位 → 复核完成 → 已导出
       → 解析拦截  → ↗
       → 解析补偿  → ↗
```

## API 接口说明

### 简历相关
- `POST /api/resumes/upload` - 上传简历
- `GET /api/resumes/` - 获取简历列表
- `GET /api/resumes/{id}` - 获取简历详情
- `POST /api/resumes/{id}/parse` - 触发解析
- `POST /api/resumes/{id}/match` - 触发匹配
- `POST /api/resumes/{id}/recalculate-match` - 重新计算匹配度
- `GET /api/resumes/{id}/diff` - 获取版本差异
- `POST /api/resumes/{id}/review` - 提交复核

### 岗位相关
- `GET/POST /api/jobs/` - 获取/创建岗位
- `GET/PUT/DELETE /api/jobs/{id}` - 获取/更新/删除岗位

### 导出相关
- `POST /api/export/preview` - 导出预览
- `POST /api/export/download` - 下载导出文件
- `POST /api/export/mark-exported` - 标记为已导出

### 统计相关
- `GET /api/statistics/` - 获取完整统计数据
- `GET /api/statistics/daily-trend` - 每日趋势
- `GET /api/statistics/top-skills` - 热门技能

## 扩展建议

1. **真实简历解析**：集成 OCR / NLP 模型实现真实简历解析
2. **文件预览**：支持 PDF/Word 在线预览
3. **用户认证**：添加用户登录、权限管理
4. **批量操作**：支持批量上传、批量匹配、批量复核
5. **定时任务**：自动解析队列、定期数据清理
6. **更多图表**：部门招聘进度、招聘漏斗等
7. **邮件通知**：复核提醒、导出完成通知
