# 素材授权包巡检员

设计外包团队素材授权管理工具 - 本地端侧 CLI 工具

## 功能概述

客户交付常混着图片、字体、音效和授权 PDF，最怕：
- ❌ 缺授权
- ❌ 授权人数不够
- ❌ 素材被改名后对不上
- ❌ 授权过期
- ❌ 用途不匹配

**素材授权包巡检员** 帮你解决这些问题：

| 命令 | 功能 |
|------|------|
| `scan` | 扫描项目目录并计算文件哈希 |
| `import-license` | 导入授权清单 CSV/PDF 文本 |
| `match` | 关联素材和授权条款 |
| `check` | 标出缺证、过期、用途不匹配、同名不同哈希和重复素材 |
| `export` | 导出 Markdown 风险报告、CSV 素材台账和 JSON 审计包 |

## 安装

```bash
# 进入项目目录
cd xy4088

# 安装依赖（开发模式）
pip install -e .
```

或使用 pip：

```bash
pip install click pypdf python-dateutil
pip install -e .
```

验证安装：

```bash
license-scanner --version
license-scanner --help
```

## 快速开始

### 使用示例项目验证全流程

项目包含一个预配置的示例项目，可直接运行验证：

```bash
# 运行演示脚本（推荐，展示完整流程）
python examples/demo_run.py
```

或使用 CLI 命令分步执行：

```bash
# 1. 进入示例项目目录
cd examples/test_project

# 2. 查看当前状态
license-scanner status

# 3. 扫描素材
license-scanner scan

# 4. 导入授权清单
license-scanner import-license licenses_for_import.csv

# 5. 匹配素材和授权
license-scanner match

# 6. 风险检查（需要商业使用权限，至少5人授权）
license-scanner check --usage "商业使用" --seats 5

# 7. 导出报告
license-scanner export

# 8. 查看最终状态
license-scanner status
```

### 输出文件

执行完成后，报告将生成在 `reports/` 目录：

```
reports/
├── license_risk_report_YYYYMMDD_HHMMSS.md    # Markdown 风险报告
├── asset_ledger_YYYYMMDD_HHMMSS.csv          # 素材台账
├── risk_list_YYYYMMDD_HHMMSS.csv              # 风险清单
└── audit_package_YYYYMMDD_HHMMSS.json         # 审计数据包
```

## 完整工作流程

### 1. 扫描项目目录

```bash
# 扫描当前目录
license-scanner scan

# 指定项目目录
license-scanner scan -p /path/to/project

# 只扫描特定扩展名
license-scanner scan --extensions ".jpg,.png,.ttf,.mp3"

# 排除特定目录
license-scanner scan --exclude "node_modules" --exclude "dist"
```

扫描器会：
- 递归遍历目录
- 识别文件类型（图片、字体、音频、视频、文档）
- 计算 SHA-256 哈希值
- 保存到项目状态文件 `.license_scanner_state.json`

### 2. 导入授权清单

支持 **CSV** 和 **PDF** 格式：

```bash
# 从 CSV 导入
license-scanner import-license licenses.csv

# 从 PDF 导入（自动提取文本）
license-scanner import-license license_agreement.pdf

# 导入前清空现有记录
license-scanner import-license --clear licenses.csv
```

#### CSV 格式说明

CSV 支持中英文列名，以下列名均可识别：

| 字段 | 支持的列名 | 说明 |
|------|-----------|------|
| 授权编号 | license_id, 授权编号, id, 编号 | 唯一标识 |
| 素材名称 | asset_name, 素材名称, 文件名, name | 对应素材文件名 |
| 素材类型 | asset_type, 素材类型, 类型 | 图片/字体/音频/视频 |
| 供应商 | vendor, 供应商, 厂商 | 如 ShutterStock |
| 授权类型 | license_type, 授权类型 | 如 商业授权 |
| 购买日期 | purchase_date, 购买日期 | YYYY-MM-DD |
| 过期日期 | expiry_date, 过期日期, 有效期 | YYYY-MM-DD，空表示永久 |
| 授权人数 | seats, 授权人数, 用户数 | 数字，空表示不限 |
| 允许用途 | allowed_usage, 允许用途, 用途 | 逗号分隔 |
| 限制条款 | restrictions, 限制条款, 限制 | 逗号分隔 |
| 文件哈希 | asset_hash, 文件哈希, hash | 可选，用于精确匹配 |
| 备注 | notes, 备注, 说明 | 额外信息 |

示例 CSV：

```csv
license_id,素材名称,素材类型,供应商,授权类型,购买日期,过期日期,授权人数,允许用途
LIC-001,logo.png,图片,ShutterStock,商业授权,2024-01-15,2025-01-15,5,"商业使用,修改权限"
```

### 3. 匹配素材和授权

```bash
# 默认匹配（最小置信度 0.3）
license-scanner match

# 调整匹配置信度
license-scanner match --min-confidence 0.5
```

匹配规则优先级：
1. **哈希精确匹配** (置信度 1.0) - 授权记录包含文件哈希时
2. **文件名精确匹配** (置信度 0.95) - 大小写不敏感
3. **强名称匹配** (置信度 0.85) - 去除扩展名、分隔符后匹配
4. **模糊匹配** (置信度 0.5-0.7) - 编辑距离、关键词匹配
5. **类型匹配** (置信度 0.3-0.5) - 同类型 + 部分关键词

### 4. 风险检查

```bash
# 基本检查
license-scanner check

# 指定需要的使用权限
license-scanner check --usage "商业使用" --usage "修改权限"

# 指定需要的授权人数
license-scanner check --seats 10

# 指定检查日期（用于测试过期场景）
license-scanner check --date "2025-02-01"
```

#### 风险类型说明

| 风险类型 | 严重程度 | 说明 |
|---------|---------|------|
| `missing_license` | CRITICAL | 素材缺少授权 |
| `expired` | CRITICAL | 授权已过期 |
| `expired` | MEDIUM | 授权30天内即将过期 |
| `usage_mismatch` | HIGH | 用途不匹配 |
| `insufficient_seats` | HIGH | 授权人数不足 |
| `name_hash_mismatch` | HIGH | 同名不同哈希 |
| `duplicate_asset` | MEDIUM | 重复素材 |
| `renamed_asset` | LOW | 素材可能被重命名 |

### 5. 导出报告

```bash
# 导出所有格式（默认）
license-scanner export

# 只导出 Markdown
license-scanner export --format markdown

# 只导出 CSV
license-scanner export --format csv

# 只导出 JSON
license-scanner export --format json

# 指定输出目录
license-scanner export --output-dir ./my_reports
```

#### 导出格式说明

**Markdown 报告** (`license_risk_report_*.md`)：
- 统计概览
- 风险汇总（按严重程度）
- 风险详情（分类型）
- 素材台账
- 授权清单

**CSV 素材台账** (`asset_ledger_*.csv`)：
- 文件名、路径、类型、大小、哈希
- 授权状态
- 匹配的授权ID

**CSV 风险清单** (`risk_list_*.csv`)：
- 风险ID、类型、严重程度
- 关联素材和授权
- 详情 JSON

**JSON 审计包** (`audit_package_*.json`)：
- 完整的审计信息
- 可用于后续处理或自动化集成

## 项目结构

```
xy4088/
├── pyproject.toml              # 项目配置
├── README.md                   # 本文档
├── src/
│   └── license_scanner/
│       ├── __init__.py         # 包初始化
│       ├── cli.py              # CLI 入口 (Click)
│       ├── models.py           # 数据模型
│       ├── scanner.py          # 目录扫描器
│       ├── parser.py           # 授权解析器 (CSV/PDF)
│       ├── matcher.py          # 匹配规则
│       ├── checker.py          # 风险校验
│       ├── storage.py          # JSON 存储
│       └── reporter.py         # 报告导出
├── examples/
│   ├── demo_run.py             # 演示脚本
│   ├── licenses_sample.csv     # 示例授权清单
│   └── test_project/           # 测试项目
│       ├── assets/             # 测试素材
│       │   ├── brand_logo.png
│       │   ├── header_banner.jpg
│       │   ├── Roboto-Regular.ttf
│       │   ├── unlicensed_image.png      # 未授权
│       │   ├── duplicate_1.png           # 重复
│       │   ├── duplicate_2.png           # 重复
│       │   └── same_name_diff_content.png # 同名不同内容
│       ├── subdir/
│       │   └── same_name_diff_content.png # 同名不同内容
│       └── licenses_for_import.csv
└── reports/                    # 输出目录（运行后生成）
```

## 数据模型

### Asset (素材)

| 字段 | 类型 | 说明 |
|------|------|------|
| file_path | str | 完整文件路径 |
| file_name | str | 文件名 |
| file_size | int | 文件大小（字节） |
| file_hash | str | SHA-256 哈希 |
| asset_type | AssetType | 类型：IMAGE/FONT/AUDIO/VIDEO/DOCUMENT/OTHER |
| extension | str | 扩展名 |
| modified_time | datetime | 修改时间 |
| created_time | datetime | 创建时间 |
| metadata | dict | 额外元数据 |
| matched_licenses | List[License] | 匹配的授权 |

### License (授权)

| 字段 | 类型 | 说明 |
|------|------|------|
| license_id | str | 授权编号 |
| asset_name | str | 素材名称 |
| asset_type | AssetType | 素材类型 |
| vendor | str | 供应商 |
| license_type | str | 授权类型 |
| purchase_date | datetime | 购买日期 |
| expiry_date | datetime | 过期日期（None 表示永久） |
| seats | int | 授权人数（None 表示不限） |
| allowed_usage | List[str] | 允许用途 |
| restrictions | List[str] | 限制条款 |
| asset_hash | str | 素材哈希（可选，用于精确匹配） |
| notes | str | 备注 |

### Risk (风险)

| 字段 | 类型 | 说明 |
|------|------|------|
| risk_id | str | 风险编号 |
| risk_type | RiskType | 风险类型 |
| risk_level | RiskLevel | 严重程度 |
| asset | Asset | 关联素材 |
| license | License | 关联授权 |
| message | str | 描述信息 |
| details | dict | 详细信息 |

## 作为库使用

除了 CLI，也可以作为 Python 库使用：

```python
from license_scanner.scanner import DirectoryScanner
from license_scanner.parser import parse_license_file
from license_scanner.matcher import match_assets_and_licenses
from license_scanner.checker import check_risks
from license_scanner.reporter import generate_markdown_report

# 1. 扫描
scanner = DirectoryScanner()
assets = scanner.scan_directory("/path/to/project")

# 2. 导入授权
licenses = parse_license_file("licenses.csv")

# 3. 匹配
matches, unmatched = match_assets_and_licenses(assets, licenses)

# 4. 检查风险
risks = check_risks(
    assets, licenses, [m.to_dict() for m in matches],
    required_usage=["商业使用"],
    min_required_seats=5
)

# 5. 生成报告
from license_scanner.models import ProjectState
from datetime import datetime

state = ProjectState(
    project_name="My Project",
    scan_date=datetime.now(),
    assets=assets,
    licenses=licenses,
    risks=risks,
    matches=[m.to_dict() for m in matches]
)

generate_markdown_report(state, "report.md")
```

## 常见问题

**Q: 为什么有些素材匹配不到授权？**

A: 可能原因：
1. 文件名不完全匹配 - 检查授权清单中的素材名称
2. 缺少文件哈希 - 如有可能，在授权清单中加入 `asset_hash` 列
3. 置信度阈值过高 - 尝试使用 `--min-confidence 0.2`

**Q: 如何处理被重命名的素材？**

A: 如果授权清单中有正确的文件哈希，即使文件名不同也能正确匹配。建议在授权记录中包含文件哈希值。

**Q: 支持哪些授权文件格式？**

A: 
- CSV: 完全支持，推荐使用
- PDF: 支持文本提取（使用正则匹配提取关键信息）
- TXT: 与 PDF 相同的文本解析逻辑

**Q: 状态文件存储在哪里？**

A: 默认在项目根目录下的 `.license_scanner_state.json`，这是一个隐藏文件。

## 更新日志

### v0.1.0 (2024)
- 初始版本
- 实现 scan、import-license、match、check、export 命令
- 支持 CSV 和 PDF 授权文件
- 支持 Markdown、CSV、JSON 报告导出

## 许可证

MIT License
