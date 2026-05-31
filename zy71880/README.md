# 自由落体实验批改系统 (Freefall Grading)

Go CLI + SQLite 本地实验数据批改系统。

## 功能特性

- 📥 **导入** - 批量或单个导入传感器日志、标定表
- 🔍 **复核** - 自动检测零点漂移、采样缺口、数据有效性
- ✏️ **修正** - 人工审核、批量通过、修正重力加速度
- 📜 **历史** - 完整状态流转追踪、操作留痕
- 📤 **导出** - CSV/JSON 导出实验批改表

## 快速开始

### 编译

```bash
go build -o grader ./cmd/grader/
```

### 基本工作流

```bash
# 1. 导入传感器日志目录
./grader import examples/

# 2. 复核全部已导入的记录
./grader review

# 3. 查看统计状态
./grader status

# 4. 批量通过已复核的记录
./grader correct approve

# 5. 导出已通过的实验批改表
./grader export csv grading_report.csv
```

## 命令详解

### 1. 导入 (import)

**放传感器日志样例位置：**
- 将所有 `.csv` / `.txt` / `.log` 文件放在同一个目录
- 或直接指定单个文件路径

```bash
# 导入目录（批量）
./grader import ./sensor_logs/

# 导入单个文件
./grader import student_2024001.csv

# 导入标定表
./grader import --calibration calibration.csv
```

**日志文件格式要求 (CSV)：**
```csv
student_id,2024001
student_name,张三
experiment_no,EXP-001
sampling_rate,100

timestamp,accel_x,accel_y,accel_z
0.000,0.002,0.001,0.998
0.010,0.001,0.003,0.997
...
```

### 2. 复核 (review)

自动检测异常：
- **零点漂移** - 检测静置阶段加速度偏离 1g 的程度
- **采样缺口** - 检测采样间隔异常的位置
- **数据有效性** - 数据点数、重力加速度计算值范围

```bash
# 复核全部已导入的记录
./grader review

# 复核单条记录（看详情）
./grader review 1
```

**去哪看采样缺口：**
```bash
# 查看某条记录的缺口详情
./grader gaps <记录ID>
```

### 3. 修正/审核 (correct)

```bash
# 批量通过全部已复核的记录
./grader correct approve

# 通过指定记录
./grader correct approve 1 2 3

# 驳回某条记录
./grader correct reject 2 --reason "数据严重缺失"

# 手动修正重力加速度
./grader correct gravity 1 9.78 --reason "重新计算确认"
```

### 4. 查看历史 (history)

```bash
# 查看某条记录详情和操作历史
./grader history 1
```

能看到：
- 数据来源文件
- 当前状态和待处理原因
- 谁在什么时间改过
- 每次修改的理由

### 5. 导出 (export)

**导出实验批改表前复核：**
```bash
# 1. 先看统计，确认待处理都处理了
./grader status

# 2. 导出待处理报告检查
./grader export report pending.txt

# 3. 没问题再导出最终批改表
./grader export csv final_grades.csv
```

其他导出方式：
```bash
# 导出全部记录为 JSON（方便程序处理）
./grader export json all_data.json
```

## 数据状态说明

| 状态 | 说明 |
|------|------|
| 已导入 | 刚导入数据库，未复核 |
| 待处理 | 复核发现异常，需要人工处理 |
| 已复核 | 复核通过，等待最终审核 |
| 已修正 | 人工修正过数值 |
| 已通过 | 最终审核通过，可导出 |
| 已驳回 | 数据不合格 |
| 已导出 | 已导出到批改表 |

## 数据库位置

默认：`~/.freefall-grading/data.db`

指定自定义位置：
```bash
./grader --db ./my_data.db status
```

## 示例数据

`examples/` 目录包含：
- `student_normal.csv` - 正常数据样例
- `student_drift_gap.csv` - 带零点漂移和采样缺口的样例
- `calibration.csv` - 标定表样例

试试：
```bash
./grader import examples/
./grader review
./grader status
./grader gaps 2
```

## 操作人标识

所有修改操作都会记录操作人，用 `--by` 指定：

```bash
./grader --by "李助教" correct approve
```

## 批量运行稳定性

- 重复导入同一文件不会产生重复记录（按学号+实验编号+文件名去重）
- 已通过/已导出的记录不会被复核或修改覆盖
- 状态变更有完整历史可追溯
