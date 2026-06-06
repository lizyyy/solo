# 演出票务赠票核销系统

琴行店长老周专用 · 演出票务赠票核销工具

## 核心特性

- ✅ **音频备注不清洗**：完整保留原始备注信息，绝不洗成一行干净数据
- ✅ **三步标准流程**：导入 → 补看备注 → 更新核对表，一步都不能少
- ✅ **冲突证据列清**：票务表和音频备注矛盾时，列出证据让老周选，不自动拍板
- ✅ **请假课时不瞎改**：请假被算进已消耗时，标记待巡演统筹复核，不归正常
- ✅ **四项基本自检**：重复导入、请假错算、补录重算、导出一致全覆盖

## 快速开始（新人照着做）

### 环境准备

系统只要有 Python 3.8+ 就行，不用装额外依赖。

```bash
cd ticket_verification
python --version  # 确认是 3.8 以上
```

### 三分钟跑通样例

#### 第一步：跑正常材料

```bash
python cli.py run \
  --tickets data/samples/normal_tickets.csv \
  --audio data/samples/normal_audio_remarks.csv \
  --output reports \
  --operator 老周
```

跑完看 `reports/` 目录下的报告，正常材料应该冲突很少。

#### 第二步：跑错口径材料（重点看冲突）

```bash
python cli.py run \
  --tickets data/samples/wrong_caliber_tickets.csv \
  --audio data/samples/wrong_caliber_audio_remarks.csv \
  --output reports \
  --operator 老周
```

这个会出冲突！注意看：
- T002、T004：曲目对不上，列出原始备注证据
- T003、T005：请假课时被算成已消耗，标记【待巡演统筹复核】

#### 第三步：跑补录材料

```bash
python cli.py run \
  --tickets data/samples/supplement_tickets.csv \
  --audio data/samples/supplement_audio_remarks.csv \
  --output reports \
  --operator 老周
```

补录的 T003、T005 会更新状态，还有新增的 T007。

### 查看报告

报告会生成两个版本：
- `verification_report_*.txt`：给人看的文本版
- `verification_report_*.json`：给程序读的结构化版

报告里会有：
1. 总体统计（总票数、已确认、冲突数等）
2. 冲突详情（带证据，绝不藏着掖着）
3. 自检结果（四项必检都列出来）
4. 曲目核对表摘要

## 三步流程详解

### 步骤1：票务导出表第一次导入

- 自动检测重复导入（文件级 MD5 校验）
- 自动检测单条记录重复
- 保留原始导入数据，绝不覆盖
- 生成批次号，可追溯

### 步骤2：琴行店长老周补看音频文件备注

**重点：原始备注完整保留，绝不做任何清洗！**

系统会：
- 把所有音频原始备注贴到对应的票上
- 自动对比票务表和音频备注的差异
- 发现冲突就列证据，包括：
  - 曲目不符（附原始备注）
  - 状态不符（附原始备注）
  - 日期不符（附原始备注）
  - 请假课时被算进已消耗 → 标记【待巡演统筹复核】

**系统不会替老周做决定！** 所有冲突都列出来等人确认。

### 步骤3：曲目核对表更新

- 从票务数据自动生成曲目核对表
- 把音频备注更新到核对表备注栏
- 无冲突的自动标记已核对
- 有冲突的保持待处理状态
- 历史记录全程留痕

## 自检项目说明

系统每次跑都会自动做四项检查：

| 检查项 | 检查内容 |
|--------|----------|
| 重复导入检测 | 同一个文件别导两次，用 MD5 校验 |
| 请假课时被算进已消耗 | 发现就标记，等巡演统筹来 |
| 重复记录检测 | 同票号同学员同曲目同日期算重复 |
| 必填字段完整性 | 票号、姓名、曲目、日期不能空 |
| 核对表与票务表一致 | 核对表数据要和票务表对得上 |
| 导出一致性 | 导出去再导回来要一模一样 |

## 数据格式说明

### 票务导出表 CSV

字段名可以是中文或英文，系统自动识别：

| 字段 | 别名示例 | 说明 |
|------|----------|------|
| ticket_id | 票号、id | 唯一标识 |
| student_name | 学员姓名、姓名 | |
| repertoire | 曲目、演奏曲目 | |
| performance_date | 演出日期、日期 | |
| status | 状态、核销状态 | |
| is_consumed | 是否消耗、已消耗 | true/false 或 是/否 |
| leave_status | 请假状态、是否请假 | 正常/请假/补录 |

### 音频文件备注 CSV

| 字段 | 别名示例 | 说明 |
|------|----------|------|
| audio_file | 音频文件、文件名 | |
| ticket_id | 票号、关联票号 | 对应票务表 |
| student_name | 学员姓名、姓名 | |
| remark | 备注、audio_remark、raw_remark | **原始备注，系统原封不动保留** |

## 目录结构

```
ticket_verification/
├── cli.py                  # 命令行入口
├── README.md               # 本文档
├── src/                    # 核心代码
│   ├── __init__.py
│   ├── models.py           # 数据模型
│   ├── ticket_importer.py  # 票务导入
│   ├── audio_parser.py     # 音频备注解析
│   ├── conflict_detector.py# 冲突检测
│   ├── checklist_manager.py# 核对表管理
│   ├── self_checker.py     # 自检模块
│   └── report_generator.py # 报告生成
├── data/
│   └── samples/            # 样例数据
│       ├── normal_tickets.csv
│       ├── normal_audio_remarks.csv
│       ├── wrong_caliber_tickets.csv
│       ├── wrong_caliber_audio_remarks.csv
│       ├── supplement_tickets.csv
│       └── supplement_audio_remarks.csv
└── reports/                # 报告输出目录
```

## 设计原则（给开发看）

1. **备注优先原则**：音频备注比正式表重要，绝不丢失原始信息
2. **不替人决策原则**：冲突只列证据，确认/驳回必须人来做
3. **请假谨慎原则**：请假课时被算进已消耗，绝不能自动归正常，必须等巡演统筹
4. **可追溯原则**：每一步操作都有历史记录
5. **新人友好原则**：README + 样例 = 能跑通

## 常见问题

**Q: 为什么音频备注里的信息不自动更新到票务表？**
A: 老周说的，备注比表重要，不能让系统偷偷改。得人看过确认才行。

**Q: 请假课时被算进已消耗为什么不自动修正？**
A: 这是敏感操作，留给巡演统筹复核。系统只负责发现和标记，不做自动修复。

**Q: 能导入 Excel 吗？**
A: 目前只支持 CSV。Excel 另存为 CSV 就行。

**Q: 冲突太多能批量处理吗？**
A: 目前版本是列出来让老周一个一个看。以后可以加批量确认功能。
