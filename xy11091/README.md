# 养老院药事组养老药品盘点 API

## 项目概述

本项目专为养老院药事组设计，提供完整的药品盘点管理REST API接口。重点解决后续追责和复盘没有依据的问题，确保数据一致性和可追溯性。

## 核心功能

### 1. 药品管理
- 药品信息CRUD操作
- 包含药品编码、名称、规格、剂型、生产厂家、批号、有效期、储存条件、分类等字段

### 2. 库存管理
- 库存数量跟踪
- 存放位置管理
- 上次盘点记录

### 3. 医嘱管理
- 老人用药医嘱记录
- 停药流程管理
- **停药医嘱库存同步检查（核心功能）

### 4. 盘点管理
- 创建盘点单（日盘/周盘/月盘/临时盘）
- 盘点明细录入和修改
- 账实差异分析
- 盘点确认和库存同步

### 5. 操作日志
- 完整记录所有操作
- 记录操作人、操作时间、原始数据、新数据、变更字段
- 支持按业务类型、业务ID查询

## 技术栈

- **Web框架**: FastAPI
- **ORM**: SQLAlchemy
- **数据库**: SQLite（可扩展）
- **测试**: pytest

## 项目结构

```
.
├── main.py                 # 主应用文件，包含所有API接口
├── models.py               # 数据模型定义
├── schemas.py              # Pydantic模式定义
├── database.py             # 数据库配置
├── init_data.py            # 初始化样本数据
├── test_pharmacy.py        # 测试用例
├── demo_acceptance.py       # 验收演示脚本
├── requirements.txt         # 依赖包列表
└── README.md                # 项目说明文档
```

## API接口

### 药品接口
- `POST /medicines/` - 创建药品
- `GET /medicines/` - 获取药品列表
- `GET /medicines/{id}` - 获取单个药品
- `PUT /medicines/{id}` - 更新药品（带版本检查）

### 库存接口
- `POST /inventories/` - 创建库存记录
- `GET /inventories/` - 获取库存列表

### 医嘱接口
- `POST /doctor-orders/` - 创建医嘱
- `GET /doctor-orders/` - 获取医嘱列表
- `PUT /doctor-orders/{id}/stop` - 停药
- `PUT /doctor-orders/{id}/sync-inventory` - 同步停药医嘱到库存

### 盘点接口
- `POST /inventory-checks/` - 创建盘点单（自动检查停药医嘱同步状态）
- `GET /inventory-checks/` - 获取盘点列表
- `GET /inventory-checks/{id}` - 获取单个盘点
- `PUT /inventory-checks/{id}/details/{detail_id}` - 更新盘点明细（带版本检查）
- `POST /inventory-checks/{id}/confirm` - 确认盘点

### 其他接口
- `POST /import/validate/` - 导入数据验证
- `GET /operation-logs/` - 查询操作日志

## 核心特性

### 1. 乐观锁机制（防止静默覆盖）
所有更新操作都需要传递当前版本号，版本不匹配时返回409冲突错误，确保：
- 不会静默覆盖他人修改
- 操作历史可追溯

### 2. 停药医嘱同步检查
创建盘点单前自动检查是否存在未同步库存的停药医嘱，存在则拒绝创建并提示处理。

### 3. 中文错误返回
所有错误都返回清晰的中文信息，包含：
- 错误码（如 `VERSION_CONFLICT`, `UNSYNCED_STOPPED_ORDERS`）
- 错误信息（中文描述）
- 错误详情（具体数据）
- 时间戳

### 4. 完整操作日志
所有修改操作都记录完整日志，包含：
- 操作类型
- 业务类型
- 操作人
- 原始数据
- 新数据
- 变更字段

## 快速开始

### 安装依赖
```bash
pip install fastapi uvicorn sqlalchemy pydantic python-multipart pytest httpx
```

### 初始化数据
```bash
python init_data.py
```

### 启动服务
```bash
uvicorn main:app --reload
```

访问 http://localhost:8000/docs 查看API文档

### 运行测试
```bash
pytest test_pharmacy.py -v
```

### 运行验收演示
```bash
python demo_acceptance.py
```

## 验收要点

### ✅ 1. 正常记录创建
- 创建药品盘点单成功
- 包含完整的药品信息和库存信息

### ✅ 2. 冲突记录检测
- 同一记录被两人修改时，第二人使用旧版本号会被拒绝
- 返回清晰的版本冲突错误

### ✅ 3. 导入坏行验证
- 导入数据时验证药品编码是否存在
- 验证数量是否为非负整数
- 返回具体的错误行信息

### ✅ 4. 历史顺序稳定
- 操作日志按时间倒序排列
- 每条记录包含完整的变更前后数据
- 可追溯每个操作的操作人

### ✅ 5. 停药医嘱同步检查
- 存在未同步的停药医嘱时，拒绝创建盘点单
- 提示需要先处理的医嘱列表

## 错误响应示例

```json
{
  "success": false,
  "error_code": "VERSION_CONFLICT",
  "error_message": "记录已被其他用户修改，请刷新后重试",
  "error_details": {
    "current_version": 1,
    "latest_version": 2
  },
  "timestamp": "2024-05-18T12:00:00.000Z"
}
```

## 数据模型说明

### Medicine（药品）
- 药品编码、名称、通用名、规格、剂型、生产厂家
- 批号、有效期、储存条件、分类
- 创建时间、更新时间、版本号

### Inventory（库存）
- 药品ID、数量、单位、存放位置
- 上次盘点时间、上次盘点人
- 创建时间、更新时间、版本号

### DoctorOrder（医嘱）
- 医嘱单号、老人姓名、身份证号、房间号
- 药品ID、药品名称、剂量、频次
- 开始日期、结束日期、是否停药
- 停药时间、停医嘱人、停药原因
- 库存是否已同步、创建人
- 创建时间、更新时间、版本号

### InventoryCheck（盘点单）
- 盘点单号、盘点类型、盘点日期
- 盘点人、监盘人、盘点区域
- 总品项数、账实相符数、账实不符数
- 状态、备注、确认人、确认时间
- 创建人、创建时间、更新时间、版本号

### InventoryCheckDetail（盘点明细）
- 盘点ID、药品ID
- 药品编码、药品名称、规格、批号
- 系统库存数量、实际盘点数量、差异数量、差异原因
- 是否账实相符、盘点人、盘点时间
- 创建时间、更新时间

### OperationLog（操作日志）
- 操作类型、业务类型、业务ID、业务编号
- 操作人、操作时间
- 原始数据、新数据、变更字段
- IP地址、User Agent、创建时间

## 后续可追溯！
