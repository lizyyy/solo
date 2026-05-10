# 粮食烘干批次结算服务

面向粮食烘干场景的批次结算系统，按 **水分、重量、能耗** 三项核心指标结算，专门处理 **批次数据补录** 场景。

---

## 项目结构

```
grain-drying-settlement/
├── bin/
│   └── cli.js                    # 命令行入口
├── src/
│   ├── models/
│   │   └── Batch.js              # 批次数据模型 + 状态机
│   ├── services/
│   │   ├── BatchService.js       # 批次管理（创建/补录/冲突）
│   │   ├── ReviewService.js      # 审核流程（提交/通过/拒绝/撤销）
│   │   ├── SettlementService.js  # 结算逻辑（水分换算+能耗分摊）
│   │   ├── ExportService.js      # 异常导出
│   │   └── SeedService.js        # 测试数据生成
│   ├── utils/
│   │   ├── dataStore.js          # 本地 JSON 数据存储
│   │   ├── moistureCalculator.js # 水分换算算法
│   │   └── energyAllocator.js    # 能耗分摊算法
│   └── index.js                  # 模块导出入口
├── tests/
│   └── run-tests.js              # 自动化测试
├── data/                         # 运行时数据（自动创建）
│   ├── batches.json
│   ├── reviews.json
│   ├── settlements.json
│   ├── anomalies.json
│   ├── conflicts.json
│   └── config.json
└── package.json
```

---

## 业务主干

### 1. 烘干批次 (Batch)

**状态流转：**
```
created (创建) → data_complete (补录完成) → pending_review (待审核)
    ↓
reviewing (审核中) ─→ approved (审核通过) ─→ settled (已结算)
    ↓                    ↓
review_rejected (拒绝)   rollback (撤销)
```

**核心数据：**
- 入仓：重量(kg)、水分(%)、温度(℃)
- 出仓：重量(kg)、水分(%)、温度(℃)、时间
- 烘干：时长(分钟)、燃料用量、用电量(度)

### 2. 水分换算 (Moisture Calculator)

**算法说明：**

1. **水分去除量** = 初始水量 - 最终水量
   - 初始水量 = 入仓重量 × 入仓水分%
   - 最终水量 = 出仓重量 × 出仓水分%

2. **理论出仓重量**（用于检测重量异常）：
   - 干物质 = 入仓重量 × (1 - 入仓水分%)
   - 理论出仓 = 干物质 ÷ (1 - 出仓水分%)

3. **异常判定**：
   - 出仓水分 ≥ 入仓水分 → 无效
   - 实际重量 vs 理论重量 偏差 > 20% → 记录异常

### 3. 能耗分摊 (Energy Allocator)

**结算公式：**

```
结算金额 = 基础金额 + 水分降幅奖励 - 能耗成本

其中：
- 基础金额 = 出仓重量 × 基础单价(0.15元/kg)
- 水分降幅奖励 = 水分降幅% × 奖励系数(0.02)
- 能耗成本 = 直接成本 + 分摊成本
  - 直接成本 = 燃料费 + 电费
  - 分摊成本 = 按烘干时长和出仓权重联合分摊
```

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据目录

```bash
node bin/cli.js init
```

### 3. 一键演示完整流程

```bash
node bin/cli.js flow:demo
```

---

## 命令说明

### 批次管理

| 命令 | 说明 |
|------|------|
| `batch:list [-s status]` | 列出所有批次（可选按状态筛选） |
| `batch:create -n <编号> -t <粮种> -w <重量> -m <水分>` | 创建新批次 |
| `batch:update --batch-no <编号> [--out-weight ...]` | 补录数据 |
| `batch:detail -n <编号>` | 查看批次详情 |
| `batch:delete -n <编号> [-f]` | 删除批次 |

### 审核流程

| 命令 | 说明 |
|------|------|
| `review:submit -n <批次号> [--retry]` | 提交审核（可重试超时） |
| `review:list [-s status]` | 查看审核列表 |
| `review:approve -i <审核ID> [-c merge/reject]` | 通过审核（冲突处理模式） |
| `review:reject -i <审核ID> [-r 原因]` | 拒绝审核 |
| `review:cancel -i <审核ID>` | 撤销审核 |

### 结算流程

| 命令 | 说明 |
|------|------|
| `settlement:run -n <批次号> [--retry]` | 执行结算（可重试超时） |
| `settlement:list [-s status]` | 查看结算单 |
| `settlement:rollback -n <批次号>` | 撤销结算 |

### 数据生成与异常

| 命令 | 说明 |
|------|------|
| `seed [-n 数量]` | 生成测试批次 |
| `export:anomalies [-o 路径] [-t 类型]` | 导出异常数据 |
| `simulate:conflict -n <批次号>` | 模拟数据冲突 |
| `simulate:timeout -a review/settlement` | 模拟超时场景 |

---

## 标准操作流程

### 步骤 1：创建批次

粮食入仓时创建批次：

```bash
node bin/cli.js batch:create \
  -n "BATCH-20260510-001" \
  -t "玉米" \
  -w 10000 \
  -m 28.5 \
  --in-temp 22
```

### 步骤 2：补录烘干数据

烘干完成后补录出仓和能耗数据：

```bash
node bin/cli.js batch:update \
  --batch-no "BATCH-20260510-001" \
  --out-weight 8500 \
  --out-moisture 14.5 \
  --out-temp 35 \
  --drying-time 480 \
  --fuel-used 500 \
  --power-used 320
```

**状态自动变更：** `created` → `data_complete`

### 步骤 3：提交审核

```bash
node bin/cli.js review:submit -n "BATCH-20260510-001"
```

记下返回的 **审核ID**，下一步会用到。

### 步骤 4：审核通过

```bash
node bin/cli.js review:approve -i "<审核ID>" -c merge
```

冲突处理模式 `-c`：
- `merge`：自动采用最新数据（默认）
- `reject`：检测到冲突时拒绝

### 步骤 5：执行结算

```bash
node bin/cli.js settlement:run -n "BATCH-20260510-001"
```

输出包含：
- 水分去除量(kg)
- 烘干量(kg)
- 能耗分摊(元)
- 最终结算金额(元)

---

## 异常与边界场景

### 场景 1：补录数据冲突

**问题：** 两人同时编辑同一批次，提交审核后数据被修改。

**处理：**

```bash
# 1. 模拟冲突（在审核期间修改批次数据）
node bin/cli.js simulate:conflict -n "BATCH-20260510-001"

# 2. 审核时选择策略
#    - 合并模式：接受新值
node bin/cli.js review:approve -i "<审核ID>" -c merge

#    - 拒绝模式：发现冲突时报错
node bin/cli.js review:approve -i "<审核ID>" -c reject
```

**内部机制：** 审核时会对批次数据做快照，通过时对比当前值，差异超过阈值触发冲突。

### 场景 2：撤销审核

审核提交后发现数据有误，需要撤回：

```bash
# 1. 提交审核
node bin/cli.js review:submit -n "BATCH-20260510-001"

# 2. 撤销审核（状态回到 data_complete）
node bin/cli.js review:cancel -i "<审核ID>"

# 3. 修改数据后重新提交
node bin/cli.js batch:update --batch-no "BATCH-20260510-001" --out-weight 8600
node bin/cli.js review:submit -n "BATCH-20260510-001"
```

### 场景 3：审核拒绝后补录

审核不通过，原因是数据有误：

```bash
# 1. 拒绝审核
node bin/cli.js review:reject -i "<审核ID>" -r "出仓重量与水分不匹配"

# 2. 批次状态变为 review_rejected
node bin/cli.js batch:detail -n "BATCH-20260510-001"

# 3. 修改数据
node bin/cli.js batch:update --batch-no "BATCH-20260510-001" --out-weight 8450

# 4. 重新提交审核
node bin/cli.js review:submit -n "BATCH-20260510-001"
```

### 场景 4：撤销结算

结算后发现问题，需要回退：

```bash
# 1. 查看当前结算
node bin/cli.js settlement:list

# 2. 撤销结算（状态回到 approved）
node bin/cli.js settlement:rollback -n "BATCH-20260510-001"

# 3. 如需修改数据，先撤销审核
# node bin/cli.js batch:detail -n "BATCH-20260510-001"
# 查看最新审核ID后执行撤销...
```

### 场景 5：超时重试

网络或系统超时，使用 `--retry` 启用重试机制：

```bash
# 提交审核时启用重试
node bin/cli.js review:submit -n "BATCH-20260510-001" --retry

# 结算时启用重试
node bin/cli.js settlement:run -n "BATCH-20260510-001" --retry
```

**重试策略：**
- 最大重试次数：3次
- 退避间隔：1秒递增
- 超时阈值：5秒

### 场景 6：异常检测与导出

系统自动检测的数据异常：

```bash
# 1. 查看异常统计
# （异常会在补录和结算时自动记录）

# 2. 导出所有异常
node bin/cli.js export:anomalies

# 3. 按类型导出
node bin/cli.js export:anomalies -t weight
node bin/cli.js export:anomalies -t energy_missing
node bin/cli.js export:anomalies -t time_mismatch
```

**异常类型：**
- `weight`：重量偏差超过理论值
- `energy_missing`：有烘干时间但无能耗记录
- `time_mismatch`：有能耗数据但无烘干时间
- `high_power`：单位时间用电量过高

---

## 测试数据生成

### 快速生成测试批次

```bash
# 生成5个批次（仅入仓数据）
node bin/cli.js seed

# 生成10个批次
node bin/cli.js seed -n 10
```

### 查看生成的数据

```bash
node bin/cli.js batch:list
```

---

## 配置说明

配置文件：`data/config.json`

```json
{
  "settlement": {
    "basePricePerKg": 0.15,
    "moistureReductionBonus": 0.02,
    "fuelCostPerUnit": 1.2,
    "powerCostPerKWh": 0.8,
    "energyShareRatio": 0.6
  },
  "validation": {
    "maxInMoisture": 35,
    "minOutMoisture": 10,
    "maxMoistureLoss": 20,
    "maxDryingTime": 1440,
    "weightLossTolerance": 0.2
  },
  "retry": {
    "maxAttempts": 3,
    "backoffMs": 1000,
    "timeoutMs": 5000
  }
}
```

---

## 运行测试

```bash
npm test
```

测试覆盖：
- 水分换算算法正确性
- 能耗分摊计算
- 批次创建和补录
- 审核提交流程
- 结算执行
- 异常场景（重复创建、状态约束等）
- 撤销和回滚

---

## 数据文件说明

| 文件 | 内容 |
|------|------|
| `batches.json` | 烘干批次数据（含版本历史） |
| `reviews.json` | 审核记录（含批次快照用于冲突检测） |
| `settlements.json` | 结算单（可回滚） |
| `anomalies.json` | 异常检测记录 |
| `conflicts.json` | 冲突记录 |
| `config.json` | 系统配置 |

---

## 扩展方向

1. **数据库适配**：将 `dataStore.js` 替换为 PostgreSQL/MongoDB
2. **REST API**：在 `services` 上封装 Express/Fastify 接口
3. **定时任务**：自动检测超时审核并触发告警
4. **报表生成**：按日/周/月汇总烘干效率和成本
5. **多粮种配置**：不同粮食类型使用不同的结算参数

---

## 许可证

MIT License
