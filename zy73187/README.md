# 误差传播错题归因分析

面向竞赛教练日常使用的错题归因工具。所有筛选条件、统计数字、明细表、图表和 CSV 导出都从同一份 `filtered_df` 生成，确保口径完全一致。

## 快速开始

```bash
# 1. 安装依赖
pip3 install -r requirements.txt

# 2. 启动服务
python3 app.py

# 3. 浏览器打开
# http://127.0.0.1:5000
```

启动后就可以直接使用，数据样例已经内置。

## 目录结构

```
.
├── app.py                      # Flask Web 入口
├── requirements.txt
├── data/
│   └── error_samples.csv       # 20 条含后补备注/说明/重复样本/边界样本的脏数据样例
├── src/
│   ├── __init__.py
│   └── error_analysis.py       # 核心分析管线（统一数据源）
├── templates/
│   ├── index.html              # 主页面：筛选、图表、明细、重复提醒、确认差异
│   └── detail.html             # 详情页：重复提醒、后补信息、确认前后对比
├── generate_sample_data.py     # 重新生成 CSV 样例
├── test_selfcheck.py           # 核心模块自测
└── test_web_api.py             # Web API 端到端自测
```

## 设计要点

### 1. 统一数据源口径
[ErrorAnalysisPipeline](src/error_analysis.py) 内部维护 `self.filtered_df`，每次调用 `apply_filters()` 后，所有下游输出——`get_statistics()`、`get_detail_table()`、`get_chart_data()`、`export_csv()`、`detect_duplicates()`、`get_confirm_diffs()`——都读取同一份 DataFrame，保证图表、明细表、统计、CSV 四者完全一致。

### 2. 脏数据样例
`data/error_samples.csv` 共 20 条，刻意包含：
- **后补备注**（`supplementary_remark`）：S003、S009、S014、S020
- **后补说明**（`supplementary_explanation`）：同上四条，用于记录日常工作中事后补充的上下文
- **重复样本**（`is_duplicate=True`）：S003（与 S001 为同一学生重复提交）、S014（同一学生自我修正的重复）
- **边界样本**：S020（样本量不足，属于统计显著性偏弱的边界情况）
- **未人工确认**样本：用于模拟月底还没核完的情况

### 3. 重复样本提醒
- 列表页单独有一块红框「⚠ 重复样本提醒（不是普通记录）」
- 明细页标题带 `⚠ 重复样本 - 非普通记录` 标签，并列出具体警告
- CSV 导出多一列 `is_duplicate_warning`，对重复样本写入「⚠ 重复样本，请核对 duplicate_of 列」
- 重复源（如 S001 被 S003 引用）也会在详情页收到提醒

### 4. 人工确认前后差异
- 列表页有一块橙色框「🔄 人工确认前后差异（用于第二天复盘）」
- 详情页并排展示 `confirm_before_note` 与 `confirm_after_note`
- 提供独立 API：`GET /api/confirm_diffs`，第二天上班可直接拉取

### 5. 复算
顶部筛选栏可选三种误差传播合成公式：
- **方和根 RSS**（默认）：`sqrt(ΣΔ²)`
- **绝对和**：`Σ|Δ|`
- **最大分量**：`max(|Δ|)`

切换公式后，统计数字中的「合成传播误差」和图表会即时反映，明细数据不变。

## 常用操作

| 操作 | 入口 |
| --- | --- |
| 筛选学科/误差类型/来源/轮次等 | 页面顶部筛选栏，点击「应用筛选 & 复算」 |
| 查看某条重复样本的来龙去脉 | 点明细表中的样本 ID，进详情页 |
| 把当前筛选结果导成 CSV | 页面顶部或明细表右上角的「⬇ 导出同口径CSV」 |
| 第二天复盘确认差异 | 直接访问 `/api/confirm_diffs` 或看页面橙色区块 |
| 只看重复样本 | 筛选栏「仅重复样本」选「仅重复」 |
| 只看含后补信息的样本 | 筛选栏「含后补信息」选「仅含后补」 |
| 复算换口径 | 筛选栏「复算公式」切换后点「应用筛选 & 复算」 |

## 自测

```bash
# 核心模块自测
python3 test_selfcheck.py

# 启动服务后跑 Web API 端到端自测
python3 app.py &
python3 test_web_api.py
```

## 新增/替换数据

把自己的 CSV 放到 `data/error_samples.csv`，列名保持与现有一致即可（详见 `generate_sample_data.py` 中的字段说明）。重新运行 `python3 generate_sample_data.py` 会覆盖样例数据。
