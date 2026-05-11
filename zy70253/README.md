# 冷库门禁温升追踪 CLI (Cold Storage Tracker)

追踪冷库门禁开关频繁导致的温升，关联货品批次和责任班次的命令行工具。

## 核心功能

1. **门禁日志验证**：解析门禁开关记录，验证日志有效性
2. **温度曲线分析**：评估温度数据可靠性，检测温升事件
3. **货品批次关联**：将温升事件与在库存货批次对应
4. **班次归因**：根据时间自动识别责任班次
5. **风险报告**：生成完整的分析报告，标记需人工确认的记录

## 快速开始

### 查看帮助

```bash
node src/cli.js help
```

### 查看样例数据说明

```bash
node src/cli.js samples
```

### 分析完整数据集

```bash
node src/cli.js analyze \
  --access samples/csv/access_log.csv \
  --temperature samples/csv/temperature.csv \
  --batches samples/csv/batches.csv \
  --shifts samples/csv/shifts.csv
```

### 仅验证数据格式

```bash
node src/cli.js validate --access samples/csv/access_log.csv
```

## 输出状态说明

CLI 运行后会显示四种状态之一：

| 状态 | 颜色 | 含义 | 处理方式 |
|------|------|------|----------|
| **通过** | 绿色 | 所有数据有效，无跳过行，无人工确认需求 | 无需任何操作 |
| **需要人工确认** | 黄色 | 数据有效但存在需审核的记录 | 查看"风险事件详情"，手动确认标记为 `[需要人工确认]` 的记录 |
| **失败** | 红色 | 存在跳过的坏行 | 查看"跳过的坏行详情"，修复数据后重跑 |
| **部分完成** | 青色 | 仅验证了部分数据文件 | 补充完整的数据集后再次运行 |

### 通过的判断条件

- 所有数据文件无跳过的坏行
- 所有风险事件的 `manualCheckRequired` 为 `false`
- 所有货品批次都有完整的入库/出库时间
- 所有班次都能在排班表中找到对应

### 需要人工确认的情况

- 货品批次缺少出库时间（`storageEnd` 为空）
- 班次在排班表中无对应记录
- 门禁事件序列存在异常（如缺少关门记录）

### 失败的原因

- 必填字段缺失（如 `timestamp`, `doorId`, `batchId` 等）
- 数据格式错误（如无效的日期、非数字温度值）
- 数据逻辑错误（如入库时间晚于出库时间）

## 文件格式说明

### 1. 门禁日志 (access_log.csv/json)

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| timestamp | 是 | ISO 格式时间戳 | 2024-01-15T08:30:00 |
| doorId | 是 | 门禁编号 | DOOR_A |
| employeeId | 否 | 员工编号 | EMP001 |
| cardId | 否 | 门禁卡号 | CARD123 |
| accessType | 否 | 门禁类型 | OPEN / CLOSE / GRANTED / DENIED |
| doorStatus | 否 | 门状态 | OPEN / CLOSED |

### 2. 温度数据 (temperature.csv/json)

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| timestamp | 是 | ISO 格式时间戳 | 2024-01-15T08:30:00 |
| temperature | 是 | 温度值 (°C) | -20.5 |
| sensorId | 否 | 传感器编号 | SENSOR_01 |

### 3. 货品批次 (batches.csv/json)

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| batchId | 是 | 批次编号 | BATCH001 |
| productName | 否 | 货品名称 | 冷冻水饺 |
| storageStart | 否 | 入库时间 | 2024-01-10T10:00:00 |
| storageEnd | 否 | 出库时间 | 2024-01-20T14:00:00 |
| requiredTemp | 否 | 要求存储温度 (°C) | -18 |

### 4. 班次排班 (shifts.csv/json)

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| date | 是 | 日期 | 2024-01-15 |
| shiftName | 是 | 班次名称 | 早班 / 中班 / 晚班 |
| employeeId | 否 | 员工编号 | EMP001 |
| employeeName | 否 | 员工姓名 | 张三 |

### 5. 配置参数 (config.json)

| 字段 | 默认值 | 说明 |
|------|--------|------|
| doorOpenDurationThreshold | 300 | 门开时长阈值（秒），超过则标记为风险 |
| temperatureRiseThreshold | 2.0 | 温升阈值（°C），超过则标记为温升事件 |
| normalTemperatureRange | [-25, -18] | 正常温度范围 |
| recoveryTimeThreshold | 1800 | 温度恢复时间阈值（秒） |

## 验收测试场景

项目提供了三种测试场景，位于 `samples/test-scenarios/` 目录：

### 场景1：正常处理

```bash
node src/cli.js analyze \
  --access samples/test-scenarios/scenario1-normal/access_log.csv \
  --temperature samples/test-scenarios/scenario1-normal/temperature.csv \
  --batches samples/test-scenarios/scenario1-normal/batches.csv \
  --shifts samples/test-scenarios/scenario1-normal/shifts.csv
```

**预期结果**：状态 `[通过]`，无跳过行，无人工确认需求。

### 场景2：失败原因

```bash
node src/cli.js analyze \
  --access samples/test-scenarios/scenario2-failed/access_log.csv \
  --temperature samples/test-scenarios/scenario2-failed/temperature.csv \
  --batches samples/test-scenarios/scenario2-failed/batches.csv \
  --shifts samples/test-scenarios/scenario2-failed/shifts.csv
```

**预期结果**：状态 `[失败]`，显示跳过的坏行及具体错误原因。

包含的错误示例：
- 缺少时间戳
- 无效的日期格式
- 无效的温度值
- 缺少批次ID
- 入库时间晚于出库时间

### 场景3：修正后重跑

```bash
node src/cli.js analyze \
  --access samples/test-scenarios/scenario3-fixed/access_log.csv \
  --temperature samples/test-scenarios/scenario3-fixed/temperature.csv \
  --batches samples/test-scenarios/scenario3-fixed/batches.csv \
  --shifts samples/test-scenarios/scenario3-fixed/shifts.csv
```

**预期结果**：状态 `[通过]`，验证修复后数据可正常处理。

## 命令选项

| 选项 | 说明 |
|------|------|
| `--access <文件>` | 门禁日志文件 |
| `--temperature <文件>` | 温度数据文件 |
| `--batches <文件>` | 货品批次文件 |
| `--shifts <文件>` | 班次排班文件 |
| `--config <文件>` | 配置参数文件 |
| `--output <文件>` | 将结果输出到 JSON 文件 |
| `--json` | 以 JSON 格式输出结果 |
| `--verbose` | 显示详细错误信息 |

## 输出详解

### 数据验证统计

```
门禁日志:
  总行数: 12      <- 文件中读取的总行数
  有效行: 12      <- 通过验证的数据行
  跳过的坏行: 0    <- 有错误被跳过的行
  需人工确认: 0    <- 有警告需人工确认的行
```

### 分析报告摘要

```
有效门禁开关周期: 6      <- 完整的开门-关门周期数
温度数据点: 40           <- 温度传感器读数数量
温升事件: 0              <- 超过阈值的温度上升事件
关联风险事件: 2          <- 门开超时或关联温升的事件
受影响批次: 9            <- 在风险事件期间在库的货品批次
需人工审核事件: 1        <- 标记为需要人工确认的事件数
```

### 温度曲线分析

```
最低温度: -21.5°C
最高温度: -18.5°C
平均温度: -20.4°C
可靠性评分: 70/100       <- 基于数据间隔和温度偏离计算
```

可靠性评分扣分规则：
- 数据间隔超过 30 分钟：每次扣 10 分
- 温度偏离正常范围：每次扣 5 分

### 风险事件详情

每个风险事件包含：
- 门禁编号
- 开门/关门时间
- 开门时长（超过阈值会标记）
- 最大温升
- 责任班次和员工
- 受影响的货品批次
- 是否需要人工确认

## 题目边界

此工具通过以下三个维度拉开与通用数据处理工具的边界：

1. **冷库门禁领域**：专门理解门禁开关周期、门状态转换、授权类型等专业概念
2. **温升曲线关联**：将门禁事件与温度数据在时间维度上关联，分析门开对温度的影响
3. **班次归因**：基于冷库三班制（早班6:00-14:00、中班14:00-22:00、晚班22:00-6:00）自动识别责任班次

## 技术栈

- Node.js (>= 14.0.0)
- 零外部依赖
- 支持 CSV / JSON 数据格式
- 跨平台终端彩色输出
