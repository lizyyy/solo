# 种子发芽率实验记录 CLI

用于多组种子发芽实验的记录验证、补记审计和统计分析工具。

## 功能特性

### 📊 核心功能

1. **实验组导入验证** - 验证配置的实验组是否被正确引用
2. **每日记录可靠性检查** - 检测重复、缺失、格式错误等问题
3. **补记审计** - 补记记录与原始数据的一致性审计
4. **统计分析** - 发芽率、平均发芽天数、发芽速度指数(GSI)计算
5. **报告生成** - 控制台表格、文本报告和图表可视化

### 🔍 检查项目

- ✅ 数据格式验证（日期、数值范围）
- ✅ 实验组引用检查
- ✅ 重复记录检测
- ✅ 累计发芽数单调性检查
- ✅ 漏记天数检测
- ✅ 补记记录审计（记录日期、操作员、说明）
- ✅ 与实验周期的日期一致性检查

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 基本用法

```bash
# 生成样例模板
python -m seed_germination.cli template

# 验证数据
python -m seed_germination.cli validate examples/records_normal.csv -g examples/groups_normal.csv

# 完整分析
python -m seed_germination.cli analyze examples/records_normal.csv -g examples/groups_normal.csv -o output
```

## 数据格式

### 1. 记录文件 (records.csv)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| group_id | 字符串 | 是 | 实验组ID |
| experiment_date | 日期 | 是 | 实验日期（支持多种格式） |
| germinated_count | 整数 | 是 | **累计**发芽种子数 |
| total_seeds | 整数 | 是 | 该组总种子数 |
| record_type | 枚举 | 否 | daily（日常）/ backfill（补记） |
| record_date | 日期 | 补记必填 | 实际记录日期 |
| operator | 字符串 | 补记建议 | 操作员姓名 |
| notes | 字符串 | 补记建议 | 补记原因说明 |

### 2. 实验组配置 (groups.csv)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| group_id | 字符串 | 是 | 实验组ID |
| group_name | 字符串 | 是 | 实验组名称 |
| total_seeds | 整数 | 是 | 总种子数 |
| start_date | 日期 | 建议 | 实验开始日期 |
| end_date | 日期 | 建议 | 实验结束日期 |
| variety | 字符串 | 否 | 品种信息 |
| location | 字符串 | 否 | 种植位置 |
| notes | 字符串 | 否 | 备注 |

## 退出码说明

| 退出码 | 状态 | 含义 | 操作建议 |
|--------|------|------|----------|
| 0 | 通过 | 所有检查通过 | 可用于正式分析 |
| 1 | 警告 | 存在非致命问题 | 建议人工检查后决定是否重跑 |
| 2 | 失败 | 存在错误 | 必须修正数据后重新运行 |

## 输出解读

### 通过的标志（退出码=0）
- 控制台显示绿色 `状态: 通过`
- 审计报告显示 `无审计问题`
- 所有实验组状态为 `正常`

### 警告的标志（退出码=1）
- 控制台显示黄色 `状态: 需关注`
- 审计报告包含 `warning` 级别的发现
- 常见警告类型：
  - `missing_record`: 漏记天数
  - `group_without_records`: 实验组无记录
  - `date_before_start`: 记录早于开始日期
  - `date_after_end`: 记录晚于结束日期

### 失败的标志（退出码=2）
- 控制台显示红色 `状态: 失败`
- 审计报告包含 `error` 级别的发现
- 常见错误类型：
  - `unknown_group`: 引用未配置的实验组
  - `duplicate_daily`: 日常记录重复
  - `cumulative_decrease`: 累计发芽数下降

## 计算口径说明

报告中包含以下统计指标，计算口径如下：

1. **发芽率** = 最终累计发芽数 / 总种子数 × 100%
   - 反映整体发芽潜力

2. **平均发芽天数** = Σ(第n天发芽数 × n) / 总发芽数
   - n = 距离开始日期的天数（第1天=0）
   - 反映发芽速度

3. **发芽速度指数(GSI)** = Σ(第n天发芽率 / n)
   - n = 第n天（从1开始）
   - 综合考虑发芽速度和发芽率

4. **有效记录判定**
   - 排除格式错误记录 (`INVALID`)
   - 排除重复记录 (`DUPLICATE`)
   - 补记记录 (`BACKFILLED`) 会覆盖同日的日常记录

## 验收场景演示

### 场景1：正常处理

使用 `records_normal.csv`：
- 3个实验组，14天完整记录
- 无格式错误、无重复、无漏记
- 预期结果：退出码=0，状态=通过

```bash
python -m seed_germination.cli analyze examples/records_normal.csv -g examples/groups_normal.csv -o output_normal
```

### 场景2：失败原因

使用 `records_with_errors.csv`，包含以下问题：
- Control组4月14日重复记录（2条daily）
- Unknown组引用不存在的实验组
- TreatA组4月6日记录55，4月7日75，累计增长正常
- 预期结果：退出码=2，状态=失败

```bash
python -m seed_germination.cli analyze examples/records_with_errors.csv -g examples/groups_normal.csv -o output_error
```

查看审计报告：
```bash
cat output_error/audit_report.txt
```

### 场景3：修正后重跑

使用 `records_fixed.csv`，修正方案：
- 删除Control组4月14日的重复记录
- 删除Unknown组的记录
- 添加TreatA组4月6日的补记记录（55→62），并注明原因
- 预期结果：退出码=1或0（取决于是否还有警告）

```bash
python -m seed_germination.cli analyze examples/records_fixed.csv -g examples/groups_normal.csv -o output_fixed
```

## 项目结构

```
seed_germination/
├── __init__.py          # 包初始化
├── cli.py               # CLI入口
├── models.py            # 数据模型定义
├── data_loader.py       # 数据加载和验证
├── statistics.py        # 统计计算
├── analyzer.py          # 分析引擎
└── reporter.py          # 报告生成
examples/
├── groups_normal.csv    # 实验组配置样例
├── records_normal.csv   # 正常数据样例
├── records_with_errors.csv # 含错误数据样例
└── records_fixed.csv    # 修正后数据样例
```

## 补记审计最佳实践

1. **补记必须标注**：将 `record_type` 设为 `backfill`
2. **记录日期**：填写实际补记的日期（`record_date`）
3. **操作员**：填写执行补记的人员姓名
4. **原因说明**：在 `notes` 中说明补记原因
5. **不删除原记录**：补记记录会覆盖同日的日常记录，便于审计

## 许可证

MIT License
