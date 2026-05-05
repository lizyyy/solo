# 剧本杀房间调度台

一个为小型剧本杀店设计的实时房间调度系统，支持前台多浏览器监控房间状态，DM 通过手机/平板上报事件，后端提供 REST + WebSocket 实时同步。

## 功能特性

### 前台功能
- 实时房间状态监控（空闲/进行中/暂停/已结束）
- 创建今日场次
- 按房间广播通知
- 实时通知处理（求助/换道具/通知）
- 连接状态显示和断线提示
- 场次时间线回看
- 导出 Markdown 交班单

### DM 控制台功能
- 场次选择和控制
- 开场/暂停/继续/结束操作
- 实时计时器
- 求助前台
- 换道具请求
- 通知接收

### 后端功能
- REST API 管理房间、场次、事件
- WebSocket 实时事件广播
- 断线自动重连
- 未确认消息补发
- SQLite 数据持久化
- 心跳检测

## 技术栈

- **后端**: Python 3.9+, FastAPI, SQLAlchemy, WebSocket
- **前端**: 原生 HTML + CSS + JavaScript (无框架依赖)
- **数据库**: SQLite
- **部署**: Uvicorn ASGI 服务器

## 快速开始

### 1. 环境准备

```bash
# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

### 2. 初始化数据库和示例数据

```bash
python init_data.py
```

这将创建：
- 5 个主题房间（恐怖/古风/现代/科幻/沉浸）
- 3 个今日待开始场次
- 1 个已完成的示例场次（包含完整事件时间线）

### 3. 启动服务器

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务器启动后访问：

| 页面 | 地址 | 说明 |
|------|------|------|
| 前台监控 | http://localhost:8000/front-desk | 房间状态监控、场次管理 |
| DM 控制台 | http://localhost:8000/dm-console | 手机/平板操作页面 |
| API 文档 | http://localhost:8000/docs | Swagger 交互式文档 |
| ReDoc | http://localhost:8000/redoc | ReDoc API 文档 |

### 4. 运行测试

```bash
# 确保服务器已启动
python test_api.py
```

## 验证流程

### 步骤 1：启动服务

```bash
# 终端 1：启动服务器
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 步骤 2：打开前台监控页面

在浏览器中打开：
```
http://localhost:8000/front-desk
```

你应该能看到：
- 5 个房间卡片（恐怖/古风/现代/科幻/沉浸）
- 3 个今日待开始场次
- 顶部连接状态显示为绿色（已连接）
- 统计栏显示房间数、进行中场次等

### 步骤 3：打开 DM 控制台

在另一个浏览器标签或手机浏览器中打开：
```
http://localhost:8000/dm-console
```

你应该能看到：
- 场次选择下拉框
- 连接状态显示

### 步骤 4：创建新场次（前台操作）

1. 在前台页面右侧"创建今日场次"表单中：
   - 选择房间：恐怖主题房
   - 剧本名称：《窗边的女人》
   - DM 姓名：测试DM
   - 玩家人数：6
   - 开始时间：选择当前时间

2. 点击"创建场次"按钮

3. 观察房间状态变化：
   - 恐怖主题房卡片应该更新为"待开始"状态
   - 今日场次列表应该新增刚才创建的场次

### 步骤 5：DM 操作流程

1. 在 DM 控制台页面：
   - 下拉框选择刚才创建的场次
   - 点击"确认选择"

2. 进入控制界面后：
   - 点击"开场"按钮（绿色）
   - 观察计时器开始计时
   - 状态变为"进行中"

3. 回到前台页面观察：
   - 恐怖主题房卡片状态变为"进行中"（绿色边框）
   - 统计栏"进行中"数字增加

### 步骤 6：测试实时事件同步

1. 在 DM 控制台：
   - 点击"求助"按钮
   - 输入内容："需要玩家补充资料"
   - 点击"发送求助"

2. 观察前台页面：
   - 实时通知区域应该出现红色的求助通知
   - 显示"🆘 求助"类型
   - 有"确认处理"按钮

3. 在前台点击"确认处理"：
   - 通知状态变为已处理
   - DM 控制台应该收到确认提示（如果在前台确认前仍在页面）

### 步骤 7：测试换道具功能

1. 在 DM 控制台：
   - 点击"换道具"按钮
   - 输入内容："需要替换破损的蜡烛道具"
   - 点击"发送请求"

2. 观察前台页面：
   - 通知区域出现黄色的换道具通知
   - 可以点击确认处理

### 步骤 8：测试暂停/继续

1. 在 DM 控制台：
   - 点击"暂停"按钮
   - 确认暂停操作

2. 观察前台：
   - 房间状态变为"已暂停"（黄色边框，闪烁效果）
   - 计时器停止

3. 在 DM 控制台点击"继续"：
   - 房间状态恢复为"进行中"
   - 计时器继续

### 步骤 9：测试广播通知（前台→DM）

1. 在前台页面右侧"广播通知"区域：
   - 选择房间：恐怖主题房
   - 输入内容："还有30分钟结束，请把控时间"
   - 点击"发送通知"

2. 观察 DM 控制台：
   - 应该收到新通知
   - 通知列表显示内容

### 步骤 10：测试时间线回看和交班单导出

1. 在 DM 控制台点击"结束"按钮
2. 确认结束操作

3. 在前台页面：
   - 找到恐怖主题房卡片
   - 点击"查看时间线"按钮

4. 在时间线弹窗中：
   - 应该能看到完整的事件序列：
     - 开场
     - 求助
     - 换道具
     - 暂停
     - 继续
     - 结束
   - 每个事件显示时间、类型、内容、发送者

5. 点击"导出 Markdown 交班单"按钮：
   - 应该下载一个 .md 文件
   - 文件包含场次基本信息和完整时间线

### 步骤 11：测试断线重连

1. 模拟网络中断（可以断开网络或刷新页面）

2. 观察页面：
   - 顶部会显示红色的断线警告
   - 连接指示灯变为红色

3. 恢复网络：
   - 系统会自动尝试重连
   - 连接成功后警告消失
   - 如果断线期间有消息，会补发

## API 接口说明

### 房间管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/rooms/ | 获取所有房间 |
| GET | /api/rooms/{id} | 获取单个房间 |
| GET | /api/rooms/status/all | 获取所有房间状态（含当前场次） |
| POST | /api/rooms/ | 创建房间 |
| PUT | /api/rooms/{id} | 更新房间 |
| DELETE | /api/rooms/{id} | 禁用房间 |

### 场次管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/sessions/ | 获取所有场次 |
| GET | /api/sessions/today | 获取今日场次 |
| GET | /api/sessions/{id} | 获取单个场次 |
| GET | /api/sessions/{id}/events | 获取场次的所有事件 |
| POST | /api/sessions/ | 创建场次 |
| PUT | /api/sessions/{id} | 更新场次 |
| DELETE | /api/sessions/{id} | 删除场次（仅待开始） |

### 事件管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/events/ | 获取所有事件 |
| GET | /api/events/unacknowledged | 获取未确认事件 |
| GET | /api/events/{id} | 获取单个事件 |
| POST | /api/events/ | 创建事件 |
| POST | /api/events/{id}/acknowledge | 确认事件 |
| POST | /api/events/broadcast | 广播通知到房间 |

### WebSocket 接口

连接地址：`ws://localhost:8000/ws/{client_id}?user_type={type}&room_id={room_id}`

参数说明：
- `client_id`: 客户端唯一标识
- `user_type`: `front_desk` 或 `dm`
- `room_id`: 可选，绑定房间 ID

消息格式：
```json
{
  "type": "event",
  "data": {
    "session_id": 1,
    "event_type": "start",
    "content": "可选内容"
  }
}
```

消息类型：
- `event`: 事件上报
- `heartbeat`: 心跳检测
- `acknowledge`: 确认事件
- `missing_messages`: 请求补发缺失消息

## 数据模型

### Room（房间）
- `id`: 主键
- `name`: 房间名称（唯一）
- `capacity`: 容纳人数
- `is_active`: 是否启用

### Session（场次）
- `id`: 主键
- `room_id`: 关联房间
- `script_name`: 剧本名称
- `dm_name`: DM 姓名
- `player_count`: 玩家人数
- `scheduled_time`: 计划时间
- `actual_start_time`: 实际开始时间
- `actual_end_time`: 实际结束时间
- `status`: 状态（scheduled/in_progress/paused/ended）

### Event（事件）
- `id`: 主键
- `session_id`: 关联场次
- `event_type`: 事件类型（start/pause/resume/end/help/change_props/notification）
- `sender`: 发送者（dm/front_desk/system）
- `content`: 内容
- `event_metadata`: 元数据（JSON）
- `is_acknowledged`: 是否已确认
- `acknowledged_by`: 确认人
- `acknowledged_at`: 确认时间

## 目录结构

```
xy4793/
├── main.py              # 主应用入口
├── database.py          # 数据库连接配置
├── models.py            # 数据模型定义
├── websocket_manager.py # WebSocket 连接管理
├── requirements.txt     # Python 依赖
├── init_data.py         # 示例数据初始化
├── test_api.py          # API 测试脚本
├── README.md            # 本文档
├── routers/             # API 路由
│   ├── rooms.py         # 房间管理 API
│   ├── sessions.py      # 场次管理 API
│   └── events.py        # 事件管理 API
├── templates/           # 前端页面
│   ├── front_desk.html  # 前台监控页面
│   └── dm_console.html  # DM 控制台页面
└── static/              # 静态资源（可选）
```

## 常见问题

### Q: 为什么页面显示"与服务器连接已断开"？
A: 可能的原因：
1. 服务器未启动或已停止
2. 网络连接问题
3. 防火墙阻止了 WebSocket 连接

解决方法：
1. 确认服务器正在运行（检查终端输出）
2. 检查网络连接
3. 尝试刷新页面

### Q: DM 控制台看不到场次？
A: 可能的原因：
1. 未创建场次
2. 场次状态为 ended（已结束）

解决方法：
1. 在前台页面创建新场次
2. 确认场次状态为 scheduled 或 in_progress

### Q: 导出的 Markdown 文件在哪里？
A: 文件会下载到浏览器的默认下载目录，文件名为：
`交班单_{剧本名称}_{日期}.md`

### Q: 如何查看已结束场次的时间线？
A: 目前只能通过 API 访问：
```
GET /api/sessions/{id}/events
```

可以在前台页面扩展此功能。

## 扩展建议

1. **用户认证**: 添加登录功能，区分不同前台和 DM
2. **权限管理**: 限制 DM 只能操作自己的场次
3. **数据统计**: 添加场次时长统计、DM 评分等
4. **消息推送**: 集成短信/钉钉/企业微信通知
5. **多店支持**: 添加店铺维度，支持连锁店
6. **移动端优化**: 进一步优化手机端体验
7. **语音功能**: 支持语音求助和通知
8. **道具管理**: 完善道具库存和借还流程

## 许可证

MIT License
