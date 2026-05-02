# 压力容器安全阀校验批次复核工具

用于质检员导入安全阀台账、校验台测试曲线和判定规则后，自动完成批次复核分析的CLI工具。

## 功能特性

- 解析安全阀台账 CSV 文件
- 解析校验台测试曲线 JSONL 文件
- 加载判定规则 YAML 配置
- 按阀门编号归并多次升压/回座记录
- 计算整定压力偏差、启闭压差和铅封状态
- 输出异常 CSV、Markdown 报告和可浏览的 HTML 曲线页
- 处理同一阀门重复校验、曲线缺采样点等边界情况

## 项目结构

```
├── src/safety_valve/
│   ├── __init__.py          # 版本信息
│   ├── parser.py            # 数据解析模块
│   ├── rules.py             # 规则计算模块
│   ├── report.py            # 报告生成模块
│   ├── cli.py               # 命令行接口
│   └── templates/           # Jinja2 模板
│       ├── report.md.j2     # Markdown 报告模板
│       └── curves.html.j2   # HTML 曲线页模板
├── sample_data/             # 示例数据
│   ├── valve_records.csv    # 安全阀台账示例
│   ├── test_curves.jsonl    # 测试曲线示例
│   └── rules.yaml           # 判定规则示例
├── tests/                   # 测试用例
├── pyproject.toml           # 项目配置
└── README.md                # 项目说明
```

## 安装

```bash
pip install -e .
```

## 使用方法

### 命令行接口

```bash
valve-review --valve-csv <阀门台账CSV> --curve-jsonl <测试曲线JSONL> --rules-yaml <判定规则YAML> --output-dir <输出目录>
```

### 参数说明

| 参数 | 说明 | 必填 |
|------|------|------|
| `--valve-csv` | 安全阀台账CSV文件路径 | 是 |
| `--curve-jsonl` | 校验台测试曲线JSONL文件路径 | 是 |
| `--rules-yaml` | 判定规则YAML文件路径 | 是 |
| `--output-dir` | 输出目录（默认：output） | 否 |

### 示例命令

```bash
# 使用示例数据进行测试
valve-review \
    --valve-csv sample_data/valve_records.csv \
    --curve-jsonl sample_data/test_curves.jsonl \
    --rules-yaml sample_data/rules.yaml \
    --output-dir output
```

## 输入数据格式

### 安全阀台账 CSV

| 字段 | 类型 | 说明 |
|------|------|------|
| 阀门编号 | string | 唯一标识 |
| 型号 | string | 阀门型号 |
| 公称直径 | float | mm |
| 公称压力 | float | MPa |
| 整定压力 | float | MPa |
| 制造单位 | string | 制造商 |
| 安装位置 | string | 安装地点 |

### 测试曲线 JSONL

每行一个 JSON 对象：

```json
{
    "valve_id": "SV-001",
    "test_time": "2024-01-15 09:30:00",
    "test_type": "升压",
    "operator": "张三",
    "equipment_id": "TEST-001",
    "points": [
        {"timestamp": 0.0, "pressure": 0.0, "lift": 0.0},
        {"timestamp": 1.0, "pressure": 0.3, "lift": 0.0}
    ]
}
```

### 判定规则 YAML

```yaml
set_pressure_tolerance: 5.0      # 整定压力偏差限值 (%)
opening_closing_diff_max: 0.3    # 最大启闭压差 (MPa)
min_sample_points: 8             # 最小采样点数
lead_seal_required: true         # 是否要求铅封
```

## 输出文件

| 文件 | 说明 |
|------|------|
| `abnormal_report.csv` | 异常阀门CSV报告 |
| `review_report.md` | 完整Markdown报告 |
| `curves.html` | 可浏览的HTML曲线页 |

## 边界处理

1. **同一阀门多次校验**：自动归并同一阀门的所有测试记录
2. **曲线缺采样点**：检测采样点不足并标记异常
3. **阀门不在台账**：跳过并警告
4. **无法确定压力值**：标记错误并继续处理其他阀门

## 测试

```bash
cd tests
python -m pytest .
```

## 许可证

MIT