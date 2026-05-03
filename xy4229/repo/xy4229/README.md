# 字幕无障碍校准台

为社区无障碍影院设计的字幕校准工具，帮助放映志愿者解决片源、字幕和现场听障观众反馈不一致的问题。

## 功能特性

### 自动检查
- **字幕延迟/过早**：检查字幕时间与视频时间码是否匹配
- **说话人漏标**：检测对话字幕是否缺少说话人标注
- **音效提示缺失**：检查环境音是否有对应的音效字幕
- **阅读速度过快**：检测中文字幕阅读速度是否超过 5 字/秒
- **时间轴重叠**：检测相邻字幕时间是否重叠

### 偏移调整
- **全局偏移**：一次性调整所有字幕的时间
- **批量偏移**：调整指定范围内字幕的时间
- **单条偏移**：调整单个字幕的时间
- **智能建议**：基于视频时间码、观众反馈和检测问题自动建议偏移量

### 导出功能
- **修订后的 SRT 字幕**：导出校准后的字幕文件
- **Markdown 校准报告**：生成详细的校准报告
- **CSV 问题清单**：导出问题列表供后续参考

## 项目结构

```
xy4229/
├── main.py                    # 主入口文件
├── README.md                  # 本文档
├── src/
│   ├── __init__.py
│   ├── models/                # 数据模型
│   │   ├── __init__.py
│   │   └── models.py          # 数据结构定义
│   ├── parsers/               # 解析器
│   │   ├── __init__.py
│   │   ├── srt_parser.py      # SRT 字幕解析
│   │   ├── csv_parser.py      # CSV 文件解析
│   │   └── json_parser.py     # JSON 文件解析
│   ├── rules/                 # 规则引擎
│   │   ├── __init__.py
│   │   └── rules_engine.py    # 检查规则实现
│   ├── offset/                # 偏移计算
│   │   ├── __init__.py
│   │   └── offset_calculator.py
│   ├── gui/                   # GUI 界面
│   │   ├── __init__.py
│   │   └── main_window.py     # 主窗口
│   ├── persistence/           # 持久化
│   │   ├── __init__.py
│   │   └── project_manager.py # 项目保存/加载
│   └── io/                    # 导入导出
│       ├── __init__.py
│       └── exporter.py        # 各种格式导出
├── data/                      # 示例数据
│   ├── sample_subtitles.srt          # 示例字幕
│   ├── sample_timecodes.csv           # 示例时间码
│   ├── sample_audio_annotations.json  # 示例音频标注
│   └── sample_feedback.csv            # 示例反馈记录
└── tests/                     # 测试用例
    ├── test_parsers.py
    ├── test_rules.py
    └── test_offset.py
```

## 环境要求

- Python 3.7+
- tkinter (通常随 Python 一起安装)

## 快速开始

### 1. 启动应用

```bash
cd /path/to/xy4229
python3 main.py
```

### 2. 验证流程

#### 步骤 1：导入示例数据

1. 启动应用后，点击菜单 **导入 → 导入示例数据**
2. 或者手动导入以下文件（位于 `data/` 目录）：
   - `sample_subtitles.srt` - SRT 字幕文件
   - `sample_timecodes.csv` - 视频时间码
   - `sample_audio_annotations.json` - 环境音标注
   - `sample_feedback.csv` - 观众反馈记录

#### 步骤 2：运行分析

1. 点击工具栏的 **运行分析** 按钮，或按 `F5`
2. 观察中间的"检测问题"列表，应该能看到：
   - 字幕延迟问题
   - 说话人漏标问题
   - 阅读速度过快问题
   - 时间轴重叠问题
   - 音效提示缺失问题（如果有）

#### 步骤 3：查看统计信息

1. 点击右侧面板的 **统计** 标签页
2. 查看问题统计信息，包括：
   - 问题总数
   - 按问题类型分布
   - 按严重程度分布

#### 步骤 4：逐条复核问题

1. 在中间"检测问题"列表中选择一个问题
2. 右侧"详情"面板会显示：
   - 问题类型和严重程度
   - 问题描述
   - 建议修复方案
3. 双击问题可以定位到相关字幕

#### 步骤 5：应用偏移调整

1. 选择右侧面板的 **偏移调整** 标签页
2. 可以进行以下操作：
   - **全局偏移**：输入偏移值（秒），点击"应用"
   - **快速调整**：使用预设的快捷按钮（-1.0s, -0.5s, -0.1s, +0.1s, +0.5s, +1.0s）
   - **批量偏移**：指定开始/结束字幕索引和偏移值
   - **智能建议**：点击"获取智能建议"查看系统推荐的偏移

#### 步骤 6：标记问题已解决

1. 选择一个已处理的问题
2. 点击 **标记问题已解决** 按钮
3. 问题状态会变为"已解决"

#### 步骤 7：导出结果

1. 点击菜单 **导出 → 批量导出全部**
2. 选择输出目录
3. 系统会导出：
   - `项目名.srt` - 修订后的字幕
   - `项目名_report.md` - Markdown 格式校准报告
   - `项目名_issues.csv` - CSV 格式问题清单

### 3. 运行测试

```bash
# 运行所有测试
python3 -m pytest tests/ -v

# 运行特定测试
python3 -m pytest tests/test_parsers.py -v
python3 -m pytest tests/test_rules.py -v
python3 -m pytest tests/test_offset.py -v
```

## 数据格式说明

### SRT 字幕格式（标准格式）

```
1
00:00:01,000 --> 00:00:03,000
字幕内容

2
00:00:03,500 --> 00:00:05,000
[说话人] 带说话人标注的字幕
```

### 时间码 CSV 格式

| timecode | description | scene_type |
|----------|-------------|-------------|
| 00:00:05,000 | 对话开始 | dialogue |
| 00:00:12,000 | 敲门声 | sound_effect |

列说明：
- `timecode`：时间码（SRT 格式）
- `description`：描述
- `scene_type`：场景类型（dialogue, action, sound_effect, transition）

### 环境音标注 JSON 格式

```json
{
  "annotations": [
    {
      "index": 1,
      "start_time": "00:00:05.000",
      "end_time": "00:00:06.000",
      "sound_type": "effect",
      "description": "爆炸声",
      "volume": "loud"
    }
  ]
}
```

字段说明：
- `sound_type`：声音类型（music, dialogue, effect, ambient, silence）
- `volume`：音量（loud, normal, quiet）

### 反馈记录 CSV 格式

| timestamp | issue_type | description | reporter | severity |
|-----------|------------|-------------|----------|----------|
| 00:00:06.000 | 字幕延迟 | 字幕比说话晚了大约1秒 | 张观众 | 高 |

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+N | 新建项目 |
| Ctrl+O | 打开项目 |
| Ctrl+S | 保存项目 |
| F5 | 运行分析 |

## 规则配置

检查规则的阈值可以在 `src/rules/rules_engine.py` 中的 `RulesConfig` 类调整：

```python
class RulesConfig:
    SUBTITLE_DELAY_THRESHOLD_POSITIVE = 0.5  # 字幕延迟阈值（秒）
    SUBTITLE_DELAY_THRESHOLD_NEGATIVE = 2.0  # 字幕过早阈值（秒）
    MAX_READING_SPEED = 5.0                   # 最大阅读速度（字/秒）
    MIN_DURATION_PER_LINE = 1.5               # 每行最少显示时间（秒）
    OVERLAP_THRESHOLD = 0.1                   # 时间重叠阈值（秒）
```

## 使用场景示例

### 场景 1：新片源首次校准

1. 导入 SRT 字幕
2. 导入视频时间码（如果有）
3. 运行分析
4. 查看检测到的问题
5. 应用全局偏移或批量偏移
6. 逐条复核并处理问题
7. 导出修订后的字幕和报告

### 场景 2：根据观众反馈调整

1. 打开之前保存的项目
2. 导入观众反馈记录 CSV
3. 获取智能建议
4. 应用建议的偏移调整
5. 重新运行分析确认问题已解决
6. 导出更新后的字幕

### 场景 3：添加音效字幕

1. 导入环境音标注 JSON
2. 运行分析检测音效缺失
3. 手动添加或编辑音效字幕
4. 重新分析确认问题已解决
5. 保存项目

## 注意事项

1. **时间格式**：SRT 时间格式为 `HH:MM:SS,mmm`（逗号分隔毫秒）
2. **编码格式**：建议使用 UTF-8 编码保存文件
3. **说话人标注**：支持 `[姓名]`、`姓名：`、`【姓名】`、`(姓名)` 等格式
4. **音效字幕**：建议使用 `[音效名]` 格式标注

## 常见问题

**Q: 为什么检测不到字幕延迟？**
A: 需要导入视频时间码 CSV 文件才能进行时间对比。

**Q: 如何批量调整部分字幕？**
A: 使用"偏移调整"标签页中的"批量偏移"功能，指定开始和结束字幕索引。

**Q: 保存的项目文件格式是什么？**
A: 项目文件使用 `.scc` 扩展名，实际上是 JSON 格式，可以用文本编辑器打开查看。

**Q: 如何添加自定义检查规则？**
A: 在 `src/rules/rules_engine.py` 中添加新的检查方法，并在 `check_all()` 方法中调用。

## 许可证

本项目为社区无障碍影院公益项目，欢迎自由使用和修改。

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个工具。

---

**致力于为听障观众提供更好的观影体验**
