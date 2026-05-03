# 工业泵振动模型告警复核工具

一个用于设备可靠性工程师复核工业泵振动模型告警的本地Python工具。

## 功能特性

- **多格式数据解析**: 支持CSV、JSONL、YAML等多种输入格式
- **时间线重建**: 按泵组/班次重建数据时间线
- **特征标准化**: 统一处理振动特征数据
- **轻量聚类**: KMeans/DBSCAN聚类分析，发现同型号泵的异常行为
- **分数漂移检测**: 识别告警分数的显著变化
- **边界案例标记**:
  - 检修后仍高风险
  - 传感器断采
  - 跨午夜班次归属

## 项目结构

```
zy8225/
├── src/
│   └── pump_review/
│       ├── __init__.py      # 模块初始化
│       ├── parser.py        # 数据解析模块
│       ├── analyzer.py      # 规则/聚类分析模块
│       ├── reporter.py      # 报告导出模块
│       └── cli.py           # CLI入口模块
├── sample_data/              # 示例数据目录
│   ├── pump_ledger.csv
│   ├── vibration_features.csv
│   ├── alarm_scores.jsonl
│   ├── maintenance_records.yaml
│   └── generate_sample_data.py
├── output/                   # 输出目录(运行后生成)
│   ├── drift_cases.csv
│   ├── boundary_cases.csv
│   └── pump_drift_review.md
├── requirements.txt
├── setup.py
└── README.md
```

## 安装

### 方式一: 使用pip安装

```bash
cd /path/to/zy8225
pip install -e .
```

### 方式二: 直接运行(无需安装)

```bash
cd /path/to/zy8225
pip install -r requirements.txt
```

## 快速开始

### 一条可跑的Demo命令

这是最简单的运行方式，使用内置示例数据：

```bash
python -m pump_review.cli run --sample -o ./output -v
```

或者安装后使用：

```bash
pump-review run --sample -o ./output -v
```

### 使用自定义示例数据

```bash
# 使用sample_data目录中的数据文件
pump-review run \
    --ledger ./sample_data/pump_ledger.csv \
    --features ./sample_data/vibration_features.csv \
    --scores ./sample_data/alarm_scores.jsonl \
    --maintenance ./sample_data/maintenance_records.yaml \
    -o ./output \
    -v
```

### 生成自己的示例数据

```bash
pump-review generate-sample -o ./my_sample_data
```

## 输入数据格式

### 1. 泵组台账 (CSV)

| 字段 | 类型 | 说明 |
|------|------|------|
| pump_id | string | 泵唯一标识 |
| pump_name | string | 泵名称 |
| model | string | 泵型号 |
| location | string | 安装位置 |
| install_date | date | 安装日期 |
| rated_power | int | 额定功率(kW) |
| rated_flow | int | 额定流量(m³/h) |
| status | string | 当前状态 |

### 2. 振动特征 (CSV)

| 字段 | 类型 | 说明 |
|------|------|------|
| pump_id | string | 泵唯一标识 |
| timestamp | datetime | 时间戳 |
| rms_x/y/z | float | 各方向振动有效值 |
| peak_x/y/z | float | 各方向峰值 |
| kurtosis_x/y/z | float | 峭度 |
| crest_factor | float | 波峰因数 |

### 3. 模型告警分数 (JSONL)

每行一个JSON对象：

```json
{
  "pump_id": "PUMP-001",
  "timestamp": "2024-01-01 00:00:00",
  "score": 0.15,
  "threshold": 0.6,
  "model_version": "v1.2.0"
}
```

### 4. 检修记录 (YAML)

```yaml
maintenance_records:
  - pump_id: PUMP-001
    maintenance_date: "2024-01-15"
    maintenance_type: "预防性维护"
    description: "轴承更换，润滑检查"
    technician: "张三"
    status: "completed"
    next_maintenance_date: "2024-07-15"
```

## 输出文件说明

### 1. drift_cases.csv

漂移案例详情，包含：
- pump_id: 泵ID
- model: 泵型号
- drift_start_time: 漂移开始时间
- drift_end_time: 漂移结束时间
- baseline_score_mean: 基线平均分
- current_score_mean: 当前平均分
- score_change_pct: 分数变化百分比
- cluster_before/after: 聚类变化
- feature_changes: 特征变化
- confidence: 置信度
- is_significant: 是否显著

### 2. boundary_cases.csv

边界案例详情，包含：
- pump_id: 泵ID
- boundary_type: 边界类型
- timestamp: 时间戳
- description: 描述
- severity: 严重程度
- details: 详细信息
- recommendation: 建议

### 3. pump_drift_review.md

完整的Markdown格式复核报告，包含：
1. 分析概览
2. 型号聚类分布
3. 漂移案例分析（显著/潜在）
4. 边界案例分析
   - 检修后仍高风险
   - 传感器断采
   - 跨午夜班次归属
5. 各泵班次汇总
6. 建议行动

## CLI命令参考

### run - 运行分析

```bash
pump-review run [OPTIONS]

选项:
  -l, --ledger PATH        泵组台账 CSV 文件
  -f, --features PATH      振动特征 CSV 文件
  -s, --scores PATH        告警分数 JSONL 文件
  -m, --maintenance PATH   检修记录 YAML 文件
  -S, --sample             使用内置示例数据
  --sample-dir PATH        示例数据目录路径
  -o, --output PATH        输出目录 (默认: ./output)
  --score-threshold FLOAT  告警分数阈值 (默认: 0.6)
  --n-clusters INTEGER     聚类数量 (默认: 3)
  -v, --verbose            显示详细输出
  --help                   显示帮助
```

### generate-sample - 生成示例数据

```bash
pump-review generate-sample [OPTIONS]

选项:
  -o, --output PATH  输出目录 (默认: ./sample_data)
  --help             显示帮助
```

### demo - 演示模式

```bash
pump-review demo [OPTIONS] OUTPUT_DIR

参数:
  OUTPUT_DIR  输出目录路径

选项:
  --sample-dir PATH  示例数据目录(可选)
  --help             显示帮助
```

## 算法说明

### 分数漂移检测

1. **基线建立**: 使用前7天数据作为基线
2. **当前窗口**: 最近的数据窗口
3. **变化检测**:
   - 分数变化 > 50%
   - 当前均值 > 阈值 * 0.8
   - 高分数比例 > 基线比例 * 1.5

### 聚类分析

- 按泵型号分组
- 使用标准化后的振动特征和告警分数
- KMeans聚类（默认3类）
- 检测泵在聚类间的移动

### 边界检测

1. **检修后高风险**: 检修后7天内高分数比例 > 30%
2. **传感器断采**: 数据间隔 > 4小时，或特征缺失率 > 20%
3. **跨午夜班次**: 检测跨越00:00的数据点

## 依赖

- Python >= 3.8
- pandas >= 1.5.0
- numpy >= 1.21.0
- pyyaml >= 6.0
- scikit-learn >= 1.0.0
- click >= 8.0.0

## 许可证

内部使用工具。
