# 坏配置样例与边界测试指南

本文档展示了常见的错误配置和边界场景，帮助测试限流策略在异常情况下的行为。

---

## 一、App Key 相关问题

### 1. 无效的 App Key
**场景**: 使用不存在或已禁用的 App Key 发起请求

**测试命令**:
```bash
# 使用不存在的 App Key
curl -X POST "http://localhost:3000/api/rate-limit/check" \
  -H "Content-Type: application/json" \
  -d '{
    "appKey": "non_existent_key_12345",
    "path": "/api/users",
    "method": "GET"
  }'

# 使用已禁用的 App Key (ak_test_003)
curl -X POST "http://localhost:3000/api/rate-limit/check" \
  -H "Content-Type: application/json" \
  -d '{
    "appKey": "ak_test_003",
    "path": "/api/users",
    "method": "GET"
  }'
```

**预期行为**:
- 返回 `allowed: false`
- 返回 `reason: "invalid_app_key"`

---

### 2. App Key 格式错误
**场景**: 传入不符合预期格式的 App Key

**测试命令**:
```bash
# 空字符串
curl -X POST "http://localhost:3000/api/rate-limit/check" \
  -H "Content-Type: application/json" \
  -d '{
    "appKey": "",
    "path": "/api/users",
    "method": "GET"
  }'

# 超长字符串 (超过 100 字符)
LONG_KEY=$(python3 -c "print('x' * 101)")
curl -X POST "http://localhost:3000/api/rate-limit/check" \
  -H "Content-Type: application/json" \
  -d "{
    \"appKey\": \"$LONG_KEY\",
    \"path\": \"/api/users\",
    \"method\": \"GET\"
  }"
```

---

## 二、路由相关问题

### 3. 未配置限流的路由
**场景**: 请求未配置限流规则的路由

**测试命令**:
```bash
# 首先创建一个新路由但不配置限流
curl -X POST "http://localhost:3000/api/config/routes" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/api/unprotected",
    "method": "GET",
    "description": "未配置限流的路由",
    "isActive": true
  }'

# 请求该路由
curl -X POST "http://localhost:3000/api/rate-limit/check" \
  -H "Content-Type: application/json" \
  -d '{
    "appKey": "ak_test_001",
    "path": "/api/unprotected",
    "method": "GET"
  }'
```

**预期行为**:
- 返回 `allowed: true`
- 返回 `reason: "no_limit_config"`
- **注意**: 这可能导致该路由被打穿！

---

### 4. 已禁用的路由
**场景**: 请求已被禁用的路由

**测试命令**:
```bash
# 先禁用一个已存在的路由
# 假设路由 ID 为 1
curl -X PUT "http://localhost:3000/api/config/routes/1" \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": false
  }'

# 请求已禁用的路由
curl -X POST "http://localhost:3000/api/rate-limit/check" \
  -H "Content-Type: application/json" \
  -d '{
    "appKey": "ak_test_001",
    "path": "/api/users",
    "method": "GET"
  }'
```

**预期行为**:
- 路由禁用后，该路由的限流配置也不会生效
- 实际行为取决于业务逻辑：应该拒绝还是放行？

---

## 三、限流配置问题

### 5. 极限配额配置
**场景**: 配置极端的限流值

**测试命令**:
```bash
# 配置 0 配额 (应该拒绝所有请求)
curl -X POST "http://localhost:3000/api/config/rate-limit-configs" \
  -H "Content-Type: application/json" \
  -d '{
    "appKey": "ak_test_002",
    "path": "/api/orders",
    "method": "GET",
    "algorithm": "fixed-window",
    "limit": 0,
    "windowSeconds": 60,
    "isActive": true
  }'

# 配置超大配额 (可能导致内存问题)
curl -X POST "http://localhost:3000/api/config/rate-limit-configs" \
  -H "Content-Type: application/json" \
  -d '{
    "appKey": "ak_test_002",
    "path": "/api/orders",
    "method": "POST",
    "algorithm": "fixed-window",
    "limit": 999999999,
    "windowSeconds": 1,
    "isActive": true
  }'

# 配置 0 窗口大小 (无效配置)
curl -X POST "http://localhost:3000/api/config/rate-limit-configs" \
  -H "Content-Type: application/json" \
  -d '{
    "appKey": "ak_test_002",
    "path": "/api/payments",
    "method": "POST",
    "algorithm": "fixed-window",
    "limit": 100,
    "windowSeconds": 0,
    "isActive": true
  }'
```

---

### 6. 已禁用的限流配置
**场景**: 限流配置被禁用但 App Key 和路由仍在使用

**测试命令**:
```bash
# 假设限流配置 ID 为 1
curl -X PUT "http://localhost:3000/api/config/rate-limit-configs/1" \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": false
  }'

# 请求该配置对应的路由
curl -X POST "http://localhost:3000/api/rate-limit/check" \
  -H "Content-Type: application/json" \
  -d '{
    "appKey": "ak_test_001",
    "path": "/api/users",
    "method": "GET"
  }'
```

**预期行为**:
- 应该返回 `allowed: true` 和 `reason: "no_limit_config"`
- **风险**: 配置禁用后该路由将不受限流保护！

---

## 四、算法边界问题

### 7. 固定窗口 vs 滑动窗口 - 边界时刻对比
**场景**: 在窗口切换时刻发送请求，观察两种算法的行为差异

**测试场景描述**:
假设窗口大小为 10 秒，配额为 5 个请求。

在以下时间点发送请求:
- T=9秒 (窗口即将结束): 发送 3 个请求
- T=10秒 (新窗口开始): 发送 3 个请求
- T=11秒: 发送 3 个请求

**两种算法的预期行为**:
| 时间 | 固定窗口计数 | 滑动窗口计数 | 固定窗口行为 | 滑动窗口行为 |
|------|-------------|-------------|-------------|-------------|
| 9s第1个 | 1 | 1 | 放行 | 放行 |
| 9s第2个 | 2 | 2 | 放行 | 放行 |
| 9s第3个 | 3 | 3 | 放行 | 放行 |
| 10s第1个 | 1 (新窗口) | 4 (含前10秒内的) | 放行 | 放行 |
| 10s第2个 | 2 | 5 | 放行 | 放行 |
| 10s第3个 | 3 | 6 (>5) | **放行** | **拒绝** ← 差异! |
| 11s第1个 | 4 | 6 | 放行 | 拒绝 |

**关键差异**:
- 固定窗口在 10s 时重置计数，可能导致边界时刻**突增流量**
- 滑动窗口持续跟踪过去 N 秒内的请求，更精确但计算成本更高

**测试命令**:
```bash
# 清空日志
curl -X DELETE "http://localhost:3000/api/rate-limit/logs?appKey=ak_test_002"

# 模拟时间线请求 - 固定窗口
# 窗口 10s，配额 5
# 构造跨越边界的时间戳
BASE_TIME=1700000000000

curl -X POST "http://localhost:3000/api/rate-limit/simulate/timeline" \
  -H "Content-Type: application/json" \
  -d "{
    \"appKey\": \"ak_test_002\",
    \"path\": \"/api/users\",
    \"method\": \"GET\",
    \"timestamps\": [
      $((BASE_TIME + 9000)),
      $((BASE_TIME + 9100)),
      $((BASE_TIME + 9200)),
      $((BASE_TIME + 10000)),
      $((BASE_TIME + 10100)),
      $((BASE_TIME + 10200)),
      $((BASE_TIME + 11000))
    ]
  }"
```

---

## 五、并发与竞态条件

### 8. 超高并发场景
**场景**: 模拟超过系统处理能力的并发请求

**测试命令**:
```bash
# 使用并发模拟发送 10000 个请求
# 注意: 这可能会消耗大量资源
curl -X POST "http://localhost:3000/api/rate-limit/simulate/concurrent" \
  -H "Content-Type: application/json" \
  -d '{
    "appKey": "ak_prod_001",
    "path": "/api/users",
    "method": "GET",
    "requestCount": 10000
  }'
```

**预期检查点**:
1. 内存使用是否正常？
2. 数据库锁竞争情况？
3. 计数是否准确（没有超放）？

---

## 六、输入验证问题

### 9. 无效的请求参数
**场景**: 传入各种无效的参数值

**测试命令**:
```bash
# 缺少必需参数
curl -X POST "http://localhost:3000/api/rate-limit/check" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/api/users"
  }'

# 无效的 HTTP 方法
curl -X POST "http://localhost:3000/api/rate-limit/check" \
  -H "Content-Type: application/json" \
  -d '{
    "appKey": "ak_test_001",
    "path": "/api/users",
    "method": "INVALID_METHOD"
  }'

# 无效的时间戳 (负数)
curl -X POST "http://localhost:3000/api/rate-limit/check" \
  -H "Content-Type: application/json" \
  -d '{
    "appKey": "ak_test_001",
    "path": "/api/users",
    "method": "GET",
    "timestamp": -1
  }'

# 非常大的时间戳 (未来)
curl -X POST "http://localhost:3000/api/rate-limit/check" \
  -H "Content-Type: application/json" \
  -d '{
    "appKey": "ak_test_001",
    "path": "/api/users",
    "method": "GET",
    "timestamp": 9999999999999
  }'
```

---

## 七、数据完整性测试

### 10. 删除约束测试
**场景**: 尝试删除有依赖关系的数据

**测试命令**:
```bash
# 尝试删除有配置的 App Key
# 应该失败并提示先删除配置
curl -X DELETE "http://localhost:3000/api/config/app-keys/1"

# 尝试删除有配置的路由
curl -X DELETE "http://localhost:3000/api/config/routes/1"

# 正确顺序: 先删配置，再删 App Key/路由
# 1. 删除配置
curl -X DELETE "http://localhost:3000/api/config/rate-limit-configs/1"

# 2. 再删除 App Key
curl -X DELETE "http://localhost:3000/api/config/app-keys/1"
```

---

## 八、性能边界测试

### 11. 大量日志数据
**场景**: 系统中存在大量请求日志时的性能

**测试关注点**:
- 统计查询 (`/api/rate-limit/stats`) 的响应时间
- 报告生成 (`/api/rate-limit/report`) 的内存使用
- 数据库查询优化是否生效

**测试建议**:
```bash
# 生成大量日志数据
for i in {1..1000}; do
  curl -s -X POST "http://localhost:3000/api/rate-limit/check" \
    -H "Content-Type: application/json" \
    -d '{
      "appKey": "ak_test_001",
      "path": "/api/users",
      "method": "GET"
    }' > /dev/null
done

# 测试统计查询性能
time curl -s "http://localhost:3000/api/rate-limit/stats"
```

---

## 测试总结

### 常见风险点检查清单

| 风险类别 | 检查项 | 预期行为 |
|---------|-------|---------|
| 认证 | 无效 App Key | 拒绝请求 |
| 认证 | 已禁用 App Key | 拒绝请求 |
| 配置 | 未配置限流的路由 | **注意: 当前实现是放行!** |
| 配置 | 已禁用的限流配置 | **注意: 配置被忽略，可能放行!** |
| 算法 | 固定窗口边界 | 可能突增流量 |
| 算法 | 滑动窗口边界 | 更精确但资源消耗大 |
| 并发 | 超高并发 | 计数准确性、性能 |
| 数据 | 删除依赖数据 | 应有外键约束检查 |

### 配置建议

1. **生产环境推荐**:
   - 使用滑动窗口算法（更精确）
   - 配置合理的监控告警
   - 定期检查未配置限流的路由

2. **关键接口保护**:
   - 支付、登录等关键接口必须配置限流
   - 使用较低的配额和较短的窗口
   - 考虑多层限流（IP + App Key）

3. **监控指标**:
   - 监控 `rejectedRate` 突增
   - 监控 `fixed_window` vs `sliding_window` 的放行差异
   - 监控数据库性能（大量请求日志时）
