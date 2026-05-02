# 外业资料双向同步预演器

一个专门为外业测绘小组设计的本地端侧资料同步工具，解决人工拖文件带来的各种问题。

## 功能特性

- ✅ **安全同步** - 只执行无冲突的同步计划，冲突项自动隔离
- ✅ **SHA256校验** - 复制后自动校验文件完整性，确保数据准确
- ✅ **冲突检测** - 自动识别：
  - 同名文件内容不同
  - 大小写路径差异（Windows vs macOS/Linux）
  - mtime漂移（不同文件系统时间差异）
  - 符号链接跳出根目录（安全风险）
  - 重命名候选（相同内容不同路径）
- ✅ **Journal回滚** - 操作可撤销，目标被修改时会提示
- ✅ **报告导出** - 支持 Markdown 和 JSON 格式报告
- ✅ **历史查询** - 查看过去的扫描和同步记录

## 安装方式

### 方式一：源码安装（推荐）

```bash
# 克隆或下载项目
cd xy4033

# 安装依赖
pip install -e .
```

### 方式二：使用虚拟环境

```bash
# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate  # Windows

# 安装项目
pip install -e .
```

### 验证安装

```bash
field-sync --version
field-sync --help
```

## 命令说明

### init - 初始化同步配置

```bash
field-sync init --left /path/to/work --right /path/to/backup
```

**参数说明：**
- `--left, -l`: 左侧工作目录（笔记本端）
- `--right, -r`: 右侧备份目录（移动硬盘）
- `--output, -o`: 配置文件输出路径（默认 `.field-sync.json`）
- `--use-default-ignores`: 使用默认忽略模式（默认开启）
- `--use-default-extensions`: 使用默认允许的文件扩展名（默认开启）

**默认忽略模式：**
- 隐藏文件（以 `.` 开头）
- `__pycache__` 目录
- 临时文件（`.tmp`, `.temp`, `~$*`）
- Office 锁定文件
- Windows `Thumbs.db`
- macOS `.DS_Store`

**默认允许的扩展名（测绘相关）：**
- 图片：`jpg, jpeg, png, tif, tiff, bmp`
- 数据：`csv, txt, json, xml, yaml, yml`
- 地理：`gpx, kml, kmz, shp, dbf, prj, shx`
- 文档：`pdf, doc, docx, xls, xlsx`
- 压缩：`zip, rar, 7z`

### scan - 扫描文件生成 manifest

```bash
field-sync scan
```

**参数说明：**
- `--config, -c`: 指定配置文件路径
- `--output-dir, -o`: Manifest 输出目录
- `--left-only`: 只扫描左侧
- `--right-only`: 只扫描右侧

**扫描内容：**
- 文件相对路径
- 文件大小
- 修改时间（mtime）
- SHA256 哈希值
- 文件类型
- 符号链接检测

### plan - 生成 dry-run 同步计划

```bash
field-sync plan
```

**参数说明：**
- `--config, -c`: 指定配置文件路径
- `--left-manifest, -l`: 指定左侧 manifest 文件
- `--right-manifest, -r`: 指定右侧 manifest 文件
- `--output, -o`: 计划输出路径
- `--save-quarantine, -q`: 保存冲突到 quarantine（默认开启）

**计划包含：**
- 新增文件（左→右 或 右→左 复制）
- 修改文件（内容不同 → 冲突）
- 删除文件
- 重命名候选
- 各种冲突项（隔离到 quarantine.json）

### apply - 执行同步计划

```bash
field-sync apply
```

**参数说明：**
- `--config, -c`: 指定配置文件路径
- `--plan, -p`: 指定计划文件路径
- `--dry-run, -n`: 仅预览，不实际执行
- `--force, -f`: 强制执行（即使有冲突，不推荐）

**执行流程：**
1. 检查计划是否包含冲突
2. 备份目标文件（如果存在）
3. 写入 journal
4. 执行操作（复制/删除/重命名）
5. 校验 SHA256
6. 更新状态

### undo - 回滚最近一次同步

```bash
field-sync undo
```

**参数说明：**
- `--config, -c`: 指定配置文件路径
- `--journal, -j`: 指定 journal 文件路径
- `--dry-run, -n`: 仅预览，不实际执行
- `--force, -f`: 强制撤销，即使检测到文件被修改

**回滚规则：**
- 复制操作 → 删除新增文件 或 从备份恢复
- 删除操作 → 从备份恢复
- 重命名操作 → 撤销重命名
- 如果目标文件被用户修改 → 停止并提示

### report - 导出同步报告

```bash
field-sync report --type scan --format both
```

**参数说明：**
- `--config, -c`: 指定配置文件路径
- `--type, -t`: 报告类型（`scan` 或 `plan`）
- `--format, -f`: 输出格式（`markdown`, `json`, `both`）
- `--output, -o`: 输出文件路径
- `--left-manifest, -l`: 左侧 manifest 路径
- `--right-manifest, -r`: 右侧 manifest 路径
- `--plan-path, -p`: 计划文件路径

### history - 查询历史记录

```bash
field-sync history --limit 20
```

**参数说明：**
- `--config, -c`: 指定配置文件路径
- `--limit, -n`: 显示最近 N 条记录（默认 10）
- `--type, -t`: 记录类型（`all`, `scan`, `plan`, `journal`）

## 完整流程验证示例

以下是一个完整的测试流程，使用临时目录验证所有功能。

### 步骤 1：创建测试目录和文件

```bash
# 创建测试目录
mkdir -p /tmp/field_sync_test/work
mkdir -p /tmp/field_sync_test/backup

# 在工作目录创建一些测试文件
cd /tmp/field_sync_test

# 照片文件
echo "Photo content 1" > work/photo_001.jpg
echo "Photo content 2" > work/photo_002.jpg

# 点位数据
echo "id,name,lon,lat" > work/points.csv
echo "1,控制点A,116.3,39.9" >> work/points.csv
echo "2,控制点B,116.4,39.8" >> work/points.csv

# 航线数据
echo "航线规划数据" > work/route.kml

# 手写记录
echo "今日记录：天气晴朗，能见度良好" > work/notes.txt
```

### 步骤 2：初始化配置

```bash
cd /tmp/field_sync_test

field-sync init \
  --left /tmp/field_sync_test/work \
  --right /tmp/field_sync_test/backup
```

查看生成的配置文件：
```bash
cat .field-sync.json
```

### 步骤 3：首次扫描

```bash
field-sync scan
```

预期输出：
- 左侧：5 个文件
- 右侧：0 个文件

查看生成的 manifest：
```bash
ls -la .field-sync/manifests/
```

### 步骤 4：生成同步计划

```bash
field-sync plan
```

预期输出：
- 待执行操作：5 个（全部从左侧复制到右侧）
- 冲突数：0
- 状态：计划就绪

### 步骤 5：执行同步

```bash
field-sync apply
```

预期输出：
- 执行 5 个操作
- SHA256 校验通过
- Journal 已记录

验证备份目录：
```bash
ls -la backup/
cat backup/photo_001.jpg
```

### 步骤 6：修改文件并再次扫描

```bash
# 修改工作目录的文件
echo "Updated photo content" > work/photo_001.jpg
echo "3,控制点C,116.5,39.7" >> work/points.csv

# 在备份目录新增文件
echo "Old backup note" > backup/old_note.txt

# 再次扫描
field-sync scan
```

### 步骤 7：查看冲突计划

```bash
field-sync plan
```

预期输出：
- 冲突：1 个（photo_001.jpg 内容不同）
- 待执行操作：
  - points.csv：左侧修改 → 冲突？不，实际是内容不同 → 冲突
  - old_note.txt：右侧新增 → 复制到左侧

查看隔离的冲突：
```bash
ls -la .field-sync/quarantine/
cat .field-sync/quarantine/quarantine_latest.json
```

### 步骤 8：导出报告

```bash
# 导出扫描报告
field-sync report --type scan --format markdown

# 导出计划报告
field-sync report --type plan --format both
```

查看报告：
```bash
ls -la .field-sync/logs/reports/
cat .field-sync/logs/reports/report_plan_*.md
```

### 步骤 9：查看历史记录

```bash
field-sync history
```

### 步骤 10：回滚操作

```bash
# 查看最近一次 journal
field-sync undo --dry-run

# 实际回滚
field-sync undo
```

验证回滚结果：
```bash
ls -la backup/
```

## 冲突类型说明

| 冲突类型 | 说明 | 处理方式 |
|---------|------|---------|
| `case_only_difference` | 大小写仅差异 | 隔离，需手动重命名 |
| `same_path_different_content` | 同路径不同内容 | 隔离，需手动处理 |
| `mtime_drift` | mtime漂移 | 警告，内容相同不影响 |
| `symlink_escapes_root` | 符号链接跳出根目录 | 隔离，安全风险 |
| `rename_candidate` | 重命名候选 | 提示，可能是重命名操作 |

## 配置文件详解

`.field-sync.json` 配置文件结构：

```json
{
  "version": "1.0",
  "left_dir": "/path/to/work",
  "right_dir": "/path/to/backup",
  "ignore_patterns": [
    ".*",
    "__pycache__",
    "*.tmp"
  ],
  "allowed_extensions": [
    "jpg", "csv", "kml"
  ],
  "conflict_strategy": {
    "on_case_conflict": "quarantine",
    "on_content_conflict": "quarantine",
    "on_mtime_drift": "warn",
    "on_renamed_candidate": "ask"
  },
  "log_dir": ".field-sync/logs",
  "manifest_dir": ".field-sync/manifests",
  "plan_dir": ".field-sync/plans",
  "journal_dir": ".field-sync/journals",
  "quarantine_dir": ".field-sync/quarantine"
}
```

## 目录结构

```
field_sync/
├── __init__.py          # 版本信息
├── cli.py               # CLI 入口
├── config.py            # 配置模型
├── models.py            # 数据模型（Manifest, FileInfo 等）
├── scanner.py           # 文件扫描器
├── planner.py           # 计划生成器
├── conflict.py          # 冲突管理
├── executor.py          # 同步执行器
├── journal.py           # Journal 管理（回滚）
└── reporter.py          # 报告导出
```

## 注意事项

1. **大小写敏感**：Windows 不区分大小写，macOS/Linux 区分。工具会检测这种情况并隔离。

2. **文件系统差异**：不同文件系统（NTFS, APFS, ext4）的 mtime 精度不同，可能导致 mtime 漂移。

3. **符号链接**：出于安全考虑，指向目录外的符号链接会被检测为冲突。

4. **SHA256 计算**：大文件计算哈希需要时间，请耐心等待。

5. **强制选项**：`--force` 选项会跳过冲突检查，可能导致数据覆盖，请谨慎使用。

## 开发说明

### 运行测试

```bash
pip install -e ".[dev]"
pytest tests/ -v
```

### 代码结构

- **配置层**：`config.py` - 配置管理
- **数据层**：`models.py` - 数据模型定义
- **扫描层**：`scanner.py` - 文件系统扫描
- **计划层**：`planner.py` - 同步计划生成
- **执行层**：`executor.py`, `journal.py` - 执行和回滚
- **报告层**：`reporter.py` - 报告导出
- **入口层**：`cli.py` - 命令行接口

## License

MIT License

## 问题反馈

如有问题或建议，请提交 Issue 或 PR。
