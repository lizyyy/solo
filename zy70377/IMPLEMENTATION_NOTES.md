# 配送路径 ETA API - 实现说明文档

## 一、API 主要边界

### 1. 状态机边界

#### 订单生命周期状态
- **created**: 订单创建但未分配骑手
- **in_transit**: 骑手已接单，配送中
- **completed**: 订单已签收
- **isClosed**: 布尔标记，签收后自动设为 true

#### 关键边界规则
1. **签收后锁定**: 订单一旦签收（completed），所有后续操作都受限制
   - ETA 无法再更新
   - 延迟事件无法添加
   - 改派操作被拒绝
   - 位置上报只记录为"迟到数据"

2. **骑手归属验证**: 每次操作都验证骑手身份
   - 轨迹上报：非当前骑手的数据被标记为旧骑手数据
   - 签收：必须是当前负责骑手
   - 改派：新骑手必须与当前骑手不同

3. **ETA 计算边界**:
   - 最小值：5 分钟（防止预估过短）
   - 历史变化：只记录变化 >= 2 分钟的调整（减少噪声）
   - 签收后：返回最终快照，不再重新计算

### 2. 数据一致性边界

#### 轨迹点幂等性
- 基于 locationHash 去重：`orderId + riderId + lat + lon + timestamp(分钟精度)`
- 1 分钟内相同坐标的重复上报被自动忽略
- 返回 `isDuplicate: true` 但不报错

#### 延迟事件状态
- 每个延迟事件有 `resolved` 布尔字段
- 只有 `resolved: false` 的事件才计入 ETA 计算
- 调用 resolve 后延迟分钟数从 ETA 中移除

#### 改派历史追踪
- 每次改派记录完整的新旧骑手信息
- `ReassignmentEvent.getActiveRider()` 总是返回最新骑手
- 旧骑手的轨迹数据保留但不再用于 ETA 计算

### 3. 业务规则边界

#### 优先级调整
- **normal**: 基础 ETA，无调整
- **high**: ETA 缩短 5 分钟（跳过部分队列）
- **urgent**: ETA 缩短 10 分钟（立即处理）
- 调整后 ETA 仍 >= 5 分钟

#### 骑手离线检测
- 超过 15 分钟无位置更新 = 自动标记为离线
- 离线骑手触发 +15 分钟缓冲调整
- 责任归因标记为 `rider`（骑手责任）

#### 延迟归因分类
| 延迟类型 | 责任方 | 说明 |
|---------|--------|------|
| weather | external | 外部不可抗力 |
| traffic | external | 外部路况 |
| rider_offline | rider | 骑手责任 |
| reassignment | system | 系统调度 |
| other | system | 其他系统原因 |

---

## 二、一个失败路径

### 场景：骑手改派失败的完整路径

#### 失败路径描述
**路径名称**: 签收后尝试改派

**触发条件**:
1. 订单已完成正常签收流程
2. 客服或系统后续尝试改派骑手

**错误的业务影响**:
- 可能导致订单状态混乱
- 重复计费风险
- 骑手调度系统异常

**系统保护机制**:

```
步骤1: 订单签收
POST /api/orders/{orderId}/sign
响应: status=completed, isClosed=true

步骤2: 尝试改派（失败路径）
POST /api/orders/{orderId}/reassign
请求体: { newRiderId: "rider_005", reason: "manual" }

步骤3: 系统拦截
OrderService.reassignRider() 检查:
  → 调用 SignatureEvent.getSignatureByOrderId()
  → 发现存在签收记录
  → 立即返回错误响应

步骤4: 返回结果
HTTP 200 OK（业务错误，非 HTTP 错误）
{
  "success": true,
  "data": {
    "message": "订单已签收，无法进行改派",
    "isSigned": true
  }
}
```

**关键代码位置**:
- `src/services/OrderService.js:150-156`（签收检查）
- `src/models/SignatureEvent.js:27-33`（签收记录查询）

**为什么是失败路径**:
- 签收是不可逆操作
- 改派在签收后没有业务意义
- 如果允许改派，会导致责任归属混乱
- 系统必须在服务层硬拦截

**类似的失败路径**:
1. 签收后上报延迟事件 → 被拒绝
2. 签收后更新优先级 → 被拒绝  
3. 非当前骑手签收 → 被拒绝
4. 重复签收 → 被忽略（幂等处理）

---

## 三、一次重复执行路径

### 场景：骑手位置重复上报的幂等处理

#### 重复执行路径描述

**路径名称**: 同一分钟内相同坐标的重复位置上报

**业务背景**:
- 骑手手机 GPS 可能因网络抖动发送重复数据
- 消息队列可能有重试机制导致重复消费
- 前端可能因用户误触发送重复请求

**幂等设计原则**:
- 重复执行不改变系统状态
- 重复执行返回相同（或可识别）的响应
- 不产生副作用（不重复计算 ETA）

**完整执行流程**:

```
第一次执行（正常流程）:
─────────────────────────────────

请求1:
POST /api/orders/{orderId}/track
{
  "riderId": "rider_001",
  "latitude": 39.9150,
  "longitude": 116.4610,
  "speed": 30.0,
  "timestamp": 1715600000000  // 假设是 10:30:00
}

处理流程:
1. TrackPoint.isDuplicate() 检查
   → 计算 locationHash:
     "order123_rider_001_39.9150_116.4610_285933"
     (timestamp 按分钟取整: 1715600000000/60000 = 28593333)
   → 数据库无此 hash，不是重复
   
2. TrackPoint.create() 写入数据
   → 生成新的 TrackPoint ID
   
3. 触发 ETA 重新计算
   → ETACalculatorService.updateAndRecordETA()
   → 如果变化 >= 2 分钟，记录 ETA 历史

响应1:
{
  "success": true,
  "data": {
    "trackPoint": {
      "id": "track_xxx_001",
      "locationHash": "order123_rider_001_39.9150_116.4610_285933"
    },
    "etaUpdate": {
      "previousEta": 30,
      "newEta": 25,
      "deltaMinutes": -5,
      "historyRecord": { ... }
    }
  }
}

─────────────────────────────────

第二次执行（重复上报，10:30:45 相同坐标）:
─────────────────────────────────

请求2（5 秒后，相同数据，timestamp=1715600005000）:
POST /api/orders/{orderId}/track
{
  "riderId": "rider_001",
  "latitude": 39.9150,
  "longitude": 116.4610,
  "speed": 30.0,
  "timestamp": 1715600005000  // 10:30:05，分钟取整仍为 285933
}

处理流程:
1. TrackPoint.isDuplicate() 检查
   → 计算 locationHash:
     "order123_rider_001_39.9150_116.4610_285933"
     (1715600005000/60000 = 28593333，取整后相同)
   → 数据库已有此 hash → 判定为重复
   
2. 立即返回，不执行后续操作
   → 不写入 TrackPoint
   → 不触发 ETA 计算
   → 不修改订单状态

响应2（幂等响应）:
{
  "success": true,
  "data": {
    "message": "重复的位置上报已被忽略（幂等处理）",
    "isDuplicate": true
  }
}

─────────────────────────────────

第三次执行（10:31:01，相同坐标，新的一分钟）:
─────────────────────────────────

请求3（timestamp=1715600061000）:
POST /api/orders/{orderId}/track
{
  "riderId": "rider_001",
  "latitude": 39.9150,
  "longitude": 116.4610,
  "timestamp": 1715600061000  // 10:31:01，分钟取整 = 28593334
}

处理流程:
1. TrackPoint.isDuplicate() 检查
   → locationHash 包含新的分钟值 28593334
   → 数据库无此 hash → 不是重复
   
2. 正常处理（同第一次）
   → 写入新的 TrackPoint
   → 触发 ETA 计算

响应3（正常响应，新的记录）:
{
  "success": true,
  "data": {
    "trackPoint": {
      "id": "track_xxx_002",  // 新的 ID
      "locationHash": "order123_rider_001_39.9150_116.4610_28593334"
    },
    "etaUpdate": { ... }
  }
}
```

**幂等性设计要点**:

1. **去重键设计**:
   ```javascript
   // src/models/TrackPoint.js:48-52
   locationHash = `${orderId}_${riderId}_${latitude}_${longitude}_${Math.floor(timestamp / 60000)}`
   ```
   - 包含所有关键维度
   - 时间粒度：分钟级（避免毫秒级抖动）

2. **检查时机**:
   - 在写入数据库之前
   - 在任何副作用（ETA 计算）之前

3. **重复响应**:
   - 明确标记 `isDuplicate: true`
   - 不返回 null 或错误
   - 调用方可据此判断是否需要重试

4. **边界情况**:
   - 同一分钟内：重复 → 忽略
   - 下一分钟：相同坐标 → 新记录（骑手可能在原地等待）
   - 不同骑手：相同坐标 → 新记录（不同骑手）

**其他幂等操作**:
1. **重复签收**: `isDuplicate: true`
2. **相同优先级更新**: `noChange: true`
3. **改派给同一骑手**: `noChange: true`

---

## 四、代码结构速查

```
/Users/lzy/pro/solo/workspaces/zy70377/
├── package.json                    # 依赖配置
├── .gitignore
├── IMPLEMENTATION_NOTES.md        # 本文档
│
├── src/
│   ├── server.js                   # Express 入口 + 错误处理
│   │
│   ├── models/                     # 数据模型（内存存储）
│   │   ├── Order.js               # 订单模型
│   │   ├── TrackPoint.js          # 轨迹点模型（含幂等检查）
│   │   ├── DelayEvent.js          # 延迟事件模型
│   │   ├── ReassignmentEvent.js   # 改派事件模型
│   │   ├── SignatureEvent.js      # 签收事件模型
│   │   └── EtaHistory.js          # ETA 历史记录
│   │
│   ├── services/                   # 业务逻辑
│   │   ├── OrderService.js        # 订单操作服务
│   │   └── ETACalculatorService.js # ETA 计算引擎
│   │
│   ├── routes/                     # API 路由
│   │   └── orders.js              # 订单相关路由
│   │
│   └── utils/
│       └── idGenerator.js         # ID 生成和时间工具
│
└── examples/
    └── curl_examples.sh           # 6 个场景的 curl 示例
```

---

## 五、快速测试命令

```bash
# 1. 安装依赖
npm install

# 2. 启动服务器
npm start

# 3. 在新终端运行示例
chmod +x examples/curl_examples.sh
./examples/curl_examples.sh

# 4. 健康检查
curl http://localhost:3000/health
```

---

## 六、复查清单（下一轮验证用）

### 边界验证
- [ ] 签收后尝试改派 → 返回 isSigned: true
- [ ] 签收后上报延迟 → 被拒绝
- [ ] 非当前骑手签收 → riderMismatch
- [ ] ETA 最小值 → 不小于 5 分钟
- [ ] 优先级调整后 ETA → 仍 >= 5 分钟

### 失败路径验证  
- [ ] 签收后改派完整流程
- [ ] 缺失必填字段 → 400 错误
- [ ] 不存在的订单 → 404 错误
- [ ] 无效优先级值 → 抛出异常

### 重复执行验证
- [ ] 1 分钟内相同坐标 → isDuplicate: true
- [ ] 下一分钟相同坐标 → 新记录
- [ ] 重复签收 → isDuplicate: true
- [ ] 相同优先级更新 → noChange: true

### ETA 计算验证
- [ ] 天气延迟 → external 责任
- [ ] 骑手离线 → rider 责任
- [ ] 改派 → system 责任  
- [ ] 高优先级 → -5 分钟
- [ ] 加急 → -10 分钟
- [ ] 客服摘要包含所有关键信息
