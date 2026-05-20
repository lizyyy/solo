# 银行网点尾箱交接API服务

## 项目概述

本系统是为银行网点运营主管设计的尾箱交接管理API服务，支持材料提交、数据分类、任务状态管理、审计追踪和字段追溯等功能。

## 核心功能

### 1. 数据分类
- **正常**：数据校验通过，所有字段完整
- **待补充**：缺少必填字段，需补充后重新提交
- **已拦截**：存在严重问题（尾箱编号重复、双人确认失败、跨日原因缺失等）

### 2. 任务状态
- **处理中**：任务刚提交，正在处理
- **处理失败**：数据存在严重问题，已拦截
- **人工确认**：需要人工审核或补充信息
- **已导出**：处理完成，已导出报告

### 3. 审计追踪
- 记录谁改过结论
- 记录为什么改
- 记录改动前的值
- 记录改动后的值

### 4. 字段追溯
- 尾箱编号、尾箱金额、交接日期、交接人等关键字段
- 从原始输入追到最终报告
- 完整的追溯路径记录

### 5. 尾箱交接关键信息
- 双人确认记录（交接人不能相同）
- 尾箱金额记录
- 差错编号记录
- 跨日交接必须标注上一班未闭合原因

## 项目结构

```
zy70899/
├── main.py              # FastAPI主应用，API端点定义
├── models.py            # SQLAlchemy数据模型
├── schemas.py           # Pydantic请求/响应模型
├── services.py          # 业务逻辑处理服务
├── database.py          # 数据库连接配置
├── test_api.py          # API测试脚本
├── requirements.txt     # 依赖包列表
└── README.md            # 项目说明文档
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动。

### 3. 访问API文档

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 4. 运行测试

```bash
python test_api.py
```

## API端点说明

### 尾箱交接管理

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | /api/handovers | 提交尾箱交接材料 |
| GET | /api/handovers | 查询交接任务列表 |
| GET | /api/handovers/{task_id} | 查询单个任务详情 |
| PUT | /api/handovers/{task_id}/status | 更新任务状态 |
| POST | /api/handovers/{task_id}/conclusion | 修改结论（记录审计日志） |
| GET | /api/handovers/{task_id}/audit-logs | 查询审计日志 |
| GET | /api/handovers/{task_id}/field-traces | 查询字段追溯信息 |
| GET | /api/handovers/{task_id}/raw-data | 查询原始材料 |

### 枚举查询

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /api/statuses | 获取所有任务状态 |
| GET | /api/categories | 获取所有数据分类 |

## 使用示例

### 提交正常交接

```bash
curl -X POST "http://localhost:8000/api/handovers" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id": "B001",
    "branch_name": "朝阳支行",
    "handover_date": "2024-01-15T09:00:00",
    "handover_type": "晚班",
    "box_no": "BOX2024001",
    "box_amount": 50000.00,
    "handler1_id": "H001",
    "handler1_name": "张三",
    "handler2_id": "H002",
    "handler2_name": "李四",
    "is_cross_day": 0,
    "raw_data_position": "系统A-尾箱交接表第3行",
    "created_by": "主管A"
  }'
```

### 跨日交接（必须提供未闭合原因）

```bash
curl -X POST "http://localhost:8000/api/handovers" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id": "B001",
    "handover_date": "2024-01-15T18:00:00",
    "handover_type": "跨日",
    "box_no": "BOX2024002",
    "box_amount": 75000.00,
    "handler1_id": "H003",
    "handler1_name": "王五",
    "handler2_id": "H004",
    "handler2_name": "赵六",
    "is_cross_day": 1,
    "previous_unclosed_reason": "尾箱金额与系统记录有差异，需次日核对",
    "error_no": "ERR001",
    "raw_data_position": "系统A-尾箱交接表第5行",
    "created_by": "主管B"
  }'
```

### 修改结论

```bash
curl -X POST "http://localhost:8000/api/handovers/{task_id}/conclusion" \
  -H "Content-Type: application/json" \
  -d '{
    "field_changed": "category",
    "old_value": "待补充",
    "new_value": "正常",
    "change_reason": "已补充尾箱编号字段，数据完整",
    "changed_by_id": "A001",
    "changed_by_name": "审核员A"
  }'
```

## 数据校验规则

1. **必填字段检查**：branch_id, handover_date, box_no, box_amount, handler1_id/name, handler2_id/name
2. **双人确认检查**：交接人1和交接人2不能相同
3. **尾箱编号重复检查**：同一天同一尾箱编号不能重复
4. **金额检查**：尾箱金额不能为负数
5. **跨日交接检查**：is_cross_day=1时必须提供previous_unclosed_reason

## 错误明细格式

当数据分类为"待补充"或"已拦截"时，error_details字段会包含：
- 原始材料位置（便于回溯）
- 具体错误描述或缺失字段列表

## 数据库

系统使用SQLite数据库（`teller_box.db`），包含以下表：

1. **teller_box_handovers**：尾箱交接主表
2. **audit_logs**：审计日志表
3. **field_traces**：字段追溯表

如需切换到其他数据库（如MySQL、PostgreSQL），请修改`database.py`中的连接配置。
