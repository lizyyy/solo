# 专色打样放行员

小型印刷厂打样室命令行工具，用于管理打样任务的质量检查、状态管理和报告导出。

## 功能特性

- **init**: 初始化工作区，生成示例数据
- **import**: 导入多源数据（色差CSV、油墨配方JSON、纸张批次表、干燥记录）
- **check**: 按客户容差、批次效期和干燥时间进行风险检查
- **release/rollback**: 维护放行状态机
- **report**: 导出 Markdown/CSV 复核单

## 安装

```bash
# 安装依赖
pip install -e .

# 或者使用开发模式安装
cd <项目目录>
pip install --editable .
```

## 快速开始

### 1. 初始化工作区

```bash
# 初始化工作区并生成示例数据
colorproof init --with-samples
```

这会在当前目录创建 `.colorproof` 数据目录和 `samples/` 示例数据目录。

### 2. 导入示例数据

```bash
# 从 samples 目录批量导入所有数据
colorproof import all samples/
```

### 3. 查看当前状态

```bash
# 查看工作区状态概览
colorproof status
```

### 4. 创建打样任务

```bash
# 创建打样任务
colorproof create \
    PROOF-2026-001 \
    CUST001 \
    "宏达包装有限公司" \
    CUST-PANTONE-186C \
    "Pantone Red 186 C" \
    PAPER-BATCH-001
```

参数说明：
- `task_number`: 任务编号
- `customer_id`: 客户ID
- `customer_name`: 客户名称
- `color_code`: 色号
- `color_name`: 颜色名称
- `paper_batch_number`: 纸张批次号

可选参数：
- `--ink-formula-id`: 关联的油墨配方ID
- `--color-measurement-id`: 关联的色差测量ID
- `--drying-record-id`: 关联的干燥记录ID

### 5. 检查风险

```bash
# 查看所有任务列表和风险等级
colorproof check

# 检查特定任务的详细风险
colorproof check <任务ID>

# 检查所有任务
colorproof check --all

# 检查并保存结果到任务
colorproof check <任务ID> --save
```

### 6. 状态流转

```bash
# 审核通过（从 checking 到 approved）
colorproof approve <任务ID>

# 放行（从 approved 到 released）
colorproof release <任务ID>

# 强制放行（即使有严重风险）
colorproof release <任务ID> --force

# 驳回（从 pending/checking/approved 到 rejected）
colorproof reject <任务ID> "颜色偏差过大"

# 回滚（从 released 到 rolled_back）
colorproof rollback <任务ID> "发现未干透"

# 重置（从 rejected/rolled_back 到 pending）
colorproof reset <任务ID>
```

### 7. 导出报告

```bash
# 导出单个任务的 Markdown 报告
colorproof report single <任务ID>

# 导出单个任务的 CSV 报告
colorproof report single <任务ID> --format csv

# 导出汇总报告
colorproof report summary

# 导出特定状态的汇总报告
colorproof report summary --status released --status approved
```

### 8. 查看历史

```bash
# 查看所有状态变更历史
colorproof history

# 查看特定任务的历史
colorproof history <任务ID>
```

## 完整命令链示例

```bash
# 1. 初始化
colorproof init --with-samples

# 2. 导入数据
colorproof import all samples/

# 3. 创建任务
colorproof create PROOF-TEST-001 CUST001 "宏达包装" CUST-PANTONE-186C "Pantone Red 186C" PAPER-BATCH-001

# 4. 检查风险
colorproof check --all

# 5. 查看任务ID
colorproof check

# 6. 审核通过
colorproof approve <任务ID>

# 7. 放行
colorproof release <任务ID>

# 8. 导出报告
colorproof report single <任务ID>

# 9. 查看历史
colorproof history
```

## 数据文件格式

### 色差测量数据 (color_measurements.csv)

| 字段 | 说明 |
|------|------|
| sample_name | 样品名称 |
| batch_number | 批次号 |
| color_code | 色号 |
| delta_e | DeltaE 值 |
| delta_l | DeltaL 值 (可选) |
| delta_a | DeltaA 值 (可选) |
| delta_b | DeltaB 值 (可选) |
| lab_l | L* 值 (可选) |
| lab_a | a* 值 (可选) |
| lab_b | b* 值 (可选) |
| measurement_date | 测量时间 (可选) |
| notes | 备注 (可选) |

### 油墨配方 (ink_formulas.json)

```json
[
  {
    "color_code": "CUST-PANTONE-186C",
    "color_name": "Pantone Red 186 C",
    "customer_id": "CUST001",
    "customer_name": "宏达包装有限公司",
    "pantone_code": "186 C",
    "base_inks": {
      "PANTONE Rubine Red": "65.0",
      "PANTONE Transparent White": "20.0",
      "PANTONE Yellow": "15.0"
    },
    "total_weight": "100",
    "viscosity": "18.5",
    "ph_value": "8.2",
    "create_date": "2026-05-03",
    "notes": "宏达包装常用红色配方"
  }
]
```

### 纸张批次 (paper_batches.csv)

| 字段 | 说明 |
|------|------|
| batch_number | 批次号 |
| paper_type | 纸张类型 |
| paper_name | 纸张名称 |
| grammage | 克重 |
| width | 宽度 (可选) |
| length | 长度 (可选) |
| supplier | 供应商 (可选) |
| manufacture_date | 生产日期 (可选) |
| expiry_date | 有效期至 (可选) |
| received_date | 入库日期 (可选) |
| total_quantity | 总数量 (可选) |
| warehouse_location | 库位 (可选) |
| notes | 备注 (可选) |

### 干燥记录 (drying_records.csv)

| 字段 | 说明 |
|------|------|
| proof_id | 打样任务ID |
| batch_number | 批次号 |
| print_time | 印刷时间 |
| drying_start_time | 干燥开始时间 |
| drying_end_time | 干燥结束时间 (可选) |
| drying_method | 干燥方式 (可选) |
| drying_temperature | 干燥温度 (可选) |
| drying_humidity | 干燥湿度 (可选) |
| coating_type | 上光类型 (可选) |
| coating_amount | 上光量 (可选) |
| operator_name | 机长 (可选) |
| visual_check_result | 目视检查结果 (可选) |
| touch_check_result | 触感检查结果 (可选) |
| notes | 备注 (可选) |

### 客户容差配置 (customer_tolerances.json)

```json
[
  {
    "customer_id": "CUST001",
    "customer_name": "宏达包装有限公司",
    "delta_e_tolerance": "2.0",
    "special_tolerances": {
      "CUST-PANTONE-186C": "1.5",
      "CUST-PANTONE-286C": "1.8"
    },
    "min_drying_hours": "4",
    "notes": "宏达包装对颜色要求较高"
  }
]
```

## 状态流转图

```
                    ┌───────────┐
                    │  pending  │◄─────────────┐
                    └─────┬─────┘              │
                          │                    │
                          ▼                    │
                    ┌───────────┐              │
                    │ checking  │              │
                    └─────┬─────┘              │
                          │                    │
            ┌─────────────┴─────────────┐    │
            ▼                           ▼    │
     ┌───────────┐              ┌───────────┐ │
     │ approved  │──────┐       │ rejected  │─┘
     └─────┬─────┘      │       └───────────┘
           │            │
           ▼            │
     ┌───────────┐      │
     │ released  │      │
     └─────┬─────┘      │
           │            │
           ▼            │
     ┌─────────────┐    │
     │ rolled_back │────┘
     └─────────────┘
```

## 风险检查项

### 1. DeltaE 超标检查
- 检查测量的 DeltaE 值是否超过客户容差
- 支持客户级默认容差和色号级特殊容差
- 超出容差 3.0 以上标记为严重风险

### 2. 色号混用检查
- 检查同一客户色号是否混用不同纸张批次
- 避免同一客户色号在不同纸张批次上印刷造成的颜色差异

### 3. 纸张批次过期检查
- 检查纸张批次是否已过期
- 检查是否即将过期（剩余7天内）
- 过期30天以上标记为严重风险

### 4. 干燥时间检查
- 检查干燥时间是否达到客户要求的最小干燥时间
- 检查触感检查结果
- 未完成干燥且时间不足标记为严重风险

## 命令参考

```bash
colorproof --help
colorproof init --help
colorproof import --help
colorproof check --help
colorproof release --help
colorproof rollback --help
colorproof report --help
colorproof history --help
colorproof status --help
```

## 开发

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest
```

## 许可证

MIT License
