# 高校实验室试剂管理系统

一个真正可用的后端服务，解决高校实验室试剂领用乱账问题，整合了库存校验、危险等级审批、状态流转和报告导出功能。

## 核心特性

- ✅ **三级校验机制**: 库存校验、危险等级校验、过期校验
- ✅ **批量操作**: 支持批量导入、批量审批，精确区分成功/失败记录
- ✅ **失败重试**: 重试不破坏已成功记录，仅重新校验失败项
- ✅ **多维度筛选**: 按负责人、时间、状态、异常类型筛选
- ✅ **Excel导出**: 导出与查询结果一致的完整报告
- ✅ **状态机流转**: pending → approved/rejected → dispensed → returned

## 快速开始

### 1. 环境准备

```bash
# 创建虚拟环境（可选）
python3 -m venv venv
source venv/bin/activate  # Mac/Linux

# 安装依赖
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python3 -m uvicorn main:app --host 0.0.0.0 --port 8001

# 服务将在 http://localhost:8001 启动
```

### 3. 访问 API 文档

- Swagger UI: http://localhost:8001/docs
- ReDoc: http://localhost:8001/redoc

### 4. 初始化测试数据（可选）

```bash
# 新开一个终端，执行
pip install requests
python init_data.py
```

测试数据包含：
- 4个用户：2位老师、1位学生、1位管理员
- 6种试剂：涵盖低/中/高/极高危险等级，包含过期试剂
- 6条领用记录：3条正常 + 3条异常（用于测试校验功能）

## 核心流程

### 流程一：批量导入领用记录

```bash
# 方式一：通过 API 调用
POST /api/records/batch/

# 请求体示例
{
  "records": [
    {"reagent_id": 1, "quantity": 2, "recipient_id": 3, "purpose": "实验用途"},
    {"reagent_id": 2, "quantity": 1, "recipient_id": 3, "purpose": "实验用途"}
  ],
  "created_by_id": 4
}

# 返回示例
{
  "batch_id": "batch_abc123",
  "total_count": 2,
  "success_count": 1,
  "failed_count": 1,
  "success_ids": [10],
  "failed_items": [
    {"index": 1, "exception_type": "insufficient_stock", "message": "..."}
  ]
}
```

### 流程二：重试失败记录

```bash
POST /api/records/batch/{batch_id}/retry

# 仅会重试该批次中状态为 rejected 的记录
# 已成功的记录不会被修改
```

### 流程三：批量审批

```bash
POST /api/records/batch/approve

# 请求体
{
  "record_ids": [1, 2, 3],
  "approved_by_id": 1,
  "approved": true
}
```

### 流程四：发放试剂

```bash
PUT /api/records/{record_id}/dispense?dispensed_by_id=4

# 发放时会再次校验库存并自动扣减
```

### 流程五：查询与导出

```bash
# 查询记录（支持多条件筛选）
GET /api/records/?status=pending&exception_type=insufficient_stock&page=1&page_size=20

# 导出 Excel
GET /api/records/export?status=approved&start_date=2024-01-01
```

## 数据模型

### 用户 (users)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| name | String | 姓名 |
| employee_id | String | 工号（唯一） |
| role | Enum | student/teacher/admin |
| department | String | 部门 |

### 试剂 (reagents)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| name | String | 试剂名称 |
| hazard_level | Enum | low/medium/high/extreme |
| total_stock | Float | 总库存 |
| available_stock | Float | 可用库存 |
| unit | String | 单位 |
| expiry_date | DateTime | 过期时间 |

### 领用记录 (reagent_records)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| reagent_id | Integer | 试剂ID |
| quantity | Float | 数量 |
| recipient_id | Integer | 领用人ID |
| status | Enum | pending/approved/rejected/dispensed |
| exception_type | Enum | 异常类型 |
| exception_message | String | 异常详情 |
| batch_id | String | 批次ID |

## 校验规则

### 1. 库存校验
- 领用数量 > 可用库存 → 失败 (insufficient_stock)

### 2. 危险等级校验
- high/extreme 等级 → 仅 teacher 可领用
- 学生领用高危试剂 → 失败 (hazard_approval_required)

### 3. 过期校验
- 试剂已过期 → 失败 (expired_reagent)

## 异常类型说明

| 异常类型 | 说明 |
|----------|------|
| none | 无异常 |
| insufficient_stock | 库存不足 |
| hazard_approval_required | 危险等级需审批 |
| invalid_recipient | 领用人无效 |
| expired_reagent | 试剂过期 |
| duplicate_record | 重复记录 |
| system_error | 系统错误 |

## 项目结构

```
.
├── main.py                 # 应用入口
├── requirements.txt        # 依赖清单
├── init_data.py           # 测试数据初始化
├── app/
│   ├── __init__.py
│   ├── database.py       # 数据库配置
│   ├── models.py         # 数据模型
│   ├── schemas.py        # Pydantic 模式
│   ├── services.py       # 业务逻辑（校验、状态流转）
│   ├── api.py            # API 路由
│   └── export.py         # Excel 导出功能
└── README.md
```

## API 端点一览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/users/ | 创建用户 |
| GET | /api/users/ | 获取用户列表 |
| POST | /api/reagents/ | 创建试剂 |
| GET | /api/reagents/ | 获取试剂列表 |
| POST | /api/records/ | 单条创建领用记录 |
| POST | /api/records/batch/ | 批量创建领用记录 |
| POST | /api/records/batch/{id}/retry | 重试批次失败记录 |
| PUT | /api/records/{id}/approve | 单条审批 |
| POST | /api/records/batch/approve | 批量审批 |
| PUT | /api/records/{id}/dispense | 发放试剂 |
| GET | /api/records/ | 查询领用记录 |
| GET | /api/records/export | 导出 Excel |

## 使用示例

### 示例1：查看所有异常记录

```bash
# 通过浏览器访问
http://localhost:8000/api/records/?exception_type=hazard_approval_required
```

### 示例2：导出所有审批通过的记录

```bash
# 在浏览器中直接打开即可下载 Excel
http://localhost:8000/api/records/export?status=approved
```

### 示例3：查看某个学生的所有领用记录

```bash
http://localhost:8000/api/records/?recipient_id=3
```
