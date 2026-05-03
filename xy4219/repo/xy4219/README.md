# 短视频投放复盘工具

一个专为短视频投放负责人设计的本地 Streamlit 复盘工具，支持抖音、小红书、视频号多平台数据整合与智能分析。

## 功能特性

### 📊 核心功能
- **多平台数据整合**: 自动识别并解析抖音、小红书、视频号导出的 CSV 数据
- **字段映射与校验**: 不同平台字段名自动映射，数据类型自动转换
- **统一指标计算**: 花费、曝光、点击、转化、CPA、ROI 等核心指标统一计算
- **素材疲劳度检测**: 基于 CTR、花费、转化趋势分析素材衰退情况
- **智能异常检测**: 自动识别花费突增、转化断崖、低 ROI、高 CPA 等异常
- **跨平台对比分析**: 同一素材在不同平台的表现差异自动对比

### 🎨 可视化与交互
- **多维度筛选**: 支持平台、日期、素材 ID 灵活筛选
- **趋势图表**: 花费、转化、ROI、CPA、CTR 多维度趋势可视化
- **素材分析**: 素材排名、疲劳度预警、花费 vs ROI 散点分析
- **异常明细**: 异常类型、严重程度、详情展开查看

### 📋 数据导出
- **Markdown 复盘报告**: 一键生成包含数据概览、素材分析、异常检测、复盘建议的完整报告
- **CSV 汇总导出**: 每日指标、素材指标、平台汇总数据导出

## 项目结构

```
xy4219/
├── app.py                  # 主应用入口 (Streamlit)
├── data_parser.py          # 数据解析模块 - 字段映射与校验
├── metrics_calculator.py   # 指标计算模块 - 指标计算与疲劳度分析
├── rule_engine.py          # 规则引擎模块 - 异常检测规则
├── visualization.py        # 可视化模块 - Plotly 图表生成
├── exporter.py             # 导出模块 - Markdown 报告与 CSV 导出
├── sample_data.py          # 示例数据模块 - 生成模拟数据
├── requirements.txt        # Python 依赖
└── README.md               # 项目文档
```

## 模块说明

### 1. data_parser.py - 数据解析器
- `PlatformSchema`: 定义各平台字段映射规则
- `DataParser`: 核心解析类
  - `detect_platform()`: 自动识别数据所属平台
  - `normalize_data()`: 标准化数据字段和类型
  - `parse_transaction_data()`: 解析成交数据
  - `merge_all_data()`: 合并多平台和成交数据

**支持的平台字段映射**:

| 指标 | 抖音 | 小红书 | 视频号 |
|------|------|--------|--------|
| 日期 | 日期 | 日期 | 日期 |
| 素材ID | 素材ID | 笔记ID | 创意ID |
| 花费 | 消耗(元) | 花费(元) | 消耗金额(元) |
| 曝光 | 展示次数 | 曝光量 | 曝光次数 |
| 点击 | 点击次数 | 点击量 | 点击次数 |
| 转化 | 转化数 | 转化量 | 转化个数 |

### 2. metrics_calculator.py - 指标计算器
- `calculate_basic_metrics()`: 计算 CTR、CPC、CPM、CPA、ROI
- `aggregate_by_date()`: 按日期-平台聚合指标
- `aggregate_by_material()`: 按素材-平台聚合指标
- `calculate_fatigue()`: 计算素材疲劳度得分
- `get_overall_summary()`: 获取整体数据汇总

**疲劳度计算逻辑**:
- CTR 下降趋势权重: 40%
- 花费上升趋势权重: 30%
- 转化下降趋势权重: 30%
- 疲劳阈值: 30分 (默认)

### 3. rule_engine.py - 规则引擎
- `AnomalyType`: 异常类型枚举
  - `SPEND_SURGE`: 花费突增
  - `CONVERSION_CLIFF`: 转化断崖
  - `CROSS_PLATFORM_DIFF`: 跨平台表现差异
  - `LOW_ROI`: ROI过低
  - `HIGH_CPA`: CPA过高

**默认阈值配置**:
- 花费突增阈值: 2.0倍
- 转化断崖阈值: 0.5倍 (即下降50%)
- ROI过低阈值: 1.0
- CPA过高阈值: 50元
- 跨平台差异阈值: 2.0倍

### 4. visualization.py - 可视化
- `create_spend_trend_chart()`: 花费趋势图
- `create_conversion_trend_chart()`: 转化趋势图
- `create_roi_trend_chart()`: ROI趋势图
- `create_cpa_trend_chart()`: CPA趋势图
- `create_ctr_cpc_chart()`: CTR&CPC双轴图
- `create_platform_comparison_chart()`: 平台对比图
- `create_material_ranking_chart()`: 素材排名图
- `create_fatigue_analysis_chart()`: 疲劳度分析散点图
- `create_spend_vs_roi_scatter()`: 花费vsROI散点图

### 5. exporter.py - 数据导出
- `generate_markdown_report()`: 生成完整 Markdown 复盘报告
  - 数据概览 (整体指标 + 平台分布)
  - 素材分析 (Top素材 + 疲劳预警)
  - 异常检测 (各类异常明细)
  - 复盘建议 (基于异常的智能建议)
- `generate_summary_csv()`: 导出多份 CSV 汇总
  - `daily_metrics.csv`: 每日指标
  - `material_metrics.csv`: 素材指标
  - `platform_summary.csv`: 平台汇总

### 6. sample_data.py - 示例数据生成器
生成包含预设异常的模拟数据，用于演示和测试：
- 抖音数据: 5个素材，14天
- 小红书数据: 4个素材，14天
- 视频号数据: 3个素材，14天
- 成交数据: 14天的订单和金额

**预设异常场景**:
- MAT002 在第13天花费突增4倍
- MAT003 在第9天转化断崖 (下降75%)
- MAT001 在抖音后期 CTR 下降 (疲劳模拟)
- 同素材跨平台表现差异

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动应用

```bash
streamlit run app.py
```

应用将自动在浏览器中打开 (默认地址: http://localhost:8501)

### 3. 使用应用

**方式一: 使用示例数据**
1. 在左侧边栏勾选"使用示例数据"
2. 点击"加载示例数据"
3. 体验完整功能

**方式二: 上传真实数据**
1. 从各平台后台导出 CSV 数据
2. 在对应平台的上传组件中选择文件
3. (可选) 上传成交数据用于 ROI 计算
4. 点击"开始处理数据"

**平台数据导出指南**:

**抖音**:
- 登录巨量引擎后台
- 进入「报表」→「自定义报表」
- 选择日期范围
- 导出字段: 日期、素材ID、消耗(元)、展示次数、点击次数、转化数

**小红书**:
- 登录小红书专业号后台/蒲公英平台
- 进入「数据中心」→「投放数据」
- 导出字段: 日期、笔记ID、花费(元)、曝光量、点击量、转化量

**视频号**:
- 登录微信公众平台
- 进入「视频号」→「数据中心」→「投放数据」
- 导出字段: 日期、创意ID、消耗金额(元)、曝光次数、点击次数、转化个数

**成交数据** (可选):
- 支持任意包含日期和金额的 CSV
- 自动识别字段: 日期/date/Date/下单时间/订单日期, 订单金额/成交金额/GMV/金额/amount/revenue

### 4. 数据分析

**筛选数据**:
- 在左侧边栏选择平台
- 调整日期范围
- (可选) 选择特定素材ID

**查看各功能页**:
- **数据概览**: 核心指标卡片 + 平台分布 + 原始数据
- **趋势分析**: 多维度趋势图表 + 完整数据表格
- **素材分析**: 素材排名 + 疲劳度分析 + 散点图
- **异常检测**: 异常明细 + 详情展开
- **数据导出**: 生成报告 + 下载 CSV

## 指标定义

| 指标 | 公式 | 说明 |
|------|------|------|
| CTR | 点击 / 曝光 × 100% | 点击率 |
| CPC | 花费 / 点击 | 单次点击成本 |
| CPM | 花费 / 曝光 × 1000 | 千次展示成本 |
| CPA | 花费 / 转化 | 单次转化成本 |
| ROI | 成交金额 / 花费 | 投资回报率 |
| 疲劳度得分 | 综合CTR下降、花费上升、转化下降 | 素材衰退程度 (0-100) |

## 自定义配置

### 异常检测阈值
在 `rule_engine.py` 中调整 `RuleEngine` 类的初始化参数:

```python
rule_engine = RuleEngine()
rule_engine.spend_surge_threshold = 2.5      # 花费突增阈值
rule_engine.conversion_cliff_threshold = 0.4  # 转化断崖阈值
rule_engine.low_roi_threshold = 1.2            # ROI过低阈值
rule_engine.high_cpa_threshold = 60.0          # CPA过高阈值
```

### 疲劳度检测阈值
在 `metrics_calculator.py` 中调整 `MetricsCalculator` 类:

```python
calculator = MetricsCalculator()
calculator.fatigue_threshold = 0.4  # 疲劳阈值 (默认0.3)
calculator.fatigue_days = 10        # 分析天数 (默认7天)
```

## 常见问题

### Q: 上传文件后提示"字段缺失"怎么办？
A: 检查导出的 CSV 是否包含必要字段，或查看 `data_parser.py` 中的平台字段定义，确保字段名匹配。

### Q: ROI 显示为 0 是什么原因？
A: ROI 计算需要成交数据关联。如果未上传成交数据，或成交数据的日期字段与投放数据无法匹配，ROI 将为 0。

### Q: 如何添加新平台支持？
A: 在 `data_parser.py` 的 `PLATFORMS` 字典中添加新平台的 `PlatformSchema` 定义，包含各字段的映射关系。

### Q: 报告中的"复盘建议"是如何生成的？
A: 复盘建议基于检测到的异常自动生成，包括:
- 花费突增 → 检查预算和流量
- 转化断崖 → 检查页面、库存、人群
- 疲劳素材 → 建议更换优化
- 低ROI → 建议暂停或优化转化
- 跨平台差异 → 建议调整策略

## 更新日志

### v1.0.0 (2026-05-03)
- 初始版本发布
- 支持抖音、小红书、视频号三平台
- 核心指标计算与可视化
- 异常检测与素材疲劳度分析
- Markdown 报告与 CSV 导出

## 许可证

MIT License

## 联系方式

如有问题或建议，欢迎提交 Issue 或 PR。
