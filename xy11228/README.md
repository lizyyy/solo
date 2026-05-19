# 换电运营故障分类系统

自动分类换电站柜门打不开、扫码失败、空仓误报等故障，减少人工分类工作量。

## 功能特性

- 📥 **数据导入**: 支持设备事件(JSON)和客服工单(CSV)导入
- 🤖 **自动分类**: 智能识别柜门打不开、扫码失败、空仓误报等故障类型
- ✅ **数据校验**: 坏记录不直接丢弃，保留原始数据、失败原因和修改建议
- 🔍 **灵活查询**: 支持按负责人、时间、状态、故障类型等多维度筛选
- 📊 **报告导出**: 导出CSV或Excel格式报告，与查询结果一致
- 🔄 **状态管理**: 支持待审核、已确认、已解决、已驳回等状态流转

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 一键运行完整流程

使用示例数据一键执行导入、分类、导出：

```bash
python cli.py run --json examples/device_events.json --csv examples/customer_tickets.csv
```

### 3. 分步操作指南

#### 步骤1: 导入数据

导入设备事件JSON：
```bash
python cli.py import --json examples/device_events.json
```

导入客服工单CSV：
```bash
python cli.py import --csv examples/customer_tickets.csv
```

#### 步骤2: 执行自动分类

```bash
python cli.py classify
```

#### 步骤3: 复核（查询和状态更新）

查看所有故障：
```bash
python cli.py query
```

按条件筛选：
```bash
# 按负责人
python cli.py query --assignee 张工

# 按故障类型
python cli.py query --type door_failure

# 按状态
python cli.py query --status pending_review

# 按日期范围
python cli.py query --start-date 2024-01-15 --end-date 2024-01-16
```

更新故障状态：
```bash
# 确认故障
python cli.py status <fault_id> confirm --notes "已核实，确认为柜门故障"

# 解决故障
python cli.py status <fault_id> resolve --notes "已修复柜门电机"

# 驳回（误报）
python cli.py status <fault_id> dismiss --notes "误报，用户操作问题"
```

#### 步骤4: 导出报告

导出CSV格式：
```bash
python cli.py export --format csv
```

导出Excel格式（包含故障清单、异常数据、统计汇总三个工作表）：
```bash
python cli.py export --format xlsx
```

### 4. 查看统计和坏记录

查看统计汇总：
```bash
python cli.py summary
```

查看坏记录：
```bash
python cli.py bad-records
```

## 故障类型说明

| 故障类型 | 说明 | 关键字 |
|---------|------|-------|
| door_failure | 柜门打不开 | door, 柜门, 门, 打不开, 解锁, 开门 |
| scan_failure | 扫码失败 | scan, 扫码, 二维码, qr, 识别失败 |
| empty_bay_false_alarm | 空仓误报 | empty, 空仓, 无电池 |
| battery_issue | 电池异常 | battery, 电池, 充电, 电压, 温度 |
| network_issue | 网络异常 | network, 网络, 连接, timeout, 超时 |
| other | 其他 | - |

## 项目结构

```
battery-swap-system/
├── app/
│   ├── models/          # 数据模型
│   │   ├── device_event.py
│   │   ├── customer_service.py
│   │   ├── fault_classification.py
│   │   └── bad_record.py
│   ├── services/        # 业务服务
│   │   ├── importer.py     # 数据导入
│   │   ├── classifier.py   # 故障分类
│   │   ├── query.py        # 查询筛选
│   │   └── reporter.py     # 报告导出
│   └── utils/           # 工具模块
│       └── storage.py      # 数据存储
├── examples/            # 示例数据
│   ├── device_events.json
│   └── customer_tickets.csv
├── data/                # 数据目录（运行时生成）
│   ├── device_events/   # 设备事件存储
│   ├── customer_tickets/ # 工单存储
│   ├── faults/          # 故障记录
│   ├── bad_records/     # 坏记录
│   └── output/          # 导出报告
├── cli.py               # 命令行入口
├── requirements.txt     # 依赖列表
└── README.md           # 本文档
```

## 命令参考

| 命令 | 说明 |
|-----|------|
| `import --json <file>` | 导入设备事件JSON |
| `import --csv <file>` | 导入客服工单CSV |
| `classify` | 执行故障分类 |
| `query [options]` | 查询故障 |
| `status <id> <action>` | 更新故障状态 |
| `export --format <csv/xlsx>` | 导出报告 |
| `summary` | 查看统计汇总 |
| `bad-records` | 查看坏记录 |
| `run --json <file> --csv <file>` | 一键执行完整流程 |

## 数据格式说明

### 设备事件JSON格式

```json
[
  {
    "event_id": "evt_001",
    "device_id": "dev_001",
    "station_id": "st_001",
    "event_type": "door_open_failure",
    "event_time": "2024-01-15 08:30:00",
    "bay_number": 5,
    "battery_id": "bat_123",
    "user_id": "user_456",
    "details": {
      "error_code": "E001",
      "message": "柜门电机超时"
    }
  }
]
```

### 客服工单CSV格式

| 列名 | 说明 | 必填 |
|-----|------|-----|
| ticket_id | 工单ID | 是 |
| station_id | 换电站ID | 是 |
| user_id | 用户ID | 否 |
| user_phone | 用户电话 | 否 |
| title | 工单标题 | 是 |
| description | 工单描述 | 是 |
| create_time | 创建时间 | 是 |
| status | 状态 | 否 |
| assignee | 负责人 | 否 |
| priority | 优先级 | 否 |
| tags | 标签 | 否 |

## 常见问题

**Q: 坏记录如何处理？**
A: 导入失败的记录会保存到 `data/bad_records/` 目录下，包含原始数据、错误信息和修改建议，不会直接丢弃。

**Q: 分类置信度是如何计算的？**
A: 根据关键词匹配数量和相似度计算，置信度 >= 0.7 的会自动进入"待审核"状态，否则进入"待分类"状态需要人工处理。

**Q: 如何添加新的故障类型？**
A: 在 `app/services/classifier.py` 中添加新的匹配规则和关键词即可。
