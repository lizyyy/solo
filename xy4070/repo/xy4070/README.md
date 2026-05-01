# 声场延时校准助手

给小剧场音响师用的本地科学计算 CLI，用于精确校准音箱延时设置。

## 功能特性

- **智能直达峰检测**: 自动识别脉冲响应中的直达声峰，避免将反射峰误判为直达声
- **几何辅助校验**: 利用音箱和测点坐标，估算理论到达时间，辅助峰值识别
- **声速自动估算**: 根据温度、湿度，或从测量数据反推声速
- **相位风险评估**: 分析延时差带来的相位抵消风险
- **人工干预支持**: 支持锁定/排除特定测点，适应复杂现场环境
- **多格式报告**: 导出 Markdown 校准单、CSV 延时表、JSON 审计包

## 安装

```bash
# 开发模式安装
pip install -e ".[dev]"
```

## 快速开始

### 1. 初始化项目

```bash
# 在工作目录创建配置文件
sound-calib init
```

### 2. 导入数据

```bash
# 导入音箱坐标
sound-calib import speakers speakers.csv

# 导入测点坐标
sound-calib import points points.csv

# 导入温湿度数据
sound-calib import climate climate.csv

# 导入脉冲响应 (单个文件)
sound-calib import ir IR_L_A1.csv

# 导入整个目录的脉冲响应
sound-calib import ir-dir measurements/
```

### 3. 数据校验

```bash
# 检查数据完整性和一致性
sound-calib check

# 显示详细信息
sound-calib check -v
```

### 4. 求解延时

```bash
# 自动求解
sound-calib solve

# 指定参考音箱
sound-calib solve --reference L

# 手动指定声速 (覆盖自动估算)
sound-calib solve --speed-of-sound 345.0
```

### 5. 人工调整 (可选)

```bash
# 查看当前覆盖配置
sound-calib override list

# 锁定特定测点 (强制使用该点的测量值)
sound-calib override lock --reason "可靠参考点" pt_1

# 锁定特定音箱的特定测点
sound-calib override lock --speaker L --reason "此点直达声清晰" pt_A1

# 排除特定测点 (忽略该点的测量值)
sound-calib override exclude --reason "反射太强" pt_bad

# 清除所有覆盖
sound-calib override clear
```

### 6. 生成报告

```bash
# 生成所有格式的报告
sound-calib report

# 只生成 Markdown
sound-calib report -f md

# 指定输出文件名
sound-calib report --output 20260501_彩排校准
```

## CSV 文件格式

### 音箱配置 (speakers.csv)

```csv
id,name,x,y,z,group,channel
L,左主音箱,-4.5,0,2.5,主扩,1
R,右主音箱,4.5,0,2.5,主扩,2
C,中置音箱,0,0,2.5,主扩,3
```

**字段说明**:
- `id`: 音箱唯一标识
- `name`: 音箱名称
- `x, y, z`: 三维坐标
- `group` (可选): 音箱组标识
- `channel` (可选): 调音台通道号

### 测点配置 (points.csv)

```csv
id,name,x,y,z,note
A1,观众区前排左,-3,6,1.2,
A2,观众区前排中,0,6,1.2,
A3,观众区前排右,3,6,1.2,
```

### 温湿度数据 (climate.csv)

```csv
timestamp,temperature,humidity,pressure,note
2026-05-01T19:30:00,22.5,55,101.3,彩排前测量
```

**单位说明**:
- `temperature`: 摄氏度 (°C)
- `humidity`: 相对湿度 (%)
- `pressure`: 千帕 (kPa)，可选

### 脉冲响应 CSV

```csv
; Sample Rate: 48000 Hz
time_s,amplitude
0.00000000,0.001234
0.00002083,0.000987
...
```

**格式说明**:
- 第一行可以是注释，以 `;` 或 `#` 开头，可包含采样率信息
- 数据部分: 时间(秒), 幅度
- 支持制表符分隔和空格分隔
- 文件名格式 `IR_{音箱ID}_{测点ID}.csv` 可自动识别

## 临时目录验证流程

以下是完整的验证步骤，使用示例数据：

```bash
# 创建临时测试目录
mkdir -p /tmp/sound-calib-test
cd /tmp/sound-calib-test

# 1. 初始化
sound-calib init

# 2. 复制示例数据 (或使用自己的数据)
cp /path/to/examples/*.csv .
cp -r /path/to/examples/measurements .

# 3. 导入音箱和测点
sound-calib import speakers speakers.csv
sound-calib import points points.csv
sound-calib import climate climate.csv

# 4. 导入脉冲响应
sound-calib import ir-dir measurements/

# 5. 查看当前状态
sound-calib status

# 6. 校验数据
sound-calib check -v

# 7. 求解延时
sound-calib solve

# 8. (可选) 人工调整
# sound-calib override lock pt_A1
# sound-calib override exclude pt_bad

# 9. 重新求解 (如有调整)
# sound-calib solve

# 10. 生成报告
sound-calib report

# 查看生成的文件
ls -la
```

## 相位风险等级说明

| 等级 | 延时差 | 风险描述 | 建议动作 |
|------|--------|----------|----------|
| 🟢 Low | < 0.5ms | 相位影响极小 | 无需调整 |
| 🟡 Medium | 0.5-1.0ms | 中高频可能有影响 | 可考虑微调 |
| 🔴 High | > 1.0ms | 存在显著相位抵消风险 | 建议重点检查 |

## 直达峰检测原理

程序使用以下策略区分直达声和反射声：

1. **时间优先**: 较早出现的峰优先级更高
2. **幅度考虑**: 但不简单取最大峰（可能是反射叠加）
3. **突出度计算**: 使用 prominence 评估峰的独立性
4. **几何辅助**: 如果提供了坐标，用理论到达时间作为搜索窗口
5. **置信度评分**: 综合以上因素给出置信度

## 命令参考

```bash
sound-calib --help
sound-calib init --help
sound-calib import --help
sound-calib check --help
sound-calib solve --help
sound-calib override --help
sound-calib report --help
sound-calib status --help
```

## 运行测试

```bash
pytest tests/ -v
```

## 项目结构

```
sound_field_calibration/
├── __init__.py
├── cli.py                    # CLI 入口
├── models/                   # 数据模型
│   └── __init__.py           # Pydantic 模型定义
├── parsers/                  # CSV 解析器
│   ├── __init__.py
│   └── csv_parser.py         # 各种 CSV 格式解析
├── peak_detection/           # 峰值检测
│   ├── __init__.py
│   └── direct_peak.py        # 直达峰识别算法
├── geometry/                 # 几何计算
│   ├── __init__.py
│   └── calculations.py       # 声速、距离、时间计算
├── validation/               # 数据校验
│   ├── __init__.py
│   └── rules.py              # 校验规则
├── solver/                   # 延时求解
│   ├── __init__.py
│   └── delay_solver.py       # 核心求解算法
└── reports/                  # 报告生成
    ├── __init__.py
    └── generator.py          # Markdown/CSV/JSON 输出
```

## 许可证

MIT License
