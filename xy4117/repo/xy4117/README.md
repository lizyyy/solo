# 通话卡顿回放台 - WebRTC 日志诊断器

专为远程庭审和在线问诊技术支持场景设计的本地 WebRTC 日志诊断工具。

## 项目背景

在远程庭审、在线问诊等专业场景中，WebRTC 通话卡顿往往被误判为设备问题，但实际原因可能是：

- **ICE 重连**：网络切换导致候选连接对切换
- **上行丢包**：网络拥塞导致数据包丢失
- **音视频不同步**：延迟差异导致音画不同步
- **码率突降**：带宽限制导致画面模糊
- **抖动过高**：网络不稳定导致卡顿

本工具通过分析浏览器导出的 `getStats` JSON、信令事件日志和用户手写时间点，自动识别卡顿根因，生成专业诊断报告。

## 功能特性

### 📊 多源日志导入
- **getStats JSON**：浏览器 `RTCPeerConnection.getStats()` 导出的统计数据
- **信令事件日志**：Offer/Answer 交换、ICE 候选、ICE 重启等信令事件
- **用户手写时间点**：用户记录的卡顿发生时间和描述

### 🔍 智能异常检测
| 异常类型 | 检测内容 |
|---------|---------|
| ICE 重连 | 候选连接对切换、ICE 状态变化、ICE 重启 |
| 码率突降 | 发送码率下降超过阈值 |
| 丢包率过高 | 丢包率超过可接受范围 |
| 抖动过高 | 网络延迟变化过大 |
| 轨道静音 | 音视频轨道被静音或禁用 |
| 设备切换 | 用户切换了音视频输入设备 |
| 质量限制 | CPU 或带宽限制导致编码质量下降 |
| 丢帧 | 解码或渲染能力不足导致丢帧 |
| RTT 尖峰 | 网络延迟突然增加 |
| 音视频不同步 | 音频和视频延迟差异过大 |
| 信令断点 | 信令事件间隔过长或信令错误 |

### 📈 时间轴归一化
- 支持多份日志时间对齐
- 手动时间偏移调整
- 自动时间轴切片和筛选

### 📝 报告导出
- **JSON 格式**：程序可解析的完整分析数据
- **Markdown 格式**：人类可读的专业报告，包含：
  - 通话质量评分
  - 卡顿片段时间线
  - 根因分析和建议
  - 详细异常列表
  - 用户影响描述

### 💾 会话存储
- 本地 JSON 文件存储
- 会话列表管理
- 会话导入/导出
- 自动清理过期会话

## 项目结构

```
├── src/
│   ├── cli/                 # CLI 命令行入口
│   │   └── index.ts
│   ├── parsers/             # 日志解析器
│   │   ├── base.ts          # 解析器基类
│   │   ├── getstats-parser.ts    # getStats JSON 解析器
│   │   ├── signaling-parser.ts   # 信令日志解析器
│   │   ├── usernote-parser.ts    # 用户笔记解析器
│   │   └── index.ts         # 解析器管理器
│   ├── timeline/            # 时间轴归一化
│   │   └── index.ts
│   ├── rules/               # 规则引擎
│   │   └── index.ts
│   ├── storage/             # 会话存储
│   │   └── index.ts
│   ├── reporter/            # 报告导出
│   │   └── index.ts
│   ├── services/            # 服务层
│   │   └── index.ts
│   ├── types/               # TypeScript 类型定义
│   │   └── index.ts
│   └── utils/               # 工具函数
│       └── index.ts
├── tests/                   # 测试用例
│   ├── utils.test.ts
│   ├── parsers.test.ts
│   ├── timeline.test.ts
│   ├── rules.test.ts
│   └── services.test.ts
├── examples/                # 示例数据
│   ├── getstats-sample.json
│   ├── signaling-log.json
│   └── user-notes.txt
├── package.json
├── tsconfig.json
└── jest.config.js
```

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 构建项目

```bash
npm run build
```

### 运行测试

```bash
npm test
```

## CLI 使用指南

### 基本命令

```bash
# 使用 ts-node 直接运行（开发环境）
npm start -- analyze examples/getstats-sample.json

# 或使用构建后的 CLI
npm run build
node dist/cli/index.js analyze examples/getstats-sample.json
```

### 命令列表

| 命令 | 描述 |
|-----|------|
| `analyze` | 分析日志文件 |
| `list` | 列出历史会话 |
| `show <sessionId>` | 显示会话详情 |
| `delete <sessionId>` | 删除会话 |
| `export` | 导出报告 |
| `stats` | 显示存储统计 |

### 使用示例

#### 1. 分析单份日志

```bash
npm start -- analyze examples/getstats-sample.json
```

#### 2. 分析多份日志（自动类型检测）

```bash
npm start -- analyze \
  examples/getstats-sample.json \
  examples/signaling-log.json \
  examples/user-notes.txt
```

#### 3. 分析并保存会话

```bash
npm start -- analyze \
  examples/getstats-sample.json \
  examples/signaling-log.json \
  --name "远程庭审-2024-05-02" \
  --save
```

#### 4. 列出现有会话

```bash
npm start -- list
```

#### 5. 查看会话详情

```bash
npm start -- show <session-id>
```

#### 6. 导出报告

```bash
# 导出 JSON 格式
npm start -- export <session-id> report.json --format json

# 导出 Markdown 格式
npm start -- export <session-id> report.md --format markdown

# 包含完整证据数据
npm start -- export <session-id> report.md --format markdown --include-evidence
```

#### 7. 删除会话

```bash
npm start -- delete <session-id>
```

#### 8. 查看存储统计

```bash
npm start -- stats
```

## 数据格式说明

### 1. getStats JSON 格式

浏览器 `RTCPeerConnection.getStats()` 导出的数据，支持以下格式：

#### 格式 A：时间点数组（推荐）
```json
[
  {
    "timestamp": 1714644000000,
    "reports": [
      {
        "id": "RTCIceCandidatePair_1",
        "type": "candidate-pair",
        "state": "succeeded",
        "nominated": true,
        "currentRoundTripTime": 0.05
      },
      {
        "id": "RTCInboundRTPVideo_1",
        "type": "inbound-rtp",
        "kind": "video",
        "ssrc": "123456",
        "packetsReceived": 1000,
        "packetsLost": 10,
        "jitter": 0.01
      }
    ]
  }
]
```

#### 格式 B：单时间点对象
```json
{
  "timestamp": 1714644000000,
  "reports": [...]
}
```

#### 格式 C：Map 格式（chrome://webrtc-internals 导出）
```json
{
  "RTCIceCandidatePair_1": {
    "id": "RTCIceCandidatePair_1",
    "type": "candidate-pair",
    "timestamp": 1714644000000,
    "values": [...]
  }
}
```

### 2. 信令事件日志格式

#### 格式 A：JSON 数组
```json
[
  {
    "timestamp": 1714644000000,
    "type": "offer",
    "direction": "send",
    "sdp": "v=0\r\n..."
  },
  {
    "timestamp": 1714644001000,
    "type": "ice_candidate",
    "direction": "send",
    "candidate": {
      "candidate": "candidate:0 1 UDP 2122252543 192.168.1.100 50000 typ host",
      "sdpMid": "0"
    }
  }
]
```

#### 格式 B：文本日志
```
2024-05-02T14:00:00.000Z [SEND] offer
2024-05-02T14:00:01.000Z [SEND] ice_candidate
2024-05-02T14:00:03.000Z [RECV] answer
```

### 3. 用户手写时间点格式

```
2024-05-02T14:00:00.000Z 开始远程庭审
2024-05-02T14:00:05.000Z [warning] 对方画面开始卡顿，出现马赛克
2024-05-02T14:00:08.000Z [critical] 画面完全冻结，听不到对方声音
2024-05-02T14:00:10.000Z 尝试刷新页面
2024-05-02T14:00:15.000Z 画面恢复正常
```

#### 支持的时间格式：
- ISO 格式：`2024-05-02T14:00:00.000Z`
- 时间格式：`14:00:00`、`14:00`
- 相对时间：`5s ago`、`2m ago`、`1h ago`

#### 支持的严重级别标签：
- `[info]` 或无标签：信息级别
- `[warning]`：警告级别
- `[critical]`：严重级别

## 本地验证流程

### 步骤 1：准备环境

```bash
# 进入项目目录
cd /path/to/xy4117

# 安装依赖
npm install
```

### 步骤 2：使用示例数据测试

```bash
# 分析示例 getStats 数据
npm start -- analyze examples/getstats-sample.json

# 分析所有示例数据
npm start -- analyze \
  examples/getstats-sample.json \
  examples/signaling-log.json \
  examples/user-notes.txt \
  --name "示例会话-卡顿回放测试" \
  --save
```

### 步骤 3：查看分析结果

```bash
# 列出现有会话
npm start -- list

# 查看会话详情（使用上一步输出的 session-id）
npm start -- show <session-id>
```

### 步骤 4：导出报告

```bash
# 导出 Markdown 报告
npm start -- export <session-id> analysis-report.md --format markdown

# 导出 JSON 报告
npm start -- export <session-id> analysis-report.json --format json

# 查看报告内容
cat analysis-report.md
```

### 步骤 5：运行测试

```bash
# 运行所有测试
npm test

# 运行指定测试文件
npm test -- tests/utils.test.ts
npm test -- tests/rules.test.ts

# 监视模式运行测试
npm run test:watch
```

### 步骤 6：使用自己的日志

1. 从浏览器导出 getStats 数据：
   - 打开 Chrome 开发者工具
   - 执行 `peerConnection.getStats().then(console.log)`
   - 复制输出的 JSON 数据保存到文件

2. 导出信令日志（如果应用有记录）

3. 记录用户手写时间点（可选）

4. 运行分析：
```bash
npm start -- analyze \
  /path/to/your/getstats.json \
  /path/to/your/signaling.json \
  /path/to/your/notes.txt \
  --name "我的会话分析" \
  --save
```

## 示例数据分析

项目提供的 `examples/` 目录包含一个完整的卡顿场景示例：

### 场景描述
模拟一次远程庭审过程中遇到的网络问题：

| 时间点 | 事件 |
|-------|------|
| 14:00:00 | 开始远程庭审，720p 30fps 正常通话 |
| 14:00:05 | 网络开始恶化，丢包率上升（视频 15%，音频 10%），抖动增加（600ms），码率从 2.5Mbps 降到 800kbps |
| 14:00:08 | 画面完全冻结，听不到对方声音（用户记录） |
| 14:00:10 | ICE 连接失败，候选对从 abc123 切换到 def456，分辨率降到 360p，FPS 降到 10 |
| 14:00:15 | ICE 重连成功，恢复 720p 30fps |

### 预期分析结果

工具应识别以下异常：
1. **丢包率过高** - 视频丢包 15%，音频丢包 10%
2. **抖动过高** - 600ms 超过阈值
3. **码率突降** - 从 2.5Mbps 降到 800kbps
4. **质量限制** - bandwidth 原因
5. **ICE 重连** - 候选对切换
6. **RTT 增加** - 网络延迟上升

## 规则引擎配置

可以通过选项调整检测阈值：

```typescript
import { DiagnosticService } from './src/services';

const service = new DiagnosticService({
  ruleOptions: {
    packetLossThreshold: 5,      // 丢包率阈值（%）
    jitterThreshold: 500,         // 抖动阈值（ms）
    bitrateDropRatio: 0.5,        // 码率下降比例阈值
    rttSpikeMultiplier: 3,         // RTT 尖峰倍数阈值
    frameDropThreshold: 10,        // 丢帧率阈值（%）
    qualityLimitationDurationThreshold: 3000,  // 质量限制持续时间阈值（ms）
    silenceDurationThreshold: 5000  // 静音持续时间阈值（ms）
  }
});
```

## API 使用（编程接口）

除了 CLI，也可以直接使用 TypeScript API：

```typescript
import { DiagnosticService } from './src/services';

const service = new DiagnosticService();

// 分析日志内容
const result = await service.analyzeContent([
  {
    content: JSON.stringify(getStatsData),
    type: 'getstats',
    name: 'getstats-log'
  },
  {
    content: JSON.stringify(signalingData),
    type: 'signaling',
    name: 'signaling-log'
  }
], {
  sessionName: '我的分析会话'
});

// 保存会话
const savedSession = await service.saveSession(result.session);

// 导出报告
const markdownReport = service.exportMarkdownReportToString(savedSession, {
  format: 'markdown',
  includeRawData: false,
  includeEvidence: true
});
```

## 常见问题

### Q1: 支持哪些浏览器的 getStats 格式？
A: 目前支持 Chrome 和基于 Chromium 的浏览器（如 Edge）的 getStats 导出格式。Firefox 的 getStats 格式略有不同，可能需要额外适配。

### Q2: 如何从 chrome://webrtc-internals 导出数据？
A: 
1. 打开 `chrome://webrtc-internals`
2. 找到你的 PeerConnection
3. 点击 "Download the PeerConnection updates and stats data" 按钮
4. 导出的 JSON 文件可以直接使用

### Q3: 日志时间戳格式不一致怎么办？
A: 工具支持多种时间戳格式，包括：
- Unix 时间戳（毫秒）
- ISO 8601 字符串
- 相对时间格式
- 纯时间格式（当天日期）

如果需要手动对齐不同日志源的时间，可以使用时间对齐功能。

### Q4: 可以同时分析多个会话的日志吗？
A: 可以。每次运行 `analyze` 命令会创建一个新的会话，所有分析结果都会保存到本地存储，可以通过 `list` 命令查看历史会话。

### Q5: 存储的会话数据在哪里？
A: 默认存储在 `~/.webrtc-diagnostic/sessions.json` 文件中。可以通过 `stats` 命令查看存储位置和统计信息。

## 技术栈

- **TypeScript** - 类型安全的 JavaScript 超集
- **commander** - CLI 框架
- **chalk** - 终端颜色输出
- **lowdb** - 轻量级本地 JSON 数据库
- **uuid** - 唯一 ID 生成
- **lodash** - 工具函数库
- **Jest** - 测试框架

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

---

**注意**：本工具仅在本地运行，所有日志数据不会上传到任何服务器，适合处理敏感场景（如远程庭审、在线问诊）的日志分析。
