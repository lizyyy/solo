# 检修备件最低库存 API

## 项目概述

这是一个工厂检修备件库存管理系统，围绕备件最低库存管理展开，解决维修班组在设备停机时才发现关键备件库存不足的痛点。

### 核心特性

- **最低库存计算**：基于设备关键性、消耗速度、采购周期动态计算最低库存
- **替代件管理**：支持替代件关系维护和兼容性限制
- **在途追踪**：采购在途数量计入有效库存
- **幂等处理**：重复执行或回调保持幂等，避免副作用
- **状态追踪**：每一步状态变化、历史记录、失败原因可查
- **人工修正**：所有人工修改记录前后差异和操作者
- **多维度报告**：备件风险、设备影响范围、采购建议

### 内置样例覆盖

1. ✅ 正常领用流程（库存充足）
2. ✅ 库存预警检测（低于最低库存）
3. ✅ 替代件建议（库存不足但有替代）
4. ✅ 采购在途查询
5. ✅ 重复领用回调幂等
6. ✅ 人工修正记录

---

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 本地启动

```bash
# 启动 API 服务
npm start

# 或开发模式（自动重载）
npm run dev
```

服务默认运行在 `http://localhost:3000`

---

## 造数说明

### 初始化样例数据

```bash
npm run seed
```

该命令会：
1. 清空旧数据库
2. 创建 6 个备件档案（轴承、液压泵、滤芯、电机、油封等）
3. 创建 4 台设备（2 台关键设备、1 台重要设备、1 台普通设备）
4. 建立设备-备件关联关系
5. 设置采购周期（7天~60天不等）
6. 建立替代件关系（普通轴承可替代精密轴承，但限制设备）
7. 创建 90 天历史消耗记录
8. 创建在途采购单
9. 自动计算最低库存

### 样例数据清单

| 备件编码 | 名称 | 当前库存 | 最低库存 | 采购周期 | 关联设备 |
|---------|------|---------|---------|---------|---------|
| BEAR-001 | 高速精密轴承 6205 | 5 | 动态计算 | 7天 | 关键设备+重要设备+普通设备 |
| BEAR-002 | 普通轴承 6205 | 10 | 动态计算 | 2天 | 可替代 BEAR-001 |
| HYD-001 | 主液压泵 A10VSO | 1 | 动态计算 | 45天 | 关键设备 |
| FILT-001 | 高压滤芯 HF35150 | 2 | 动态计算 | 14天 | 重要设备+关键设备 |
| MOTOR-001 | 主电机 45KW | **0** | 动态计算 | 60天 | 关键设备（在途2台） |
| SEAL-001 | 骨架油封 | 3 | 动态计算 | 10天 | 关键设备+普通设备 |

---

## 主要演示路径

### 方式一：运行脚本演示（推荐）

```bash
# 运行正常流程演示
npm run demo
```

该脚本会依次演示：

#### 场景 1：正常领用流程（库存充足）

**流程**：创建领用单 → 审批 → 出库检查 → 完成出库

**预期结果**：
- 状态流转：PENDING → APPROVING → PROCESSING → COMPLETED
- 库存扣减正确
- 历史记录包含每一步操作人、时间、原因

#### 场景 2：库存预警检测

**触发**：自动扫描所有备件库存

**预期结果**：
- MOTOR-001 当前库存为 0 → 产生 CRITICAL 级预警
- 影响设备：1号冲压生产线（关键设备）
- 在途数量：2台（30天后到货）

#### 场景 3：替代件建议（库存不足但有替代）

**流程**：领用 BEAR-001（库存不足）→ 系统检测到替代件 BEAR-002 → 选择替代件 → 完成出库

**关键点**：
- 只有 EQ-002、EQ-004 允许使用 BEAR-002 替代
- 关键设备 EQ-001 不允许使用替代件

#### 场景 4：采购在途查询

**预期结果**：
- MOTOR-001 在途数量：2台
- 预计到货时间：30天后
- 有效库存 = 当前库存(0) + 在途(2) = 2

#### 场景 5：重复领用回调幂等

**测试**：使用相同 idempotentKey 调用两次

**预期结果**：
- 第一次：创建新领用单
- 第二次：返回已存在的领用单（isDuplicate: true）
- 库存只扣减一次

#### 场景 6-8：三大报告

- **风险报告**：按紧急程度排序的备件风险清单
- **设备影响报告**：SEVERE/HIGH/MEDIUM/NONE 四级设备影响评估
- **采购建议报告**：URGENT/HIGH/NORMAL 三级采购建议

#### 场景 9：人工修正

**演示**：修正库存数量，记录前后差异

**预期结果**：
- 差异字段：currentStock (2→5), minStock (3→5)
- 记录操作者和原因

---

### 方式二：API 调用演示

先启动服务：
```bash
npm start
```

#### 1. 查询备件列表

```bash
curl http://localhost:3000/api/parts
```

#### 2. 创建领用单

```bash
curl -X POST http://localhost:3000/api/receptions \
  -H "Content-Type: application/json" \
  -d '{
    "partId": "<part_id>",
    "equipmentId": "<equipment_id>",
    "requestedQuantity": 2,
    "requester": "维修班-张工",
    "idempotentKey": "REC_20240115_001"
  }'
```

#### 3. 推进领用流程

```bash
# 审批
curl -X POST http://localhost:3000/api/receptions/<reception_id>/action/approve \
  -H "Content-Type: application/json" \
  -d '{"operator": "李班长"}'

# 出库检查
curl -X POST http://localhost:3000/api/receptions/<reception_id>/action/process \
  -H "Content-Type: application/json" \
  -d '{"operator": "仓库管理员"}'

# 完成出库
curl -X POST http://localhost:3000/api/receptions/<reception_id>/action/complete \
  -H "Content-Type: application/json" \
  -d '{"operator": "仓库管理员"}'
```

#### 4. 查询领用单状态和历史

```bash
curl http://localhost:3000/api/receptions/<reception_id>
curl http://localhost:3000/api/receptions/<reception_id>/history
```

#### 5. 查看三大报告

```bash
# 备件风险报告
curl http://localhost:3000/api/reports/risk

# 设备影响报告
curl http://localhost:3000/api/reports/equipment-impact

# 采购建议报告
curl http://localhost:3000/api/reports/purchase-suggestion

# 综合报告
curl http://localhost:3000/api/reports/full

# 导出文本报告（可下载）
curl http://localhost:3000/api/reports/export
```

#### 6. 库存预警检查

```bash
curl -X POST http://localhost:3000/api/reports/check-all
```

---

## 失败路径演示

### 运行失败脚本

```bash
npm run demo-failure
```

### 失败场景说明

#### 失败场景 1：状态流转异常

**操作**：跳过审批，直接执行出库

**预期失败**：
- 返回 success: false
- 原因：当前状态 PENDING 不可处理
- 状态保持不变，历史记录无异常操作

#### 失败场景 2：库存不足且无替代件

**操作**：领用 HYD-001（库存仅 1，申请 5，无替代件）

**预期失败**：
- 状态流转：PENDING → APPROVING → FAILED
- 历史记录详细说明：库存不足且无替代件
- 失败原因包含具体数值对比

#### 失败场景 3：替代件兼容性限制

**操作**：关键设备 EQ-001 领用 BEAR-001（库存不足）

**预期失败**：
- 虽然 BEAR-002 库存充足，但不允许在 EQ-001 使用
- 系统检测：无可用替代件
- 领用失败，需等待原备件到货

#### 失败场景 4：参数验证失败

**操作**：创建领用单时缺少必需字段

**预期失败**：
- partId 为空 → "备件ID和申请数量不能为空"
- partId 不存在 → "备件不存在: xxx"

#### 失败场景 5：重复状态操作

**操作**：对已完成的领用单再次执行审批

**预期失败**：
- 返回 success: false
- 原因：当前状态 COMPLETED 不可审批
- 不会产生重复副作用

---

## API 接口清单

### 备件管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/parts | 备件列表（含最低库存、在途、预警状态） |
| GET | /api/parts/:id | 备件详情（关联设备、替代件、消耗记录） |
| POST | /api/parts | 创建新备件 |
| POST | /api/parts/:id/calculate-min-stock | 重新计算最低库存 |

### 领用单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/receptions | 领用单列表（可按状态筛选） |
| GET | /api/receptions/:id | 领用单详情 |
| GET | /api/receptions/:id/history | 状态历史 |
| POST | /api/receptions | 创建领用单（支持幂等） |
| POST | /api/receptions/:id/action/approve | 审批 |
| POST | /api/receptions/:id/action/process | 出库检查 |
| POST | /api/receptions/:id/action/use-alternative | 使用替代件 |
| POST | /api/receptions/:id/action/complete | 完成出库 |
| POST | /api/receptions/:id/action/callback | 回调记录（幂等） |
| POST | /api/receptions/manual-correct | 人工修正 |

### 报告导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/reports/risk | 备件风险报告 |
| GET | /api/reports/equipment-impact | 设备影响报告 |
| GET | /api/reports/purchase-suggestion | 采购建议报告 |
| GET | /api/reports/full | 综合报告 |
| GET | /api/reports/alerts | 当前预警列表 |
| GET | /api/reports/export | 导出文本报告 |
| POST | /api/reports/check-all | 触发库存预警检查 |

---

## 核心业务规则

### 最低库存计算公式

```
最低库存 = 日均消耗量 × 采购周期 × 安全系数

其中：
- 日均消耗量 = 近90天消耗总量 / 90
- 采购周期 = 最大采购周期天数
- 安全系数 = 1.0 + (最高设备关键权重 - 1) × 0.2
  - 关键设备(CRITICAL): 权重=3 → 安全系数=1.4
  - 重要设备(IMPORTANT): 权重=2 → 安全系数=1.2
  - 普通设备(NORMAL): 权重=1 → 安全系数=1.0
```

### 库存预警等级

| 等级 | 触发条件 |
|------|---------|
| CRITICAL | 库存为 0 或 < 最低库存的 50% |
| WARNING | 库存 < 最低库存但 ≥ 50% |
| NORMAL | 库存 ≥ 最低库存 |

### 状态机流转

```
PENDING (创建)
    ↓
APPROVING (审批通过)
    ↓
PROCESSING (库存充足) ──┐
    ↓                    ├── COMPLETED (完成)
NEED_ALTERNATIVE ───────┘
    ↓ (无替代件)
FAILED (领用失败)
```

### 替代件兼容性

| 状态 | 说明 |
|------|------|
| COMPATIBLE | 完全兼容，所有设备可用 |
| LIMITED | 有限兼容，仅限指定设备 |
| INCOMPATIBLE | 不兼容，不可使用 |

---

## 报告解读指南

即使不看源码，也能通过报告判断业务闭环：

### 1. 看"风险报告"是否有闭环

```
风险汇总:
  预警总数: 2
  严重预警: 1        ← 关注：关键设备是否受影响
  紧急风险数: 1       ← 关注：是否需要立即处理

风险明细:
  [CRITICAL] MOTOR-001 - 主电机
    当前: 0, 最低: 1, 缺口: 1
    在途: 2, 有替代件: 否    ← 闭环点：在途数量能否覆盖缺口
    紧急: 是                  ← 闭环点：是否影响关键设备
```

**判断闭环**：
- ✅ 在途数量 ≥ 缺口 → 风险可接受
- ❌ 在途数量 < 缺口 → 需要紧急采购

### 2. 看"设备影响报告"是否有闭环

```
设备影响汇总:
  严重影响设备: 1     ← 关键设备是否受影响
  高度影响设备: 1
  中度影响设备: 0
  无影响设备: 2
```

**判断闭环**：
- ✅ 严重影响设备 = 0 → 生产安全
- ❌ 严重影响设备 > 0 → 需要优先处理

### 3. 看"采购建议报告"是否有闭环

```
采购建议汇总:
  建议采购项数: 3
  紧急采购: 1       ← 关注：是否对应关键设备缺口
  优先采购: 1
  常规采购: 1
  建议采购总量: 8
```

**判断闭环**：
- ✅ 建议采购数量 ≥ 缺口 → 采购建议合理
- ❌ 建议采购数量 < 缺口 → 建议不充分，需要调整

---

## 项目结构

```
.
├── data/                    # SQLite 数据库文件
├── src/
│   ├── app.js              # 应用入口
│   ├── config/
│   │   ├── db.js           # 数据库连接
│   │   └── schema.js       # 表结构定义
│   ├── models/             # 数据模型
│   │   ├── sparePart.js
│   │   ├── equipment.js
│   │   ├── consumption.js
│   │   ├── purchaseCycle.js
│   │   ├── alternativePart.js
│   │   ├── purchaseOrder.js
│   │   ├── minStock.js
│   │   ├── reception.js
│   │   ├── alert.js
│   │   └── manualCorrection.js
│   ├── services/           # 业务逻辑
│   │   ├── stockCalculator.js   # 最低库存计算
│   │   ├── alertService.js      # 预警服务
│   │   ├── receptionService.js  # 领用全流程
│   │   └── reportService.js     # 报告生成
│   ├── routes/             # API 路由
│   │   ├── parts.js
│   │   ├── receptions.js
│   │   └── reports.js
│   ├── scripts/            # 演示脚本
│   │   ├── seed.js         # 造数脚本
│   │   ├── demo.js         # 正常流程演示
│   │   └── demo-failure.js # 失败路径演示
│   └── utils/
│       ├── constants.js    # 常量定义
│       └── response.js     # 响应封装
├── package.json
└── README.md
```

---

## 关键设计决策

### 1. 为什么用 SQLite？

- 零依赖，无需安装数据库
- 本地演示开箱即用
- 数据持久化在文件，可随时查看

### 2. 为什么用 Better-SQLite3？

- 同步 API，代码更简洁
- 事务支持完善
- 性能满足演示需求

### 3. 幂等如何实现？

- 创建时：检查 `idempotent_key`，存在则返回已有记录
- 回调时：记录 `callback_count`，重复回调只增加计数

### 4. 人工修正如何记录？

- 记录 `before_value` 和 `after_value`（JSON 序列化）
- 自动计算 `diff`（只有变化的字段）
- 强制记录 `operator`（操作者）

---

## 验证清单

运行以下命令验证功能完整性：

```bash
# 1. 安装依赖
npm install

# 2. 运行正常流程演示
npm run demo

# 3. 运行失败路径演示
npm run demo-failure

# 4. 启动服务
npm start

# 5. 浏览器查看健康检查
# http://localhost:3000/

# 6. 查看综合报告
# http://localhost:3000/api/reports/full

# 7. 导出文本报告
# http://localhost:3000/api/reports/export
```

---

## 后续扩展方向

1. **采购模块**：从采购建议自动生成采购申请单
2. **通知模块**：预警自动推送到钉钉/企业微信
3. **预测模型**：基于时间序列预测消耗量
4. **多仓库**：支持多仓库库存管理
5. **权限控制**：基于角色的操作权限
