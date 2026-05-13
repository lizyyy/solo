# 仓储冷库温区盘点 CLI

解决**冷库货品跨温区暂存后，批号、温度记录和盘点数量容易分家**的问题。

## 核心功能

### 1. 温区清单导入（可重复）
- 支持 CSV 和 Excel 格式
- 支持 `update`（覆盖更新）和 `skip`（跳过已有）两种策略
- 每次导入记录完整审计日志，可追溯来源
- 自动检测跨温区移动并记录

### 2. 批号匹配
- 比对 WMS 库存批号与温度记录批号
- 识别以下情况：
  - **完全匹配**：WMS 温区 = 温度记录温区
  - **部分匹配**：温度记录覆盖多个温区，包含 WMS 温区
  - **不匹配**：WMS 温区与温度记录温区不一致
  - **缺失**：WMS 有批号但无温度记录，或温度记录有批号但 WMS 无

### 3. 温度断点检测
- 检测温度记录间隔 > 120 分钟的断点
- 识别跨温区移动伴随的温度断点
- 检测温度超出温区正常范围的异常
  - 冷冻区：-25 ~ -15°C
  - 冷藏区：0 ~ 8°C
  - 保鲜区：8 ~ 15°C
  - 常温区：15 ~ 30°C

### 4. 盘点差异
- 比对 WMS 库存数量与人工盘点数量
- 比对 WMS 温区与实际盘点温区
- 计算差异数量和差异百分比

### 5. 异常留痕
- 每种异常自动创建记录，包含：
  - 批号、异常类型、严重度、状态
  - 详细原因描述
  - 证据数据（可反查来源）
  - 时间戳、来源系统
- 支持异常处理流程：标记已解决、记录处理人、处理方式

### 6. 日报导出
- 导出 JSON 和 Excel 两种格式
- Excel 包含 5 个工作表：
  - **报告概览**：核心指标、温区统计、异常分布
  - **库存明细**：WMS 库存 + 盘点数据
  - **温度记录**：完整温度历史
  - **异常明细**：所有异常记录及证据
  - **导入审计**：所有导入操作及错误详情

## 安装

```bash
npm install
chmod +x bin/index.js
```

## 快速开始

### 完整验收流程

```bash
# 1. 导入初始库存清单
node bin/index.js import-inventory samples/inventory.csv

# 2. 导入温度记录（包含跨温区移动和温度超标场景）
node bin/index.js import-temperature samples/temperature.csv

# 3. 导入人工盘点数据（包含数量差异和温区不匹配）
node bin/index.js import-count samples/manual_count.csv

# 4. 执行综合分析
node bin/index.js analyze

# 5. 生成日报
node bin/index.js report

# 6. 查看当前状态
node bin/index.js status

# 7. 查看异常记录
node bin/index.js exceptions

# 8. 查看导入历史（验证可重复导入）
node bin/index.js import-history

# 9. 再次导入更新后的库存（测试可重复导入）
node bin/index.js import-inventory samples/inventory-update.csv

# 10. 再次查看状态（验证数据已更新）
node bin/index.js status

# 11. 再次分析（验证新增异常）
node bin/index.js analyze

# 12. 再次生成日报
node bin/index.js report
```

## 命令详解

### 导入命令

```bash
# 导入 WMS 库存
node bin/index.js import-inventory <file> [-s update|skip]

# 导入温度记录
node bin/index.js import-temperature <file>

# 导入人工盘点
node bin/index.js import-count <file>
```

**导入文件格式说明**：

**库存清单 (inventory.csv)**：
| 字段 | 必填 | 说明 |
|------|------|------|
| lotNumber | 是 | 批号（至少 3 位） |
| productName | 是 | 商品名称 |
| zone | 是 | 温区（冷冻区/冷藏区/保鲜区/常温区） |
| quantity | 是 | 数量（非负数字） |
| unit | 否 | 单位（默认：件） |
| entryDate | 是 | 入库日期（ISO 格式） |
| expiryDate | 否 | 保质期 |

**温度记录 (temperature.csv)**：
| 字段 | 必填 | 说明 |
|------|------|------|
| lotNumber | 是 | 批号 |
| zone | 是 | 温区 |
| temperature | 是 | 温度（-50 ~ 50°C） |
| recordTime | 是 | 记录时间 |
| sensorId | 否 | 传感器ID |

**人工盘点 (manual_count.csv)**：
| 字段 | 必填 | 说明 |
|------|------|------|
| lotNumber | 是 | 批号 |
| countedQuantity | 是 | 盘点数量 |
| countedZone | 是 | 盘点温区 |
| countedBy | 是 | 盘点人 |
| countedAt | 是 | 盘点时间 |

### 分析命令

```bash
# 综合分析（推荐）
node bin/index.js analyze

# 仅分析批号匹配
node bin/index.js analyze -t lot

# 仅分析温度断点
node bin/index.js analyze -t temperature

# 仅分析盘点差异
node bin/index.js analyze -t inventory
```

### 异常管理

```bash
# 查看未处理异常
node bin/index.js exceptions

# 查看所有异常
node bin/index.js exceptions -s all

# 查看已处理异常
node bin/index.js exceptions -s resolved

# 查看已被新分析取代的旧异常
node bin/index.js exceptions -s superseded

# 处理异常（标记为 resolved）
node bin/index.js resolve-exception <id> <处理人> <处理方式> [-n 备注]
```

**异常去重机制说明**：

每次执行 `analyze` 命令时：
1. 基于「批号 + 异常类型 + 证据数据」生成 SHA256 指纹
2. 比对现有异常的指纹：
   - **新异常**：指纹不存在 → 新增记录（status: open）
   - **不变异常**：指纹已存在 → 保持不变（status: open）
   - **过时异常**：旧指纹在新结果中不存在 → 标记为已取代（status: superseded）
3. 已处理的异常（status: resolved）不会被修改，保留历史记录

这样可以确保：
- 重复执行 `analyze` 不会累积重复异常
- 数据变化（如库存更新）会正确生成新异常
- 手动处理过的异常保留历史

### 数据重置

```bash
# 重置所有数据（库存、温度、异常、导入历史）
node bin/index.js reset -t all -y

# 仅重置异常台账
node bin/index.js reset -t exceptions -y

# 或使用 npm script
npm run reset
```

**注意**：这是危险操作，会永久删除数据，需要 `-y` 参数确认。

### 报告生成

```bash
# 生成今日报告
node bin/index.js report

# 生成指定日期报告
node bin/index.js report -d 2026-05-09

# 指定输出目录
node bin/index.js report -o ./my-reports
```

### 状态查询

```bash
# 查看整体数据状态
node bin/index.js status

# 查看导入历史
node bin/index.js import-history

# 查看最近 20 条导入记录
node bin/index.js import-history -l 20
```

## 数据存储结构

```
data/
├── inventory.json      # 库存数据（含版本历史）
├── temperature.json    # 温度记录
├── exceptions.json     # 异常记录
└── import-history.jsonl  # 导入审计日志（JSON Lines 格式）

reports/
├── daily-report-YYYY-MM-DD.json
└── daily-report-YYYY-MM-DD.xlsx
```

## 测试场景覆盖

### 1. 批号匹配异常
- `LOT-001`：温度记录显示跨温区移动（冷冻区 -> 冷藏区 -> 冷冻区），WMS 显示在冷冻区 → **部分匹配**
- `LOT-005`：WMS 有记录但无温度记录 → **批号缺失**

### 2. 温度断点
- `LOT-001`：10:00 -> 15:00 间隔 5 小时 > 120 分钟阈值 → **温度断点 + 跨温区移动**
- `LOT-002`：14:30 温度 12°C 超出冷藏区 0-8°C 范围 → **温度超标**

### 3. 盘点差异
- `LOT-001`：WMS 50 箱 vs 盘点 45 箱 → **数量差异 -5**
- `LOT-003`：WMS 在保鲜区 vs 盘点在冷藏区 → **温区不匹配**

### 4. 可重复导入
- 第二次导入 `inventory-update.csv`：
  - `LOT-001`：温区从冷冻区变为冷藏区，数量从 50 变为 60 → **更新**
  - `LOT-002`：数量从 100 变为 120 → **更新**
  - `LOT-006`：新批号 → **新增**

## 报告反查说明

Excel 报告中的**异常明细**工作表包含「证据摘要」列，记录了异常的原始数据来源。例如：

- 温度超标异常会记录：`{"temperature":12,"zone":"冷藏区","threshold":{"min":0,"max":8},"deviation":4,"recordTime":"2026-05-09 14:30:00"}`
- 盘点差异异常会记录：`{"wmsQuantity":50,"countedQuantity":45,"difference":-5,"countedBy":"张三","countedAt":"2026-05-09 16:00:00"}`

**导入审计**工作表记录了所有导入操作，包括文件名、时间、成功/失败数量、错误详情。

## 错误提示示例

当导入数据有问题时，会给出明确的错误原因：

```
错误: 3 条
  - 行2, 字段lotNumber: 批号长度过短 (2 位), 至少需要 3 位
  - 行3, 字段quantity: 数量不是有效数字: abc
  - 行4, 字段zone: 未知温区: 超低温区, 有效温区: 冷冻区, 冷藏区, 保鲜区, 常温区
```
