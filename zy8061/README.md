# 卫星遥测接收质量复核工具

本地 Python CLI 工具，用于复核小卫星过境后的遥测接收质量。

## 功能特性

- 解析简化 CCSDS 主头
- 重组分片包
- 检查序列号缺口/回卷
- 检测跨圈时间戳漂移
- 按标定公式解码温度和电压越限
- 输出：
  - `reassembled_packets.json` - 重组后的完整包
  - `alerts.csv` - 告警记录
  - `timeline.md` - 事件时间线

## 安装

```bash
pip install -r requirements.txt
```

## 使用方法

```bash
python telemetry_checker.py --csv sample_data/frame_log.csv --jsonl sample_data/telemetry_packets.jsonl --yaml sample_data/calibration.yaml --output ./output
```

## 示例数据

在 `sample_data/` 目录下提供了示例输入文件用于测试。

## 测试

```bash
pytest test_telemetry_checker.py -v
```
