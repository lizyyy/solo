# API响应压缩策略系统 - 边界、失败路径和重复执行路径说明

## 一、主要边界

### 1. 客户端能力边界
- **上边界**：同时支持 gzip、deflate、br 三种压缩算法的客户端（如 android_2.5.0）
- **下边界**：不支持任何压缩算法的客户端（如 ios_1.0.0、android_1.5.0）
- **中间边界**：部分支持的客户端（如 ios_2.0.0 支持 gzip 和 deflate 但不支持 br）
- **边界处理**：
  - 旧客户端（不支持任何压缩）会被"旧客户端跳过"规则直接跳过，不进行压缩
  - 新客户端根据支持的压缩算法选择最优压缩方式
  - 客户端ID不存在时抛出错误

### 2. 响应大小阈值边界
- **阈值配置**：默认 minResponseSize = 1024 字节
- **边界值 1023**：小于阈值，触发"小响应跳过"规则，不压缩
- **边界值 1024**：等于阈值，不触发小响应跳过规则
- **边界值 1025**：大于阈值，继续评估后续规则
- **超大响应**：maxResponseSize = 10MB，超过则不压缩（当前策略未强制检查，需在规则中显式添加）
- **零字节响应**：被小响应规则跳过

### 3. 内容类型边界
- **可压缩类型**：application/json、text/* 等文本类型
- **不可压缩类型**：image/*、video/*、audio/*、application/gzip、application/zip 等
- **边界处理**：
  - 精确匹配：application/json 完全匹配
  - 前缀匹配：image/ 匹配所有图片类型
  - 未在规则中的内容类型：如果没有命中任何规则，默认跳过

### 4. 策略灰度边界
- **灰度关闭**：所有请求都经过策略评估
- **灰度开启 - 按版本**：只对指定的客户端版本生效
- **灰度开启 - 按百分比**：根据客户端ID哈希值决定是否生效
- **时间边界**：
  - startTime 之前：不生效
  - startTime ~ endTime 之间：生效
  - endTime 之后：不生效
- **灰度外请求**：直接跳过，记录"不在灰度范围内"

### 5. 规则优先级边界
- **优先级 1（最高）**：旧客户端跳过 - 兼容性保护
- **优先级 2**：小响应跳过 - 性能优化
- **优先级 3**：图片/已压缩内容跳过 - 效率保护
- **优先级 4（最低）**：大JSON压缩 - 主要压缩逻辑
- **边界规则**：高优先级规则命中后立即返回，不再评估低优先级规则

## 二、一个失败路径

### 路径描述：灰度策略配置错误导致新客户端全部被跳过

#### 触发场景
1. 管理员配置灰度策略时，将 `percentage` 设置为 0
2. 或者错误地将 `startTime` 设置为未来时间
3. 或者错误地将 `clientVersions` 留空

#### 执行路径
```
1. 新客户端 ios_2.0.0 发起 /api/complaints/list 请求，响应大小 50000 字节
2. 系统匹配到"默认抱怨列表压缩策略"
3. 检查灰度策略：
   - 情况A：percentage = 0 → 不在灰度范围内
   - 情况B：startTime = 2030-01-01 → 不在灰度范围内
   - 情况C：clientVersions = [] 且 type = "version" → 不在灰度范围内
4. 决策：skip
5. 原因：不在灰度范围内
6. 结果：原本应该压缩的请求没有被压缩，流量无法节省
```

#### 影响
- 所有新客户端请求都不会被压缩
- 无法获得预期的流量节省效果
- 查询统计显示 `inGray: false`，但可能被误认为是策略问题

#### 排查方法
1. 查看策略详情：`GET /api/compression/strategies/:id`
2. 检查 `grayStrategy` 配置：
   - `percentage` 是否大于 0
   - `startTime` 是否在当前时间之前
   - `type` 为 "version" 时 `clientVersions` 是否包含目标客户端
3. 查看历史记录：`GET /api/compression/history`
4. 检查记录中的 `inGray` 字段是否为 false

#### 修复方法
- 更新策略：`PUT /api/compression/strategies/:id`
- 将 `percentage` 改为 100
- 或将 `startTime` 改为过去的时间
- 或在 `clientVersions` 中添加目标客户端版本

## 三、一次重复执行路径

### 路径描述：策略修改 → 验证 → 出现问题 → 回滚 → 再次修改 → 验证

#### 场景
1. 初始状态：策略版本 1，minResponseSize = 1024
2. 管理员尝试优化策略，将 minResponseSize 改为 2048（版本 2）
3. 发现 1500-2048 字节的响应没有被压缩，节省流量减少
4. 决定回滚到上一版本（版本 3 = 版本 1 的内容）
5. 重新评估后，决定尝试更保守的调整，改为 1500（版本 4）

#### 详细执行路径

**阶段 1：初始状态**
```
策略版本：1
minResponseSize: 1024
previousVersions: []

请求：ios_2.0.0, /api/complaints/list, 1500字节, JSON
结果：compress（1500 >= 1024，命中大JSON压缩规则）
节省：1125字节（75%）
```

**阶段 2：修改策略**
```bash
# 修改策略，将 minResponseSize 改为 2048
PUT /api/compression/strategies/:id
{
  "name": "修改后的压缩策略",
  "minResponseSize": 2048
}
```
```
策略版本：2
minResponseSize: 2048
previousVersions: [版本1的快照]

请求：ios_2.0.0, /api/complaints/list, 1500字节, JSON
评估路径：
1. 规则1（旧客户端跳过）：不匹配
2. 规则2（小响应跳过）：1500 < 2048 → 匹配！
结果：skip
原因：响应大小小于阈值，压缩收益不明显
节省：0字节
```

**阶段 3：发现问题并回滚**
```bash
# 查询统计，发现压缩请求减少
GET /api/compression/query
# 查看 hitRules，发现"小响应跳过"命中数增加

# 执行回滚
POST /api/compression/rollback/:id
```
```
策略版本：3
minResponseSize: 1024（从 previousVersions 恢复）
previousVersions: []（弹出了版本1）

请求：ios_2.0.0, /api/complaints/list, 1500字节, JSON
结果：compress（立即使用回滚后的策略）
节省：1125字节（75%）
```

**阶段 4：再次修改策略（更保守的调整）**
```bash
# 这次改为 1500，只跳过真正的小响应
PUT /api/compression/strategies/:id
{
  "name": "优化后的压缩策略",
  "minResponseSize": 1500
}
```
```
策略版本：4
minResponseSize: 1500
previousVersions: [版本3的快照]

请求：ios_2.0.0, /api/complaints/list, 1499字节, JSON → skip
请求：ios_2.0.0, /api/complaints/list, 1500字节, JSON → compress
请求：ios_2.0.0, /api/complaints/list, 1501字节, JSON → compress
```

#### 关键点
1. **回滚是即时生效的**：回滚后新请求立即使用旧策略，无需等待
2. **版本号持续递增**：即使回滚，版本号也会增加（1→2→3→4），便于追踪
3. **历史记录完整**：每次请求的决策都被记录，可以事后分析
4. **previousVersions 是栈结构**：每次回滚弹出最后一个版本
5. **重复修改是安全的**：每次修改都会保存当前状态到 previousVersions

## 四、API接口清单

### 策略管理
- `GET /api/compression/strategies` - 获取所有策略
- `GET /api/compression/strategies/:id` - 获取单个策略
- `POST /api/compression/strategies` - 创建策略
- `PUT /api/compression/strategies/:id` - 更新策略
- `DELETE /api/compression/strategies/:id` - 删除策略
- `POST /api/compression/rollback/:id` - 回滚策略到上一版本

### 客户端管理
- `GET /api/compression/clients` - 获取所有客户端配置
- `POST /api/compression/clients` - 创建客户端配置

### 模拟请求
- `POST /api/compression/simulate` - 模拟请求，返回压缩决策

### 查询和历史
- `GET /api/compression/query` - 查询统计信息
- `GET /api/compression/history` - 获取所有历史记录
- `GET /api/compression/history/:id` - 获取单个历史记录

## 五、查询接口输出说明

### 输出字段
```json
{
  "totalRequests": 6,
  "compressedRequests": 3,
  "skippedRequests": 3,
  "totalSavingsBytes": 121125,
  "averageSavingsRatio": "78.33",
  "hitRules": {
    "大JSON压缩": { "count": 3, "compressed": 3, "skipped": 0 },
    "旧客户端跳过": { "count": 1, "compressed": 0, "skipped": 1 },
    "小响应跳过": { "count": 1, "compressed": 0, "skipped": 1 },
    "图片或已压缩内容跳过": { "count": 1, "compressed": 0, "skipped": 1 }
  },
  "clientVersionStats": {
    "ios_2.0.0": {
      "totalRequests": 3,
      "compressedRequests": 2,
      "skippedRequests": 1,
      "totalSavingsBytes": 41125,
      "averageSavingsRatio": "77.50",
      "isOldClient": false,
      "isOldClientSkipped": 0
    },
    "ios_1.0.0": {
      "totalRequests": 1,
      "compressedRequests": 0,
      "skippedRequests": 1,
      "totalSavingsBytes": 0,
      "averageSavingsRatio": 0,
      "isOldClient": true,
      "isOldClientSkipped": 1
    }
  },
  "compatibleRisk": {
    "hasRisk": false,
    "riskDetails": [],
    "oldClientSkipped": 1,
    "oldClientSkippedRatio": "16.67"
  }
}
```

### 关键字段说明
- **hitRules**：按规则统计命中次数，帮助了解各规则的影响
- **clientVersionStats**：按客户端版本统计，便于评估不同版本的收益和风险
- **compatibleRisk**：
  - `hasRisk`：当旧客户端跳过比例超过20%时为true
  - `oldClientSkipped`：旧客户端被跳过的请求数（不算失败，是预期行为）
  - `oldClientSkippedRatio`：旧客户端跳过比例，用于监控灰度策略
