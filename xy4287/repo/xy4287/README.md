# 混响测量批处理员

声学实验室专用工具 - 批量处理声级计导出的impulse/decay CSV文件，自动计算混响时间、清晰度等声学指标。

## 功能特性

- **批量处理**: 支持多房间、多测点CSV文件批量导入
- **数据校验**: 自动校验采样率、时间轴、声压级单位、削波、噪声底、数据缺失等
- **声学计算**: Schroeder积分、自动选择拟合区间、计算RT20/RT30/EDT/C80/D50等指标
- **异常检测**: 自动识别削波、多次反射、非线性衰减、低信噪比等异常情况
- **报告导出**: 支持Markdown、CSV、JSON三种格式的审计报告
- **置信度评估**: 每个拟合结果都有置信度评分，便于判断数据可靠性

## 安装

### 环境要求

- Python >= 3.9
- pip

### 安装步骤

```bash
# 进入项目目录
cd reverb-batch-processor

# 以可编辑模式安装
pip install -e .
```

### 依赖包

项目会自动安装以下依赖：

- numpy >= 1.21.0
- scipy >= 1.7.0
- pandas >= 1.3.0
- click >= 8.0.0
- rich >= 10.0.0

### 开发依赖（可选）

```bash
pip install -e ".[dev]"
```

## 快速开始

### 1. 生成示例数据

首先，让我们生成一些示例数据来测试工具：

```bash
# 创建临时目录
mkdir -p /tmp/reverb_test

# 生成示例数据（包含正常和异常情况）
reverb generate-samples -o /tmp/reverb_test/samples --num-files 3 --include-anomalies
```

这将生成以下文件：
- `room1_point1_1kHz.csv` - 正常数据 (RT60≈0.8s)
- `room1_point2_1kHz.csv` - 正常数据 (RT60≈1.1s)
- `room1_point3_1kHz.csv` - 正常数据 (RT60≈1.4s)
- `anomaly_clipping.csv` - 削波异常
- `anomaly_noise.csv` - 高噪声
- `anomaly_reflections.csv` - 多次反射
- `multi_band_measurement.csv` - 多频段数据

### 2. 验证数据质量

在处理之前，可以先验证数据质量：

```bash
# 验证所有CSV文件
reverb validate /tmp/reverb_test/samples

# 递归验证子目录
reverb validate /tmp/reverb_test/samples -R

# 显示详细信息
reverb validate /tmp/reverb_test/samples -v
```

### 3. 处理数据并生成报告

```bash
# 处理目录并生成报告
reverb process /tmp/reverb_test/samples -o /tmp/reverb_test/reports

# 指定房间名称
reverb process /tmp/reverb_test/samples -o /tmp/reverb_test/reports -r "测试教室"

# 指定输出格式
reverb process /tmp/reverb_test/samples -o /tmp/reverb_test/reports -f markdown

# 显示详细处理信息
reverb process /tmp/reverb_test/samples -o /tmp/reverb_test/reports -v
```

### 4. 查看生成的报告

处理完成后，报告将保存在指定的输出目录：

```bash
# 查看报告文件
ls -la /tmp/reverb_test/reports/

# 查看Markdown报告
cat /tmp/reverb_test/reports/reverb_report_*.md

# 查看CSV报告（可在Excel中打开）
cat /tmp/reverb_test/reports/reverb_report_*.csv

# 查看JSON审计包
cat /tmp/reverb_test/reports/reverb_audit_*.json
```

## 命令说明

### `process` - 处理测量数据

```bash
reverb process [OPTIONS] INPUT_PATH
```

**参数说明：**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `INPUT_PATH` | 输入文件或目录路径（必需） | - |
| `-o, --output` | 输出目录 | - |
| `-r, --room` | 房间名称 | 从目录名推断 |
| `-R, --recursive` | 递归搜索子目录 | False |
| `-f, --format` | 输出格式: markdown/csv/json/all | all |
| `-v, --verbose` | 显示详细信息 | False |

**示例：**

```bash
# 处理单个文件
reverb process measurement.csv -o ./output

# 处理整个目录
reverb process ./measurements -o ./output

# 递归处理所有子目录
reverb process ./project_data -o ./output -R -r "教学楼"
```

### `validate` - 验证数据质量

```bash
reverb validate [OPTIONS] INPUT_PATH
```

**参数说明：**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `INPUT_PATH` | 输入文件或目录路径（必需） | - |
| `-R, --recursive` | 递归搜索子目录 | False |
| `-v, --verbose` | 显示详细信息 | False |

**示例：**

```bash
# 验证单个文件
reverb validate measurement.csv

# 验证目录中的所有文件
reverb validate ./measurements -v
```

### `generate-samples` - 生成示例数据

```bash
reverb generate-samples [OPTIONS]
```

**参数说明：**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-o, --output` | 输出目录路径（必需） | - |
| `-n, --num-files` | 正常数据文件数量 | 3 |
| `--include-anomalies` | 包含异常示例数据 | False |

**示例：**

```bash
# 生成3个正常数据文件
reverb generate-samples -o ./samples -n 3

# 生成包含异常的完整测试数据集
reverb generate-samples -o ./samples -n 5 --include-anomalies
```

## 输出格式说明

### Markdown报告

Markdown报告包含：
- 处理摘要统计
- 各房间、测点详细数据
- 声学指标表格（RT20/RT30/EDT/C80/D50）
- 异常详情和原因
- 拟合参数详情
- 指标说明附录

### CSV报告

CSV报告包含以下列：
- 房间名称
- 测点名称
- 频段
- RT20 (s)、RT20置信度、RT20 R²
- RT30 (s)、RT30置信度、RT30 R²
- EDT (s)、EDT置信度、EDT R²
- C80 (dB)
- D50
- CenterTime (s)
- 异常类型
- 异常原因
- 校验状态

### JSON审计包

JSON报告包含完整的结构化数据：
- 审计信息（生成时间、软件版本）
- 处理摘要统计
- 房间详情列表
  - 测点详情
    - 测量数据元数据
    - 声学指标（含拟合参数）
    - 异常信息
    - 校验结果

## 声学指标说明

### 混响时间指标

| 指标 | 说明 | 计算方法 |
|------|------|----------|
| **RT20** | 衰减20dB外推至60dB | 从-5dB到-25dB线性拟合，乘以3 |
| **RT30** | 衰减30dB外推至60dB | 从-5dB到-35dB线性拟合，乘以2 |
| **EDT** | 早期衰减时间 | 从0dB到-10dB线性拟合，乘以6 |

### 清晰度指标

| 指标 | 说明 | 计算方法 |
|------|------|----------|
| **C80** | 音乐清晰度 | 80ms前后能量比 (dB) |
| **D50** | 语言清晰度 | 50ms内能量占比 |
| **Center Time** | 重心时间 | 能量时间重心 |

### 置信度评估

置信度范围 0.0 - 1.0，基于以下因素计算：

- **R² (决定系数)**: 40%权重
- **衰减速率合理性**: 30%权重
- **残差波动**: 20%权重
- **数据点数量**: 10%权重

**置信度参考：**
- > 0.9: 高可信度
- 0.7 - 0.9: 中等可信度
- < 0.7: 低可信度，建议人工复核

## 异常类型说明

| 异常类型 | 说明 | 可能原因 |
|----------|------|----------|
| **削波** | 信号达到测量设备上限 | 声源过强、麦克风增益过高 |
| **噪声底过高** | 环境噪声过大 | 背景噪声高、测量时间不足 |
| **数据缺失** | 采样数据不完整 | 文件损坏、传输错误 |
| **多次反射干扰** | 存在耦合振动 | 家具共振、结构传声 |
| **非线性衰减** | 衰减曲线非线性 | 耦合房间、复杂声场 |
| **信噪比过低** | 信号与噪声比不足 | 距离过远、环境嘈杂 |

## 数据校验规则

### 采样率校验

- 最小值: 1 Hz
- 建议范围: 10 - 1000 Hz
- 与期望值偏差时发出警告

### 时间轴校验

- 必须单调递增
- 间隔一致性检查
- 过大间隔检测

### 声压级范围校验

- 有效范围: -100 dB ~ 160 dB
- 削波阈值: 150 dB

### 噪声底校验

- 建议最大值: 40 dB
- 最小信噪比: 15 dB

### 数据完整性校验

- 最大允许缺失比例: 5%
- NaN值检测

### 衰减范围校验

- 最小衰减范围: 30 dB（从峰值到噪声底）

## 配置选项

可以通过修改配置来调整校验和计算参数：

```python
from reverb_batch_processor.validator import ValidationConfig
from reverb_batch_processor.acoustics import AcousticsConfig

# 自定义校验配置
val_config = ValidationConfig(
    clipping_threshold=140.0,      # 削波阈值
    noise_floor_max_db=45.0,        # 最大噪声底
    snr_min_db=20.0,                # 最小信噪比
    max_missing_ratio=0.03,         # 最大缺失比例
)

# 自定义声学计算配置
ac_config = AcousticsConfig(
    rt20_range_db=(-3.0, -23.0),    # RT20拟合范围
    rt30_range_db=(-3.0, -33.0),    # RT30拟合范围
    min_fit_points=15,               # 最小拟合点数
)
```

## 项目结构

```
reverb-batch-processor/
├── pyproject.toml              # 项目配置文件
├── README.md                   # 本文档
├── reverb_batch_processor/
│   ├── __init__.py            # 包初始化
│   ├── models.py              # 数据模型定义
│   ├── csv_parser.py          # CSV解析器
│   ├── validator.py           # 数据校验模块
│   ├── acoustics.py           # 声学指标计算
│   ├── fit_rules.py           # 拟合/异常规则
│   ├── processor.py           # 批处理引擎
│   ├── reporter.py            # 报告导出模块
│   ├── cli.py                 # 命令行接口
│   └── sample_data.py         # 示例数据生成器
└── tests/
    ├── __init__.py
    ├── test_models.py         # 数据模型测试
    ├── test_acoustics.py      # 声学计算测试
    ├── test_validator.py      # 数据校验测试
    └── test_csv_parser.py      # CSV解析测试
```

## 运行测试

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行所有测试
pytest

# 运行测试并显示覆盖率
pytest --cov=reverb_batch_processor

# 运行特定测试文件
pytest tests/test_models.py
```

## 支持的CSV格式

### 标准格式

```
时间(s),声压级(dB)
0.000000,90.00
0.010000,89.35
0.020000,88.72
...
```

### 带元数据格式

```
测量信息,
房间,测试教室
测点,测点1
采样率,100 Hz
单位,dB(A)
日期,2024-01-15 14:30:00
频段,1000Hz

时间(s),声压级(dB)
0.000000,90.00
0.010000,89.35
...
```

### 多频段格式

```
时间(s),125Hz,250Hz,500Hz,1000Hz,2000Hz,4000Hz
0.000000,82.00,85.00,88.00,90.00,88.00,85.00
0.010000,81.65,84.55,87.42,89.35,87.42,84.45
...
```

## 常见问题

### Q: 如何处理不同品牌声级计的导出格式？

A: 工具已支持多种常见格式，包括：
- 逗号分隔 (CSV)
- 分号分隔
- Tab分隔
- UTF-8/GBK/GB2312编码

如果遇到不支持的格式，请提供样本文件，我们可以添加支持。

### Q: 如何判断数据质量是否可靠？

A: 关注以下几点：
1. 校验状态是否为"通过"
2. 置信度评分 (>0.7 较为可靠)
3. R² 值 (>0.95 表示线性良好)
4. 是否存在异常标记

### Q: RT20和RT30差异较大说明什么？

A: 较大差异可能表示：
- 衰减曲线非线性
- 存在多次反射干扰
- 噪声底影响
- 建议人工检查原始数据

## 许可证

本项目仅供学术研究和教育使用。

## 联系方式

如有问题或建议，请通过以下方式联系：
- 提交Issue到项目仓库
- 发送邮件给维护者
