# 会展物料管理系统

一个真正可落地的会展物料管理后端系统，支持物料导入、调拨、占用、归还、损耗报告等完整流程，解决多个展位同时借桁架、灯具和屏幕，现场改动后总账对不上的问题。

## 功能特性

- ✅ **物料管理**: 桁架、灯具、屏幕、其他物料分类管理
- ✅ **导入功能**: CSV物料导入、YAML调拨单导入、CSV归还记录导入
- ✅ **错误处理**: 坏数据不吞掉，保留原始位置、失败原因和修改建议
- ✅ **状态管理**: 物料占用、调拨、归还的完整状态变更
- ✅ **本地持久化**: SQLite数据库，重启服务数据不丢失
- ✅ **历史记录**: 完整的库存变更日志
- ✅ **报告生成**: 库存报告、损耗报告、总账对账报告

## 技术栈

- **框架**: FastAPI
- **ORM**: SQLAlchemy
- **数据库**: SQLite
- **数据格式**: CSV, YAML

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务启动后访问: http://localhost:8000

API文档地址: http://localhost:8000/docs

## 完整操作流程

### 第一步：导入物料（CSV）

使用 `sample_materials.csv` 导入物料基础数据。

**API接口**: `POST /api/import/materials/csv/`

**使用示例**:

```bash
# 使用curl上传
curl -X POST -F "file=@sample_materials.csv" http://localhost:8000/api/import/materials/csv/

# 查看导入结果
curl http://localhost:8000/api/materials/
```

**CSV文件格式**:

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| material_code | 是 | 物料编码（唯一） | TRUSS-001 |
| name | 是 | 物料名称 | 铝合金桁架 |
| type | 是 | 物料类型 | 桁架/灯具/屏幕/其他 |
| specification | 否 | 规格 | 300x300mm |
| quantity_total | 是 | 总数量 | 100 |
| quantity_available | 是 | 可用数量 | 100 |
| unit | 否 | 单位 | 根/台/块 |
| location | 否 | 存放位置 | A仓库 |
| remark | 否 | 备注 | 标准桁架 |

### 第二步：导入错误测试（验证错误处理）

使用 `sample_materials_with_errors.csv` 测试错误处理功能。

```bash
curl -X POST -F "file=@sample_materials_with_errors.csv" http://localhost:8000/api/import/materials/csv/

# 查看导入错误记录
curl http://localhost:8000/api/import-errors/
```

系统会记录：
- 原始数据
- 行号
- 错误原因
- 修改建议

### 第三步：创建展位

创建展位信息，用于后续调拨。

```bash
# 使用初始化脚本（推荐）
python init_test_data.py

# 或手动创建
curl -X POST http://localhost:8000/api/booths/ \
  -H "Content-Type: application/json" \
  -d '{
    "booth_number": "B-001",
    "company_name": "科技有限公司",
    "contact_person": "张经理",
    "contact_phone": "13800138001"
  }'
```

### 第四步：物料调拨（占用）

#### 方式一：使用YAML调拨单导入

使用 `sample_transfer_order.yaml` 导入调拨单。

```bash
curl -X POST -F "file=@sample_transfer_order.yaml" http://localhost:8000/api/import/transfer-orders/yaml/

# 查看调拨单
curl http://localhost:8000/api/transfer-orders/
```

**YAML格式**:

```yaml
order_code: TO-2024-001
source_location: A仓库
target_location: 1号展位
operator: 张三
approver: 李四
remark: 春季会展第一批物料调拨
items:
  - material_code: TRUSS-001
    quantity: 20
  - material_code: LIGHT-001
    quantity: 50
```

#### 方式二：直接创建调拨记录

```bash
curl -X POST http://localhost:8000/api/allocations/ \
  -H "Content-Type: application/json" \
  -d '{
    "allocation_code": "ALLOC-001",
    "booth_id": 1,
    "material_id": 1,
    "quantity": 20,
    "operator": "张三",
    "remark": "1号展位借桁架"
  }'
```

### 第五步：复核调拨

查看各展位的物料分配情况。

```bash
# 查看展位分配报告
curl http://localhost:8000/api/reports/booth-allocations

# 查看库存报告（验证数量是否正确扣减）
curl http://localhost:8000/api/reports/inventory

# 查看库存变更日志
curl http://localhost:8000/api/inventory-logs/
```

### 第六步：物料归还

使用 `sample_returns.csv` 导入归还记录。

```bash
curl -X POST -F "file=@sample_returns.csv" http://localhost:8000/api/import/returns/csv/
```

**归还CSV格式**:

| 字段 | 必填 | 说明 |
|------|------|------|
| allocation_code | 是 | 调拨记录编码 |
| quantity_returned | 是 | 归还数量 |
| quantity_damaged | 否 | 损坏数量 |
| operator | 否 | 操作人 |
| remark | 否 | 备注 |

### 第七步：查看损耗报告

```bash
# 损耗报告
curl http://localhost:8000/api/reports/loss

# 总账对账（核心！确保账目平衡）
curl http://localhost:8000/api/reports/general-ledger
```

### 第八步：重启服务验证持久化

```bash
# 停止服务（Ctrl+C）
# 重新启动
python main.py

# 验证数据是否保留
curl http://localhost:8000/api/materials/
curl http://localhost:8000/api/allocations/
curl http://localhost:8000/api/reports/general-ledger
```

## API接口汇总

### 物料管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/materials/` | 获取物料列表 |
| GET | `/api/materials/{id}` | 获取单个物料 |
| POST | `/api/materials/` | 创建物料 |
| POST | `/api/import/materials/csv/` | CSV导入物料 |

### 展位管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/booths/` | 获取展位列表 |
| POST | `/api/booths/` | 创建展位 |

### 调拨管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/allocations/` | 获取调拨记录 |
| POST | `/api/allocations/` | 创建调拨记录 |
| POST | `/api/allocations/{id}/return` | 归还物料 |
| POST | `/api/import/returns/csv/` | CSV导入归还记录 |

### 调拨单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/transfer-orders/` | 获取调拨单列表 |
| POST | `/api/transfer-orders/` | 创建调拨单 |
| POST | `/api/transfer-orders/{id}/approve` | 审批调拨单 |
| POST | `/api/transfer-orders/{id}/complete` | 完成调拨单 |
| POST | `/api/import/transfer-orders/yaml/` | YAML导入调拨单 |

### 报告与查询

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reports/inventory` | 库存报告 |
| GET | `/api/reports/loss` | 损耗报告 |
| GET | `/api/reports/general-ledger` | 总账对账报告 |
| GET | `/api/reports/booth-allocations` | 展位分配报告 |
| GET | `/api/inventory-logs/` | 库存变更日志 |
| GET | `/api/import-errors/` | 导入错误记录 |

## 数据模型

### 核心实体关系

```
物料 (Material) ──1:n──> 调拨记录 (Allocation) ──n:1──> 展位 (Booth)
    │
    ├──1:n──> 归还记录 (ReturnRecord)
    │
    ├──1:n──> 损耗记录 (LossRecord)
    │
    └──1:n──> 库存日志 (InventoryLog)

调拨单 (TransferOrder) ──1:n──> 调拨单项 (TransferItem)
```

### 物料类型

- 桁架 (TRUSS): 300x300mm、400x400mm等规格
- 灯具 (LIGHT): LED帕灯、摇头灯等
- 屏幕 (SCREEN): P3、P4、户外屏等
- 其他 (OTHER): 电源箱、线缆等配件

## 示例数据说明

| 文件 | 说明 | 用途 |
|------|------|------|
| `sample_materials.csv` | 正常物料数据 | 基础导入测试 |
| `sample_materials_with_errors.csv` | 含错误的物料数据 | 错误处理测试 |
| `sample_transfer_order.yaml` | 调拨单示例 | 调拨流程测试 |
| `sample_returns.csv` | 归还记录示例 | 归还流程测试 |

## 错误处理说明

系统不会直接丢弃坏数据，而是记录完整的错误信息：

1. **原始数据**: 完整保留导入的原始内容
2. **行号定位**: 精确到CSV/YAML的哪一行出错
3. **错误原因**: 详细说明错误类型（必填缺失、格式错误、数量异常等）
4. **修改建议**: 针对每种错误给出具体修改建议

查看导入错误:

```bash
curl http://localhost:8000/api/import-errors/?batch_id=BATCH_XXX
```

## 常见问题

### Q: 重启服务后数据会丢失吗？
A: 不会！数据存储在SQLite数据库文件 `exhibition_materials.db` 中。

### Q: 导入失败后如何查看原因？
A: 调用 `/api/import-errors/` 接口查看所有导入错误记录。

### Q: 如何验证总账是否平衡？
A: 调用 `/api/reports/general-ledger/` 查看 `is_balanced` 字段。

### Q: 支持哪些编码格式？
A: CSV导入支持UTF-8和GBK编码，系统会自动检测。

## 项目结构

```
.
├── main.py                 # FastAPI主应用
├── models.py               # 数据模型
├── schemas.py              # Pydantic模式
├── crud.py                 # 业务逻辑
├── database.py             # 数据库配置
├── import_service.py       # 导入服务
├── init_test_data.py       # 测试数据初始化
├── requirements.txt        # 依赖列表
├── sample_materials.csv    # 物料示例（正常）
├── sample_materials_with_errors.csv  # 物料示例（含错）
├── sample_transfer_order.yaml       # 调拨单示例
├── sample_returns.csv      # 归还记录示例
└── exhibition_materials.db # SQLite数据库（运行后生成）
```

## 开发说明

### 运行开发服务器

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 重置数据库

删除 `exhibition_materials.db` 文件，重启服务会自动创建新的数据库。

```bash
rm exhibition_materials.db
python main.py
```
