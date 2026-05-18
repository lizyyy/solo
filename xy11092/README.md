# 舞台灯光租赁店灯光设备套装 API

## 项目简介

这是一个为舞台灯光租赁店设计的灯光设备套装管理 API，支持套装的创建、查询、修改、导出，以及按日期、状态、负责人、门店等条件筛选。系统特别处理了套装拆借后的归还成套性检查，批量导入时不中断并提供行级结果。

## 技术栈

- Python 3.8+
- FastAPI
- SQLAlchemy
- SQLite
- pytest

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload
```

服务将在 `http://localhost:8000` 启动

### 3. 访问 API 文档

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 4. 导入样例数据（可选）

```bash
python import_samples.py
```

---

## API 操作指南

### 一、创建灯光设备套装

#### 1.1 创建单个套装

**接口**: `POST /lighting-sets/`

**请求示例**:
```json
{
  "set_code": "LIGHT-001",
  "set_name": "演唱会标准灯光套装",
  "store": "朝阳门店",
  "responsible_person": "张三",
  "status": "available",
  "daily_rental_price": 1500.0,
  "customer_name": null,
  "customer_phone": null,
  "event_name": null,
  "event_location": null,
  "remarks": "大型演出专用",
  "items": [
    {
      "item_code": "PAR-001",
      "item_name": "LED帕灯",
      "category": "面光灯",
      "brand": "珠江灯光",
      "model": "PR-5000",
      "quantity": 8,
      "unit_price": 2500.0,
      "status": "normal",
      "serial_number": "PAR2024001-PAR2024008",
      "condition_description": "全新设备"
    }
  ]
}
```

**字段说明**:
- `set_code`: 套装编号，唯一
- `set_name`: 套装名称
- `store`: 所属门店
- `responsible_person`: 负责人
- `status`: 状态 (available/rented/returned/maintenance/lent)
- `daily_rental_price`: 日租价格
- `items`: 设备清单

#### 1.2 批量导入套装

**接口**: `POST /lighting-sets/batch-import/`

**请求体**: 套装对象数组

**响应示例**:
```json
{
  "total": 3,
  "success": 2,
  "failed": 1,
  "results": [
    {
      "row": 1,
      "set_code": "LIGHT-001",
      "success": true,
      "set_id": 1,
      "warnings": [],
      "errors": []
    },
    {
      "row": 2,
      "set_code": "LIGHT-001",
      "success": false,
      "warnings": [],
      "errors": ["套装编号 LIGHT-001 已存在"]
    }
  ]
}
```

> ✅ **特性**: 批量导入时单条失败不影响其他数据，提供详细的行级结果和警告信息

---

### 二、修改灯光设备套装

#### 2.1 更新套装信息

**接口**: `PUT /lighting-sets/{lighting_set_id}`

**请求示例**:
```json
{
  "daily_rental_price": 1800.0,
  "remarks": "价格已更新",
  "items": [
    {
      "item_code": "PAR-001",
      "item_name": "LED帕灯",
      "category": "面光灯",
      "quantity": 6,
      "unit_price": 2500.0
    }
  ]
}
```

> ✅ **特性**: 更新设备清单时自动计算 `completeness_score` 完整性分数

#### 2.2 套装归还

**接口**: `PUT /lighting-sets/{lighting_set_id}/return`

**功能**: 将状态为 `rented` 或 `lent` 的套装标记为已归还

**请求参数**: `actual_return_date` (可选，ISO 格式日期)

**响应示例**:
```json
{
  "message": "归还成功",
  "completeness_score": 100.0,
  "warnings": [
    "设备 LED帕灯 状态异常: 灯泡不亮"
  ]
}
```

> ✅ **特性**: 归还时自动检查设备完整性和状态，给出警告信息

---

### 三、查询灯光设备套装

#### 3.1 获取所有套装（支持筛选）

**接口**: `GET /lighting-sets/`

**查询参数**:
| 参数 | 说明 | 示例 |
|------|------|------|
| `set_code` | 套装编号（模糊匹配） | LIGHT |
| `set_name` | 套装名称（模糊匹配） | 演唱会 |
| `store` | 门店（精确匹配） | 朝阳门店 |
| `responsible_person` | 负责人（精确匹配） | 张三 |
| `status` | 状态（精确匹配） | available |
| `start_date` | 创建日期起始 | 2024-01-01T00:00:00 |
| `end_date` | 创建日期截止 | 2024-12-31T23:59:59 |
| `customer_name` | 客户名称（模糊匹配） | 张先生 |
| `skip` | 跳过条数 | 0 |
| `limit` | 返回条数 | 100 |

**示例请求**:
```bash
# 查询朝阳门店所有可用套装
curl "http://localhost:8000/lighting-sets/?store=朝阳门店&status=available"

# 查询张三负责的所有已出租套装
curl "http://localhost:8000/lighting-sets/?responsible_person=张三&status=rented"
```

#### 3.2 获取单个套装详情

**接口**: `GET /lighting-sets/{lighting_set_id}`

---

### 四、导出灯光设备套装

#### JSON 格式导出

**接口**: `GET /lighting-sets/export/json`

**查询参数**: 与查询接口相同，支持所有筛选条件

**示例请求**:
```bash
# 导出朝阳门店所有数据
curl "http://localhost:8000/lighting-sets/export/json?store=朝阳门店"

# 导出所有已归还的套装
curl "http://localhost:8000/lighting-sets/export/json?status=returned"
```

---

### 五、删除灯光设备套装

**接口**: `DELETE /lighting-sets/{lighting_set_id}`

---

## 边界规则说明

### 1. 套装编号唯一性
- **规则**: `set_code` 在系统中必须唯一
- **影响**: 创建或批量导入时重复的编号会被拒绝
- **处理方式**: 返回错误信息，不中断其他数据的导入

### 2. 成套性检查
- **完整性分数 (completeness_score)**:
  - 新建时默认为 100%
  - 更新设备清单时，对比原始清单计算
  - 计算方式：`(匹配的设备数 / 原始设备数) × 100%`
  - 匹配条件：设备编码、设备名称、数量均相同

- **归还检查**:
  - 归还时检查完整性分数
  - 检查每个设备的状态是否为 `normal`
  - 发现异常时给出警告，但不阻止归还操作

### 3. 状态流转规则
| 当前状态 | 允许操作 | 目标状态 |
|----------|----------|----------|
| available | 出租 | rented |
| available | 拆借 | lent |
| rented | 归还 | returned |
| lent | 归还 | returned |
| returned | 检查后入库 | available |
| 任何状态 | 送修 | maintenance |
| maintenance | 维修完成 | available |

### 4. 批量导入规则
- **不中断原则**: 单条数据验证失败不影响其他数据
- **行级反馈**: 每条数据都有独立的成功/失败标记
- **警告机制**: 发现潜在问题（如设备数量少、设备损坏）时给出警告
- **已存在处理**: 套装编号已存在时标记为失败，给出明确错误

### 5. 设备状态定义
| 设备状态 | 说明 |
|----------|------|
| normal | 正常可用 |
| damaged | 已损坏 |
| maintenance | 维护中 |
| lost | 丢失 |

### 6. 套装状态定义
| 套装状态 | 说明 |
|----------|------|
| available | 可租用 |
| rented | 已出租 |
| returned | 已归还 |
| lent | 拆借中 |
| maintenance | 维护中 |

---

## 运行测试

所有测试可以通过一条命令运行：

```bash
pytest tests/test_api.py -v
```

测试失败时会明确显示是哪条规则未通过：

```
tests/test_api.py::test_rule_01_create_lighting_set_success PASSED
tests/test_api.py::test_rule_02_create_duplicate_set_code FAILED
tests/test_api.py::test_rule_03_query_by_store PASSED
```

### 测试规则清单

| 测试用例 | 验证规则 |
|----------|----------|
| test_rule_01 | 创建灯光设备套装成功 |
| test_rule_02 | 套装编号重复应失败 |
| test_rule_03 | 按门店筛选功能 |
| test_rule_04 | 按状态筛选功能 |
| test_rule_05 | 按负责人筛选功能 |
| test_rule_06 | 更新套装信息功能 |
| test_rule_07 | 更新设备清单影响完整性分数 |
| test_rule_08 | 批量导入部分成功不中断 |
| test_rule_09 | 批量导入时对不成套设备给出警告 |
| test_rule_10 | JSON格式导出功能 |
| test_rule_11 | 归还时检查完整性 |
| test_rule_12 | 删除灯光设备套装 |
| test_rule_13 | 按日期范围筛选 |

---

## 项目结构

```
.
├── main.py                 # FastAPI 主应用
├── app/
│   ├── __init__.py
│   ├── database.py         # 数据库配置
│   ├── models.py           # SQLAlchemy 模型
│   ├── schemas.py          # Pydantic 数据模式
│   └── crud.py             # 业务逻辑
├── tests/
│   ├── __init__.py
│   └── test_api.py         # 测试用例
├── sample_data/
│   └── sample_sets.json    # 样例数据
├── import_samples.py       # 样例数据导入脚本
├── requirements.txt        # 依赖列表
└── README.md               # 本文档
```

---

## 数据模型字段说明

### 灯光设备套装 (LightingSet)
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | Integer | 是 | 主键 |
| set_code | String(50) | 是 | 套装编号，唯一 |
| set_name | String(200) | 是 | 套装名称 |
| store | String(100) | 是 | 所属门店 |
| responsible_person | String(100) | 是 | 负责人 |
| status | String(50) | 是 | 状态 |
| total_value | Float | 否 | 总价值（自动计算） |
| daily_rental_price | Float | 是 | 日租价格 |
| created_date | DateTime | 否 | 创建时间 |
| last_updated | DateTime | 否 | 最后更新时间 |
| expected_return_date | DateTime | 否 | 预计归还日期 |
| actual_return_date | DateTime | 否 | 实际归还日期 |
| customer_name | String(200) | 否 | 客户名称 |
| customer_phone | String(50) | 否 | 客户电话 |
| event_name | String(200) | 否 | 活动名称 |
| event_location | String(300) | 否 | 活动地点 |
| remarks | Text | 否 | 备注 |
| completeness_score | Float | 否 | 完整性分数 |

### 套装设备项 (LightingSetItem)
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | Integer | 是 | 主键 |
| lighting_set_id | Integer | 是 | 所属套装ID |
| item_code | String(50) | 是 | 设备编码 |
| item_name | String(200) | 是 | 设备名称 |
| category | String(100) | 是 | 设备类别 |
| brand | String(100) | 否 | 品牌 |
| model | String(100) | 否 | 型号 |
| quantity | Integer | 是 | 数量 |
| unit_price | Float | 是 | 单价 |
| status | String(50) | 是 | 设备状态 |
| serial_number | String(200) | 否 | 序列号 |
| purchase_date | DateTime | 否 | 采购日期 |
| last_maintenance_date | DateTime | 否 | 最后维护日期 |
| condition_description | Text | 否 | 状态描述 |
