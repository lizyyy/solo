# 重放结果比对器后端服务

## 功能概述

基于 FastAPI + SQLAlchemy 构建的重放结果比对服务，主要用于班车预约名单复核等场景。

## 核心功能

1. **数据造数** - 生成班车预约测试数据，包含重复提交案例
2. **规则版本管理** - 规则变更时，旧批次仍能解释当时使用的判断口径
3. **比对结果查询** - 支持按批次、操作者、风险类型过滤
4. **差异报告** - 保留两边响应的关键字段
5. **清理/回滚机制** - 先生成候选清单，避免误伤真实数据
6. **持久化存储** - 本地重启后，历史处理结论和材料摘要仍然可查

## 快速开始

### 方式一：使用启动脚本

```bash
./start.sh
```

### 方式二：手动启动

```bash
# 安装依赖
pip install -r requirements.txt

# 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后，访问 http://localhost:8000/docs 查看 API 文档。

## API 接口说明

### 1. 数据生成

**POST** `/api/data/generate`

生成测试数据，包含班车预约名单和比对结果，其中会自动创建一条重复提交记录。

请求体：
```json
{
  "batch_no": "BATCH20240101001",
  "operator": "张三",
  "record_count": 10
}
```

### 2. 规则管理

- **GET** `/api/rules` - 获取所有规则版本
- **POST** `/api/rules` - 创建新规则版本

### 3. 批次管理

- **GET** `/api/batches` - 获取所有批次
- **GET** `/api/batches/{batch_no}` - 获取批次详情

### 4. 比对结果查询

**POST** `/api/comparison/query`

支持多条件过滤查询：

```json
{
  "batch_no": "BATCH20240101001",
  "operator": "张三",
  "risk_type": "重复提交",
  "is_abnormal": true,
  "page": 1,
  "page_size": 20
}
```

### 5. 差异报告

**GET** `/api/comparison/{result_id}/diff-report`

获取单条记录的差异报告，包含：
- 原始响应关键字段
- 重放响应关键字段
- 差异字段列表
- 变更前后值、修正措施、结论汇总

### 6. 候选清单（清理/回滚）

- **POST** `/api/candidates` - 创建候选清单
- **GET** `/api/candidates` - 获取候选清单列表
- **POST** `/api/candidates/{id}/approve` - 批准候选清单
- **POST** `/api/candidates/{id}/cleanup` - 执行清理
- **POST** `/api/candidates/{id}/rollback` - 执行回滚

### 7. 过滤器选项

- **GET** `/api/filters/operators` - 获取所有操作者列表
- **GET** `/api/filters/risk-types` - 获取所有风险类型列表

## 核心特性说明

### 重复提交检测

在数据生成时，会自动在最后两条记录中创建重复提交案例：
- 第 n-1 条：正常预约
- 第 n 条：同一员工、同一日期、同一时段、同一线路的重复预约

### 摘要格式

异常记录的结论摘要格式：
```
培训环境清单异常检测：变更前【message: 预约成功, status: 成功】，变更后【message: 重复提交检测, status: 异常】，修正措施：已标记为重复提交，需人工复核，结论：确认为同一员工同一时段重复预约
```

### 差异报告字段

保留关键字段：
- `code` - 响应码
- `message` - 响应消息
- `status` - 状态
- `rule_version` - 规则版本

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI 应用入口
│   ├── models.py        # 数据模型
│   ├── schemas.py       # Pydantic 模式
│   ├── crud.py          # 数据库操作
│   ├── database.py      # 数据库连接
│   └── data_generator.py # 测试数据生成
├── requirements.txt     # 依赖列表
├── start.sh            # 启动脚本
└── README.md           # 项目说明
```

## 数据模型

1. **RuleVersion** - 规则版本表
2. **Batch** - 批次表
3. **BusReservation** - 班车预约表
4. **ComparisonResult** - 比对结果表
5. **CandidateList** - 候选清单表
6. **OperationLog** - 操作日志表

## 注意事项

1. 清理/回滚操作必须先创建候选清单并批准后才能执行
2. 规则版本变更不影响历史批次的判定口径
3. 所有数据持久化存储在 SQLite 数据库中
4. 异常路径和成功路径都可通过同一查询入口查询
