# 法院卷宗借阅管理API系统

## 项目概述

本系统专为档案室使用，解决纸质卷宗借阅、延期、归还管理混乱问题。支持批量数据导入、自动规则校验、问题记录追溯。

## 核心功能

### 1. 数据导入
- 支持CSV/JSON格式的借阅记录导入
- 支持JSON格式的案件信息导入
- 支持JSON格式的人员权限表导入

### 2. 业务规则校验
系统内置以下校验规则：

| 规则编码 | 规则名称 | 结果类型 | 说明 |
|---------|---------|---------|------|
| MISSING_FIELDS | 必填字段校验 | FAIL | 检查案号、人员编号、借阅日期必填 |
| CASE_NOT_FOUND | 案件存在性校验 | CONFIRM | 案件在系统中不存在 |
| PERSON_NOT_FOUND | 人员存在性校验 | CONFIRM | 人员在权限表中不存在 |
| SECRET_ACCESS_DENIED | 涉密案件权限校验 | FAIL | 无涉密案件借阅涉密案涉密案件 |
| RENEW_EXCEED_LIMIT | 续借次数上限校验 | FAIL | 超过续借最多2次 |
| OVERDUE_NEED_REMIND | 超期催还提醒 | CONFIRM | 卷宗超期未还 |
| DUE_SOON_WARNING | 即将到期提醒 | CONFIRM | 3天内即将到期 |
| RETURN_BEFORE_BORROW | 日期逻辑校验 | FAIL | 归还日期不能早于借阅日期 |
| DUPLICATE_RECORD | 重复记录校验 | FAIL | 同一记录重复导入 |

### 3. 结果分类
- **正常项(SUCCESS)：所有校验通过
- **待确认项(CONFIRM)：有警告信息，需要人工确认
- **失败项(FAIL)：有严重错误，无法通过

### 4. 幂等性保证
- 同一批材料再次提交不会重复生效
- 基于案号、人员编号、借阅日期联合判断重复记录

### 5. 数据追溯
- 从单条借阅记录追溯到完整报告
- 包含案件信息、人员权限信息、所有校验结果

## 快速开始

### 环境要求
- Python 3.8+
- pip

### 安装依赖

```bash
cd /Users/lzy/pro/solo/workspaces/zy70857
pip install -r requirements.txt
```

### 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 访问地址

- API文档：http://localhost:8000/docs
- Redoc文档：http://localhost:8000/redoc
- 健康检查：http://localhost:8000/api/health

## 使用流程

### 1. 导入案件信息

```bash
curl -X POST "http://localhost:8000/api/import/cases \
  -H "Content-Type: multipart/form-data" \
  -F "file=@examples/cases.json"
```

### 2. 导入人员权限表

```bash
curl -X POST "http://localhost:8000/api/import/persons" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@examples/persons.json"
```

### 3. 导入借阅记录

```bash
curl -X POST "http://localhost:8000/api/import/borrow" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@examples/borrow_records.csv"
```

### 4. 查看批次列表

```bash
curl "http://localhost:8000/api/batches
```

### 5. 查看批次详情报告

```bash
curl "http://localhost:8000/api/batches/{batch_id}
```

### 6. 单条记录追溯

```bash
curl "http://localhost:8000/api/records/R001/trace
```

## 示例数据说明

examples目录下提供了示例数据文件：

- cases.json - 案件信息示例
- persons.json - 人员权限表示例
- borrow_records.csv - 借阅记录示例（包含各种校验场景）

## API接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 首页 |
| GET | /api/health | 健康检查 |
| POST | /api/import/cases | 导入案件信息 |
| POST | /api/import/persons | 导入人员权限表 |
| POST | /api/import/borrow | 导入借阅记录 |
| GET | /api/batches | 获取批次列表 |
| GET | /api/batches/{batch_id} | 获取批次详情报告 |
| GET | /api/records/{record_no}/trace | 单条记录追溯 |
| GET | /api/records/search | 搜索借阅记录 |
| GET | /api/statistics | 获取统计信息 |

## 配置说明

可在 app/rules_engine.py 中调整业务参数：

```python
MAX_RENEW_COUNT = 2  # 最大续借次数
BORROW_DAYS = 30     # 借阅天数
OVERDUE_WARNING_DAYS = 3  # 到期前几天提醒
```

## 数据库

系统默认使用SQLite数据库，文件名为 court_records.db

## 技术栈

- FastAPI - Web框架
- SQLAlchemy - ORM
- Pandas - CSV数据处理
- Uvicorn - ASGI服务器