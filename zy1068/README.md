# WebRTC 弱网协作预演台

一个本地 WebRTC 弱网协作预演工具，专为在线白板、协同编辑、远程操控等功能的前端开发者设计。

## 功能特性

### 🔗 WebRTC DataChannel 连接
- 本地信令服务（WebSocket）
- 房间码机制，支持多标签页双端测试
- 自动建立 WebRTC PeerConnection
- 可靠的 DataChannel 传输

### 🎯 真实协作消息类型
- **光标位置**: x/y 坐标、页面 ID
- **批注**: 评论、高亮、建议类型
- **白板笔画**: 钢笔、铅笔、橡皮擦、荧光笔
- **文档 Patch**: OT 操作、版本控制
- **纯文本**: 自定义文本消息

### 🌐 弱网模拟
预设 Profile：
- **地铁网络**: 高延迟 (300ms)、高抖动 (200ms)、丢包 5%
- **咖啡店 Wi-Fi**: 中等延迟 (100ms)、偶发丢包
- **海外会议**: 高延迟 (500ms)、稳定较慢
- **卫星网络**: 极高延迟 (800ms)、偶发断线
- **自定义**: 完全自定义参数

可调节参数：
- 延迟 (0-2000ms)
- 抖动 (0-1000ms) - 高斯分布
- 丢包率 (0-100%)
- 乱序率 (0-50%)
- 重复率 (0-50%)
- 断线概率 (0-30%) + 重连延迟 + 消息重放

### 📊 消息追踪与时间线
每条消息显示：
- 序号 (Seq)
- 发送时间
- 到达时间
- 延迟计算
- 状态标签：
  - 🟢 成功
  - 🟡 慢包 (>200ms)
  - 🔴 丢包
  - 🔵 乱序
  - 🟣 重复
  - 🩵 重放

### ⚠️ 风险检测
自动检测并提示：
- **光标过期**: 超过 5 秒无更新
- **Patch 冲突**: 同路径版本冲突
- **消息堆积**: 队列超过 20/50 条
- **高延迟**: 单条消息超过 500ms
- **高丢包率**: 超过 5%/15%
- **频繁重连**: 超过 3 次

### 📼 场景脚本回放
- 从 JSON 文件导入场景脚本
- 批量自动发送消息
- 支持自定义间隔和延迟
- 内置示例脚本

### 💾 会话管理
- 保存会话到本地 JSON 文件
- 重新打开已保存的会话
- 包含消息历史、弱网配置

### 📄 报告导出
支持导出三种格式：
1. **JSON**: 完整结构化数据
2. **Markdown**: 可读的报告文档
3. **HTML**: 美观的可视化报告

报告包含：
- 弱网配置详情
- 消息统计（成功/慢包/丢包/乱序/重复/重放）
- 延迟统计（平均/最大/最小）
- 风险列表
- 消息类型分布
- 回放摘要

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:8080` 启动。

### 3. 双端测试

1. **第一个端**：
   - 打开浏览器访问 `http://localhost:8080`
   - 点击 "创建房间"
   - 复制房间码

2. **第二个端**：
   - 打开另一个浏览器标签页访问 `http://localhost:8080`
   - 输入房间码
   - 点击 "加入房间"

3. 等待 DataChannel 连接建立（会有提示）

### 4. 开始测试

1. **发送消息**：
   - 选择消息类型（光标/批注/白板笔画/文档 Patch/文本）
   - 填写参数
   - 点击 "发送"

2. **开启弱网模拟**：
   - 在底部 "弱网模拟" 面板
   - 开启开关
   - 选择预设 Profile 或手动调节参数

3. **查看时间线**：
   - 右侧面板显示消息时间线
   - 可看到哪些包慢了、乱序了、被丢了

4. **查看风险提示**：
   - 如果有风险，会在顶部显示红色/黄色提示条

### 5. 使用场景脚本

1. 点击 "导入脚本"
2. 选择 `examples/basic-collaboration.json`
3. 点击 "开始回放"
4. 观察消息自动发送和接收情况

### 6. 导出报告

1. 完成测试后
2. 点击 "导出报告"
3. 选择格式（1=JSON, 2=Markdown, 3=HTML）
4. 文件将自动下载

## 项目结构

```
webrtc-weaknet-lab/
├── server/
│   └── index.js          # Node.js 信令服务器 + 静态文件服务
├── public/
│   ├── index.html        # 主页面
│   ├── css/
│   │   └── style.css     # 样式文件
│   └── js/
│       ├── utils.js      # 工具函数 + 弱网 Profile 定义
│       ├── signaling.js  # 信令通信 (WebSocket)
│       ├── webrtc.js     # WebRTC DataChannel 管理
│       ├── weaknet.js    # 弱网模拟器核心
│       ├── messages.js   # 消息类型定义
│       ├── timeline.js   # 时间线管理
│       ├── risk.js       # 风险检测
│       ├── replay.js     # 场景回放
│       ├── export.js     # 报告导出
│       ├── ui.js         # UI 交互逻辑
│       └── main.js       # 主入口
├── examples/
│   └── basic-collaboration.json  # 示例场景脚本
├── package.json
└── README.md
```

## 弱网 Profile 详解

| Profile | 延迟 | 抖动 | 丢包 | 乱序 | 重复 | 断线 |
|---------|------|------|------|------|------|------|
| 地铁网络 | 300ms | 200ms | 5% | 10% | 2% | 2% |
| 咖啡店 Wi-Fi | 100ms | 50ms | 2% | 3% | 1% | 0% |
| 海外会议 | 500ms | 100ms | 1% | 5% | 0% | 1% |
| 卫星网络 | 800ms | 300ms | 3% | 8% | 1% | 5% |

## 场景脚本格式

```json
{
  "name": "场景名称",
  "version": "1.0",
  "description": "场景描述",
  "interval": 500,
  "messages": [
    {
      "type": "cursor",
      "payload": { "x": 100, "y": 150, "pageId": "page-1" }
    },
    {
      "delay": 1000
    },
    {
      "type": "text",
      "payload": { "text": "自定义消息" }
    }
  ]
}
```

## 消息类型

### cursor (光标位置)
```javascript
{
  type: 'cursor',
  payload: {
    x: 100,           // X 坐标
    y: 200,           // Y 坐标
    pageId: 'page-1'  // 页面 ID
  }
}
```

### annotation (批注)
```javascript
{
  type: 'annotation',
  payload: {
    type: 'comment',      // comment/highlight/strikethrough/suggestion
    targetId: 'element-1',
    text: '批注内容',
    author: 'User A',
    position: { x: 50, y: 50 }
  }
}
```

### stroke (白板笔画)
```javascript
{
  type: 'stroke',
  payload: {
    strokeId: 'stroke-1',
    color: '#3b82f6',
    width: 3,
    opacity: 1,
    points: [
      { x: 100, y: 100, pressure: 0.8, time: 0 },
      { x: 150, y: 120, pressure: 0.75, time: 16 }
    ],
    tool: 'pen'  // pen/pencil/eraser/highlighter
  }
}
```

### patch (文档 Patch)
```javascript
{
  type: 'patch',
  payload: {
    path: '/document/chapter-1',
    from: 'v1',
    to: 'v2',
    ops: [
      { type: 'retain', value: 10 },
      { type: 'insert', value: '新增内容' },
      { type: 'delete', value: 5 }
    ],
    author: 'User A'
  }
}
```

## 技术栈

- **后端**: Node.js + Express + WebSocket (ws)
- **前端**: 原生 JavaScript (无框架依赖)
- **WebRTC**: 原生 RTCPeerConnection + RTCDataChannel
- **样式**: 纯 CSS + CSS 变量

## 注意事项

1. **浏览器要求**: 需要支持 WebRTC 的现代浏览器（Chrome、Firefox、Safari、Edge）
2. **本地运行**: 服务在 `localhost` 运行，不接入任何外部服务
3. **同一网络**: 两个端需要在同一浏览器（可以是不同标签页）
4. **无持久化**: 消息只保存在内存中，刷新页面会丢失（除非保存会话）

## 许可证

MIT License
