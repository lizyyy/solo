# 岩芯箱照片归档助手

地质勘探队用的本地自动化工具，自动整理岩芯箱照片、取样记录、GPS 轨迹和手写备注。

## 功能特性

- **自动扫描**: 扫描目录中的照片、CSV、GPX 和文本文件
- **智能解析**: 自动解析文件名中的孔号、箱号、深度区间
- **一致性校验**: 校验照片时间与 GPS 位置、CSV 深度区间、备注编号的一致性
- **冲突检测**: 将冲突和问题放入 `review.json` 供人工审核
- **规范归档**: 按孔号、箱号、深度段建立规范目录结构
- **回滚支持**: 支持回滚最近一次归档操作
- **报告生成**: 导出 Markdown 交接报告和 CSV 问题清单

## 项目结构

```
xy4284/
├── core/                    # 核心模块
│   ├── __init__.py
│   ├── scanner.py          # 扫描模块
│   ├── parser.py           # 解析模块
│   ├── validator.py        # 校验模块
│   ├── archiver.py         # 归档执行模块
│   ├── rollback.py         # 回滚模块
│   └── reporter.py         # 报告模块
├── sample_data/            # 示例数据
│   ├── 取样记录.csv
│   ├── gps轨迹.gpx
│   ├── 手写备注.txt
│   └── *.jpg               # 示例照片
├── config.py               # 配置文件
├── main.py                 # 主程序入口
└── README.md               # 本文档
```

## 环境要求

- Python 3.7+
- 无需额外依赖（使用 Python 标准库）

## 快速开始

### 1. 查看帮助信息

```bash
python main.py --help
```

### 2. 使用示例数据测试

```bash
python main.py --source ./sample_data --output ./output
```

### 3. 预览模式（不实际执行文件操作）

```bash
python main.py --source ./sample_data --output ./output --dry-run
```

### 4. 仅扫描校验（不执行归档）

```bash
python main.py --source ./sample_data --output ./output --no-archive
```

### 5. 回滚最近一次归档

```bash
python main.py --rollback --archive-dir ./output/archive
```

### 6. 预览回滚操作

```bash
python main.py --rollback --archive-dir ./output/archive --dry-run
```

## 完整验证流程

### 步骤 1: 准备数据目录

将野外采集的数据放入同一个目录，文件命名规范如下：

**照片文件命名格式**（推荐）：
```
ZK001_箱1_0-2m_岩芯照片.jpg
ZK001_箱1_2-4m_岩芯照片.jpg
ZK002_箱1_0-3m_岩芯照片.jpg
```

支持的孔号格式：
- `ZK001`, `ZK-001`, `zk001`
- `Hole-001`, `孔号: 001`

支持的箱号格式：
- `箱: 1`, `箱1`, `Box-1`
- `第1箱`, `1箱`

支持的深度区间格式：
- `0-2m`, `0~2m`, `0至2米`
- `0.00-2.00`

**CSV 文件格式**：
```csv
孔号,箱号,深度起始,深度结束,取样编号,样品类型,描述
ZK001,1,0.00,2.00,S001,岩芯,灰白色花岗岩
ZK001,1,2.00,4.00,S002,岩芯,灰色片麻岩
```

**GPX 文件**：标准 GPS 轨迹格式（1.0 或 1.1 版本）

**OCR 文本文件**：手写备注的 OCR 识别结果
```
备注：1
孔号：ZK001
箱号：1
深度：0-4米
岩芯描述：灰白色花岗岩，节理较发育...
```

### 步骤 2: 执行扫描和校验

```bash
python main.py --source ./your_data --output ./output --no-archive
```

这将执行：
1. 扫描目录中的所有文件
2. 解析 CSV、GPX、OCR 文本
3. 执行数据一致性校验
4. 生成 `review.json` 冲突报告

### 步骤 3: 检查冲突报告

打开 `./output/review.json` 查看发现的问题：

```json
{
  "review_time": "2026-05-03T10:30:00",
  "issue_summary": {
    "total": 3,
    "by_severity": {
      "error": 1,
      "warning": 2
    },
    "by_type": {
      "invalid_filename": 1,
      "missing_csv_record": 2
    }
  },
  "issues": [
    {
      "issue_type": "invalid_filename",
      "severity": "error",
      "message": "无法从文件名提取孔号: 无法识别孔号_照片.jpg",
      "file_name": "无法识别孔号_照片.jpg"
    }
  ]
}
```

同时查看 `./output/问题清单.csv` 获取完整的问题列表。

### 步骤 4: 修正数据问题

根据冲突报告修正数据文件：
- 重命名无法识别的照片文件
- 补充缺失的 CSV 记录
- 修正深度区间不匹配的问题

### 步骤 5: 执行完整归档

```bash
python main.py --source ./your_data --output ./output
```

这将执行完整流程：
1. 扫描 → 解析 → 校验
2. 建立归档计划
3. 执行文件复制
4. 生成 `manifest.json` 归档清单
5. 生成 `交接报告.md` 和 `问题清单.csv`

### 步骤 6: 检查归档结果

归档后的目录结构：
```
output/
├── archive/                    # 归档目录
│   ├── ZK001/                  # 孔号目录
│   │   ├── 箱号1/              # 箱号目录
│   │   │   ├── photos/         # 照片文件
│   │   │   │   └── ZK001_箱1_0.00-2.00m_103000.jpg
│   │   │   ├── notes/          # 备注文件
│   │   │   │   └── ZK001_箱1_备注_1.txt
│   │   │   └── ZK001_箱1_取样记录.csv
│   │   └── 箱号2/
│   ├── ZK002/
│   ├── gps_traces/             # GPS轨迹文件
│   ├── manifest.json           # 归档清单
│   └── rollback_log.json       # 回滚日志
├── review.json                 # 冲突报告
├── 交接报告.md                 # 交接报告
└── 问题清单.csv                # 问题清单
```

### 步骤 7: （如需）回滚操作

如果发现归档有误，可以回滚最近一次操作：

```bash
# 先预览回滚操作
python main.py --rollback --archive-dir ./output/archive --dry-run

# 确认后执行回滚
python main.py --rollback --archive-dir ./output/archive
```

## 配置说明

编辑 `config.py` 可调整以下参数：

```python
class ArchiveConfig:
    PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.tiff', '.tif']
    TEXT_EXTENSIONS = ['.txt', '.md']
    
    TIME_TOLERANCE_MINUTES = 30      # 时间容差（分钟）
    DEPTH_TOLERANCE = 0.5             # 深度容差（米）
    LOCATION_TOLERANCE_METERS = 100.0 # 位置容差（米）
    
    ARCHIVE_ROOT = './archive'        # 默认归档根目录
```

## 校验规则

### 时间校验
- 照片拍摄时间应在 GPS 轨迹时间范围内
- 容差：30 分钟（可配置）

### 位置校验
- 照片时间点的 GPS 位置应在钻孔附近
- 容差：100 米（可配置）

### 深度校验
- 照片文件名中的深度区间应与 CSV 记录重叠
- 容差：0.5 米（可配置）

### 交叉校验
- 所有照片应有对应的 CSV 记录
- 所有 CSV 记录应有对应的照片（提示级别）
- 备注编号应与孔号、箱号匹配

## 问题类型说明

| 问题类型 | 严重程度 | 说明 |
|---------|---------|------|
| invalid_filename | error | 无法从文件名提取孔号 |
| missing_csv_record | warning | 有照片但无对应 CSV 记录 |
| depth_mismatch | warning | 深度区间不匹配 |
| time_out_of_range | warning | 照片时间超出 GPS 范围 |
| box_number_mismatch | warning | 箱号不匹配 |
| hole_number_mismatch | warning | 孔号不匹配 |

## 示例数据说明

`sample_data/` 目录包含测试用的示例数据：

- **正常数据**：
  - 7 张命名规范的照片（ZK001 箱1-2，ZK002 箱1-2）
  - `取样记录.csv` - 对应 2 个孔号的 7 条记录
  - `gps轨迹.gpx` - 包含 2 个钻孔位置和工作轨迹
  - `手写备注.txt` - 包含 4 条手写备注

- **问题数据**（用于测试校验功能）：
  - `无法识别孔号_照片.jpg` - 无法提取孔号的文件名
  - `ZK001_箱3_8-10m_无CSV记录.jpg` - 有照片但无 CSV 记录

## 输出文件说明

### review.json
完整的校验报告，包含所有发现的问题和统计信息。

### manifest.json
归档清单，记录所有归档文件的源路径、目标路径和元数据。

### rollback_log.json
回滚日志，用于撤销归档操作。

### 交接报告.md
Markdown 格式的交接报告，包含：
- 扫描摘要
- 数据校验结果
- 归档计划
- 照片详情
- 主要问题
- 使用说明

### 问题清单.csv
CSV 格式的问题清单，便于在 Excel 中查看和处理。

## 常见问题

**Q: 照片文件名必须严格遵循格式吗？**
A: 推荐使用规范格式，但程序支持多种变体。只要包含孔号（ZK开头）、箱号、深度区间即可。

**Q: 没有 GPS 数据怎么办？**
A: 程序会跳过位置校验，只执行其他校验项。

**Q: 可以只扫描不归档吗？**
A: 可以，使用 `--no-archive` 参数。

**Q: 回滚会删除源文件吗？**
A: 不会，回滚只会删除归档目录中复制的文件，源文件保持不变。

## 许可证

本工具仅供地质勘探工作内部使用。
