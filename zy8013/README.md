# 多人排班墙 - WebSocket 事件回放调试台

一个用于调试多人协作实时同步系统的本地 WebSocket 事件回放调试台。支持多客户端实时同步、事件日志、回放测试场景（乱序、重复、断线重连）、状态差异对比。

## 项目结构

```
zy8013/
├── server/
│   ├── index.js          # 主服务器入口 (WebSocket + HTTP)
│   ├── roomManager.js    # 房间管理、状态机、事件处理
│   ├── replayManager.js  # 事件回放管理器 (内置5个测试脚本)
│   └── persistence.js    # JSON 文件持久化
├── client/
│   ├── index.html        # 主页面
│   ├── style.css         # 样式
│   └── app.js            # 客户端逻辑
├── shared/
│   ├── constants.js      # 常量定义 (事件类型、状态等)
│   ├── types.js          # 类型工厂和验证
│   └── stateMachine.js   # 核心状态机 (事件应用、幂等性、差异计算)
├── data/                 # 持久化数据目录 (运行时生成)
├── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务启动后访问：**http://localhost:3000**

### 3. 本地演示流程

#### 步骤 1：打开两个客户端窗口

1. 第一个窗口：http://localhost:3000
2. 第二个窗口：http://localhost:3000 (新标签页或另一个浏览器)

#### 步骤 2：加入演示房间

默认房间 ID 为 `demo-room-1`，已预设 3 个示例卡片：

- **设计数据库架构** (待办)
- **实现用户认证** (进行中，负责人: Alice)
- **编写API文档** (已完成，负责人: Bob)

在两个客户端中：
1. 确认房间输入框显示 `demo-room-1`
2. 点击 **"加入房间"** 按钮

你应该能看到：
- 两个客户端都显示相同的卡片
- "在线成员" 列表显示 2 个成员
- 任意一方拖动卡片，另一方实时同步

#### 步骤 3：测试实时同步

在第一个客户端中：
1. 双击任意卡片打开编辑对话框
2. 修改标题或负责人，点击保存
3. 或直接拖动卡片到不同的状态列

观察第二个客户端：
- 变更应在 1 秒内同步显示
- 点击 **"显示事件日志"** 查看事件流

#### 步骤 4：运行事件回放脚本

内置 5 个测试场景脚本，用于验证边界条件：

1. 在左侧 **"事件回放脚本"** 列表中选择一个脚本
2. 建议先选 **"基础同步场景"** 或 **"重复事件场景"**
3. 点击 **"开始回放"**

可用脚本：

| 脚本名称 | 描述 | 事件数 |
|---------|------|--------|
| 基础同步场景 | 两个客户端创建并移动卡片，验证实时同步 | 5 |
| 乱序事件场景 | 模拟网络延迟导致事件乱序到达 | 3 |
| 重复事件场景 | 模拟网络重发导致重复事件，验证幂等性 | 5 |
| 断线重连场景 | 模拟客户端断线期间的事件补发 | 5 |
| 综合复杂场景 | 结合乱序、重复、并发操作的综合测试 | 7 |

#### 步骤 5：对比状态差异

1. 在任意客户端点击 **"显示差异"** 按钮
2. 如果客户端状态与服务端一致，显示 **"无差异"**
3. 可以测试：模拟一个客户端不处理某些事件（实际中需要代码模拟），然后查看差异

## 核心功能

### 1. 多客户端实时同步

- 任意数量客户端可加入同一房间
- 卡片拖拽改变状态实时广播
- 事件溯源架构，所有变更通过事件记录

### 2. 边界条件处理

#### 重复事件 ID
```
状态机通过 eventIds Set 跟踪已处理事件
同一 event.id 再次到达时，返回 success: true, isDuplicate: true
```

#### 断线重连补发
```
客户端重连时发送 sync_request，携带 lastEventSequence
服务端返回 missedEvents = 所有 sequence > sinceSequence 的事件
```

#### 乱序事件
```
服务端按接收顺序处理，通过 sequence 保证最终一致性
客户端可通过同步机制拉取完整状态
```

### 3. 事件日志与回放

- 所有事件持久化到 `data/events-{roomId}.json`
- 可查看每个事件的：类型、时间戳、序号、payload
- 回放脚本可模拟各种异常场景

### 4. 状态差异对比

服务端可计算任意客户端状态与权威状态的差异：
- `card_missing`: 服务端有，客户端无
- `card_extra`: 客户端有，服务端无
- `field_diff`: 某字段值不同

## API 参考

### WebSocket 消息格式

#### 客户端发送

```json
{
  "type": "join_room",
  "roomId": "demo-room-1"
}

{
  "type": "card_created",
  "roomId": "demo-room-1",
  "id": "evt-123",
  "payload": {
    "cardId": "card-456",
    "title": "新任务",
    "status": "todo"
  }
}

{
  "type": "sync_request",
  "roomId": "demo-room-1",
  "sinceSequence": 0
}

{
  "type": "start_replay",
  "roomId": "demo-room-1",
  "scriptId": "duplicate_events"
}

{
  "type": "get_diff",
  "roomId": "demo-room-1"
}
```

#### 服务端响应

```json
{
  "type": "room_joined",
  "roomId": "demo-room-1",
  "room": { "id": "...", "name": "...", "members": [...] },
  "cards": [...],
  "events": [...]
}

{
  "type": "event_applied",
  "event": { "id": "...", "type": "...", "sequence": 1 },
  "result": { "success": true, "isDuplicate": false }
}

{
  "type": "sync_response",
  "missedEvents": [...],
  "cards": [...]
}

{
  "type": "diff_result",
  "diff": {
    "diffs": [
      { "type": "field_diff", "cardId": "...", "field": "status", 
        "serverValue": "done", "clientValue": "in_progress" }
    ]
  }
}
```

### HTTP API

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/rooms` | GET | 获取所有房间列表 |
| `/api/rooms/:roomId` | GET | 获取单个房间详情 |
| `/api/scripts` | GET | 获取所有回放脚本列表 |

## 持久化格式

数据存储在 `data/` 目录，每个房间 3 个文件：

### room-{roomId}.json
```json
{
  "id": "demo-room-1",
  "name": "演示房间 1",
  "cards": [...],
  "members": ["client-a", "client-b"],
  "createdAt": 1234567890000,
  "lastEventAt": 1234567890000
}
```

### events-{roomId}.json
```json
[
  {
    "id": "evt-001",
    "type": "card_created",
    "roomId": "demo-room-1",
    "payload": { "cardId": "card-001", "title": "..." },
    "clientId": "client-a",
    "timestamp": 1234567890000,
    "sequence": 1,
    "receivedAt": 1234567890000
  }
]
```

### clients-{roomId}.json
```json
{
  "client-a": {
    "clientId": "client-a",
    "roomId": "demo-room-1",
    "cards": { ... },
    "lastEventSequence": 5,
    "lastSyncAt": 1234567890000
  }
}
```

## 扩展开发

### 添加新的回放脚本

编辑 `server/replayManager.js` 中的 `createBuiltinScripts()` 方法，添加新的脚本配置。

### 自定义卡片字段

1. 修改 `shared/constants.js` 中的状态定义
2. 更新 `shared/types.js` 中的 `validateCard` 函数
3. 更新 `client/app.js` 中的渲染逻辑

### 更换持久化方案

替换 `server/persistence.js` 的实现，可改为 SQLite、PostgreSQL 等。

## 许可证

MIT
