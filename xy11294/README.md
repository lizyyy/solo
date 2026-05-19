# 会展设备租赁管理系统

用于管理桁架、灯具、屏幕等会展设备的借用、调拨、归还和损耗的管理系统。

## 功能特性

- **设备管理**: 创建设备、查看库存
- **核心操作**: 导入、占用、调拨、归还、损耗
- **幂等性保证**: 重复提交不会重复计算
- **批量操作**: 支持批量处理，失败重试不影响已成功记录
- **审计日志**: 所有操作都有完整的审计记录
- **筛选查询**: 按负责人、时间、状态、异常类型筛选
- **报告导出**: 支持导出 Excel/CSV 格式报告

## 技术栈

- **Web框架**: FastAPI
- **数据库**: SQLite
- **ORM**: SQLAlchemy
- **CLI**: Click
- **数据处理**: Pandas + OpenPyXL

## 安装依赖

```bash
pip install fastapi uvicorn sqlalchemy pydantic python-multipart pandas openpyxl click python-dotenv
```

或使用 poetry:

```bash
poetry install
```

## 启动服务

### Web API 方式

```bash
python main.py
```

然后访问: http://localhost:8000/docs 查看 API 文档

### CLI 命令行方式

```bash
# 查看帮助
python -m src.cli --help

# 设备管理
python -m src.cli equipment create TRUSS001 "400mm桁架" truss 100 根
python -m src.cli equipment list

# 操作示例
python -m src.cli operation import IMP001 TRUSS001 50 张三 manager
python -m src.cli operation occupy OCC001 TRUSS001 10 张三 manager A1
python -m src.cli operation transfer TRA001 TRUSS001 5 张三 manager A1 A2
python -m src.cli operation return RET001 TRUSS001 3 张三 manager A1
python -m src.cli operation loss LOS001 TRUSS001 1 张三 manager --booth A1 --loss_reason "损坏"

# 查询和报告
python -m src.cli operation query --operator 张三
python -m src.cli report stock
python -m src.cli report summary
python -m src.cli report export report.xlsx --format xlsx
```

## 核心 API 接口

### 设备管理
- `POST /equipment/` - 创建设备
- `GET /equipment/` - 获取所有设备
- `GET /equipment/{code}` - 获取单个设备

### 操作接口
- `POST /operations/import/` - 导入设备
- `POST /operations/occupy/` - 占用设备
- `POST /operations/transfer/` - 调拨设备
- `POST /operations/return/` - 归还设备
- `POST /operations/loss/` - 记录损耗
- `POST /operations/batch/` - 批量操作

### 查询和报告
- `GET /operations/` - 查询操作记录
- `GET /operations/summary/` - 获取统计摘要
- `GET /report/export/` - 导出报告
- `GET /stock/current/` - 当前库存
- `GET /stock/export/` - 导出库存快照

### 审计
- `GET /audit/{record_id}/` - 获取审计日志

## 字段说明

### 角色 (RoleType)
- `manager` - 经理
- `operator` - 操作员
- `auditor` - 审计员

### 设备类型 (EquipmentType)
- `truss` - 桁架
- `light` - 灯具
- `screen` - 屏幕

### 操作类型 (OperationType)
- `import` - 导入
- `occupy` - 占用
- `transfer` - 调拨
- `return` - 归还
- `loss` - 损耗

### 异常类型 (ExceptionType)
- `none` - 无异常
- `duplicate` - 重复请求
- `insufficient_stock` - 库存不足
- `invalid_equipment` - 无效设备
- `invalid_quantity` - 无效数量
- `not_found` - 未找到

## 批量操作示例

创建 batch_operations.json 文件:

```json
[
    {
        "request_id": "BATCH001",
        "equipment_code": "TRUSS001",
        "quantity": 10,
        "operator": "张三",
        "role": "manager",
        "operation_type": "occupy",
        "booth": "A1"
    },
    {
        "request_id": "BATCH002",
        "equipment_code": "LIGHT001",
        "quantity": 20,
        "operator": "张三",
        "role": "manager",
        "operation_type": "occupy",
        "booth": "A2"
    }
]
```

执行批量操作:

```bash
python -m src.cli operation batch batch_operations.json
```
