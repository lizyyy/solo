# 🥁 鼓手节拍偏差分析

本地 CLI 工具，用于分析架子鼓学生练习录音的节拍稳定性，识别拖拍、抢拍、漏拍等问题，并追踪进步情况。

## ✨ 功能特性

- **节拍偏差分析**：自动检测录音中的节拍点，计算每个节拍的偏差（毫秒）
- **拖拍/抢拍识别**：准确定位哪些小节总是拖拍或抢拍
- **多源 BPM 检测**：结合多种算法检测 BPM，提供完整证据链
- **一致性检查**：当录音分析与参考节拍点结论不一致时，BPM 作为补充证据
- **事件时序追踪**：清晰展示弱拍漏检、BPM 变化、噪声误判的先后顺序
- **数据一致性**：节拍检测结论可在偏差统计和段落标注中相互印证
- **进步分析**：与上次分析结果对比，回答家长"这周有没有进步"的问题
- **人话理由**：所有自动判断都提供自然语言解释，不是冷冰冰的代码值
- **多种输出格式**：终端摘要、HTML 详细报告、JSON 数据

## 📦 安装

```bash
# 克隆项目后，在项目根目录执行
pip install -e .
```

## 🚀 快速开始

### 基本用法

```bash
# 分析单个音频文件
drum-analyzer --input ./audio/song.wav --output ./results

# 分析整个目录下的所有音频
drum-analyzer --input ./audio/ --output ./results/

# 指定参考节拍点文件
drum-analyzer --input ./audio/song.wav --reference ./beats/song.txt --output ./results

# 与上次分析结果比较进步
drum-analyzer --input ./audio/song.wav --previous ./results/last_week.json --output ./results
```

### 高级选项

```bash
# 自定义拍号和BPM
drum-analyzer --input ./audio/song.wav --time-signature 6 8 --bpm 120 --output ./results

# 自定义拖拍抢拍阈值
drum-analyzer --input ./audio/song.wav --lag-threshold 40 --lead-threshold 40 --output ./results

# 只生成 JSON 结果
drum-analyzer --input ./audio/song.wav --output ./results --format json

# 显示详细分析过程
drum-analyzer --input ./audio/song.wav --output ./results --verbose
```

### 所有参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--input, -i` | 输入音频文件或目录 | 必填 |
| `--output, -o` | 输出目录 | 必填 |
| `--reference, -r` | 参考节拍点文件（.txt 或 .json） | 可选 |
| `--previous, -p` | 上次分析结果的 JSON 文件 | 可选 |
| `--time-signature` | 拍号，两个整数 | 4 4 |
| `--bpm` | 参考 BPM | 自动检测 |
| `--lag-threshold` | 拖拍判定阈值（毫秒） | 30 |
| `--lead-threshold` | 抢拍判定阈值（毫秒，正数） | 30 |
| `--format` | 输出格式: text/json/html/all | all |
| `--verbose, -v` | 显示详细分析过程 | False |
| `--batch` | 强制批量处理 | 自动 |

## 📁 参考节拍点文件格式

### TXT 格式（简单）

```
# 时间(秒)  小节内拍号
0.500  1
1.000  2
1.500  3
2.000  4
```

### JSON 格式（详细）

```json
{
  "bpm": 120,
  "time_signature": [4, 4],
  "beats": [
    {"time": 0.500, "beat_type": "downbeat", "measure": 1, "beat_in_measure": 1},
    {"time": 1.000, "beat_type": "weak_beat", "measure": 1, "beat_in_measure": 2}
  ]
}
```

## 📊 输出说明

### 终端摘要

包含：
- 📋 基本信息（文件名、拍号、BPM）
- 📊 总体统计（小节数、节拍数、平均偏差）
- ⚠️  拖拍/抢拍/漏拍小节列表
- 🎯 问题摘要（最严重的小节、整体倾向）
- 🔍 一致性检查（录音 vs 参考节拍点）
- 📈 进步分析（与上次对比）
- 💬 综合评价（人话总结）
- 📐 BPM 证据链（多源检测结果）
- ⏱️  关键事件时序（前 10 条）

### HTML 详细报告

包含终端摘要的所有内容，以及：
- 完整的事件时序追踪，带彩色标记
- 逐小节详细分析，每个节拍的偏差表格
- 一致性检查的 BPM 补充证据
- 进步分析的详细对比
- 响应式设计，手机也能看

### JSON 数据

完整的结构化数据，便于后续处理或与其他系统集成。

## 🧪 运行测试

```bash
# 运行所有测试
python -m pytest tests/ -v

# 运行特定模块测试
python -m pytest tests/test_analyzer.py -v
python -m pytest tests/test_timeline.py -v
python -m pytest tests/test_report.py -v
```

## 🏗️ 项目结构

```
drum_analyzer/
├── __init__.py          # 包初始化
├── models.py            # 数据结构定义
├── analyzer.py          # 核心节拍分析算法
├── timeline.py          # 事件时序追踪
├── report.py            # 报告生成
└── cli.py               # CLI 入口
tests/
├── test_analyzer.py     # 分析器测试
├── test_timeline.py     # 时序追踪测试
└── test_report.py       # 报告生成测试
examples/
├── sample_beats.txt     # TXT 格式示例
└── sample_beats.json    # JSON 格式示例
```

## 📝 核心概念

### 偏差判定阈值

- **拖拍（Lag）**：实际时间 - 期望时间 > 30ms
- **抢拍（Lead）**：实际时间 - 期望时间 < -30ms
- **显著偏差**：绝对值 > 50ms
- **漏拍（Missed）**：超过 150ms 未检测到或置信度为 0
- **噪声（Noise）**：置信度 < 0.3

### 严重级别

- 🔴 **ERROR**：显著偏差、漏拍
- 🟡 **WARNING**：普通拖拍/抢拍、弱拍漏检、BPM 变化
- 🟢 **INFO**：准确节拍、小节开始、噪声误判

### 事件类型

- `measure_start`：小节开始
- `bpm_change`：BPM 变化
- `weak_beat_miss`：弱拍漏检
- `noise_false_positive`：噪声误判
- `significant_deviation`：显著偏差

## 🎯 典型场景

### 场景 1：老师想知道哪些小节总是拖拍

```bash
drum-analyzer -i ./student_recording.wav -o ./analysis_results
```

查看终端摘要中的「拖拍小节」和「问题摘要」，或在 HTML 报告中查看逐小节分析。

### 场景 2：家长问这周有没有进步

```bash
# 上周分析（保存结果）
drum-analyzer -i ./week1/practice.wav -o ./week1_results

# 这周分析，自动对比上周结果
drum-analyzer -i ./week2/practice.wav -o ./week1_results
```

查看「进步分析」部分，会有自然语言说明。

### 场景 3：录音和节拍点结论不一致

工具会自动进行「一致性检查」，并在「BPM 证据链」中列出所有检测到的 BPM 值作为补充证据，给出人话理由解释为什么采纳某个结论。

### 场景 4：弱拍漏检、BPM 变化、噪声误判同时出现

在 HTML 报告的「事件时序追踪」部分，可以清楚看到所有事件的先后顺序，以及相关事件之间的关联说明。

## 📄 License

MIT License
