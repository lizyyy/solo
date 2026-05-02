# NVR Audit CLI

监控录像交付审计工具，按摄像头重建时间线，检测片段断档、重叠、时钟回拨、低码率和疑似缺帧。

## 安装

```bash
pip install -e .
```

## 输入文件

| 文件 | 说明 |
|------|------|
| `clips_manifest.csv` | 片段列表，含 camera_id、filename、start_time、end_time、duration、file_size |
| `device_clock_events.jsonl` | 设备时钟事件 JSONL，每行含 camera_id、event_type、timestamp、old_value、new_value |
| `ffprobe_summaries.json` | ffprobe 提取的媒体信息，含 filename、duration、bitrate、width、height、fps |
| `rules.yaml` | 审计规则和阈值配置 |

## Demo 命令

```bash
# 使用 sample 数据运行
nvr-audit \
  --clips sample_data/clips_manifest.csv \
  --clock sample_data/device_clock_events.jsonl \
  --ffprobe sample_data/ffprobe_summaries.json \
  --rules sample_data/rules.yaml \
  -o output

# 直接用 python -m 运行
python -m nvr_audit.cli \
  --clips sample_data/clips_manifest.csv \
  --clock sample_data/device_clock_events.jsonl \
  --ffprobe sample_data/ffprobe_summaries.json \
  --rules sample_data/rules.yaml \
  -o output
```

## 输出文件

| 文件 | 说明 |
|------|------|
| `audit_report.md` | 完整审计报告，含概览、问题清单、各摄像头时间线 |
| `gaps.csv` | 所有断档的 CSV 记录 |
| `timeline.html` | 交互式 HTML 时间线，带问题颜色标记 |

## 检测问题类型

- **gap** - 片段之间的时间断档
- **overlap** - 片段时间重叠
- **clock_rewind** - 设备时钟回拨事件
- **low_bitrate** - 码率低于阈值
- **suspected_dropped_frames** - 短间隙可能缺帧
- **duplicate_filename_different_camera** - 同一文件名被多个摄像头使用

## 已知坑

- **跨午夜片段**：开始和结束时间不在同一天，会自动拆分为两个片段处理
- **重复文件名不同摄像头**：同一文件名被多个 camera_id 使用会报 error

## 项目结构

```
src/nvr_audit/
  __init__.py
  parser.py    # 解析 CSV、JSONL、JSON、YAML
  validator.py # 时间线重建、问题检测
  rules.py     # 规则定义和阈值
  exporter.py  # 输出 MD、CSV、HTML
  cli.py       # CLI 入口
tests/
  test_validator.py
  test_parser.py
sample_data/
  clips_manifest.csv
  device_clock_events.jsonl
  ffprobe_summaries.json
  rules.yaml
```
