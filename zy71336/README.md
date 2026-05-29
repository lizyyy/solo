# 🎹 钢琴练琴打卡异常处理系统

一个专业的钢琴机构练琴打卡异常处理CLI工具，帮助老师高效处理学生打卡数据。

## ✨ 核心特性

### 🔍 五大核心模块串联主流程

```
音频文件 → ①音频校验 → ②补录规则 → ③重复合并 → ④点评追踪 → ⑤报告导出
                                                           ↓
                                                     统计报告/异常明细
```

1. **音频校验** ([audio_checker.py](file:///Users/lzy/pro/solo/workspaces/zy71336/piano_checkin/audio_checker.py))
   - 真实WAV音频解析，计算RMS音量
   - 空白音频检测（音量 < -50dB）
   - 时长不足检测（< 30秒）
   - 低质量检测（采样率 < 44100Hz）
   - 错误详情包含具体数值（差多少秒、音量多少dB）

2. **补录规则引擎** ([makeup_rules.py](file:///Users/lzy/pro/solo/workspaces/zy71336/piano_checkin/makeup_rules.py))
   - 超期检测（限3天内补录）
   - 理由验证（至少5字，含有效关键词）
   - 课程表匹配（检查原日期是否有课）
   - 日期逻辑校验（原日期不能晚于提交日期）

3. **重复合并** ([duplicate_merger.py](file:///Users/lzy/pro/solo/workspaces/zy71336/piano_checkin/duplicate_merger.py))
   - 同日同学生自动检测
   - 智能评分选主（时长×50 + 音量×10 + 无异常×10）
   - 保留合并关系（merged_from / merged_into）
   - 详细合并日志（时长变化、音量变化等）

4. **点评追踪** ([comment_tracker.py](file:///Users/lzy/pro/solo/workspaces/zy71336/piano_checkin/comment_tracker.py))
   - 老师点评与记录关联
   - 合并记录点评自动关联
   - 待点评记录提醒（优先异常）
   - 按学生/时间查询历史

5. **报告导出** ([report_exporter.py](file:///Users/lzy/pro/solo/workspaces/zy71336/piano_checkin/report_exporter.py))
   - 三种格式：文本 / JSON / CSV
   - 总体统计 + 异常明细 + 点评状态
   - 学生个人报告
   - 自动保存到 `data/reports/`

## 📁 项目结构

```
zy71336/
├── piano_checkin/                    # 核心包
│   ├── __init__.py
│   ├── models.py                     # 数据模型
│   ├── audio_checker.py              # 音频校验
│   ├── makeup_rules.py               # 补录规则
│   ├── duplicate_merger.py           # 重复合并
│   ├── comment_tracker.py            # 点评追踪
│   ├── report_exporter.py            # 报告导出
│   └── cli.py                        # CLI主入口
├── data/                             # 数据目录（运行时生成）
│   ├── students.json                 # 学生名单
│   ├── records.json                  # 打卡记录
│   ├── schedule.json                 # 课程表
│   ├── comments.json                 # 老师点评
│   ├── audio/                        # 音频文件
│   ├── reports/                      # 导出报告
│   └── history/                      # 历史备份（每次修改自动保存）
├── __main__.py                       # 包入口
├── init_test_data.py                 # 初始化测试数据
├── test_e2e.py                       # 端到端测试
└── run_tests.sh                      # 自动化测试脚本
```

## 🚀 快速开始

### 1. 初始化测试数据

```bash
python3 init_test_data.py
# 输入 y 确认清除并重建数据
```

这将创建：
- 5名测试学生（张小明、王小红、刘小刚、陈小美、赵小强）
- 6条课程安排
- 6个测试音频文件（空白、短、正常×3、低质量）

### 2. 一键运行所有测试

```bash
bash run_tests.sh
```

### 3. 运行端到端测试

```bash
python3 test_e2e.py
```

### 4. 进入交互模式

```bash
python3 -m piano_checkin.cli -i
# 或
python3 -m piano_checkin.cli --interactive
```

### 5. 命令行模式

```bash
# 处理单个音频
python3 -m piano_checkin.cli --process data/audio/test_normal1.wav <student_id>

# 处理补录
python3 -m piano_checkin.cli --process data/audio/test_normal1.wav <student_id> \
    --makeup --original-date 2026-05-20 --reason "生病发烧请假"

# 合并重复记录
python3 -m piano_checkin.cli --merge 2026-05-29

# 生成日报
python3 -m piano_checkin.cli --report 2026-05-29 --report-format text
python3 -m piano_checkin.cli --report 2026-05-29 --report-format json
python3 -m piano_checkin.cli --report 2026-05-29 --report-format csv

# 查看记录
python3 -m piano_checkin.cli --list --date 2026-05-29
python3 -m piano_checkin.cli --list --abnormal-only

# 查看处理流水线
python3 -m piano_checkin.cli --pipeline <record_id>

# 学生报告
python3 -m piano_checkin.cli --student-report <student_id>

# 列出学生
python3 -m piano_checkin.cli --students
```

## 🧪 测试场景（压力测试）

### 场景1: 空白音频
- **输入**: 30秒全静音WAV文件
- **预期**: 检测为空白音频，标记 `blank_audio` 异常
- **详情**: 显示具体音量值（如-60dB），与阈值（-50dB）的对比

### 场景2: 时长不足
- **输入**: 15秒正常音频
- **预期**: 标记 `short_audio` 异常
- **详情**: 显示"时长不足: 15.0秒，最低要求30秒，还差15.0秒"

### 场景3: 同日重复上传（3条）
- **输入**: 同一学生同日上传3个音频（45秒、60秒、50秒）
- **预期**: 3条合并为1条，保留60秒（质量评分最高）
- **详情**: 显示每条记录的评分、合并前后的时长/音量变化

### 场景4: 补录超期
- **输入**: 补录5天前的打卡，理由"生病发烧请假"
- **预期**: 标记 `makeup_overdue` 异常
- **详情**: 显示"补录超期: 已超期2天（限3天内补录）"

### 场景5: 补录理由无效
- **输入**: 补录2天前的打卡，理由仅"有事"2字
- **预期**: 标记 `invalid_reason` 异常
- **详情**: 显示"补录理由过短: 仅2字，至少需要5字"

### 场景6: 课程表不匹配
- **输入**: 补录日期当天无课程安排
- **预期**: 标记 `invalid_reason` 异常
- **详情**: 显示"课程表不匹配: 当天无课程安排，该生上课时间为周X"

### 场景7: 正常打卡
- **输入**: 45秒正常音频
- **预期**: 状态为 `normal`，无异常
- **详情**: 显示时长、音量等参数

## 📋 数据线索关联

系统自动关联以下数据：
- **学生名单** ↔ 打卡记录（student_id）
- **打卡音频** ↔ 音频校验（真实WAV解析）
- **补录理由** ↔ 补录规则（关键词、长度、日期逻辑）
- **老师点评** ↔ 打卡记录（record_id，含合并关联）
- **课程表** ↔ 补录验证（day_of_week匹配）
- **统计报告** ↔ 所有模块（汇总所有检测结果）

## 🔄 历史追踪

每次修改数据（保存记录、添加点评）时，系统自动：
1. 将原文件备份到 `data/history/` 目录
2. 文件名包含时间戳，如 `records.json.20260529_143022.bak`
3. 支持回溯任意历史版本

## 💡 失败路径设计（真实工作场景）

| 失败场景 | 检测点 | 错误详情示例 |
|---------|--------|-------------|
| 音频文件不存在 | 文件路径校验 | "音频文件不存在: data/audio/xxx.wav" |
| 0字节空文件 | 文件大小检查 | "音频文件为空（0字节），请检查是否上传成功" |
| WAV格式损坏 | wave解析 | "WAV文件格式损坏: file does not start with RIFF id" |
| 学生不存在 | 学生ID校验 | "学生不存在: s_xxxxx" |
| 原日期晚于提交 | 日期逻辑 | "补录日期异常: 原打卡日期晚于提交日期，相差2天" |
| 理由仅语气词 | 正则匹配 | "补录理由无效: '嗯嗯' 过于简单" |
| 理由太模糊 | 关键词匹配 | "补录理由不够明确: '那个事'，建议包含具体原因" |
| 对已合并记录点评 | 状态检查 | "无法对已合并记录点评，请对主记录进行点评" |
| 点评内容为空 | 内容校验 | "点评内容不能为空" |

## 📊 主流程串接说明

1. **导入不独立**: `process_audio()` 依次调用音频校验 + 补录规则，异常直接写入记录
2. **合并不独立**: `merge_duplicates()` 基于已有记录的校验结果进行智能评分
3. **点评不独立**: `add_comment()` 检查记录状态（不能对已合并记录点评）
4. **导出不独立**: `generate_report()` 读取所有记录的异常状态、点评状态进行汇总
5. **流水线视图**: `show_pipeline()` 展示单条记录经过所有5个模块的完整处理过程

## 🛠️ 技术栈

- **Python 3.8+**（仅标准库，无需安装依赖）
- **wave** 模块解析真实WAV音频
- **struct** + **math** 计算RMS音量（真实音频分析）
- **dataclasses** 数据模型
- **argparse** 命令行解析
- **json** / **csv** 数据持久化和导出

## 🔧 可配置参数

```python
# audio_checker.py
MIN_DURATION_SECONDS = 30      # 最小时长（秒）
BLANK_THRESHOLD_DB = -50       # 空白阈值（dB）
MIN_SAMPLE_RATE = 44100        # 最低采样率

# makeup_rules.py
MAX_MAKEUP_DAYS = 3            # 补录最大期限（天）
MIN_REASON_LENGTH = 5          # 理由最少字数

# duplicate_merger.py
MERGE_WINDOW_MINUTES = 120     # 重复检测时间窗口
```

---

**交接时只需说明**: 学生名单、打卡音频、补录理由、老师点评、课程表、统计报告 — 系统会自动把它们串起来。
