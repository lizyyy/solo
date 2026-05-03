# 窑炉烧成曲线复盘器

一个用于陶艺工作室的本地 Python 工具，用于分析窑炉烧成曲线、计算各阶段偏差、评估分层风险，并支持人工备注复盘和报告导出。

## 功能特性

- 📊 **数据分析**: 导入热电偶温度 CSV、目标烧成曲线 YAML、窑车装载 JSON 和成品瑕疵记录
- 📈 **偏差计算**: 计算各阶段温度偏差、升温/冷却速率偏差、保温时间偏差
- 🔥 **热量积分**: 计算各阶段热量积分，评估欠烧/过烧风险
- 🧱 **分层风险评估**: 基于规则引擎评估各层位热滞后、升温过冲、冷却过快等风险
- 📝 **人工复盘**: 支持创建复盘会话、添加笔记、记录结论和改进建议
- 📄 **报告导出**: 导出 Markdown 报告和 CSV/JSON 结果包

## 项目结构

```
kiln_analyzer/
├── __init__.py
├── version.py
├── models.py              # 数据模型定义
├── cli/
│   ├── __init__.py
│   └── main.py            # CLI 主入口
├── parsers/
│   ├── __init__.py
│   ├── base.py            # 解析器基类
│   ├── csv_parser.py      # 热电偶 CSV 解析
│   ├── yaml_parser.py     # 目标曲线 YAML 解析
│   └── json_parser.py     # 装载/瑕疵 JSON 解析
├── thermal/
│   ├── __init__.py
│   ├── deviation_calculator.py    # 阶段偏差计算
│   └── heat_integral.py           # 热量积分计算
├── rules/
│   ├── __init__.py
│   └── risk_engine.py     # 风险评估规则引擎
├── storage/
│   ├── __init__.py
│   └── review_store.py    # 复盘会话存储
└── report/
    ├── __init__.py
    ├── markdown_exporter.py      # Markdown 报告导出
    └── result_exporter.py        # CSV/JSON 结果导出

examples/                  # 示例数据
├── sample_tc_data.csv     # 热电偶温度示例
├── sample_curve.yaml      # 目标曲线示例
├── sample_kiln_load.json  # 窑车装载示例
└── sample_defects.json    # 瑕疵记录示例

tests/                     # 测试用例
├── __init__.py
├── test_parsers.py
├── test_thermal.py
└── test_rules.py
```

## 快速开始

### 环境要求

- Python 3.10+
- pip

### 安装

```bash
# 克隆项目后
cd xy4276

# 安装依赖
pip install -e .

# 或者安装开发依赖
pip install -e ".[dev]"
```

### 验证安装

```bash
# 查看帮助
kiln-analyzer --help

# 查看版本
kiln-analyzer --version
```

## 使用指南

### 1. 分析烧成数据

```bash
# 使用示例数据分析
kiln-analyzer analyze \
    --tc-data examples/sample_tc_data.csv \
    --curve examples/sample_curve.yaml \
    --load examples/sample_kiln_load.json \
    --defects examples/sample_defects.json \
    --output results/ \
    --markdown --json --csv
```

#### 参数说明

| 参数 | 简称 | 必填 | 说明 |
|------|------|------|------|
| `--tc-data` | `-t` | 是 | 热电偶温度数据 CSV 文件 |
| `--curve` | `-c` | 是 | 目标烧成曲线 YAML 文件 |
| `--load` | `-l` | 否 | 窑车装载 JSON 文件 |
| `--defects` | `-d` | 否 | 成品瑕疵记录 JSON 文件 |
| `--batch-id` | `-b` | 否 | 指定批次 ID（自动推断或指定） |
| `--output` | `-o` | 否 | 输出目录路径 |
| `--markdown` | `-m` | 否 | 导出 Markdown 报告 |
| `--json` | `-j` | 否 | 导出 JSON 结果包 |
| `--csv` | `-C` | 否 | 导出 CSV 结果包 |

### 2. 管理复盘会话

#### 创建新复盘会话

```bash
kiln-analyzer new-session \
    --batch-id BATCH_20260503_001 \
    --author "张师傅"
```

#### 列出现有会话

```bash
kiln-analyzer list-sessions
```

#### 添加复盘笔记

```bash
kiln-analyzer add-note \
    --session-id abc12345 \
    --content "上层冷却速率过快，可能导致釉裂" \
    --category "问题" \
    --author "李师傅" \
    --layer "top" \
    --phase "cooling"
```

#### 笔记分类

- `观察`: 一般观察记录
- `建议`: 改进建议
- `问题`: 发现的问题
- `教训`: 经验教训

#### 添加复盘结论

```bash
kiln-analyzer add-conclusion \
    --session-id abc12345 \
    --conclusion "本次烧成主要问题为上层冷却过快，导致釉裂" \
    --recommendation "下次烧成降低冷却速率，特别是上层区域" \
    --recommendation "检查热电偶安装位置是否正确"
```

### 3. 导出完整报告

```bash
kiln-analyzer export-report \
    --session-id abc12345 \
    --tc-data examples/sample_tc_data.csv \
    --curve examples/sample_curve.yaml \
    --load examples/sample_kiln_load.json \
    --output reports/full_report.md
```

## 数据格式说明

### 热电偶温度 CSV

```csv
timestamp,elapsed_seconds,TC1,TC2,TC3,TC4
2026-05-03 08:00:00,0,25.0,25.0,25.0,24.5
2026-05-03 08:05:00,300,125.0,120.0,115.0,100.0
```

- `timestamp`: 时间戳（格式：`%Y-%m-%d %H:%M:%S`）
- `elapsed_seconds`: 经过时间（秒，可选）
- `TC1/TC2/TC3/TC4`: 各热电偶温度（°C）

### 目标烧成曲线 YAML

```yaml
name: "标准氧化烧成曲线"
description: "适用于中温釉陶瓷的标准氧化烧成曲线"

phases:
  - name: "低温升温"
    type: "heating"      # heating/holding/cooling 或 升温/保温/冷却
    start_temp: 25
    end_temp: 600
    duration: "30m"       # 支持 "30m"、"1h"、"1.5h" 或秒数
    rate: 19.2            # 目标速率 (°C/min)
    notes: "室温到600°C，慢速升温排除水分"

  - name: "高温保温"
    type: "holding"
    start_temp: 1240
    end_temp: 1240
    duration: "1h"
    notes: "1240°C保温60分钟"

  - name: "冷却阶段"
    type: "cooling"
    start_temp: 1240
    end_temp: 850
    duration: "2h"
    notes: "控制冷却速率防止釉裂"
```

### 窑车装载 JSON

```json
{
  "batch_id": "BATCH_20260503_001",
  "load_date": "2026-05-03T08:00:00",
  "kiln_model": "KS-1200 电窑",
  "total_pieces": 45,
  "notes": "本次装载包含多种釉色试验品",
  "layers": [
    {
      "layer_name": "top",
      "position": "top",
      "load_type": "试验釉茶碗",
      "piece_count": 15,
      "expected_temp_offset": 5.0,
      "thermocouple": "TC1"
    }
  ]
}
```

### 成品瑕疵记录 JSON

```json
[
  {
    "batch_id": "BATCH_20260503_001",
    "piece_id": "TOP-003",
    "layer_name": "top",
    "defect_type": "釉裂",
    "severity": "轻微",
    "description": "碗口边缘有细微裂纹",
    "suspect_phase": "cooling",
    "location_x": 0.5,
    "location_y": 0.8
  }
]
```

## 风险评估规则

工具内置以下风险评估规则：

| 规则名称 | 触发条件 | 风险等级 |
|----------|----------|----------|
| 温度偏差警戒线 | 平均偏差 > 10°C | 中风险 |
| 温度偏差临界线 | 平均偏差 > 20°C | 高风险 |
| 升温速率过快 | 实际速率 > 目标+1.5°C/min | 高风险 |
| 升温速率过慢 | 实际速率 < 目标-1.0°C/min | 中风险 |
| 冷却速率过快 | 实际速率 > 2.0°C/min (绝对值) | 极高风险 |
| 保温时间不足 | 超出公差 > 300秒 | 高风险 |
| 热量积分偏低 | 与参考值偏差 < -10% | 中风险 |
| 热量积分偏高 | 与参考值偏差 > 15% | 中风险 |
| 层位热滞后 | 与平均偏差 > ±10°C | 中风险 |
| 存在瑕疵记录 | 该层有瑕疵 | 高风险 |

## 运行测试

```bash
# 运行所有测试
pytest

# 运行测试并生成覆盖率报告
pytest --cov=kiln_analyzer

# 运行特定测试模块
pytest tests/test_parsers.py -v
```

## 典型工作流程

### 单次烧成分析流程

1. **烧窑前**:
   - 准备目标烧成曲线 YAML
   - 记录窑车装载信息 JSON

2. **烧窑后**:
   - 导出热电偶数据 CSV
   - 检查成品并记录瑕疵 JSON

3. **数据分析**:
   ```bash
   kiln-analyzer analyze -t data.csv -c curve.yaml -l load.json -d defects.json -o results/
   ```

4. **人工复盘**:
   ```bash
   # 创建会话
   kiln-analyzer new-session -b BATCH_001 -a "张师傅"
   
   # 添加笔记
   kiln-analyzer add-note -s abc123 -c "冷却阶段上层降温太快" -t "问题" -l "top"
   
   # 添加结论
   kiln-analyzer add-conclusion -s abc123 -c "..." -r "下次调整..."
   
   # 导出报告
   kiln-analyzer export-report -s abc123 -t data.csv -c curve.yaml -o report.md
   ```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个工具。
