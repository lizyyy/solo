# 跑道除冰作业复核工具 (Deicing Review CLI)

机场机坪运行员离线复核跑道除冰作业的Python CLI工具。通过整合航班计划、气象数据、除冰液批次信息和喷洒作业记录，自动计算每条跑道/航班的放行窗口，提供补喷建议和用液异常检测。

## 功能特性

- ✅ **放行窗口计算**：基于温度、降水、液型保持时间自动计算有效起飞窗口
- ✅ **补喷建议**：根据保持时间剩余量提供优先级排序的补喷建议
- ✅ **用液异常检测**：检测除冰液过期、液型不匹配、批次信息缺失等问题
- ✅ **边界情况处理**：
  - 跨午夜航班（22:00-04:00）特殊标记
  - 喷洒记录缺液型时使用默认值
  - 保持时间过期自动预警
  - 降水条件下保持时间自动折算（7折）
- ✅ **多格式输出**：生成结构化CSV问题清单和Markdown复核报告

## 安装

```bash
pip install -r requirements.txt
```

## 快速开始

### Demo命令（一条命令运行示例）

```bash
python -m deicing_review \
  --flights sample_data/flights.csv \
  --weather sample_data/weather.csv \
  --batches sample_data/batches.yaml \
  --sprays sample_data/sprays.jsonl \
  --verbose
```

或者使用短参数：

```bash
python -m deicing_review -f sample_data/flights.csv -w sample_data/weather.csv -b sample_data/batches.yaml -s sample_data/sprays.jsonl -v
```

### 命令行参数

| 参数 | 全称 | 必填 | 说明 |
|------|------|------|------|
| `-f` | `--flights` | 是 | 航班放行计划 CSV 文件路径 |
| `-w` | `--weather` | 是 | 跑道气象分钟数据 CSV 文件路径 |
| `-b` | `--batches` | 是 | 除冰液批次配置 YAML 文件路径 |
| `-s` | `--sprays` | 是 | 喷洒作业记录 JSONL 文件路径 |
| `-o` | `--output-issues` | 否 | 问题清单输出 CSV (默认: `issues.csv`) |
| `-r` | `--output-report` | 否 | 复核报告输出 Markdown (默认: `deicing_review.md`) |
| `-v` | `--verbose` | 否 | 显示详细处理信息 |

## 输入文件格式

### 1. 航班放行计划 (CSV)

```csv
flight_number,aircraft_registration,departure_runway,scheduled_departure_time,gate,aircraft_type
CA1234,B-5321,36L,2026-05-03 08:30:00,12A,B737-800
MU5678,B-6890,36R,2026-05-03 08:45:00,15B,A320neo
```

| 字段 | 说明 |
|------|------|
| `flight_number` | 航班号 |
| `aircraft_registration` | 飞机注册号 |
| `departure_runway` | 计划起飞跑道 |
| `scheduled_departure_time` | 计划起飞时间 |
| `gate` | 停机位 (可选) |
| `aircraft_type` | 机型 (可选) |

### 2. 跑道气象分钟数据 (CSV)

```csv
timestamp,runway,temperature,dew_point,wind_speed,wind_direction,precipitation,visibility
2026-05-03 08:00:00,36L,-2,-5,8,270,light snow,8000
2026-05-03 08:05:00,36L,-3,-6,9,275,light snow,7500
```

| 字段 | 说明 |
|------|------|
| `timestamp` | 记录时间 |
| `runway` | 跑道编号，"ALL"表示全站通用 |
| `temperature` | 温度 (°C) |
| `dew_point` | 露点 (°C) |
| `wind_speed` | 风速 (kts) |
| `wind_direction` | 风向 (°) |
| `precipitation` | 降水类型 (none/light snow/rain等) |
| `visibility` | 能见度 (m) |

### 3. 除冰液批次配置 (YAML)

```yaml
batches:
  - batch_id: TYPE_IV_2026_A
    fluid_type: TYPE_IV
    manufacturer: Clariant
    concentration: 100.0
    production_date: 2026-01-15 00:00:00
    expiry_date: 2026-12-31 23:59:59
    hold_time:
      -20:
        min: 45
        max: 60
      -15:
        min: 60
        max: 80
```

| 字段 | 说明 |
|------|------|
| `batch_id` | 批次唯一标识 |
| `fluid_type` | 液型: TYPE_I, TYPE_II, TYPE_IV |
| `manufacturer` | 厂商 |
| `concentration` | 浓度 (%) |
| `production_date` | 生产日期 |
| `expiry_date` | 过期日期 |
| `hold_time` | 各温度下的保持时间范围 (分钟) |

### 4. 喷洒作业记录 (JSONL)

每行一条JSON记录：

```json
{"record_id": "SPRAY_001", "aircraft_registration": "B-5321", "spray_time": "2026-05-03 08:15:00", "runway": "36L", "gate": "12A", "fluid_batch_id": "TYPE_IV_2026_A", "fluid_type": "TYPE_IV", "fluid_volume": 120.5, "spray_duration_seconds": 180, "operator": "ZHANG", "notes": "正常喷洒"}
```

## 输出文件说明

### 1. 问题清单 (issues.csv)

包含所有检测到的问题，按严重程度排序：

| 列名 | 说明 |
|------|------|
| `issue_id` | 问题编号 |
| `issue_type` | 问题类型 |
| `severity` | 严重程度 (CRITICAL/WARNING/INFO) |
| `flight_number` | 相关航班号 |
| `aircraft_registration` | 飞机注册号 |
| `runway` | 跑道 |
| `timestamp` | 时间戳 |
| `description` | 问题描述 |
| `recommendation` | 处理建议 |
| `metadata` | 附加信息 |

### 2. 复核报告 (deicing_review.md)

完整的Markdown格式复核报告，包含：

- 执行摘要（含统计数据）
- 放行窗口概览表
- 问题清单（按严重程度分类）
- 补喷建议（按优先级排序）
- 统计信息

## 问题类型说明

| 问题类型 | 严重程度 | 说明 |
|----------|----------|------|
| `HOLD_TIME_EXPIRED` | CRITICAL | 保持时间已过期，必须补喷 |
| `MISSING_BATCH_INFO` | CRITICAL | 未找到喷洒记录 |
| `FLUID_CONFLICT` | CRITICAL | 除冰液批次已过期 |
| `INSUFFICIENT_HOLD_TIME` | WARNING | 处于扩展窗口，建议尽快起飞 |
| `MISSING_FLUID_TYPE` | WARNING | 喷洒记录缺液型 |
| `CROSS_MIDNIGHT_FLIGHT` | WARNING | 跨午夜航班，需特别关注 |
| `PRECIPITATION_RISK` | WARNING | 有降水，保持时间已缩短 |
| `TEMPERATURE_OUT_OF_RANGE` | WARNING | 温度超出标准范围 |

## 保持时间计算逻辑

1. **基础保持时间**：根据除冰液批次配置中对应温度的保持时间
2. **温度插值**：实际温度在配置温度点之间时线性插值
3. **降水折算**：有降水时保持时间自动乘以0.7系数
4. **默认值**：缺液型时使用该温度下的默认保持时间

## 示例数据说明

`sample_data/` 目录下包含示例数据，演示了多种边界情况：

| 航班 | 场景 |
|------|------|
| CA1234 | 正常航班，TYPE IV 除冰液 |
| MU5678 | 喷洒时间较早，保持时间紧张 |
| CZ9012 | 宽体机，双步喷洒 |
| HU3456 | 喷洒记录缺液型 |
| CA8899 | 跨午夜航班 (23:30) |
| MU2233 | 使用过期批次除冰液 |
| CA7788 | 凌晨航班 (03:00)，TYPE I 除冰液 |

## 依赖

- Python >= 3.8
- pandas >= 2.0.0
- pyyaml >= 6.0
