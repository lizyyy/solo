# 知识库失效产品状态引用统计后端API

用于检测和统计客服知识库中引用已下线产品的文章链接的后端服务。

## 功能特性

- **Markdown扫描**: 自动解析Markdown文档中的链接
- **链接校验**: 检测失效链接和产品引用
- **产品状态匹配**: 自动识别引用已下线产品的内容
- **引用统计**: 统计和分类所有引用关系
- **体检报告**: 生成知识库健康度报告
- **报告导出**: 支持JSON和Excel格式导出

## 技术栈

- **框架**: FastAPI
- **数据库**: SQLite + SQLAlchemy ORM
- **数据导出**: Pandas + OpenPyXL
- **HTTP客户端**: httpx

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行自检脚本

```bash
python self_test.py
```

该脚本会验证所有核心功能：
- 产品创建和状态管理
- 文章导入和链接扫描
- 失效引用检测和筛选
- 处理状态标记
- 体检报告生成
- JSON/Excel导出功能

### 3. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问API文档

启动服务后，在浏览器中访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 接口说明

### 产品管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/products/` | 创建新产品 |
| GET | `/products/` | 获取产品列表（支持状态筛选） |
| GET | `/products/{product_id}` | 获取单个产品详情 |
| PATCH | `/products/{product_id}/status` | 更新产品状态 |

### 文章管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/articles/import` | 从文件导入文章 |
| POST | `/articles/scan` | 扫描文章中的链接 |
| GET | `/articles/` | 获取文章列表（支持产品筛选） |

### 引用管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/references/invalid` | 获取失效引用列表（支持状态、原因、产品筛选） |
| PATCH | `/references/{reference_id}/processed` | 标记引用为已处理 |

### 报告导出

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/reports/health` | 生成知识库体检报告 |
| GET | `/reports/health/{report_id}/json` | 获取JSON格式的体检报告 |
| GET | `/reports/references/excel` | 导失效引用为Excel |
| GET | `/reports/statistics/excel` | 导出统计数据为Excel |

### 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 服务健康检查 |

## 错误响应码说明

调用方可以根据以下错误码进行区分处理：

| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| `MISSING_FIELD` | 400 | 缺少必要字段 |
| `NOT_FOUND` | 404 | 资源不存在（产品、文章、引用、报告等） |
| `FILE_NOT_FOUND` | 404 | 文件不存在 |
| `ALREADY_PROCESSED` | 409 | 该引用已经处理过 |
| `STATUS_NOT_ALLOWED` | 422 | 无效的状态值 |
| `NEEDS_MANUAL_REVIEW` | 422 | 需要人工复核 |
| `VALIDATION_ERROR` | 400 | 通用验证错误 |

## 核心数据模型

### 产品状态 (ProductStatus)

- `active`: 活跃状态
- `deprecated`: 已废弃
- `end_of_life`: 已下线
- `pending_review`: 待审核

### 引用状态 (ReferenceStatus)

- `pending`: 待处理
- `verified`: 已验证（有效）
- `resolved`: 已解决
- `needs_manual_review`: 需要人工复核
- `processed`: 已处理

### 失效原因 (FailureReason)

- `product_offline`: 产品下线
- `link_broken`: 链接失效
- `process_outdated`: 流程过时
- `content_error`: 内容错误
- `other`: 其他

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── config.py          # 配置管理
│   ├── database.py        # 数据库连接
│   ├── models.py          # 数据模型定义
│   ├── schemas.py         # Pydantic模式定义
│   ├── services.py        # 核心业务逻辑
│   ├── exporter.py        # 报告导出服务
│   └── main.py            # FastAPI应用主入口
├── requirements.txt       # 依赖列表
├── self_test.py          # 自检脚本
├── .env.example          # 环境变量示例
└── README.md             # 项目说明文档
```

## 典型使用场景

### 场景1：产品下线后检测引用

1. 将产品状态更新为 `end_of_life`
2. 系统自动检测所有引用该产品的文章
3. 相关引用自动标记为 `needs_manual_review`
4. 导出失效引用列表，安排坐席更新

### 场景2：定期知识库体检

1. 定时扫描所有文章链接
2. 生成体检报告，查看健康度评分
3. 根据失效原因分类处理
4. 导出统计报告，跟踪改进进度

## 配置说明

复制 `.env.example` 为 `.env` 并根据需要修改：

```env
DATABASE_URL=sqlite:///./knowledge_base.db
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=info
```

## 开发说明

### 运行开发服务器

```bash
uvicorn app.main:app --reload
```

### 运行自检

```bash
python self_test.py
```

## 许可证

本项目仅供内部使用。
