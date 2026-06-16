# 演出票价动态分层系统

任课老师老叶专用 - 让票价计算明明白白，公式、单位、边界值、结果解释全摆在明处！

## 功能特性

- ✅ **透明计算**: 每一步计算都显示公式、来源、输入值和结果
- ✅ **单位转换**: 支持多币种、多时间单位，避免单位混乱
- ✅ **边界校验**: 输入/输出越界立即报警，错误/警告分级处理
- ✅ **讲义冲突检测**: 数据与课堂讲义说法不一致时，两边证据和建议动作全展示
- ✅ **完整记录追踪**: 保留原始来源、处理时间、失败原因、审核标记
- ✅ **异常不消失**: 算不出来的记录带着原因一起导出，不会悄悄消失
- ✅ **批量处理**: 支持CSV/Excel批量导入导出

## 快速开始

### 1. 安装依赖

```bash
pip3 install -r requirements.txt
```

### 2. 生成示例数据

```bash
python3 cli.py generate-examples
```

会在 `examples/` 目录下生成 `sample_data.csv`，包含9条测试数据：
- 第1-3条：正常计算示例
- 第4条：与讲义冲突示例 - 利润率60%
- 第5条：与讲义冲突示例 - 动态调整75%
- 第6-9条：越界错误示例

### 3. 单条计算

```bash
python3 cli.py calculate \
  --production-cost 500000 \
  --expected-attendance 2000 \
  --profit-margin 0.3 \
  --days-to-show 30 \
  --ticket-sold-rate 0.6 \
  --weekend-factor 0 \
  --verbose
```

### 4. 批量处理

```bash
python3 cli.py batch examples/sample_data.csv \
  -o output/results.csv \
  -ao output/abnormal.csv
```

### 5. 查看公式和配置

```bash
python3 cli.py show-formulas
```

### 6. 仅导出异常清单

```bash
python3 cli.py export-abnormal examples/sample_data.csv -o output/only_abnormal.csv
```

### 7. 查看帮助

```bash
python3 cli.py --help
python3 cli.py calculate --help  # 查看具体命令的帮助
```

## 输入格式

### CSV/Excel 字段说明

| 字段名 | 说明 | 单位 | 示例 |
|--------|------|------|------|
| production_cost | 制作成本 | CNY/USD/EUR | 500000 |
| production_cost_unit | 制作成本单位 | 字符串 | CNY |
| expected_attendance | 预期观众人数 | person/seat | 2000 |
| attendance_unit | 人数单位 | 字符串 | person |
| profit_margin | 利润率 | 0-1 | 0.3 |
| days_to_show | 距离演出天数 | 天 | 30 |
| ticket_sold_rate | 售票率 | 0-1 | 0.6 |
| weekend_factor | 是否周末场 | 0或1 | 0 |
| manual_notes | 人工备注 | 字符串 | 示例说明 |

### 计算公式

**基础票价** (课堂讲义-第3章第2节)
```
(production_cost / expected_attendance) * (1 + profit_margin)
```

**动态倍率** (课堂讲义-第4章第1节)
```
1.0 + (1 / (days_to_show + 1)) * 0.3 + (ticket_sold_rate - 0.5) * 0.5 + weekend_factor * 0.2
```

**最终票价** (课堂讲义-第4章第2节)
```
base_price * dynamic_multiplier
```

### 边界值规则

| 变量 | 最小值 | 最大值 | 单位 | 级别 |
|------|--------|--------|------|------|
| production_cost | 10000 | 10000000 | CNY | 错误 |
| expected_attendance | 50 | 50000 | person | 错误 |
| profit_margin | 0.05 | 1.0 | ratio | 警告 |
| days_to_show | 0 | 365 | day | 错误 |
| ticket_sold_rate | 0 | 1.0 | ratio | 错误 |
| weekend_factor | 0 | 1 | binary | 错误 |
| base_price | 10 | 5000 | CNY | 警告 |
| final_price | 5 | 10000 | CNY | 错误 |

### 票价分层

| 档次 | 价格范围 | 颜色 |
|------|----------|------|
| 经济档 | ¥0 ~ ¥100 | 绿色 |
| 普通档 | ¥100 ~ ¥300 | 蓝色 |
| 中档 | ¥300 ~ ¥600 | 橙色 |
| 高档 | ¥600 ~ ¥1200 | 紫色 |
| VIP档 | >= ¥1200 | 红色 |

## 异常清单怎么看

异常清单导出文件 (`abnormal.csv`) 包含以下关键信息：

1. **abnormal_type**: 异常类型
   - `计算失败`: 边界校验不通过或计算异常
   - `需人工审核`: 存在警告或与讲义冲突
   - `边界警告`: 计算成功但触及警告边界
   - `与讲义冲突`: 数据与课堂讲义说法不一致

2. **error_message**: 具体错误原因
3. **warnings**: 警告信息列表
4. **errors**: 错误信息列表
5. **conflicts_details**: 与讲义冲突的具体说明
6. **review_notes**: 系统自动生成的审核建议

## 课堂讲义要点

- 课堂讲义建议利润率在 **15%-50%** 之间
- 课堂讲义指出动态调整不应超过 **±50%**
- 课堂讲义定义周末为 **周五、周六、周日**

当导入数据与上述要点冲突时，系统会：
1. 标记 `needs_review = 是`
2. 在 `conflicts_details` 中列出冲突项和建议
3. 导出时完整保留这些信息

## 项目结构

```
.
├── cli.py                    # 命令行入口
├── requirements.txt          # 依赖列表
├── README.md                 # 本文档
└── ticket_pricing/
    ├── __init__.py
    ├── config.py             # 配置（公式、边界、分层）
    ├── calculator.py         # 核心计算引擎
    ├── models.py             # 数据模型和记录管理
    └── io_handler.py         # 导入导出处理器
```

## 使用示例场景

### 场景1：顺利处理

```bash
python3 cli.py calculate -pc 500000 -ea 2000 -pm 0.3 -d 30 -tsr 0.6 -v
```
预期：计算成功，显示中档票价

### 场景2：需要返工（越界）

```bash
python3 cli.py calculate -pc 5000 -ea 1000 -pm 0.2 -d 10 -tsr 0.7
```
预期：计算失败，提示"制作成本低于最小值10000CNY"

### 场景3：与讲义冲突（利润率60%）

```bash
python3 cli.py calculate -pc 50000 -ea 200 -pm 0.6 -d 45 -tsr 0.5
```
预期：计算成功，但标记"需人工审核"，提示利润率超出讲义建议范围

### 场景4：与讲义冲突（动态调整75%）

```bash
python3 cli.py calculate -pc 600000 -ea 3000 -pm 0.3 -d 0 -tsr 1.0 -wf 1
```
预期：计算成功，但标记"需人工审核"，提示动态调整75%超出讲义建议的±50%范围

## 后续处理建议

1. 每次批量处理后，先看 `abnormal.csv`
2. 计算失败的记录：检查输入数据是否越界，修正后重新导入
3. 需人工审核的记录：
   - 如果是边界警告：确认数据是否真实，真实则通过
   - 如果是讲义冲突：根据实际业务决策是否调整参数
4. 所有处理痕迹都保留在导出文件中，后面接手的人能看到每一条为什么这么判

## 任课老师老叶专属提醒

- 公式都在 `ticket_pricing/config.py` 里，要改直接改
- 边界值也在同一个文件，单位乱了先查 `units` 配置
- 每一条记录都有 `imported_at` 和 `processed_at` 时间戳
- 异常记录不会丢，导出文件里全带着原因呢！
