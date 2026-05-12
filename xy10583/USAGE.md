# 用车调度费用API - 使用说明

## 一、快速开始

### 1. 安装依赖

```bash
cd /Users/mac/pro/solo/workspaces/xy10583
npm install
```

### 2. 初始化数据（创建司机和部门）

```bash
node scripts/seed-data.js
```

### 3. 启动服务

```bash
node server.js
```

服务将在 `http://localhost:3001` 启动

### 4. 验证服务

```bash
curl http://localhost:3001/api/health
```

## 二、内置演示脚本

### 主演示（完整流程）

```bash
bash scripts/demo.sh
```

展示：创建申请 → 派单 → 司机到达 → 开始行程 → 结束行程 → 结算 → 报告导出

### 完整样例演示（5个业务场景）

```bash
bash scripts/demo-full.sh
```

覆盖5个核心业务场景：
1. **正常行程**：无异常的完整流程
2. **员工取消**：派单后取消，产生30元取消费
3. **等待收费**：员工迟到45分钟，产生60元等待费
4. **跨城审批**：120公里行程需要审批，审批后才能派单
5. **结算幂等**：重复调用结算接口，不会产生重复记录

### 失败场景演示

```bash
bash scripts/demo-failure.sh
```

展示异常处理：
1. 跨城行程未审批就派单（失败）
2. 查询不存在的行程（404错误）
3. 重复结算（使用不同idempotencyKey时失败）
4. 部门预算不足检查

## 三、API接口列表

### 健康检查
- `GET /api/health` - 检查服务状态和费率配置

### 行程管理
- `POST /api/trips` - 创建用车申请（支持X-Idempotency-Key幂等）
- `GET /api/trips` - 查询所有行程（支持按状态、部门、司机筛选）
- `GET /api/trips/:tripId` - 查询行程详情（含历史记录和修正记录）
- `POST /api/trips/:tripId/dispatch` - 派单给司机
- `POST /api/trips/:tripId/driver-arrive` - 司机到达上车点
- `POST /api/trips/:tripId/start` - 开始行程
- `POST /api/trips/:tripId/end` - 结束行程并计算费用
- `POST /api/trips/:tripId/cancel` - 取消行程
- `POST /api/trips/:tripId/approve-intercity` - 跨城审批
- `POST /api/trips/:tripId/correct` - 人工修正费用
- `POST /api/trips/:tripId/allocate` - 部门分摊

### 结算管理
- `POST /api/settlements` - 结算行程（必须提供idempotencyKey）

### 预算管理
- `GET /api/departments/:code/budget` - 检查部门预算

### 报告导出
- `GET /api/reports/full` - 完整运营报告
- `GET /api/reports/department/:code` - 部门账单
- `GET /api/reports/driver/:driverId` - 司机收入报告

### 数据管理
- `POST /api/reset` - 重置所有数据（测试用）

## 四、业务规则

### 费用计算规则

**基础车费**：
- 起步价：50元
- 里程费：3元/公里
- 公式：50 + (距离 × 3)

**等待费**：
- 免费等待：15分钟
- 收费标准：2元/分钟
- 公式：max(0, 等待时间 - 15) × 2

**取消费**：
- 派单前取消：0元
- 派单后取消：30元
- 司机到达后取消：80元

**跨城费用**：
- 审批阈值：100公里以上需要审批
- 高速加价：(1.5-1) × 3 × 距离 = 1.5 × 距离
- 住宿补贴：200元
- 跨城审批拒绝的行程无法派单

**司机分成**：
- 司机获得总费用的70%
- 公司获得30%

### 幂等性规则

1. 创建行程时可通过 `X-Idempotency-Key` 请求头实现幂等
2. 结算时必须通过 `idempotencyKey` 请求体参数实现幂等
3. 相同的key多次调用，返回相同结果，不会产生副作用

### 人工修正规则

1. 人工修正必须提供操作者信息
2. 修正前的状态和修正后的状态都会保存
3. 所有改动都会记录在历史记录中
4. 可以修正：等待时间、行驶距离

## 五、演示路径说明

### 路径1：正常成功流程（主要演示路径）

```
1. 创建用车申请（销售部张明，国贸→中关村，25公里）
   ↓
2. 查询行程详情（状态：待派单）
   ↓
3. 派单给司机张三
   ↓
4. 司机到达上车点（开始计算等待时间）
   ↓
5. 开始行程（模拟等待20分钟，产生10元等待费）
   ↓
6. 结束行程（计算总费用：50+75+10=135元）
   ↓
7. 结算（测试幂等性：第一次成功，第二次返回相同结果）
   ↓
8. 导出完整报告
```

**预期输出**：
- 基础车费：125元（50起步 + 25×3）
- 等待费：10元（20-15=5分钟 × 2元）
- 总计：135元
- 司机收入：94.5元（135×70%）
- 公司收入：40.5元

### 路径2：失败流程演示

```
1. 创建跨城行程（北京→济南，150公里）
   ↓
2. 尝试直接派单（失败：跨城行程需要先审批）
   ↓
3. 查询不存在的行程（失败：404错误）
   ↓
4. 创建普通行程并完成结算
   ↓
5. 使用不同的idempotencyKey重复结算（失败：行程已结算）
```

**预期输出**：
- 所有错误都包含 `success: false` 标记
- 错误消息清晰说明失败原因
- 包含时间戳便于追踪

## 六、输出结果解读

### 行程费用构成示例

```json
{
  "fare": {
    "baseFare": 125,
    "waitingFee": 10,
    "intercityFee": 0,
    "total": 135,
    "breakdown": {
      "baseFare": {
        "amount": 125,
        "description": "基础车费（50元起步 + 25公里 × 3元/公里）"
      },
      "waitingFee": {
        "amount": 10,
        "description": "等待费（等待20分钟，免费15分钟，收费5分钟 × 2元/分钟）"
      },
      "intercityFee": {
        "amount": 0,
        "description": "非跨城行程，无跨城费用"
      }
    }
  }
}
```

### 部门账单示例

```json
{
  "department": "SALES",
  "departmentName": "销售部",
  "totalTrips": 3,
  "completedTrips": 2,
  "cancelledTrips": 1,
  "totalTripAmount": 665,
  "totalCancellationFees": 30,
  "totalSpent": 695,
  "budgetInfo": {
    "budget": 50000,
    "spent": 695,
    "remaining": 49305
  }
}
```

### 司机收入报告示例

```json
{
  "driverId": "DRV001",
  "totalTrips": 2,
  "totalIncome": 346.5,
  "settlements": [
    {
      "id": "xxx",
      "tripId": "yyy",
      "amount": 94.5,
      "createdAt": "2024-01-15T..."
    }
  ]
}
```

### 异常费用示例

在完整报告的 `anomalies` 字段中会列出：
- 等待费超过100元的行程
- 显示等待分钟数和费用
- 便于审计和跟进

## 七、数据文件位置

- 数据存储：`data/database.json`
- 包含：行程、司机、部门、结算记录、幂等请求、历史记录、修正记录
- 可直接查看JSON文件了解数据结构

## 八、关键特性验证清单

不看源码也能判断业务闭环：

- [ ] **状态流转**：待派单 → 已派单 → 司机已到达 → 行程中 → 已完成
- [ ] **等待费计算**：结束行程后fare.waitingFee有值，breakdown有详细说明
- [ ] **取消费**：取消行程后cancellationFee有值（派单后取消30元）
- [ ] **跨城审批**：100公里以上行程intercityApproval为待审批，审批后才能派单
- [ ] **幂等性**：使用相同idempotencyKey多次结算，返回isDuplicate: true
- [ ] **历史记录**：GET /api/trips/:id 的history数组包含所有操作
- [ ] **人工修正**：POST /correct 后corrections数组有前后差异
- [ ] **部门分摊**：POST /allocate 后departmentAllocations有分摊明细
- [ ] **司机收入**：GET /reports/driver/:id 显示总里程和总收入（70%）
- [ ] **部门预算**：GET /reports/department/:code 显示预算使用情况
- [ ] **异常检测**：GET /reports/full 的anomalies列表包含高额等待费行程

## 九、手动测试curl示例

```bash
# 1. 创建行程
curl -X POST http://localhost:3001/api/trips \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP001",
    "employeeName": "测试员工",
    "department": "SALES",
    "pickup": "地点A",
    "dropoff": "地点B",
    "distanceKm": 10,
    "scheduledTime": "2024-01-15T10:00:00Z"
  }'

# 2. 获取行程ID（从上一步返回的data.id）
TRIP_ID="从上面获取的ID"

# 3. 派单
curl -X POST http://localhost:3001/api/trips/$TRIP_ID/dispatch \
  -H "Content-Type: application/json" \
  -d '{"driverId": "DRV001", "driverName": "张三"}'

# 4. 司机到达
curl -X POST http://localhost:3001/api/trips/$TRIP_ID/driver-arrive

# 5. 开始行程
curl -X POST http://localhost:3001/api/trips/$TRIP_ID/start \
  -H "Content-Type: application/json" \
  -d '{"startTime": "2024-01-15T10:20:00Z"}'

# 6. 结束行程
curl -X POST http://localhost:3001/api/trips/$TRIP_ID/end \
  -H "Content-Type: application/json" \
  -d '{"endTime": "2024-01-15T10:45:00Z"}'

# 7. 结算
curl -X POST http://localhost:3001/api/settlements \
  -H "Content-Type: application/json" \
  -d "{\"tripId\": \"$TRIP_ID\", \"idempotencyKey\": \"unique-key-123\", \"operator\": \"财务\"}"

# 8. 查看完整报告
curl http://localhost:3001/api/reports/full
```
