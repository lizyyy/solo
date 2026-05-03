# 救生员盲区排查系统

一个用于公共泳馆的桌面GUI工具，帮助馆长排查救生员盯防盲区，优化排班安排。

## 功能特性

- **多格式数据导入**：支持导入泳道布局(JSON)、排班表(CSV)、客流热力(JSONL)、巡检打卡(CSV)和规则配置(YAML)
- **盲区检测**：自动识别未被救生员覆盖的盯防盲区
- **疲劳检测**：检测救生员值勤超时情况
- **儿童区监控**：确保儿童戏水区有足够救生员
- **异常处理**：处理跨午夜班次和打卡缺失两类异常
- **拖动调整**：支持通过拖动调整救生员分配区域
- **即时重算**：调整后立即重新计算盲区和风险
- **报告导出**：导出问题列表(issues.csv)和值勤审查报告(duty_review.md)

## 环境要求

- Python 3.7+
- pyyaml (用于解析YAML配置)

## 安装依赖

```bash
pip install pyyaml
```

## 启动命令

```bash
python main.py
```

或者在macOS/Linux上：
```bash
python3 main.py
```

## 数据文件格式

### 1. 泳道布局 (layout.json)

描述泳池的区域划分布局。

```json
{
  "pool_width": 25.0,
  "pool_length": 50.0,
  "zones": [
    {
      "id": "lane_1",
      "name": "泳道1",
      "zone_type": "swimming_lane",
      "position": {"x": 3.0, "y": 10.0},
      "coverage_radius": 5.0,
      "is_high_risk": false,
      "min_lifeguards": 1
    }
  ]
}
```

**区域类型(zone_type)可选值**:
- `swimming_lane` - 普通泳道
- `children_area` - 儿童戏水区
- `deep_zone` - 深水区
- `shallow_zone` - 浅水区
- `diving_area` - 跳水区
- `rest_area` - 休息区

### 2. 排班表 (schedule.csv)

描述救生员的排班安排。

```csv
shift_id,lifeguard_name,start_time,end_time,zone_id
shift_001,张小明,09:00,11:00,lane_1
shift_002,李大明,09:00,11:00,lane_2
```

**注意**：如果班次结束时间早于开始时间（如23:00-01:00），系统会自动识别为跨午夜班次。

### 3. 客流热力 (heatmap.jsonl)

每行一个JSON对象，记录各时段各区域的客流数据。

```jsonl
{"timestamp": "2024-01-15 09:00:00", "zone_id": "lane_1", "visitor_count": 8, "density": 0.3}
{"timestamp": "2024-01-15 09:00:00", "zone_id": "lane_2", "visitor_count": 6, "density": 0.25}
```

### 4. 巡检打卡 (checkin.csv)

记录救生员的打卡签到记录。

```csv
timestamp,lifeguard_name,zone_id,is_checkin
2024-01-15 09:02:00,张小明,lane_1,true
2024-01-15 11:00:00,张小明,lane_1,false
```

- `is_checkin: true` 表示签到
- `is_checkin: false` 表示签退

### 5. 规则配置 (rules.yaml)

配置分析规则参数。

```yaml
max_shift_duration_minutes: 120
min_break_minutes: 15
children_area_min_lifeguards: 2
high_risk_zone_min_lifeguards: 2
checkin_grace_minutes: 5
fatigue_alert_threshold_minutes: 90

time_slots:
  - start: "09:00"
    end: "11:00"
  - start: "11:00"
    end: "13:00"
```

**参数说明**:
- `max_shift_duration_minutes`: 最大允许值勤时长（分钟）
- `min_break_minutes`: 最小休息时长（分钟）
- `children_area_min_lifeguards`: 儿童区最少救生员数量
- `high_risk_zone_min_lifeguards`: 高风险区域最少救生员数量
- `checkin_grace_minutes`: 打卡宽限时间（分钟）
- `fatigue_alert_threshold_minutes`: 疲劳预警阈值（分钟）

## 使用流程

### 1. 导入数据

方式一：逐个导入
- 点击「文件」菜单，选择相应的导入选项
- 或者在左侧「数据导入」面板点击对应按钮

方式二：批量导入示例数据
- 点击「文件」→「批量导入示例数据」
- 或者在左侧「数据导入」面板点击「导入示例数据」按钮

### 2. 运行分析

- 点击「分析」→「运行分析」
- 或者在左侧「数据导入」面板点击「运行分析」按钮

### 3. 查看结果

分析完成后可以查看：
- **区域列表**：查看所有区域及其风险等级
- **班次管理**：查看所有班次信息
- **问题列表**：查看所有检测到的问题
- **区域覆盖视图**：右侧主面板显示各时段各区域的覆盖情况

### 4. 调整班次

1. 在区域覆盖视图中，点击某个救生员的名字选中
2. 点击目标区域卡片进行移动
3. 系统会立即重新计算盲区和风险

### 5. 导出报告

分析完成后可以导出：
- **issues.csv**：问题列表，包含所有检测到的问题详情
- **duty_review.md**：值勤审查报告，包含概览、问题列表、时段分析和建议措施

## 示例数据

项目提供了完整的示例数据，位于 `sample_data/` 目录：

- `layout.json` - 泳池布局（包含10个区域）
- `schedule.csv` - 排班表（25个班次，包含1个跨午夜班次）
- `heatmap.jsonl` - 客流热力数据（120条记录）
- `checkin.csv` - 打卡记录（47条记录，包含签到和签退）
- `rules.yaml` - 规则配置

这些示例数据已经预设了一些问题场景，方便测试系统功能。

## 检测的问题类型

| 问题类型 | 说明 | 严重程度 |
|---------|------|---------|
| BLIND_SPOT | 盯防盲区，无救生员覆盖 | HIGH/MEDIUM |
| FATIGUE_OVERTIME | 疲劳超时，值勤时间过长 | CRITICAL/MEDIUM |
| CHILDREN_AREA_ABSENT | 儿童区缺岗 | CRITICAL |
| MISSING_CHECKIN | 打卡缺失 | MEDIUM |
| CROSS_MIDNIGHT_SHIFT | 跨午夜班次 | LOW |

## 风险等级

| 等级 | 颜色 | 说明 |
|------|------|------|
| CRITICAL | 红色 | 严重问题，需立即处理 |
| HIGH | 橙色 | 高风险，需尽快处理 |
| MEDIUM | 黄色 | 中等风险，需关注 |
| LOW | 绿色 | 低风险，建议改进 |

## 项目结构

```
lifeguard-monitor/
├── main.py              # 主程序入口
├── README.md            # 本文档
├── modules/             # 功能模块
│   ├── __init__.py
│   ├── data_models.py   # 数据模型定义
│   ├── parsers.py       # 数据解析器
│   ├── algorithms.py    # 核心算法
│   ├── exporters.py     # 导出模块
│   └── gui.py           # GUI界面
└── sample_data/         # 示例数据
    ├── layout.json
    ├── schedule.csv
    ├── heatmap.jsonl
    ├── checkin.csv
    └── rules.yaml
```

## 注意事项

1. **跨午夜班次**：系统会自动识别结束时间早于开始时间的班次为跨午夜班次，时长计算会正确处理。

2. **打卡宽限**：系统允许一定的打卡宽限时间，在规则配置中可调整 `checkin_grace_minutes` 参数。

3. **儿童区要求**：儿童戏水区默认需要至少2名救生员，可在规则配置中调整。

4. **高风险区域**：深水区、跳水区等标记为高风险的区域需要额外的救生员配置。

## 许可证

MIT License
