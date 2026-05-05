# Roast Trace - 咖啡烘焙工坊本地追溯与质检CLI工具

为小型咖啡烘焙工坊设计的本地命令行工具，用于管理生豆批次、烘焙记录、杯测数据、包装贴标和发货记录，并自动检测需要暂停出货或召回的风险批次。

## 功能特性

- 📥 **多格式数据导入**: 支持 CSV 和 JSON 格式
- 🔍 **智能质检检查**:
  - 生豆批次混用检测
  - 烘焙曲线异常检测
  - 杯测缺陷超限检测
  - 贴标批号不一致检测
  - 已发货风险批次识别
- ✍️ **人工复核**: 保存复核备注，设置批次状态
- 🔎 **本地查询**: 灵活的查询接口
- 📄 **报告导出**:
  - Markdown 格式批次追溯单
  - JSON 格式审计数据包
  - 风险批次汇总报告

## 安装

```bash
pip install -e .
```

**注意**: 如果 `roast-trace` 命令不在 PATH 中，可以使用 `python3 -m roast_trace.cli` 代替。

## 快速开始

### 1. 使用示例数据运行检查

```bash
# 一键导入所有示例数据并运行检查 (推荐使用 JSON 格式)
python3 -m roast_trace.cli check \
  --green-batches examples/green_batches.json \
  --roast-logs examples/roast_logs.json \
  --cupping-records examples/cupping_records.json \
  --labels examples/packaging_labels.json \
  --shipments examples/shipments.json
```

**示例数据说明**:
- **R-2024-001**: 正常批次，无异常
- **R-2024-002**: 烘焙曲线异常 + 杯测缺陷警告 + 贴标日期不一致 + 已发货 → **需召回**
- **R-2024-003**: 生豆批次混用 + 失重率过高 + 杯测缺陷超限 + 多批号 + 已发货 → **需召回**
- **R-2024-004**: 正常批次

### 2. 查看系统状态

```bash
python3 -m roast_trace.cli status \
  --green-batches examples/green_batches.json \
  --roast-logs examples/roast_logs.json \
  --cupping-records examples/cupping_records.json \
  --labels examples/packaging_labels.json \
  --shipments examples/shipments.json
```

### 3. 查询批次详情

```bash
# 查询特定烘焙批次
python3 -m roast_trace.cli query batch \
  --batch-id R-2024-003 \
  --green-batches examples/green_batches.json \
  --roast-logs examples/roast_logs.json \
  --cupping-records examples/cupping_records.json \
  --labels examples/packaging_labels.json \
  --shipments examples/shipments.json
```

### 4. 添加人工复核

```bash
# 对风险批次添加复核记录
python3 -m roast_trace.cli review R-2024-003 \
  --reviewer "质检主管" \
  --status hold \
  --notes "杯测缺陷超限，需要重新烘焙或销毁该批次" \
  --action "隔离已包装产品" \
  --action "通知门店暂停销售" \
  --green-batches examples/green_batches.json \
  --roast-logs examples/roast_logs.json \
  --cupping-records examples/cupping_records.json \
  --labels examples/packaging_labels.json \
  --shipments examples/shipments.json
```

### 5. 导出报告

```bash
# 创建输出目录
mkdir -p reports

# 导出单个批次的追溯单 (Markdown)
python3 -m roast_trace.cli export trace \
  --batch-id R-2024-003 \
  --output reports/batch_trace_R-2024-003.md \
  --green-batches examples/green_batches.json \
  --roast-logs examples/roast_logs.json \
  --cupping-records examples/cupping_records.json \
  --labels examples/packaging_labels.json \
  --shipments examples/shipments.json

# 导出完整审计包 (JSON)
python3 -m roast_trace.cli export audit \
  --output reports/audit_package.json \
  --green-batches examples/green_batches.json \
  --roast-logs examples/roast_logs.json \
  --cupping-records examples/cupping_records.json \
  --labels examples/packaging_labels.json \
  --shipments examples/shipments.json

# 导出风险批次汇总 (Markdown)
python3 -m roast_trace.cli export summary \
  --output reports/risk_summary.md \
  --green-batches examples/green_batches.json \
  --roast-logs examples/roast_logs.json \
  --cupping-records examples/cupping_records.json \
  --labels examples/packaging_labels.json \
  --shipments examples/shipments.json
```

## 完整命令参考

### import - 导入数据

```bash
roast-trace import \
  --green-batches path/to/green.csv \
  --roast-logs path/to/roast.csv \
  --cupping-records path/to/cupping.csv \
  --labels path/to/labels.csv \
  --shipments path/to/shipments.csv
```

### check - 运行质检检查

```bash
roast-trace check \
  --green-batches examples/green_batches.csv \
  --roast-logs examples/roast_logs.csv \
  --cupping-records examples/cupping_records.csv \
  --labels examples/packaging_labels.csv \
  --shipments examples/shipments.csv \
  --output reports/check_report.md
```

### query - 查询数据

#### 查询批次详情
```bash
roast-trace query batch --batch-id R-2024-001 [其他数据文件参数]
```

#### 查询生豆批次
```bash
roast-trace query green --green-batch-id GB-2024-001 [其他数据文件参数]
```

#### 查询发货记录
```bash
# 按门店查询
roast-trace query shipments --store "国贸店" [其他数据文件参数]

# 按日期范围查询
roast-trace query shipments --start-date 2024-01-01 --end-date 2024-01-31 [其他数据文件参数]

# 按批次查询
roast-trace query shipments --batch-id R-2024-001 [其他数据文件参数]
```

#### 查询风险批次
```bash
roast-trace query flagged [其他数据文件参数]
```

#### 查询杯测记录
```bash
# 查看所有杯测记录
roast-trace query cupping [其他数据文件参数]

# 按最低分数筛选
roast-trace query cupping --min-score 8.0 [其他数据文件参数]

# 按批次查询
roast-trace query cupping --batch-id R-2024-001 [其他数据文件参数]
```

### review - 添加复核记录

```bash
roast-trace review [批次号] \
  --reviewer "复核人姓名" \
  --status [hold|recall|cleared|normal] \
  --notes "复核备注" \
  --action "行动项1" \
  --action "行动项2"
```

### export - 导出报告

```bash
# 批次追溯单
roast-trace export trace --batch-id R-2024-001 --output trace.md

# 审计包
roast-trace export audit --output audit.json
roast-trace export audit --output audit_flagged.json --flagged-only

# 风险汇总
roast-trace export summary --output summary.md
```

### status - 查看系统状态

```bash
roast-trace status [数据文件参数]
```

## 数据格式说明

### 生豆批次 (green_batches.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| batch_id | string | 生豆批次号 (必填) |
| origin | string | 产地 (必填) |
| variety | string | 品种 (必填) |
| process | string | 处理法 (必填) |
| arrival_date | date | 到货日期 (必填, YYYY-MM-DD) |
| quantity_kg | float | 到货数量(kg) (必填) |
| supplier | string | 供应商 (必填) |
| certificate | string | 认证编号 (可选) |
| notes | string | 备注 (可选) |

### 烘焙日志 (roast_logs.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| roast_batch_id | string | 烘焙批次号 (必填) |
| green_batch_ids | string | 生豆批次号列表，逗号分隔 (必填) |
| roast_date | date | 烘焙日期 (必填) |
| green_weight_kg | float | 生豆重量(kg) (必填) |
| roasted_weight_kg | float | 熟豆重量(kg) (必填) |
| roast_curve_points | json | 烘焙曲线点JSON数组 (必填) |
| first_crack_time | int | 一爆时间(秒) (可选) |
| first_crack_temp | float | 一爆温度(°C) (可选) |
| second_crack_time | int | 二爆时间(秒) (可选) |
| second_crack_temp | float | 二爆温度(°C) (可选) |
| drop_temp | float | 出锅温度(°C) (必填) |
| drop_time | int | 总烘焙时间(秒) (必填) |
| roast_level | string | 烘焙度 (必填) |
| roaster | string | 烘焙师 (必填) |

### 杯测记录 (cupping_records.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| roast_batch_id | string | 烘焙批次号 (必填) |
| cupping_date | date | 杯测日期 (必填) |
| cupper | string | 杯测师 (必填) |
| dry_aroma | float | 干香 0-10 (必填) |
| wet_aroma | float | 湿香 0-10 (必填) |
| flavor | float | 风味 0-10 (必填) |
| aftertaste | float | 余韵 0-10 (必填) |
| acidity | float | 酸度 0-10 (必填) |
| body | float | 醇厚度 0-10 (必填) |
| uniformity | float | 一致性 0-10 (必填) |
| clean_cup | float | 干净度 0-10 (必填) |
| sweetness | float | 甜度 0-10 (必填) |
| overall | float | 综合得分 0-10 (必填) |
| defects | json | 缺陷列表JSON (可选) |
| total_defect_points | float | 缺陷点数总计 (可选) |
| notes | string | 备注 (可选) |

### 包装贴标 (packaging_labels.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| label_id | string | 贴标编号 (必填) |
| roast_batch_id | string | 烘焙批次号 (必填) |
| product_name | string | 产品名称 (必填) |
| net_weight_g | int | 净含量(g) (必填) |
| roast_date | date | 烘焙日期 (必填) |
| best_before_date | date | 最佳赏味期 (必填) |
| batch_number | string | 生产批号 (必填) |
| origin | string | 产地 (必填) |
| process | string | 处理法 (必填) |
| quantity | int | 贴标数量 (必填) |
| packer | string | 包装员 (必填) |
| pack_date | date | 包装日期 (必填) |

### 发货记录 (shipments.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| shipment_id | string | 发货单号 (必填) |
| shipment_date | date | 发货日期 (必填) |
| store_name | string | 门店名称 (必填) |
| items | json | 发货明细JSON数组 (必填) |
| total_quantity | int | 总数量 (必填) |
| recipient | string | 收货人 (必填) |
| contact | string | 联系方式 (必填) |
| address | string | 收货地址 (必填) |
| courier | string | 快递公司 (可选) |
| tracking_number | string | 运单号 (可选) |
| status | string | 发货状态 (默认: shipped) |

## 质检规则说明

### 1. 生豆批次混用检测
- 检查烘焙日志中引用的生豆批次是否已在生豆批次表中注册
- 未注册的生豆批次会触发 Critical 告警

### 2. 烘焙曲线异常检测
检查以下参数是否超出正常范围：
- 烘焙时间: 300-900 秒
- 出锅温度: 180-240 °C
- 一爆时间: 180-480 秒
- 一爆温度: 190-210 °C
- 失重率: >25% 触发警告

### 3. 杯测缺陷超限检测
- Warning: 缺陷点数 >= 2.0
- Critical: 缺陷点数 >= 5.0

### 4. 贴标批号不一致检测
- 检查贴标引用的烘焙批次是否存在
- 检查贴标烘焙日期与烘焙记录是否一致
- 检查同一烘焙批次是否使用了多个生产批号

### 5. 已发货风险检测
- 检查被标记为 Critical 的批次是否已经发货
- 已发货的风险批次标记为 RECALL (需召回)

## 状态持久化

系统会在当前工作目录创建 `.roast_trace_state.json` 文件，用于持久化：
- 人工复核记录
- 导入历史
- 最后检查时间
- 自定义标记

## 示例数据说明

示例数据中包含以下场景用于演示：

1. **R-2024-001**: 正常批次，无异常
2. **R-2024-002**: 烘焙曲线异常（时间过短、温度过高），杯测有轻微缺陷
3. **R-2024-003**: 
   - 引用了不存在的生豆批次 GB-2024-999
   - 杯测缺陷超限 (6.0 点)
   - 使用了两个不同的生产批号
   - **已发货到朝阳大悦城店** → 需召回
4. **R-2024-004**: 正常批次

## 许可证

MIT License
