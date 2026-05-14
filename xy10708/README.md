# WebSocket订阅监控系统

轻量级WebSocket会话监控与订阅报告系统

## 核心功能

- ✅ **会话管理** - 创建、断开、重连WebSocket会话
- ✅ **权限校验** - 频道权限验证
- ✅ **心跳监控** - 会话存活状态与超时检测
- ✅ **消息积压** - 消息队列长度监控
- ✅ **订阅报告** - 完整事件审计日志
- ✅ **分组导出** - 按负责人、时间、心跳状态分组
- ✅ **防重复写入** - API幂等性保护

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务启动后访问: http://localhost:8000

## API 接口

### 会话管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sessions` | 创建会话 |
| GET | `/api/sessions` | 会话列表（支持搜索） |
| POST | `/api/sessions/{id}/heartbeat` | 发送心跳 |
| POST | `/api/sessions/{id}/disconnect` | 断开会话 |
| POST | `/api/sessions/{id}/reconnect` | 重连会话 |

### 报告与导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reports` | 订阅报告列表 |
| GET | `/api/reports/export?group_by=owner` | 按负责人分组导出 |
| GET | `/api/reports/export?group_by=time` | 按时间分组导出 |
| GET | `/api/reports/export?group_by=heartbeat` | 按心跳状态分组导出 |

### WebSocket连接

```
ws://localhost:8000/ws/{session_id}
```

## 验收测试流程

### 方式一：页面操作测试

1. 访问 http://localhost:8000
2. 进入「会话管理」标签页
3. 点击「创建会话」按钮
4. 查看会话列表确认创建成功
5. 点击「心跳」、「重连」、「断开」测试操作
6. 进入「订阅报告」查看完整操作记录

### 方式二：API幂等性验证（防止重复写入）

```bash
# 第一次创建（成功）
curl -X POST http://localhost:8000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"client_id":"test_dup","channel":"market_data","owner":"test"}'

# 第二次创建（返回409冲突）
curl -X POST http://localhost:8000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"client_id":"test_dup","channel":"market_data","owner":"test"}'
```

### 方式三：运行完整测试脚本

```bash
# 确保服务已启动，然后运行：
python test_api.py
```

## 失败路径测试

页面内置了4个失败路径测试按钮：

1. **无权限频道** - 验证403权限错误
2. **重复创建会话** - 验证409冲突保护
3. **无效会话心跳** - 验证会话状态校验
4. **不存在会话操作** - 验证404错误处理

## 数据模型

### WSSession（会话表）
- id: 会话ID
- client_id: 客户端ID
- channel: 频道
- owner: 负责人
- connected_at: 连接时间
- disconnected_at: 断开时间
- heartbeat_status: 心跳状态 (active/disconnected/timeout/overloaded)
- message_backlog: 消息积压
- is_active: 是否活跃
- permissions: 权限
- reconnect_count: 重连次数
- last_heartbeat: 最后心跳时间

### SubscriptionReport（订阅报告表）
- id: 报告ID
- session_id: 会话ID
- client_id: 客户端ID
- channel: 频道
- owner: 负责人
- event_type: 事件类型 (connect/heartbeat/disconnect/reconnect)
- timestamp: 时间戳
- details: 详情
- heartbeat_status: 心跳状态

## 频道权限配置

```python
CHANNEL_PERMISSIONS = {
    "trade": ["admin", "trader"],
    "market_data": ["admin", "trader", "viewer"],
    "notifications": ["admin", "trader", "viewer"],
    "system": ["admin"]
}
```

## 技术栈

- **后端**: FastAPI + SQLAlchemy + SQLite
- **前端**: 原生 HTML + JavaScript
- **协议**: REST API + WebSocket

## 项目结构

```
.
├── main.py          # FastAPI主应用
├── database.py      # 数据库模型
├── index.html       # 前端页面
├── test_api.py      # API测试脚本
├── requirements.txt # 依赖列表
└── ws_monitor.db   # SQLite数据库（自动创建）
└── README.md        # 本文档
```
