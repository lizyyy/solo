# 地铁清分复核工具

一个用于地铁闸机交易复核的Python CLI工具，支持行程重建、票价计算和异常检测。

## 功能特性

- 按卡号重建进出站行程
- 根据站点距离计算应收票价
- 检测各类异常情况
  - 缺进站/缺出站
  - 超时行程
  - 重复刷卡
  - 跨日运营日
  - 换乘断链
- 导出多种格式报告

## 安装

```bash
pip install -r requirements.txt
```

## 使用方法

```bash
python -m afc_settlement audit \
  --tap-events sample_data/tap_events.csv \
  --station-graph sample_data/station_graph.json \
  --fare-rules sample_data/fare_rules.yaml \
  --calendar-config sample_data/calendar_config.yaml
```

### 参数说明

- `--tap-events`: 闸机事件CSV文件
- `--station-graph`: 站点图JSON文件
- `--fare-rules`: 票价规则YAML文件
- `--calendar-config`: 节假日/运营日配置YAML文件
- `--report`: 清分报告输出路径 (默认: settlement_report.md)
- `--adjustments`: 调整文件输出路径 (默认: adjustments.csv)
- `--timeline`: 时间线HTML输出路径 (默认: trip_timeline.html)

## 输入文件格式

### tap_events.csv

```csv
card_id,tap_type,station_id,timestamp,device_id,transaction_id
CARD001,entry,ST001,2024-05-01T08:00:00,D001,T001
CARD001,exit,ST003,2024-05-01T08:30:00,D003,T002
```

### station_graph.json

```json
{
    "stations": [
        {"station_id": "ST001", "name": "人民广场", "line": "L1"}
    ],
    "edges": [
        {"from": "ST001", "to": "ST002", "distance": 2000}
    ]
}
```

### fare_rules.yaml

```yaml
fare_rules:
  - min_distance: 0
    max_distance: 3000
    price: 200
max_trip_time: 7200
transfer_time_window: 1800
```

### calendar_config.yaml

```yaml
holidays:
  - "2024-05-01"
operating_day_cutoff: "02:00"
```

## 示例数据

`sample_data/`目录包含示例数据，可用于测试。

### 测试场景

1. **正常行程 (CARD001, CARD002)
2. **重复刷卡** (CARD003) - 同卡短时间内重复刷卡
3. **跨日运营日** (CARD004) - 02:00前出行，归属前一日运营日
4. **超时行程** (CARD005) - 超过2小时行程

## 项目结构

```
afc_settlement/
├── parser/          # 解析模块
├── state_machine/ # 行程状态机
├── fare/          # 票价规则
├── anomaly/       # 异常归因
├── exporter/      # 导出模块
└── __main__.py   # CLI入口
```

## 输出文件

运行后会生成三个文件：

1. `settlement_report.md` - 清分报告（Markdown格式）
2. `adjustments.csv` - 调整记录（CSV格式）
3. `trip_timeline.html` - 行程时间线（HTML格式）
