# WebRTC Replay Station

本地 WebRTC 故障复现台 - 专为远程面试平台工程师设计的 WebRTC 连接故障分析工具。

## 概述

线上 WebRTC 连接问题通常难以复盘，特别是：
- 候选人听不到声音
- ICE 连接反复重连
- 录制事件和信令日志对不上

本工具提供：
- 导入线上日志（JSONL、Offer/Answer、ICE Candidates）
- 回放连接状态变化
- 手动注入网络故障（延迟、丢包、断网）
- 规则引擎自动检测协商顺序、媒体轨道、重连超时、录制缺口
- 导出 Markdown 报告和 JSON 审计包

## 功能特性

### 1. 数据导入
- **JSONL 事件流**：导入完整的事件时间线
- **Offer/Answer**：单独导入 SDP 描述
- **ICE Candidates**：导入候选地址
- **手动输入**：支持直接粘贴 JSON 数据

### 2. 状态回放
- 连接状态可视化（new → connecting → checking → connected → completed/failed）
- 媒体轨道追踪（音频/视频）
- 事件时间线显示
- 相对时间计算

### 3. 规则引擎校验
| 规则 | 检测内容 | 严重程度 |
|------|----------|----------|
| 协商顺序 | Offer/Answer 顺序是否正确 | ERROR |
| 协商超时 | 步骤间耗时是否超过阈值 | WARNING |
| 音频轨道 | 是否存在音频轨道 | ERROR |
| 重连超时 | 重连耗时是否超过阈值 | ERROR |
| 录制缺口 | stop → start 间隔是否过大 | ERROR |
| ICE Candidates | 是否有公网候选地址 | WARNING |
| 状态转换 | 连接是否达到 connected/completed | ERROR |
| 音频静音 | 音频电平是否持续为 0 | WARNING |

### 4. 网络故障注入
- **延迟注入**：模拟高延迟网络
- **丢包注入**：模拟不稳定连接
- **断网模拟**：模拟连接断开

### 5. 导出功能
- **Markdown 报告**：完整的故障分析报告，适合团队分享
- **JSON 审计包**：包含所有事件和校验结果的完整数据包
- **JSONL 事件流**：原始事件数据，可用于后续分析

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装

```bash
# 安装依赖
npm install
```

### 启动服务

```bash
# 开发模式（带自动重启）
npm run dev

# 生产模式
npm start
```

服务启动后访问：`http://localhost:3000`

### 运行测试

```bash
# 运行所有测试
npm test
```

## 使用指南

### 1. 创建会话

1. 点击 **"新建会话"** 创建一个新的分析会话
2. 或点击 **"快速开始"** 使用预设的演示数据
3. 也可以从 **"历史复盘"** 中加载已保存的会话

### 2. 导入数据

#### 方式一：文件导入
1. 从左侧选择导入类型：
   - JSONL 事件流
   - 事件数组
   - Offer
   - Answer
   - ICE Candidate

2. 点击 **"选择文件导入"** 选择数据文件

#### 方式二：手动输入
1. 点击 **"手动输入"** 按钮
2. 选择数据类型
3. 粘贴 JSON 数据
4. 点击 **"导入"**

#### 支持的数据格式

**JSONL 示例：**
```jsonl
{"type": "offer", "sdp": "v=0\r\no=- 123456...", "timestamp": 1700000000000}
{"type": "answer", "sdp": "v=0\r\no=- 654321...", "timestamp": 1700000001000}
{"type": "ice_candidate", "candidate": "candidate:0 1 UDP 2122252543 192.168.1.100 12345 typ host", "sdpMid": "0", "timestamp": 1700000000500}
```

**事件类型列表：**

| 类型 | 说明 | 必需字段 |
|------|------|----------|
| `offer` | SDP Offer | type, sdp, timestamp |
| `answer` | SDP Answer | type, sdp, timestamp |
| `ice_candidate` | ICE 候选地址 | type, candidate, timestamp |
| `track` | 媒体轨道 | type, kind, trackId, timestamp |
| `ice_connection_state_change` | 连接状态变化 | type, state, timestamp |
| `reconnect_start` | 重连开始 | type, timestamp |
| `reconnect_success` | 重连成功 | type, timestamp |
| `reconnect_failed` | 重连失败 | type, timestamp |
| `recording_start` | 录制开始 | type, recordingId, timestamp |
| `recording_stop` | 录制停止 | type, recordingId, timestamp |
| `recording_gap` | 录制缺口 | type, recordingId, gapDuration, timestamp |
| `audio_level` | 音频电平 | type, level, timestamp |
| `network_injection` | 网络注入事件 | type, injectionType, timestamp |

### 3. 分析数据

#### 概览标签页
显示会话的基本信息：
- 连接状态
- 事件统计
- 协商序列
- 媒体轨道列表

#### 事件时间线
按时间顺序显示所有事件：
- 支持按类型筛选
- 支持关键字搜索
- 显示相对时间

#### 校验结果
点击 **"运行校验"** 后显示：
- 错误、警告、信息计数
- 详细的校验结果
- 问题详情和建议

#### 网络注入
模拟网络故障场景：
1. **延迟注入**：设置延迟时间和持续时间
2. **丢包注入**：设置丢包率和持续时间
3. **断网模拟**：设置断网时长

#### 原始数据
查看和导出原始数据：
- 全部数据
- 事件列表
- Offers
- Answers
- ICE Candidates
- 校验结果

### 4. 保存和导出

#### 保存复盘
点击 **"保存复盘"** 将会话保存到本地存储。

#### 导出报告
点击 **"导出报告"** 选择导出格式：

1. **Markdown 报告**
   - 包含完整的分析结果
   - 适合团队分享和文档存档
   - 包含校验结果、事件摘要、统计数据

2. **JSON 审计包**
   - 完整的数据包
   - 包含所有事件和校验结果
   - 适合自动化分析

3. **JSONL 事件流**
   - 原始事件数据
   - 可导入到其他工具分析

## 示例数据

项目包含 4 个示例数据文件，位于 `data/examples/` 目录：

| 文件 | 场景 | 包含问题 |
|------|------|----------|
| `normal-connection.jsonl` | 正常连接 | 无 |
| `audio-silence-issue.jsonl` | 音频静音问题 | Answer 的方向是 recvonly，音频电平持续为 0 |
| `reconnect-issue.jsonl` | 重连故障 | 多次重连、录制缺口、第一次重连超时 |

### 使用示例数据

```bash
# 1. 启动服务
npm start

# 2. 打开浏览器访问 http://localhost:3000

# 3. 点击"新建会话"

# 4. 选择导入类型为 "JSONL 事件流"

# 5. 选择文件 data/examples/reconnect-issue.jsonl

# 6. 点击"运行校验"查看检测到的问题
```

## 项目结构

```
webrtc-replay-station/
├── client/public/              # 前端静态文件
│   ├── index.html             # 主页面
│   ├── styles.css             # 样式文件
│   └── app.js                 # 前端应用逻辑
├── server/src/                 # 后端源码
│   ├── index.js               # 服务入口
│   ├── config.js              # 配置文件
│   └── services/              # 核心服务
│       ├── stateMachine.js    # 状态机
│       ├── rulesEngine.js     # 规则引擎
│       ├── sessionManager.js  # 会话管理
│       ├── storage.js         # 存储服务
│       └── importExport.js    # 导入导出
├── server/tests/               # 测试文件
│   ├── test-stateMachine.js
│   └── test-rulesEngine.js
├── data/
│   ├── examples/              # 示例数据
│   ├── replays/               # 保存的复盘
│   └── exports/               # 导出的文件
├── package.json
└── README.md
```

## API 文档

### 健康检查

```
GET /api/health
```

响应：
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 会话管理

**创建会话**
```
POST /api/sessions
Content-Type: application/json

{
  "name": "会话名称",
  "description": "会话描述"
}
```

**获取会话列表**
```
GET /api/sessions
```

**获取会话详情**
```
GET /api/sessions/:sessionId
```

**删除会话**
```
DELETE /api/sessions/:sessionId
```

### 数据导入

```
POST /api/sessions/:sessionId/import
Content-Type: application/json

{
  "type": "jsonl",  // jsonl | events | offer | answer | ice_candidate
  "data": "数据内容"
}
```

### 数据导出

```
GET /api/sessions/:sessionId/export?format=markdown
```

支持的格式：
- `markdown` - Markdown 报告
- `json` - JSON 格式
- `jsonl` - JSONL 事件流
- `audit` - 完整审计包

### 运行校验

```
POST /api/sessions/:sessionId/validate
```

### 网络注入

```
POST /api/sessions/:sessionId/network-inject
Content-Type: application/json

{
  "type": "latency",      // latency | packet_loss | disconnect
  "latency": 500,         // 延迟时间 (ms)
  "packetLoss": 0.1,      // 丢包率 (0-1)
  "duration": 10000       // 持续时间 (ms)
}
```

### 保存复盘

```
POST /api/sessions/:sessionId/save
```

### 历史复盘

**获取列表**
```
GET /api/replays
```

**加载复盘**
```
GET /api/replays/:replayId
```

## 配置说明

可以通过环境变量修改配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | 3000 |
| `STORAGE_PATH` | 存储路径 | `./data` |

也可以修改 `server/src/config.js` 文件进行更细粒度的配置：

```javascript
{
  WEBRTC: {
    ICE_TIMEOUT: 30000,        // ICE 超时 (ms)
    CONNECTION_TIMEOUT: 60000,  // 连接超时 (ms)
    RECONNECT_ATTEMPTS: 3,      // 最大重连次数
    RECONNECT_DELAY: 5000,      // 重连间隔 (ms)
  },
  
  VALIDATION_RULES: {
    NEGOTIATION_TIMEOUT: 10000,    // 协商超时阈值 (ms)
    RECONNECT_TIMEOUT: 30000,      // 重连超时阈值 (ms)
    RECORDING_GAP_THRESHOLD: 5000, // 录制缺口阈值 (ms)
    AUDIO_TRACK_EXPECTED: true,     // 是否期望音频轨道
    VIDEO_TRACK_EXPECTED: false,    // 是否期望视频轨道
  },
  
  NETWORK_INJECTION: {
    MAX_LATENCY: 5000,          // 最大注入延迟 (ms)
    MAX_PACKET_LOSS: 1.0,       // 最大丢包率 (1.0 = 100%)
    DEFAULT_DURATION: 10000,    // 默认持续时间 (ms)
  },
}
```

## 常见故障场景

### 1. 候选人听不到声音

可能的原因：
- Answer 的方向是 `recvonly` 而非 `sendrecv`
- 音频轨道未创建
- 音频电平持续为 0

检测方法：
1. 导入数据后查看 **"概览"** 标签页的媒体轨道
2. 点击 **"运行校验"** 检查是否有相关警告
3. 查看 **"原始数据"** 标签页的 SDP 内容

### 2. ICE 反复重连

可能的原因：
- 缺少公网 ICE Candidate（srflx 或 relay 类型）
- 网络不稳定
- 防火墙问题

检测方法：
1. 查看 **"事件时间线"** 中的 `reconnect_start` 事件
2. 运行校验检查 **"ICE Candidate 数量"** 规则
3. 检查是否只有 `host` 类型的 candidate

### 3. 录制缺口

可能的原因：
- 连接断开后录制未暂停
- 重连耗时过长
- 录制事件和信令不同步

检测方法：
1. 运行校验后查看 **"录制缺口"** 规则
2. 查看 **"事件时间线"** 中的 `recording_gap` 事件
3. 检查 stop → start 之间的时间间隔

## 故障排查指南

### 服务无法启动

1. 检查 Node.js 版本：`node --version` (需要 >= 16.0.0)
2. 检查端口是否被占用：`lsof -i :3000`
3. 尝试使用其他端口：`PORT=8080 npm start`

### 导入失败

1. 检查 JSON 格式是否正确
2. 确认 `type` 字段是否为支持的类型
3. 检查 `timestamp` 是否为数字（毫秒时间戳）

### 校验规则不通过

1. 查看校验结果中的详细信息
2. 检查数据是否完整
3. 根据提示调整配置阈值（如 `RECORDING_GAP_THRESHOLD`）

## 扩展开发

### 添加新的校验规则

编辑 `server/src/services/rulesEngine.js`：

1. 在 `VALIDATION_RULES` 中添加规则名
2. 添加校验方法 `validateXxx(stateMachine)`
3. 在 `validateAll` 方法中添加新规则

### 添加新的事件类型

编辑 `server/src/services/stateMachine.js`：

1. 在 `EVENT_TYPES` 中添加事件类型
2. 在 `processEvent` 方法中添加处理逻辑

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

## 技术栈

- **后端**: Node.js + Express + WebSocket
- **前端**: 原生 HTML/CSS/JavaScript (无框架依赖)
- **测试**: Node.js 内置测试框架
