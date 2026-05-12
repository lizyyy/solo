# 冷库温控告警归档 CLI

一套实用的冷库温度告警归档工具，围绕温度告警与开门记录、设备维护、商品批次一起归档判断风险展开。

## 功能特点

- **多维度关联分析**: 温度告警 + 开门记录 + 设备维护 + 商品批次
- **智能规则引擎**: 自动区分维护窗口波动、开门升温、真正超温
- **完整可追溯**: 每一步操作都有状态变化、历史记录和失败原因
- **幂等性保证**: 重复执行或重复回调保持结果一致
- **人工修正留痕**: 人工操作记录前后差异和操作者
- **完整样例**: 内置4种典型场景样例数据

## 快速开始

### 1. 本地启动

```bash
# 安装依赖
npm install

# 链接命令（可选，也可直接用 node bin/cold-chain.js）
chmod +x bin/cold-chain.js
```

### 2. 初始化工作目录

```bash
node bin/cold-chain.js init
```

这会在当前目录创建 `.cold-chain/` 工作目录。

### 3. 导入样例数据

```bash
node bin/cold-chain.js import --sample
```

样例数据包含:
- 4个商品批次（速冻水饺、冰淇淋、冷冻海鲜、速冻蔬菜）
- 2条维护计划
- 3条开门记录
- 5条温度曲线（覆盖正常、开门、维护、超温、断点）
- 5个告警

### 4. 主要演示路径

#### 路径1: 完整告警评估流程

```bash
# 1. 检查所有告警
node bin/cold-chain.js check --all

# 2. 查看汇总报告
node bin/cold-chain.js report --type summary

# 3. 查看某个告警详情（如真正超温的告警）
node bin/cold-chain.js detail ALERT-REAL --history

# 4. 查看批次风险报告
node bin/cold-chain.js report --type batch

# 5. 查看风险明细
node bin/cold-chain.js report --type risk
```

#### 路径2: 单告警人工修正流程

```bash
# 1. 检查指定告警
node bin/cold-chain.js check --id ALERT-DOOR
# 会提示是否进行人工修正，选择是后可修改状态、严重程度、建议

# 2. 查看历史记录
node bin/cold-chain.js detail ALERT-DOOR --history
# 可以看到人工修正的前后差异和操作者
```

#### 路径3: 导出报告

```bash
# 导出JSON格式报告
node bin/cold-chain.js report --type summary --format json --output report.json

# 导出文本格式报告
node bin/cold-chain.js report --type risk --output risk-report.txt
```

### 5. 失败路径演示

#### 失败场景1: 重复导入幂等性保护

```bash
# 第一次导入
node bin/cold-chain.js import --sample  # 成功

# 第二次导入（不使用 --force）
node bin/cold-chain.js import --sample  # 会显示"已跳过"
```

#### 失败场景2: 重复评估幂等性保护

```bash
# 第一次评估
node bin/cold-chain.js check --id ALERT-REAL  # 正常评估

# 第二次评估（不使用 --force）
node bin/cold-chain.js check --id ALERT-REAL  # 显示"已跳过"

# 使用 --force 强制重新评估
node bin/cold-chain.js check --id ALERT-REAL --force  # 重新评估
```

#### 失败场景3: 无效告警ID

```bash
node bin/cold-chain.js detail NONEXISTENT
# 输出: 告警不存在: NONEXISTENT
```

#### 失败场景4: 未初始化先操作

```bash
# 先删除 .cold-chain 目录
rm -rf .cold-chain

# 尝试导入
node bin/cold-chain.js import --sample
# 输出: 工作目录未初始化。请先运行 "cold-chain init" 命令。
```

## 命令详解

### init - 初始化

```bash
node bin/cold-chain.js init [--force]
```

- 创建 `.cold-chain/` 工作目录
- 初始化数据子目录（temperature/door/maintenance/batch/alerts/assessments）
- 创建配置文件 config.json
- `--force`: 强制重新初始化

### import - 导入数据

```bash
# 导入内置样例
node bin/cold-chain.js import --sample

# 从文件导入
node bin/cold-chain.js import --type <type> --file <path>
```

支持的数据类型:
- `temperature` - 温度曲线
- `door` - 开门记录
- `maintenance` - 维护计划
- `batch` - 库存批次

自动检测:
- 重复传感器数据
- 数据断点（>30分钟缺口）

### check - 检查告警

```bash
# 检查指定告警
node bin/cold-chain.js check --id <alertId> [--force]

# 检查所有告警
node bin/cold-chain.js check --all [--force]
```

评估规则:
1. **维护窗口降级**: 维护期间的短时波动自动标记为低风险
2. **开门升温**: 开门期间的升温需确认关门后已恢复
3. **长时间超温**: 超过2小时的超温标记为高风险
4. **关联批次**: 自动匹配告警期间在库的商品批次

### detail - 查看详情

```bash
node bin/cold-chain.js detail <alertId> [--history]
```

展示内容:
- 告警基础信息
- 评估结果（状态、严重程度、建议）
- 受影响商品批次
- 温度曲线数据
- 缓解因素
- 历史操作记录（--history）

### report - 生成报告

```bash
node bin/cold-chain.js report --type <type> [--format json|text] [--output <path>]
```

报告类型:
- `summary` - 汇总报告（统计分布、待处理告警、高风险批次）
- `batch` - 批次风险报告（每个批次关联的告警）
- `risk` - 风险明细报告（按优先级排序的风险告警）

## 规则引擎说明

### 温度阈值

- 高温告警: > -10°C
- 低温告警: < -25°C

### 持续时间分类

- SHORT: <= 15分钟
- MEDIUM: 15-120分钟
- LONG: > 120分钟

### 风险判定

| 场景 | 持续时间 | 状态 | 建议 |
|------|----------|------|------|
| 正常波动 | - | LOW | 无违规 |
| 维护窗口 | SHORT | RESOLVED | 正常波动 |
| 开门期间 | SHORT | PENDING | 确认恢复 |
| 开门期间 | MEDIUM+ | MEDIUM | 需复检 |
| 无保护因素 | LONG | CRITICAL | 报损评估 |

### 关联批次逻辑

批次在告警期间满足以下条件即被关联:
- 同一仓库
- 入库时间 < 告警结束时间
- 出库时间 > 告警开始时间（或未出库）

## 目录结构

```
.
├── bin/
│   └── cold-chain.js          # CLI入口
├── src/
│   ├── commands/              # 命令实现
│   │   ├── init.js
│   │   ├── import.js
│   │   ├── check.js
│   │   ├── detail.js
│   │   └── report.js
│   ├── core/                  # 核心逻辑
│   │   ├── rules.js           # 规则引擎
│   │   └── assessor.js        # 评估器
│   ├── data/
│   │   └── samples.js         # 样例数据
│   └── utils/
│       ├── workspace.js       # 工作目录管理
│       └── dataStore.js       # 数据存储
├── package.json
└── README.md

.cold-chain/                    # 工作目录（运行时创建）
├── config.json
├── data/
│   ├── temperature/
│   ├── door/
│   ├── maintenance/
│   ├── batch/
│   ├── alerts/
│   └── assessments/
└── history/                    # 操作历史
```

## 数据格式

### 温度曲线

```json
{
  "id": "TEMP-001",
  "warehouseId": "WH-01",
  "sensorId": "SENSOR-01",
  "startTime": "2026-05-12T08:00:00Z",
  "endTime": "2026-05-12T10:00:00Z",
  "readings": [
    { "timestamp": "2026-05-12T08:00:00Z", "temperature": -18 },
    { "timestamp": "2026-05-12T08:05:00Z", "temperature": -18.5 }
  ]
}
```

### 开门记录

```json
{
  "id": "DOOR-001",
  "warehouseId": "WH-01",
  "doorId": "D01",
  "openTime": "2026-05-12T08:00:00Z",
  "closeTime": "2026-05-12T08:15:00Z",
  "operator": "张师傅",
  "reason": "货物出库"
}
```

### 维护计划

```json
{
  "id": "MAINT-001",
  "warehouseId": "WH-01",
  "description": "设备检修",
  "startTime": "2026-05-12T08:00:00Z",
  "endTime": "2026-05-12T09:00:00Z",
  "type": "PLANNED"
}
```

### 商品批次

```json
{
  "id": "BATCH-001",
  "productName": "速冻水饺",
  "quantity": 500,
  "unit": "kg",
  "warehouseId": "WH-01",
  "inTime": "2026-05-10T10:00:00Z",
  "outTime": null,
  "requiredTemperature": -18,
  "supplier": "供应商A"
}
```

### 告警

```json
{
  "id": "ALERT-001",
  "temperatureId": "TEMP-001",
  "warehouseId": "WH-01",
  "type": "TEMPERATURE",
  "triggeredAt": "2026-05-12T10:00:00Z",
  "originalMessage": "温度高于阈值",
  "status": "PENDING"
}
```

## 样例场景详解

### 1. ALERT-NORMAL - 正常波动

- **温度**: 轻微波动在 -19 ~ -17°C
- **结果**: 无违规，INFO级别
- **说明**: 正常范围内的波动，无需处理

### 2. ALERT-DOOR - 开门升温

- **温度**: 开门期间从 -18°C 升到 -8°C
- **关联**: 匹配 DOOR-001 开门记录（张师傅，货物出库）
- **结果**: 缓解因素存在，LOW级别
- **建议**: 确认关门后温度已恢复

### 3. ALERT-MAINT - 维护窗口

- **温度**: 维护期间升到 -5°C
- **关联**: 匹配 MAINT-001 维护计划
- **结果**: 维护窗口降级，RESOLVED
- **建议**: 维护期间正常波动

### 4. ALERT-REAL - 真正超温

- **温度**: 持续2小时在 -6°C 以上
- **关联**: 无维护、无开门记录
- **结果**: CRITICAL，HIGH级别
- **受影响批次**: BATCH-001(水饺), BATCH-002(冰淇淋)
- **建议**: 立即检查商品批次，评估报损

### 5. ALERT-GAP - 断点记录

- **数据**: 存在60分钟数据缺口
- **检测**: 导入时自动检测断点
- **建议**: 需人工确认数据完整性

## 业务闭环判断

查看报告时，可按以下标准判断业务是否闭环:

1. **所有告警已评估**: 检查 `report --type summary` 中"未评估"应为0
2. **CRITIAL/HIGH已处理**: 高风险告警应有"人工修正"记录
3. **受影响批次明确**: 每个高风险告警的关联批次已列出
4. **复检/报损建议**: 报告中明确标注需复检的批次
5. **历史记录完整**: 使用 `detail --history` 查看所有操作痕迹

如果以上5点都满足，说明告警处理流程已形成业务闭环。
