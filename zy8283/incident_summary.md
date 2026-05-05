# 工厂设备运维事件汇总报告

> 生成时间: 2026-05-05T23:55:08.182731

## 概览

| 指标 | 数值 |
|------|------|
| 总行数 | 53 |
| 有效行数 | 40 |
| 坏行数 | 13 |
| 涉及设备数 | 13 |
| 发现错误码数 | 8 |
| 事件总数 | 16 |

### 时间范围

- 开始时间: 2026-05-04T00:00:01.456000
- 结束时间: 2026-05-04T08:00:50.123000

### 涉及设备

- `EDGE-001`
- `EDGE-002`
- `EDGE-003`
- `PLC-001`
- `PLC-002`
- `PLC-003`
- `PLC-004`
- `PLC-005`
- `PLC-BAD`
- `PLC-EMBEDDED`
- `PLC-ENCODING`
- `PLC-MIDNIGHT`
- `PLC-ORDER`

## 事件详情

### 按设备聚合

#### EDGE-002 (2 条)

##### E3001 (1 次)

| 时间 | 行号 | 级别 | 消息 |
|------|------|------|------|
| 2026-05-04T08:00:10.789000 | 0 | ERROR | Failed to publish data |


##### E3002 (1 次)

| 时间 | 行号 | 级别 | 消息 |
|------|------|------|------|
| 2026-05-04T08:00:25.789000 | 0 | ERROR | Database connection failed |


#### EDGE-003 (2 条)

##### E3003 (1 次)

| 时间 | 行号 | 级别 | 消息 |
|------|------|------|------|
| 2026-05-04T08:00:35.456000 | 0 | ERROR | Configuration reload failed |


##### NO_ERROR_CODE (1 次)

| 时间 | 行号 | 级别 | 消息 |
|------|------|------|------|
| 2026-05-04T08:00:20.456000 | 0 | WARN | High memory usage detected |


#### PLC-001 (2 条)

##### NO_ERROR_CODE (2 次)

| 时间 | 行号 | 级别 | 消息 |
|------|------|------|------|
| 2026-05-04T08:00:05.789000 | 3 | WARN | Sensor reading slightly high: 85.5C |
| 2026-05-04T08:00:35.123000 | 10 | WARN | Pressure approaching threshold |


#### PLC-002 (2 条)

##### E1001 (2 次)

| 时间 | 行号 | 级别 | 消息 |
|------|------|------|------|
| 2026-05-04T08:00:15.456000 | 5 | ERROR | Write operation failed. Error Code: E1001 |
| 2026-05-04T08:00:16.789000 | 6 | ERROR | Retry failed. Error Code: E1001 - Disk full |


#### PLC-003 (2 条)

##### E2003 (1 次)

| 时间 | 行号 | 级别 | 消息 |
|------|------|------|------|
| 2026-05-04T08:00:30.789000 | 9 | ERROR | Modbus timeout. Error Code: E2003 |


##### E2004 (1 次)

| 时间 | 行号 | 级别 | 消息 |
|------|------|------|------|
| 2026-05-04T08:00:50.123000 | 13 | ERROR | Connection lost. Error Code: E2004 |


#### PLC-004 (1 条)

##### E1005 (1 次)

| 时间 | 行号 | 级别 | 消息 |
|------|------|------|------|
| 2026-05-04T08:00:05 | 2 | WARN | Temperature sensor E1005 anomaly |


#### PLC-005 (2 条)

##### E2001 (1 次)

| 时间 | 行号 | 级别 | 消息 |
|------|------|------|------|
| 2026-05-04T08:00:10 | 3 | ERROR | Communication failure E2001 |


##### NO_ERROR_CODE (1 次)

| 时间 | 行号 | 级别 | 消息 |
|------|------|------|------|
| 2026-05-04T08:00:20 | 5 | WARN | Battery low |


#### PLC-EMBEDDED (2 条)

##### NO_ERROR_CODE (2 次)

| 时间 | 行号 | 级别 | 消息 |
|------|------|------|------|
| 2026-05-04T08:00:09.123000 | 14 | ERROR | Fatal error occurred E5001 during processing |
| 2026-05-04T08:00:10.456000 | 15 | WARN | Warning E5002 detected in subsystem |


#### PLC-ENCODING (1 条)

##### NO_ERROR_CODE (1 次)

| 时间 | 行号 | 级别 | 消息 |
|------|------|------|------|
| 2026-05-04T08:00:06.456000 | 9 | WARN | 连接断开 |


### 按错误码聚合

#### E1001

- 出现次数: 2
- 涉及设备: PLC-002

#### E1005

- 出现次数: 1
- 涉及设备: PLC-004

#### E2001

- 出现次数: 1
- 涉及设备: PLC-005

#### E2003

- 出现次数: 1
- 涉及设备: PLC-003

#### E2004

- 出现次数: 1
- 涉及设备: PLC-003

#### E3001

- 出现次数: 1
- 涉及设备: EDGE-002

#### E3002

- 出现次数: 1
- 涉及设备: EDGE-002

#### E3003

- 出现次数: 1
- 涉及设备: EDGE-003

#### NO_ERROR_CODE

- 出现次数: 7
- 涉及设备: PLC-001, PLC-ENCODING, PLC-EMBEDDED, PLC-005, EDGE-003

### 事件时间线

| 时间 | 设备 | 错误码 | 级别 | 消息 |
|------|------|--------|------|------|
| 2026-05-04T08:00:05 | PLC-004 | E1005 | WARN | Temperature sensor E1005 anomaly |
| 2026-05-04T08:00:05.789000 | PLC-001 | None | WARN | Sensor reading slightly high: 85.5C |
| 2026-05-04T08:00:06.456000 | PLC-ENCODING | None | WARN | 连接断开 |
| 2026-05-04T08:00:09.123000 | PLC-EMBEDDED | None | ERROR | Fatal error occurred E5001 during processing |
| 2026-05-04T08:00:10 | PLC-005 | E2001 | ERROR | Communication failure E2001 |
| 2026-05-04T08:00:10.456000 | PLC-EMBEDDED | None | WARN | Warning E5002 detected in subsystem |
| 2026-05-04T08:00:10.789000 | EDGE-002 | E3001 | ERROR | Failed to publish data |
| 2026-05-04T08:00:15.456000 | PLC-002 | E1001 | ERROR | Write operation failed. Error Code: E1001 |
| 2026-05-04T08:00:16.789000 | PLC-002 | E1001 | ERROR | Retry failed. Error Code: E1001 - Disk full |
| 2026-05-04T08:00:20 | PLC-005 | None | WARN | Battery low |
| 2026-05-04T08:00:20.456000 | EDGE-003 | None | WARN | High memory usage detected |
| 2026-05-04T08:00:25.789000 | EDGE-002 | E3002 | ERROR | Database connection failed |
| 2026-05-04T08:00:30.789000 | PLC-003 | E2003 | ERROR | Modbus timeout. Error Code: E2003 |
| 2026-05-04T08:00:35.123000 | PLC-001 | None | WARN | Pressure approaching threshold |
| 2026-05-04T08:00:35.456000 | EDGE-003 | E3003 | ERROR | Configuration reload failed |
| 2026-05-04T08:00:50.123000 | PLC-003 | E2004 | ERROR | Connection lost. Error Code: E2004 |

## 坏行归档

共有 **13** 行无法处理或存在问题，已归档至:

```
archive/bad-lines.jsonl
```

### 坏行原因说明

| 原因类型 | 说明 |
|----------|------|
| no_matching_template | 无法匹配任何预定义的正则模板 |
| time_out_of_order | 时间戳出现倒序 |
| midnight_crossing_suspicious | 跨午夜时间间隙过大，归属可疑 |
| missing_timestamp | 缺少时间戳 |
| empty_line | 空行 |
| invalid_timestamp_format | 时间戳格式无效 |
| unknown_log_level | 未知的日志级别 |

---

*本报告由 PLC 日志分析工具自动生成*