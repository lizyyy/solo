# 发酵曲线校准器 (Ferment Calibrator)

一个专为小型发酵实验室设计的本地科学计算 CLI 工具，用于处理和分析酵母、乳酸菌等微生物的发酵实验数据。

## 功能特性

- **数据导入与校验**：自动识别CSV字段名，支持中英文列名，逐行校验数据格式和范围
- **传感器校准**：自动修正pH、温度、溶氧的传感器漂移
- **时间线对齐**：将手动取样的OD600数据与在线传感器时间线自动对齐
- **阶段切分**：基于补料事件和生长速率自动识别滞后期、指数期、稳定期、衰退期
- **指标计算**：最大生长速率、滞后期估计、倍增时间、补料前后变化分析
- **风险检测**：自动检测污染风险、传感器失准、补料记录缺失等异常
- **人工复核**：支持人工确认或驳回风险点，反馈影响后续报告
- **多格式导出**：Markdown实验复盘、CSV指标表、JSON审计包
- **历史查询**：按菌株、批次、风险类型查询历史实验结果

## 项目结构

```
ferment_calibrator/
├── __init__.py              # 包初始化
├── cli.py                   # CLI入口（7个命令）
├── ferment_config.py        # 配置管理模型
├── csv_parser.py            # CSV解析与数据校验
├── calibration.py           # 传感器校准与时间对齐
├── phase_segmentation.py    # 生长阶段切分
├── metrics.py               # 指标计算模块
├── risk_detection.py        # 风险检测规则引擎
├── review_store.py          # 人工复核存储
└── exporter.py              # 报告导出模块

sample_data/                 # 示例数据
├── saccharomyces_b20240501.csv    # 酵母菌发酵数据
├── lactobacillus_b20240502.csv    # 乳酸菌发酵数据
└── invalid_records_test.csv       # 含错误数据的测试文件

tests/                       # 单元测试
├── __init__.py
├── test_ferment_config.py
├── test_csv_parser.py
├── test_calibration.py
├── test_phase_segmentation.py
├── test_metrics.py
├── test_risk_detection.py
├── test_review_store.py
└── test_exporter.py

setup.py                    # 安装配置
README.md                   # 本文件
```

## 安装方式

### 要求

- Python 3.8+
- pip

### 安装步骤

1. 克隆或下载项目到本地

2. 进入项目目录并安装：

```bash
cd /path/to/ferment_calibrator
pip install -e .
```

或者使用开发模式安装：

```bash
pip install -e .[dev]
```

### 验证安装

```bash
ferment-calibrator --help
```

## 快速开始：完整工作流程演示

以下是使用临时目录验证完整工作流程的步骤。

### 1. 创建临时工作目录

```bash
mkdir -p /tmp/ferment_test
cd /tmp/ferment_test
```

### 2. 初始化项目

```bash
ferment-calibrator init
```

这会创建：
- `ferment_config.json` - 项目配置文件
- `output/` - 输出目录
- `imported/` - 已导入数据存储

查看生成的配置：

```bash
cat ferment_config.json
```

### 3. 导入实验数据

首先，将示例数据复制到临时目录：

```bash
# 替换为实际的 sample_data 路径
cp /path/to/sample_data/saccharomyces_b20240501.csv .
cp /path/to/sample_data/lactobacillus_b20240502.csv .
cp /path/to/sample_data/invalid_records_test.csv .
```

导入正常数据：

```bash
ferment-calibrator import-run saccharomyces_b20240501.csv \
    --strain "Saccharomyces cerevisiae" \
    --batch-id "B20240501"
```

导入含错误数据的文件，测试隔离功能：

```bash
ferment-calibrator import-run invalid_records_test.csv \
    --strain "Test Strain" \
    --batch-id "TEST001"
```

查看隔离的坏数据：

```bash
cat output/quarantine.json
```

### 4. 校准数据

```bash
ferment-calibrator calibrate --batch-id "B20240501"
```

校准包括：
- 应用传感器偏移校正
- 修正时间漂移
- 对齐OD600取样数据到传感器时间线

### 5. 分析数据

```bash
ferment-calibrator analyze --batch-id "B20240501"
```

分析会计算：
- 最大生长速率和倍增时间
- 滞后期估计
- 补料前后pH/DO/温度变化
- 溶氧跌落区间
- 自动检测风险点

查看检测到的风险：

```bash
cat output/risk_detection.json
```

### 6. 人工复核风险

查看待复核的风险：

```bash
ferment-calibrator review --list
```

确认某个风险：

```bash
ferment-calibrator review --confirm risk_001 \
    --notes "确认存在轻微pH波动，属于正常范围" \
    --reviewer "研究员A"
```

驳回某个风险：

```bash
ferment-calibrator review --reject risk_002 \
    --notes "这是正常的溶氧变化，不是传感器问题" \
    --reviewer "研究员B"
```

查看复核状态：

```bash
ferment-calibrator review --status
```

### 7. 导出报告

导出所有格式的报告：

```bash
ferment-calibrator export --batch-id "B20240501" --format all
```

或者分别导出：

```bash
# Markdown实验复盘
ferment-calibrator export --batch-id "B20240501" --format markdown

# CSV指标表
ferment-calibrator export --batch-id "B20240501" --format csv

# JSON审计包
ferment-calibrator export --batch-id "B20240501" --format json
```

查看导出的文件：

```bash
ls -la output/
```

查看Markdown报告：

```bash
cat output/B20240501_report.md
```

查看CSV指标：

```bash
cat output/B20240501_metrics.csv
```

查看JSON审计包：

```bash
cat output/B20240501_audit.json
```

### 8. 查询历史记录

导入乳酸菌数据：

```bash
ferment-calibrator import-run lactobacillus_b20240502.csv \
    --strain "Lactobacillus plantarum" \
    --batch-id "B20240502"
```

查询所有历史批次：

```bash
ferment-calibrator history --all
```

按菌株查询：

```bash
ferment-calibrator history --strain "Saccharomyces cerevisiae"
```

按风险类型查询：

```bash
ferment-calibrator history --risk-type contamination
```

按严重程度查询：

```bash
ferment-calibrator history --severity high
```

组合查询：

```bash
ferment-calibrator history --strain "Saccharomyces cerevisiae" --severity high
```

## 命令详解

### init - 初始化项目

```bash
ferment-calibrator init [OPTIONS]
```

**选项：**
- `--output-dir PATH` : 输出目录 (默认: ./output)
- `--force` : 覆盖现有配置

**示例：**
```bash
ferment-calibrator init
ferment-calibrator init --output-dir ./data
ferment-calibrator init --force
```

### import-run - 导入实验数据

```bash
ferment-calibrator import-run [OPTIONS] CSV_FILES...
```

**选项：**
- `--strain TEXT` : 菌株名称 (必填)
- `--batch-id TEXT` : 批次ID (必填)
- `--notes TEXT` : 批次备注

**示例：**
```bash
ferment-calibrator import-run run1.csv --strain "S. cerevisiae" --batch-id "B001"
ferment-calibrator import-run run1.csv run2.csv --strain "L. plantarum" --batch-id "B002"
```

**数据校验规则：**
- 时间格式：支持ISO格式 (2024-05-01 08:00:00)、小时格式 (2.5) 等
- 数值范围：温度 20-40°C，pH 3-8，溶氧 0-100%
- 重复时间点检测
- 阶段枚举验证 (lag, exponential, stationary, decline, feed)
- 缺失字段检测

坏数据会被隔离到 `output/quarantine.json`。

### calibrate - 校准数据

```bash
ferment-calibrator calibrate [OPTIONS]
```

**选项：**
- `--batch-id TEXT` : 批次ID (必填)
- `--save` : 保存校准结果

**校准内容：**
1. **传感器漂移修正**
   - pH: `corrected = (raw + offset) * slope - (drift_per_hour * hours)`
   - 溶氧: 同样公式
   - 温度: 简单偏移校正

2. **OD600时间对齐**
   - 使用线性插值将手动取样的OD600数据对齐到传感器时间线
   - 允许前后30分钟的时间窗口匹配

### analyze - 分析数据

```bash
ferment-calibrator analyze [OPTIONS]
```

**选项：**
- `--batch-id TEXT` : 批次ID (必填)
- `--save` : 保存分析结果

**分析内容：**

**生长指标：**
- 最大生长速率 (μ_max)：滑动窗口线性回归计算
- 滞后期估计：基于生长速率阈值
- 倍增时间：`ln(2) / μ_max`
- 最终OD600

**补料指标：**
- 补料前后pH变化
- 补料前后溶氧变化
- 补料前后温度变化

**溶氧分析：**
- 溶氧跌落区间检测
- 低溶氧持续时间
- 最大跌落速率

**风险检测：**
- 污染风险：pH快速下降、异常OD增长、温度升高
- 传感器失准：长时间恒定读数
- 补料缺失：异常补料间隔
- 快速pH变化、异常溶氧/温度

### review - 人工复核

```bash
ferment-calibrator review [OPTIONS]
```

**选项：**
- `--list` : 列出所有待复核风险
- `--status` : 显示复核统计
- `--confirm TEXT` : 确认指定风险ID
- `--reject TEXT` : 驳回指定风险ID
- `--risk-id TEXT` : 查看特定风险详情
- `--notes TEXT` : 复核备注
- `--reviewer TEXT` : 复核人名称

**示例：**
```bash
# 查看所有待复核风险
ferment-calibrator review --list

# 查看特定风险详情
ferment-calibrator review --risk-id risk_001

# 确认风险
ferment-calibrator review --confirm risk_001 --notes "确认存在污染" --reviewer "张工"

# 驳回风险
ferment-calibrator review --reject risk_002 --notes "正常波动" --reviewer "李工"

# 查看复核统计
ferment-calibrator review --status
```

### export - 导出报告

```bash
ferment-calibrator export [OPTIONS]
```

**选项：**
- `--batch-id TEXT` : 批次ID (必填)
- `--format [markdown|csv|json|all]` : 导出格式 (默认: all)
- `--output-dir PATH` : 输出目录

**导出内容：**

**Markdown报告 (`{batch_id}_report.md`)：**
- 批次基本信息
- 生长指标分析（含表格）
- 补料记录分析
- 阶段切分结果
- 风险检测详情
- 人工复核记录
- 配置快照

**CSV指标表 (`{batch_id}_metrics.csv`)：**
- 批次ID、菌株
- 最大生长速率、滞后期、倍增时间
- 最终OD600、实验时长
- 补料次数、总补料量
- 风险数量

**JSON审计包 (`{batch_id}_audit.json`)：**
- 完整批次信息
- 配置快照
- 所有指标数据
- 阶段切分结果
- 风险检测详情
- 复核记录
- 隔离记录
- 导入统计
- 导出元数据

### history - 查询历史

```bash
ferment-calibrator history [OPTIONS]
```

**选项：**
- `--all` : 显示所有历史记录
- `--strain TEXT` : 按菌株筛选
- `--batch-id TEXT` : 按批次ID筛选
- `--risk-type [contamination|sensor_misalignment|missing_feed_record|...]` : 按风险类型筛选
- `--severity [critical|high|medium|low]` : 按严重程度筛选
- `--output [table|json]` : 输出格式 (默认: table)

**风险类型选项：**
- `contamination` - 污染风险
- `sensor_misalignment` - 传感器失准
- `missing_feed_record` - 补料记录缺失
- `rapid_ph_change` - pH快速变化
- `abnormal_do` - 溶氧异常
- `abnormal_temperature` - 温度异常
- `abnormal_od_growth` - OD生长异常

**示例：**
```bash
# 查看所有历史
ferment-calibrator history --all

# 按菌株查询
ferment-calibrator history --strain "Saccharomyces cerevisiae"

# 按风险类型查询
ferment-calibrator history --risk-type contamination

# 组合查询
ferment-calibrator history --strain "Lactobacillus" --severity high

# JSON格式输出
ferment-calibrator history --all --output json
```

## 配置说明

配置文件 `ferment_config.json` 包含以下部分：

### sensor_calibration - 传感器校准

```json
"sensor_calibration": {
    "pH": {
        "offset": 0.0,
        "slope": 1.0,
        "drift_per_hour": 0.0
    },
    "temperature": {
        "offset": 0.0,
        "slope": 1.0
    },
    "dissolved_oxygen": {
        "offset": 0.0,
        "slope": 1.0,
        "drift_per_hour": 0.0
    }
}
```

### anomaly_thresholds - 异常阈值

```json
"anomaly_thresholds": {
    "temperature": {"min": 20.0, "max": 40.0},
    "pH": {"min": 3.0, "max": 8.0},
    "dissolved_oxygen": {"min": 0.0, "max": 100.0},
    "stirring": {"min": 0, "max": 1000},
    "od600": {"min": 0.0, "max": 5.0},
    "feed_rate": {"min": 0.0, "max": 1000.0}
}
```

### valid_phases - 有效阶段

```json
"valid_phases": ["lag", "exponential", "stationary", "decline", "feed"]
```

### feed_recipes - 补料配方

```json
"feed_recipes": {
    "feedA": {"name": "葡萄糖补料", "description": "50%葡萄糖溶液"},
    "feedB": {"name": "氮源补料", "description": "酵母提取物"},
    "feedC": {"name": "复合补料", "description": "葡萄糖+氮源"}
}
```

### risk_thresholds - 风险阈值

```json
"risk_thresholds": {
    "contamination": {
        "ph_drop_threshold": -0.2,
        "ph_drop_window_hours": 2.0,
        "temp_rise_threshold": 1.5,
        "od_spike_factor": 2.0
    },
    "sensor_drift": {
        "constant_reading_hours": 2.0,
        "no_change_threshold": 0.01
    },
    "missing_feed": {
        "expected_interval_hours": 6.0,
        "tolerance_hours": 1.0
    }
}
```

## CSV字段说明

工具支持以下字段名（自动识别中英文）：

| 字段说明 | 英文列名 | 中文列名 |
|---------|---------|---------|
| 时间 | time, timestamp, Time, Timestamp | 时间, 取样时间, 记录时间 |
| 温度 | temperature, temp, Temperature, Temp | 温度, 罐温, 培养温度 |
| pH | ph, pH, Ph | pH, pH值, 酸碱度 |
| 溶氧 | do, DO, dissolved_oxygen, DissolvedOxygen | 溶氧, 溶解氧, DO |
| 搅拌转速 | stirring, stir, agitation, rpm, Stirring, RPM | 搅拌转速, 搅拌, 转速, RPM |
| OD600 | od600, OD600, od_600, OD_600 | OD600, 取样OD600, 光密度 |
| 补料量 | feed, feed_amount, feed_rate, Feed | 补料量, 补料, 流加速率 |
| 补料配方 | feed_recipe, recipe, FeedRecipe | 补料配方, 配方 |
| 阶段 | phase, stage, Phase, Stage | 阶段, 生长期 |
| 批次备注 | notes, comment, remark, Notes | 批次备注, 备注, 说明 |

## 运行测试

```bash
# 运行所有测试
python -m pytest tests/ -v

# 运行特定模块测试
python -m pytest tests/test_csv_parser.py -v

# 带覆盖率报告
python -m pytest tests/ --cov=ferment_calibrator -v
```

## 常见问题

### Q: 导入数据时提示"无法识别时间格式"怎么办？

A: 工具支持多种时间格式：
- ISO格式: `2024-05-01 08:00:00` 或 `2024-05-01T08:00:00`
- 欧洲格式: `01/05/2024 08:00:00`
- 小时数: `2.5` (表示实验开始后2.5小时)

如果你的时间格式不被支持，可以修改 `csv_parser.py` 中的 `TimeParser` 类。

### Q: 如何校准传感器偏移？

A: 编辑 `ferment_config.json` 中的 `sensor_calibration` 部分：

```json
"pH": {
    "offset": 0.1,      # 偏移校正
    "slope": 1.02,       # 斜率校正
    "drift_per_hour": 0.005  # 每小时漂移量
}
```

校正公式: `corrected = (raw + offset) * slope - (drift_per_hour * hours)`

### Q: 如何添加自定义风险规则？

A: 在 `risk_detection.py` 中扩展 `RiskDetector` 类，添加新的检测方法，然后在 `detect_all_risks` 函数中调用。

### Q: 数据被隔离了，如何查看原因？

A: 查看 `output/quarantine.json` 文件，其中包含：
- 被隔离的原始行数据
- 错误类型
- 错误消息
- 来源文件

### Q: 如何实现批次间比较？

A: 目前 `metrics.py` 提供了 `calculate_batch_similarity` 函数，可以计算两个批次的相似度。你可以：

1. 导出多个批次的指标数据
2. 使用 `calculate_batch_similarity` 进行比较
3. 或者扩展 CLI 添加批次比较命令

## 版本历史

- **v0.1.0** (2024-05-01)
  - 初始版本
  - 实现所有核心命令
  - 数据校验和隔离
  - 传感器校准
  - 风险检测
  - 多格式报告导出

## 许可证

本项目仅供内部使用。

## 联系方式

如有问题或建议，请联系开发团队。
