# 异地多活冲突 API - 演示文档

## 项目概述

本项目实现了一个异地多活冲突解决系统，用于模拟两个地理区域（CN-East 和 US-West）之间的数据同步、冲突检测和解决机制。

### 核心功能

1. **多区域数据写入**：支持两个区域独立写入用户数据
2. **版本控制**：基于时间戳的版本号机制
3. **同步事件**：跨区域数据同步，支持幂等处理
4. **冲突检测**：自动检测同一数据的并发修改
5. **自动合并**：不同字段根据策略自动合并
6. **人工仲裁**：无法自动合并的冲突支持人工介入
7. **结果广播**：仲裁结果自动同步到所有区域

### 字段合并策略

| 字段路径 | 合并策略 | 说明 |
|---------|---------|------|
| profile.name | last_write | 最后写入 wins |
| profile.email | last_write | 最后写入 wins |
| profile.phone | last_write | 最后写入 wins |
| address.street | conflict_arbitration | 需要人工仲裁 |
| address.city | conflict_arbitration | 需要人工仲裁 |
| address.province | conflict_arbitration | 需要人工仲裁 |
| address.postalCode | conflict_arbitration | 需要人工仲裁 |
| inventory.quantity | numeric_merge | 保守策略（取较小值），保留补偿建议 |

---

## API 端点

### 1. 写入用户数据

**POST** `/api/regions/:region/users`

写入指定区域的用户数据。

**请求体**：
```json
{
  "userId": "user_001",
  "data": {
    "profile": {
      "name": "张三",
      "email": "zhangsan@example.com"
    },
    "address": {
      "street": "人民路100号",
      "city": "上海",
      "province": "上海",
      "postalCode": "200000"
    }
  },
  "timestamp": 1000000000000
}
```

**响应**：
- `SUCCESS`: 写入成功
- `CONFLICT_DETECTED`: 检测到冲突

---

### 2. 同步事件

**POST** `/api/sync/event`

跨区域同步数据变更事件。

**请求体**：
```json
{
  "eventId": "sync_event_001",
  "userId": "user_001",
  "sourceRegion": "CN-East",
  "targetRegion": "US-West",
  "data": { ... },
  "version": 1000000000030,
  "timestamp": 1000000000030
}
```

**响应**：
- `SYNCED`: 同步成功
- `IDEMPOTENT`: 事件已处理（幂等）
- `STALE`: 版本过旧，已忽略
- `CONFLICT_DETECTED`: 检测到冲突

---

### 3. 查询区域冲突列表

**GET** `/api/regions/:region/conflicts`

获取指定区域的所有冲突记录。

**响应**：
```json
{
  "region": "US-West",
  "totalConflicts": 5,
  "pendingCount": 3,
  "resolvedCount": 2,
  "conflicts": [
    {
      "conflictId": "uuid",
      "userId": "user_001",
      "regions": ["CN-East", "US-West"],
      "status": "PENDING_ARBITRATION",
      "createdAt": 1778659484477,
      "conflicts": [
        {
          "field": "address.street",
          "baseValue": "上海地址",
          "incomingValue": "北京地址",
          "strategy": "conflict_arbitration",
          "autoMerged": false
        }
      ]
    }
  ]
}
```

---

### 4. 查询单个冲突详情

**GET** `/api/conflicts/:conflictId`

获取指定冲突的完整详情。

**响应**：
包含冲突的完整信息、两个版本的完整数据、字段级别的差异。

---

### 5. 人工仲裁

**POST** `/api/conflicts/:conflictId/arbitrate`

对冲突进行人工仲裁，并广播结果到所有区域。

**请求体**：
```json
{
  "arbiter": "admin_user",
  "resolution": {
    "strategy": "USE_INCOMING"
  },
  "note": "经过电话确认，用户最终选择了北京地址"
}
```

**仲裁策略**：
- `USE_BASE`: 使用基准版本（CN-East）
- `USE_INCOMING`: 使用传入版本（US-West）
- `USE_CUSTOM`: 使用自定义数据（需提供 customData）

---

### 6. 查询用户数据

**GET** `/api/regions/:region/users/:userId`

获取指定区域的用户数据及冲突状态。

**响应**：
```json
{
  "userId": "user_001",
  "region": "CN-East",
  "data": { ... },
  "version": 1778659484979,
  "lastUpdated": 1778659484979,
  "updatedBy": "ARBITRATION",
  "hasPendingConflicts": true,
  "pendingConflictIds": ["uuid1", "uuid2"]
}
```

---

## CURL 示例

### 场景 1: 用户资料无冲突合并

不同字段的修改可以自动合并，不会产生冲突。

```bash
# 步骤 1: 在 CN-East 区域创建初始用户数据
curl -X POST "http://localhost:3000/api/regions/CN-East/users" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_001",
    "data": {
      "profile": {
        "name": "张三",
        "email": "zhangsan@example.com"
      },
      "address": {
        "street": "人民路100号",
        "city": "上海",
        "province": "上海",
        "postalCode": "200000"
      }
    },
    "timestamp": 1000000000000
  }'
```

```bash
# 步骤 2: 在 US-West 区域添加电话（不同字段，无冲突）
curl -X POST "http://localhost:3000/api/regions/US-West/users" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_001",
    "data": {
      "profile": {
        "name": "张三",
        "email": "zhangsan@example.com",
        "phone": "13800001111"
      },
      "address": {
        "street": "人民路100号",
        "city": "上海",
        "province": "上海",
        "postalCode": "200000"
      }
    },
    "timestamp": 1000000000001
  }'
```

**说明**：由于 phone 字段在 CN-East 中不存在，两个区域修改的是不同字段，可以自动合并。

---

### 场景 2: 地址冲突检测

同一地址字段的并发修改会产生冲突，需要人工仲裁。

```bash
# 步骤 1: 在 CN-East 区域修改地址为上海
curl -X POST "http://localhost:3000/api/regions/CN-East/users" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_001",
    "data": {
      "profile": { "name": "张三" },
      "address": {
        "street": "南京路500号",
        "city": "上海",
        "province": "上海",
        "postalCode": "200001"
      }
    },
    "timestamp": 1000000000010
  }'
```

```bash
# 步骤 2: 在 US-West 区域同时修改地址为北京（产生冲突！）
curl -X POST "http://localhost:3000/api/regions/US-West/users" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_001",
    "data": {
      "profile": { "name": "张三" },
      "address": {
        "street": "北京路800号",
        "city": "北京",
        "province": "北京",
        "postalCode": "100000"
      }
    },
    "timestamp": 1000000000011
  }'
```

**响应示例**：
```json
{
  "status": "CONFLICT_DETECTED",
  "conflictId": "22cdb370-eb68-4057-ba97-7e78db339d8f",
  "conflicts": [
    {
      "field": "address.street",
      "baseValue": "人民路100号",
      "incomingValue": "北京路800号",
      "strategy": "conflict_arbitration",
      "autoMerged": false
    }
  ]
}
```

```bash
# 步骤 3: 查询冲突列表
curl "http://localhost:3000/api/regions/US-West/conflicts"
```

---

### 场景 3: 库存冲突（保守合并策略）

库存字段使用保守策略，取两个值中的较小值，并保留补偿建议。

```bash
# 步骤 1: 在 CN-East 区域写入库存 100
curl -X POST "http://localhost:3000/api/regions/CN-East/users" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_001",
    "data": {
      "profile": { "name": "张三" },
      "inventory": { "quantity": 100 }
    },
    "timestamp": 1000000000020
  }'
```

```bash
# 步骤 2: 在 US-West 区域同时修改库存为 80
curl -X POST "http://localhost:3000/api/regions/US-West/users" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_001",
    "data": {
      "profile": { "name": "张三" },
      "inventory": { "quantity": 80 }
    },
    "timestamp": 1000000000021
  }'
```

**库存合并规则**：
- 策略：保守合并（取较小值）
- 合并结果：80
- 补偿建议：建议对账确认实际库存，差值为 20 需要人工核对

---

### 场景 4: 重复同步事件（幂等性验证）

相同的同步事件只会处理一次，确保幂等性。

```bash
# 步骤 1: 首次发送同步事件
curl -X POST "http://localhost:3000/api/sync/event" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "sync_event_001",
    "userId": "user_001",
    "sourceRegion": "CN-East",
    "targetRegion": "US-West",
    "data": {
      "profile": {
        "name": "李四",
        "email": "lisi@example.com"
      }
    },
    "version": 1000000000030,
    "timestamp": 1000000000030
  }'
```

```bash
# 步骤 2: 重复发送相同事件（幂等处理）
curl -X POST "http://localhost:3000/api/sync/event" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "sync_event_001",
    "userId": "user_001",
    "sourceRegion": "CN-East",
    "targetRegion": "US-West",
    "data": {
      "profile": {
        "name": "李四",
        "email": "lisi@example.com"
      }
    },
    "version": 1000000000030,
    "timestamp": 1000000000030
  }'
```

**第二次响应**：
```json
{
  "status": "IDEMPOTENT",
  "eventId": "sync_event_001",
  "message": "Event already processed"
}
```

---

### 场景 5: 人工仲裁和结果广播

冲突仲裁后，结果会自动同步到两个区域。

```bash
# 步骤 1: 首先创建一个地址冲突（参考场景 2）
# 获取返回的 conflictId，例如：7acbf0ab-5341-48f5-a00e-8daf7ea20a92
```

```bash
# 步骤 2: 查询冲突详情
curl "http://localhost:3000/api/conflicts/7acbf0ab-5341-48f5-a00e-8daf7ea20a92"
```

```bash
# 步骤 3: 人工仲裁（选择使用 US-West 的地址）
curl -X POST "http://localhost:3000/api/conflicts/7acbf0ab-5341-48f5-a00e-8daf7ea20a92/arbitrate" \
  -H "Content-Type: application/json" \
  -d '{
    "arbiter": "admin_user",
    "resolution": {
      "strategy": "USE_INCOMING"
    },
    "note": "经过电话确认，用户最终选择了北京地址"
  }'
```

**仲裁响应**：
```json
{
  "status": "RESOLVED",
  "conflictId": "7acbf0ab-5341-48f5-a00e-8daf7ea20a92",
  "resolution": {
    "arbiter": "admin_user",
    "strategy": "USE_INCOMING",
    "note": "经过电话确认，用户最终选择了北京地址",
    "resolvedAt": 1778659484979
  },
  "syncEvents": [
    { "region": "CN-East", "eventId": "...", "status": "BROADCASTED" },
    { "region": "US-West", "eventId": "...", "status": "BROADCASTED" }
  ]
}
```

```bash
# 步骤 4: 验证两个区域的数据已对齐
curl "http://localhost:3000/api/regions/CN-East/users/user_001"
curl "http://localhost:3000/api/regions/US-West/users/user_001"
```

**验证结果**：两个区域的 address 字段都应该是"北京地址B"和"北京"，version 相同。

---

## 查询接口输出说明

冲突查询接口会输出以下信息：

1. **区域来源**：冲突涉及的区域列表
2. **字段差异**：每个冲突字段的具体值对比
3. **合并策略**：该字段使用的合并策略
4. **最终同步状态**：冲突的当前状态（PENDING_ARBITRATION / RESOLVED）
5. **补偿建议**：对于库存字段，包含差值和对账建议

---

## 快速启动

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 运行测试脚本
./test-scenarios.sh
```

服务默认运行在 `http://localhost:3000`
