# Trail Checker - 越野跑赛事数据校验工具

一个用于小型越野跑赛事的本地CLI工具，用于赛后数据校验和完赛核对。

## 功能特性

- **选手检查点校验**：检查选手是否漏过检查点
- **关门时间校验**：检查选手是否超过各检查点关门时间
- **补给站消耗校验**：检查补给站消耗是否异常（超量、偏低、负数记录等）
- **医疗事件回访**：标记需要赛后回访的医疗事件
- **去重导入**：支持可重复运行的导入去重逻辑
- **复核状态存储**：本地持久化复核状态，支持多轮复核
- **报告导出**：导出Markdown完赛核对报告和JSON审计包

## 安装

```bash
# 安装依赖
pip install click rich pydantic

# 安装为可执行命令（可选）
pip install -e .
```

## 数据文件格式

将以下JSON文件放入同一个目录：

### 1. 赛事配置 (race_config.json)
定义检查点、关门时间、补给站配置

```json
{
  "race_name": "2024 山野越野挑战赛",
  "race_date": "2024-10-20",
  "distance_km": 25.0,
  "checkpoints": [
    {
      "cp_id": "CP0",
      "name": "起点",
      "distance_km": 0.0,
      "cutoff_time": "2024-10-20T06:15:00",
      "is_start": true,
      "is_end": false
    }
  ],
  "aid_stations": [
    {
      "station_id": "AS1",
      "name": "CP1-云顶补给站",
      "checkpoint_id": "CP1",
      "expected_items": {
        "water_liters": 300,
        "energy_bars": 400
      }
    }
  ]
}
```

### 2. 报名名单 (registrations.json)
选手报名信息

```json
[
  {
    "bib": "1001",
    "name": "张三",
    "gender": "M",
    "age": 32,
    "emergency_contact": "李四 13800138001",
    "category": "25KM",
    "chip_id": "CHIP-001001",
    "status": "registered"
  }
]
```

### 3. 芯片过站记录 (timing_records.json)
芯片计时数据

```json
[
  {
    "record_id": "REC-001",
    "chip_id": "CHIP-001001",
    "bib": "1001",
    "checkpoint_id": "CP0",
    "timestamp": "2024-10-20T06:00:00",
    "record_type": "timing"
  }
]
```

### 4. 补给站消耗表 (aid_station_consumptions.json)
补给站消耗记录

```json
[
  {
    "consumption_id": "CONS-001",
    "station_id": "AS1",
    "recorded_at": "2024-10-20T09:00:00",
    "consumed_items": {
      "water_liters": 85,
      "energy_bars": 120
    },
    "notes": "早高峰过后清点"
  }
]
```

### 5. 医疗事件 (medical_events.json)
比赛中的医疗事件记录

```json
[
  {
    "event_id": "MED-001",
    "timestamp": "2024-10-20T08:30:00",
    "bib": "1003",
    "checkpoint_id": "CP1",
    "location": "CP1-云顶补给站",
    "symptoms": ["肌肉痉挛", "脱水"],
    "severity": "moderate",
    "treatment": ["电解质补充", "休息30分钟"],
    "treated_by": "李医生",
    "status": "继续比赛",
    "needs_follow_up": true,
    "notes": "选手主诉右侧小腿肌肉痉挛"
  }
]
```

## 使用方法

### 1. 校验数据

```bash
# 使用示例数据进行校验
trail-checker check examples/

# 或使用 python 直接运行
python -m trail_checker.cli check examples/
```

这将显示：
- 总体统计（报名、出发、完赛人数等）
- 需复核选手列表
- 补给站异常记录
- 需回访医疗事件

### 2. 列出所有选手

```bash
trail-checker list-runners examples/
```

### 3. 导出报告

```bash
# 导出Markdown报告和JSON审计包
trail-checker export examples/ -o race_report.md -a audit_package.json
```

### 4. 更新复核状态

```bash
# 更新选手复核状态
trail-checker review-runner 1002 ok --notes "已确认选手退赛"

# 更新补给站复核状态
trail-checker review-aid AS2 anomaly_confirmed

# 更新医疗事件复核状态
trail-checker review-medical MED-003 completed --contacted --notes "选手已出院，恢复良好"
```

## 去重逻辑

工具支持可重复运行的导入去重逻辑：

- **报名名单**：按 `bib` (参赛号) 去重
- **计时记录**：按 `record_id` 去重
- **补给消耗**：按 `consumption_id` 去重
- **医疗事件**：按 `event_id` 去重

可以多次运行 `check` 命令，重复的记录会被自动过滤。

## 状态存储

复核状态默认存储在 `.trail_checker/` 目录下：

```
.trail_checker/
├── runner_review.json      # 选手复核状态
├── aid_station_review.json # 补给站复核状态
└── medical_review.json     # 医疗事件复核状态
```

可以通过 `--state-dir` 参数指定其他目录。

## 示例数据

`examples/` 目录包含完整的示例数据，涵盖以下场景：

- **正常完赛选手**：1001, 1006
- **漏过检查点选手**：1002 (缺CP3)
- **超时选手**：1003 (CP2超时), 1004 (CP1超时), 1008 (多站超时)
- **未完赛选手**：1004, 1007, 1008
- **补给异常**：AS2消耗超量，AS3有负数记录
- **医疗事件**：5起事件，3起需回访

## 输出示例

### Markdown报告包含：
1. 总体统计表格
2. 完赛选手列表（含用时排名）
3. 未完赛选手详情
4. 需复核选手详细信息
5. 补给站消耗检查
6. 医疗事件记录
7. 检查点配置

### JSON审计包包含：
- 完整的校验结果
- 所有选手状态
- 补给站检查结果
- 医疗事件复核状态
- 汇总统计信息

## 依赖

- Python >= 3.9
- click >= 8.0.0 (命令行框架)
- rich >= 12.0.0 (终端格式化输出)
- pydantic >= 2.0.0 (数据验证)

## 许可证

MIT
