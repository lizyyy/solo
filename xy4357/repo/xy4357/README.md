# Backup Checker - 本地备份巡检自动化工具

一个用于检查 NAS 和移动硬盘等存储设备之间照片备份完整性的自动化工具。

## 功能特性

- **文件指纹扫描**：计算文件 MD5/SHA256 哈希值，精确比较文件内容
- **智能差异检测**：
  - 检测目标目录缺失的文件（需要备份）
  - 检测目标目录多余的文件（可能是旧文件）
  - 检测疑似重复文件（相同内容，不同位置）
  - 检测哈希不一致的文件（同名但内容不同）
- **SQLite 持久化存储**：保存所有巡检历史记录
- **多种报告格式**：支持 Markdown 和 HTML 报告生成
- **命令行界面**：完整的 CLI 工具链
- **Web 管理界面**：本地 HTTP 服务，可视化查看和管理
- **离线可用**：无需网络连接，完全本地运行

## 安装

### 环境要求

- Python 3.8+
- pip 包管理工具

### 安装步骤

1. 克隆或下载项目到本地
2. 安装依赖：

```bash
pip install -e .
```

或者使用虚拟环境：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

## 快速开始

### 1. 生成示例数据（可选）

项目已包含示例配置和数据，可直接用于测试：

```bash
# 如果需要重新生成示例数据
python3 generate_sample_data.py
```

### 2. 运行巡检

```bash
backup-checker check
```

这将扫描 `sample_data/source` 和 `sample_data/target` 目录，并检测差异。

### 3. 查看报告

```bash
backup-checker report
```

报告将生成在 `reports/` 目录下，包含 Markdown 和 HTML 两种格式。

### 4. 启动 Web 界面

```bash
backup-checker serve
```

然后访问 http://127.0.0.1:5000 查看可视化界面。

## 配置说明

### 配置文件格式

使用 YAML 格式配置备份任务。示例 `config.yaml`：

```yaml
db_path: backup_checker.db
reports_dir: reports
hash_type: md5
parallel: true
max_workers: 4

tasks:
  - name: family_photos_to_nas
    source_dir: ~/Photos/Family
    target_dir: /Volumes/NAS/Backup/FamilyPhotos
    retention_days: 90
    enabled: true

  - name: travel_photos_to_external
    source_dir: ~/Photos/Travel
    target_dir: /Volumes/ExternalHD/Backup/TravelPhotos
    retention_days: 0
    enabled: true
    extensions:
      - .jpg
      - .jpeg
      - .png
      - .raw
```

### 配置项说明

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `db_path` | SQLite 数据库文件路径 | `backup_checker.db` |
| `reports_dir` | 报告输出目录 | `reports` |
| `hash_type` | 哈希算法类型（md5/sha256） | `md5` |
| `parallel` | 是否启用并行扫描 | `true` |
| `max_workers` | 并行线程数 | `4` |

### 任务配置项

| 配置项 | 说明 |
|--------|------|
| `name` | 任务名称（唯一标识） |
| `source_dir` | 源目录路径（支持 `~` 展开） |
| `target_dir` | 目标目录路径（支持 `~` 展开） |
| `retention_days` | 保留天数（暂未实现自动清理） |
| `enabled` | 是否启用该任务 |
| `extensions` | 要扫描的文件扩展名列表（默认只扫描图片） |

## CLI 命令参考

### `backup-checker init`

初始化配置文件，生成示例配置。

```bash
backup-checker init [--output CONFIG_PATH]
```

选项：
- `--output, -o`: 输出配置文件路径（默认 `config.yaml`）

### `backup-checker check`

执行备份巡检，扫描并比较源目录和目标目录。

```bash
backup-checker check [--task TASK_NAME] [--quick] [--parallel/--no-parallel]
```

选项：
- `--task, -t`: 指定任务名称（不指定则运行所有启用的任务）
- `--quick, -q`: 快速模式，仅比较文件名和大小，不计算哈希
- `--parallel/--no-parallel`: 是否使用并行扫描

### `backup-checker report`

生成巡检报告。

```bash
backup-checker report [--comparison ID] [--scan ID] [--format FORMAT] [--output DIR]
```

选项：
- `--comparison, -c`: 指定比较记录 ID
- `--scan, -s`: 指定扫描记录 ID
- `--format, -f`: 报告格式（markdown/html/both，默认 both）
- `--output, -o`: 输出目录（默认 `reports/`）

### `backup-checker list`

列出任务或扫描记录。

```bash
backup-checker list [--tasks] [--scans] [--limit N]
```

选项：
- `--tasks`: 列出所有任务
- `--scans`: 列出最近的扫描记录
- `--limit, -n`: 显示记录数量（默认 10）

### `backup-checker confirm`

标记异常为已人工确认。

```bash
backup-checker confirm ANOMALY_ID
```

### `backup-checker serve`

启动本地 Web 服务器。

```bash
backup-checker serve [--host HOST] [--port PORT] [--debug]
```

选项：
- `--host, -h`: 绑定地址（默认 `127.0.0.1`）
- `--port, -p`: 绑定端口（默认 `5000`）
- `--debug, -d`: 调试模式

## Web 界面功能

启动 `backup-checker serve` 后访问 http://127.0.0.1:5000，可使用以下功能：

### 仪表盘
- 查看总扫描次数、待确认异常数、配置任务数
- 查看最近巡检记录列表
- 点击"详情"查看扫描详细信息

### 任务管理
- 查看所有已配置的任务列表
- 显示任务的源目录、目标目录、保留天数等信息

### 异常记录
- 按状态筛选（全部/待确认/已确认）
- 查看异常详情（类型、路径、创建时间）
- 一键标记异常为"已人工确认"

## 数据库结构

使用 SQLite 存储数据，包含以下表：

### `tasks` - 任务表
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER | 主键 |
| `name` | TEXT | 任务名称（唯一） |
| `source_dir` | TEXT | 源目录路径 |
| `target_dir` | TEXT | 目标目录路径 |
| `retention_days` | INTEGER | 保留天数 |
| `created_at` | TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMP | 更新时间 |

### `scans` - 扫描记录表
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER | 主键 |
| `task_id` | INTEGER | 关联任务 ID |
| `started_at` | TIMESTAMP | 开始时间 |
| `completed_at` | TIMESTAMP | 完成时间 |
| `source_files_count` | INTEGER | 源文件数 |
| `target_files_count` | INTEGER | 目标文件数 |
| `status` | TEXT | 状态（running/completed/failed） |
| `error_message` | TEXT | 错误信息 |

### `comparisons` - 比较记录表
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER | 主键 |
| `scan_id` | INTEGER | 关联扫描 ID |
| `missing_in_target` | INTEGER | 目标缺失数量 |
| `extra_in_target` | INTEGER | 目标多余数量 |
| `possible_duplicates` | INTEGER | 疑似重复数量 |
| `hash_mismatch` | INTEGER | 哈希不一致数量 |

### `anomalies` - 异常记录表
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER | 主键 |
| `comparison_id` | INTEGER | 关联比较 ID |
| `anomaly_type` | TEXT | 异常类型 |
| `source_path` | TEXT | 源路径 |
| `target_path` | TEXT | 目标路径 |
| `details` | TEXT | 详细信息 |
| `manually_confirmed` | INTEGER | 是否已人工确认 |
| `confirmed_at` | TIMESTAMP | 确认时间 |

### `file_records` - 文件记录表
存储每次扫描的文件详细信息（路径、大小、哈希值等）。

## 示例数据说明

`sample_data/` 目录包含预设的测试数据，用于演示各种异常场景：

```
sample_data/
├── source/                    # 源目录
│   └── 2024/
│       ├── summer/
│       │   ├── beach1.jpg     # 存在于目标
│       │   └── mountain.png   # 目标缺失
│       └── winter/
│           ├── forest.jpg     # 哈希不一致
│           └── beach1.jpg     # 源目录内重复
└── target/                    # 目标目录
    └── 2024/
        ├── summer/
        │   ├── beach1.jpg     # 与源一致
        │   └── sunset.png     # 目标多余
        └── winter/
            ├── forest.jpg     # 内容与源不同
            └── forest_copy.jpg# 目标目录内重复
```

运行 `backup-checker check` 后，预期会检测到：
- **目标缺失**: `mountain.png`
- **目标多余**: `sunset.png`
- **哈希不一致**: `winter/forest.jpg`（源和目标内容不同）
- **疑似重复**: 
  - 源目录：`beach1.jpg` 出现在 `summer/` 和 `winter/`
  - 目标目录：`forest.jpg` 和 `forest_copy.jpg` 内容相同

## 支持的图片格式

默认扫描以下图片格式：

- JPEG: `.jpg`, `.jpeg`
- PNG: `.png`
- GIF: `.gif`
- BMP: `.bmp`
- TIFF: `.tiff`, `.tif`
- WebP: `.webp`
- RAW: `.raw`, `.nef`, `.cr2`, `.arw`, `.dng`, `.orf`, `.rw2`, `.pef`, `.sr2`
- HEIC: `.heic`, `.heif`
- AVIF: `.avif`

可通过配置文件的 `extensions` 字段自定义要扫描的文件类型。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
