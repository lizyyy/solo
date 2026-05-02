# WebRTC 通话质量复盘工具

一个用于在线问诊 WebRTC 通话质量分析的命令行工具。

## 功能特性

- 解析并验证 WebRTC 统计数据 (JSONL)
- 解析并验证信令事件 (JSONL)
- 配置质量检测规则 (YAML)
- 重建医生端和患者端的时间线
- 检测 ICE 重连失败
- 检测音视频不同步
- 检测丢包率尖峰
- 检测网络抖动尖峰
- 处理重复统计数据
- 处理客户端时钟偏移
- 导出 Markdown 报告
- 导出 CSV 质量事件
- 导出可交互的 HTML 时间线

## 项目结构

```
.
├── src/
│   ├── types.ts          # TypeScript 类型定义
│   ├── parser.ts         # 解析和验证模块
│   ├── clockAligner.ts   # 时钟对齐和时间线处理
│   ├── qualityRules.ts   # 质量规则检测
│   ├── reportExporter.ts # 报告导出
│   └── cli.ts            # CLI 入口
├── sample/
│   ├── webrtc_stats.jsonl      # WebRTC 统计样本
│   ├── signaling_events.jsonl  # 信令事件样本
│   └── clinic_rules.yaml       # 质量规则样本
├── package.json
├── tsconfig.json
└── README.md
```

## 安装

```bash
npm install
```

## 编译

```bash
npm run build
```

## 使用

### 运行 Demo

使用提供的样本数据运行演示：

```bash
npm run demo
```

### 命令行使用

```bash
npm start -- --stats <webrtc_stats.jsonl> --signaling <signaling_events.jsonl> --rules <clinic_rules.yaml> --output <output_dir>
```

参数说明：
- `--stats`: WebRTC 统计数据文件 (JSONL 格式)
- `--signaling`: 信令事件文件 (JSONL 格式)
- `--rules`: 质量规则文件 (YAML 格式)
- `--output`: 输出目录 (默认为 "output")

## 输入文件格式

### WebRTC 统计数据 (JSONL)

每行一个 JSON 对象，示例：

```json
{"timestamp":1746153600000,"clientId":"doctor_001","role":"doctor","type":"inbound-rtp","id":"audio_1","packetsLost":5,"packetsReceived":100,"jitter":0.02}
```

必填字段：
- `timestamp`: 时间戳 (毫秒)
- `clientId`: 客户端 ID
- `role`: 角色 ("doctor" 或 "patient")
- `type`: 统计类型
- `id`: 统计 ID

### 信令事件 (JSONL)

每行一个 JSON 对象，示例：

```json
{"timestamp":1746153595000,"clientId":"doctor_001","role":"doctor","eventType":"ice_candidate"}
```

必填字段：
- `timestamp`: 时间戳 (毫秒)
- `clientId`: 客户端 ID
- `role`: 角色 ("doctor" 或 "patient")
- `eventType`: 事件类型

### 质量规则 (YAML)

示例：

```yaml
rules:
  - id: ice_reconnect_fail
    name: ICE 重连失败
    description: 检测 ICE 连接重连失败
    category: ice
    threshold: 2
    enabled: true
```

必填字段：
- `id`: 规则 ID
- `name`: 规则名称
- `description`: 规则描述
- `category`: 类别 ("ice", "av_sync", "packet_loss", "jitter", "other")
- `enabled`: 是否启用

可选字段：
- `threshold`: 阈值
- `duration`: 持续时间

## 输出文件

工具会在输出目录生成以下文件：

1. **call_report.md** - Markdown 格式的详细报告
2. **quality_events.csv** - CSV 格式的质量事件列表
3. **timeline.html** - 可在浏览器中打开的时间线可视化

## 开发

### 监听文件变化并自动编译

```bash
npm run dev
```

## License

MIT
