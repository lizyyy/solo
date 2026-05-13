# 异地多活冲突 API - 边界情况、失败路径与重复执行路径

## 主要边界条件

### 1. 时间戳精度边界

**场景**：两个区域的写入时间戳相同或非常接近（毫秒级）

**边界条件**：
- 当两个区域的版本号（timestamp）完全相同时，last_write 策略可能产生不确定结果
- 不同区域的时钟可能存在偏差，导致时间戳比较不可靠

**当前处理**：
- 使用 `>=` 比较，后写入的（timestamp 更大的）会覆盖
- 对于完全相同的 timestamp，后到达的会覆盖先到达的

**复查建议**：
```bash
# 测试相同时间戳的写入
curl -X POST "http://localhost:3000/api/regions/CN-East/users" \
  -d '{"userId": "test_boundary_1", "data": {"profile": {"name": "A"}}, "timestamp": 1000000000000}'

curl -X POST "http://localhost:3000/api/regions/US-West/users" \
  -d '{"userId": "test_boundary_1", "data": {"profile": {"name": "B"}}, "timestamp": 1000000000000}'
```

---

### 2. 字段路径不存在边界

**场景**：基准数据中不存在的字段，在传入数据中新增

**边界条件**：
- 嵌套路径不存在时，deepGet 返回 undefined
- 需要正确处理新增字段和删除字段的情况

**当前处理**：
- 新增字段：自动合并到数据中
- 删除字段：不会自动处理（需要完整数据提交）

**复查建议**：
```bash
# 测试新增字段
curl -X POST "http://localhost:3000/api/regions/CN-East/users" \
  -d '{"userId": "test_boundary_2", "data": {"profile": {"name": "张三"}}, "timestamp": 1000000000000}'

curl -X POST "http://localhost:3000/api/regions/US-West/users" \
  -d '{"userId": "test_boundary_2", "data": {"profile": {"name": "张三", "phone": "13800001111"}}, "timestamp": 1000000000001}'
```

---

### 3. 库存数值类型边界

**场景**：库存字段的类型不一致或超出预期范围

**边界条件**：
- baseValue 或 incomingValue 不是数字类型
- 库存为负数
- 库存值非常大（溢出风险）

**当前处理**：
- 非数字类型的 inventory.quantity 会进入 conflict_arbitration
- 保守策略取较小值，负数会被保留（可能是超卖场景）

**复查建议**：
```bash
# 测试非数字库存
curl -X POST "http://localhost:3000/api/regions/CN-East/users" \
  -d '{"userId": "test_boundary_3", "data": {"inventory": {"quantity": "不是数字"}}, "timestamp": 1000000000000}'

# 测试负数库存
curl -X POST "http://localhost:3000/api/regions/US-West/users" \
  -d '{"userId": "test_boundary_3", "data": {"inventory": {"quantity": -50}}, "timestamp": 1000000000001}'
```

---

### 4. 冲突记录大小边界

**场景**：单个用户的数据非常大，或产生大量冲突字段

**边界条件**：
- 内存存储可能受限于进程可用内存
- 冲突记录会保存完整的两份数据副本

**当前处理**：
- 无限制的内存存储（演示用途）
- 实际生产环境需要持久化存储

**复查建议**：
- 考虑大数据量用户场景下的内存使用
- 评估冲突记录的存储策略

---

## 失败路径

### 失败路径 1: 仲裁过程中部分区域同步失败

**场景描述**：
人工仲裁成功执行，在广播到所有区域时，某个区域的同步失败（例如网络中断）。

**失败流程**：
```
1. 用户调用 /api/conflicts/:id/arbitrate
2. 仲裁逻辑计算出 resolvedData 和 newVersion
3. 更新 CN-East 区域的用户数据 ✓
4. 生成 CN-East 的同步事件 ✓
5. 尝试更新 US-West 区域时失败（模拟：内存错误、磁盘满等）
6. 仲裁响应返回"成功"，但 US-West 数据未更新
```

**当前实现的问题**：
- `server.js:410-448` 中的循环没有错误处理
- 一个区域失败不会回滚其他区域
- 没有重试机制
- 没有事务保证

**复查验证步骤**：
```bash
# 1. 先创建一个冲突
curl -X POST "http://localhost:3000/api/regions/CN-East/users" \
  -d '{"userId": "fail_test_1", "data": {"address": {"city": "上海"}}, "timestamp": 1000000000000}'

curl -X POST "http://localhost:3000/api/regions/US-West/users" \
  -d '{"userId": "fail_test_1", "data": {"address": {"city": "北京"}}, "timestamp": 1000000000001}'

# 获取 conflictId
CONFLICT_ID=$(curl -s "http://localhost:3000/api/regions/US-West/conflicts" | python3 -c "import sys,json; print(json.load(sys.stdin)['conflicts'][0]['conflictId'])")

# 2. 执行仲裁（正常流程）
curl -X POST "http://localhost:3000/api/conflicts/$CONFLICT_ID/arbitrate" \
  -H "Content-Type: application/json" \
  -d '{"arbiter": "admin", "resolution": {"strategy": "USE_INCOMING"}}'

# 3. 验证两个区域是否一致
curl "http://localhost:3000/api/regions/CN-East/users/fail_test_1"
curl "http://localhost:3000/api/regions/US-West/users/fail_test_1"
```

**预期问题**：
如果在循环中某一步失败，可能出现：
- CN-East 已更新，US-West 未更新
- 冲突状态标记为 RESOLVED，但数据不一致

---

### 失败路径 2: 重复仲裁调用

**场景描述**：
同一个 conflictId 被多次仲裁（用户误操作、网络重试等）。

**失败流程**：
```
1. 第一次仲裁：选择 USE_INCOMING，版本 v100
2. 第二次仲裁：选择 USE_BASE，版本 v200（时间戳更新）
3. 第三次仲裁：使用自定义数据，版本 v300
```

**当前实现的问题**：
- 没有检查冲突是否已经被仲裁过
- 每次仲裁都会生成新版本并覆盖
- 没有仲裁历史记录

**复查验证步骤**：
```bash
# 1. 创建冲突
curl -X POST "http://localhost:3000/api/regions/CN-East/users" \
  -d '{"userId": "fail_test_2", "data": {"address": {"city": "上海"}}, "timestamp": 1000000000000}'

curl -X POST "http://localhost:3000/api/regions/US-West/users" \
  -d '{"userId": "fail_test_2", "data": {"address": {"city": "北京"}}, "timestamp": 1000000000001}'

# 获取 conflictId
CONFLICT_ID=$(curl -s "http://localhost:3000/api/regions/US-West/conflicts" | python3 -c "import sys,json; conflicts=[c for c in json.load(sys.stdin)['conflicts'] if c['userId']=='fail_test_2']; print(conflicts[0]['conflictId'] if conflicts else 'NONE')")

if [ "$CONFLICT_ID" != "NONE" ]; then
  # 2. 第一次仲裁
  curl -X POST "http://localhost:3000/api/conflicts/$CONFLICT_ID/arbitrate" \
    -H "Content-Type: application/json" \
    -d '{"arbiter": "admin1", "resolution": {"strategy": "USE_INCOMING"}, "note": "第一次仲裁"}'
  
  sleep 1
  
  # 3. 第二次仲裁（覆盖第一次）
  curl -X POST "http://localhost:3000/api/conflicts/$CONFLICT_ID/arbitrate" \
    -H "Content-Type: application/json" \
    -d '{"arbiter": "admin2", "resolution": {"strategy": "USE_BASE"}, "note": "第二次仲裁"}'
  
  # 4. 检查冲突详情，只能看到最后一次仲裁结果
  curl "http://localhost:3000/api/conflicts/$CONFLICT_ID"
fi
```

**预期问题**：
- 第二次仲裁会覆盖第一次的结果
- 无法追溯仲裁历史
- 没有防重入机制

---

### 失败路径 3: 同步事件 version 检查漏洞

**场景描述**：
同步事件的 version 小于或等于当前版本时被标记为 STALE，但可能丢失重要更新。

**失败流程**：
```
1. CN-East 写入 v100
2. US-West 写入 v99（旧时间戳）
3. 同步 v99 到 CN-East，被拒绝（STALE）
4. 但 v99 可能包含重要的新增字段！
```

**当前实现的问题**：
- `server.js:213-227` 直接拒绝 version <= existingVersion 的事件
- 没有检查是否有新增字段可以合并
- 简单的版本比较可能丢失数据

**复查验证步骤**：
```bash
# 1. 先在 CN-East 创建用户 v100（只有 name）
curl -X POST "http://localhost:3000/api/regions/CN-East/users" \
  -d '{"userId": "fail_test_3", "data": {"profile": {"name": "张三"}}, "timestamp": 100}'

# 2. 在 US-West 写入 v99（有 phone 字段，但时间戳更早）
curl -X POST "http://localhost:3000/api/regions/US-West/users" \
  -d '{"userId": "fail_test_3", "data": {"profile": {"name": "张三", "phone": "13800001111"}}, "timestamp": 99}'

# 3. 尝试同步 US-West 的 v99 到 CN-East
curl -X POST "http://localhost:3000/api/sync/event" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "fail_test_sync_1",
    "userId": "fail_test_3",
    "sourceRegion": "US-West",
    "targetRegion": "CN-East",
    "data": {"profile": {"name": "张三", "phone": "13800001111"}},
    "version": 99,
    "timestamp": 99
  }'

# 4. 检查 CN-East 是否有 phone 字段
curl "http://localhost:3000/api/regions/CN-East/users/fail_test_3"
```

**预期问题**：
- 同步事件被标记为 STALE
- CN-East 永远不会有 phone 字段
- 新增字段被忽略

---

## 重复执行路径

### 重复执行路径 1: 同步事件幂等性

**场景描述**：
同一个同步事件由于网络重试被发送多次。

**执行流程**：
```
第一次执行：
1. 检查 eventId 是否存在 → 不存在
2. 记录事件到 syncEvents
3. 处理同步逻辑
4. 返回 SYNCED

第二次执行：
1. 检查 eventId 是否存在 → 已存在
2. 直接返回 IDEMPOTENT
3. 不执行任何数据修改
```

**当前实现**：
- `server.js:157-171` 实现了基于 eventId 的幂等检查
- 直接返回已有的事件记录

**复查验证步骤**：
```bash
# 1. 首次发送
curl -X POST "http://localhost:3000/api/sync/event" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "idempotent_test_1",
    "userId": "retry_test_1",
    "sourceRegion": "CN-East",
    "targetRegion": "US-West",
    "data": {"profile": {"name": "测试用户"}},
    "version": 200,
    "timestamp": 200
  }'

# 2. 立即重发（模拟网络重试）
curl -X POST "http://localhost:3000/api/sync/event" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "idempotent_test_1",
    "userId": "retry_test_1",
    "sourceRegion": "CN-East",
    "targetRegion": "US-West",
    "data": {"profile": {"name": "测试用户"}},
    "version": 200,
    "timestamp": 200
  }'

# 3. 延迟后重发（模拟消息队列重试）
sleep 2
curl -X POST "http://localhost:3000/api/sync/event" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "idempotent_test_1",
    "userId": "retry_test_1",
    "sourceRegion": "CN-East",
    "targetRegion": "US-West",
    "data": {"profile": {"name": "测试用户"}},
    "version": 200,
    "timestamp": 200
  }'

# 4. 验证数据只被处理了一次
curl "http://localhost:3000/api/regions/US-West/users/retry_test_1"
```

**验证要点**：
- 三次调用中，第一次返回 SYNCED，后两次返回 IDEMPOTENT
- 用户数据只包含一次写入的结果
- 不会出现重复累加或覆盖问题

---

### 重复执行路径 2: 用户写入幂等性（隐含）

**场景描述**：
客户端由于网络超时重试相同的写入请求。

**执行流程**：
```
第一次写入 v100：
1. 检查用户是否存在 → 不存在
2. 创建用户，版本 v100
3. 返回 SUCCESS

第二次写入 v100（相同数据）：
1. 检查用户是否存在 → 存在，版本 v100
2. 比较数据 → 相同
3. 合并逻辑无冲突
4. 版本号相同，last_write 不改变
5. 返回 SUCCESS（但实际无变化）
```

**当前实现**：
- 没有显式的写入幂等机制
- 依赖版本号和数据比较

**复查验证步骤**：
```bash
# 1. 首次写入
curl -X POST "http://localhost:3000/api/regions/CN-East/users" \
  -d '{"userId": "retry_test_2", "data": {"profile": {"name": "A"}}, "timestamp": 300}'

# 2. 重发相同请求（相同数据、相同版本）
curl -X POST "http://localhost:3000/api/regions/CN-East/users" \
  -d '{"userId": "retry_test_2", "data": {"profile": {"name": "A"}}, "timestamp": 300}'

# 3. 检查版本号是否变化
curl "http://localhost:3000/api/regions/CN-East/users/retry_test_2"
```

**注意**：
- 当前实现没有显式的写入事件 ID
- 如果两次请求的数据略有不同，可能产生意外结果
- 实际生产建议增加 writeRequestId

---

### 重复执行路径 3: 冲突查询的幂等性

**场景描述**：
用户多次刷新页面或重试查询请求。

**执行流程**：
```
每次调用 GET /api/regions/:region/conflicts：
1. 读取内存中的冲突列表
2. 不修改任何数据
3. 返回相同的结果
```

**当前实现**：
- 所有 GET 请求都是只读的
- 天然幂等

**复查验证步骤**：
```bash
# 多次调用查询接口
for i in 1 2 3; do
  echo "=== 第 $i 次查询 ==="
  curl "http://localhost:3000/api/regions/US-West/conflicts"
  echo ""
done
```

**验证要点**：
- 每次返回结果一致
- 没有副作用
- 可以安全重试

---

## 下一轮复查建议清单

### 核心功能复查
- [ ] 两个区域同时修改同一地址字段 → 能否正确检测冲突？
- [ ] 冲突仲裁后 → 两个区域的版本号是否一致？
- [ ] 库存冲突 → 是否保留了补偿建议？
- [ ] 重复同步事件 → 是否正确返回 IDEMPOTENT？
- [ ] 用户资料字段（name, email, phone）→ 是否自动合并？

### 边界情况复查
- [ ] 时间戳相同的写入 → 行为是否可预测？
- [ ] 新增字段的同步 → 是否正确合并？
- [ ] 非数字库存 → 是否进入仲裁队列？
- [ ] 空数据写入 → 是否正确处理？

### 失败路径复查
- [ ] 仲裁部分区域失败 → 能否检测并恢复？
- [ ] 重复仲裁 → 是否需要保护机制？
- [ ] 旧版本但含新增字段 → 是否会丢失？
- [ ] 网络中断后的重试 → 数据是否一致？

### 重复执行复查
- [ ] 同步事件重复发送 → 是否幂等？
- [ ] 用户写入重复 → 版本号是否正确？
- [ ] 查询接口重复 → 是否无副作用？
- [ ] 仲裁接口重复 → 是否需要防重？
