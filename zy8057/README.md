# 放疗剂量QA工具

放疗物理师计划出束前二次剂量校核工具。

## 功能

- **坐标对齐**: 自动处理 mm/cm 单位混用
- **插值取样**: 基于 KD-Tree 的 4 点加权插值
- **Gamma分析**: 计算剂量差异 (DD) 和距离一致性 (DTA)
- **器官剂量**: 计算最大/平均剂量
- **报告导出**: QA 报告、失败点 CSV、热力图 HTML

## 安装依赖

```bash
pip install numpy scipy pyyaml
```

## 快速开始

运行示例数据：

```bash
python -m doseqa run \
  --plan samples/plan_dose.csv \
  --measurements samples/measurements.jsonl \
  --structures samples/structures.json \
  --thresholds samples/thresholds.yaml \
  --out-dir output
```

### 预期输出

```
============================================================
  放疗剂量QA分析
============================================================

[1/6] 解析输入文件...
  - 计划剂量: 25 个点
  - 测量点: 10 个
  - 结构轮廓: 3 个
  - 阈值配置: 已加载

[2/6] 剂量插值取样...
  - 完成

[3/6] Gamma分析...
  - Gamma通过率: 90.00%

[4/6] 器官剂量统计...
  - 完成

[5/6] 规则判定...
  - 总体结果: PASS

[6/6] 导出报告...
  - QA报告: output/qa_report.md
  - 失败点: output/failed_points.csv
  - 热力图: output/heatmap.html

============================================================
  分析完成! 总体结果: PASS
============================================================

输出目录: /path/to/output
```

## 输入文件格式

### 计划剂量网格 (CSV)

```csv
x,y,z,dose,unit
-50,-50,0,0.1,mm
-50,-25,0,0.5,mm
0,0,0,5.0,mm
```

### 测量点 (JSONL)

```jsonl
{"id": 1, "x": -30, "y": -30, "z": 0, "dose": 1.5, "unit": "mm"}
{"id": 2, "x": 0, "y": 0, "z": 0, "dose": 5.2, "unit": "mm"}
```

### 器官结构轮廓 (JSON)

```json
{
  "PTV": {
    "contours": [
      [[-40, -40, 0], [40, -40, 0], [40, 40, 0], [-40, 40, 0], [-40, -40, 0]]
    ],
    "color": "#ff0000"
  },
  "OAR1": {
    "contours": []
  }
}
```

### 科室阈值 (YAML)

```yaml
gamma_pass_rate: 90.0
dd_threshold: 0.03
dta_threshold: 3.0
PTV:
  max_dose: 5.5
  mean_dose: 4.5
OAR1:
  max_dose: 4.0
```

## 输出文件

- **qa_report.md**: Markdown 格式的 QA 报告
- **failed_points.csv**: Gamma > 1.0 的失败点
- **heatmap.html**: 交互式热力图和数据点详情

## 项目结构

```
doseqa/
├── __init__.py       # 版本信息
├── __main__.py       # 模块入口
├── cli.py            # 命令行接口
├── parser.py         # 解析和校验
├── calculation.py    # 剂量计算
├── validation.py     # 规则判定
└── report.py         # 报告导出
samples/
├── plan_dose.csv
├── measurements.jsonl
├── structures.json
└── thresholds.yaml
README.md
```

## 许可证

MIT License
