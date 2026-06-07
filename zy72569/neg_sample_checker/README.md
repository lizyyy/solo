# 序列推荐负采样检查工具

## 项目简介

这是一个用于序列推荐负采样数据质量检查的工具。它不是给演示会看的空壳，而是能真正跑起来的实用工具。即使是一位新人，照着这份 README 也能从样例跑到报告。

## 核心自检项

工具覆盖了最容易出错的四个检查点：

1. **重复导入检查** — 防止同一份数据被重复导入多次
2. **少数类样本被总指标盖住检查** — 当少数类（占比<5%）的指标与总指标差异较大时，会发出警告，提醒不要直接归为正常
3. **补录后重算** — 补录数据后自动重新运行所有检查
4. **导出一致** — 确保导出的数据与原始数据一致

## 核心工作流

三步标准流程：

```
步骤1: 负样本列表第一次导入
    ↓
步骤2: 数据科学家林姐补看召回候选表
    ↓
步骤3: 阈值回放更新
```

**重要原则：**
- 碰到少数类样本被总指标盖住时，**别急着归正常**，留给算法工程师复核
- 负样本列表和召回候选表互相矛盾时，**先列出冲突证据**，让林姐选确认或驳回，**不要替业务同事自动拍板**

## 目录结构

```
neg_sample_checker/
├── main.py                  # 主程序入口
├── requirements.txt         # 依赖包
├── README.md               # 本文档
├── config/
│   └── settings.yaml        # 配置文件
├── src/
│   ├── __init__.py
│   ├── data_models.py       # 数据模型定义
│   ├── checks.py            # 核心检查逻辑
│   ├── workflow.py          # 工作流引擎
│   └── reporter.py          # 报告生成
├── data/                    # 样例数据
│   ├── normal/              # 正常材料
│   ├── wrong_caliber/       # 错口径材料（含问题）
│   └── supplement/          # 补录材料
└── reports/                 # 报告输出目录
```

## 快速开始

### 1. 安装依赖

```bash
cd neg_sample_checker
pip install -r requirements.txt
```

### 2. 运行样例（三种场景）

#### 场景一：正常材料

```bash
python main.py --mode batch --scenario normal
```

**预期结果：**
- 重复导入检查：通过
- 少数类检查：通过（分布均衡）
- 负样本与召回候选表一致性：通过
- 阈值回放：通过

#### 场景二：错口径材料

```bash
python main.py --mode batch --scenario wrong_caliber
```

**预期结果：**
- 重复导入检查：通过
- 少数类检查：**警告** — 检测到 label=2 的少数类（占比约13%），其 click_rate 与总指标差异超过90%
- 负样本与召回候选表一致性：**警告** — 检测到多条标签冲突
- 阈值回放：通过，但会提醒少数类样本需要算法工程师复核

#### 场景三：补录材料

```bash
python main.py --mode batch --scenario supplement
```

**预期结果：**
- 先运行初始数据检查
- 自动应用 supplement.csv 补录数据
- 补录后自动重新运行所有检查
- 生成最终报告

### 3. 交互模式（完整流程体验）

```bash
python main.py --mode interactive
```

按照提示依次操作：
1. 输入负样本列表路径：`data/wrong_caliber/neg_samples.csv`
2. 输入召回候选表路径：`data/wrong_caliber/recall_candidates.csv`
3. 看到冲突时，手动选择确认或驳回（体验林姐的决策过程）
4. 输入阈值或使用默认值
5. 选择是否补录数据
6. 查看生成的报告

## 查看报告

运行完成后，报告生成在 `reports/` 目录下：

- `report_*.json` — 结构化数据，便于程序处理
- `report_*.html` — 可视化报告，用浏览器打开查看

```bash
# 在浏览器中打开报告
open reports/report_wrong_caliber.html
```

HTML 报告包含：
- 检查概览（步骤完成情况、警告/错误数量）
- 每一步的详细检查结果
- 冲突证据对比（负样本 vs 召回候选表）
- 人工确认/驳回按钮（模拟林姐操作）
- 历史记录对比表
- 重要提示区（提醒不要自动拍板）

## 数据格式要求

### 输入 CSV 必须包含的字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| user_id | int | 用户ID |
| item_id | int | 物品ID |
| timestamp | int | 时间戳 |
| label | int | 标签（0/1/2...） |
| score | float | 模型预测分数 |
| click_rate | float | 点击率指标 |
| conversion_rate | float | 转化率指标 |

### 样例数据说明

- **normal/** — 标准的正负样本分布，无冲突
- **wrong_caliber/** — 包含 label=2 的少数类，且召回候选表中部分标签与负样本列表不一致
- **supplement/** — 初始只有10条数据，补录后增加10条

## 配置说明

编辑 `config/settings.yaml` 可调整参数：

```yaml
checks:
  duplicate_detection:
    key_fields: ["user_id", "item_id", "timestamp"]  # 重复检测的关键字段
  
  minority_class_detection:
    minority_threshold: 0.05      # 少数类判定阈值（占比<5%）
    metric_fields: ["click_rate", "conversion_rate"]  # 需要检查的指标字段

threshold:
  default: 0.5                    # 默认阈值
  require_manual_review: true     # 少数类需要人工复核
```

## 典型使用场景

### 场景：算法工程师晚上催结果

1. 运行工具，导入负样本列表
2. 工具自动检测到：有一条 label=2 的少数类样本，其点击率只有 0.02，但总指标是 0.25，差异很大
3. 工具发出**警告**，建议："少数类样本请勿直接归为正常，留给算法工程师复核"
4. 对比召回候选表时，发现有3条记录标签不一致
5. 工具列出所有冲突证据，不做自动判断
6. 你把报告发给林姐，林姐看完后确认或驳回
7. 最后生成带决策结果的正式报告发给算法工程师

## 常见问题

**Q: 为什么不自动解决冲突？**
A: 标签定义涉及业务逻辑，工具只负责发现问题，决策权在数据科学家林姐和算法工程师手中。

**Q: 少数类占比超过5%还会检查吗？**
A: 会的，只要少数类的指标与总指标差异超过20%，就会发出警告。

**Q: 补录数据后需要重新跑一遍吗？**
A: 不用，工具会自动重新运行重复导入检查和少数类检查。

## 开发说明

核心模块：

- [data_models.py](src/data_models.py) — 数据类定义（CheckResult, ConflictEvidence, WorkflowStep等）
- [checks.py](src/checks.py) — 四个核心检查函数
- [workflow.py](src/workflow.py) — 三步工作流引擎，冲突处理，补录重算
- [reporter.py](src/reporter.py) — HTML/JSON 报告生成
