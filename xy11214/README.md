# 地下泵房巡检管理系统

一个真正能落地的服务端小系统，解决微信群巡检记录分散、漏看导致停水等问题。

## 功能特性

- ✅ **数据导入**: 支持巡检记录CSV、传感器告警JSON导入
- ✅ **错误追踪**: 坏记录不直接吞掉，保留原始位置、失败原因和修改建议
- ✅ **批量操作**: 批量导入/复核失败时明确哪些成功、哪些失败
- ✅ **状态管理**: 巡检记录复核状态（待复核/已复核/已处理）
- ✅ **告警确认**: 传感器告警确认机制
- ✅ **报告生成**: 自动生成统计报告，一目了然哪些需要关注
- ✅ **数据导出**: 支持CSV格式导出

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 查看系统状态

```bash
npm run status summary
```

### 3. 导入样例数据

**导入正常的巡检记录:**
```bash
npm run import:csv data/sample_inspections_normal.csv
```

**导入带错误的巡检记录（体验错误追踪功能）:**
```bash
npm run import:csv data/sample_inspections_with_errors.csv
```

**导入传感器告警:**
```bash
npm run import:json data/sample_alerts_normal.json
```

### 4. 查看待复核记录

```bash
npm run status pending
```

### 5. 复核巡检记录

**单条复核:**
```bash
npm run review 1 -- -r 张主管
```

**批量复核:**
```bash
npm run review 1,2,3 -- -r 张主管
```

**复核并设置为已处理:**
```bash
npm run review 1 -- -r 张主管 -s resolved
```

### 6. 查看未确认告警

```bash
npm run status alerts
```

### 7. 确认告警

```bash
npm run acknowledge 1 -- -r 李主管
```

### 8. 查看导入错误

```bash
npm run status errors
```

**标记错误为已解决:**
```bash
npm run status resolve-error 1
```

### 9. 生成统计报告

```bash
npm run report
```

**保存报告到文件:**
```bash
npm run report -- -o report.txt
```

### 10. 导出数据

**导出所有巡检记录:**
```bash
npm run export inspections output/inspections.csv
```

**导出所有告警记录:**
```bash
npm run export alerts output/alerts.csv
```

## 数据格式说明

### 巡检记录CSV格式

支持以下列名（中英文均可）：

| 英文列名 | 中文列名 | 必填 | 说明 |
|---------|---------|------|------|
| inspectionDate | 巡检日期 | ✅ | 支持多种日期格式 |
| inspector | 巡检人 | ✅ | 至少2个字符 |
| equipmentName | 设备名称 | ✅ |  |
| location | 位置 | ✅ |  |
| status | 状态 | ✅ | normal/warning/error/critical |
| temperature | 温度 |  | 数值 |
| pressure | 压力 |  | 数值 |
| vibration | 振动 |  | 数值 |
| remarks | 备注 |  |  |

**状态说明:**
- `normal`: 正常
- `warning`: 警告
- `error`: 异常
- `critical`: 严重

### 传感器告警JSON格式

```json
[
  {
    "sensorId": "传感器ID",
    "sensorType": "传感器类型",
    "location": "位置",
    "alertLevel": "warning",
    "value": 32.5,
    "threshold": 30.0,
    "alertTime": "2024-01-15 10:30:00",
    "isAcknowledged": 0
  }
]
```

**告警级别:**
- `info`: 信息
- `warning`: 警告
- `critical`: 严重

## 命令详解

### 数据导入

```bash
# 导入CSV巡检记录
npm run import:csv <文件路径>

# 导入JSON传感器告警
npm run import:json <文件路径>
```

**重要特性:**
- 导入过程中验证每条数据的有效性
- 有效数据成功入库
- 无效数据保存到"导入错误"表，包含：
  - 原始文件和行号
  - 原始数据
  - 具体错误原因
  - 修改建议
- 失败不影响已成功的记录

### 状态查看

```bash
# 系统概要
npm run status summary

# 待复核的巡检记录
npm run status pending

# 未确认的告警
npm run status alerts

# 导入错误
npm run status errors

# 查看所有错误（包括已解决）
npm run status errors -- -a
```

### 复核操作

```bash
# 复核单条记录
npm run review <ID> -- -r <复核人> [-s <状态>]

# 批量复核多条记录
npm run review <ID1,ID2,ID3> -- -r <复核人>

# 可选状态: pending/reviewed/resolved
```

### 导出数据

```bash
# 导出巡检记录
npm run export inspections <输出文件> [-s <状态>]

# 导出告警记录
npm run export alerts <输出文件> [-s <级别>]
```

### 报告生成

```bash
# 生成完整报告
npm run report

# 指定时间范围
npm run report -- -s 2024-01-01 -e 2024-01-31

# 保存到文件
npm run report -- -o report.txt
```

## 样例数据说明

`data/` 目录下提供多组样例数据用于测试：

| 文件 | 说明 |
|-----|------|
| sample_inspections_normal.csv | 正常的巡检记录，全部能成功导入 |
| sample_inspections_with_errors.csv | 含错误的巡检记录，部分成功部分失败 |
| sample_inspections_chinese.csv | 使用中文列名的巡检记录 |
| sample_alerts_normal.json | 正常的传感器告警，全部能成功导入 |
| sample_alerts_with_errors.json | 含错误的告警数据 |

**建议测试流程:**
1. 先导入 `_with_errors` 文件体验错误追踪功能
2. 查看错误列表 `npm run status errors`
3. 导入正常文件体验完整流程

## 数据库说明

系统使用 SQLite 嵌入式数据库，数据保存在 `inspection.db` 文件中。

**数据表:**
- `inspection_records`: 巡检记录
- `sensor_alerts`: 传感器告警
- `import_errors`: 导入错误记录

## 错误处理机制

### 导入错误处理

1. **数据校验**: 导入前对每条记录进行完整校验
2. **分类处理**: 有效数据入库，无效数据记录错误
3. **错误详情**: 保存原始位置、失败原因、修改建议
4. **原子操作**: 单条记录失败不影响其他记录

### 批量操作错误处理

1. **逐条执行**: 每条操作独立执行
2. **结果分离**: 返回成功列表和失败列表
3. **失败详情**: 失败项包含ID、错误原因、建议
4. **不回滚**: 已成功的记录保持成功状态

## 常见问题

### Q: 导入后发现有错误，如何重新导入？

A: 系统支持重复导入，不会覆盖已有数据。修正CSV文件后直接重新导入即可，错误的记录不会被重复保存。

### Q: 如何处理导入错误的记录？

A:
1. 查看错误详情: `npm run status errors`
2. 根据修改建议修正源文件
3. 重新导入修正后的文件
4. 标记原错误为已解决: `npm run status resolve-error <ID>`

### Q: 批量操作部分失败了怎么办？

A:
1. 查看输出的失败列表，了解具体哪些失败及原因
2. 修正问题后单独对失败项重新操作
3. 已成功的记录无需重复操作

### Q: 支持哪些日期格式？

A: 支持以下日期格式自动识别：
- `2024-01-15`
- `2024/01/15`
- `20240115`
- `2024-01-15 10:30:00`

## 项目结构

```
pump-room-inspection-system/
├── src/
│   ├── database.ts       # 数据库定义和初始化
│   ├── validations.ts    # 数据校验逻辑
│   ├── importService.ts  # 数据导入服务
│   ├── reviewService.ts  # 复核和状态管理
│   ├── reportService.ts  # 报告和导出服务
│   ├── cli.ts           # 命令行入口
│   └── index.ts         # 主入口
├── data/                # 样例数据
├── inspection.db        # SQLite数据库文件（自动生成）
├── package.json
├── tsconfig.json
└── README.md
```

## 技术栈

- **运行时**: Node.js
- **语言**: TypeScript
- **数据库**: SQLite (better-sqlite3)
- **命令行框架**: Commander.js
- **CSV解析**: csv-parser, csv-writer
- **日期处理**: date-fns
