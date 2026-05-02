# 筒仓熏蒸作业安全复核工具

离线复核筒仓熏蒸作业的安全开窗时机。基于磷化氢（PH3）传感器数据、通风记录和作业规则，按时间线重建浓度衰减和通风覆盖情况，评估人员进入风险。

## 安装

```bash
pip install -e .
```

或直接使用：

```bash
python -m fumigation_analyzer --help
```

## 输入文件格式

### 仓房信息 CSV (`warehouse.csv`)

| 列 | 类型 | 说明 |
|---|---|---|
| warehouse_id | string | 仓房唯一标识 |
| name | string | 仓房名称 |
| volume_m3 | float | 仓房体积（立方米） |
| ventilation_rate | float | 通风率（立方米/小时） |

### 传感器数据 JSONL (`sensors.jsonl`)

每行一条 JSON 记录：

```json
{"timestamp": "2025-05-01 08:00:00", "warehouse_id": "SILO-A", "sensor_id": "S-A-01", "concentration_ppm": 850.0}
```

### 通风机启停记录 CSV (`ventilation.csv`)

| 列 | 类型 | 说明 |
|---|---|---|
| warehouse_id | string | 仓房ID |
| vent_id | string | 通风机ID |
| start_time | string | 启动时间 |
| end_time | string | 停止时间 |
| flow_rate_m3h | float | 风量（立方米/小时） |

### 作业规则 YAML (`rules.yaml`)

```yaml
rules:
  - name: "safe_below_100_vent"
    priority: 30
    risk_level: safe
    condition: "combined"
    params:
      operator: "and"
      conditions:
        - type: "concentration_below"
          threshold_ppm: 100
        - type: "ventilation_active"
    action: "safe_to_enter"
```

支持的 condition 类型：
- `concentration_below` / `concentration_above`：浓度阈值判断
- `ventilation_active` / `ventilation_inactive`：通风状态判断
- `time_after_application`：熏蒸后时间判断
- `combined`：组合条件（`and`/`or`）

## 演示命令

使用示例数据运行分析：

```bash
python -m fumigation_analyzer \
  --warehouse fumigation_analyzer/sample_data/warehouse.csv \
  --sensors fumigation_analyzer/sample_data/sensors.jsonl \
  --ventilation fumigation_analyzer/sample_data/ventilation.csv \
  --rules fumigation_analyzer/sample_data/rules.yaml \
  --output-dir ./output \
  --report-name fumigation_report
```

## 输出文件

| 文件 | 说明 |
|---|---|
| `fumigation_report.md` | Markdown 格式安全复核报告 |
| `risk_events.csv` | 风险事件 CSV 日志 |
| `timeline.html` | 交互式时间线 HTML 页面 |

## 核心功能

- **传感器漂移检测**：检测异常浓度变化率（默认阈值 5.0 ppm/h）
- **记录乱序处理**：按时间戳排序并修正跨午夜记录
- **跨午夜作业处理**：自动识别并修正跨午夜时间戳
- **浓度衰减模型**：基于仓房体积和通风率的一阶衰减模型
- **通风覆盖计算**：计算任意时刻的通风状态和总风量

## 测试

```bash
python -m pytest fumigation_analyzer/tests/ -v
```

## 依赖

- Python >= 3.10
- pyyaml
