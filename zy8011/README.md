# 连锁门店巡检照片整理工具

一个用于整理连锁门店运营巡检照片的本地命令行工具。

## 功能特性

- **智能解析**: 从EXIF和文件名中提取时间、门店编码和点位信息
- **自动归档**: 按门店/日期/点位重命名并组织照片
- **问题检测**: 自动标记缺拍、重复、时间偏差和点位错配
- **历史追踪**: 使用SQLite维护处理历史记录
- **报告输出**: 生成问题CSV和Markdown复盘报告

## 安装

### 环境要求
- Python 3.8+

### 安装步骤

```bash
# 克隆或下载项目后，进入项目目录
cd zy8011

# 安装依赖
pip install -e .

# 开发环境（用于运行测试和生成测试照片）
pip install -e ".[dev]"
```

## 快速开始

### 1. 准备数据

项目已提供示例数据在 `examples/` 目录下：

```bash
examples/
├── store_rules.json          # 门店规则配置
├── inspection_list.csv       # 巡检清单
└── generate_test_photos.py   # 测试照片生成脚本
```

### 2. 生成测试照片

```bash
# 生成测试照片（需要安装开发依赖）
python examples/generate_test_photos.py --output examples/test_photos
```

### 3. 运行工具

```bash
# 基本用法
inspection-organizer \
    --photos examples/test_photos \
    --rules examples/store_rules.json \
    --inspection examples/inspection_list.csv \
    --output output

# 显示详细输出
inspection-organizer \
    -p examples/test_photos \
    -r examples/store_rules.json \
    -i examples/inspection_list.csv \
    -o output \
    -v

# 移动模式（不保留原文件）
inspection-organizer \
    -p examples/test_photos \
    -r examples/store_rules.json \
    -i examples/inspection_list.csv \
    -o output \
    --move

# 跳过归档，只检测问题
inspection-organizer \
    -p examples/test_photos \
    -r examples/store_rules.json \
    -i examples/inspection_list.csv \
    -o output \
    --skip-archive
```

## 命令行参数

| 参数 | 简写 | 必需 | 说明 |
|------|------|------|------|
| `--photos` | `-p` | 是 | 照片目录路径 |
| `--rules` | `-r` | 是 | 门店规则JSON文件路径 |
| `--inspection` | `-i` | 是 | 巡检清单CSV文件路径 |
| `--output` | `-o` | 是 | 输出目录路径 |
| `--db` | `-d` | 否 | SQLite数据库路径（默认: 输出目录/tracker.db） |
| `--move` | `-m` | 否 | 移动照片而不是复制（默认: 复制） |
| `--skip-archive` | | 否 | 跳过归档操作，只检测问题 |
| `--verbose` | `-v` | 否 | 显示详细输出 |

## 输入文件格式

### 1. 门店规则 JSON

```json
{
  "stores": [
    {
      "store_code": "SH001",
      "store_name": "上海南京路店",
      "checkpoints": ["入口", "收银台", "货架A", "货架B", "仓库", "卫生间", "消防设备"],
      "time_window": {
        "start": "09:00",
        "end": "21:00"
      },
      "photo_patterns": ["SH001", "上海南京路"],
      "checkpoint_patterns": {
        "入口": ["入口", "门口", "entrance", "door"],
        "收银台": ["收银", "收银台", "cashier", "checkout"]
      }
    }
  ],
  "global_settings": {
    "time_deviation_threshold_minutes": 30,
    "duplicate_detection_enabled": true,
    "exif_fallback_to_filename": true
  }
}
```

| 字段 | 说明 |
|------|------|
| `store_code` | 门店编码（唯一标识） |
| `store_name` | 门店名称 |
| `checkpoints` | 该门店的所有巡检点位 |
| `time_window` | 巡检时间窗口 |
| `photo_patterns` | 用于从文件名识别门店的关键词 |
| `checkpoint_patterns` | 用于从文件名识别点位的关键词映射 |

### 2. 巡检清单 CSV

```csv
门店编码,点位,是否必填,截止时间,备注
SH001,入口,是,2026-05-01,早班巡检
SH001,收银台,是,2026-05-01,早班巡检
SH001,货架A,是,2026-05-01,早班巡检
SH001,仓库,否,2026-05-01,抽查
```

| 列名 | 说明 |
|------|------|
| 门店编码 | 门店唯一标识 |
| 点位 | 巡检点位名称 |
| 是否必填 | "是"或"否"，决定是否检测缺拍 |
| 截止时间 | （可选）巡检截止时间 |
| 备注 | （可选）备注信息 |

### 3. 照片文件名格式

工具支持从以下文件名格式提取信息：

```
# 推荐格式
SH001_20260501_143000_入口.jpg
SH001_2026-05-01_收银台.jpg
SH001_货架A_20260501.jpg

# 也支持
20260501_SH001_入口.jpg
SH001-20260501-收银台.jpg
照片_230501_卫生间.jpg  # 短格式年份
```

## 输出说明

运行后会在输出目录生成以下内容：

```
output/
├── SH001/                          # 按门店分组
│   ├── 2026-05-01/                # 按日期分组
│   │   ├── 入口/
│   │   │   └── SH001_2026-05-01_入口_001.jpg
│   │   ├── 收银台/
│   │   └── ...
│   └── ...
├── SH002/
├── tracker.db                     # SQLite追踪数据库
├── issues.csv                     # 问题清单
├── photos_index.csv               # 照片索引
└── report.md                      # 复盘报告
```

### 问题类型

| 问题类型 | 严重程度 | 说明 |
|----------|----------|------|
| `missing_photo` | critical | 缺拍（必检点位无照片） |
| `time_deviation` | critical/warning | 时间偏差（不在巡检窗口内） |
| `duplicate_photo` | warning | 重复照片 |
| `checkpoint_mismatch` | warning | 点位错配 |
| `no_exif` | warning/info | EXIF缺失 |
| `name_conflict` | warning | 同名冲突 |
| `unknown_store` | warning | 未知门店 |
| `unknown_checkpoint` | warning | 未知点位 |

## 处理的特殊情况

### 1. EXIF缺失

- 优先从EXIF读取时间和门店信息
- 如果EXIF缺失，自动从文件名推断
- 会在报告中标记为 `no_exif` 问题

### 2. 同名冲突

- 检测相同门店/日期/点位的文件
- 比较文件哈希，完全相同则标记为重复
- 内容不同则自动添加序号（如 `_001`, `_002`）

### 3. 时间窗口

- 支持跨午夜的时间窗口（如 `22:00 - 02:00`）
- 根据偏差程度设置不同严重程度：
  - > 60分钟: critical
  - 30-60分钟: warning
  - < 30分钟: info

## 运行测试

```bash
# 运行所有单元测试
python -m pytest tests/ -v

# 运行特定测试文件
python -m pytest tests/test_filename_parser.py -v
python -m pytest tests/test_rule_manager.py -v
```

## 项目结构

```
zy8011/
├── inspection_organizer/
│   ├── __init__.py
│   ├── config.py              # 数据模型和配置
│   ├── photo_reader.py        # 照片读取和EXIF解析
│   ├── filename_parser.py     # 文件名解析
│   ├── archiver.py            # 照片归档
│   ├── rule_manager.py        # 规则管理
│   ├── issue_detector.py      # 问题检测
│   ├── tracker.py             # SQLite追踪
│   ├── output_generator.py    # 输出生成
│   └── cli.py                 # 命令行入口
├── examples/
│   ├── store_rules.json
│   ├── inspection_list.csv
│   └── generate_test_photos.py
├── tests/
│   ├── __init__.py
│   ├── test_filename_parser.py
│   └── test_rule_manager.py
├── setup.py
└── README.md
```

## 常见问题

**Q: 照片的EXIF时间和文件名时间不一致，以哪个为准？**

A: 优先使用EXIF时间，EXIF缺失时使用文件名时间。

**Q: 如何自定义门店编码和点位的识别规则？**

A: 在 `store_rules.json` 中修改 `photo_patterns` 和 `checkpoint_patterns`。

**Q: 如何查看历史处理记录？**

A: 可以使用SQLite工具打开 `tracker.db` 数据库，查询 `photos`、`issues` 和 `batches` 表。

## License

MIT License
