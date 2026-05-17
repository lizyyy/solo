# 仓储WMS接口批次库存冻结释放系统

## 项目概述

本系统实现了仓储WMS接口的批次库存冻结释放功能，包含完整的业务流程追踪、冲突处理和数据导出能力。

### 核心功能

1. **库存冻结**：对指定批次的库存进行冻结操作，支持冻结原因和证据附件
2. **释放审核**：冻结库存释放前的审批流程
3. **库存释放**：审核通过后的库存释放，支持部分释放和全部释放
4. **冲突处理**：质检未完成被销售单占用等特殊情况的冲突检测和处理
5. **数据导出**：支持业务语言字段的Excel格式导出
6. **过程追踪**：完整的库存快照和操作历史记录

### 数据模型

| 表名 | 说明 |
|------|------|
| sku | SKU主表 |
| batch_inventory | 批次库存表 |
| freeze_reason | 冻结原因配置表 |
| inventory_freeze | 库存冻结记录表 |
| release_voucher | 释放凭证表 |
| inventory_snapshot | 库存快照表 |
| inventory_conflict | 冲突记录表 |
| import_export_log | 导入导出记录表 |
| operation_history | 操作历史表 |

## 快速开始

### 环境要求

- Python 3.8+
- MySQL 5.7+ 或 8.0+

### 安装依赖

```bash
pip install -r requirements.txt
```

### 配置数据库

复制环境变量配置文件并修改：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置数据库连接信息：

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=wms_inventory
```

### 初始化数据库

#### 方式一：使用SQL脚本

```bash
# 执行建表脚本
mysql -u root -p < database/schema.sql

# 执行初始化数据脚本
mysql -u root -p < database/init_data.sql
```

#### 方式二：使用Python模型

```bash
python -c "from models import create_tables; create_tables()"
```

### 运行验收测试

```bash
python test_acceptance.py
```

## 核心模块说明

### InventoryService（库存服务）

核心业务逻辑服务，提供以下方法：

```python
# 冻结库存
freeze_inventory(sku_id, batch_id, warehouse_code, reason_code, freeze_qty, operator, ...)

# 提交释放审核
submit_release_audit(freeze_id, operator, audit_remark=None)

# 释放库存
release_inventory(freeze_id, release_qty, operator, ...)

# 查询冻结列表
get_freeze_list(sku_id=None, batch_no=None, status=None, warehouse_code=None)

# 查询冻结详情
get_freeze_detail(freeze_id)

# 查询冲突列表
get_conflict_list(status=None, conflict_type=None, handle_result=None)

# 处理冲突
handle_conflict(conflict_id, handler, handle_result, handle_remark=None)

# 查询操作历史
get_operation_history(business_type=None, business_id=None, business_no=None)
```

### ExportService（导出服务）

提供数据导入导出功能：

```python
# 导出冻结记录
export_freeze_records(operator, sku_id=None, batch_no=None, status=None, warehouse_code=None)

# 导出冲突记录
export_conflict_records(operator, status=None, conflict_type=None, handle_result=None)

# 导入冻结记录
import_freeze_records(file_path, operator)
```

### 导出字段配置

系统支持业务语言的导出字段，与列表查询结果一一对应：

**冻结记录导出字段**：
- 冻结单号、SKU编码、SKU名称、批次号、仓库编码、冻结原因编码、冻结原因名称、冻结数量、冻结操作人、冻结时间、状态编码、状态名称

**冲突记录导出字段**：
- 冲突编号、冲突类型编码、冲突类型名称、SKU编码、SKU名称、批次号、仓库编码、关联单号、关联单类型、冲突数量、质检状态编码、质检状态名称、冲突详情、处理结果编码、处理结果名称、处理人、处理时间、处理备注、状态、创建时间

## 验收场景

### 场景1：完整流转

**流程**：冻结库存 -> 提交释放审核 -> 释放库存

**验证点**：
- 冻结记录状态变化（FROZEN -> RELEASE_AUDIT -> RELEASED）
- 批次库存数量变化（available_qty / frozen_qty / released_qty）
- 库存快照记录完整
- 操作历史可追溯

### 场景2：冲突记录

**场景**：质检未完成的批次被销售单占用

**验证点**：
- 系统检测到冲突并创建冲突记录
- 冲突类型正确（QUALITY_SALES）
- 关联单号和质检状态正确记录
- 冲突处理流程可执行

### 场景3：导入坏行

**场景**：导入包含错误数据的Excel文件

**验证点**：
- 正确识别并跳过错误行
- 生成错误明细Excel文件
- 错误信息准确（行号、错误字段、原始值）
- 成功导入的记录可查询

## 状态说明

### 库存状态（inventory_status）

| 状态编码 | 状态名称 | 说明 |
|----------|----------|------|
| AVAILABLE | 可用 | 库存正常可用 |
| FROZEN | 冻结中 | 库存已被冻结 |
| RELEASE_AUDIT | 释放审核 | 提交释放审核中 |
| RELEASED | 已释放 | 库存已释放恢复可用 |

### 冻结记录状态（status）

| 状态编码 | 状态名称 | 说明 |
|----------|----------|------|
| FROZEN | 冻结中 | 已冻结待释放 |
| RELEASE_AUDIT | 释放审核中 | 提交释放审核 |
| PARTIAL_RELEASED | 部分释放 | 已部分释放 |
| RELEASED | 已释放 | 已全部释放 |

### 质检状态（quality_status）

| 状态编码 | 状态名称 | 说明 |
|----------|----------|------|
| PENDING | 待质检 | 未完成质检 |
| PASSED | 已通过 | 质检通过 |
| FAILED | 已失败 | 质检未通过 |

### 冲突类型（conflict_type）

| 类型编码 | 类型名称 | 说明 |
|----------|----------|------|
| QUALITY_SALES | 质检未完成被销售单占用 | 质检未完成的批次被销售单占用 |
| INVENTORY_SHORTAGE | 库存不足 | 可用库存不足 |
| DOUBLE_FREEZE | 重复冻结 | 重复冻结操作 |

### 处理结果（handle_result）

| 结果编码 | 结果名称 | 说明 |
|----------|----------|------|
| PENDING | 待处理 | 未处理 |
| RESOLVED | 已解决 | 冲突已解决 |
| IGNORED | 已忽略 | 冲突已忽略 |

## 项目结构

```
.
├── database/
│   ├── schema.sql          # 数据库建表脚本
│   └── init_data.sql       # 初始化数据脚本
├── models.py               # SQLAlchemy数据模型
├── inventory_service.py    # 库存业务逻辑服务
├── export_service.py       # 导入导出服务
├── config.py               # 配置文件
├── requirements.txt        # 依赖包列表
├── .env.example           # 环境变量示例
├── test_acceptance.py     # 验收测试脚本
└── exports/               # 导出文件目录（自动创建）
```

## 注意事项

1. 冻结前系统会自动检测冲突，存在冲突时冻结操作失败并返回冲突详情
2. 释放操作必须先提交审核，审核通过后才能执行释放
3. 支持部分释放，剩余冻结数量可继续提交释放
4. 所有库存变更操作都会生成快照记录，确保可追溯
5. 导入失败的记录会生成错误明细文件，包含具体错误信息

## 扩展建议

1. 可集成消息队列实现异步冻结释放操作
2. 可添加定时任务自动处理过期的冻结记录
3. 可集成企业微信/钉钉消息通知功能
4. 可添加数据报表和统计分析功能
5. 可对接外部WMS/ERP系统API
