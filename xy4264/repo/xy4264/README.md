# 计时芯片赛前核验员

越野跑赛事计时组专用本地 CLI 工具，用于赛前核查芯片绑定、波次分配、检查点读取等问题，避免赛后成绩争议。

## 功能特性

- **import** - 导入多源 CSV 文件（报名表、芯片绑定表、波次表、检查点配置、设备日志、退赛名单）
- **link** - 构建选手-芯片-波次-检查点完整计时链
- **check** - 运行规则校验：
  - 🔴 重复芯片绑定（同一芯片绑定多个号码布）
  - 🔴 缺失计时点（完赛选手缺少检查点记录）
  - 🔴 异常速度（区间速度超过物理极限）
  - 🔴 退赛后仍完赛（DNF名单选手有终点记录）
  - 🔴 未注册芯片（日志中出现未绑定的芯片）
  - 🔴 抢跑（早于波次发枪时间）
  - 🟡 波次分配冲突（选手未分配波次、波次人数超限）
  - 🟡 双芯片警告（同一号码布绑定多个芯片，可能是正常配置）
  - 🟡 波次发错（实际出发时间与分配波次不符）
- **review** - 保存人工裁决记录（确认违规、忽略误报、待核实、人工更正）
- **report** - 导出 Markdown、CSV、JSON 三种格式的审计包

## 安装

### 环境要求

- Python 3.10+

### 安装方式

```bash
# 克隆或下载项目后，进入项目目录
cd race-timing-validator

# 以可编辑模式安装（开发时推荐）
pip install -e .

# 或正常安装
pip install .
```

安装完成后，命令行工具 `race-checker` 即可使用。

## 快速开始 - 临时目录验证流程

项目包含示例数据，可以直接用于验证工具功能。

### 1. 查看示例数据

```bash
ls examples/
```

示例数据包含以下故意设置的违规场景：

| 文件 | 内容 | 模拟问题 |
|------|------|----------|
| participants.csv | 10名选手信息 | 选手1010未分配波次 |
| chip_bindings.csv | 芯片绑定表 | TAG001同时绑定1001和1002（重复绑定）；1003绑定2个芯片（双芯片）；TAG999绑定不存在的选手 |
| waves.csv | 3个起跑波次 | - |
| checkpoints.csv | 起点+4个CP+终点 | - |
| checkpoint_logs.csv | 设备读取日志 | 选手1003跳过CP3；选手1004速度异常（300km/h）+抢跑；TAG998未注册芯片 |
| dnf.csv | 退赛名单 | 选手1004在DNF名单但有终点记录 |

### 2. 导入示例数据

```bash
cd examples/

race-checker import \
  --participants participants.csv \
  --chips chip_bindings.csv \
  --waves waves.csv \
  --checkpoints checkpoints.csv \
  --logs checkpoint_logs.csv \
  --dnf dnf.csv \
  --race-name "2024越野挑战赛测试数据"
```

### 3. 查看工作区状态

```bash
race-checker status
```

### 4. 构建计时链

```bash
race-checker link
```

### 5. 运行规则校验

```bash
race-checker check --details
```

预期输出将包含以下违规：

- **重复芯片绑定** - TAG001 绑定到 1001 和 1002
- **双芯片警告** - 1003 绑定 TAG003 和 TAG003A
- **波次冲突** - 1010 未分配波次
- **缺失检查点** - 1003 完赛但缺少 CP3 记录
- **异常速度** - 1004 速度远超阈值
- **抢跑** - 1004 早于波次发枪时间
- **退赛后仍完赛** - 1004 在 DNF 名单但有终点记录
- **未注册芯片** - TAG998 出现在日志中

### 6. 列出违规记录

```bash
# 列出所有违规
race-checker list

# 仅列出严重违规
race-checker list --level critical

# 仅列出未复核的
race-checker list --unreviewed
```

### 7. 人工复核

```bash
# 查看违规ID后，进行复核
race-checker review VXXXXX --resolution dismiss --reviewer "张三" --notes "双芯片配置，正常"

# 裁决类型:
# - confirm: 确认违规
# - dismiss: 忽略/误报
# - pending: 待进一步核实
# - override: 人工更正
```

### 8. 导出审计报告

```bash
# 导出所有格式
race-checker report -o ./reports

# 仅导出 Markdown
race-checker report -o ./reports -f markdown

# 自定义文件名前缀
race-checker report -o ./reports -p "2024越野挑战赛"
```

## 命令详解

### import - 导入数据

```bash
race-checker import [OPTIONS]

选项:
  -p, --participants PATH   选手报名表 CSV
  -c, --chips PATH          芯片绑定表 CSV
  -w, --waves PATH          起跑波次表 CSV
  -cp, --checkpoints PATH   检查点配置 CSV
  -l, --logs PATH           设备日志 CSV
  -d, --dnf PATH            退赛名单 CSV
  -n, --race-name TEXT      赛事名称
  -w, --workspace PATH      工作区目录 (默认: ./.race-checker)
```

**注意**：可以只导入部分文件，后续通过多次 `import` 补充或覆盖。

### link - 构建计时链

```bash
race-checker link [OPTIONS]

选项:
  -w, --workspace PATH      工作区目录
```

将设备日志与选手、芯片、波次、检查点关联，生成分段成绩记录。

### check - 运行规则校验

```bash
race-checker check [OPTIONS]

选项:
  --max-speed FLOAT         最大允许速度 (km/h) [默认: 25.0]
  --grace-seconds INTEGER   抢跑宽限时间 (秒) [默认: 30]
  --wave-gap INTEGER        波次间隔判定阈值 (分钟) [默认: 5]
  -d, --details             显示详细违规信息
  -w, --workspace PATH      工作区目录
```

**配置说明**：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| max-speed | 25.0 km/h | 精英选手极限配速约 2:30/km = 24 km/h，设置 25 作为阈值 |
| grace-seconds | 30 | 允许的抢跑宽限期，RFID读取可能有误差 |
| wave-gap | 5 | 判断站错波次的时间差阈值 |

### list - 列出违规记录

```bash
race-checker list [OPTIONS]

选项:
  -l, --level [all|critical|warning|info]  按级别过滤 [默认: all]
  -u, --unreviewed                         仅显示未复核的
  -w, --workspace PATH                      工作区目录
```

### review - 人工复核

```bash
race-checker review [OPTIONS] VIOLATION_ID

参数:
  VIOLATION_ID              违规记录ID (如 VABC1234)

选项:
  -r, --resolution [confirm|dismiss|pending|override]  裁决类型 [必需]
  -a, --reviewer TEXT       复核人姓名
  -n, --notes TEXT          复核备注
  -w, --workspace PATH      工作区目录
```

**裁决类型**：

| 类型 | 说明 |
|------|------|
| confirm | 确认违规，计入统计 |
| dismiss | 忽略/误报，不计入最终统计 |
| pending | 待进一步核实，标记后可后续处理 |
| override | 人工更正，用于修正数据 |

### report - 导出报告

```bash
race-checker report [OPTIONS]

选项:
  -o, --output PATH         输出目录 [默认: ./reports]
  -f, --format [all|markdown|csv|json]  输出格式 [默认: all]
  -p, --prefix TEXT         文件名前缀 [默认: race-audit]
  -w, --workspace PATH      工作区目录
```

**输出格式说明**：

| 格式 | 内容 |
|------|------|
| Markdown | 单文件，包含概览、违规详情、检查点配置、波次配置，适合阅读和分享 |
| CSV | 多文件目录：violations.csv, splits.csv, participants.csv, reviews.csv，适合导入Excel |
| JSON | 单文件，完整结构化数据，适合程序处理 |

### status - 查看状态

```bash
race-checker status [OPTIONS]

选项:
  -w, --workspace PATH      工作区目录
```

显示当前工作区的数据加载状态、选手数、芯片数、违规数、复核数等信息。

## CSV 文件格式

### 1. 选手报名表 (participants.csv)

必需列：`bib_number` 或 `bib` 或 `号码布`

支持的列名变体：

| 数据 | 支持的列名 |
|------|------------|
| 号码布 | bib_number, bib, 号码布, 参赛号 |
| 姓名 | name, 姓名, 选手名 |
| 性别 | gender, sex, 性别 |
| 年龄 | age, 年龄 |
| 组别 | category, group, 组别, 参赛组别 |
| 电话 | phone, mobile, 电话, 手机 |
| 紧急联系人 | emergency_contact, emergency, 紧急联系人 |
| 波次 | wave_id, wave, 波次, 起跑波次 |

示例：
```csv
bib_number,name,gender,age,category,wave_id
1001,张三,M,35,50公里组,W1
1002,李四,M,28,50公里组,W1
```

### 2. 芯片绑定表 (chip_bindings.csv)

必需列：`chip_id` (或 `chip`, `rfid`, `tag`, `芯片号`, `芯片ID`) 和 `bib_number` (或 `bib`, `号码布`, `参赛号`)

支持的列名变体：

| 数据 | 支持的列名 |
|------|------------|
| 芯片ID | chip_id, chip, rfid, tag, 芯片号, 芯片ID |
| 号码布 | bib_number, bib, 号码布, 参赛号 |
| 绑定时间 | bind_time, time, 绑定时间 |
| 设备ID | device_id, device, 设备ID |

### 3. 波次表 (waves.csv)

必需列：`start_time` (或 `time`, `起跑时间`, `发枪时间`)

支持的列名变体：

| 数据 | 支持的列名 |
|------|------------|
| 波次ID | wave_id, wave, 波次ID |
| 波次名称 | wave_name, name, 波次名称 |
| 起跑时间 | start_time, time, 起跑时间, 发枪时间 |
| 最大人数 | max_participants, max, 最大人数 |

波次名称支持：`精英`, `ELITE`, `A`, `B`, `C`, `D`

### 4. 检查点配置 (checkpoints.csv)

必需列：`name` (或 `checkpoint_name`, `cp_name`, `检查点名称`) 和 `distance_from_start` (或 `distance`, `km`, `距离起点`, `距离`)

支持的列名变体：

| 数据 | 支持的列名 |
|------|------------|
| 检查点ID | checkpoint_id, cp_id, id, 检查点ID |
| 名称 | name, checkpoint_name, cp_name, 检查点名称 |
| 类型 | type, cp_type, checkpoint_type, 类型 |
| 距离 | distance_from_start, distance, km, 距离起点, 距离 |
| 顺序 | order, sequence, 顺序, 序号 |

检查点类型：`START`, `CP`, `FINISH`

### 5. 设备日志 (checkpoint_logs.csv)

必需列：`chip_id`, `checkpoint_id`, `read_time`

支持的列名变体：

| 数据 | 支持的列名 |
|------|------------|
| 日志ID | log_id, id, 日志ID |
| 芯片ID | chip_id, chip, tag, 芯片ID, 芯片号 |
| 检查点ID | checkpoint_id, cp_id, checkpoint, 检查点ID |
| 读取时间 | read_time, time, timestamp, 读取时间, 时间 |
| 设备ID | device_id, device, reader, 设备ID, 读取设备 |
| 信号强度 | signal_strength, rssi, signal, 信号强度 |
| 天线端口 | antenna_port, antenna, port, 天线端口 |

### 6. 退赛名单 (dnf.csv)

必需列：`bib_number` (或 `bib`, `号码布`, `参赛号`)

支持的列名变体：

| 数据 | 支持的列名 |
|------|------------|
| 号码布 | bib_number, bib, 号码布, 参赛号 |
| 退赛时间 | dnf_time, time, 退赛时间 |
| 最后检查点 | last_checkpoint, last_cp, 最后检查点, 退赛点 |
| 原因 | reason, 退赛原因, 原因 |
| 上报人 | reported_by, reporter, 上报人 |

## 时间格式

所有时间字段支持以下格式：

- `2024-05-01 06:00:00` - 完整时间（推荐）
- `06:00:00` - 仅时间

## 工作区机制

工具使用工作区来存储会话数据，默认路径为 `./.race-checker`。

工作区包含：

| 文件 | 内容 |
|------|------|
| config.json | 工作区配置 |
| race_data.pkl | 序列化的赛事数据 |
| splits.pkl | 序列化的分段记录 |
| reviews.json | 人工复核记录（JSON格式，可编辑） |

可以通过 `-w` 选项指定不同的工作区，用于处理不同赛事：

```bash
# 处理赛事A
race-checker -w ./races/2024-beijing import ...

# 处理赛事B
race-checker -w ./races/2024-shanghai import ...
```

## 开发指南

### 运行测试

```bash
pip install pytest pytest-cov
pytest -v
```

### 代码结构

```
src/race_timing_validator/
├── __init__.py      # 包初始化
├── models.py        # 数据模型
├── parsers.py       # CSV解析器
├── rules.py         # 规则引擎
├── review_store.py  # 复核存储
├── reporter.py      # 报告生成
└── cli.py           # CLI入口

tests/
├── __init__.py
├── test_models.py   # 模型测试
└── test_rules.py    # 规则测试

examples/            # 示例数据
```

## 规则详情

### 🔴 严重违规 (CRITICAL)

| 规则 | 说明 | 检测逻辑 |
|------|------|----------|
| 重复芯片绑定 | 同一芯片绑定多个号码布 | chip_to_bibs 映射中同一芯片对应多个唯一号码布 |
| 未注册芯片 | 日志中出现未绑定的芯片 | logs 中的 chip_id 不在 chip_bindings 中 |
| 缺失计时点 | 完赛选手缺少检查点 | 有终点记录但缺少起点或中间检查点 |
| 异常速度 | 区间速度超过物理极限 | distance_km / time_hours > 25 km/h |
| 退赛后仍完赛 | DNF选手有终点记录 | bib_number 在 dnf_records 中且有 FINISH 类型检查点记录 |
| 抢跑 | 早于波次发枪时间60秒以上 | start_time < wave.start_time - 60s |

### 🟡 警告 (WARNING)

| 规则 | 说明 | 检测逻辑 |
|------|------|----------|
| 双芯片配置 | 同一号码布绑定多个芯片 | bib_to_chip 中同一号码布对应多个芯片（可能是胸贴+脚贴） |
| 未分配波次 | 选手无波次分配 | participant.wave_id is None |
| 波次超限 | 波次人数超过限制 | wave_participants_count > wave.max_participants |
| 波次发错 | 实际出发时间与分配波次不符 | diff_from_assigned > 5min 且 closer_to_other_wave |
| 轻微抢跑 | 早于波次发枪时间30-60秒 | start_time < wave.start_time - 30s |

### 🔵 信息 (INFO)

当前版本无 INFO 级别规则。

## 许可证

MIT License
