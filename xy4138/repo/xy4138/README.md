# 赛道遥测黑匣子 (Track Telemetry Blackbox)

机器人比赛遥测回放与分析工具，支持历史数据回放和实时 WebSocket 数据接收。

## 功能特性

- **双模式支持**：历史数据回放模式 + 实时 WebSocket 接收模式
- **多数据源**：支持 JSONL 运行日志、CSV 控制指令、YAML 赛道标注
- **可视化分析**：
  - 时间轴导航，支持暂停、快进、逐帧播放
  - 状态机状态切换可视化
  - 关键事件时间线展示
  - 延迟统计与告警
- **复盘功能**：
  - 自定义标签标记
  - 会话保存与加载
  - Markdown/CSV/JSON 报告导出

## 项目结构

```
track-telemetry-blackbox/
├── package.json              # 项目配置
├── README.md                 # 本文档
├── src/
│   ├── server/               # 后端服务
│   │   ├── index.js          # 服务入口
│   │   ├── protocols/        # 协议定义
│   │   ├── parsers/          # 数据解析器
│   │   ├── scheduler/        # 回放调度器
│   │   ├── storage/          # 状态存储
│   │   └── exporters/        # 报告导出
│   └── public/               # 前端静态文件
│       ├── index.html        # 主页面
│       ├── css/              # 样式文件
│       └── js/               # 前端逻辑
├── data/                     # 示例数据目录
├── tests/                    # 测试脚本
└── sessions/                 # 复盘会话存储
```

## 安装步骤

1. 安装依赖：
```bash
npm install
```

2. 启动服务：
```bash
npm start
```

3. 访问前端页面：
```
http://localhost:8080
```

## 数据格式说明

### 1. 运行日志 (JSONL)
每行一个 JSON 对象，记录机器人运行状态：

```json
{
  "timestamp": 1620000000000,
  "sequence": 1,
  "state": "IDLE",
  "position": {"x": 0, "y": 0, "theta": 0},
  "velocity": {"linear": 0, "angular": 0},
  "battery": 12.5,
  "emergency_stop": false,
  "sensors": {"lidar": [...], "imu": {...}}
}
```

### 2. 控制指令 (CSV)
记录发送给机器人的控制指令：

```csv
timestamp,sequence,command_type,linear_vel,angular_vel,status
1620000000000,1,VELOCITY,0.5,0.0,SENT
1620000000100,2,VELOCITY,0.0,0.0,ACKNOWLEDGED
```

### 3. 赛道标注 (YAML)
赛道地图和关键点标注：

```yaml
track_name: "2024_spring_competition"
track_length: 100.5
checkpoints:
  - id: 1
    position: {x: 10, y: 0}
    type: "start"
  - id: 2
    position: {x: 50, y: 20}
    type: "corner"
```

## 验证流程

### 第一步：基础环境验证
1. 运行 `npm install` 确保依赖安装成功
2. 运行 `npm start` 启动服务
3. 检查终端输出，确认服务在 8080 端口启动
4. 浏览器访问 `http://localhost:8080` 确认页面加载

### 第二步：示例数据回放验证
1. 点击页面右上角 "加载示例数据" 按钮
2. 确认时间轴正确显示数据范围
3. 点击 "播放" 按钮，观察数据是否按时间顺序播放
4. 测试 "暂停"、"快进"、"倒退"、"逐帧" 等控制功能

### 第三步：实时模式验证
1. 在另一个终端运行测试脚本：
   ```bash
   node tests/realtime-simulator.js
   ```
2. 回到前端页面，切换到 "实时模式"
3. 确认实时数据正在接收和显示

### 第四步：标签和会话功能验证
1. 在播放过程中，点击 "添加标签" 按钮
2. 输入标签名称和描述，确认标签出现在时间轴上
3. 点击 "保存会话"，选择存储位置
4. 刷新页面后，点击 "加载会话" 确认数据恢复

### 第五步：报告导出验证
1. 加载数据并添加一些标签
2. 分别选择导出 Markdown、CSV、JSON 格式
3. 检查导出文件内容是否完整

## WebSocket 协议

### 连接地址
- 历史模式：`ws://localhost:8080/ws/replay`
- 实时模式：`ws://localhost:8080/ws/realtime`

### 消息格式

#### 服务端 -> 客户端 (遥测帧)
```json
{
  "type": "telemetry",
  "timestamp": 1620000000000,
  "sequence": 1,
  "data": {
    "state": "RUNNING",
    "position": {"x": 10, "y": 5, "theta": 0.5},
    "velocity": {"linear": 0.8, "angular": 0.1},
    "battery": 12.3,
    "emergency_stop": false
  },
  "latency": {
    "command_ack": 15,
    "sensor_update": 8
  }
}
```

#### 客户端 -> 服务端 (控制命令)
```json
{
  "type": "control",
  "action": "play|pause|seek|stop",
  "params": {
    "timestamp": 1620000000000,
    "speed": 1.0
  }
}
```

#### 服务端 -> 客户端 (事件通知)
```json
{
  "type": "event",
  "event_type": "STATE_CHANGE|EMERGENCY_STOP|LATENCY_WARNING",
  "timestamp": 1620000000000,
  "details": {
    "from": "IDLE",
    "to": "RUNNING"
  }
}
```

## API 接口

### 数据加载
- `POST /api/load/jsonl` - 上传 JSONL 日志文件
- `POST /api/load/csv` - 上传 CSV 控制指令
- `POST /api/load/yaml` - 上传 YAML 赛道标注

### 会话管理
- `GET /api/sessions` - 获取已保存的会话列表
- `POST /api/sessions` - 保存当前会话
- `GET /api/sessions/:id` - 加载指定会话
- `DELETE /api/sessions/:id` - 删除会话

### 报告导出
- `GET /api/export/markdown` - 导出 Markdown 报告
- `GET /api/export/csv` - 导出 CSV 数据
- `GET /api/export/json` - 导出 JSON 数据

## 常见问题

### Q: 支持哪些浏览器？
A: 推荐使用 Chrome 或 Firefox 最新版本。

### Q: 最大支持多大的数据文件？
A: 建议单个文件不超过 100MB。对于更大的文件，可以考虑分片处理。

### Q: 如何添加自定义数据解析器？
A: 在 `src/server/parsers/` 目录下添加新的解析器，并在 `index.js` 中注册。

## 许可证

MIT License
