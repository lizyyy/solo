# 实验样本冷链交接 CLI 使用指南

## 项目概述

`cold-chain` 是一个用于管理实验样本从采集点到实验室冷链交接流程的命令行工具。它围绕温度记录、交接人、箱号和异常处置展开，能够判断每个样本是应该接收、复核还是拒收，并指明责任段。

## 本地启动

### 1. 环境要求

- Python 3.9+
- pip

### 2. 安装

```bash
# 进入项目目录
cd /path/to/project

# 安装依赖
pip install -r requirements.txt

# 或者以开发模式安装
pip install -e .
```

### 3. 验证安装

```bash
python -m cold_chain_cli.main --help
```

或者如果你用了 `pip install -e .`：

```bash
cold-chain --help
```

## 操作链路

工具提供以下核心命令：

| 命令 | 功能 | 输出 |
|------|------|------|
| `init` | 初始化新项目 | 项目结构、空状态 |
| `import` | 导入数据文件 | 导入统计、错误信息 |
| `check` | 检查数据一致性 | 摘要、规则违规列表 |
| `detail` | 查看详细信息 | 资源树、样本/箱子/违规详情 |
| `report` | 生成交接报告 | 状态判定、责任段分配 |
| `correct` | 人工修正数据 | 修正记录 |
| `example` | 管理示例数据 | 示例列表、加载提示 |

## 造数方式

### 方式一：使用内置示例（推荐）

工具内置 4 个覆盖典型场景的示例：

```bash
# 查看所有示例
cold-chain example list

# 加载某个示例（自动初始化项目）
cold-chain example load normal
cold-chain example load short-over
cold-chain example load long-gap
cold-chain example load manual
cold-chain example load all
```

### 方式二：导入外部数据文件

工具支持 JSON 和 CSV 两种格式，支持中英文列名。

**1. 样本清单 (samples)**

CSV 示例：
```csv
样本编号,箱号,样本类型,采集时间,最低温度,最高温度
SAMPLE-001,BOX-001,血液样本,2026-05-12 08:00:00,-20,8
SAMPLE-002,BOX-001,核酸样本,2026-05-12 08:10:00,-20,8
```

JSON 示例：
```json
[
  {"sample_id": "SAMPLE-001", "box_id": "BOX-001", "sample_type": "血液样本", "collection_time": "2026-05-12 08:00:00"}
]
```

导入命令：
```bash
cold-chain import samples samples.csv
```

**2. 箱号清单 (boxes)**

CSV 示例：
```csv
箱号,箱型
BOX-001,医用冷链箱
BOX-002,生物安全运输箱
```

导入命令：
```bash
cold-chain import boxes boxes.csv
```

**3. 交接记录 (handovers)**

CSV 示例：
```csv
箱号,交出人,接收人,交接时间,地点,已签字
BOX-001,张采集,李运输,2026-05-12 09:00:00,采集点A,true
BOX-001,李运输,王分拣,2026-05-12 10:00:00,中转站B,true
```

导入命令：
```bash
cold-chain import handovers handovers.csv
```

**4. 温度记录 (temperatures)**

CSV 示例：
```csv
箱号,时间,温度,单位,设备ID
BOX-001,2026-05-12 09:00:00,2.0,C,TEMP-001
BOX-001,2026-05-12 09:10:00,3.5,C,TEMP-001
BOX-001,2026-05-12 09:20:00,41.0,F,TEMP-002
```

导入命令：
```bash
cold-chain import temperatures temps.csv
```

## 主要演示路径

### 路径 1: 合格运输 (Normal)

**预期结果：所有样本判定为「接收」，责任段「实验室接收」**

```bash
# 1. 初始化项目并加载合格运输示例
cold-chain example load normal

# 2. 检查数据一致性
cold-chain check

# 3. 查看资源概览
cold-chain detail

# 4. 查看某个样本详情
cold-chain detail sample SAMPLE-001

# 5. 生成最终报告
cold-chain report
```

**执行结果解读：**
- 规则检查应显示「未发现规则违规」
- 报告中所有 5 个样本状态为 `received`（接收）
- 责任段应为「实验室接收」
- 说明列显示「正常」

### 路径 2: 短时超温 (Short Overtemperature)

**预期结果：样本判定为「复核」，责任段「运输」**

```bash
# 1. 创建新项目目录
mkdir -p ./project-short
cd ./project-short

# 2. 加载短时超温示例
cold-chain example load short-over

# 3. 查看违规情况
cold-chain check

# 4. 查看具体违规详情
cold-chain detail violation 0

# 5. 查看温度记录
cold-chain detail box BOX-002

# 6. 生成报告
cold-chain report
```

**执行结果解读：**
- 规则检查显示 1 条 `warning` 级别的「温度超温」违规
- 报告中 3 个样本状态为 `reviewed`（复核）
- 责任段为「运输」
- 需要人工评估后决定是否接收

### 路径 3: 长时间缺记录 (Long Gap)

**预期结果：样本判定为「拒收」，责任段「运输」**

```bash
# 1. 创建新项目目录
mkdir -p ./project-gap
cd ./project-gap

# 2. 加载长时间缺记录示例
cold-chain example load long-gap

# 3. 检查违规
cold-chain check

# 4. 查看箱子详情和温度记录
cold-chain detail box BOX-003

# 5. 生成报告
cold-chain report -o report.json -f json
```

**执行结果解读：**
- 规则检查显示 1 条 `critical` 级别的「长时间温度记录缺失」违规
- 最大间隔约 90 分钟（超过阈值 60 分钟）
- 报告中 4 个样本状态为 `rejected`（拒收）
- 责任段为「运输」

### 路径 4: 人工修正 (Manual)

**预期结果：包含多种违规，演示人工修正后状态变化**

```bash
# 1. 创建新项目目录
mkdir -p ./project-manual
cd ./project-manual

# 2. 加载人工说明示例
cold-chain example load manual

# 3. 首次检查（发现多个违规）
cold-chain check

# 4. 分析违规情况
cold-chain detail violation 0
cold-chain detail violation 1
cold-chain detail violation 2

# 5. 添加人工修正（记录已核实情况）
cold-chain correct handover_signed BOX-001 false true "接收人已补签确认" --operator 质控员小王

# 6. 查看修正历史
cold-chain detail history

# 7. 重新评估
cold-chain check
cold-chain report
```

**执行结果解读：**
- 首次检查将发现多个违规：
  - `info`: 重复温度文件（自动合并）
  - `warning`: 温度单位混用（自动转换）
  - `critical`: 交接人缺签（需要人工处理）
- 添加人工修正后，修正记录会被保存
- 修正历史可通过 `detail history` 查看
- 重新报告时会考虑修正记录

## 失败路径演示

### 场景: 箱号与样本不匹配

```bash
# 1. 初始化项目
cold-chain init failed-demo

# 2. 导入一个箱子
echo '箱号,箱型
BOX-999,冷链箱' > /tmp/boxes.csv
cold-chain import boxes /tmp/boxes.csv

# 3. 导入样本，但样本关联了不存在的箱号
echo '样本编号,箱号,样本类型,采集时间
SAMPLE-BAD,BOX-NONEXIST,问题样本,2026-05-12 08:00:00' > /tmp/samples.csv
cold-chain import samples /tmp/samples.csv

# 4. 检查（会发现箱号不匹配）
cold-chain check

# 5. 生成报告
cold-chain report
```

**失败结果：**
- 规则检查显示 `critical` 级别的「箱号不匹配」违规
- 样本 SAMPLE-BAD 状态为 `rejected`（拒收）
- 责任段为「采集点」（因为是样本录入时的错误）

### 场景: 缺少温度记录

```bash
# 1. 初始化项目
cold-chain init no-temp-demo

# 2. 导入箱子和样本
echo '箱号,箱型
BOX-NO-TEMP,冷链箱' > /tmp/boxes2.csv
echo '样本编号,箱号,样本类型,采集时间
SAMPLE-T01,BOX-NO-TEMP,测试样本,2026-05-12 08:00:00' > /tmp/samples2.csv
cold-chain import boxes /tmp/boxes2.csv
cold-chain import samples /tmp/samples2.csv

# 3. 导入交接记录（有签字）
echo '箱号,交出人,接收人,交接时间,地点,已签字
BOX-NO-TEMP,甲,乙,2026-05-12 09:00:00,实验室,true' > /tmp/handovers.csv
cold-chain import handovers /tmp/handovers.csv

# 4. 检查（没有温度记录）
cold-chain check

# 5. 报告
cold-chain report
```

**失败结果：**
- 规则检查显示 `critical` 级别的「无温度记录」违规
- 样本状态为 `rejected`（拒收）
- 责任段为「运输」

## 状态判定规则

工具根据违规严重程度和是否有人工修正来判定样本最终状态：

| 违规严重程度 | 无修正 | 有修正 |
|-------------|--------|--------|
| Critical (critical) | 拒收 (rejected) | 复核 (reviewed) |
| Major (major) | 复核 (reviewed) | 接收 (received) |
| Warning (warning) | 复核 (reviewed) | 接收 (received) |
| Info (info) | 接收 (received) | 接收 (received) |

## 责任段定义

| 责任段 | 含义 | 典型违规 |
|--------|------|----------|
| 采集点 | 样本采集和装箱阶段 | 箱号不匹配、样本信息错误 |
| 运输 | 冷链运输阶段 | 温度超温、记录断档 |
| 实验室接收 | 交接接收阶段 | 正常无违规时 |
| 未知 | 无法明确责任 | 多种原因混合 |

## 幂等性保证

工具通过以下机制保证重复执行的幂等性：

1. **导入幂等**：
   - 样本：按 `sample_id` 去重，已存在的跳过
   - 箱子：按 `box_id` 去重，已存在的跳过
   - 交接记录：按 `(box_id, from_person, to_person, handover_time)` 组合去重
   - 温度记录：按 `(box_id, timestamp, temperature)` 组合去重

2. **规则执行幂等**：
   - 多次运行 `check` 或 `report` 结果一致
   - 版本号递增但业务状态稳定

3. **数据版本**：
   - 每次保存状态时 `version` 字段递增
   - 可追溯历史变更

## 人工修正流程

当系统自动判定无法满足业务需求时，可通过人工修正：

```bash
# 语法
cold-chain correct <字段> <修改前> <修改后> <原因> --operator <操作者>

# 示例
cold-chain correct handover_signed BOX-004 false true "沈接收已事后补签" --operator 张主管
cold-chain correct box_mapping SAMPLE-301 BOX-004 BOX-005 "箱号录入错误，实际为BOX-005" --operator 李质控
```

修正记录会永久保存，包含：
- 修正 ID（UUID）
- 操作者
- 修正时间
- 修改字段
- 前后值
- 原因说明

## 常用命令速查

```bash
# 初始化
cold-chain init 项目名

# 导入四类数据
cold-chain import samples 样本文件.csv
cold-chain import boxes 箱号文件.json
cold-chain import handovers 交接记录.csv
cold-chain import temperatures 温度记录.csv

# 检查与查看
cold-chain check
cold-chain detail
cold-chain detail sample 样本编号
cold-chain detail box 箱号
cold-chain detail violation 索引
cold-chain detail history

# 报告
cold-chain report
cold-chain report -o report.json -f json
cold-chain report -o report.csv -f csv

# 示例
cold-chain example list
cold-chain example load normal
cold-chain example load all

# 人工修正
cold-chain correct 字段名 before after 原因 --operator 姓名
```

## 项目结构

```
项目目录/
├── state.json          # 数据状态文件（所有样本、箱子、记录、状态、修正历史）
└── data/
    ├── imports/        # 导入的原始文件存档
    │   ├── samples_xxx_xxx.csv
    │   ├── boxes_xxx_xxx.json
    │   └── ...
    └── exports/        # 导出的报告等
```

## 数据文件格式说明

### 支持的列名（中英文均可）

| 数据类型 | 英文列名 | 中文列名 | 必填 |
|---------|---------|---------|------|
| 样本 | sample_id | 样本编号 | 是 |
| 样本 | box_id | 箱号 | 是 |
| 样本 | sample_type | 样本类型 | 否 |
| 样本 | collection_time | 采集时间 | 是 |
| 样本 | min_temp/max_temp | 最低温度/最高温度 | 否 |
| 箱子 | box_id | 箱号 | 是 |
| 箱子 | box_type | 箱型 | 否 |
| 交接 | box_id | 箱号 | 是 |
| 交接 | from_person | 交出人 | 是 |
| 交接 | to_person | 接收人 | 是 |
| 交接 | handover_time | 交接时间 | 是 |
| 交接 | location | 地点 | 否 |
| 交接 | signed | 已签字 | 否 |
| 温度 | box_id | 箱号 | 是 |
| 温度 | timestamp | 时间 | 是 |
| 温度 | temperature | 温度 | 是 |
| 温度 | unit | 单位 | 否 |
| 温度 | device_id | 设备ID | 否 |
