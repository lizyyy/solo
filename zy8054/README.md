# weldscan-audit

钢结构焊缝超声探伤结果复核工具

## 功能特性

- 解析焊缝清单、探头配置、缺陷回波数据
- 根据探头角度计算缺陷深度和水平位置
- 合并重复缺陷（同一缺陷被多个角度探头检测到）
- 根据验收规则判定缺陷严重等级
- 导出 Markdown 报告、CSV 复核表和 HTML 剖面图
- 支持 mm/inch 单位混用

## 安装

```bash
pip install -e .
```

## 使用方法

### 快速开始

使用示例数据运行分析：

```bash
python -m weldscan_audit run \
  --welds samples/welds.csv \
  --probes samples/probes.yaml \
  --echoes samples/echoes.jsonl \
  --rules samples/rules.yaml \
  --output-dir output
```

### 预期输出

```
============================================================
焊缝超声探伤结果复核工具
============================================================

[1/6] 解析输入文件...
  - 焊缝数: 2
  - 探头数: 2
  - 回波数: 5
  - 规则数: 3

[2/6] 计算缺陷位置...
  - 缺陷数 (合并后): 3

[3/6] 应用验收规则...
  - 严重缺陷: 1
  - 主要缺陷: 1
  - 次要缺陷: 1
  - 可接受缺陷: 0

[4/6] 导出 Markdown 报告...
  - 已保存到: output/flaw_report.md

[5/6] 导出复核 CSV...
  - 已保存到: output/recheck.csv

[6/6] 导出 HTML 剖面图...
  - 已保存到: output/profile.html

============================================================
分析完成!
============================================================

输出文件:
  - output/flaw_report.md
  - output/recheck.csv
  - output/profile.html
```

### 命令行参数

| 参数 | 说明 | 必需 |
|------|------|------|
| `--welds` | 焊缝清单 CSV 文件路径 | 是 |
| `--probes` | 探头/材料声速 YAML 文件路径 | 是 |
| `--echoes` | 缺陷回波 JSONL 文件路径 | 是 |
| `--rules` | 验收规则 YAML 文件路径 | 是 |
| `--output-dir` | 输出目录（默认: 当前目录） | 否 |
| `--merge-tolerance` | 重复缺陷合并容差（mm, 默认: 3.0） | 否 |

## 输入文件格式

### 焊缝清单 CSV

```csv
weld_id,thickness,unit,length,material
WELD-001,25,mm,2000,Q235
WELD-002,30,mm,1500,Q345
```

### 探头配置 YAML

```yaml
probes:
  - probe_id: PROBE-70
    angle: 70.0
    frequency: 5.0
    velocity: 5900.0
    wedge_delay: 0.2
    ref_point: 10.0
    unit: mm
```

### 缺陷回波 JSONL

```jsonl
{"echo_id": "ECHO-001", "weld_id": "WELD-001", "probe_id": "PROBE-70", "time_of_flight": 20.5, "amplitude": 85.0, "scan_position": 500.0, "unit": "mm"}
```

### 验收规则 YAML

```yaml
rules:
  - name: "Critical Defect"
    max_depth: 50.0
    max_length: 100.0
    amplitude_threshold: 80.0
    severity_level: 3
    unit: mm
```

## 输出文件

- `flaw_report.md`: 缺陷详情 Markdown 报告
- `recheck.csv`: 需复核缺陷的 CSV 表格
- `profile.html`: 可打开的焊缝缺陷剖面图

## 项目结构

```
weldscan_audit/
├── __init__.py       # 版本信息
├── parser.py         # 解析校验模块
├── geometry.py       # 几何计算模块
├── rules.py          # 规则判定模块
├── exporter.py       # 报告导出模块
└── cli.py            # CLI 入口
samples/              # 示例数据
├── welds.csv
├── probes.yaml
├── echoes.jsonl
└── rules.yaml
pyproject.toml        # 项目配置
README.md            # 说明文档
```

## 许可证

MIT
