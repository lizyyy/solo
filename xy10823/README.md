# 物流面单代理 API

一个全栈 Web 应用，用于统一管理不同仓库的物流面单打印，统一模板和错误处理。

## 技术栈

- **后端**: Python + FastAPI + SQLAlchemy
- **前端**: HTML + Bootstrap 5 + JavaScript
- **数据库**: SQLite

## 功能特性

### 核心功能
1. **渠道适配**: 支持不同物流渠道的统一接入
2. **模板选择**: 根据渠道自动选择对应的面单模板
3. **批量打印**: 支持批量创建和处理面单
4. **重打幂等**: 限制单条记录最多重打3次
5. **异常归档**: 异常记录支持解决和归档操作

### 数据模型
- **仓库账号**: 管理不同仓库信息
- **物流渠道**: 管理不同物流渠道（顺丰、京东、中通等）
- **面单模板**: 管理不同渠道的打印模板
- **打印批次**: 批量打印任务
- **面单记录**: 单条面单打印记录
- **状态历史**: 记录状态变更历史
- **异常记录**: 记录异常信息
- **重打记录**: 记录重打历史

### API 接口
- `POST /api/v1/batches`: 创建打印批次
- `POST /api/v1/batches/{id}/process`: 处理批次
- `GET /api/v1/batches`: 查询批次列表
- `GET /api/v1/batches/{id}`: 查询批次详情
- `GET /api/v1/records`: 查询记录列表
- `GET /api/v1/records/{id}`: 查询记录详情
- `PUT /api/v1/records/{id}/status`: 更新记录状态
- `POST /api/v1/records/{id}/reprint`: 申请重打
- `GET /api/v1/exceptions`: 查询异常列表
- `PUT /api/v1/exceptions/{id}/resolve`: 解决异常
- `PUT /api/v1/exceptions/{id}/archive`: 归档异常
- `POST /api/v1/export`: 导出记录为CSV

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问应用

- 前端首页: http://localhost:8000/
- API 文档: http://localhost:8000/docs

### 4. 初始化样例数据

点击页面右上角的"初始化样例数据"按钮，系统会自动创建：
- 2个仓库（上海仓库、广州仓库）
- 3个物流渠道（顺丰速运、京东物流、中通快递）
- 4个面单模板

## 使用流程

### 正常流程
1. 创建打印批次，选择仓库、渠道，输入订单数据
2. 点击"处理批次"按钮
3. 系统批量生成面单
4. 成功的记录会流转到"已打印"状态

### 异常流程
1. 部分记录因模拟规则会产生异常
2. 在异常记录中查看错误信息
3. 点击"解决"按钮，填写解决方案
4. 记录状态会自动恢复为"已打印"

### 重打流程
1. 在记录详情页点击"申请重打"
2. 填写重打原因
3. 系统限制最多重打3次
4. 重打记录会保存在重打历史中

## 项目结构

```
.
├── backend/
│   ├── app/
│   │   ├── api/           # API 路由
│   │   ├── models/        # 数据模型
│   │   ├── schemas/       # Pydantic 数据结构
│   │   ├── services/      # 业务逻辑服务
│   │   └── database.py    # 数据库配置
│   └── main.py            # 应用入口
├── templates/             # HTML 模板
│   ├── index.html         # 首页
│   ├── record.html        # 记录详情页
│   └── batch.html         # 批次详情页
├── static/                # 静态资源
├── requirements.txt       # 依赖配置
└── README.md
```
