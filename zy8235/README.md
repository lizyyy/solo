# 天线排程预检工具 (Antenna Scheduler)

卫星地面站天线排程预检 CLI 工具，用于离线校验和规划卫星过境排程。

## 功能特性

- **validate**: 校验可见窗口、天线转向冷却时间、维护禁用段和任务优先级抢占
- **plan**: 生成可执行排程建议，处理冲突和优先级
- **export-report**: 导出冲突清单和排程报告

## 安装

```bash
pip install -e .
```

或者安装依赖：

```bash
pip install -r requirements.txt
```

## 使用方法

### 基本命令

```bash
# 校验排程
antenna-scheduler validate --config sample/antenna.yaml --passes sample/passes.csv --priority sample/mission_priority.json --maintenance sample/maintenance.csv

# 生成排程计划
antenna-scheduler plan --config sample/antenna.yaml --passes sample/passes.csv --priority sample/mission_priority.json --maintenance sample/maintenance.csv

# 导出报告
antenna-scheduler export-report --config sample/antenna.yaml --passes sample/passes.csv --priority sample/mission_priority.json --maintenance sample/maintenance.csv
```

## Demo 命令

运行以下命令快速体验：

```bash
# 1. 先创建虚拟环境（可选）
python3 -m venv venv
source venv/bin/activate

# 2. 安装依赖
pip install -r requirements.txt

# 3. 运行完整校验
python -m antenna_scheduler validate

# 4. 生成排程计划
python -m antenna_scheduler plan

# 5. 导出完整报告（生成 issues.csv 和 schedule_review.md）
python -m antenna_scheduler export-report
```

## 输入文件格式

### 1. antenna.yaml (天线配置)
```yaml
antennas:
  - id: ANT-01
    name: 主天线-1
    azimuth_min: 0
    azimuth_max: 360
    elevation_min: 5
    elevation_max: 90
    slew_rate: 3.0
    cooldown_minutes: 5
```

### 2. passes.csv (卫星过境数据)
```csv
pass_id,satellite_name,antenna_id,start_time,end_time,azimuth_start,elevation_start,azimuth_end,elevation_end,mission_type
P001,卫星A,ANT-01,2026-05-04 08:00:00,2026-05-04 08:15:00,45.0,20.0,90.0,30.0,通信任务
```

### 3. mission_priority.json (任务优先级)
```json
{
  "priorities": [
    {
      "mission_type": "紧急任务",
      "priority_level": 1,
      "can_preempt": true
    },
    {
      "mission_type": "通信任务",
      "priority_level": 2,
      "can_preempt": false
    }
  ]
}
```

### 4. maintenance.csv (维护计划)
```csv
maintenance_id,antenna_id,start_time,end_time,reason
M001,ANT-01,2026-05-04 10:00:00,2026-05-04 12:00:00,定期校准
```

## 输出文件

- **issues.csv**: 冲突清单，包含可见窗口冲突、冷却时间冲突、维护段冲突、优先级抢占等
- **schedule_review.md**: 排程建议报告，包含执行时间表、冲突汇总、优化建议

## 边界情况处理

- **跨午夜过境**: 支持跨午夜的过境数据（如 23:50 到 00:20）
- **同一卫星连续抢占**: 检测同一卫星连续过境的优先级和冷却时间
- **天线转向冷却**: 计算天线转向时间和冷却时间间隔

## 项目结构

```
.
├── antenna_scheduler/
│   ├── __init__.py
│   ├── cli.py              # CLI 入口
│   ├── models.py           # 数据模型
│   ├── validator.py        # 校验逻辑
│   ├── scheduler.py        # 排程逻辑
│   └── reporter.py         # 报告生成
├── sample/
│   ├── antenna.yaml
│   ├── passes.csv
│   ├── mission_priority.json
│   └── maintenance.csv
├── setup.py
├── requirements.txt
└── README.md
```

## 开发

```bash
# 运行测试
python -m pytest tests/

# 代码检查
python -m pylint antenna_scheduler/
```
