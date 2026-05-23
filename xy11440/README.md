# 生鲜分拣损耗异常回执状态机 API

## 项目概述

这是一个专门用于处理生鲜分拣损耗异常回执的状态机后端服务。核心功能包括：
- 接收供应商送货单、称重记录、退筐照片和外部回执
- 自动识别脏记录（缺字段、跨日、改名、金额/数量冲突）
- 完整的状态流转轨迹记录
- 四级权限控制（录入、复核、主管、只读）
- 采购经理视图，重点展示冻结前后状态、人工理由、重复计算警告

## 核心问题解决

### 坏果扣款和二次分拣损耗重复计算问题

系统在导出时会自动检测：
- 同时存在坏果扣款和二次分拣损耗时发出警告
- 当两者总和超过称重金额10%时高亮警告
- 导出Excel中用黄色背景标识存在风险的记录

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
pip install -r requirements.txt
```

### 2. 启动服务

```bash
# 从空库启动（首次运行会自动创建数据库表和初始用户）
uvicorn app.main:app --reload
```

服务启动后访问：http://localhost:8000/docs

### 3. 初始用户

系统自动创建以下测试用户：

| 用户名 | 密码 | 角色 | 权限 |
|--------|------|------|------|
| entry_user | entry123 | 录入员 | 创建批次、添加记录、提交复核 |
| review_user | review123 | 复核员 | 复核通过/拒绝、导出数据 |
| supervisor_user | super123 | 主管 | 冻结结算、撤回归档、管理看板 |
| readonly_user | readonly123 | 只读 | 仅查询 |

## 主流程操作指南

### 步骤1：登录获取Token

```bash
curl -X POST "http://localhost:8000/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=entry_user&password=entry123"
```

### 步骤2：创建批次

使用录入员账号：

```bash
curl -X POST "http://localhost:8000/batches" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "BATCH-20240115-001",
    "supplier_name": "红星果园",
    "delivery_date": "2024-01-15T10:00:00"
  }'
```

### 步骤3：添加记录

```bash
# 添加送货单
curl -X POST "http://localhost:8000/records" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "record_type": "delivery_note",
    "external_ref_no": "DEL-001",
    "raw_content": "送货单原件扫描内容",
    "product_name": "红富士苹果",
    "quantity": 100,
    "unit_price": 5.5,
    "amount": 550.0,
    "record_date": "2024-01-15T10:00:00",
    "supplier_name_in_record": "红星果园"
  }'

# 添加称重记录
curl -X POST "http://localhost:8000/records" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "record_type": "weighing_record",
    "external_ref_no": "WEIGH-001",
    "raw_content": "称重系统导出数据",
    "product_name": "红富士苹果",
    "quantity": 95,
    "unit_price": 5.5,
    "amount": 522.5,
    "record_date": "2024-01-15T10:00:00",
    "supplier_name_in_record": "红星果园"
  }'
```

### 步骤4：上传附件（退筐照片）

```bash
curl -X POST "http://localhost:8000/records/1/attachments" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@return_basket.jpg"
```

### 步骤5：提交复核

```bash
curl -X POST "http://localhost:8000/batches/1/submit" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "资料齐全，申请复核"}'
```

### 步骤6：复核通过（使用复核员账号）

```bash
curl -X POST "http://localhost:8000/batches/1/review" \
  -H "Authorization: Bearer REVIEW_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "损耗5%在正常范围内，复核通过"}'
```

### 步骤7：冻结结算（使用主管账号）

```bash
curl -X POST "http://localhost:8000/batches/1/freeze" \
  -H "Authorization: Bearer SUPERVISOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "确认冻结，准备与供应商结算"}'
```

## 制造异常场景

### 场景1：缺字段脏记录

创建一条缺少必填字段的记录，系统自动标记为脏数据：

```bash
curl -X POST "http://localhost:8000/records" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "record_type": "delivery_note",
    "external_ref_no": "DIRTY-001",
    "raw_content": "缺少金额字段",
    "product_name": "香蕉",
    "quantity": 50,
    "unit_price": 3.0
  }'
```

**查看结果**：记录的 `is_dirty` 为 `true`，`dirty_type` 为 `missing_field`

### 场景2：跨日脏记录

```bash
curl -X POST "http://localhost:8000/records" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "record_type": "delivery_note",
    "external_ref_no": "DIRTY-002",
    "raw_content": "日期不对",
    "product_name": "橙子",
    "quantity": 80,
    "unit_price": 4.0,
    "amount": 320.0,
    "record_date": "2024-01-20T10:00:00",
    "supplier_name_in_record": "红星果园"
  }'
```

### 场景3：金额冲突脏记录

```bash
curl -X POST "http://localhost:8000/records" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "record_type": "delivery_note",
    "external_ref_no": "DIRTY-003",
    "raw_content": "数量x单价 ≠ 金额",
    "product_name": "葡萄",
    "quantity": 30,
    "unit_price": 10.0,
    "amount": 350.0,
    "record_date": "2024-01-15T10:00:00",
    "supplier_name_in_record": "红星果园"
  }'
```

### 修正脏记录

```bash
curl -X PUT "http://localhost:8000/records/3" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 300.0}'
```

修正后系统自动重新校验，`is_dirty` 变为 `false`，同时留下修正轨迹。

## 查看导出和管理看板

### JSON导出（复核员及以上）

```bash
curl -H "Authorization: Bearer REVIEW_TOKEN" \
  "http://localhost:8000/export/batches"
```

### Excel导出

```bash
curl -H "Authorization: Bearer REVIEW_TOKEN" \
  -o batch_export.xlsx \
  "http://localhost:8000/export/batches/excel"
```

导出字段说明：
- **冻结前状态**：冻结时的批次状态
- **当前状态**：批次最新状态
- **重复计算警告**：检测坏果扣款和二次分拣损耗是否存在重复计算风险
- **人工备注**：汇总复核意见、冻结原因、归档原因
- **脏记录数**：批次中存在的脏记录数量

### 采购经理看板（主管）

```bash
curl -H "Authorization: Bearer SUPERVISOR_TOKEN" \
  "http://localhost:8000/manager/dashboard"
```

看板内容：
- 批次汇总统计（总数、已冻结、待复核、有脏记录）
- 金额汇总（坏果扣款总额、二次分拣损耗总额、最终结算总额）
- 存在脏记录的批次列表
- 最近冻结的10个批次（含冻结原因）

## 状态机流转图

```
draft (草稿)
  ↓ submit
pending_review (待复核)
  ↓ review          ↖ reject
reviewed (已复核)     ↑
  ↓ freeze          ↓ unfreeze
frozen (已冻结)
  ↓ archive
archived (已归档)
```

## 查看状态轨迹

每个批次的所有状态变更都有完整记录：

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8000/batches/1/trails"
```

## 查看修正轨迹

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8000/records/1/corrections"
```

## 一键生成样例数据

```bash
# 确保服务已启动
python sample_data.py
```

该脚本会自动：
1. 创建一个完整流程的正常批次（创建→添加记录→提交→复核→冻结）
2. 创建一个包含各种脏记录的批次
3. 展示导出数据
4. 展示主管看板数据

## 运行测试

```bash
# 运行所有测试
pytest tests/ -v

# 只运行状态机测试
pytest tests/test_state_machine.py -v

# 只运行脏记录测试
pytest tests/test_dirty_records.py -v

# 只运行权限测试
pytest tests/test_permissions.py -v
```

测试重点：
- **状态变化正确性**：验证所有合法/非法状态转换
- **幂等性**：重复操作不会产生重复数据或重复轨迹
- **脏记录识别**：各种异常场景的自动识别
- **权限控制**：不同角色的操作边界

## API 接口列表

### 认证
- `POST /token` - 登录获取Token

### 批次管理
- `POST /batches` - 创建批次
- `GET /batches` - 批次列表
- `GET /batches/{id}` - 批次详情
- `PUT /batches/{id}` - 修改批次
- `POST /batches/{id}/submit` - 提交复核
- `POST /batches/{id}/review` - 复核通过
- `POST /batches/{id}/reject` - 复核拒绝
- `POST /batches/{id}/freeze` - 冻结结算
- `POST /batches/{id}/unfreeze` - 撤销冻结
- `POST /batches/{id}/archive` - 撤回归档
- `GET /batches/{id}/trails` - 状态轨迹

### 记录管理
- `POST /records` - 创建记录
- `GET /batches/{id}/records` - 批次记录列表
- `GET /records/{id}` - 记录详情
- `PUT /records/{id}` - 修改记录
- `POST /records/{id}/reprocess` - 重新校验
- `GET /records/{id}/corrections` - 修正轨迹

### 附件管理
- `POST /records/{id}/attachments` - 上传附件
- `GET /records/{id}/attachments` - 附件列表

### 导出
- `GET /export/batches` - JSON导出
- `GET /export/batches/excel` - Excel导出

### 管理
- `GET /manager/dashboard` - 主管看板
- `GET /roles` - 查看角色权限

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # 主入口，API路由
│   ├── models.py            # 数据模型
│   ├── schemas.py           # Pydantic schema
│   ├── database.py          # 数据库连接
│   ├── auth.py              # 认证与权限
│   ├── services.py          # 业务服务（状态机、脏记录分析）
│   └── export_service.py    # 导出与看板服务
├── tests/
│   ├── conftest.py          # 测试配置
│   ├── test_state_machine.py  # 状态机测试
│   ├── test_dirty_records.py  # 脏记录测试
│   └── test_permissions.py    # 权限测试
├── sample_data.py           # 样例数据脚本
├── requirements.txt         # 依赖列表
└── README.md               # 本文档
```

## 注意事项

1. **冻结后不可修改**：批次一旦冻结，无法添加或修改记录
2. **原始内容保留**：所有记录的 `raw_content` 字段保留原始输入内容
3. **轨迹完整追溯**：所有状态变更和字段修改都有完整轨迹，可追溯操作人和时间
4. **重复计算检测**：导出时自动检测坏果扣款和二次分拣损耗是否存在重复计算风险
