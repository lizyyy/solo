# 模型评测结果 API

一个偏技术方向的全栈 Web 应用，用于管理和查看模型评测结果，支持按版本查看指标变化趋势。

## 功能特性

### 核心功能
- **评测导入**: 支持导入模型评测结果
- **指标对比**: 多版本指标对比分析
- **失败样本检索**: 查看和标记失败样本
- **备注留痕**: 添加评测备注记录
- **建议导出**: 导出评测报告 (JSON/CSV)

### 界面重点
- **异常队列**: 集中展示失败/异常的评测任务
- **状态按钮**: 支持手动推进评测状态
- **历史轨迹**: 以图表形式展示指标变化趋势
- **导出入口**: 支持多种格式导出评测结果

## 技术栈

### 后端
- **框架**: FastAPI
- **数据库**: SQLite + SQLAlchemy ORM
- **数据验证**: Pydantic
- **其他**: Pandas, OpenPyXL (Excel处理)

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **路由**: React Router
- **图表**: Recharts
- **样式**: Tailwind CSS
- **HTTP客户端**: Axios

## 快速开始

### 环境要求
- Python 3.8+
- Node.js 16+
- npm 或 yarn

### 1. 启动后端服务

```bash
# 进入后端目录
cd backend

# 安装依赖
pip install -r requirements.txt

# 创建样例数据（可选，推荐首次运行执行）
python scripts/seed_data.py

# 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端服务启动后，可以通过以下地址访问：
- API 服务: http://localhost:8000
- API 文档 (Swagger): http://localhost:8000/docs
- API 文档 (ReDoc): http://localhost:8000/redoc

### 2. 启动前端服务

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务启动后访问: http://localhost:3000

## 样例数据说明

执行 `python scripts/seed_data.py` 会创建以下四类样例数据：

### 1. 成功评测 (Success)
- **v1.0.0 - SQuAD-v1**: 已完成，准确率 85.6%
- **v1.1.0 - SQuAD-v1**: 已完成，准确率 89.2%
- **v2.1.0 - SQuAD-v2**: 已完成，准确率 95.6%

### 2. 失败评测 (Failed)
- **v1.1.0 - SQuAD-v1**: 失败，模型加载超时

### 3. 异常评测 (Error)
- **v2.0.0 - SQuAD-v2**: 异常，数据格式错误

### 4. 人工修正相关
- 失败样本 S1、S5 已标记为已解决
- 包含多条人工备注记录
- 包含发布建议（已批准/待批准）

## API 接口说明

### 模型版本管理
```
POST   /api/model-versions/     # 创建模型版本
GET    /api/model-versions/     # 获取模型版本列表
GET    /api/model-versions/{id} # 获取单个模型版本
```

### 评测管理
```
POST   /api/evaluations/                     # 创建评测
GET    /api/evaluations/                     # 获取评测列表（支持按版本/状态筛选）
GET    /api/evaluations/{id}                 # 获取评测详情
PATCH  /api/evaluations/{id}/status          # 更新评测状态
POST   /api/evaluation-import/               # 导入评测数据
GET    /api/evaluations/{id}/export          # 导出评测结果 (?format=json/csv)
GET    /api/anomalies/                       # 获取异常队列
```

### 指标管理
```
GET    /api/metrics/                          # 获取指标列表
POST   /api/metrics/compare/                  # 对比多版本指标
GET    /api/metrics/history                   # 获取指标历史趋势
```

### 失败样本管理
```
GET    /api/failure-samples/                 # 获取失败样本列表
PATCH  /api/failure-samples/{id}             # 更新样本（标记解决状态）
```

### 备注管理
```
POST   /api/notes/                            # 创建备注
GET    /api/notes/                            # 获取备注列表
```

### 发布建议管理
```
POST   /api/release-suggestions/             # 创建发布建议
GET    /api/release-suggestions/             # 获取发布建议列表
```

## 项目结构

```
.
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI 主入口
│   │   ├── models.py        # SQLAlchemy 数据模型
│   │   ├── schemas.py       # Pydantic 数据验证
│   │   ├── crud.py          # 数据库操作封装
│   │   └── database.py      # 数据库连接配置
│   ├── scripts/
│   │   └── seed_data.py     # 样例数据脚本
│   └── requirements.txt     # Python 依赖
├── frontend/
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Evaluations.tsx
│   │   │   ├── EvaluationDetail.tsx
│   │   │   ├── Anomalies.tsx
│   │   │   └── History.tsx
│   │   ├── services/
│   │   │   └── api.ts       # API 服务
│   │   ├── types/
│   │   │   └── index.ts     # TypeScript 类型定义
│   │   ├── App.tsx          # 主应用组件
│   │   ├── main.tsx         # React 入口
│   │   └── index.css        # 全局样式
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
└── README.md
```

## 数据模型

### ModelVersion (模型版本)
- `id`: 主键
- `version_name`: 版本名称 (如 v1.0.0)
- `model_name`: 模型名称 (如 GPT-4)
- `description`: 版本描述
- `created_at`, `updated_at`: 时间戳

### Evaluation (评测记录)
- `id`: 主键
- `model_version_id`: 关联模型版本
- `dataset_name`: 数据集名称
- `dataset_version`: 数据集版本
- `status`: 状态 (running/completed/failed/error)
- `total_samples`, `passed_samples`, `failed_samples`: 样本统计
- `error_message`: 错误信息
- `started_at`, `completed_at`: 时间戳

### Metric (指标)
- `id`: 主键
- `evaluation_id`: 关联评测
- `metric_name`: 指标名称 (如 accuracy)
- `metric_value`: 指标值
- `metric_unit`: 单位
- `threshold`: 阈值
- `is_alert`: 是否告警

### FailureSample (失败样本)
- `id`: 主键
- `evaluation_id`: 关联评测
- `sample_id`: 样本ID
- `input_data`, `expected_output`, `actual_output`: 输入输出
- `error_type`: 错误类型
- `is_resolved`: 是否已解决
- `resolution_note`: 解决备注
- `resolved_at`, `created_at`: 时间戳

### Note (备注)
- `id`, `evaluation_id`, `author`, `content`, `created_at`

### ReleaseSuggestion (发布建议)
- `id`, `model_version_id`, `suggestion_type`, `content`, `author`
- `is_approved`, `approved_by`, `approved_at`, `created_at`

## 状态流转

```
running  →  completed  (成功)
         →  failed     (失败)
         →  error      (异常)
```

所有状态支持手动回退或推进，方便人工干预。

## 使用指南

### 1. 查看概览
访问首页查看评测统计、异常数量、完成率等关键指标，以及最近的评测记录。

### 2. 管理评测
- 进入"评测列表"查看所有评测
- 支持按模型版本和状态筛选
- 点击"查看详情"查看完整评测信息

### 3. 处理异常
- 进入"异常队列"查看所有失败和异常的评测
- 点击详情可以查看错误信息和手动更新状态

### 4. 查看历史趋势
- 进入"历史轨迹"查看指标随版本变化的趋势图
- 支持切换不同指标查看

### 5. 导出报告
在评测详情页点击"导出 JSON"或"导出 CSV"按钮下载报告。

## 开发说明

### 后端开发
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 前端开发
```bash
cd frontend
npm install
npm run dev
```

### 重置数据库
删除 `backend/evaluation.db` 文件，重启后端服务会自动重新创建数据库表结构，然后重新执行样例数据脚本。

## License

MIT
