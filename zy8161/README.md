# Evacuation Review Tool - 消防演练疏散复盘工具

一个本地 Python CLI 工具，用于物业安保在消防演练后复盘疏散过程。

## 功能特性

- **多源数据解析**：支持 `floors.yaml`、`badges.csv`、`events.jsonl`、`checkpoints.csv` 四种格式
- **时间线重建**：按楼层和人员重建完整疏散时间线
- **智能问题检测**：
  - 🔴 未到集合点检测
  - 🔴 严重逆行检测（返回楼上危险区域）
  - 🟡 一般逆行检测（上行）
  - 🟡 重复刷卡检测
  - 🟡 摄像头点位缺失检测
- **风险提示**：
  - 跨午夜事件检测和警告
  - 人员台账缺字段警告
- **报告输出**：
  - `issues.csv`：结构化问题列表
  - `evacuation_report.md`：完整复盘报告

## 安装

### 依赖

```bash
pip install pyyaml
```

或使用项目内安装：

```bash
cd zy8161
pip install -e .
```

## 快速开始

### 使用内置样本数据演示

```bash
python -m evacreview --sample
```

默认输出到 `./output/` 目录。

### 自定义报告标题

```bash
python -m evacreview --sample --title "2026年5月季度消防演练复盘"
```

### 查看样本数据位置

```bash
python -m evacreview --list-sample
```

### 使用自定义数据

```bash
python -m evacreview \
  --floors ./data/floors.yaml \
  --badges ./data/badges.csv \
  --events ./data/events.jsonl \
  --checkpoints ./data/checkpoints.csv \
  --output ./my_report
```

## 输入文件格式

### 1. floors.yaml - 楼层配置

```yaml
floors:
  - number: 1
    name: 1F 大堂
    exits:
      - "正门出口"
    stairwells:
      - "东侧楼梯"
      - "西侧楼梯"
    cameras:
      - "CAM-1F-01"
      - "CAM-1F-02"
```

### 2. badges.csv - 人员台账

| 字段 | 必需 | 说明 | 示例 |
|------|------|------|------|
| badge_id | ✅ | 工牌编号 | E001 |
| name | ✅ | 姓名 | 张小明 |
| department | ✅ | 部门 | 研发部 |
| role | ✅ | 职位 | 工程师 |
| floor | ✅ | 所在楼层 | 3 |
| phone | ❌ | 联系电话 | 13800138001 |
| email | ❌ | 邮箱 | zhang.xm@company.com |

**注意**：必需字段缺失时会输出警告但不中断分析。

### 3. events.jsonl - 事件日志

每行一个 JSON 对象：

```json
{
  "timestamp": "2026-05-03 14:30:00",
  "badge_id": "E001",
  "location": "CAM-3F-01 3F 研发中心入口",
  "event_type": "camera",
  "direction": "enter",
  "details": {
    "floor": 3,
    "is_meeting_point": false
  }
}
```

支持的时间格式：
- `2026-05-03 14:30:00`
- `2026-05-03T14:30:00`
- `05/03/2026 14:30:00`
- `03/05/2026 14:30:00`

### 4. checkpoints.csv - 检查点配置

| 字段 | 说明 |
|------|------|
| name | 检查点名称 |
| location | 位置描述 |
| floor | 所在楼层（集合点填 0） |
| type | 类型: exit/stairwell/meeting_point |
| is_exit | 是否为出口 (TRUE/FALSE) |
| is_meeting_point | 是否为集合点 (TRUE/FALSE) |

## 输出文件

### issues.csv - 问题列表

| 列名 | 说明 |
|------|------|
| severity | 严重程度: critical/warning/info |
| issue_type | 问题类型 |
| badge_id | 工牌编号 |
| name | 姓名 |
| floor | 楼层 |
| location | 位置 |
| timestamp | 时间 |
| description | 描述 |

### evacuation_report.md - 复盘报告

包含以下章节：
1. **演练概览**：时间、人员统计、集合点到达率
2. **各楼层统计**：每层事件数和涉及人数
3. **数据警告**：字段缺失、跨午夜等
4. **问题汇总**：按严重程度和类型统计
5. **详细问题列表**：逐条问题详情
6. **人员时间线示例**：前5名人员的详细时间线
7. **配置信息**：楼层、检查点、集合点列表

## 检测规则说明

### 1. 未到集合点检测 (MissingMeetingPointRule)

- **判定条件**：人员台账中的 badge_id 在事件中未出现过，或所有事件中从未到达任何 `is_meeting_point=true` 的检查点
- **严重程度**：CRITICAL

### 2. 逆行检测 (RetrogradeRule)

- **一般逆行 (WARNING)**：从低楼层往高楼层移动（超过 1F）
- **严重逆行 (CRITICAL)**：从 1F 往楼上走（疑似返回危险区域取物）

### 3. 重复刷卡检测 (DuplicateSwipeRule)

- **判定条件**：同一工牌在 5 秒内连续两次刷卡
- **严重程度**：WARNING
- **说明**：可能是门禁设备问题或人员操作失误

### 4. 摄像头点位缺失检测 (CameraGapRule)

- **判定条件**：
  - 楼层配置中 `cameras` 列表为空
  - 人员从 A 层到 B 层，中间经过的楼层无摄像头配置，且时间间隔超过 60 秒
- **严重程度**：CRITICAL（无配置）/ WARNING（路径中间层缺失）

## 特殊情况处理

### 跨午夜事件

当事件时间跨越两天（从第一天的 23:xx 到第二天的 00:xx），工具会：
1. 在 stderr 输出黄色警告
2. 在报告的「数据警告」章节记录
3. 正常继续分析（不会中断）

### 人员台账缺字段

当 `badges.csv` 中必需字段（badge_id, name, department, role, floor）有缺失时：
1. 在 stderr 输出黄色警告，指明第几行、哪个字段缺失
2. 在报告的「数据警告」章节记录
3. 正常继续分析，但缺失信息的行可能影响相关检测

### 可选字段缺失

phone、email 等可选字段缺失不会触发任何警告。

## 命令行参数

```
usage: python -m evacreview [-h] [--sample] [--floors FLOORS] [--badges BADGES]
                             [--events EVENTS] [--checkpoints CHECKPOINTS]
                             [--output OUTPUT] [--title TITLE] [--list-sample]

消防演练疏散复盘工具

optional arguments:
  -h, --help            show this help message and exit
  --sample              使用内置样本数据进行演示分析
  --floors FLOORS       楼层配置文件路径 (floors.yaml)
  --badges BADGES       人员工牌台账路径 (badges.csv)
  --events EVENTS       事件日志路径 (events.jsonl)
  --checkpoints CHECKPOINTS
                        检查点配置路径 (checkpoints.csv)
  --output OUTPUT, -o OUTPUT
                        输出目录 (默认: ./output)
  --title TITLE, -t TITLE
                        报告标题
  --list-sample         列出内置样本文件路径
```

## 退出码

| 码值 | 含义 |
|------|------|
| 0 | 成功且无严重问题 |
| 1 | 成功但检测到 CRITICAL 级别问题 |
| 2 | 参数错误 |

## 项目结构

```
zy8161/
├── evacreview/
│   ├── __init__.py     # 版本信息
│   ├── parsers.py      # 数据解析模块
│   ├── rules.py        # 规则引擎模块
│   ├── exporters.py    # 报告导出模块
│   └── cli.py          # CLI 入口
├── samples/
│   ├── floors.yaml
│   ├── badges.csv      # 包含部分字段缺失的测试数据
│   ├── events.jsonl    # 包含演示问题的事件
│   └── checkpoints.csv
└── README.md
```

## Sample 数据中包含的演示问题

内置样本数据设计了以下问题用于演示工具功能：

1. **E002 李华** - 严重逆行（从 1F 返回 2F）+ 重复刷卡
2. **E003 王芳** - 未到集合点（只出了后门，未去集合点签到）
3. **E009 钱伟** - 未到集合点（被困在 3F，没有移动记录）
4. **E002** - 重复刷卡（正门出口连续刷两次）
5. **badges.csv** - 部分人员 phone/email 缺失（触发数据警告）

运行 `python -m evacreview --sample` 查看完整检测结果。
