# 播前音频质检台

校园广播站导播用的本地桌面工具，助力高效完成每日排播前的音频质检工作。

## 功能特性

### 核心功能
- **节目单导入**：支持 CSV 格式节目单解析
- **音频素材管理**：批量导入音频目录，自动解析元数据
- **排播时间线**：可视化展示节目排播顺序和时间分布
- **智能质检引擎**：14 项专业检查规则
- **人工标记**：支持接受、需修复、延后、驳回四种处理状态
- **会话持久化**：保存工作进度，下次打开可继续
- **多格式导出**：Markdown 报告、CSV 问题清单、JSON 审计记录

### 质检规则

| 规则类型 | 问题描述 | 严重程度 |
|---------|---------|---------|
| **素材检查** | 节目单引用的音频文件缺失 | 🔴 严重 |
| | 存在未被节目单引用的音频文件 | 🔵 信息 |
| | 相同音频文件重复使用 | 🟡 警告 |
| **时长检查** | 实际时长超出窗口 | 🟡 警告 |
| | 实际时长短于窗口 | 🟡 警告 |
| **格式检查** | 音频格式不支持 | 🟡 警告 |
| | 采样率不符合要求 (默认 44100Hz) | 🟡 警告 |
| | 声道数不符合要求 (默认 立体声) | 🟡 警告 |
| | 位深度过低 | 🟡 警告 |
| **质量检查** | 音量峰值过高 (接近削波) | 🔴 严重 |
| | 音量过低 | 🔵 信息 |
| | 片头静音过长 | 🟡 警告 |
| | 片尾静音过长 | 🟡 警告 |
| **排播检查** | 同一广告短时间重复播出 | 🟡 警告 |
| | 时间线冲突/重叠 | 🔴 严重 |

## 项目结构

```
xy4187/
├── __init__.py              # 包初始化
├── requirements.txt         # 依赖配置
├── main_gui.py              # 主 GUI 应用
├── audio_metadata.py        # 音频元数据解析
├── rules_engine.py          # 质检规则引擎
├── state_store.py           # 会话状态存储
├── report_exporter.py       # 报告导出模块
├── sample_data.py           # 示例数据生成
└── tests/
    ├── __init__.py
    ├── test_audio_metadata.py
    ├── test_rules_engine.py
    ├── test_state_store.py
    ├── test_report_exporter.py
    └── test_sample_data.py
```

## 安装说明

### 环境要求
- Python 3.7+
- tkinter (Python 内置 GUI 库)

### 安装依赖

```bash
pip install -r requirements.txt
```

依赖说明：
- **pydub**: 音频处理和分析
- **mutagen**: 音频元数据解析
- **numpy**: 数值计算和信号处理
- **scipy**: 高级信号处理
- **pandas**: 数据处理

## 使用说明

### 启动应用

```bash
python main_gui.py
```

### 基本操作流程

1. **导入节目单**
   - 点击 `文件` → `导入节目单 CSV`
   - 选择符合格式要求的 CSV 文件

2. **导入音频目录**
   - 点击 `文件` → `导入音频目录`
   - 选择存放音频文件的目录

3. **执行质检**
   - 点击 `操作` → `执行质检`
   - 系统将自动分析所有音频文件并检测问题

4. **查看和处理问题**
   - 在右侧"质检问题"面板查看所有问题
   - 点击问题查看详细信息
   - 使用处理按钮标记状态：
     - ✅ 接受：确认问题可接受
     - 🔧 需修复：标记需要重新制作
     - ⏳ 延后：暂时延后处理
     - ❌ 驳回：问题不成立

5. **保存会话**
   - 点击 `文件` → `保存会话状态`
   - 下次打开时可通过 `加载最近会话` 恢复

6. **导出报告**
   - `导出` → `Markdown 质检报告`：生成完整质检报告
   - `导出` → `CSV 问题清单`：导出问题列表便于追踪
   - `导出` → `JSON 审计记录`：导出结构化审计数据

### 节目单 CSV 格式

```csv
编号,标题,开始时间,预计时长(秒),音频文件,类型,口播备注
J001,早间开播片头,08:00:00,15,morning_intro.mp3,jingle,音量调大一点
P001,校园新闻早播报,08:00:15,300,news_20260503.mp3,program,注意口播衔接
A001,食堂优惠广告,08:06:15,30,cafeteria_ad.mp3,ad,音量适中
```

字段说明：
- **编号**：节目/广告/片花的唯一标识符
- **标题**：显示名称
- **开始时间**：HH:MM:SS 格式
- **预计时长(秒)**：分配的时间窗口
- **音频文件**：对应的音频文件名
- **类型**：program(节目)、ad(广告)、jingle(片花)
- **口播备注**：导播备注信息

### 演示模式

应用提供演示功能，无需真实音频文件即可体验：

1. 点击 `文件` → `创建演示项目`
2. 系统将生成示例节目单和模拟数据
3. 可完整体验所有功能（除真实音频分析外）

## 配置说明

可通过 `设置` → `质检参数配置` 调整以下参数：

### 格式要求
- **允许格式**：MP3、WAV、FLAC（默认）
- **要求采样率**：44100 Hz（默认）
- **要求声道数**：2（立体声，默认）
- **最小位深度**：16 bit（默认）

### 时长容差
- **最大超出**：2.0 秒
- **最大缩短**：1.0 秒
- **容差百分比**：5%

### 音频质量
- **峰值警告阈值**：-1.0 dBFS
- **峰值危险阈值**：0.0 dBFS（削波）
- **最小平均音量**：-24.0 dBFS
- **最大片头静音**：1.0 秒
- **最大片尾静音**：1.0 秒

### 广告规则
- **检查广告重复**：是
- **最小广告间隔**：30.0 分钟

### 排播规则
- **检查时间线重叠**：是

## 本地验证流程

### 1. 运行单元测试

```bash
cd /path/to/xy4187
python -m pytest tests/ -v
```

预期输出：
```
collected 68 items
tests/test_audio_metadata.py::... PASSED
tests/test_report_exporter.py::... PASSED
tests/test_rules_engine.py::... PASSED
tests/test_sample_data.py::... PASSED
tests/test_state_store.py::... PASSED

68 passed in 0.XXs
```

### 2. 测试示例数据生成

```bash
python -c "
from sample_data import generate_sample_schedule, generate_mock_audio_metadata, generate_mock_quality_issues

# 生成示例节目单
csv_content = generate_sample_schedule()
print('节目单 CSV 长度:', len(csv_content))
assert '早间开播片头' in csv_content

# 生成模拟元数据
metadata = generate_mock_audio_metadata()
print('音频元数据数量:', len(metadata))
assert len(metadata) > 0

# 生成模拟问题
issues = generate_mock_quality_issues()
print('质检问题数量:', len(issues))
assert len(issues) == 11

print('示例数据测试通过!')
"
```

### 3. 测试报告导出功能

```bash
python -c "
import tempfile
import os
from report_exporter import ReportExporter
from rules_engine import QualityCheckResult, QualityIssue, IssueType, IssueSeverity

# 创建测试数据
issues = [
    QualityIssue(
        issue_type=IssueType.MISSING_AUDIO,
        severity=IssueSeverity.CRITICAL,
        item_id='P001',
        title='测试节目',
        message='音频文件缺失'
    )
]
result = QualityCheckResult(issues=issues, total_checks=1, critical_count=1)

# 测试导出
exporter = ReportExporter()

with tempfile.TemporaryDirectory() as tmpdir:
    # Markdown
    md_path = os.path.join(tmpdir, 'report.md')
    exporter.export_markdown_report(result=result, output_path=md_path)
    assert os.path.exists(md_path)
    
    # CSV
    csv_path = os.path.join(tmpdir, 'issues.csv')
    exporter.export_csv_issue_list(result=result, output_path=csv_path)
    assert os.path.exists(csv_path)
    
    # JSON
    json_path = os.path.join(tmpdir, 'audit.json')
    exporter.export_json_audit_log(result=result, output_path=json_path)
    assert os.path.exists(json_path)
    
    print('报告导出测试通过!')
"
```

### 4. 测试规则引擎

```bash
python -c "
from rules_engine import RulesEngine, IssueType, IssueSeverity
from audio_metadata import ProgramScheduleItem, AudioMetadata, AudioFormat

# 创建规则引擎
engine = RulesEngine()

# 创建测试节目单
items = [
    ProgramScheduleItem(
        item_id='P001',
        title='测试节目1',
        start_time='08:00:00',
        duration_seconds=60,
        audio_file='test1.mp3',
        item_type='program'
    ),
    ProgramScheduleItem(
        item_id='P002',
        title='测试节目2',
        start_time='08:00:30',  # 与上一个重叠
        duration_seconds=60,
        audio_file='test2.mp3',
        item_type='program'
    )
]

# 空音频元数据（模拟缺少文件）
audio_meta = {}

# 运行检查
result = engine.run_all_checks(schedule_items=items, audio_metadata=audio_meta)

# 验证检测到的问题
print('检测到问题数量:', len(result.issues))
print('严重问题数量:', result.critical_count)

# 应该检测到：
# 1. 两个缺少音频文件的问题
# 2. 一个时间线重叠问题
missing_issues = [i for i in result.issues if i.issue_type == IssueType.MISSING_AUDIO]
overlap_issues = [i for i in result.issues if i.issue_type == IssueType.TIMELINE_OVERLAP]

print('缺少音频问题:', len(missing_issues))
print('时间重叠问题:', len(overlap_issues))

assert len(missing_issues) == 2
assert len(overlap_issues) == 1

print('规则引擎测试通过!')
"
```

### 5. 测试状态存储

```bash
python -c "
import tempfile
import os
from state_store import StateStore
from rules_engine import QualityIssue, IssueType, IssueSeverity

# 创建状态存储
store = StateStore()

# 测试生成会话 ID
session_id = store.generate_session_id('/path/to/schedule.csv', '/path/to/audio')
print('生成的会话 ID:', session_id)
assert len(session_id) > 0

# 测试会话 ID 一致性
session_id2 = store.generate_session_id('/path/to/schedule.csv', '/path/to/audio')
assert session_id == session_id2, '相同路径应生成相同会话 ID'

# 测试创建新会话
with tempfile.TemporaryDirectory() as tmpdir:
    state = store.create_new_session(
        schedule_path='/test/schedule.csv',
        audio_dir='/test/audio',
        project_name='测试项目'
    )
    
    print('创建的会话:', state.session_id)
    assert state.project_name == '测试项目'
    assert state.schedule_csv_path == '/test/schedule.csv'
    
    print('状态存储测试通过!')
"
```

### 6. 启动 GUI 验证

```bash
python main_gui.py
```

预期行为：
- 出现标题为"播前音频质检台 v1.0.0"的窗口
- 窗口大小约为 1400x900 像素
- 包含菜单栏（文件、操作、导出、设置、帮助）
- 左侧显示排播时间线和音频文件列表
- 右侧显示质检问题列表
- 底部有日志区域和状态栏

## 模块说明

### main_gui.py
主 GUI 应用，基于 Python 内置的 tkinter 框架。负责：
- 界面布局和用户交互
- 协调各模块工作
- 后台线程处理音频分析

### audio_metadata.py
音频元数据解析模块，负责：
- 解析节目单 CSV
- 分析音频文件元数据（时长、采样率、声道等）
- 检测静音段（片头/片尾静音）
- 计算音量峰值和 RMS

### rules_engine.py
质检规则引擎，负责：
- 执行所有质检规则
- 生成质检问题列表
- 提供配置化的规则参数

### state_store.py
状态存储模块，负责：
- 保存和加载会话状态
- 记录问题处理意见
- 生成会话 ID（基于项目路径哈希）

### report_exporter.py
报告导出模块，负责：
- 生成 Markdown 格式质检报告
- 导出 CSV 格式问题清单
- 生成 JSON 格式审计记录

### sample_data.py
示例数据模块，负责：
- 生成示例节目单 CSV
- 生成模拟音频元数据
- 生成模拟质检问题
- 创建完整演示项目

## 常见问题

### Q: 为什么音频分析很慢？
A: 音频分析需要读取完整音频文件进行峰值计算和静音检测。大文件（如超过 100MB）可能需要较长时间。建议：
- 确保音频文件已压缩到合理大小
- 使用 SSD 存储提高读取速度

### Q: 支持哪些音频格式？
A: 默认支持 MP3、WAV、FLAC。如需支持其他格式（如 OGG、M4A），可修改 `QualityCheckConfig.allowed_formats` 配置。

### Q: 会话状态保存在哪里？
A: 默认保存在用户目录下的 `.quality_check_sessions` 文件夹中。每个会话对应一个 JSON 文件。

### Q: 如何修改默认质检参数？
A: 方式一：在 GUI 中点击 `设置` → `质检参数配置`；方式二：修改 `rules_engine.py` 中 `QualityCheckConfig` 类的默认值。

## 更新日志

### v1.0.0 (2026-05-03)
- 初始版本发布
- 实现核心质检功能
- 支持 14 项质检规则
- 支持三种报告导出格式
- 支持会话状态持久化

## 许可证

本项目仅供学习和内部使用。

## 联系方式

如有问题或建议，请联系开发团队。

---

**注意**：本工具需要真实音频文件才能进行完整的音频分析。演示模式使用模拟数据，仅供功能体验。
