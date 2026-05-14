# 知识库反馈闭环台

一个全栈技术练习项目，实现知识库文章版本管理、用户反馈跟踪、修订草稿审核以及反馈趋势分析功能。

## 技术栈

- **后端**: Python + FastAPI + SQLAlchemy + SQLite
- **前端**: React + React Router + Recharts + Vite

## 功能特性

### 核心功能
- ✅ 文章版本管理（创建、编辑、查看）
- ✅ 用户反馈收集与展示
- ✅ 修订草稿审核（自动拦截脏数据）
- ✅ 反馈趋势图表分析
- ✅ 回滚与重试操作

### 权限系统
- 👤 **业务分析师 (analyst)**: 创建文章版本
- 👷 **处理人员 (processor)**: 审核文章、处理修订草稿
- 👑 **管理员 (admin)**: 执行回滚操作、全部权限

## 本地启动指南

### 1. 启动后端服务

```bash
# 进入后端目录
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# macOS/Linux:
source venv/bin/activate
# Windows (PowerShell):
# .\venv\Scripts\Activate.ps1

# 安装依赖
pip install -r requirements.txt

# 启动服务 (端口 8000)
uvicorn app.main:app --reload
```

后端API文档地址: http://localhost:8000/docs

### 2. 初始化数据

```bash
# 在 backend 目录下执行（确保虚拟环境已激活）
python init_data.py
```

初始化脚本会创建：
- 3个测试用户（业务分析师、处理人员、管理员）
- 3篇文章，共5个版本（包含2个已拦截的脏数据版本）
- 若干用户反馈
- 3个修订草稿（2个脏数据 + 1个正常数据）

### 3. 启动前端服务

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务 (端口 3000)
npm run dev
```

前端访问地址: http://localhost:3000

## 使用说明

### 选择用户身份
1. 打开前端页面后，右上角有用户选择下拉框
2. 选择不同角色体验不同权限功能
3. 首次使用建议先选择"管理员"体验完整功能

### 测试脏数据拦截
在文章详情页的"反馈趋势"区域，点击"创建修订草稿"，输入以下内容测试拦截效果：
- 内容少于50字符 → 自动拦截
- 内容包含"广告"、"垃圾信息"等关键词 → 自动拦截
- 内容包含外部链接 → 自动拦截

## 常用API接口

### 文章版本管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/articles/` | 获取文章版本列表 | - |
| GET | `/api/articles/{id}` | 获取单个文章版本详情 | - |
| POST | `/api/articles/` | 创建新文章版本 | analyst/admin |
| PUT | `/api/articles/{id}` | 更新文章内容/状态 | processor/admin |
| POST | `/api/articles/{id}/rollback` | 回滚文章版本 | admin |
| POST | `/api/articles/{id}/retry` | 重试审核被拦截文章 | processor/admin |

### 修订草稿

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/revision-drafts/` | 获取修订草稿列表 | - |
| POST | `/api/revision-drafts/` | 创建修订草稿 | processor/admin |

### 用户反馈

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/articles/{id}/feedbacks/"` | 获取文章反馈列表 | - |
| POST | `/api/feedbacks/"` | 创建用户反馈 | - |
| GET | `/api/articles/{article_id}/feedback-trend"` | 获取反馈趋势数据 | - |

### 用户管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/users/` | 获取用户列表 | - |
| POST | `/api/users/"` | 创建用户 | - |

### 统计

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/stats/"` | 获取系统统计数据 | - |

## 内容审核规则（会被规则挡住的操作）

系统内置自动内容审核机制，以下情况内容会被自动拦截：

### 1. 内容长度不足
- **规则**: 内容少于50个字符
- **拦截原因**: "内容长度不足，最少需要50字符"

### 2. 内容长度超限
- **规则**: 内容超过10000个字符
- **拦截原因**: "内容长度超过限制，最多允许10000字符"

### 3. 包含违禁关键词
- **规则**: 内容包含以下关键词：`敏感词1`、`敏感词2`、`违规内容`、`垃圾信息`、`广告`
- **拦截原因**: "内容包含违禁关键词: {keyword}"

### 4. 包含外部链接
- **规则**: 内容包含 `http://` 或 `https://` 开头的链接
- **拦截原因**: "内容不允许包含外部链接"

### 拦截后的处理流程
1. 修订草稿被标记为"脏数据" (`is_dirty = 1`)
2. 关联的文章版本状态变为"已拦截" (`blocked`)
3. 系统记录具体的拦截原因
4. 管理员可以在文章详情页点击"重试审核"重新进入待审核状态

## 数据库设计

### 核心表结构

#### users (用户表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| username | String(50) | 用户名 |
| role | Enum | 角色: analyst/processor/admin |
| created_at | DateTime | 创建时间 |

#### article_versions (文章版本表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| article_id | String(100) | 文章ID（跨版本关联） |
| version | String(20) | 版本号 |
| title | String(200) | 文章标题 |
| original_content | Text | 原始输入内容 |
| processed_content | Text | 处理后结果 |
| status | Enum | 状态: draft/pending_review/blocked/approved/published/rollbacked |
| created_by | Integer | 创建者用户ID |
| processor_id | Integer | 处理者用户ID |
| block_reason | Text | 拦截原因 |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |
| published_at | DateTime | 发布时间 |

#### feedbacks (用户反馈表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| article_version_id | Integer | 关联文章版本ID |
| user_comment | Text | 用户评论 |
| feedback_type | Enum | 反馈类型: positive/neutral/negative |
| rating | Integer | 评分 (1-5) |
| created_at | DateTime | 创建时间 |

#### revision_drafts (修订草稿表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| article_version_id | Integer | 关联文章版本ID |
| content | Text | 草稿内容 |
| is_dirty | Integer | 是否脏数据: 0=正常, 1=脏数据 |
| block_reason | Text | 拦截原因 |
| created_by | Integer | 创建者用户ID |
| created_at | DateTime | 创建时间 |

## 脏数据示例

初始化数据中已预置以下脏数据场景：

### 示例1: 包含违禁关键词
- **文章**: "如何使用Python进行数据分析" v1.1版本
- **内容**: 包含"违规内容"关键词
- **状态**: 已拦截
- **拦截原因**: "内容包含违禁关键词: 违规内容"

### 示例2: 包含外部链接和广告
- **文章**: "FastAPI快速入门指南" v1.1版本
- **内容**: 包含"广告"关键词及外部链接
- **状态**: 已拦截
- **拦截原因**: "内容包含违禁关键词: 广告" 或 "内容不允许包含外部链接"

### 示例3: 修订草稿脏数据
- **位置**: 修订草稿列表中
- **标识**: 脏草稿会有红色"⚠️ 脏数据"标识
- **状态**: 关联文章版本会自动变为拦截状态

## 反馈趋势图表

系统提供7天内的反馈趋势折线图，展示每天的：
- 🟢 正面反馈数量（绿色）
- 🟡 中性反馈数量（黄色）
- 🔴 负面反馈数量（红色）

可以在文章详情页查看具体文章的反馈趋势变化。

## 前端页面结构

```
src/
├── main.jsx          # 入口文件
├── App.jsx           # 主应用组件（路由）
├── api.js            # API封装
├── components/       # 公共组件
│   ├── UserSelector.jsx      # 用户选择器
│   ├── StatusBadge.jsx       # 状态徽章
│   └── PermissionAlert.jsx   # 权限提示
└── pages/            # 页面组件
    ├── Dashboard.jsx         # 仪表盘
    ├── ArticlesList.jsx      # 文章版本列表
    ├── ArticleDetail.jsx     # 文章详情页
    └── RevisionDrafts.jsx    # 修订草稿管理
```

## 后端项目结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py           # FastAPI主应用
│   ├── models.py         # SQLAlchemy模型
│   ├── schemas.py        # Pydantic数据结构
│   └── database.py       # 数据库连接配置
├── init_data.py          # 初始化数据脚本
├── requirements.txt      # Python依赖
└── feedback_loop.db      # SQLite数据库（运行后生成）
```

## 开发建议

1. **权限测试**: 切换不同用户角色，体验权限控制效果
2. **脏数据测试**: 尝试创建包含违禁词的修订草稿，观察自动拦截机制
3. **流程测试**: 完整走一遍"创建草稿 → 拦截 → 重试审核 → 通过"的流程
4. **趋势分析**: 查看不同文章的反馈趋势，理解数据变化

## 常见问题

**Q: 为什么创建文章按钮是灰色的？**
A: 需要先在右上角选择用户，且只有分析师或管理员角色才能创建文章。

**Q: 为什么修订草稿提交后被自动拦截？**
A: 这是系统的自动审核机制，内容不符合规则时会被拦截，请查看拦截原因并修改内容。

**Q: 如何查看拦截的具体原因？**
A: 在文章列表或详情页中，可以看到红色的"拦截原因"提示框。

**Q: 被拦截的文章如何重新审核？**
A: 使用处理人员或管理员账号，在文章详情页点击"重试审核"按钮。
