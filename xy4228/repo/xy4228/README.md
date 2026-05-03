# FITS 成像质检台

一个给业余天文台值班员用的本地 Python CLI 工具，用于通宵拍摄后的 FITS 图像质量检查。

## 功能特性

- **云检测**: 自动识别被云覆盖的曝光帧
- **星点拖线检测**: 检测导星失误导致的星点拖线
- **曝光/滤镜匹配**: 检查曝光时间和滤镜配置是否符合预期
- **温度匹配**: 确保暗场与光场温度一致，避免混进叠加
- **质量分级**: 给出保留(KEEP)/隔离(ISOLATE)/重拍(RETRY)建议
- **审计报告**: 导出 Markdown、CSV 和 JSON 格式的报告

## 安装

### 依赖要求

- Python 3.8+
- pip

### 安装步骤

```bash
# 克隆或下载项目
cd fits-quality-checker

# 安装依赖
pip install -e .

# 或使用开发模式（包含测试依赖）
pip install -e ".[dev]"
```

### 依赖包

- `astropy`: FITS 文件解析
- `click`: CLI 框架
- `pandas`: 数据处理
- `numpy`: 数值计算
- `scipy`: 科学计算
- `photutils`: 天文图像处理（FWHM 计算等）
- `pydantic`: 数据模型验证
- `rich`: 终端美化

## 快速开始

### 1. 运行演示模式

最快的体验方式是运行演示模式，它会生成示例数据并执行完整的质量分析流程：

```bash
fitsqc demo --save
```

这将：
- 创建示例观测配置
- 生成 20 个模拟 FITS 文件元数据（包含正常文件和有问题的文件）
- 计算质量指标
- 执行规则评估和质量分级
- 生成 Markdown、CSV、JSON 格式的审计报告

### 2. 手动工作流程

#### 步骤 1: 初始化观测配置

```bash
fitsqc init my_observation \
  --observer "张三" \
  --telescope "Celestron 8SE" \
  --camera "ZWO ASI2600MC-Pro" \
  --focal-length 2000 \
  --pixel-size 3.76 \
  --target "M42 猎户座大星云" \
  --expected-temperature -10.0 \
  --fwhm-threshold 3.0
```

#### 步骤 2: 导入文件并校验头信息

```bash
# 导入单个目录
fitsqc --config my_observation import /path/to/fits/files --save

# 导入多个路径
fitsqc --config my_observation import /path/to/lights /path/to/darks --save

# 导入 CSV 元数据（当没有真实 FITS 文件时）
fitsqc --config my_observation import /path/to/metadata.csv --save
```

#### 步骤 3: 分析质量指标

```bash
fitsqc --config my_observation analyze --save
```

这将计算：
- **FWHM**: 半高全宽，衡量星点大小和视宁度
- **圆度**: 星点形状，检测拖线
- **背景噪声**: 图像噪声水平
- **温度匹配**: 暗场与光场的温度一致性

#### 步骤 4: 质量分级

```bash
fitsqc --config my_observation grade --save
```

输出三种状态：
- **KEEP (保留)**: 质量良好，可用于叠加
- **ISOLATE (隔离)**: 有小问题，可保留但不推荐优先使用
- **RETRY (重拍)**: 严重问题，建议重拍

#### 步骤 5: 导出审计报告

```bash
# 导出所有格式
fitsqc --config my_observation report

# 只导出特定格式
fitsqc --config my_observation report --format markdown
fitsqc --config my_observation report --format csv
fitsqc --config my_observation report --format json

# 指定输出目录
fitsqc --config my_observation report --output ./reports
```

## 质量检测规则

### 1. 云检测 (CloudDetection)

检测指标：
- 背景噪声过高 (> 阈值 × 1.5)
- 星点数量过少 (< 10 个)
- 中位流量过低

### 2. 星点拖线检测 (StarTrailDetection)

检测指标：
- 圆度过低 (< 阈值，默认 0.8)
- FWHM 过大 (> 阈值 × 1.5，默认 3.0 像素)

### 3. 曝光匹配 (ExposureMatch)

检查：
- 同组文件曝光时间是否一致
- 曝光次数是否符合预期配置

### 4. 滤镜匹配 (FilterMatch)

检查：
- 滤镜名称是否在预期列表中
- 各滤镜曝光次数是否符合预期

### 5. 温度匹配 (TemperatureMatch)

检查：
- 暗场温度是否与光场一致
- 温度偏差是否超过容差（默认 0.5°C）
- 检测温度异常值

## 配置参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--config-name` | - | 配置名称（必需） |
| `--observer` | None | 观测者姓名 |
| `--telescope` | None | 望远镜型号 |
| `--camera` | None | 相机型号 |
| `--focal-length` | None | 焦距 (mm) |
| `--pixel-size` | None | 像素大小 (um) |
| `--expected-temperature` | None | 期望温度 (°C) |
| `--temperature-tolerance` | 0.5 | 温度容差 (°C) |
| `--fwhm-threshold` | 3.0 | FWHM 阈值 (像素) |
| `--roundness-threshold` | 0.8 | 圆度阈值 (0-1) |
| `--noise-threshold` | 10.0 | 背景噪声阈值 (ADU) |

## 临时目录验证流程

### 1. 创建测试环境

```bash
# 创建临时目录
mkdir -p /tmp/fitsqc_test
cd /tmp/fitsqc_test

# 安装项目（如果还没安装）
pip install -e /path/to/fits-quality-checker
```

### 2. 运行演示

```bash
# 运行演示并保存数据
fitsqc demo --save
```

### 3. 检查生成的文件

```bash
# 查看工作空间结构
ls -la .fitsqc/
ls -la .fitsqc/configs/
ls -la .fitsqc/data/

# 查看生成的报告
ls -la reports/
```

### 4. 手动执行完整流程

```bash
# 初始化新配置
fitsqc init test_config \
  --observer "Test" \
  --telescope "Test Scope" \
  --focal-length 2000 \
  --pixel-size 3.76 \
  --expected-temperature -10

# 创建示例 CSV 元数据
cat > test_metadata.csv << 'EOF'
file_path,file_name,file_type,exposure_time,filter,temperature,gain
/tmp/light_L_0001.fits,light_L_0001.fits,light,300.0,L,-10.0,100
/tmp/light_L_0002.fits,light_L_0002.fits,light,300.0,L,-10.0,100
/tmp/light_L_0003.fits,light_L_0003.fits,light,300.0,L,-10.2,100
/tmp/dark_300s_0001.fits,dark_300s_0001.fits,dark,300.0,Dark,-10.0,100
/tmp/dark_300s_0002.fits,dark_300s_0002.fits,dark,300.0,Dark,-9.8,100
EOF

# 导入 CSV
fitsqc --config test_config import test_metadata.csv --save

# 分析
fitsqc --config test_config analyze --save

# 分级
fitsqc --config test_config grade --save

# 导出报告
fitsqc --config test_config report --output ./test_reports
```

### 5. 清理

```bash
cd /tmp
rm -rf fitsqc_test
```

## 项目结构

```
fits_quality_checker/
├── __init__.py           # 包初始化
├── cli/
│   ├── __init__.py
│   └── main.py           # CLI 入口
├── models/
│   ├── __init__.py
│   └── models.py         # 数据模型定义
├── parsers/
│   ├── __init__.py
│   ├── fits_parser.py    # FITS 头信息解析
│   ├── csv_parser.py     # CSV 元数据解析
│   └── validator.py      # 元数据校验
├── quality/
│   ├── __init__.py
│   ├── metrics.py        # 质量指标计算
│   └── temperature.py    # 温度匹配分析
├── rules/
│   ├── __init__.py
│   ├── rules.py          # 规则定义
│   └── engine.py         # 规则引擎
├── storage/
│   ├── __init__.py
│   ├── config.py         # 配置管理
│   └── persistence.py    # 数据持久化
├── reports/
│   ├── __init__.py
│   └── generator.py      # 报告生成
├── sample_data/
│   ├── __init__.py
│   └── generator.py      # 示例数据生成
└── tests/
    ├── __init__.py
    ├── conftest.py       # pytest fixtures
    ├── test_models.py    # 模型测试
    ├── test_rules.py     # 规则测试
    └── test_storage.py   # 存储测试
```

## 运行测试

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行所有测试
pytest

# 运行测试并显示覆盖率
pytest --cov=fits_quality_checker

# 运行特定测试
pytest tests/test_models.py
pytest tests/test_rules.py -v
```

## 常见问题

### Q: 没有真实的 FITS 文件可以使用吗？

A: 可以！工具支持两种模式：
1. **真实 FITS 模式**: 解析真实的 FITS 头信息和图像数据
2. **CSV 元数据模式**: 从 CSV 文件导入元数据，使用模拟计算

使用 CSV 模式时，质量指标会基于元数据和随机种子生成可重复的模拟值。

### Q: 如何判断一个文件是否被云覆盖？

A: 云检测基于三个指标：
1. **背景噪声**: 云会导致背景噪声显著升高
2. **星点数量**: 云会遮挡星点，导致检测到的星点数量减少
3. **中位流量**: 云会使整体流量降低

当两个或以上指标异常时，会判定为云覆盖。

### Q: 温度容差应该设置多少？

A: 推荐设置：
- 制冷相机: 0.3 - 0.5°C
- 非制冷相机: 2 - 5°C

温度差异过大可能导致暗场校正效果不佳。

## License

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
