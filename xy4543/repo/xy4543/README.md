# 剧场音频检查工具 (Theater Audio Checker)

剧场后台每晚使用的本地命令行工具，用于自动检查第二天的音频系统配置，防止遗漏和错误。

## 功能特性

- **音频清单检查**：导入音频文件清单，检查响度是否达标、文件是否缺失、是否有重复引用
- **分区播放计划检查**：检查时段冲突、应急广播是否被占用
- **设备在线状态检查**：导入设备在线日志，检查离线设备
- **人工复核备注**：支持添加和管理人工复核备注
- **报告导出**：生成 Markdown 交班单和 JSON 明细文件
- **美观终端输出**：使用 Rich 库提供精美的表格和彩色输出

## 检查项

| 检查类型 | 严重程度 | 说明 |
|---------|---------|------|
| 响度不达标 | 严重/警告 | 音频响度超出目标范围 [-24, -16] dBFS |
| 时段冲突 | 严重 | 同一分区多个播放计划时间重叠 |
| 应急广播被占用 | 严重 | 疏散广播类型的音频被安排到常规播放计划 |
| 文件缺失 | 严重 | 音频文件路径不存在 |
| 重复文件 | 警告 | 多个音频项引用同一个文件路径 |
| 设备离线 | 严重 | 扬声器设备状态为离线 |
| 设备维护 | 警告 | 扬声器设备状态为维护中 |
| 无效音频引用 | 严重 | 播放计划引用不存在的音频ID |

## 安装

### 环境要求

- Python 3.8+
- pip 包管理器

### 安装步骤

```bash
# 1. 进入项目目录
cd /path/to/theater-audio-checker

# 2. 安装依赖
pip install -r requirements.txt
```

## 快速开始

### 1. 使用示例数据测试

项目附带了包含各种问题场景的示例数据，用于验证工具功能：

```bash
# 方式一：分别指定各数据文件
python cli.py check \
  --audio examples/audio_manifest.json \
  --schedule examples/zone_schedule.json \
  --device examples/device_log.json \
  --notes examples/review_notes.json \
  --output ./output \
  --date 2026-05-06

# 方式二：使用自动检查模式（推荐）
python cli.py auto examples/ --output ./output --date 2026-05-06
```

### 2. 查看输出

检查完成后，输出目录 `./output` 会包含：

- `handover_report_2026-05-06.md` - Markdown 格式交班单
- `check_detail_2026-05-06.json` - JSON 格式详细数据

### 3. 添加复核备注

```bash
# 对某个问题添加复核备注
python cli.py add-note \
  --type audio \
  --id A004 \
  --reviewer "王工程师" \
  --status pass \
  --comment "背景音乐响度偏低是有意设置，已确认符合要求" \
  --save ./my_notes.json
```

## 命令详解

### check 命令 - 执行完整检查

```bash
python cli.py check [OPTIONS]
```

**选项：**

| 选项 | 简写 | 说明 |
|------|------|------|
| `--audio PATH` | `-a` | 音频清单 JSON 文件路径 |
| `--schedule PATH` | `-s` | 分区播放计划 JSON 文件路径 |
| `--device PATH` | `-d` | 设备在线日志 JSON 文件路径 |
| `--notes PATH` | `-n` | 人工备注 JSON 文件路径（可选） |
| `--output PATH` | `-o` | 输出目录（默认：./output） |
| `--date DATE` | `-t` | 目标检查日期（YYYY-MM-DD，默认：今天） |
| `--no-report` | | 不生成报告文件，仅显示检查结果 |

### auto 命令 - 自动检查模式

```bash
python cli.py auto [OPTIONS] DATA_DIR
```

自动从指定目录查找数据文件（文件名需包含关键字）：

- `audio*.json` 或 `*manifest*.json` → 音频清单
- `*schedule*.json` 或 `*zone*.json` → 分区播放计划
- `*device*.json` 或 `*log*.json` → 设备在线日志
- `*note*.json` 或 `*review*.json` → 复核备注（可选）

**示例：**
```bash
# 自动检查 ./data 目录下的所有 JSON 文件
python cli.py auto ./data/ --output ./output
```

### add-note 命令 - 添加复核备注

```bash
python cli.py add-note [OPTIONS]
```

**选项：**

| 选项 | 简写 | 说明 |
|------|------|------|
| `--type TYPE` | `-t` | 项目类型：audio, schedule, device, issue（必需） |
| `--id ID` | `-i` | 关联项目ID（必需） |
| `--reviewer NAME` | `-r` | 复核人姓名（必需） |
| `--status STATUS` | `-s` | 复核状态：pass, fail, manual_review（必需） |
| `--comment TEXT` | `-c` | 复核意见（必需） |
| `--save PATH` | `-o` | 保存到指定文件 |

## 数据格式说明

### 1. 音频清单 (audio_manifest.json)

```json
{
  "version": "1.0",
  "audio_items": [
    {
      "audio_id": "A001",
      "name": "开场铃-标准",
      "audio_type": "opening_bell",
      "file_path": "/audio/bells/opening_standard.wav",
      "duration_seconds": 15.5,
      "loudness_dbfs": -20.0,
      "target_loudness_min": -24.0,
      "target_loudness_max": -16.0,
      "description": "描述信息",
      "created_at": "2026-05-01 10:00:00"
    }
  ]
}
```

**音频类型 (audio_type)：**
- `opening_bell` - 开场铃
- `tour_prompt` - 巡演提示音
- `evacuation` - 疏散广播（应急）
- `background` - 背景音乐
- `announcement` - 常规广播
- `other` - 其他

### 2. 分区播放计划 (zone_schedule.json)

```json
{
  "version": "1.0",
  "zone_schedules": [
    {
      "schedule_id": "S001",
      "zone_name": "大剧场",
      "audio_id": "A001",
      "start_time": "18:45:00",
      "end_time": "19:00:00",
      "date": null,
      "repeat_days": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      "is_override": false,
      "notes": "备注信息"
    }
  ]
}
```

### 3. 设备在线日志 (device_log.json)

```json
{
  "version": "1.0",
  "device_logs": [
    {
      "device_id": "D001",
      "zone_name": "大剧场",
      "device_name": "主扬声器阵列-左",
      "status": "online",
      "check_time": "2026-05-05 23:00:00",
      "response_time_ms": 15,
      "last_online_time": null,
      "notes": "正常"
    }
  ]
}
```

**设备状态 (status)：**
- `online` - 在线
- `offline` - 离线
- `maintenance` - 维护中

### 4. 复核备注 (review_notes.json)

```json
{
  "version": "1.0",
  "notes": [
    {
      "note_id": "N001",
      "item_type": "audio",
      "item_id": "A004",
      "reviewer": "张工程师",
      "review_time": "2026-05-05 22:15:00",
      "status": "manual_review",
      "comment": "复核意见内容",
      "attachments": []
    }
  ]
}
```

**复核状态 (status)：**
- `pass` - 通过
- `fail` - 未通过
- `manual_review` - 需要人工复核

## 验证命令

### 基础验证

```bash
# 1. 查看版本
python cli.py --version

# 2. 查看帮助
python cli.py --help
python cli.py check --help
python cli.py auto --help
python cli.py add-note --help
```

### 使用示例数据验证

```bash
# 使用示例数据运行完整检查
python cli.py auto examples/ --output ./test_output --date 2026-05-06

# 查看生成的报告
ls -la ./test_output/
cat ./test_output/handover_report_2026-05-06.md
```

### 预期输出示例

运行示例数据后，工具应该检测到以下问题：

**严重错误 (Critical)：**
1. 响度不达标 - A005 (常规广播-寻物启事)：-35 dBFS 远低于目标范围
2. 时段冲突 - 大剧场 S001 与 S002 (18:45-18:50 重叠)
3. 应急广播被占用 - S004 使用了疏散广播类型的音频
4. 文件缺失 - A007 引用的文件不存在
5. 设备离线 - D003 (大剧场中置扬声器)、D007 (走廊应急广播-2)
6. 无效音频引用 - S005 引用了不存在的 INVALID_ID

**警告 (Warning)：**
1. 响度警告 - A004 (背景音乐-开场前)：-28 dBFS 略低于目标
2. 重复文件 - A001 和 A006 引用了相同的文件路径
3. 设备维护 - D005 (小剧场主扩声系统)

## 项目结构

```
theater-audio-checker/
├── cli.py                          # 命令行入口
├── requirements.txt                # 依赖清单
├── README.md                       # 本文档
├── __init__.py
├── theater_audio_checker/
│   ├── __init__.py
│   ├── core.py                     # 核心业务逻辑
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py               # Pydantic 数据模型
│   ├── loaders/
│   │   ├── __init__.py
│   │   └── data_loader.py          # 数据加载器
│   ├── checkers/
│   │   ├── __init__.py
│   │   └── audio_checker.py        # 检查器实现
│   ├── exporters/
│   │   ├── __init__.py
│   │   └── exporter.py             # Markdown/JSON 导出器
│   └── notes/
│       ├── __init__.py
│       └── note_manager.py         # 备注管理器
├── examples/
│   ├── audio_manifest.json         # 音频清单示例
│   ├── zone_schedule.json          # 分区计划示例（含冲突）
│   ├── device_log.json             # 设备日志示例（含离线设备）
│   └── review_notes.json           # 复核备注示例
└── output/                         # 输出目录（运行时生成）
```

## 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 所有检查通过，无严重错误 |
| 1 | 发现严重错误需要处理 |
| 2 | 程序执行出错（如文件读取失败、参数错误等） |

## 使用建议

1. **每日检查流程：**
   ```bash
   # 1. 导出当天的设备在线日志到 device_log.json
   # 2. 确认音频清单和分区计划
   # 3. 运行检查
   python cli.py auto ./daily_data/ --output ./reports --date 2026-05-06
   
   # 4. 查看生成的交班单，处理发现的问题
   # 5. 添加复核备注
   python cli.py add-note --type issue --id <issue_id> --reviewer "您的名字" --status pass --comment "已处理"
   ```

2. **数据准备：**
   - 建议从音频系统导出数据时使用标准 JSON 格式
   - 确保文件路径使用绝对路径或相对于工作目录的正确路径
   - 响度值使用 dBFS 单位，目标范围建议 [-24, -16]

3. **应急广播保护：**
   - 始终将疏散广播的 `audio_type` 设为 `evacuation`
   - 工具会自动检测这类音频是否被错误安排到常规播放计划

## 许可证

内部使用工具，仅限剧场后台工作人员使用。
