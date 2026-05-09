# 印刷厂色差追样 CLI 使用说明

## 概述

这是一个小而完整的印刷厂色差追样业务工具，用于管理同一订单的多次打样记录、色差计算、批次对比，以及后续的调整日志、超差预警和追样报告。

## 核心功能

- **打样记录管理**：记录每次打样的颜色数据、批次信息、纸张批次
- **色差计算**：支持 ΔE76 和 ΔE2000 两种色差计算标准
- **批次对比**：对比同一订单的多次打样，追踪色差趋势
- **油墨调整日志**：记录每次油墨调整的前后值和原因
- **超差预警**：根据预设阈值自动检测色差问题
- **复核流程**：支持通过/拒绝的复核操作
- **报告生成**：支持 JSON、文本、CSV 三种格式导出

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 生成示例数据

```bash
python scripts/generate_sample_data.py
```

这会生成两个订单的示例数据：
- **ORD-2025-001**：顺利样例，经过4次打样，色差逐渐改善
- **ORD-2025-002**：拦截/待复核样例，存在严重色差和纸张批次变更

### 3. 查看帮助

```bash
# 查看所有命令
python -m color_tracking.cli.main --help

# 查看子命令帮助
python -m color_tracking.cli.main sample --help
python -m color_tracking.cli.main adjust --help
python -m color_tracking.cli.main review --help
python -m color_tracking.cli.main compare --help
python -m color_tracking.cli.main report --help
python -m color_tracking.cli.main orders --help
```

## 完整操作流程

### 流程概览

```
创建打样记录 → 色差自动计算 → 超差预警检测 → 批次对比分析
      ↓
   调整记录 → 复核操作 → 生成报告
```

### 步骤详解

#### 1. 查看所有订单

```bash
python -m color_tracking.cli.main orders list
```

#### 2. 查看订单摘要

```bash
python -m color_tracking.cli.main orders summary --order-id ORD-2025-001
```

#### 3. 查看打样列表

```bash
python -m color_tracking.cli.main sample list --order-id ORD-2025-001
```

#### 4. 查看打样详情

```bash
# 按序号查看
python -m color_tracking.cli.main sample show --order-id ORD-2025-001 --sequence 1

# 按记录ID查看
python -m color_tracking.cli.main sample show --order-id ORD-2025-001 --record-id REC_xxxxxx
```

#### 5. 创建新的打样记录

```bash
python -m color_tracking.cli.main sample create \
  --order-id ORD-TEST-001 \
  --product-name "测试产品" \
  --paper-type "铜版纸" \
  --ink-type "UV油墨" \
  --print-machine "海德堡XL105" \
  --operator "李师傅" \
  --paper-batch "PAPER-2025-001" \
  --paper-manufacturer "金东纸业" \
  --paper-weight 250 \
  --ref-l 52.0 --ref-a 28.0 --ref-b -16.0 \
  --measured-l 53.0 --measured-a 27.5 --measured-b -16.5 \
  --notes "测试打样"
```

#### 6. 添加调整记录

```bash
python -m color_tracking.cli.main adjust add \
  --order-id ORD-TEST-001 \
  --sequence 1 \
  --channel M \
  --before 85.0 \
  --after 90.0 \
  --reason "品红不足" \
  --operator "李师傅"
```

#### 7. 复核打样

```bash
# 通过复核
python -m color_tracking.cli.main review approve \
  --order-id ORD-TEST-001 \
  --sequence 1 \
  --reviewer "张主管" \
  --notes "色差符合标准"

# 拒绝复核
python -m color_tracking.cli.main review reject \
  --order-id ORD-TEST-001 \
  --sequence 1 \
  --reviewer "张主管" \
  --notes "色差超标，需重新调整"
```

#### 8. 批次对比分析

```bash
python -m color_tracking.cli.main compare order --order-id ORD-2025-001
```

#### 9. 生成追样报告

```bash
# 生成所有格式
python -m color_tracking.cli.main report generate \
  --order-id ORD-2025-001 \
  --output-dir ./output \
  --format all

# 只生成文本报告
python -m color_tracking.cli.main report generate \
  --order-id ORD-2025-001 \
  --output-dir ./output \
  --format text

# 只生成CSV数据
python -m color_tracking.cli.main report generate \
  --order-id ORD-2025-001 \
  --output-dir ./output \
  --format csv
```

## 样例场景说明

### 顺利样例：ORD-2025-001

**场景描述**：高端化妆品包装盒打样

**打样记录**：
- 第1次打样：ΔE2000≈2.5，接近警戒值，偏亮偏蓝
  - 调整：增加品红(85→92)，微调黄墨(45→48)
- 第2次打样：ΔE2000≈1.0，在容差范围内 ✓ 通过
- 第3次打样：ΔE2000≈0.3，非常接近参考色 ✓ 通过
- 第4次打样：ΔE2000≈0.15，完全符合标准 ✓ 通过

**特点**：
- 色差呈下降趋势（改善中）
- 纸张批次一致（PAPER-2025-A001）
- 最终通过复核
- 调整记录完整

**运行命令**：
```bash
python -m color_tracking.cli.main orders summary --order-id ORD-2025-001
python -m color_tracking.cli.main sample list --order-id ORD-2025-001
python -m color_tracking.cli.main compare order --order-id ORD-2025-001
```

### 拦截/待复核样例：ORD-2025-002

**场景描述**：企业宣传册封面打样

**打样记录**：
- 第1次打样：ΔE2000≈5.0，严重超标，偏暗偏绿偏蓝 ✗ 拒绝
  - 调整：大幅增加品红(78→88)、黄墨(62→72)，减少黑墨(35→28)
- 第2次打样：纸张批次变更 (B001→B002)，ΔE2000≈4.5，偏亮偏红偏黄 ✗ 拒绝
  - 调整：减少品红(88→82)
- 第3次打样：ΔE2000≈3.5，仍需复核 ⚠ 待处理
- 第4次打样：ΔE2000≈2.0，接近警戒值 ⚠ 待处理

**特点**：
- 存在严重色差预警
- 纸张批次变更（从 PAPER-2025-B001 变更为 PAPER-2025-B002）
- 前两次打样被拒绝
- 后两次打样仍需人工复核

**运行命令**：
```bash
python -m color_tracking.cli.main orders summary --order-id ORD-2025-002
python -m color_tracking.cli.main sample list --order-id ORD-2025-002
python -m color_tracking.cli.main sample show --order-id ORD-2025-002 --sequence 1
python -m color_tracking.cli.main compare order --order-id ORD-2025-002
```

## 数据文件说明

### 目录结构

```
data/
├── records/              # 打样记录
│   ├── ORD-2025-001/
│   │   ├── 001_REC_xxxxxx.json
│   │   ├── 002_REC_xxxxxx.json
│   │   ├── 003_REC_xxxxxx.json
│   │   └── 004_REC_xxxxxx.json
│   └── ORD-2025-002/
│       ├── 001_REC_xxxxxx.json
│       ├── 002_REC_xxxxxx.json
│       ├── 003_REC_xxxxxx.json
│       └── 004_REC_xxxxxx.json
├── comparisons/          # 批次对比结果
│   ├── ORD-2025-001/
│   └── ORD-2025-002/
└── reports/              # 生成的报告
    ├── ORD-2025-001/
    └── ORD-2025-002/

output/                   # 导出的报告文件
├── successful/
│   ├── ORD-2025-001_report_YYYYMMDD_HHMMSS.txt
│   └── ORD-2025-001_data_YYYYMMDD_HHMMSS.csv
└── review_needed/
    ├── ORD-2025-002_report_YYYYMMDD_HHMMSS.txt
    └── ORD-2025-002_data_YYYYMMDD_HHMMSS.csv
```

### 打样记录字段说明

每条打样记录包含以下信息：

| 分类 | 字段 | 说明 |
|------|------|------|
| **基础信息** | record_id | 记录唯一标识 |
| | sequence_number | 打样序号 |
| | status | 工作状态 |
| | alert_level | 预警级别 |
| **批次信息** | order_id | 订单编号 |
| | product_name | 产品名称 |
| | paper_type | 纸张类型 |
| | ink_type | 油墨类型 |
| | print_machine | 印刷机台 |
| | operator | 操作员 |
| **纸张批次** | batch_code | 纸张批次号 |
| | manufacturer | 厂商 |
| | weight | 克重(g/m²) |
| **颜色数据** | reference_sample | 参考色LAB值 |
| | measured_sample | 测量色LAB值 |
| **色差分析** | delta_e2000 | CIEDE2000色差 |
| | delta_e76 | CIE76色差 |
| | delta_l/a/b | 各通道差异 |
| **调整记录** | adjustments | 油墨调整列表 |
| **复核信息** | reviewer | 复核人 |
| | review_notes | 复核备注 |
| | approved | 是否通过 |

## 色差标准说明

### ΔE 值解读

| ΔE2000 范围 | 预警级别 | 说明 |
|-------------|----------|------|
| 0 - 2.0 | NORMAL | 色差在容差范围内，可接受 |
| 2.0 - 4.0 | WARNING | 接近警戒值，建议微调油墨 |
| ≥ 4.0 | CRITICAL | 严重超标，需停止生产重新调整 |

### LAB 颜色通道

| 通道 | 正值方向 | 负值方向 |
|------|----------|----------|
| L | 偏亮 | 偏暗 |
| a | 偏红 | 偏绿 |
| b | 偏黄 | 偏蓝 |

## 工作状态流转

```
PENDING (待处理)
    ↓
SAMPLE_CREATED (打样已创建)
    ↓
COLOR_MEASURED (色差已测量)
    ↓
├─→ 正常 (ΔE2000 < 2.0) → COMPARISON_DONE → APPROVED
├─→ 警告 (2.0 ≤ ΔE2000 < 4.0) → ADJUSTMENT_RECOMMENDED → ADJUSTMENT_APPLIED
└─→ 严重 (ΔE2000 ≥ 4.0) → NEEDS_REVIEW
                           ↓
                    APPROVED / REJECTED
```

## 重跑对比

每次命令执行后，数据文件都会保存在 `data/` 和 `output/` 目录中。你可以：

1. **查看历史数据**：直接读取 JSON/CSV 文件
2. **重新生成报告**：再次运行 `report generate` 命令
3. **对比差异**：通过文件时间戳区分不同批次的运行结果
4. **新增打样**：继续添加新的打样记录，系统会自动递增序号

## 完整示例操作

```bash
# 1. 生成示例数据
python scripts/generate_sample_data.py

# 2. 查看所有订单
python -m color_tracking.cli.main orders list

# 3. 查看顺利样例
python -m color_tracking.cli.main sample list --order-id ORD-2025-001
python -m color_tracking.cli.main compare order --order-id ORD-2025-001

# 4. 查看待复核样例
python -m color_tracking.cli.main sample list --order-id ORD-2025-002
python -m color_tracking.cli.main sample show --order-id ORD-2025-002 --sequence 1
python -m color_tracking.cli.main compare order --order-id ORD-2025-002

# 5. 生成报告
python -m color_tracking.cli.main report generate --order-id ORD-2025-001 --output-dir ./output
python -m color_tracking.cli.main report generate --order-id ORD-2025-002 --output-dir ./output

# 6. 查看生成的报告
ls -la output/
```

## 注意事项

1. **数据持久化**：所有数据以 JSON 格式保存，可直接查看和编辑
2. **序号自动递增**：同一订单的打样序号会自动递增
3. **预警阈值**：默认阈值为 ΔE2000 ≥ 2.0 警告，≥ 4.0 严重
4. **纸张批次追踪**：系统会自动检测纸张批次变更并发出警告
5. **报告格式**：支持 JSON（结构化数据）、TXT（可读报告）、CSV（表格数据）
