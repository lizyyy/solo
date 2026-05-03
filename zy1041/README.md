# 顺路带物 API 服务

一个本地可运行的纯后端 API 服务，用于管理"顺路带物"这种小范围互助场景。比如同楼、同园区的人下楼买咖啡、去前台、去地铁口时，可以顺手帮别人带个小东西。

## 功能特性

### 1. 核心数据模型

- **请求单 (Request)**: 发起人、取货点、送达点、物品类型、重量/体积、最晚送达时间、可接受的小费、备注
- **顺路人行程 (Trip)**: 出发点、经过点、目的地、时间窗口、可带容量、禁带品规则
- **订单 (Order)**: 关联请求单和行程，包含状态流转
- **审计日志 (AuditLog)**: 记录所有关键操作事件

### 2. 撮合接口

根据以下维度计算匹配分数，并返回为什么匹配或为什么被过滤掉：

- **路线相近度** (35%): 取货点和送达点是否在行程路线上，方向是否正确
- **时间窗口** (25%): 最晚送达时间是否在行程时间范围内
- **容量匹配** (20%): 物品重量/体积是否在顺路人可带范围内
- **禁带品过滤** (10%): 物品类型是否被顺路人禁止
- **小费权重** (10%): 小费越高匹配分数越高

### 3. 接单状态机

```
┌─────────────────────────────────────────────────────────────────────┐
│                         状态流转图                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  pending_matching (待撮合)                                          │
│       │                                                              │
│       ├───顺路人锁定──→ locked (已锁定)                             │
│       │                      │                                      │
│       │                      ├───双方确认──→ both_confirmed         │
│       │                      │                      │               │
│       │                      │                      ├───取到物品──→ │
│       │                      │                      │   picked_up   │
│       │                      │                      │       │       │
│       │                      │                      │       └───┐   │
│       │                      │                      │           │   │
│       │                      │                      │      送达   │
│       │                      │                      │           │   │
│       │                      │                      ↓           ↓   │
│       │                      │              delivered (已送达)      │
│       │                      │                                    │
│       ├───发起人取消──┐       │                                    │
│       │              │       ├───任一方取消───→ cancelled (取消)  │
│       │              │       │                                    │
│       │              ├───系统超时──→ timeout_released (超时释放)  │
│       │              │                                            │
│       │              │                                            │
│       │              └───任一环节发起争议──→ in_dispute (争议中)  │
│                                                                    │
│  终止状态: delivered, cancelled, timeout_released (无法再变更)    │
│                                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 4. 幂等和并发保护

- **重复提交保护**: 同一个顺路人重复提交同一个接单请求，返回幂等成功
- **并发抢单保护**: 两个顺路人同时抢同一个单时，只有一个能成功
- **数据库锁机制**: 使用 SQLite 的事务和唯一约束实现分布式锁

### 5. 审计日志

- 每次撮合、接单、确认、取消、争议都会留下事件
- 支持按请求单导出 Markdown 日报
- 包含 Mermaid 状态流转图

### 6. 数据持久化

- 使用 SQLite 本地数据库
- 重启后数据不丢失
- 数据库文件: `data/errand.db`

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务启动后访问: http://localhost:3000

### 3. 加载示例数据 (可选)

```bash
npm run load-samples
```

这会创建 4 个请求单和 3 个行程，用于测试各种场景。

## API 接口

### 健康检查

```bash
curl http://localhost:3000/health
```

### 请求单管理

#### 创建请求单

```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "requester_id": "user_alice",
    "pickup_location": "星巴克",
    "dropoff_location": "2号楼",
    "item_type": "咖啡饮料",
    "weight": 0.5,
    "volume": 1.0,
    "latest_delivery_time": "2026-05-03T18:00:00",
    "tip_amount": 8,
    "notes": "热拿铁，少糖"
  }'
```

#### 获取请求单列表

```bash
curl http://localhost:3000/api/requests
curl http://localhost:3000/api/requests?status=pending
curl http://localhost:3000/api/requests?requester_id=user_alice
```

#### 获取单个请求单

```bash
curl http://localhost:3000/api/requests/{request_id}
```

### 行程管理

#### 创建行程

```bash
curl -X POST http://localhost:3000/api/trips \
  -H "Content-Type: application/json" \
  -d '{
    "traveler_id": "user_tom",
    "start_location": "1号楼",
    "waypoints": ["星巴克", "前台"],
    "destination": "地铁口",
    "departure_time": "2026-05-03T17:00:00",
    "arrival_time": "2026-05-03T19:00:00",
    "available_capacity_weight": 5,
    "available_capacity_volume": 10,
    "forbidden_items": []
  }'
```

#### 获取行程列表

```bash
curl http://localhost:3000/api/trips
curl http://localhost:3000/api/trips?status=active
curl http://localhost:3000/api/trips?traveler_id=user_tom
```

### 撮合接口

#### 为请求单匹配行程

```bash
curl http://localhost:3000/api/matching/request/{request_id}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "request_id": "xxx",
    "match_count": 2,
    "total_trip_count": 3,
    "best_matches": [
      {
        "matched": true,
        "request_id": "xxx",
        "trip_id": "yyy",
        "total_score": 0.85,
        "components": {
          "route_proximity": { "score": 0.9, "weight": 0.35, "description": "..." },
          "time_window": { "score": 0.8, "weight": 0.25, "description": "..." },
          "capacity": { "score": 1.0, "weight": 0.20, "description": "..." },
          "forbidden_items": { "score": 1.0, "weight": 0.10, "description": "..." },
          "tip_amount": { "score": 0.7, "weight": 0.10, "description": "小费金额: ¥8" }
        },
        "filters_passed": ["route_proximity", "time_window", "capacity", "forbidden_items"],
        "filters_failed": []
      }
    ],
    "unmatched_trips": [
      {
        "matched": false,
        "trip_id": "zzz",
        "filters_failed": [
          { "filter": "forbidden_items", "reason": "物品类型\"生鲜水果\"属于顺路人禁带品列表: 生鲜, 易碎" }
        ]
      }
    ]
  }
}
```

#### 为行程匹配请求单

```bash
curl http://localhost:3000/api/matching/trip/{trip_id}
```

#### 计算具体的匹配分数

```bash
curl "http://localhost:3000/api/matching/score?request_id={request_id}&trip_id={trip_id}"
```

### 订单状态管理

#### 锁定订单 (接单)

```bash
curl -X POST http://localhost:3000/api/orders/lock \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "{request_id}",
    "traveler_id": "user_tom"
  }'
```

#### 确认订单

```bash
curl -X POST http://localhost:3000/api/orders/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "{order_id}",
    "actor_id": "user_alice",
    "actor_type": "requester"
  }'
```

#### 标记取到物品

```bash
curl -X POST http://localhost:3000/api/orders/pickup \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "{order_id}",
    "traveler_id": "user_tom"
  }'
```

#### 标记送达

```bash
curl -X POST http://localhost:3000/api/orders/deliver \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "{order_id}",
    "traveler_id": "user_tom"
  }'
```

#### 取消订单

```bash
curl -X POST http://localhost:3000/api/orders/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "{order_id}",
    "actor_id": "user_alice",
    "actor_type": "requester",
    "reason": "不需要了"
  }'
```

#### 发起争议

```bash
curl -X POST http://localhost:3000/api/orders/dispute \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "{order_id}",
    "actor_id": "user_alice",
    "actor_type": "requester",
    "dispute_reason": "物品损坏"
  }'
```

#### 获取订单状态

```bash
curl http://localhost:3000/api/orders/{order_id}
```

#### 获取订单列表

```bash
curl http://localhost:3000/api/orders
curl http://localhost:3000/api/orders?request_id={request_id}
curl http://localhost:3000/api/orders?trip_id={trip_id}
```

### 审计日志

#### 获取请求单的审计日志

```bash
curl http://localhost:3000/api/audit/request/{request_id}
```

#### 导出请求单的 Markdown 日报

```bash
curl http://localhost:3000/api/audit/request/{request_id}/markdown
```

#### 导出今日所有日报

```bash
curl http://localhost:3000/api/audit/daily-report
curl "http://localhost:3000/api/audit/daily-report?date=2026-05-03"
```

## 测试脚本

项目包含几个测试脚本，可以直接运行演示各种场景。

### 1. 正常流程测试

演示一个完整的接单流程：

```bash
# 先启动服务
npm start

# 打开另一个终端运行
bash scripts/test-normal-flow.sh
```

**测试流程:**
1. 检查服务健康状态
2. Alice 创建带咖啡的请求单
3. Tom 创建经过星巴克的行程
4. 撮合匹配（查看匹配分数详情）
5. Tom 锁定订单（接单）
6. Alice 确认订单
7. Tom 标记取到物品
8. Tom 标记送达
9. 查看订单最终状态和审计日志
10. 导出 Markdown 日报

### 2. 冲突场景测试

演示各种异常情况的处理：

```bash
bash scripts/test-conflict-cases.sh
```

**测试场景:**

| 场景 | 描述 |
|------|------|
| 禁带品过滤 | 生鲜水果请求被禁带生鲜的行程过滤 |
| 容量限制 | 15kg 物品被 5kg 容量的行程过滤 |
| 重复接单 | 同一人重复接单返回幂等成功 |
| 并发抢单 | 第二人抢单被拒绝 |
| 非法流转 | 已取消订单无法再确认/送达 |

### 3. 预期响应示例

**并发抢单失败响应:**
```json
{
  "success": false,
  "error": "ORDER_ALREADY_LOCKED",
  "message": "该请求单已被其他顺路人锁定",
  "locked_by": "user_tom",
  "current_status": "locked"
}
```

**非法状态流转响应:**
```json
{
  "success": false,
  "error": "INVALID_TRANSITION",
  "message": "订单已处于终止状态\"取消\"，无法再进行状态变更"
}
```

**禁带品过滤的匹配结果:**
```json
{
  "matched": false,
  "filters_failed": [
    {
      "filter": "forbidden_items",
      "reason": "物品类型\"生鲜水果\"属于顺路人禁带品列表: 生鲜, 易碎"
    }
  ]
}
```

## 项目结构

```
zy1041/
├── src/
│   ├── server.js              # 服务入口
│   ├── config/
│   │   └── database.js        # SQLite 数据库配置
│   ├── models/
│   │   ├── Request.js         # 请求单模型
│   │   ├── Trip.js            # 行程模型
│   │   ├── Order.js           # 订单模型
│   │   └── AuditLog.js        # 审计日志模型
│   ├── services/
│   │   ├── StateMachineService.js    # 状态机服务
│   │   ├── MatchingEngine.js         # 撮合引擎
│   │   ├── LockService.js            # 锁服务（并发控制）
│   │   ├── OrderService.js           # 订单服务
│   │   └── AuditService.js           # 审计服务
│   ├── controllers/
│   │   ├── requestController.js      # 请求单控制器
│   │   ├── tripController.js         # 行程控制器
│   │   ├── matchingController.js     # 撮合控制器
│   │   ├── orderController.js        # 订单控制器
│   │   └── auditController.js        # 审计控制器
│   ├── routes/
│   │   ├── requests.js        # 请求单路由
│   │   ├── trips.js           # 行程路由
│   │   ├── matching.js        # 撮合路由
│   │   ├── orders.js          # 订单路由
│   │   └── audit.js           # 审计路由
│   └── utils/
│       └── constants.js       # 常量定义
├── scripts/
│   ├── sample-data.js         # 示例数据
│   ├── test-normal-flow.sh    # 正常流程测试
│   └── test-conflict-cases.sh # 冲突场景测试
├── data/
│   └── errand.db              # SQLite 数据库文件
├── package.json
└── README.md
```

## 可用位置别名

撮合引擎支持以下位置别名（不区分大小写）：

| 位置名称 | 别名 |
|---------|------|
| 1号楼, 2号楼, 3号楼 | building_1/2/3 |
| 前台 | reception |
| 星巴克 | starbucks |
| 便利店 | convenience_store |
| 地铁口 | metro_entrance |
| 园区东门 | east_gate |
| 停车场 | parking_lot |
| 快递柜 | package_locker |

**位置匹配规则:**
1. 完全匹配
2. 包含匹配（如"星巴克咖啡"包含"星巴克"）
3. 别名匹配

## 状态流转规则

| 当前状态 | 可转换到 | 执行者 |
|---------|---------|--------|
| pending_matching (待撮合) | locked (已锁定) | 顺路人 |
| pending_matching | cancelled (取消) | 发起人 |
| pending_matching | timeout_released (超时释放) | 系统 |
| locked (已锁定) | both_confirmed (双方确认) | 发起人或顺路人 |
| locked | cancelled (取消) | 任一方 |
| locked | timeout_released | 系统 |
| both_confirmed | picked_up (取到物) | 顺路人 |
| both_confirmed | cancelled (取消) | 任一方 |
| both_confirmed | in_dispute (争议中) | 任一方 |
| picked_up | delivered (已送达) | 顺路人 |
| picked_up | cancelled (取消) | 任一方 |
| picked_up | in_dispute (争议中) | 任一方 |
| delivered | - | 终止状态 |
| cancelled | - | 终止状态 |
| timeout_released | - | 终止状态 |
| in_dispute | cancelled / delivered | 系统 |

## 许可证

MIT
