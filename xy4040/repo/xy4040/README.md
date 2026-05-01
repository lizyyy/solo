# 素材回卡守门员 (Media Guardian)

一个用于安全、可靠地管理纪录片外拍素材从存储卡到归档存储的命令行工具。

## 功能特性

- **scan** - 扫描一个或多个卡目录，识别相机素材、录音文件、代理文件和边车文件
- **plan** - 根据项目配置生成拷贝计划，执行多种校验规则
- **copy** - 按计划执行可续传拷贝，使用哈希校验，支持 dry-run
- **verify** - 重新扫描目标目录并比对 manifest，输出漏拷、校验失败和多余文件
- **report** - 导出 Markdown 交接报告和 CSV 问题清单

## 解决的问题

拍摄回酒店后把多张 SD 卡里的视频、音频和字幕边车文件拷到移动硬盘时，最怕：

- ⚠️ **漏拷一段** - 文件数对不上，第二天才发现补不了
- ⚠️ **卡号混淆** - A 机和 B 机的卡搞混了
- ⚠️ **文件名重复覆盖** - 两张卡都叫 C0001.MP4，拷到同一个目录被覆盖
- ⚠️ **时间码错位** - 音视频时间窗没有对应

## 安装

### 环境要求

- Python 3.10 或更高版本

### 安装步骤

```bash
# 克隆或下载项目
cd media-guardian

# 安装依赖
pip install -e .

# 或者使用虚拟环境
python -m venv venv
source venv/bin/activate  # macOS/Linux
pip install -e .
```

### 可选依赖

安装以下工具可以获得更完整的元数据提取功能：

```bash
# FFmpeg (用于提取视频/音频元数据)
brew install ffmpeg  # macOS

# ExifTool (用于提取照片/视频 EXIF 信息)
brew install exiftool  # macOS
```

## 快速开始

以下步骤演示如何使用临时目录完整验证整个流程。

### 1. 生成示例素材

```bash
# 方法 1: 使用 CLI 命令
media-guardian generate-samples -o ./sample_data --num-cards 2 --num-clips 5

# 方法 2: 使用脚本
python scripts/generate_sample_data.py -o ./sample_data -c 2 -k 5
```

这会创建类似以下结构的目录：

```
sample_data/
├── A_SD_001/
│   ├── DCIM/
│   │   └── 100CANON/
│   │       ├── A_20240515_C0001.MP4
│   │       ├── A_20240515_C0001_proxy.mp4
│   │       ├── A_20240515_C0001.srt
│   │       ├── A_20240515_C0001.json
│   │       └── ...
│   ├── AUDIO/
│   │   └── AA0001.WAV
│   └── PRIVATE/
└── B_CFast_002/
    └── ...
```

### 2. 扫描存储卡

```bash
# 扫描所有卡
media-guardian scan ./sample_data/* -o ./output/manifest.json -v

# 或者指定卡号
media-guardian scan \
  ./sample_data/A_SD_001 \
  ./sample_data/B_CFast_002 \
  --card-ids CARD_A --card-ids CARD_B \
  --camera-ids A --camera-ids B \
  -o ./output/manifest.json
```

### 3. 生成拷贝计划

```bash
# 创建目标归档目录
mkdir -p ./archive

# 生成拷贝计划（会执行所有校验规则）
media-guardian plan ./output/manifest.json ./archive
```

如果发现问题，会显示：
- ❌ 严重错误（阻断性，必须修复才能继续）
- ⚠️ 警告（建议检查但不阻断）

### 4. 执行拷贝

```bash
# 先做一次 dry-run 看看会发生什么
media-guardian copy ./output/manifest.json --dry-run

# 实际执行拷贝（带哈希校验）
media-guardian copy ./output/manifest.json

# 如果拷贝中断，可以使用 resume 继续
media-guardian copy ./output/manifest.json --resume
```

### 5. 验证拷贝结果

```bash
# 重新扫描目标目录并与 manifest 比对
media-guardian verify ./output/manifest.json ./archive
```

输出会显示：
- ✓ 匹配的文件数
- ✗ 缺失的文件
- ⚠️ 多余的文件（目标有但源没有）
- 🔍 哈希不匹配的文件

### 6. 生成交接报告

```bash
# 生成 Markdown 报告和 CSV 清单
media-guardian report ./output/manifest.json -o ./output

# 指定文件名前缀
media-guardian report ./output/manifest.json -o ./output -p "20240515_外拍素材"
```

生成的文件：
- `20240515_外拍素材_report.md` - Markdown 交接报告
- `20240515_外拍素材_issues.csv` - 问题清单
- `20240515_外拍素材_file_list.csv` - 完整文件列表
- `20240515_外拍素材_copy_progress.csv` - 拷贝进度（如有）

## 命令详解

### scan 命令

扫描一个或多个存储卡目录，生成 manifest.json。

```bash
media-guardian scan [OPTIONS] DIRECTORIES...
```

**参数：**
- `DIRECTORIES` - 一个或多个存储卡目录路径

**选项：**
- `-i, --card-ids TEXT` - 卡号列表（与目录数量对应）
- `-m, --camera-ids TEXT` - 机位ID列表（与目录数量对应）
- `--no-metadata` - 不提取元数据（更快）
- `--no-hash` - 不计算哈希（更快，但无法做内容校验）
- `-o, --output PATH` - manifest 输出路径
- `-v, --verbose` - 详细输出

**示例：**
```bash
# 扫描单个卡
media-guardian scan /Volumes/SD_CARD -o manifest.json

# 扫描多个卡，指定卡号和机位
media-guardian scan \
  /Volumes/A_SD /Volumes/B_SD /Volumes/C_CFast \
  --card-ids A001 --card-ids B001 --card-ids C001 \
  --camera-ids A --camera-ids B --camera-ids C \
  -o manifest.json
```

### plan 命令

根据 manifest 生成拷贝计划，执行所有校验规则。

```bash
media-guardian plan [OPTIONS] MANIFEST_PATH TARGET_DIRECTORY
```

**参数：**
- `MANIFEST_PATH` - manifest.json 文件路径
- `TARGET_DIRECTORY` - 目标归档目录

**选项：**
- `-o, --output PATH` - 更新后的 manifest 输出路径
- `-f, --force` - 即使有错误也继续生成计划

**执行的校验规则：**

| 规则 | 严重程度 | 说明 |
|------|----------|------|
| 文件名重复但内容不同 | ERROR | 不同卡有相同文件名但哈希不同 |
| 文件名重复但内容相同 | WARNING | 不同卡有相同文件名但哈希相同 |
| 片段序号断档 | WARNING | 卡内片段序号不连续 |
| 缺少边车文件 | WARNING | 媒体文件没有对应的 .srt/.json |
| 时间码重叠 | WARNING | 相邻文件时间码有重叠 |
| 时间码间隙 | INFO | 相邻文件时间码有间隙 |
| 磁盘空间不足 | ERROR | 目标盘剩余空间不够 |
| 目标路径冲突 | ERROR | 多个源文件映射到同一目标路径 |

**示例：**
```bash
# 生成拷贝计划
media-guardian plan manifest.json /Volumes/Backup/Archive

# 即使有错误也继续
media-guardian plan manifest.json /Volumes/Backup/Archive -f
```

### copy 命令

按计划执行拷贝。

```bash
media-guardian copy [OPTIONS] MANIFEST_PATH
```

**参数：**
- `MANIFEST_PATH` - manifest.json 文件路径

**选项：**
- `-n, --dry-run` - 模拟执行，不实际拷贝
- `-r, --resume` - 从上次中断继续
- `--no-verify` - 跳过拷贝后的哈希校验
- `-w, --overwrite` - 覆盖已存在的文件（默认拒绝）
- `-o, --output PATH` - 更新后的 manifest 输出路径

**拷贝特性：**

1. **分块拷贝** - 使用配置的 chunk_size 分块读写
2. **临时文件** - 先写到 .tmp 文件，完成后重命名
3. **断点续传** - 如果中断，下次用 --resume 从断点继续
4. **智能跳过** - 如果目标文件已存在且哈希匹配，自动跳过
5. **安全覆盖** - 默认拒绝覆盖不同内容的文件

**示例：**
```bash
# 模拟执行
media-guardian copy manifest.json --dry-run

# 实际执行
media-guardian copy manifest.json

# 从断点继续
media-guardian copy manifest.json --resume

# 强制覆盖
media-guardian copy manifest.json --overwrite
```

### verify 命令

重新扫描目标目录并与 manifest 比对。

```bash
media-guardian verify [OPTIONS] MANIFEST_PATH TARGET_DIRECTORY
```

**参数：**
- `MANIFEST_PATH` - manifest.json 文件路径
- `TARGET_DIRECTORY` - 目标归档目录

**选项：**
- `-o, --output PATH` - 更新后的 manifest 输出路径

**验证内容：**
- **文件缺失** - 源有但目标没有
- **文件多余** - 目标有但源没有
- **哈希不匹配** - 文件名相同但内容不同

**示例：**
```bash
media-guardian verify manifest.json /Volumes/Backup/Archive
```

### report 命令

生成交接报告。

```bash
media-guardian report [OPTIONS] MANIFEST_PATH
```

**参数：**
- `MANIFEST_PATH` - manifest.json 文件路径

**选项：**
- `-o, --output-dir PATH` - 输出目录
- `-p, --prefix TEXT` - 文件名前缀
- `--no-markdown` - 不生成 Markdown 报告
- `--no-csv` - 不生成 CSV 文件
- `-n, --notes TEXT` - 备注信息

**报告内容：**

**Markdown 报告包含：**
1. 总览（项目名称、扫描时间、文件统计）
2. 存储卡详情（每卡的文件列表）
3. 问题清单（按严重程度分类）
4. 拷贝进度（如有）
5. 备注

**CSV 文件包含：**
- `*_issues.csv` - 所有问题的详细清单
- `*_file_list.csv` - 完整的文件列表（含元数据）
- `*_copy_progress.csv` - 拷贝进度详情

**示例：**
```bash
# 生成所有报告
media-guardian report manifest.json -o ./reports

# 指定前缀和备注
media-guardian report manifest.json \
  -o ./reports \
  -p "20240515_大理_第3天" \
  -n "A机: Sony FX3, B机: Canon C70, 录音: Sound Devices 888"
```

### generate-samples 命令

生成示例素材目录（用于测试）。

```bash
media-guardian generate-samples [OPTIONS]
```

**选项：**
- `-o, --output-dir PATH` - 输出目录（必需）
- `-c, --num-cards INTEGER` - 存储卡数量（默认 2）
- `-k, --num-clips INTEGER` - 每张卡的片段数量（默认 5）

**示例：**
```bash
# 生成 3 张卡，每张 10 个片段
media-guardian generate-samples -o ./test_data -c 3 -k 10
```

## 配置

### 配置文件格式

支持 JSON、TOML、YAML 格式。

```json
{
  "project_name": "我的纪录片项目",
  "shoot_date": "2024-05-15",
  "default_camera": "A",
  "file_types": {
    "video_extensions": [".mp4", ".mov", ".mxf", ".avi", ".mkv"],
    "audio_extensions": [".wav", ".aiff", ".mp3", ".flac", ".m4a"],
    "proxy_extensions": [".proxy.mp4", "_proxy.mp4"],
    "sidecar_extensions": [".srt", ".json", ".xml", ".csv"]
  },
  "archive": {
    "path_template": "{shoot_date}/{camera}/{card_number}",
    "date_format": "%Y-%m-%d",
    "create_subdirs": true
  },
  "hash": {
    "algorithm": "sha256",
    "chunk_size": 8192
  },
  "validation": {
    "check_sequence_gaps": true,
    "check_sidecar_presence": true,
    "check_timecode_overlap": true,
    "check_duplicate_filenames": true,
    "check_disk_space": true,
    "min_free_space_gb": 50
  }
}
```

### 归档路径模板

`path_template` 支持以下变量：
- `{shoot_date}` - 拍摄日期
- `{camera}` - 机位ID
- `{card_number}` - 卡号
- `{project_name}` - 项目名称

默认模板：`{shoot_date}/{camera}/{card_number}`

例如：`2024-05-15/A/CARD_001/`

### 配置文件查找

工具会自动查找以下配置文件：
- `media_guardian.json`
- `media_guardian.toml`
- `media_guardian.yaml`
- `.media_guardian.json`

查找顺序：当前目录 → 上级目录 → 根目录。

也可以使用 `--config` 选项指定配置文件：

```bash
media-guardian --config ./my_config.json scan ./cards/*
```

## 目录结构

```
media-guardian/
├── pyproject.toml          # 项目配置
├── README.md               # 本文档
├── .gitignore
├── src/
│   └── media_guardian/
│       ├── __init__.py
│       ├── main.py           # CLI 入口
│       ├── config.py         # 配置管理
│       ├── metadata.py       # 元数据提取
│       ├── scanner.py        # 文件扫描
│       ├── manifest.py       # Manifest 管理
│       ├── validator.py      # 规则校验和拷贝计划
│       ├── copier.py         # 拷贝执行
│       └── reporter.py       # 报告生成
├── scripts/
│   ├── __init__.py
│   └── generate_sample_data.py  # 示例素材生成脚本
├── tests/
│   ├── __init__.py
│   └── test_self.py          # 自检测试脚本
└── sample_data/              # 示例数据（运行后生成）
    ├── output/
    │   ├── manifest.json
    │   └── ...
    └── ...
```

## 自检和测试

### 运行自检测试

```bash
# 使用临时目录运行完整测试
python tests/test_self.py --temp-dir ./test_run

# 详细输出
python tests/test_self.py --temp-dir ./test_run --verbose

# 指定卡数和片段数
python tests/test_self.py --temp-dir ./test_run -c 3 -k 10

# 测试完成后保留临时目录
python tests/test_self.py --temp-dir ./test_run --keep-temp
```

### 测试流程

自检脚本会执行以下步骤：

1. **生成示例素材** - 创建模拟的存储卡目录
2. **扫描** - 执行 scan 命令生成 manifest
3. **计划** - 执行 plan 命令生成拷贝计划
4. **拷贝** - 执行 copy 命令拷贝文件
5. **验证** - 执行 verify 命令校验结果
6. **报告** - 执行 report 命令生成报告

### 使用 pytest

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest
```

## 常见问题

### Q: 为什么要先 scan 再 plan 再 copy？

这是为了确保在实际拷贝前：
1. 确认所有卡都已扫描，没有遗漏
2. 检查所有潜在问题（重复文件名、空间不足等）
3. 生成清晰的拷贝计划供审核

### Q: 拷贝中断后如何继续？

使用 `--resume` 选项：

```bash
media-guardian copy manifest.json --resume
```

工具会：
1. 读取 manifest 中的拷贝进度
2. 跳过已完成的文件
3. 对部分拷贝的文件从断点继续

### Q: 目标目录已存在同名文件怎么办？

默认行为：
- 如果文件大小相同 → 计算哈希比对
- 如果哈希匹配 → 自动跳过
- 如果哈希不同 → 拒绝覆盖，报错退出

可以使用 `--overwrite` 强制覆盖：

```bash
media-guardian copy manifest.json --overwrite
```

### Q: 如何处理不同卡的同名文件？

在 `plan` 阶段会检测：
- 如果同名但内容相同 → WARNING（建议但不阻断）
- 如果同名且内容不同 → ERROR（必须解决）

解决方案：
1. 使用不同的归档路径（通过 card_id 区分）
2. 手动重命名冲突文件
3. 使用 `--force` 强制继续（会覆盖，慎用）

### Q: 元数据提取失败怎么办？

工具使用了多层降级策略：

1. **优先** - FFmpeg（ffprobe）提取视频/音频元数据
2. **其次** - ExifTool 提取 EXIF 信息
3. **降级** - 使用文件系统信息（修改时间、文件名解析）

如果 FFmpeg 和 ExifTool 都没有安装，工具仍可正常工作，只是元数据信息会较少。

## 最佳实践

### 工作流程建议

1. **拍摄当天**
   ```bash
   # 1. 插入所有卡后先扫描
   media-guardian scan /Volumes/* -o manifest.json
   
   # 2. 生成拷贝计划检查问题
   media-guardian plan manifest.json /Volumes/Backup
   
   # 3. 如无问题，执行拷贝
   media-guardian copy manifest.json
   
   # 4. 验证拷贝结果
   media-guardian verify manifest.json /Volumes/Backup
   
   # 5. 生成交接报告
   media-guardian report manifest.json -o ./reports -p "20240515_第1天"
   ```

2. **拷贝中断后**
   ```bash
   # 从断点继续
   media-guardian copy manifest.json --resume
   ```

3. **第二天出发前**
   - 确认所有卡的 manifest 都已生成
   - 确认验证全部通过
   - 确认报告已生成并备份

### 命名规范建议

为了避免卡号混淆，建议：

1. **物理标记** - 每拍摄完一张卡，在卡上标注机位和日期
2. **目录命名** - 从卡拷贝到电脑时，目录名包含机位信息
   - 推荐：`A_SD_001_20240515`
   - 避免：`Untitled`、`NO NAME`

3. **使用 CLI 参数**
   ```bash
   media-guardian scan \
     ./A_CARD ./B_CARD \
     --card-ids A001 --card-ids B001 \
     --camera-ids A --camera-ids B
   ```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 PR！

---

**本工具由纪录片工作者为纪录片工作者开发。** 🎬

拍摄不易，素材无价，拷贝需谨慎。
