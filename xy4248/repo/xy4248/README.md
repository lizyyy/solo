# 野外录音交付整理箱 (Field Recording Delivery Organizer)

一个为纪录片收音师设计的本地端侧工具，用于管理野外录音素材。

## 功能特性

- 📁 **文件扫描**：自动扫描素材目录，识别音频文件、场记CSV和备注文件
- 🎵 **音频元数据提取**：提取音频文件的技术参数（采样率、位深、时长、时间码等）
- 📝 **场记解析**：解析CSV格式的场记文件，自动识别场号、镜号、时间码
- ✅ **规则校验**：检查命名规范、时长合理性、采样率、时间码匹配、备注缺失
- 🏷️ **人工标记**：支持标记素材状态（可用/需返录/含隐私）
- 📤 **报告导出**：导出Markdown交付单、CSV问题清单、JSON证据包

## 安装

### 系统要求
- Python 3.8+
- pip 包管理器

### 安装步骤

1. 安装依赖：
```bash
pip install -r requirements.txt
```

2. 验证安装：
```bash
python -m field_recording_tool --help
```

## 快速开始

### 使用示例数据验证

工具内置了生成示例数据的功能，可以快速体验完整流程。

#### 1. 生成示例数据

```bash
python -m field_recording_tool generate-example ./example_project
```

这将在 `./example_project` 目录下创建：
- `audio/` 目录：包含多个模拟音频文件（WAV格式文件头）
- `field_log.csv`：场记文件示例
- `director_notes.txt`：导演临时备注示例

#### 2. 扫描素材目录

```bash
python -m field_recording_tool scan -p ./example_project
```

输出示例：
```
🔍 开始扫描目录: ./example_project
   递归扫描: 是

📊 扫描结果:
   总文件数: 9
   音频文件: 7
   场记文件: 1
   备注文件: 1

⚠️  发现 1 组重复文件:
   - Scene01_Shot01_Take01_环境声.wav, Scene01_Shot01_Take01_环境声_副本.wav

✅ 索引已保存到: ./example_project/.field_recording_index.json
```

#### 3. 解析场记文件

```bash
python -m field_recording_tool parse-log -p ./example_project
```

输出示例：
```
📝 开始解析场记文件...
   解析: ./example_project/field_log.csv
      总条目数: 5
      好条数: 2
      场景数: 3

✅ 场记已保存到项目状态
```

#### 4. 执行规则校验

```bash
python -m field_recording_tool validate -p ./example_project
```

输出示例：
```
🔍 开始执行规则校验...

📊 校验结果:
   校验文件数: 7
   总问题数: 18
   🔴 错误: 0
   🟡 警告: 12
   🔵 提示: 6
```

添加 `-v` 参数查看详细问题：
```bash
python -m field_recording_tool validate -p ./example_project -v
```

#### 5. 查看项目状态

```bash
python -m field_recording_tool status -p ./example_project
```

输出示例：
```
📊 项目状态:
   项目目录: ./example_project

   素材统计:
      总数: 7
      ✅ 可用: 0
      🔄 需返录: 0
      🔒 含隐私: 0
      ⏳ 待处理: 7

   分类统计:
      🌿 环境声: 0
      🎙️ 补录声: 0
```

添加 `-d` 参数查看详细素材列表：
```bash
python -m field_recording_tool status -p ./example_project -d
```

#### 6. 标记素材状态

标记素材为可用：
```bash
python -m field_recording_tool tag -p ./example_project Scene01_Shot01_Take01_环境声.wav -s available
```

标记素材为需返录：
```bash
python -m field_recording_tool tag -p ./example_project Scene01_Shot01_Take02.wav -s need_rerecord -n "有汽车噪音，需要补录"
```

标记素材为含隐私：
```bash
python -m field_recording_tool tag -p ./example_project Scene03_Shot01_私密对话.wav -s has_privacy --tag "敏感内容"
```

标记为环境声：
```bash
python -m field_recording_tool tag -p ./example_project Scene02_Shot01_市场环境.wav -s available --environment
```

#### 7. 导出报告

导出所有格式的报告：
```bash
python -m field_recording_tool export -p ./example_project ./output
```

这将生成：
- `field_recording_delivery.md` - Markdown格式交付单
- `field_recording_delivery_materials.csv` - 素材状态清单
- `field_recording_delivery_evidence.json` - 完整JSON证据包

也可以指定导出特定格式：
```bash
# 仅导出Markdown
python -m field_recording_tool export -p ./example_project ./output -f markdown

# 仅导出JSON（包含完整元数据）
python -m field_recording_tool export -p ./example_project ./output -f json --full-metadata
```

## 完整工作流程示例

### 标准工作流程

1. **准备素材目录结构**：
```
拍摄素材_20240115/
├── audio/
│   ├── Scene01_Shot01_Take01_环境声.wav
│   ├── Scene01_Shot01_Take02.wav
│   ├── Scene01_Shot02_Take01_采访.wav
│   └── ...
├── field_log.csv
├── director_notes.txt
└── camera_log.xlsx
```

2. **扫描并建立索引**：
```bash
python -m field_recording_tool scan -p ./拍摄素材_20240115
```

3. **解析场记文件**：
```bash
python -m field_recording_tool parse-log -p ./拍摄素材_20240115
```

4. **执行校验检查**：
```bash
python -m field_recording_tool validate -p ./拍摄素材_20240115 -v
```

5. **人工审核并标记**：
```bash
# 标记可用素材
python -m field_recording_tool tag -p ./拍摄素材_20240115 Scene01_Shot01_Take01_环境声.wav -s available

# 标记需返录
python -m field_recording_tool tag -p ./拍摄素材_20240115 Scene01_Shot01_Take02.wav -s need_rerecord -n "背景有飞机噪音"

# 标记含隐私
python -m field_recording_tool tag -p ./拍摄素材_20240115 Scene03_Shot01.wav -s has_privacy -n "包含个人隐私信息"
```

6. **导出交付报告**：
```bash
python -m field_recording_tool export -p ./拍摄素材_20240115 ./交付报告_20240115
```

## 命令参考

### 全局选项

| 选项 | 缩写 | 说明 |
|------|------|------|
| `--project-dir` | `-p` | 指定项目目录（素材所在目录） |
| `--help` | `-h` | 显示帮助信息 |
| `--version` |  | 显示版本信息 |

### scan 命令

扫描素材目录，建立文件索引。

```bash
python -m field_recording_tool scan [OPTIONS]
```

| 选项 | 说明 |
|------|------|
| `--recursive/--no-recursive` | 是否递归扫描子目录（默认：是） |
| `--verbose, -v` | 显示详细信息 |

### parse-log 命令

解析场记CSV文件。

```bash
python -m field_recording_tool parse-log [OPTIONS] [LOG_FILES]...
```

| 选项 | 说明 |
|------|------|
| `--verbose, -v` | 显示详细信息 |

**参数说明**：
- `LOG_FILES`：可选，指定一个或多个场记文件路径。如不指定，将从项目目录自动发现。

### validate 命令

执行规则校验。

```bash
python -m field_recording_tool validate [OPTIONS]
```

| 选项 | 说明 |
|------|------|
| `--config, -c` | 自定义校验配置文件（JSON格式） |
| `--verbose, -v` | 显示详细问题信息 |

### tag 命令

标记素材状态。

```bash
python -m field_recording_tool tag [OPTIONS] FILE_IDENTIFIER
```

| 选项 | 说明 |
|------|------|
| `--status, -s` | **必填**，设置状态：available/need_rerecord/has_privacy/pending |
| `--tag, -t` | 添加自定义标签（可多次使用） |
| `--note, -n` | 添加备注 |
| `--environment/--no-environment` | 标记为环境声 |
| `--wild/--no-wild` | 标记为补录声 |

**参数说明**：
- `FILE_IDENTIFIER`：文件名或文件哈希

### status 命令

查看当前项目状态。

```bash
python -m field_recording_tool status [OPTIONS]
```

| 选项 | 说明 |
|------|------|
| `--detail, -d` | 显示详细素材列表 |

### export 命令

导出交付报告。

```bash
python -m field_recording_tool export [OPTIONS] OUTPUT_DIR
```

| 选项 | 说明 |
|------|------|
| `--name, -n` | 输出文件名前缀（默认：field_recording_delivery） |
| `--format, -f` | 导出格式：all/markdown/csv/json（默认：all） |
| `--full-metadata` | JSON导出包含完整元数据 |
| `--verbose, -v` | 显示详细信息 |

**参数说明**：
- `OUTPUT_DIR`：输出目录路径

### generate-example 命令

生成示例数据目录（用于测试）。

```bash
python -m field_recording_tool generate-example [OPTIONS] TARGET_DIR
```

| 选项 | 说明 |
|------|------|
| `--verbose, -v` | 显示详细信息 |

**参数说明**：
- `TARGET_DIR`：目标目录路径

## 校验规则说明

### 命名规范检查

- 检查文件名是否包含不推荐的字符（空格、特殊字符）
- 检查是否符合推荐的命名模式
- 检查文件名是否包含场景/镜头/时间码标识

**推荐命名格式**：
```
Scene{场号}_Shot{镜号}_Take{条数}_{描述}_{日期时间}.{扩展名}
```

示例：
- `Scene01_Shot01_Take01_环境声_20240115_093000.wav`
- `Scene01_Shot02_Take03_主角采访.wav`

### 技术参数检查

- 采样率：推荐使用 48kHz 或 96kHz（专业制作标准）
- 位深：推荐使用 24bit
- 时长合理性：检查是否过短（<1秒）或过长（>1小时）

### 时间码检查

- 检查音频文件是否包含嵌入的时间码元数据
- 检查时间码格式是否规范

### 备注缺失检查

- 检查音频文件元数据是否包含描述或备注
- 检查文件名是否具有描述性

### 重复文件检测

- 基于文件哈希值检测重复文件
- 支持识别内容完全相同但文件名不同的重复

## 状态说明

### 素材状态

| 状态 | 说明 |
|------|------|
| `pending` | 待处理（默认状态） |
| `available` | 可用（质量良好，可以交付） |
| `need_rerecord` | 需返录（存在问题，需要重新录制） |
| `has_privacy` | 含隐私（包含敏感或隐私内容，需要特殊处理） |

### 分类标记

| 标记 | 说明 |
|------|------|
| `is_environment` | 环境声（氛围音、背景音） |
| `is_wild_track` | 补录声（后期补录的声音） |

## 输出文件说明

### Markdown交付单 (.md)

适合阅读和分享的格式，包含：
- 项目概览
- 素材统计
- 按状态分类的素材列表
- 问题详情（按类别分组）

### CSV问题清单 (_issues.csv)

适合进一步处理的格式，包含：
- 问题ID
- 严重程度
- 类别
- 消息
- 文件名
- 建议

### CSV素材清单 (_materials.csv)

包含所有素材的状态信息：
- 文件名
- 文件路径
- 状态
- 环境声标记
- 补录声标记
- 标签
- 备注

### JSON证据包 (_evidence.json)

完整的结构化数据，包含：
- 包信息（版本、生成时间）
- 扫描摘要
- 校验摘要
- 所有素材信息
- 场记数据
- 统计信息

添加 `--full-metadata` 选项时还包含完整的音频元数据。

## 本地索引文件

工具会在项目目录下创建一个隐藏的索引文件：
```
.project_dir/.field_recording_index.json
```

这个文件包含：
- 所有素材的状态和元数据
- 场记信息
- 校验摘要
- 版本信息

**注意**：建议将此文件添加到版本控制，以便团队协作。

## 开发

### 项目结构

```
xy4248/
├── field_recording_tool/
│   ├── __init__.py          # 包初始化
│   ├── __main__.py          # 模块入口
│   ├── main.py              # 主程序（命令行界面）
│   ├── file_scanner.py      # 文件扫描模块
│   ├── audio_metadata.py    # 音频元数据模块
│   ├── field_log_parser.py  # 场记解析模块
│   ├── validator.py         # 规则校验模块
│   ├── state_store.py       # 状态存储模块
│   └── exporter.py          # 报告导出模块
├── tests/
│   ├── __init__.py
│   ├── test_file_scanner.py
│   ├── test_field_log_parser.py
│   └── test_state_store.py
├── requirements.txt
└── README.md
```

### 运行测试

```bash
pytest tests/ -v
```

或者运行特定模块的测试：
```bash
pytest tests/test_file_scanner.py -v
pytest tests/test_field_log_parser.py -v
pytest tests/test_state_store.py -v
```

## 常见问题

### Q: 支持哪些音频格式？

A: 支持的音频格式包括：
- WAV (.wav)
- MP3 (.mp3)
- AIFF (.aiff, .aif)
- FLAC (.flac)
- OGG (.ogg)
- M4A (.m4a)
- WMA (.wma)

### Q: 场记CSV需要什么格式？

A: 工具支持多种常见的列名格式，包括中英文。关键列名会自动识别：

| 内容 | 支持的列名 |
|------|-------------|
| 场号 | scene, scene_number, 场号, 场景, sc |
| 镜号 | shot, shot_number, 镜号, 镜头, sh |
| 条数 | take, take_number, 条数, tk |
| 开始时间码 | timecode_in, tc_in, start_tc, 开始时间码, 入点 |
| 结束时间码 | timecode_out, tc_out, end_tc, 结束时间码, 出点 |
| 好条 | good_take, is_good, 好条, 最佳, circle, 圈选 |
| 描述 | description, scene_description, 描述, 场景描述, 备注 |

### Q: 索引文件可以手动编辑吗？

A: 不建议手动编辑索引文件（`.field_recording_index.json`）。建议通过工具提供的命令进行操作，以确保数据完整性。

### Q: 如何处理大型项目？

A: 工具设计为本地端侧运行，支持处理大型项目：
- 文件哈希计算使用流式处理，不会一次性加载整个文件到内存
- 状态存储使用增量保存
- 导出功能支持分批次处理

## 更新日志

### v1.0.0 (2024-01-15)

- 初始版本发布
- 实现文件扫描功能
- 实现音频元数据提取
- 实现场记CSV解析
- 实现多维度规则校验
- 实现素材状态管理
- 实现三种格式的报告导出
- 提供完整的命令行界面
- 内置示例数据生成功能

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 Issue 或 Pull Request。
