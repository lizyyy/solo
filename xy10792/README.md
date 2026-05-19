# 简历解析复核系统

基于 FastAPI + Vue3 的全栈招聘简历解析复核 Web 系统。

## 核心功能

### 业务流程
- **成功路径**: 简历上传 → 自动解析（高置信度） → 岗位匹配 → 人工复核 → 导出交付
- **拦截路径**: 解析置信度 < 0.5 → 标记为拦截 → 进入人工复核
- **补偿路径**: 解析置信度 0.5~0.8 → 部分字段缺失 → 补偿处理
- **复核路径**: 所有字段可编辑 → 版本历史可追溯 → 差异对比可查看

### 主要模块

#### 1. 数据看板 (Dashboard)
- 简历总数、解析成功数、待复核数、平均匹配度统计
- 状态分布饼图
- 技能热度 TOP10 柱状图
- 近30天简历上传趋势折线图

#### 2. 简历管理
- 简历文件上传
- 自动解析（根据文件名模拟不同置信度）
- 岗位自动/手动匹配
- 状态筛选与列表展示

#### 3. 简历详情
- 基本信息展示
- 解析结果查看
- 版本历史追踪
- **差异预览**: 任意两个版本之间字段级对比
- **人工复核**: 所有字段可编辑，记录复核人
- **重新计算匹配度**: 字段变更后可重新计算岗位匹配度

#### 4. 岗位管理
- 岗位 CRUD
- 技能要求配置
- 学历/经验要求设置

#### 5. 数据导出
- 按状态、日期范围筛选
- Excel/CSV 两种格式
- 字段名中文友好化，HR 可直接使用
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

## 快速开始

### 后端启动

```bash
cd backend

# 安装依赖
pip install fastapi uvicorn sqlalchemy pydantic pydantic-settings python-multipart pandas openpyxl

# 启动服务
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

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

前端访问：http://localhost:5173 (Vite 默认端口)

## 项目结构

```
xy10792/
├── backend/                    # 后端项目
│   ├── app/
│   │   ├── __init__.py       # 包初始化
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── resumes.py     # 简历相关接口
│   │   │   ├── jobs.py        # 岗位相关接口
│   │   │   ├── export.py      # 导出相关接口
│   │   │   └── statistics.py  # 统计相关接口
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py      # 配置管理
│   │   │   └── database.py    # 数据库连接
│   │   ├── models/            # 数据模型
│   │   ├── schemas/           # Pydantic 模式
│   │   └── services/          # 业务逻辑
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

## 核心特性说明

### 1. 版本管理与差异对比
每个简历的每次解析/修改都会生成新版本，支持：
- 版本历史查看
- 任意两个版本的字段级别对比
- 差异高亮显示（新增/删除/修改）

### 2. 解析置信度与状态流转
系统根据文件名模拟生成不同置信度的解析结果：
- **置信度 ≥ 0.8**: 解析成功，状态 = "解析成功"
- **0.5 ≤ 置信度 < 0.8**: 部分字段缺失，状态 = "解析补偿"
- **置信度 < 0.5**: 信息严重缺失，状态 = "解析拦截"
- **人工复核后**: 状态 = "复核完成"

### 3. 岗位匹配算法
匹配度计算维度：
- 技能匹配：40% 权重
- 经验匹配：30% 权重
- 学历匹配：20% 权重
- 基础分：10%

### 4. 导出友好化
导出文件采用中文字段名，例如：
- "姓名" 而非 "name"
- "联系电话" 而非 "phone"
- "岗位匹配度(%)" 而非 "match_score"

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

## 验证项目

### 后端验证
```bash
cd backend

# 测试后端启动和接口
python -c "from app.main import app; print('✓ 后端导入成功')"

# 运行完整测试
python3 ../test_backend.py
```

### 前端验证
```bash
cd frontend

# 安装依赖
npm install

# 测试开发服务器启动
npm run dev -- --host 0.0.0.0 --port 3000
```

## 扩展建议

1. **真实简历解析**: 集成 OCR / NLP 模型实现真实简历解析
2. **文件预览**: 支持 PDF/Word 在线预览
3. **用户认证**: 添加用户登录、权限管理
4. **批量操作**: 支持批量上传、批量匹配、批量复核
5. **定时任务**: 自动解析队列、定期数据清理
6. **更多图表**: 部门招聘进度、招聘漏斗等
7. **邮件通知**: 复核提醒、导出完成通知
