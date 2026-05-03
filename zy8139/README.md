# BACnet Gateway Upgrade Validator

本地 Python CLI 工具，用于楼宇自控团队在升级 BACnet 网关前离线回放点表变更。

## 功能特性

- **点位重命名校验**: 检测新旧命名映射冲突、重复映射、缺失映射
- **单位倍率校验**: 验证单位转换和倍率应用是否正确
- **读数新鲜度校验**: 检查数据采集间隔是否超出阈值
- **告警阈值校验**: 验证读数是否在预期的高低阈值范围内
- **特殊坑处理**:
  - 同名点跨楼层: 通过楼层标识自动区分同名点位
  - UTC/本地时间混用: 自动检测并告警时间格式不一致问题

## 输出文件

1. **issues.csv**: 所有问题的详细列表，按严重程度排序
2. **mapping_report.md**: Markdown 格式的完整验证报告
3. **timeline.html**: 交互式 HTML 时间线，可按严重程度筛选

## 安装

```bash
# 克隆仓库后安装依赖
pip install -r requirements.txt
```

## 目录结构

```
.
├── bacnet_validator/
│   ├── __init__.py
│   ├── parser.py          # 文件解析模块 (CSV, JSONL, YAML)
│   ├── rules.py           # 验证规则引擎
│   └── reporter.py        # 报告生成模块
├── bacnet_validate.py     # CLI 入口
├── samples/
│   ├── point_map.csv      # 点表映射示例
│   ├── bacnet_reads.jsonl # BACnet 读数示例
│   └── rules.yaml         # 验证规则示例
├── tests/                 # 测试用例
├── requirements.txt
└── README.md
```

## 快速开始 (Demo)

### 1. 使用示例数据运行验证

```bash
# 完整验证，生成所有报告
python bacnet_validate.py \
    --point-map samples/point_map.csv \
    --bacnet-reads samples/bacnet_reads.jsonl \
    --rules samples/rules.yaml \
    --output ./my_output \
    --verbose
```

### 2. 仅查看摘要

```bash
# 不生成报告文件，只显示验证摘要
python bacnet_validate.py \
    -p samples/point_map.csv \
    -b samples/bacnet_reads.jsonl \
    -r samples/rules.yaml \
    --summary
```

### 3. 查看帮助

```bash
python bacnet_validate.py --help
```

## 输入文件格式

### 1. point_map.csv (点表映射)

| 字段 | 必需 | 说明 | 示例 |
|------|------|------|------|
| old_name | 是 | 升级前的点位名称 | RoomTemp_Sensor |
| new_name | 是 | 升级后的点位名称 | AHU1_RT_Zone1_Temp |
| unit | 是 | 单位 | Celsius |
| unit_multiplier | 否 | 单位倍率，用于单位转换 | 0.471947 (cfm 转 l/s) |
| floor | 否 | 楼层号，用于区分同名点 | 1, 2, 3 |
| device_id | 否 | 设备标识 | AHU-001 |
| point_type | 否 | 点位类型 | analog, binary, multistate |
| description | 否 | 描述 | Zone 1 Room Temperature |

**注意**: `floor` 和 `device_id` 字段用于解决**同名点跨楼层**的问题。例如，三层楼可能都有 `RoomTemp_Sensor`，通过 `floor` 字段可以区分它们。

### 2. bacnet_reads.jsonl (BACnet 读数)

每一行是一个 JSON 对象：

```json
{
  "timestamp": "2026-05-03T08:00:00.000Z",
  "point_name": "RoomTemp_Sensor",
  "floor": "1",
  "device_id": "AHU-001",
  "value": 22.5,
  "unit": "Celsius",
  "status": "ok"
}
```

**时间格式支持**:
- UTC 格式 (推荐): `2026-05-03T08:00:00.000Z`
- 本地时间: `2026-05-03 08:00:00` (会被检测为混合时区警告)

### 3. rules.yaml (验证规则)

```yaml
rules:
  - type: temperature
    point_pattern: "Temp|Sensor$"      # 正则表达式匹配点位名称
    unit: "Celsius"
    staleness_threshold_seconds: 300    # 5分钟超时
    high_alarm_threshold: 30.0          # 高温告警阈值
    low_alarm_threshold: 15.0           # 低温告警阈值
    tolerance_pct: 2.0                   # 容差百分比
    enabled: true
```

## 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 验证通过，无问题 |
| 1 | 存在 High 级别问题 |
| 2 | 存在 Critical 级别问题，不建议升级 |
| 3 | 执行错误 (文件不存在、解析错误等) |

## 测试

```bash
# 运行所有测试
pytest -v

# 运行特定测试
pytest tests/test_parser.py -v
```

## 常见问题

### Q1: 同名点跨楼层如何处理？

工具会自动组合 `floor` + `device_id` + `old_name` 生成唯一标识符 `full_identifier`。例如：
- 1楼: `F1.AHU-001.RoomTemp_Sensor`
- 2楼: `F2.AHU-002.RoomTemp_Sensor`

### Q2: UTC 和本地时间混用会怎样？

工具会检测时间戳格式，如果发现同时存在带 `Z`/`+00:00` 后缀的 UTC 时间和不带后缀的本地时间，会产生警告。所有时间在内部会统一转换为 UTC 处理。

### Q3: 单位倍率如何工作？

例如，将 `cfm` (立方英尺/分钟) 转换为 `l/s` (升/秒)，倍率为 0.471947。工具会验证读数是否符合倍率转换后的预期值。

### Q4: 如何自定义验证规则？

编辑 `rules.yaml` 文件，添加新的规则条目。`point_pattern` 支持正则表达式，可以灵活匹配点位名称。

## 示例场景

样例数据中包含以下典型问题：

1. **高/低阈值告警**: 3楼 RoomTemp 达到 35.5°C (超过 30°C 阈值)
2. **单位不匹配**: 2楼 RoomTemp 读数单位为 Fahrenheit 但映射为 Celsius
3. **读数超时**: 1楼 RoomTemp 在 08:02 到 08:10 之间有 8 分钟间隔
4. **风扇转速越界**: ReturnFan_Speed 达到 105% (超过 100% 阈值)
5. **CO2 过高**: CO2_Sensor 达到 1200 ppm (超过 1000 ppm 阈值)
6. **锅炉温度过高**: Boiler_Temp 达到 95°C (超过 90°C 阈值)
7. **混合时区**: 部分读数使用 UTC 格式，部分使用本地时间格式
8. **同名多楼层**: RoomTemp_Sensor 出现在 1、2、3 楼

## 许可证

内部使用
