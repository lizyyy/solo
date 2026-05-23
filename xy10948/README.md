# 培训签到补签 CLI

用于合并签到机数据与老师补签表，自动检测冲突并生成结业资格报告

## 功能特性

- 📊 **数据合并**: 合并签到机数据与老师补签表
- ⚖️ **冲突检测**: 自动检测两方数据不一致的情况
- 🎓 **结业资格**: 根据出勤率自动判断结业资格
- 📋 **多格式输出**: 终端摘要、CSV报告、JSON数据
- 🧪 **内置自检**: 验证工具功能正确性

## 快速开始

### 运行自检
```bash
python -m attendance_cli.main --self-test
```

### 处理实际数据
```bash
python -m attendance_cli.main \
  --machine sample_data/machine_attendance.csv \
  --teacher sample_data/teacher_makeup.csv \
  --courses sample_data/courses.csv \
  --output ./results \
  --attendance-rate 0.8
```

### 仅查看摘要
```bash
python -m attendance_cli.main \
  --machine sample_data/machine_attendance.csv \
  --teacher sample_data/teacher_makeup.csv \
  --courses sample_data/courses.csv \
  --summary
```

## 输入文件格式

### 课程场次配置 (courses.csv)
| 字段 | 说明 |
|------|------|
| 场次编号 | 唯一标识 |
| 课程名称 | 课程名称 |
| 场次日期 | 日期 (YYYY-MM-DD) |
| 场次时间 | 时间范围 |

### 签到机数据 (machine.csv)
| 字段 | 说明 |
|------|------|
| 学员编号 | 学员唯一标识 |
| 学员姓名 | 学员姓名 |
| 场次编号 | 对应课程场次 |
| 签到状态 | 出勤/缺勤/迟到/早退 |
| 签到时间 | 实际签到时间 |

### 老师补签表 (teacher.csv)
| 字段 | 说明 |
|------|------|
| 学员编号 | 学员唯一标识 |
| 学员姓名 | 学员姓名 |
| 场次编号 | 对应课程场次 |
| 补签状态 | 出勤/缺勤/迟到/早退 |
| 补签时间 | 补签时间 |
| 备注 | 补签原因说明 |

## 输出文件说明

| 文件名 | 说明 |
|--------|------|
| `merged_attendance.csv` | 合并后的完整考勤记录 |
| `conflicts_report.csv` | 冲突记录及处理结果 |
| `graduation_eligibility.csv` | 学员结业资格汇总表 |
| `detailed_student_attendance.csv` | 学员各场次详细考勤 |
| `bad_rows_report.csv` | 异常数据行报告 |
| `attendance_data.json` | 机器可读的完整数据 |
| `README_考勤报告.md` | 给同事看的友好说明文档 |

## 冲突处理规则

1. **老师补签优先**: 当签到机数据与老师补签表状态不一致时，以老师补签为准
2. **冲突记录**: 所有冲突都会被记录，包含原始行号便于追溯
3. **异常保留**: 格式错误或异常数据会被单独记录，保留原始位置信息

## 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--machine`, `-m` | 签到机数据CSV路径 | 必填 |
| `--teacher`, `-t` | 老师补签表CSV路径 | 必填 |
| `--courses`, `-c` | 课程场次配置CSV路径 | 必填 |
| `--output`, `-o` | 输出目录 | `./attendance_output` |
| `--attendance-rate` | 结业要求最低出勤率 (0-1) | `0.8` |
| `--encoding` | 输入文件编码 | `utf-8` |
| `--self-test` | 运行自检程序 | - |
| `--summary` | 仅显示终端摘要 | - |

## 项目结构

```
.
├── attendance_cli/
│   ├── __init__.py
│   ├── main.py              # 主入口，参数解析
│   ├── data_processor.py  # 数据处理核心逻辑
│   ├── report_generator.py # 报告生成器
│   └── self_test.py       # 自检程序
├── sample_data/            # 示例数据
│   ├── courses.csv
│   ├── machine_attendance.csv
│   └── teacher_makeup.csv
├── setup.py
└── README.md
```
