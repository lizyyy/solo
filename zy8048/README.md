# Aqua Guard - 水产养殖场夜班监控 CLI

模拟未来 24 小时池塘溶氧、氨氮和投喂量变化，输出风险报告和告警。

## 安装

```bash
pip install pyyaml
```

## 运行命令

使用 sample 数据运行演示：

```bash
python -m aqua_guard run \
  -w sample_data/water_quality.csv \
  -f sample_data/feed_plan.yaml \
  -W sample_data/weather_forecast.json \
  -t sample_data/pond_thresholds.json \
  -o output
```

## 输入文件格式

### water_quality.csv
```
timestamp,pond_id,dissolved_oxygen,ammonia_nitrogen,temperature,ph
2026-05-01 18:00:00,Pond_A,7.5,0.03,26.5,7.2
```

### feed_plan.yaml
```yaml
Pond_A:
  base_amount: 120
  feed_times:
    - hour: 6
      amount: 100
```

### weather_forecast.json
```json
{
  "forecast": [
    {"hour": 18, "temp": 26, "wind_speed": 3, "cloud_cover": 20}
  ]
}
```

### pond_thresholds.json
```json
{
  "Pond_A": {
    "do_min": 5.0,
    "do_max": 15.0,
    "ammonia_max": 0.1
  }
}
```

## 输出文件

- `risk_report.md` - 风险报告
- `adjusted_feed.csv` - 调整后投喂计划
- `alerts.json` - 告警信息

## 测试

```bash
pytest tests/ -v
```
