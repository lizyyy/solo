# 宠物医院药房管理系统

专为宠物医院设计的药房管理系统，专注于剂量计算、库存批号管理、审核拦截和追溯审计功能。

## 核心功能

### 1. 剂量计算与校验
- 基于宠物体重自动计算推荐剂量范围
- 支持最小剂量和最大剂量配置
- 超剂量处方自动拦截
- 特别适用于小体重宠物（如仓鼠、异宠）的精确用药

### 2. 药品管理
- 药品基础信息维护（通用名、生产厂家、剂型等）
- 批号管理（支持多批号）
- 库存数量跟踪
- 过期自动提醒和拦截

### 3. 禁忌组合管理
- 药品之间的禁忌关系配置
- 开方时自动检测禁忌组合
- 避免药物相互作用风险

### 4. 处方工作流
| 状态 | 说明 | 操作人 |
|------|------|--------|
| DRAFT | 草稿 | 医生/助理 |
| SUBMITTED | 已提交待审核 | 医生 |
| APPROVED | 审核通过 | 药师 |
| BLOCKED | 审核拦截 | 药师 |
| DISPENSED | 已发药 | 发药员 |
| CANCELLED | 已取消 | 医生/药师 |

### 5. 追溯与审计
- 完整的操作日志记录
- 每条状态变更都记录操作人、时间、原因
- 支持处方全流程追溯
- 数据库变更审计

### 6. 数据导出
- 处方汇总导出（Excel）
- 药品明细导出
- 操作日志导出
- 月度发药汇总

## 项目结构

```
├── database.py         # 数据库初始化和基础操作
├── business_rules.py   # 业务规则（剂量、禁忌、批号校验）
├── workflow.py         # 工作流引擎（创建、提交、审核、发药、追溯）
├── export_data.py      # 数据导出功能
├── cli.py              # 命令行接口
├── test_system.py      # 自动化测试
├── requirements.txt    # 依赖清单
└── pharmacy.db         # SQLite数据库（自动生成）
```

## 快速开始

### 1. 安装依赖
```bash
pip install pandas openpyxl
```

### 2. 初始化数据库
```bash
python3 cli.py init
```

### 3. 创建处方
```bash
python3 cli.py create
```

### 4. 完整工作流示例
```bash
# 列出处方
python3 cli.py list

# 提交处方（处方ID=1）
python3 cli.py submit 1

# 审核通过（处方ID=1）
python3 cli.py review 1 approve

# 审核拦截（处方ID=1）
python3 cli.py review 1 block "剂量过高"

# 发药（处方ID=1）
python3 cli.py dispense 1

# 追溯处方全流程
python3 cli.py trace 1

# 取消处方
python3 cli.py cancel 1 "主人放弃治疗"

# 导出所有数据
python3 cli.py export

# 导出月度发药汇总
python3 cli.py export-month
```

### 5. 运行自动化测试
```bash
python3 test_system.py
```

## 数据模型

### medicines 药品表
- id: 主键
- name: 药品名称
- generic_name: 通用名
- manufacturer: 生产厂家
- dosage_form: 剂型
- min_dose_per_kg: 每公斤最小剂量
- max_dose_per_kg: 每公斤最大剂量
- dose_unit: 剂量单位

### medicine_batches 药品批号表
- id: 主键
- medicine_id: 药品ID
- batch_number: 批号
- quantity: 库存数量
- unit: 单位
- manufacture_date: 生产日期
- expiry_date: 有效期至

### contraindications 禁忌组合表
- id: 主键
- medicine_a_id: 药品A ID
- medicine_b_id: 药品B ID
- reason: 禁忌原因

### prescriptions 处方表
- id: 主键
- prescription_no: 处方号（唯一）
- pet_name: 宠物名称
- pet_weight_kg: 体重(kg)
- species: 物种
- doctor_name: 医生姓名
- status: 状态
- created_by: 创建人
- created_at: 创建时间
- updated_at: 更新时间

### prescription_items 处方药品明细表
- id: 主键
- prescription_id: 处方ID
- medicine_id: 药品ID
- batch_id: 批号ID（发药时填充）
- prescribed_dose: 处方剂量
- dose_unit: 剂量单位
- calculated_dose: 计算推荐剂量
- quantity: 数量
- notes: 备注
- status: 状态

### workflow_logs 工作流日志表
- id: 主键
- prescription_id: 处方ID
- prescription_item_id: 处方药品ID
- action: 操作类型
- status: 状态
- reason: 原因/备注
- operator: 操作人
- operated_at: 操作时间
- previous_status: 原状态
- new_status: 新状态
- details: 详细信息(JSON)

### audit_trail 审计跟踪表
- id: 主键
- table_name: 表名
- record_id: 记录ID
- operation: 操作类型(INSERT/UPDATE/DELETE)
- old_values: 旧值(JSON)
- new_values: 新值(JSON)
- operator: 操作人
- operated_at: 操作时间

## 设计原则

1. **数据持久化**: 使用SQLite本地存储，重启不丢失数据
2. **幂等性**: 重复提交/操作不会产生副作用，结果稳定
3. **可追溯**: 每一条数据的变更都有完整的审计日志
4. **安全校验**: 剂量上下限、禁忌组合、批号过期三重校验
5. **人工审核**: 系统规则拦截+人工最终确认，确保用药安全
6. **导出核对**: 月底复盘时支持导出Excel与历史动作互相核对

## 使用场景

1. 小体重宠物用药剂量计算与核对
2. 麻醉前多药物禁忌组合检查
3. 近效期药品提醒与拦截
4. 处方审核与发药全流程追溯
5. 月底药房盘点与数据核对
