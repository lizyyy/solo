# SMT Workshop CLI

SMT贴片回流生产管理工具 - 小型硬件工作室的本地命令行质量管理工具。

## 功能概述

每次贴片回流前后，导入以下数据进行管理和质量检查：

- **BOM（物料清单）**: 元件清单，包括位号、型号、封装、数量等
- **贴片坐标 CSV**: 贴片机使用的坐标文件
- **回流炉温曲线 CSV**: 回流炉的温度曲线记录
- **钢网/锡膏批次 JSON**: 钢网和锡膏的批次信息
- **AOI缺陷表**: 自动光学检测的缺陷报告

核心功能：
- 建立本地数据仓库
- 自动去重（基于文件哈希）
- 风险检查：
  - 元件封装不匹配
  - 锡膏过期/回温超时
  - 炉温峰值/浸泡区偏离
  - 同一板号重复返修

## 快速开始

### 环境要求
- Python 3.7+
- 无额外依赖（仅使用标准库）

### 安装

```bash
# 克隆或下载项目
cd xy4410

# 添加执行权限
chmod +x smt_workshop_cli.py

# 建议创建别名
alias smt-workshop='python /path/to/smt_workshop_cli.py'
```

### 工作流程

```bash
# 1. 初始化工作目录（在当前目录创建 .smt-workshop 文件夹）
python smt_workshop_cli.py init

# 2. 导入生产数据
python smt_workshop_cli.py import examples/bom_example.csv
python smt_workshop_cli.py import examples/pick_place_example.csv
python smt_workshop_cli.py import examples/oven_profile_example.csv
python smt_workshop_cli.py import examples/paste_stencil_example.json
python smt_workshop_cli.py import examples/aoi_example.csv

# 3. 检查生产风险
python smt_workshop_cli.py check

# 4. 人工复核问题
python smt_workshop_cli.py review list
python smt_workshop_cli.py review confirm ISSUE_ID -r "人工复核通过，可接受"

# 5. 导出放行报告
python smt_workshop_cli.py export --all
```

## 命令详解

### init - 初始化工作目录

```bash
python smt_workshop_cli.py init [--force]
```

选项：
- `--force`: 强制重新初始化，覆盖现有数据

初始化后当前目录创建 `.smt-workshop/` 结构：
```
.smt-workshop/
├── config.json          # 配置文件
├── boms/                # BOM数据
├── pick_places/         # 贴片坐标
├── oven_profiles/       # 炉温曲线
├── solder_pastes/       # 锡膏批次
├── stencils/            # 钢网批次
├── aoi_reports/         # AOI报告
├── reworks/             # 返修记录
├── issues/              # 问题记录
├── exports/             # 导出的报告
└── imports/             # 导入记录（用于去重）
```

### import - 导入数据

```bash
python smt_workshop_cli.py import <file_path> [--type TYPE] [--board BOARD] [--revision REV]
```

选项：
- `--type, -t`: 指定文件类型（自动检测失败时使用）
  - `bom`: BOM清单
  - `pick_place`: 贴片坐标
  - `oven_profile`: 炉温曲线
  - `paste_stencil`: 锡膏/钢网批次
  - `aoi`: AOI缺陷报告
  - `rework`: 返修记录
- `--board, -b`: 关联板号
- `--revision, -r`: 关联版本号

**支持的文件格式：**

**BOM CSV 格式：**
```csv
reference,part_number,description,quantity,package,value,part_type
R1,RES-0402-1K,电阻 1KΩ,2,0402,1KΩ,resistor
```

**贴片坐标 CSV 格式：**
```csv
reference,package,value,x_position,y_position,rotation,side,part_number
R1,0402,1KΩ,10.5,25.3,0,TOP,RES-0402-1K
```

**炉温曲线 CSV 格式：**
```csv
time_seconds,temperature_top,temperature_bottom
0,25.0,25.0
10,45.5,42.3
```

**锡膏/钢网 JSON 格式：**
```json
{
  "solder_pastes": [
    {
      "lot_number": "SP2025-0042",
      "solder_paste_type": "SAC305",
      "manufacture_date": "2025-03-15",
      "expiry_date": "2026-03-14",
      "status": "active"
    }
  ],
  "stencils": [
    {
      "stencil_id": "STN-001",
      "board_number": "DEV-2025-001",
      "use_count": 125,
      "status": "active"
    }
  ]
}
```

**AOI缺陷 CSV 格式：**
```csv
reference,defect_type,location_x,location_y,confidence,rework_needed,false_alarm,notes
R1,Missing,10.5,25.3,95.2,True,False,电阻缺失
```

### check - 检查生产风险

```bash
python smt_workshop_cli.py check [--board BOARD] [--all] [--no-save]
```

选项：
- `--board, -b`: 只检查指定板号
- `--all, -a`: 显示所有检查项（包括已通过的）
- `--no-save`: 不保存检查结果到问题库

**检查项说明：**

1. **封装不匹配检查**
   - 对比 BOM 和贴片坐标中的封装信息
   - 支持常见封装变体匹配（如 0402 = SM0402 = RES0402）

2. **锡膏状态检查**
   - 有效期检查
   - 回温后可用时间检查（默认24小时）

3. **炉温曲线检查**
   - 峰值温度检查（默认范围：240-260°C）
   - 浸泡区时间检查（150-180°C区间，默认范围：60-120秒）

4. **重复返修检查**
   - 统计同一序列号的返修次数
   - 超过限制（默认3次）报警

### review - 人工复核问题

```bash
# 列出未确认的问题
python smt_workshop_cli.py review list [--all]

# 确认问题
python smt_workshop_cli.py review confirm <issue_id> --remark "备注" [--by "操作员"]

# 取消确认（重新打开问题）
python smt_workshop_cli.py review unconfirm <issue_id> [--remark "原因"]
```

### export - 导出报告

```bash
python smt_workshop_cli.py export [--date YYYY-MM-DD] [--markdown] [--json] [--all] [--board BOARD] [--batch BATCH]
```

选项：
- `--date, -d`: 指定报告日期（默认今天）
- `--markdown, -m`: 导出 Markdown 放行报告
- `--json, -j`: 导出 JSON 审计报告
- `--all, -a`: 导出所有格式
- `--board, -b`: 只导出指定板号
- `--batch`: 只导出指定批次

**导出位置：** `.smt-workshop/exports/`

## 配置说明

配置文件位于 `.smt-workshop/config.json`：

```json
{
  "oven_profile": {
    "peak_temp_min": 240.0,
    "peak_temp_max": 260.0,
    "soak_time_min_sec": 60,
    "soak_time_max_sec": 120,
    "soak_temp_min": 150.0,
    "soak_temp_max": 180.0
  },
  "solder_paste": {
    "max_thaw_hours": 24,
    "max_rework_count": 3
  }
}
```

## 示例数据

`examples/` 目录包含示例数据文件：

- `bom_example.csv` - 示例 BOM 清单
- `pick_place_example.csv` - 示例贴片坐标
- `oven_profile_example.csv` - 示例炉温曲线（峰值258°C，符合标准）
- `paste_stencil_example.json` - 示例锡膏/钢网批次
- `aoi_example.csv` - 示例 AOI 缺陷报告

## 项目结构

```
xy4410/
├── smt_workshop_cli.py    # 主入口
├── core/
│   ├── __init__.py
│   ├── models.py          # 数据模型定义
│   └── storage.py         # 数据存储和去重
├── commands/
│   ├── __init__.py
│   ├── init.py            # init命令
│   ├── import_.py         # import命令
│   ├── check.py           # check命令
│   ├── review.py          # review命令
│   └── export.py          # export命令
├── examples/              # 示例数据
└── README.md
```

## 常见问题

**Q: 如何避免重复导入同一文件？**
A: 工具会计算文件哈希值，自动检测已导入的文件。尝试重复导入时会提示跳过。

**Q: 封装匹配是如何工作的？**
A: 工具内置了常见封装变体映射，例如 `0402` 会匹配 `SM0402`、`RES0402`、`CAP0402` 等。

**Q: 数据存储在哪里？**
A: 所有数据存储在当前目录下的 `.smt-workshop/` 文件夹中，便于版本控制和备份。

## 许可证

仅供内部使用。
