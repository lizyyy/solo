# 离线工单合并器 (Offline Ticket Merger - OTM)

一个专为外勤维修工程师设计的本地CLI工具，用于合并地下机房等无网络环境下记录的设备巡检、故障照片清单、备件消耗和临时处置记录。

## 问题背景

在地下机房等无网络环境中，多名工程师会各自记录：
- 设备巡检记录
- 故障照片清单
- 备件消耗记录
- 临时处置措施

回办公室后合并时经常出现：
- **同一工单多份**：多名工程师重复记录同一个故障
- **时间线倒序**：最新的记录反而在旧记录之前
- **备件库存被重复扣**：多名工程师各自记录使用同一备件

## 功能特性

- **init** - 初始化本地仓库配置
- **import** - 导入多个工程师的 JSON/CSV 工单包
- **check** - 校验设备编号、照片清单、备件扣减、重复工单和冲突字段
- **merge** - 按规则生成可信工单版本并保留冲突决策
- **audit** - 导出 Markdown/CSV/JSON 审计报告

## 项目结构

```
offline_ticket_merger/
├── __init__.py
├── models/
│   ├── __init__.py
│   └── models.py          # 数据模型定义
├── storage/
│   ├── __init__.py
│   └── storage.py         # 本地存储管理
├── parser/
│   ├── __init__.py
│   └── parser.py          # JSON/CSV 解析
├── merger/
│   ├── __init__.py
│   └── merger.py          # 冲突检测与合并
├── inventory/
│   ├── __init__.py
│   └── inventory.py        # 库存校验
├── reporter/
│   ├── __init__.py
│   └── reporter.py         # 报告生成
└── cli/
    ├── __init__.py
    └── main.py             # CLI 入口
test_data/
├── engineer_zhang.json      # 张三的工单记录
├── engineer_li.json        # 李四的工单记录
├── engineer_wang.json       # 王五的工单记录
├── engineer_tickets.csv     # CSV格式工单
└── inventory.json           # 库存数据
```

## 快速开始

### 安装

```bash
# 克隆项目
cd xy4078

# 安装依赖（推荐使用虚拟环境）
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -e .
```

### 验证安装

```bash
otm --version
otm --help
```

## 完整使用流程

### 1. 初始化仓库

```bash
# 在当前目录初始化
otm init

# 或指定名称和描述
otm init -n "地下机房维修工单" -d "2024年5月机房巡检项目"
```

初始化后会创建 `.otm` 目录结构：

```
.otm/
├── config.json      # 仓库配置
├── inventory.json   # 库存数据
├── engineers.json   # 工程师信息
├── data/           # 数据存储
├── imports/        # 已导入的工单
├── merged/         # 合并结果
└── audits/         # 审计报告
```

### 2. 导入工单文件

项目提供了测试数据在 `test_data/` 目录下，可以用来验证完整流程。

```bash
# 导入多个JSON文件
otm import test_data/engineer_zhang.json test_data/engineer_li.json test_data/engineer_wang.json

# 导入CSV文件
otm import test_data/engineer_tickets.csv

# 或导入整个目录
otm import test_data/
```

**测试数据说明**：

- **engineer_zhang.json** (张三)：
  - WO-2024-001：服务器电源故障（进行中）
  - WO-2024-002：交换机端口故障（已完成）

- **engineer_li.json** (李四)：
  - WO-2024-001：同一服务器，诊断为主板电源接口问题（已完成）← 与张三重复
  - WO-2024-003：存储阵列硬盘告警

- **engineer_wang.json** (王五)：
  - WO-2024-001：同一服务器，最终定位为CPU散热问题（已完成）← 再次重复！
  - WO-2024-004：UPS电池告警

- **库存问题**：
  - 电源模块 (SP-PSU-001) 库存只有 2 个
  - 但三名工程师各记录使用 1 个 → 超领 1 个！

### 3. 检查冲突

```bash
# 基本检查
otm check

# 同时检查库存（使用测试数据中的库存文件）
otm check --inventory -i test_data/inventory.json
```

检查会发现：

1. **重复工单**：WO-2024-001 有 3 份记录
2. **字段冲突**：同一工单的问题描述、解决方案各不相同
3. **时间线问题**：状态从 in_progress → completed → completed
4. **库存超领**：电源模块库存 2 个，但申请了 3 个

### 4. 合并工单

```bash
# 默认使用时间线策略合并
otm merge

# 使用其他策略
otm merge -s last        # 最后记录优先
otm merge -s majority    # 多数票优先
otm merge -s first       # 最早记录优先

# 合并时检查库存
otm merge --inventory -i test_data/inventory.json

# 试运行（不保存结果）
otm merge --dry-run
```

**合并策略说明**：

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| `timeline` (默认) | 按更新时间顺序，最新值优先 | 大多数场景 |
| `last` | 最后一条记录的所有字段优先 | 最后处理的工程师信息最完整 |
| `first` | 最早一条记录的所有字段优先 | 初始诊断最准确 |
| `majority` | 多数票优先 | 多人确认过的信息 |

### 5. 导出审计报告

```bash
# 默认导出 Markdown 格式
otm audit

# 指定格式和输出
otm audit -f markdown
otm audit -f csv
otm audit -f json

# 指定输出路径
otm audit -o my_report.md

# 包含库存信息
otm audit --inventory -i test_data/inventory.json
```

### 6. 查看仓库状态

```bash
otm status
```

## 临时目录完整验证流程

以下是一个完整的验证步骤，可以在任意临时目录执行：

```bash
# 1. 创建临时目录
mkdir -p /tmp/otm_test
cd /tmp/otm_test

# 2. 初始化仓库
otm init -n "测试仓库" -d "验证合并流程"

# 3. 导入测试数据（使用项目中的测试数据）
# 假设项目在 ~/pro/solocoder/pro/xy4078
otm import ~/pro/solocoder/pro/xy4078/test_data/

# 4. 检查冲突
otm check

# 5. 带库存检查
otm check --inventory -i ~/pro/solocoder/pro/xy4078/test_data/inventory.json

# 6. 合并工单（试运行）
otm merge --dry-run

# 7. 正式合并并保存
otm merge --inventory -i ~/pro/solocoder/pro/xy4078/test_data/inventory.json

# 8. 导出报告
otm audit --inventory -i ~/pro/solocoder/pro/xy4078/test_data/inventory.json

# 9. 查看状态
otm status
```

## 数据格式说明

### JSON 格式

```json
{
  "engineer": {
    "id": "ENG001",
    "name": "工程师姓名",
    "employee_id": "E2024001",
    "phone": "13800138000",
    "department": "维修一部"
  },
  "work_orders": [
    {
      "ticket_number": "WO-2024-001",
      "device_id": "DEV-SRV-001",
      "device_name": "设备名称",
      "device_location": "设备位置",
      "status": "in_progress",
      "priority": "high",
      "issue_description": "问题描述",
      "inspection_results": "巡检结果",
      "solution_taken": "解决方案",
      "temporary_measures": "临时措施",
      "photos": [
        {
          "filename": "IMG_001.jpg",
          "photo_type": "fault",
          "description": "照片描述",
          "capture_time": "2024-05-01 10:00:00"
        }
      ],
      "spare_parts": [
        {
          "part_number": "SP-001",
          "part_name": "备件名称",
          "quantity": 1,
          "unit_price": 100.00
        }
      ],
      "start_time": "2024-05-01 09:00:00",
      "end_time": "2024-05-01 11:00:00",
      "created_at": "2024-05-01 09:00:00",
      "updated_at": "2024-05-01 11:00:00"
    }
  ]
}
```

### CSV 格式

```csv
ticket_number,device_id,device_name,device_location,status,priority,engineer_name,issue_description,start_time,end_time
WO-2024-001,DEV-001,设备名称,位置,pending,normal,工程师,问题描述,2024-05-01 09:00:00,
```

## 冲突类型说明

| 冲突类型 | 说明 | 严重程度 |
|----------|------|----------|
| `duplicate_ticket` | 同一工单编号有多份记录 | warning |
| `field_conflict` | 同一字段有不同值 | warning |
| `timeline_conflict` | 时间线顺序异常（如完成后又变为进行中） | error |
| `photo_mismatch` | 同一照片有不同元数据 | warning |
| `spare_part_overconsumption` | 备件申请超过库存 | error |
| `device_not_found` | 设备编号不存在 | error |

## 命令参考

### `otm init`

初始化本地仓库。

**选项**：
- `-n, --name`：仓库名称
- `-d, --description`：仓库描述
- `-p, --path`：仓库路径（默认为当前目录）

### `otm import`

导入工单文件。

**参数**：
- `files`：一个或多个文件/目录路径

**选项**：
- `-r, --recursive`：递归导入目录
- `-p, --path`：指定仓库路径

### `otm check`

检查冲突和验证。

**选项**：
- `-p, --path`：指定仓库路径
- `--inventory`：同时检查库存
- `-i, --inventory-file`：库存文件路径

### `otm merge`

合并工单。

**选项**：
- `-p, --path`：指定仓库路径
- `-s, --strategy`：合并策略 (first, last, majority, timeline, manual)
- `--inventory`：进行库存校验
- `-i, --inventory-file`：库存文件路径
- `--dry-run`：试运行，不保存结果

### `otm audit`

导出审计报告。

**选项**：
- `-p, --path`：指定仓库路径
- `-f, --format`：输出格式 (markdown, csv, json)
- `-o, --output`：输出文件路径
- `--inventory`：包含库存信息
- `-i, --inventory-file`：库存文件路径

### `otm status`

显示仓库状态。

**选项**：
- `-p, --path`：指定仓库路径

## 依赖

- Python 3.9+
- click (CLI 框架)
- pydantic (数据验证)
- python-dateutil (日期解析)
- tabulate (表格输出)
- rich (终端美化)

## 许可证

MIT License
