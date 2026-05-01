# 字体授权交付巡检员 (Font Auditor)

品牌设计交付自动化工具，用于检查设计交付物中的字体授权合规性。

## 功能特性

### 核心功能

- **init**: 初始化字体授权台账，维护字体授权、客户、项目用途和输出目录
- **scan**: 扫描素材目录中的字体使用情况，支持 pptx、svg、html/css、pdf、manifest 等格式
- **check**: 对照授权规则检查合规性，识别违规字体
- **report**: 导出 Markdown 巡检报告、CSV 字体清单和 JSON 审计包

### 检测能力

- ❌ 未知字体（未在授权台账中注册）
- ⏰ 授权过期
- 🌐 商用范围/用途不匹配
- 📍 区域不匹配
- 🔑 同名字体不同文件哈希
- 🚫 黑名单字体
- ⚠️ 缺少替代字体

## 安装

### 要求

- Python 3.9+
- pip

### 安装步骤

```bash
# 克隆或下载项目后，进入项目目录
cd xy4055

# 安装依赖
pip install -e .

# 验证安装
font-auditor --version
```

## 快速开始

### 使用演示目录验证全流程

```bash
# 1. 创建演示目录
font-auditor demo ./demo

# 2. 进入演示目录
cd ./demo

# 3. 初始化配置
font-auditor init

# 4. 扫描 assets 目录
font-auditor scan ./assets -o scan.json

# 5. 检查字体授权合规性
font-auditor check scan.json -q quarantine.json

# 6. 生成报告
font-auditor report -s scan.json -q quarantine.json -o ./reports
```

### 手动配置流程

#### 1. 初始化

```bash
# 在项目目录中初始化
font-auditor init
```

这会创建 `font-auditor.json` 配置文件。

#### 2. 添加字体授权

```bash
# 添加系统字体
font-auditor add font --name "PingFang SC" \
    --license "系统授权" \
    --usage print --usage web --usage presentation \
    --region CN --region US --region EU \
    --perpetual \
    --notes "Apple 系统字体"

# 添加有期限的商业字体
font-auditor add font --name "CommercialFont" \
    --license "商业授权" \
    --usage print \
    --region CN \
    --start-date 2024-01-01 \
    --end-date 2025-12-31
```

#### 3. 添加客户信息

```bash
font-auditor add client --id "client-001" \
    --name "某科技公司" \
    --region CN \
    --deny-font "Times New Roman" \
    --notes "主要客户，禁止使用 Times New Roman"
```

#### 4. 添加项目信息

```bash
font-auditor add project --id "proj-2024-001" \
    --name "2024年度品牌海报" \
    --client "client-001" \
    --usage print --usage web \
    --region CN \
    --font "PingFang SC" \
    --font "Noto Sans SC" \
    --output-dir "./output"
```

#### 5. 扫描素材目录

```bash
# 扫描目录并保存结果
font-auditor scan ./design-assets -o scan-results.json

# 扫描结果包含：
# - 字体名称
# - 文件路径
# - 文件类型
# - 使用页面/位置
# - 检测来源
```

#### 6. 检查合规性

```bash
# 基础检查
font-auditor check scan-results.json -q quarantine.json

# 指定项目进行检查（应用项目特定的授权规则）
font-auditor check scan-results.json -q quarantine.json -p proj-2024-001

# 保存检查结果
font-auditor check scan-results.json -q quarantine.json -o check-results.json
```

#### 7. 生成报告

```bash
# 生成所有格式的报告
font-auditor report -s scan-results.json -c check-results.json -q quarantine.json -o ./reports

# 只生成特定格式
font-auditor report -s scan-results.json -q quarantine.json -o ./reports -f markdown -f csv

# 关联项目信息
font-auditor report -s scan-results.json -q quarantine.json -o ./reports -p proj-2024-001
```

## 支持的文件格式

| 格式 | 扩展名 | 检测方式 |
|------|--------|----------|
| PowerPoint | `.pptx` | 文本运行字体、XML rFonts 元素 |
| SVG 矢量图 | `.svg` | style 标签、font-family 属性、style 属性 |
| HTML | `.html`, `.htm` | style 标签、style 属性、font 标签 |
| CSS | `.css` | font-family 声明、@font-face 规则 |
| PDF | `.pdf` | 字符元数据、页面字体信息 |
| 清单文件 | `.json`, `.yml`, `.yaml` | 搜索包含 "font" 的键 |

## 配置文件结构

`font-auditor.json` 包含以下部分：

```json
{
  "version": "1.0",
  "fonts": {
    "字体名称": {
      "font_name": "PingFang SC",
      "font_hash": "可选的字体文件哈希",
      "license_type": "授权类型",
      "allowed_usage": ["print", "web", "presentation"],
      "allowed_regions": ["CN", "US", "EU"],
      "start_date": "2020-01-01",
      "end_date": null,
      "is_perpetual": true,
      "notes": "备注信息"
    }
  },
  "clients": {
    "客户ID": {
      "client_id": "client-001",
      "client_name": "客户名称",
      "default_region": "CN",
      "allowed_fonts": [],
      "blacklisted_fonts": ["禁止的字体"],
      "notes": "备注"
    }
  },
  "projects": {
    "项目ID": {
      "project_id": "proj-001",
      "project_name": "项目名称",
      "client_id": "关联客户ID",
      "usage_type": ["print", "web"],
      "region": "CN",
      "fonts": ["授权字体列表"],
      "output_directories": ["./output"],
      "notes": "备注"
    }
  },
  "default_allowed_fonts": ["默认允许的字体"],
  "default_blacklisted_fonts": ["默认禁止的字体"]
}
```

## 隔离区文件

`quarantine.json` 存储所有违规记录：

```json
{
  "version": "1.0",
  "created_at": "2024-01-01T00:00:00",
  "updated_at": "2024-01-01T00:00:00",
  "entries": [
    {
      "id": "唯一标识",
      "font_name": "违规字体",
      "violation_type": "违规类型",
      "message": "描述信息",
      "file_path": "文件路径",
      "page": "页面/位置",
      "severity": "high/medium/low",
      "details": {
        "额外详情": "..."
      },
      "detected_at": "检测时间",
      "status": "active/resolved",
      "notes": "处理备注",
      "resolved_at": "解决时间"
    }
  ],
  "statistics": {
    "total": 总数,
    "active": 活跃数,
    "resolved": 已解决数,
    "by_type": { "违规类型": 数量 },
    "by_severity": { "严重程度": 数量 }
  }
}
```

## 违规类型说明

| 类型 | 说明 | 严重程度 |
|------|------|----------|
| `unknown_font` | 字体未在授权台账中注册 | 高 |
| `blacklisted` | 字体在客户黑名单中 | 高 |
| `expired_license` | 字体授权已过期 | 高 |
| `usage_mismatch` | 用途与授权范围不匹配 | 中 |
| `region_mismatch` | 区域与授权范围不匹配 | 中 |
| `hash_mismatch` | 同名字体哈希值不同 | 警告 |
| `missing_alternative` | 缺少替代字体 | 警告 |

## 用途类型

- `print` - 印刷品（海报、手册等）
- `web` - 网页、H5 页面
- `presentation` - PPT 演示文稿
- `video` - 视频制作
- `social` - 社交媒体

## 区域代码

- `CN` - 中国大陆
- `US` - 美国
- `EU` - 欧盟
- `JP` - 日本
- `KR` - 韩国
- `GLOBAL` - 全球

## 命令行参考

### init

```bash
font-auditor init [OPTIONS]

Options:
  -f, --force  强制初始化，覆盖现有配置
```

### add font

```bash
font-auditor add font [OPTIONS]

Options:
  --name TEXT           字体名称 [required]
  --hash TEXT           字体文件哈希值
  --license TEXT        授权类型 [required]
  --usage TEXT          允许的用途 (可多次指定)
  --region TEXT         允许的区域 (可多次指定)
  --start-date TEXT     授权开始日期 (YYYY-MM-DD)
  --end-date TEXT       授权结束日期 (YYYY-MM-DD)
  --perpetual           是否永久授权
  --notes TEXT          备注信息
```

### add client

```bash
font-auditor add client [OPTIONS]

Options:
  --id TEXT             客户ID [required]
  --name TEXT           客户名称 [required]
  --region TEXT         默认区域
  --allow-font TEXT     允许的字体 (可多次指定)
  --deny-font TEXT      禁止的字体 (可多次指定)
  --notes TEXT          备注信息
```

### add project

```bash
font-auditor add project [OPTIONS]

Options:
  --id TEXT             项目ID [required]
  --name TEXT           项目名称 [required]
  --client TEXT         所属客户ID [required]
  --usage TEXT          用途类型 (可多次指定)
  --region TEXT         项目区域
  --start-date TEXT     项目开始日期
  --end-date TEXT       项目结束日期
  --font TEXT           指定字体 (可多次指定)
  --output-dir TEXT     输出目录 (可多次指定)
  --notes TEXT          备注信息
```

### scan

```bash
font-auditor scan [OPTIONS] DIRECTORY

Options:
  -o, --output TEXT     扫描结果输出文件 (JSON)
  -p, --project TEXT    关联项目ID
```

### check

```bash
font-auditor check [OPTIONS] SCAN_RESULT

Options:
  -p, --project TEXT    关联项目ID，用于检查授权范围
  -q, --quarantine TEXT 隔离区文件路径 [default: quarantine.json]
  -o, --output TEXT     检查结果输出文件
```

### report

```bash
font-auditor report [OPTIONS]

Options:
  -s, --scan-result TEXT   扫描结果文件
  -c, --check-result TEXT  检查结果文件
  -q, --quarantine TEXT    隔离区文件
  -o, --output-dir TEXT    输出目录 [default: ./reports]
  -p, --project TEXT       关联项目ID
  -f, --format [markdown|csv|json]  输出格式 (可多次指定)
```

### demo

```bash
font-auditor demo TARGET_DIR
```

创建演示数据目录，包含示例配置、测试文件和完整流程验证脚本。

## 测试

### 运行单元测试

```bash
# 安装测试依赖
pip install -e ".[dev]"

# 运行测试
pytest tests/ -v

# 带覆盖率
pytest tests/ -v --cov=font_auditor
```

### 测试覆盖

- ✅ 字体名称标准化和匹配
- ✅ 授权规则检查（过期、用途、区域）
- ✅ 黑名单/白名单机制
- ✅ CSS/HTML/SVG 解析器
- ✅ 哈希计算和缓存
- ✅ 隔离区管理
- ✅ 配置管理

## 项目结构

```
font_auditor/
├── __init__.py
├── version.py          # 版本号
├── config.py           # 配置模型和管理
├── cli.py              # 命令行入口
├── scanner.py          # 文件扫描和解析
├── checker.py          # 授权规则检查
├── hash_cache.py       # 哈希计算和缓存
├── quarantine.py       # 隔离区管理
├── reporter.py         # 报告生成
└── demo.py             # 演示数据生成

tests/
├── __init__.py
└── test_font_auditor.py

pyproject.toml
README.md
```

## 常见问题

### Q: 为什么扫描不到某些字体？

A: 字体检测依赖文件中的显式声明。如果字体被转曲（Outline）或嵌入在二进制文件中，可能无法检测。建议：
- 在源文件中保留字体信息
- 使用 manifest.json 清单文件记录字体使用

### Q: 同名字体不同版本如何处理？

A: 使用 `--hash` 参数记录字体文件的哈希值。如果扫描到的字体哈希与授权记录不一致，会产生警告。

### Q: 如何处理过期授权？

A: 设置 `--end-date` 参数，check 命令会自动检测过期的授权。可以通过设置 `--perpetual` 标记永久授权。

### Q: 客户有特殊的字体限制？

A: 使用 `--deny-font` 为客户设置黑名单，check 时会自动检测客户黑名单中的字体。

## 更新日志

### v0.1.0
- 初始版本
- 支持 init、scan、check、report 命令
- 支持 pptx、svg、html、css、pdf、json 格式
- 支持字体授权台账管理
- 支持违规隔离和报告生成

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
