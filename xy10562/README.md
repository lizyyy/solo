# 门诊候诊拥堵分析 CLI

一套围绕门诊候诊数据的实用 CLI 工具，结合预约、到诊、叫号、过号和医生停诊状态进行拥堵分析。

## 功能特性

- **数据管理**: 支持预约表、到诊记录、叫号日志、过号记录、医生出诊状态的导入
- **拥堵分析**: 自动识别拥堵原因（医生停诊、过号重排、现场号激增、患者集中到达等）
- **状态追踪**: 完整记录每一步操作的历史和失败原因
- **幂等操作**: 重复执行或重复回调保持幂等，数据不会重复
- **人工修正审计**: 所有修改留下前后差异和操作者
- **样例数据**: 内置内科、儿科、检验窗口的完整样例和故障演示场景

## 快速开始

### 环境要求

- Python 3.7+
- click >= 8.0.0
- rich >= 13.0.0

### 安装依赖

```bash
pip install -r requirements.txt
# 或者
python3 -m pip install click rich
```

### 本地启动

```bash
# 显示帮助
python3 clinic_congestion.py --help

# 初始化数据库
python3 clinic_congestion.py init

# 或重置数据库（清除所有数据）
python3 clinic_congestion.py init --reset
```

### 生成内置样例数据

```bash
# 生成完整演示样例（内科、儿科、检验窗口）
python3 clinic_congestion.py seed

# 生成故障演示样例（用于测试拥堵分析）
python3 clinic_congestion.py seed --type failure
```

## 主要演示路径

### 路径 1: 正常拥堵检查

```bash
# 1. 初始化并生成正常样例
python3 clinic_congestion.py init --reset
python3 clinic_congestion.py seed

# 2. 检查所有科室拥堵情况
python3 clinic_congestion.py check

# 3. 检查特定科室
python3 clinic_congestion.py check --department DEPT_INTERNAL

# 4. 生成报告
python3 clinic_congestion.py report

# 或生成 JSON 格式报告
python3 clinic_congestion.py report --format json

# 5. 查看历史检查记录
python3 clinic_congestion.py detail --list

# 6. 查看操作日志
python3 clinic_congestion.py logs --type operations

# 7. 查看导入历史
python3 clinic_congestion.py logs --type imports
```

### 路径 2: 故障场景演示

```bash
# 1. 初始化并生成故障样例
python3 clinic_congestion.py init --reset
python3 clinic_congestion.py seed --type failure

# 2. 检查内科门诊（应该显示多维度拥堵）
python3 clinic_congestion.py check --department DEPT_INTERNAL
```

**预期输出分析:**
- 拥堵级别: 严重拥堵
- 原因分析:
  1. 医生临时停诊（李医生身体不适，操作者：护士长_王芳）
  2. 过号患者重新排队
  3. 现场号激增（比例 0.75）
- 调整建议: 协调医生顶替、增开窗口、优化过号处理

### 路径 3: 数据导入

```bash
# 1. 初始化
python3 clinic_congestion.py init --reset

# 2. 必须先用 seed 生成基础科室和医生数据（或自己导入）
python3 clinic_congestion.py seed

# 3. 导入预约数据
python3 clinic_congestion.py import-data --type appointments \
    --file data_samples/appointments_sample.json \
    --operator "导入员张三"

# 4. 导入到诊记录
python3 clinic_congestion.py import-data --type arrivals \
    --file data_samples/arrivals_sample.json

# 5. 测试幂等性（再次导入相同文件，应该显示已存在跳过）
python3 clinic_congestion.py import-data --type appointments \
    --file data_samples/appointments_sample.json

# 6. 查看导入历史
python3 clinic_congestion.py logs --type imports
```

## 一条失败路径

```bash
# 1. 初始化
python3 clinic_congestion.py init --reset

# 2. 尝试导入指向不存在科室的预约数据（应该失败）
python3 clinic_congestion.py import-data --type appointments \
    --file data_samples/test_import_error.json

# 预期输出:
# 总记录数: 1, 成功: 0, 失败: 1
# 错误详情: 记录 1: 科室 NONEXISTENT 不存在

# 3. 查看导入历史（状态应为 failed）
python3 clinic_congestion.py logs --type imports
```

## 数据格式说明

### 预约表 (appointments)

```json
{
  "id": "APPT_001",
  "patient_name": "患者姓名",
  "patient_id": "P001",
  "department_id": "DEPT_INTERNAL",
  "doctor_id": "DOC_ZHANG",
  "appointment_date": "2026-05-12",
  "appointment_time": "08:00",
  "queue_number": "A001",
  "source_type": "booking"
}
```

字段说明:
- `source_type`: `booking`（预约号）或 `walkin`（现场号）

### 到诊记录 (arrivals)

```json
{
  "id": "ARR_001",
  "appointment_id": "APPT_001",
  "arrival_time": "2026-05-12T07:45:00",
  "queue_position": 1
}
```

### 叫号日志 (calls)

```json
{
  "id": "CALL_001",
  "appointment_id": "APPT_001",
  "call_time": "2026-05-12T08:00:00",
  "queue_number": "A001",
  "window_number": "1-1"
}
```

### 过号记录 (overcalls)

```json
{
  "id": "OC_001",
  "appointment_id": "APPT_001",
  "overcall_time": "2026-05-12T08:15:00",
  "reason": "患者暂离",
  "new_queue_number": "A001R",
  "requeue_count": 1
}
```

### 医生出诊状态 (doctor_status)

```json
{
  "doctor_id": "DOC_ZHANG",
  "status": "temp_suspended",
  "reason": "身体不适，临时停诊"
}
```

状态值: `on_duty`（出诊中）、`temp_suspended`（临时停诊）、`perm_suspended`（永久停诊）

## 内置科室和医生

样例数据包含以下预设：

| 科室ID | 名称 | 窗口 | 医生 |
|--------|------|------|------|
| DEPT_INTERNAL | 内科门诊 | 1-1 | 张医生、李医生 |
| DEPT_PEDIATRICS | 儿科门诊 | 1-2 | 王医生 |
| DEPT_LAB | 检验窗口 | 2-1 | 赵医生 |

## 输出说明

### 拥堵级别

- **normal (正常)**: 等待患者 < 20%
- **mild (轻度拥堵)**: 等待患者 20-40%
- **moderate (中度拥堵)**: 等待患者 40-60%
- **severe (严重拥堵)**: 等待患者 > 60%

### 原因归类

1. **doctor_suspension (医生停诊)**: 医生临时或永久停诊
2. **overcall_requeue (过号重排)**: 过号患者重新进入队列
3. **walkin_surge (现场号激增)**: 现场号超过预约号的 30%
4. **patient_concentration (患者集中到达)**: 无法归因的普通拥堵

### 影响人数

- 显示各科室等待中患者数量
- 区分已到诊、未到诊、过号重排

### 调整建议

根据拥堵原因和级别给出优先级排序的建议：

- **high (高优先级)**: 需立即处理（增开窗口、协调医生）
- **medium (中优先级)**: 需要优化流程（过号处理、分诊）
- **low (低优先级)**: 保持现状

## 项目结构

```
.
├── clinic_congestion/
│   ├── __init__.py
│   ├── models.py          # 数据模型和数据库操作
│   ├── analyzer.py        # 拥堵分析逻辑
│   ├── sample_data.py     # 样例数据生成器
│   └── cli.py             # CLI 命令定义
├── clinic_congestion.py   # 主入口
├── requirements.txt
├── data_samples/          # 示例数据文件
│   ├── appointments_sample.json
│   ├── arrivals_sample.json
│   ├── doctor_status_sample.json
│   └── test_import_error.json
└── README.md
```

## 常见问题

**Q: 如何使用自定义数据库路径？**
A: 设置环境变量 `CLINIC_DB=/path/to/your.db`

**Q: 如何验证数据完整性？**
A: 使用 `check` 命令查看分析结果，系统会自动检测数据异常。

**Q: 如何追踪谁做了什么操作？**
A: 所有 import 操作都需要指定 `--operator`，并通过 `logs --type operations` 查看完整审计。
