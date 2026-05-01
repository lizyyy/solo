# DMX 灯光预演工具

一个用于剧场灯光师的本地 Python/Tkinter 桌面工具，用于预演 DMX 灯光 cue。

## 功能特性

- **数据导入**：支持 patch.csv（灯具配置）、cues.yaml（灯光场景）和 timeline.json（时间轴）
- **通道映射**：建立灯具通道与 DMX 通道的对应关系
- **淡入淡出插值**：计算任意时间点的通道值，支持平滑过渡
- **风险检测**：
  - DMX 通道冲突检测
  - 未知灯具引用检测
  - Cue 时间重叠提示
- **GUI 界面**：
  - 时间轴播放控制
  - Cue 列表选择
  - 实时灯具通道值显示
  - 风险提示面板
- **报告导出**：支持导出 risks.csv 和 summary.md

## 安装依赖

```bash
pip install pyyaml
```

## 运行程序

```bash
python dmx_preview.py
```

## 数据文件说明

### patch.csv - 灯具配置

定义所有灯具及其 DMX 通道映射：

| fixture_id | fixture_name | dmx_channel | channel_name | channel_type |
|------------|--------------|-------------|--------------|--------------|
| SPOT1      | LED Spot 1   | 1           | Dimmer       | Intensity    |
| SPOT1      | LED Spot 1   | 2           | Red          | Color        |

### cues.yaml - 灯光场景

定义各个 cue 的灯具目标值和淡入淡出时间：

```yaml
- cue_id: Q1
  name: 开场 - 蓝紫光
  fixture_values:
    SPOT1:
      Dimmer: 255
      Red: 0
      Green: 0
      Blue: 200
  fade_in: 2.0
  fade_out: 1.0
```

### timeline.json - 时间轴

定义整个演出的时间安排：

```json
{
  "show_name": "示例演出",
  "total_duration": 30.0,
  "cues": [
    {
      "cue_id": "Q1",
      "start_time": 0.0,
      "end_time": 10.0
    }
  ]
}
```

## 使用说明

1. **默认加载**：程序启动时自动加载 data/ 目录下的示例数据
2. **加载自定义数据**：点击"加载数据"按钮，依次选择 patch.csv、cues.yaml 和 timeline.json
3. **播放预演**：
   - 拖动时间轴滑块查看任意时间点的状态
   - 点击"播放"按钮自动播放整个时间轴
   - 点击"停止"按钮回到起始位置
4. **选择 Cue**：在左侧 Cue 列表中点击，时间轴会跳转到该 Cue 的中间位置
5. **导出报告**：
   - 点击"导出 Risks"导出风险 CSV 报告
   - 点击"导出 Summary"导出 Markdown 摘要报告

## 项目结构

```
.
├── dmx_preview.py        # 主程序（GUI）
├── data_importer.py      # 数据导入模块
├── channel_mapper.py     # 通道映射模块
├── interpolator.py       # 插值计算模块
├── risk_detector.py      # 风险检测模块
├── data/                 # 示例数据目录
│   ├── patch.csv
│   ├── cues.yaml
│   └── timeline.json
├── tests/                # 测试目录
│   └── test_core.py
└── README.md
```

## 运行测试

```bash
python -m pytest tests/test_core.py -v
```

或直接运行测试文件：

```bash
python tests/test_core.py
```
