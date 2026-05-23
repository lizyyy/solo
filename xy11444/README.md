# 生鲜分拣损耗权限追责台账 API

从供应商送货单、称重记录、退筐照片和二次确认单建账，支持草稿、提交、驳回、二次确认、只读审计、脱敏导出全流程状态管理。

## 功能特性

- **多数据源建账**：支持供应商送货单、称重记录、退筐照片、二次确认单四种数据源
- **完整状态流转**：草稿 → 提交 → 驳回 → 二次确认 → 只读审计
- **严格权限控制**：分拣员、主管、采购经理、审计员、管理员五级角色权限
- **完整审计追踪**：每次状态变化记录时间、操作者、原因
- **数据校验隔离**：坏数据不进汇总，在失败列表可查原因
- **版本追溯**：支持修改留痕，历史版本可查
- **重复检测**：自动检测重复损耗记录
- **脱敏导出**：敏感字段自动脱敏处理

## 技术栈

- Python 3.10+
- FastAPI 0.104+
- SQLAlchemy 2.0+
- SQLite (默认，可替换)
- Pandas + OpenPyXL (导出Excel)

## 快速开始

### 1. 环境准备

```bash
# 复制环境变量配置
cp .env.example .env

# 安装依赖（使用pip作为备用方案）
pip install fastapi uvicorn sqlalchemy pydantic python-dotenv python-multipart pandas openpyxl python-jose passlib bcrypt python-multipart pytest httpx
```

### 2. 启动服务

```bash
# 从空库启动（首次启动自动建表和初始化用户）
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

访问 http://localhost:8000/docs 查看API文档

### 3. 初始化用户

系统启动时自动创建以下测试用户：

| 用户名 | 密码 | 角色 |
|--------|------|------|
| sorter1 | 123456 | 分拣员 |
| supervisor1 | 123456 | 主管 |
| manager1 | 123456 | 采购经理 |
| auditor1 | 123456 | 审计员 |
| admin1 | 123456 | 管理员 |

## 主流程演示

### 步骤1：获取Token

```bash
# 分拣员登录
curl -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=sorter1&password=123456"
```

保存返回的 `access_token`。

### 步骤2：创建台账（草稿）

```bash
curl -X POST "http://localhost:8000/ledger" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": "SUP001",
    "supplier_name": "优质果蔬供应商",
    "batch_no": "BATCH20240101001",
    "product_name": "红富士苹果",
    "total_weight": 100.0,
    "loss_weight": 5.0,
    "loss_type": "bad_fruit",
    "remark": "到货分拣损耗",
    "data_sources": [
      {
        "source_type": "supplier_delivery",
        "source_no": "DEL20240101001",
        "source_data": "{\"delivery_no\":\"DEL20240101001\",\"supplier_id\":\"SUP001\",\"delivery_date\":\"2024-01-01\"}"
      },
      {
        "source_type": "weighing_record",
        "source_no": "WEIGH20240101001",
        "source_data": "{\"weighing_no\":\"WEIGH20240101001\",\"weighing_time\":\"2024-01-01 08:00:00\",\"operator\":\"张三\"}"
      },
      {
        "source_type": "basket_return_photo",
        "source_no": "PHOTO20240101001",
        "source_data": "{\"photo_no\":\"PHOTO20240101001\",\"upload_time\":\"2024-01-01 09:00:00\",\"uploader\":\"张三\"}"
      }
    ],
    "loss_items": [
      {
        "item_no": "ITEM001",
        "product_name": "红富士苹果",
        "weight": 3.0,
        "loss_reason": "表面碰伤",
        "source_type": "supplier_delivery",
        "deduplication_key": "ITEM001-红富士苹果-3.0-表面碰伤"
      },
      {
        "item_no": "ITEM002",
        "product_name": "红富士苹果",
        "weight": 2.0,
        "loss_reason": "腐烂变质",
        "source_type": "weighing_record",
        "deduplication_key": "ITEM002-红富士苹果-2.0-腐烂变质"
      }
    ]
  }'
```

### 步骤3：提交审核

```bash
curl -X POST "http://localhost:8000/ledger/{ledger_id}/submit" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"change_reason": "数据核对无误，提交主管审核"}'
```

### 步骤4：主管审核（驳回）

使用主管账号登录获取token后：

```bash
curl -X POST "http://localhost:8000/ledger/{ledger_id}/reject" \
  -H "Authorization: Bearer SUPERVISOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"change_reason": "损耗原因描述不够详细，请补充具体损坏程度和照片说明"}'
```

### 步骤5：修改后重新提交

分拣员修改台账后重新提交：

```bash
curl -X PUT "http://localhost:8000/ledger/{ledger_id}" \
  -H "Authorization: Bearer SORTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"remark": "已补充照片说明，碰伤面积约1/3，腐烂程度为中度腐烂"}'

curl -X POST "http://localhost:8000/ledger/{ledger_id}/submit" \
  -H "Authorization: Bearer SORTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"change_reason": "已补充详细说明，重新提交审核"}'
```

### 步骤6：二次确认

```bash
curl -X POST "http://localhost:8000/ledger/{ledger_id}/secondary-confirm" \
  -H "Authorization: Bearer SUPERVISOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"change_reason": "二次确认损耗数据真实有效，已核对照片和称重记录"}'
```

### 步骤7：审计归档（采购经理）

使用采购经理账号：

```bash
curl -X POST "http://localhost:8000/ledger/{ledger_id}/audit-only" \
  -H "Authorization: Bearer MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"change_reason": "审计完成，损耗责任已确认，归档备查"}'
```

## 制造异常场景

### 场景1：提交重复损耗记录

```bash
curl -X POST "http://localhost:8000/ledger" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": "SUP001",
    "supplier_name": "优质果蔬供应商",
    "batch_no": "BATCH20240101002",
    "product_name": "红富士苹果",
    "total_weight": 100.0,
    "loss_weight": 6.0,
    "loss_type": "bad_fruit",
    "remark": "测试重复记录",
    "loss_items": [
      {
        "item_no": "ITEM001",
        "product_name": "红富士苹果",
        "weight": 3.0,
        "loss_reason": "表面碰伤",
        "source_type": "supplier_delivery",
        "deduplication_key": "ITEM001-红富士苹果-3.0-表面碰伤"
      },
      {
        "item_no": "ITEM003",
        "product_name": "红富士苹果",
        "weight": 3.0,
        "loss_reason": "表面碰伤",
        "source_type": "supplier_delivery",
        "deduplication_key": "ITEM001-红富士苹果-3.0-表面碰伤"
      }
    ]
  }'
```

**预期结果**：第二条记录 `record_status` 为 `invalid`，`validation_errors` 显示"检测到重复记录"。

### 场景2：损耗重量与明细不一致

```bash
curl -X POST "http://localhost:8000/ledger" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": "SUP001",
    "supplier_name": "优质果蔬供应商",
    "batch_no": "BATCH20240101003",
    "product_name": "红富士苹果",
    "total_weight": 100.0,
    "loss_weight": 20.0,
    "loss_type": "bad_fruit",
    "loss_items": [
      {
        "item_no": "ITEM001",
        "product_name": "红富士苹果",
        "weight": 5.0,
        "loss_reason": "表面碰伤",
        "source_type": "supplier_delivery",
        "deduplication_key": "TEST001"
      }
    ]
  }'
```

**预期结果**：返回400错误，提示"有效损耗项总重量与台账损耗重量不一致"。

### 场景3：无效数据源格式

```bash
curl -X POST "http://localhost:8000/ledger" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": "SUP001",
    "supplier_name": "优质果蔬供应商",
    "batch_no": "BATCH20240101004",
    "product_name": "红富士苹果",
    "total_weight": 100.0,
    "loss_weight": 0.0,
    "loss_type": "bad_fruit",
    "data_sources": [
      {
        "source_type": "supplier_delivery",
        "source_no": "DEL001",
        "source_data": "{\"invalid_field\": \"value\"}"
      }
    ]
  }'
```

**预期结果**：数据源 `is_valid` 为 `false`，`validation_message` 显示"缺少必填字段"。

### 场景4：越权操作

使用分拣员token尝试直接二次确认：

```bash
curl -X POST "http://localhost:8000/ledger/{ledger_id}/secondary-confirm" \
  -H "Authorization: Bearer SORTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"change_reason": "越权尝试"}'
```

**预期结果**：返回403错误，提示权限不足。

## 查看报表和导出

### 1. 角色视图（采购经理视角重点）

```bash
curl -X GET "http://localhost:8000/ledger/report/role-view" \
  -H "Authorization: Bearer MANAGER_TOKEN"
```

**重点查看**：
- `pending_review`：待处理数量
- `by_loss_type`：按损耗类型汇总
- `by_supplier`：按供应商汇总

### 2. 追溯单条记录

```bash
curl -X GET "http://localhost:8000/ledger/{ledger_id}/traceability" \
  -H "Authorization: Bearer MANAGER_TOKEN"
```

### 3. 查看历史版本

```bash
curl -X GET "http://localhost:8000/ledger/{ledger_no}/versions" \
  -H "Authorization: Bearer MANAGER_TOKEN"
```

### 4. 查看状态变更历史

```bash
curl -X GET "http://localhost:8000/ledger/{ledger_id}" \
  -H "Authorization: Bearer MANAGER_TOKEN"
```

查看 `status_histories` 字段，每次变更都包含：
- `from_status`：原状态
- `to_status`：新状态
- `operator_name`：操作人
- `change_reason`：变更原因
- `change_time`：变更时间

### 5. 脱敏导出Excel

```bash
curl -X GET "http://localhost:8000/ledger/export/desensitized" \
  -H "Authorization: Bearer MANAGER_TOKEN" \
  -o loss_ledger_export.xlsx
```

**脱敏规则**：供应商名称中间字符替换为 `*`，如"优应商"。

### 6. 查看失败记录

```bash
curl -X GET "http://localhost:8000/ledger/failed-records" \
  -H "Authorization: Bearer AUDITOR_TOKEN"
```

## 运行测试

```bash
# 安装测试依赖
pip install pytest httpx

# 运行所有测试
python -m pytest tests/ -v

# 运行状态流转测试
python -m pytest tests/test_status_flow.py -v

# 运行幂等和校验测试
python -m pytest tests/test_idempotency_and_validation.py -v
```

## 核心测试重点

### 状态流转测试
- ✅ 完整状态流转：草稿→提交→驳回→重新提交→二次确认→审计归档
- ✅ 非法状态跳转：如草稿直接二次确认（应失败）
- ✅ 审计归档后不可再修改
- ✅ 状态变更历史记录完整

### 权限控制测试
- ✅ 分拣员只能在草稿/驳回状态操作
- ✅ 主管可审核提交和驳回
- ✅ 采购经理可二次确认和审计
- ✅ 越权操作返回403

### 幂等性和校验测试
- ✅ 重复损耗记录自动检测标记
- ✅ 损耗重量必须与明细一致
- ✅ 损耗重量不能超过总重量
- ✅ 数据源格式校验
- ✅ 修改自动生成新版本
- ✅ 已提交台账不能直接修改

## 数据一致性保证

1. **详情接口、历史查询、导出文件**：使用同一数据源
2. **版本机制**：修改时创建新版本，旧版本保留不可修改
3. **状态机约束**：严格的状态流转规则，防止乱序操作
4. **审计日志**：所有状态变更留痕，可追溯到人
5. **损耗汇总**：仅统计 `valid` 状态的记录，异常数据隔离

## API列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /auth/login | 登录获取token |
| GET | /auth/me | 获取当前用户信息 |
| POST | /ledger | 创建台账 |
| GET | /ledger | 台账列表 |
| GET | /ledger/{id} | 台账详情 |
| PUT | /ledger/{id} | 修改台账 |
| POST | /ledger/{id}/submit | 提交审核 |
| POST | /ledger/{id}/reject | 驳回 |
| POST | /ledger/{id}/secondary-confirm | 二次确认 |
| POST | /ledger/{id}/audit-only | 审计归档 |
| GET | /ledger/{id}/traceability | 追溯详情 |
| GET | /ledger/{ledger_no}/versions | 版本历史 |
| GET | /ledger/report/role-view | 角色视图报表 |
| GET | /ledger/report/summary | 汇总统计 |
| GET | /ledger/export/desensitized | 脱敏导出 |
| GET | /ledger/failed-records | 失败记录列表 |
