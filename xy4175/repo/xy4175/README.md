# 轴承振动早筛员

轨道交通检修班组专用的本地 AI/ML 轴承振动异常检测工具。

## 项目概述

列车回库后会导出轴箱振动 CSV、转速工况表和人工检修结论。师傅最怕：
- **轻微剥落**：早期损伤信号微弱，容易被忽略
- **传感器松动**：周期性谐波干扰，容易误判
- **工况混杂**：转速变化导致平均值掩盖局部异常

本工具通过以下技术解决这些问题：
- **分帧处理**：避免平均值掩盖局部异常
- **多维度特征**：时域 + 频域特征提取
- **轻量异常检测**：统计方法 + 机器学习集成
- **规则融合**：专家规则 + AI 模型加权融合
- **人工复核反馈**：支持增量学习，持续优化

## 项目结构

```
xy4175/
├── bearing_vibration_detector/    # 核心包
│   ├── __init__.py               # 包初始化
│   ├── data_parser.py            # 数据解析模块
│   ├── feature_engineering.py    # 特征工程模块
│   ├── model_inference.py        # 模型推理模块
│   ├── rule_fusion.py            # 规则融合模块
│   ├── review_storage.py         # 复核存储模块
│   └── exporter.py               # 导出模块
├── sample_data/                   # 示例数据
│   ├── generate_samples.py       # 示例数据生成器
│   ├── trip_001_*.csv            # 正常数据
│   ├── trip_002_*.csv            # 轻微剥落数据
│   ├── trip_003_*.csv            # 传感器松动数据
│   └── trip_004_*.csv            # 工况混杂数据
├── tests/                         # 测试模块
│   ├── __init__.py
│   └── test_all_modules.py        # 集成测试
├── main.py                        # 主入口程序
├── setup.py                       # 安装配置
├── requirements.txt               # 依赖列表
└── README.md                      # 本文档
```

## 功能模块

### 1. 数据解析 (data_parser.py)

- **导入多趟数据**：自动识别目录中的振动CSV、转速表、检修结论
- **采样率校验**：估计并验证采样率是否符合预期
- **缺测检测**：检查缺失值比例，超过阈值标记为无效
- **转速区间校验**：检查转速是否在有效范围，检测工况混杂

### 2. 特征工程 (feature_engineering.py)

- **分帧处理**：1秒/帧，50%重叠，避免平均值掩盖局部异常
- **时域特征**：均值、RMS、峰值、峭度、峰值因子、波形因子等
- **频域特征**：频谱峰值、频带能量、谐波比率（检测传感器松动）
- **峰值帧识别**：自动识别可能存在冲击信号的帧

### 3. 模型推理 (model_inference.py)

- **轻量异常检测**：
  - 统计方法（Z-score、分位数）
  - 孤立森林 (Isolation Forest)
  - 椭圆包络 (Elliptic Envelope)
  - 局部异常因子 (LOF)
- **异常类型分类**：
  - 正常 (Normal)
  - 轻微剥落 (Spalling)
  - 传感器松动 (Sensor Loose)
  - 冲击性故障 (Impulsive)
  - 整体振动偏高 (Vibration High)

### 4. 规则融合 (rule_fusion.py)

- **四色风险等级**：
  - 🟢 绿色 - 正常
  - 🟡 黄色 - 关注
  - 🟠 橙色 - 警告
  - 🔴 红色 - 紧急
- **加权融合**：AI模型(40%) + 专家规则(35%) + 历史数据(15%) + 异常类型(10%)
- **可解释性**：提供风险证据和建议

### 5. 复核存储 (review_storage.py)

- **人工复核反馈**：支持确认/驳回/修改
- **本地持久化**：JSON格式存储，自动保存
- **历史查询**：按状态、结论、标签、时间查询
- **增量学习**：复核数据可用于模型更新

### 6. 导出模块 (exporter.py)

- **Markdown报告**：包含风险等级、证据摘要、建议、详细分析
- **CSV证据包**：帧风险、特征数据、摘要信息
- **JSON证据包**：完整结构化数据，便于后续处理

## 安装说明

### 环境要求

- Python >= 3.8
- pip

### 安装步骤

1. **克隆/下载项目**
   ```bash
   cd /path/to/xy4175
   ```

2. **创建虚拟环境（推荐）**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # Linux/macOS
   # 或
   venv\Scripts\activate     # Windows
   ```

3. **安装依赖**
   ```bash
   pip3 install -r requirements.txt
   ```

4. **安装项目（开发模式）**
   ```bash
   pip3 install -e .
   ```

## 快速开始

### 临时目录验证流程

#### 1. 生成示例数据

```bash
python3 sample_data/generate_samples.py
```

这将在 `sample_data/` 目录下生成4趟模拟数据：

| 趟次ID | 故障类型 | 说明 |
|--------|----------|------|
| trip_001 | 正常 | 基础振动信号 |
| trip_002 | 轻微剥落 | 周期性冲击信号 |
| trip_003 | 传感器松动 | 强谐波成分 |
| trip_004 | 工况混杂 | 转速变化数据 |

每趟数据包含3个文件：
- `trip_XXX_vibration.csv` - 振动数据
- `trip_XXX_speed.csv` - 转速工况表
- `trip_XXX_inspection.csv` - 人工检修结论

#### 2. 处理单趟数据

```bash
python3 main.py --data-dir ./sample_data --trip-id trip_002
```

或处理整个目录：

```bash
python3 main.py --data-dir ./sample_data
```

#### 3. 指定采样率

```bash
python3 main.py --data-dir ./sample_data --sampling-rate 51200
```

#### 4. 进入交互模式

```bash
python3 main.py --interactive
```

#### 5. 仅处理不导出报告

```bash
python3 main.py --data-dir ./sample_data --no-export
```

### 命令行参数

```bash
python3 main.py --help
```

```
usage: main.py [-h] [--data-dir DATA_DIR] [--trip-id TRIP_ID]
               [--sampling-rate SAMPLING_RATE] [--interactive] [--no-export]
               [--version]

轴承振动早筛员 - 轨道交通轴承振动异常检测工具

options:
  -h, --help            show this help message and exit
  --data-dir DATA_DIR, -d DATA_DIR
                        数据目录路径，包含振动CSV、转速表和检修结论
  --trip-id TRIP_ID, -t TRIP_ID
                        指定趟次ID（可选）
  --sampling-rate SAMPLING_RATE, -sr SAMPLING_RATE
                        采样率（Hz），默认 25600
  --interactive, -i     进入交互模式
  --no-export           不导出报告
  --version, -v         显示版本号

示例:
  # 处理数据目录
  python main.py --data-dir ./sample_data
  
  # 指定采样率
  python main.py --data-dir ./data --sampling-rate 51200
  
  # 进入交互模式
  python main.py --interactive
  
  # 仅处理不导出报告
  python main.py --data-dir ./data --no-export
```

### 交互模式命令

| 命令 | 简写 | 说明 |
|------|------|------|
| process | p | 处理数据目录 |
| review | r | 查看待复核记录列表 |
| submit | s | 提交复核反馈 |
| stats | st | 查看统计信息 |
| quit | q | 退出程序 |
| help | h | 显示帮助 |

## 数据格式

### 振动数据 CSV

```csv
timestamp,vibration
0.0,0.00123
0.0000390625,0.00234
0.000078125,0.00156
...
```

或：

```csv
timestamp,径向,轴向
0.0,0.00123,0.00089
0.0000390625,0.00234,0.00123
...
```

### 转速工况表 CSV

```csv
time,speed
0.0,600.0
0.1,602.5
0.2,598.7
...
```

### 人工检修结论 CSV

```csv
inspection_time,result,comments
2024-01-01T00:00:00,正常 - 无明显异常,
```

## 测试说明

### 运行所有测试

```bash
pytest tests/ -v
```

### 运行特定测试

```bash
pytest tests/test_all_modules.py::TestDataParser -v
```

### 测试覆盖率

```bash
pytest tests/ --cov=bearing_vibration_detector
```

## 输出说明

### 输出目录

- `reports/` - 导出的报告和证据包
- `.review_history/` - 复核记录存储目录

### Markdown 报告结构

1. **基本信息** - 趟次ID、分析时间
2. **风险评估结果** - 整体风险等级、评分、置信度
3. **风险分布** - 各风险等级帧数统计
4. **主要问题** - 检测到的主要异常类型
5. **证据摘要** - 支持风险评估的证据
6. **建议** - 操作建议
7. **详细异常帧分析** - 高风险帧详情
8. **附录** - 数据校验信息、特征统计

## 核心特性

### 1. 解决"平均值掩盖"问题

采用分帧处理策略，每帧独立分析：
- 帧大小：1秒（可配置）
- 帧重叠：50%（确保不遗漏异常）
- 峰值帧检测：识别局部异常

### 2. 检测传感器松动

通过谐波比率分析：
- 计算1x、2x、3x谐波能量占比
- 总和超过阈值判定为松动
- 与冲击信号区分（峭度特征）

### 3. 识别轻微剥落

通过冲击信号特征：
- 高峭度值（>8）
- 高峰值因子（>5）
- 周期性出现

### 4. 工况混杂检测

通过转速波动分析：
- 转速标准差 > 均值的30%
- 标记为工况混杂
- 建议分工况分析

## 常见问题

### Q: 如何处理实际数据？

将你的数据文件按以下格式命名放入同一目录：

```
data_dir/
├── trip_001_vibration.csv
├── trip_001_speed.csv
├── trip_001_inspection.csv (可选)
├── trip_002_vibration.csv
└── ...
```

然后运行：
```bash
python3 main.py --data-dir /path/to/data_dir
```

### Q: 如何调整参数？

编辑 `main.py` 或创建自定义脚本：

```python
from bearing_vibration_detector import (
    DataParser, FeatureEngineer, AnomalyDetector, RuleFusion
)

# 自定义参数
parser = DataParser(
    expected_sampling_rate=51200.0,
    min_sampling_rate=2000.0,
    max_missing_ratio=0.10
)

engineer = FeatureEngineer(
    frame_size=51200,  # 2秒/帧
    frame_overlap=0.25,  # 25%重叠
    sampling_rate=25600.0
)

detector = AnomalyDetector(
    use_ensemble=True,  # 使用集成方法
    anomaly_threshold=0.6  # 降低阈值
)
```

### Q: 如何添加自定义规则？

```python
from bearing_vibration_detector import RuleFusion

custom_rules = {
    "my_custom_rule": {
        "condition": lambda x: x.get("time_rms", 0) > 1.0,
        "severity": 0.7,
        "description": "RMS值超过阈值"
    }
}

rule_fusion = RuleFusion(custom_rules=custom_rules)
```

### Q: 如何使用复核数据优化模型？

```python
from bearing_vibration_detector import ReviewStorage, AnomalyDetector

storage = ReviewStorage()

# 获取标签数据
features_df, labels = storage.get_training_data()

# 用标签数据更新基线
detector = AnomalyDetector(baseline_data=features_df)
```

## 版本历史

- **v1.0.0** - 初始版本
  - 数据解析、特征工程、异常检测、规则融合
  - 复核存储、报告导出
  - 示例数据生成器

## 许可证

本项目仅供内部使用。

## 联系方式

如有问题，请提交Issue或联系维护人员。

---

**注意**：本工具仅供辅助分析，最终检修决策需由专业技术人员确认。
