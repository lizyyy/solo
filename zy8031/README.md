# Seismic Review CLI

本地 Python CLI，给地震台网值班员复核小震事件波形。

## 功能

- **数据加载**：读取台站 CSV、事件 JSON 和三分量波形 CSV 目录
- **信号处理**：去均值、简单带通滤波
- **STA/LTA 拾取**：P/S 震相候选自动拾取
- **人工到时比对**：与值班员到时表比较，输出异常台站
- **报告导出**：Markdown 小报告 + 可选 PNG 波形预览
- **异常检测**：自动检测采样率不一致、波形缺段问题

## 安装

```bash
pip install -e .
```

或安装依赖：

```bash
pip install pandas numpy scipy obspy click matplotlib
```

## 使用方法

```bash
seismic-review review \
  --station-csv sample_data/station.csv \
  --events-json sample_data/events.json \
  --waveform-dir sample_data \
  --output-dir out \
  --generate-png
```

## 输入文件格式

### station.csv

```csv
network,station,latitude,longitude,elevation
HB,QISH,31.5,112.3,150
HB,WUHAN,30.5,114.3,50
```

### events.json

```json
{
  "events": [
    {
      "event_id": "E20250501001",
      "origin_time": "2025-05-01T10:30:00",
      "latitude": 31.8,
      "longitude": 113.5,
      "depth": 10.0,
      "magnitude": 3.2,
      "arrivals": [
        {"station": "QISH", "phase": "P", "time": "2025-05-01T10:30:05.2"}
      ]
    }
  ]
}
```

### 波形 CSV 文件命名

`网络.台站.通道.csv`，如 `HB.QISH.BHZ.csv`

```csv
time,data
2025-05-01T10:29:30,0.001234
2025-05-01T10:29:30.01,-0.002345
```

## 输出

```
out/
├── event_E20250501001/
│   ├── report.md           # 事件复核报告
│   ├── anomalies.csv       # 异常台站列表
│   └── waveforms/          # PNG 波形预览（可选）
│       └── HB.QISH.BHZ.png
└── all_anomalies.csv      # 所有事件异常汇总
```

## 主要参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--window-before` | 30.0 | 事件前窗口（秒） |
| `--window-after` | 60.0 | 事件后窗口（秒） |
| `--lowcut` | 1.0 | 带通低频（Hz） |
| `--highcut` | 20.0 | 带通高频（Hz） |
| `--sta-length` | 1.0 | STA 窗口长度（秒） |
| `--lta-length` | 15.0 | LTA 窗口长度（秒） |
| `--threshold-on` | 3.0 | STA/LTA 触发阈值 |
| `--tolerance` | 2.0 | 到时比对容差（秒） |
| `--common-sr` | None | 统一采样率（Hz） |
| `--generate-png` | False | 生成 PNG 预览 |

## 运行测试

```bash
pytest tests/ -v
```
