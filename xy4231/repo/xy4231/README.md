# 频点值守编排员

山地越野赛通信保障智能编排工具，用于赛前通信保障规划。

## 功能特性

- **多格式数据导入**: 支持补给站 CSV、中继台覆盖 JSON、志愿者班次 ICS、设备电池清单 CSV
- **数据校验**: 自动校验字段完整性、数据类型、时间格式
- **智能编排**: 生成频道分配、人员排班、设备分配方案
- **风险检测**:
  - 🔴 **覆盖缺口**: 检测关键路段是否无中继台覆盖
  - 📡 **频点冲突**: 检测同一时间同一区域是否使用相同/邻近频点
  - ⏰ **交接超时**: 检测班次交接间隔是否充足，是否存在值守空档
  - 🔋 **电池风险**: 检测设备电量是否能支撑到撤站
- **多格式导出**:
  - 📄 **Markdown**: 完整的通信保障方案文档
  - 📊 **CSV**: 风险清单、排班表
  - 📦 **JSON**: 完整的审计数据包

## 项目结构

```
freq_coordinator/
├── __init__.py          # 版本信息
├── models.py            # 数据模型定义
├── cli.py               # 命令行界面
├── parsers/             # 解析器模块
│   ├── __init__.py
│   ├── csv_parser.py    # CSV文件解析（补给站、设备）
│   ├── json_parser.py   # JSON文件解析（中继台）
│   └── ics_parser.py    # ICS文件解析（志愿者班次）
├── scheduler/           # 调度规则模块
│   ├── __init__.py
│   ├── rules.py         # 调度规则、频道分配、设备分配
│   └── orchestrator.py  # 编排协调器
├── risk_engine/         # 风险引擎模块
│   ├── __init__.py
│   ├── engine.py        # 风险引擎主模块
│   └── detectors.py     # 各风险检测器
└── exporters/           # 导出模块
    ├── __init__.py
    ├── markdown_exporter.py   # Markdown导出
    ├── csv_exporter.py        # CSV导出
    └── json_exporter.py       # JSON导出

examples/                  # 示例数据
├── supply_stations.csv     # 补给站示例
├── repeaters.json          # 中继台示例
├── devices.csv             # 设备清单示例
└── volunteer_shifts.ics    # 志愿者班次示例

tests/                     # 测试用例
├── __init__.py
├── test_parsers.py        # 解析器测试
├── test_scheduler.py      # 调度器测试
└── test_risk_engine.py    # 风险引擎测试
```

## 安装

### 环境要求

- Python 3.9+
- pip

### 安装步骤

```bash
# 克隆或下载项目
cd xy4231

# 以开发模式安装
pip install -e ".[dev]"
```

## 输入文件格式

### 1. 补给站 CSV

| 字段 | 必填 | 说明 |
|------|------|------|
| id | 是 | 站点唯一标识 |
| name | 是 | 站点名称 |
| latitude | 是 | 纬度 (-90 ~ 90) |
| longitude | 是 | 经度 (-180 ~ 180) |
| distance_from_start | 是 | 距起点距离 (km) |
| elevation | 否 | 海拔高度 (m) |
| criticality | 否 | 重要程度: critical/high/normal/low |
| required_coverage | 否 | 是否需要覆盖: true/false |
| contact_person | 否 | 联系人 |

示例:
```csv
id,name,latitude,longitude,distance_from_start,elevation,criticality
S001,起点,40.123456,116.789012,0.0,450,critical
S002,CP1,40.128900,116.795000,5.2,520,high
```

### 2. 中继台 JSON

```json
{
  "repeaters": [
    {
      "id": "R001",
      "name": "起点中继台",
      "latitude": 40.123456,
      "longitude": 116.789012,
      "elevation": 480,
      "tx_frequency": 145.525,
      "rx_frequency": 144.925,
      "power": 25,
      "antenna_gain": 5.5,
      "coverage_radius_km": 8.0,
      "height_agl": 20
    }
  ]
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| id | 是 | 中继台唯一标识 |
| name | 是 | 中继台名称 |
| latitude | 是 | 纬度 |
| longitude | 是 | 经度 |
| elevation | 否 | 海拔 |
| tx_frequency | 是 | 发射频率 (MHz, 136-174 VHF频段) |
| rx_frequency | 是 | 接收频率 (MHz) |
| power | 否 | 发射功率 (W, 1-100) |
| antenna_gain | 否 | 天线增益 (dBi) |
| coverage_radius_km | 否 | 覆盖半径 (km) |
| height_agl | 否 | 天线离地高度 (m) |

### 3. 志愿者班次 ICS

使用标准 iCalendar (ICS) 格式，在事件描述中添加关键字段:

- `station:Sxxx` - 值守站点ID (**必需**)
- `name:姓名` - 志愿者姓名
- `id:Vxxx` - 志愿者ID
- `role:角色` - 角色 (operator/team_lead/technician)
- `phone:电话` - 联系电话
- `skills:技能1,技能2` - 技能列表

示例 ICS 事件:
```
BEGIN:VEVENT
UID:shift-001
DTSTART;TZID=Asia/Shanghai:20240515T060000
DTEND;TZID=Asia/Shanghai:20240515T120000
SUMMARY:张三-起点早班
DESCRIPTION:name:张三\nid:V001\nstation:S001\nrole:team_lead\nphone:13800138001\nskills:应急通信,设备维修
END:VEVENT
```

### 4. 设备电池清单 CSV

| 字段 | 必填 | 说明 |
|------|------|------|
| id | 是 | 设备唯一标识 |
| type | 否 | 设备类型: handheld/mobile/base |
| model | 否 | 设备型号 |
| status | 否 | 状态: available/in_use/maintenance |
| battery_capacity_mah | 是 | 电池容量 (mAh) |
| current_charge_percent | 否 | 当前电量百分比 (0-100) |
| power_consumption_ma | 否 | 平均功耗 (mA) |
| standby_current_ma | 否 | 待机电流 (mA) |
| frequencies | 否 | 支持的频率列表 (分号分隔) |
| last_charged | 否 | 最后充电时间 (ISO格式) |

示例:
```csv
id,type,model,status,battery_capacity_mah,current_charge_percent,power_consumption_ma,frequencies
D001,handheld,Baofeng UV-5R,available,1800,100,180,144.525;145.000
D002,handheld,Baofeng UV-5R,available,1800,85,180,144.550;145.000
```

## 使用方法

### 命令行工具

安装后可使用 `freq-coord` 命令:

```bash
freq-coord --help
```

### 可用命令

#### 1. 校验文件

```bash
freq-coord validate \
  --stations examples/supply_stations.csv \
  --repeaters examples/repeaters.json \
  --shifts examples/volunteer_shifts.ics \
  --devices examples/devices.csv
```

#### 2. 执行完整编排流程

```bash
freq-coord run \
  --stations examples/supply_stations.csv \
  --repeaters examples/repeaters.json \
  --shifts examples/volunteer_shifts.ics \
  --devices examples/devices.csv \
  --output ./output \
  --event-name "2024春季山地越野赛" \
  --min-handover 10 \
  --safety-margin 1.0 \
  --format markdown --format csv --format json
```

参数说明:
- `--min-handover`: 最小交接时间（分钟），默认10分钟
- `--safety-margin`: 电池安全余量（小时），默认1小时
- `--format`: 输出格式，可多选 (markdown/csv/json)

#### 3. 仅生成排班表

```bash
freq-coord schedule \
  --stations examples/supply_stations.csv \
  --repeaters examples/repeaters.json \
  --shifts examples/volunteer_shifts.ics \
  --devices examples/devices.csv \
  --output ./output/schedule.csv
```

## 验证流程

### 快速验证

使用示例数据验证系统功能:

```bash
# 1. 进入项目目录
cd /Users/mac/pro/solocoder/pro/xy4231/repo/xy4231

# 2. 安装依赖
pip install -e ".[dev]"

# 3. 校验示例数据
freq-coord validate \
  --stations examples/supply_stations.csv \
  --repeaters examples/repeaters.json \
  --shifts examples/volunteer_shifts.ics \
  --devices examples/devices.csv

# 4. 执行完整编排
freq-coord run \
  --stations examples/supply_stations.csv \
  --repeaters examples/repeaters.json \
  --shifts examples/volunteer_shifts.ics \
  --devices examples/devices.csv \
  --output ./output \
  --event-name "测试赛事"

# 5. 查看输出
ls -la ./output/
```

### 运行测试

```bash
# 运行所有测试
pytest -v

# 运行特定测试
pytest tests/test_parsers.py -v
pytest tests/test_scheduler.py -v
pytest tests/test_risk_engine.py -v

# 带覆盖率测试
pytest --cov=freq_coordinator --cov-report=html
```

## 输出文件说明

### Markdown 通信方案

生成的 `communication_plan_*.md` 包含以下章节:

1. **执行摘要** - 风险概览
2. **资源概览** - 各资源数量统计
3. **中继台配置** - 所有中继台详细信息
4. **值守站点** - 补给站列表及覆盖状态
5. **值守排班表** - 按站点分组的班次详情
6. **频道分配方案** - 各站点分配的频率
7. **风险评估** - 检测到的所有风险及建议
8. **附录** - 术语表、规则说明

### CSV 风险清单

生成的 `risks_*.csv` 包含以下字段:

- 序号、风险ID
- 风险类型 (覆盖缺口/频点冲突/交接空档/电池风险)
- 严重程度 (严重/高/中/低)
- 标题、描述
- 受影响实体
- 位置、时间窗口
- 建议措施、置信度

### JSON 审计包

生成的 `audit_package_*.json` 包含完整的数据流记录:

```json
{
  "metadata": {
    "generated_at": "2024-05-03T...",
    "version": "1.0",
    "event_name": "赛事名称"
  },
  "input_data": {
    "supply_stations": [...],
    "repeater_stations": [...],
    "volunteer_shifts": [...],
    "devices": [...]
  },
  "output_plan": {
    "schedule": [...],
    "channel_plan": {...}
  },
  "risk_assessment": {
    "summary": {...},
    "risks": [...]
  },
  "audit_trail": {
    "checks_performed": [...],
    "rules_applied": {...}
  }
}
```

## 风险检测规则

### 1. 覆盖缺口检测

- 判断站点是否在任何中继台的覆盖半径内
- 考虑站点重要程度，关键站点风险等级更高
- 输出最近中继台距离和部署建议

### 2. 频点冲突检测

- **中继台冲突**: 距离较近的中继台使用相同发射频率
- **邻近站点冲突**: 距离小于1km的站点使用相同直频频率
- **时间重叠冲突**: 时间重叠的班次使用相同频率且距离较近
- 频率间隔小于25kHz视为可能冲突

### 3. 交接间隙检测

- 班次交接间隔小于指定最小值（默认10分钟）
- 班次之间存在超过60秒的空档
- 关键站点风险等级提升

### 4. 电池风险检测

- 估算设备续航时间: `电池容量(mAh) * 当前电量% / 功耗(mA)`
- 比较续航时间与班次时长+安全余量
- 关键站点低电量风险等级提升
- 电量低于80%的关键站点设备发出警告

## 频道分配规则

1. **紧急频道**: 145.000 MHz 所有站点共用（频道1）
2. **中继台频道**: 优先分配中继台发射频率
3. **直频频道**: 无覆盖站点从VHF备用频率池分配
4. **频率间隔**: 相邻站点频率至少间隔25kHz

## 开发指南

### 代码规范

- 使用 Black 格式化代码
- 使用 Ruff 进行 lint 检查
- 类型注解使用 Pydantic

### 添加新的风险检测器

1. 继承 `RiskDetector` 基类
2. 实现 `detect()` 方法
3. 在 `risk_engine/detectors.py` 中注册
4. 添加测试用例

示例:
```python
class MyDetector(RiskDetector):
    RISK_TYPE = "my_risk_type"
    
    def detect(self) -> List[RiskItem]:
        # 检测逻辑
        if has_risk:
            risk = self._create_risk(
                title="风险标题",
                description="详细描述",
                severity="high",
                affected_entities=["entity1"],
                recommendation="处理建议",
            )
            self.risks.append(risk)
        return self.risks
```

## 许可证

本项目仅供内部使用。

## 常见问题

### Q1: 如何修改最小交接时间？

使用 `--min-handover` 参数:
```bash
freq-coord run ... --min-handover 15
```

### Q2: 如何增加电池安全余量？

使用 `--safety-margin` 参数（小时）:
```bash
freq-coord run ... --safety-margin 1.5
```

### Q3: 如何使用自己的数据？

参考 `examples/` 目录下的文件格式，替换为实际数据即可。

### Q4: 系统支持哪些频率范围？

当前版本默认使用 VHF 频段 (136-174 MHz)，可通过修改 `ChannelAssigner.VHF_CHANNELS` 自定义。

### Q5: 如何自定义风险检测器？

参考 `risk_engine/detectors.py` 中的现有检测器实现，继承 `RiskDetector` 基类并实现 `detect()` 方法。
