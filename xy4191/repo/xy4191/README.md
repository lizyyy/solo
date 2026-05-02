# Release Validator - 发布证据包验收员

开源项目发布经理用的本地自动化验证工具。

## 功能特性

- **scan** - 扫描目录，建立文件索引并计算 SHA256 哈希
- **verify** - 验证包名、语义版本、哈希、SBOM 组件和许可证
- **quarantine** - 隔离不符合规范的文件和缺失证据项
- **report** - 导出 Markdown 验收单、CSV 问题表和 JSON 审计包

## 安装

```bash
# 克隆仓库后进入目录
cd release-validator

# 安装项目及依赖
pip install -e .
```

或者使用 develop 模式：

```bash
pip install -e ".[test]"
```

## 快速开始

### 1. 使用示例数据

```bash
# 查看项目结构
ls -la
ls -la examples/

# 示例数据目录说明
# examples/good_release/  - 合规的发布包示例
# examples/bad_release/   - 有问题的发布包示例
```

### 2. 使用临时目录验证

#### 创建测试目录：

```bash
# 创建临时测试目录
mkdir -p /tmp/test-release
cd /tmp/test-release

# 创建模拟发布包
echo "My Project v1.0.0" > myproject-1.0.0.tar.gz
echo "My Project v1.0.0" > myproject-1.0.0.zip
```

#### 扫描目录：

```bash
# 基本扫描
rv scan /tmp/test-release

# 带输出的扫描
rv scan /tmp/test-release -o /tmp/test-release/index.json

# 详细输出
rv scan /tmp/test-release -v
```

#### 验证目录：

```bash
# 基本验证
rv verify /tmp/test-release

# 输出验证结果
rv verify /tmp/test-release -o /tmp/test-release/verification.json

# 禁用特定规则
rv verify /tmp/test-release --disable signature-files --disable ci-log-errors

# 仅启用特定规则
rv verify /tmp/test-release --enable-only version-consistency --enable-only hash-verification
```

#### 生成报告：

```bash
# 生成所有格式的报告
rv report /tmp/test-release -o /tmp/test-release/reports

# 仅生成特定格式
rv report /tmp/test-release -o /tmp/test-release/reports -f markdown -f json
```

### 3. 使用示例发布包测试

#### 测试合规发布包：

```bash
# 扫描示例
rv scan examples/good_release

# 验证示例
rv verify examples/good_release

# 生成报告
rv report examples/good_release -o reports/good
```

#### 测试有问题的发布包：

```bash
# 扫描示例
rv scan examples/bad_release

# 验证示例（会发现问题）
rv verify examples/bad_release

# 隔离有问题的文件
rv quarantine examples/bad_release

# 查看隔离区
ls -la examples/bad_release/.quarantine/
```

## 命令详解

### scan 命令

扫描目录，建立文件索引并计算 SHA256 哈希。

```bash
rv scan <目录路径> [选项]
```

选项：
- `-o, --output <文件路径>` - 输出索引 JSON 文件路径
- `-v, --verbose` - 显示详细输出

输出示例：
```
正在扫描目录: /tmp/test-release
------------------------------------------------------------

扫描完成，共找到 4 个文件

文件类型统计:
  tar: 1 个文件
  zip: 1 个文件
  other: 2 个文件

检测到的版本号: 1.0.0
```

### verify 命令

验证包名、语义版本、哈希、SBOM 组件和许可证。

```bash
rv verify <目录路径> [选项]
```

选项：
- `-o, --output <文件路径>` - 输出验证结果 JSON 文件路径
- `--disable <规则ID>` - 禁用指定的规则（可多次使用）
- `--enable-only <规则ID>` - 仅启用指定的规则（可多次使用）

可用规则：
- `version-consistency` - 版本一致性检查
- `semantic-version` - 语义化版本检查
- `hash-verification` - 哈希校验
- `sbom-licenses` - SBOM 许可证检查
- `license-inventory` - 许可证清单检查
- `changelog-exists` - Changelog 存在性检查
- `ci-log-errors` - CI 日志错误检查
- `signature-files` - 签名文件检查
- `package-naming` - 包名规范检查

输出示例：
```
正在验证目录: /tmp/test-release
------------------------------------------------------------

执行验证规则...

============================================================
验证结果: 失败
总违规数: 3
严重违规: 1
============================================================

✗ 版本一致性检查 [失败]
   - [critical] 发现不一致的版本号: 2.0.0
     期望: 单一版本号
     实际: {'1.0.0', '2.0.0'}

✓ 语义化版本检查 [通过]

✗ 哈希校验 [失败]
   - [high] 未找到checksums文件
```

### quarantine 命令

隔离不符合规范的文件和缺失证据项。

```bash
rv quarantine <目录路径> [选项]
```

选项：
- `-d, --quarantine-dir <目录路径>` - 隔离区目录路径（默认: .quarantine）
- `--violations-json <文件路径>` - 验证结果 JSON 文件路径（用于隔离所有违规项）
- `-f, --force` - 强制隔离所有违规项

输出示例：
```
隔离区路径: /tmp/test-release/.quarantine
目标路径: /tmp/test-release
------------------------------------------------------------

隔离: myproject-tampered.tar.gz
  原因: 哈希不匹配 (期望: a1b2c3..., 实际: x9y8z7...)

============================================================
隔离完成: 1 个文件
隔离区: /tmp/test-release/.quarantine
隔离清单: /tmp/test-release/.quarantine/manifest.json
```

### report 命令

导出 Markdown 验收单、CSV 问题表和 JSON 审计包。

```bash
rv report [目录路径] [选项]
```

选项：
- `-o, --output-dir <目录路径>` - 报告输出目录（默认: ./reports）
- `-f, --format <格式>` - 输出格式（可多次使用，默认: 全部）
  - `markdown` - Markdown 验收单
  - `csv` - CSV 问题表
  - `json` - JSON 审计包
  - `all` - 全部格式

输出示例：
```
生成报告...
输出目录: /tmp/test-release/reports
------------------------------------------------------------

✓ Markdown报告: release_verification_20240115_103000.md
✓ CSV报告: release_verification_20240115_103000.csv
✓ JSON审计包: release_verification_20240115_103000.json

============================================================
报告生成完成!
输出目录: /tmp/test-release/reports
生成的文件:
  - /tmp/test-release/reports/release_verification_20240115_103000.md
  - /tmp/test-release/reports/release_verification_20240115_103000.csv
  - /tmp/test-release/reports/release_verification_20240115_103000.json
```

## 示例发布包结构

### 合规发布包 (examples/good_release/)

```
good_release/
├── myproject-1.2.3.tar.gz    # 发布包 (版本 1.2.3)
├── myproject-1.2.3.zip       # 发布包 (版本 1.2.3)
├── checksums.txt              # SHA256 校验和文件
├── sbom.json                  # CycloneDX 格式 SBOM
├── licenses.txt               # 第三方组件许可证清单
├── CHANGELOG.md               # 变更日志
└── ci.log                     # CI 构建日志
```

### 有问题的发布包 (examples/bad_release/)

```
bad_release/
├── myproject-1.2.0.tar.gz     # 版本不一致 (应该是 1.2.3)
├── myproject-1.2.3.zip        # 内容被篡改 (哈希不匹配)
├── checksums.txt              # 错误的校验和
├── sbom.json                  # SBOM 包含无许可证的组件
├── licenses.txt               # 许可证清单不完整
└── ci.log                     # CI 日志包含错误
```

## 验证规则说明

| 规则ID | 规则名称 | 严重程度 | 说明 |
|--------|----------|----------|------|
| version-consistency | 版本一致性检查 | CRITICAL | 检查所有文件中的版本号是否一致 |
| semantic-version | 语义化版本检查 | MEDIUM | 检查版本号是否符合语义化版本规范 |
| hash-verification | 哈希校验 | CRITICAL | 验证 checksums.txt 中的哈希值与文件实际哈希是否匹配 |
| sbom-licenses | SBOM 许可证检查 | HIGH | 检查 SBOM 中所有组件是否都有许可证信息 |
| license-inventory | 许可证清单检查 | HIGH | 检查许可证清单与 SBOM 中的组件是否一致 |
| changelog-exists | Changelog 存在性检查 | MEDIUM | 检查是否包含 changelog 且包含当前版本 |
| ci-log-errors | CI 日志错误检查 | HIGH | 检查 CI 日志中是否存在错误 |
| signature-files | 签名文件检查 | MEDIUM | 检查是否存在签名文件 (.sig, .asc 等) |
| package-naming | 包名规范检查 | MEDIUM | 检查包名是否符合规范 |

## 测试

### 运行测试

```bash
# 安装测试依赖
pip install -e ".[test]"

# 运行所有测试
pytest tests/

# 运行测试并显示覆盖率
pytest tests/ -v --cov=release_validator

# 运行特定测试文件
pytest tests/test_indexer.py -v
pytest tests/test_rules.py -v
```

### 测试目录结构

```
tests/
├── __init__.py
├── conftest.py          # pytest 配置和 fixtures
├── test_indexer.py      # 文件索引器测试
├── test_parsers.py      # 解析器测试
├── test_rules.py        # 规则引擎测试
├── test_quarantine.py   # 隔离区测试
└── test_reporter.py     # 报告导出测试
```

## API 使用

### 作为模块使用

```python
from pathlib import Path
from release_validator.indexer import FileIndexer
from release_validator.rules import RuleEngine
from release_validator.reporter import Reporter

# 1. 扫描目录
indexer = FileIndexer(Path("/path/to/release"))
indexer.scan()

print(f"找到 {len(indexer.entries)} 个文件")
print(indexer.get_index_summary())

# 2. 验证
engine = RuleEngine(indexer)
result = engine.verify({})

print(f"验证通过: {result.overall_passed}")
print(f"违规数: {result.total_violations}")

# 3. 生成报告
reporter = Reporter(output_dir=Path("./reports"))
report_data = {
    "title": "发布证据包验收报告",
    "summary": {
        "total_files": len(indexer.entries),
        "total_issues": result.total_violations,
        "passed": result.overall_passed,
    },
    "files": [
        {
            "filename": e.filename,
            "file_type": e.file_type,
            "size": e.size,
            "sha256": e.sha256,
            "version": e.version,
        }
        for e in indexer.entries.values()
    ],
    "issues": [],
}

outputs = reporter.generate_all(report_data)
print(f"生成的报告: {outputs}")
```

## 开发

### 项目结构

```
release-validator/
├── pyproject.toml              # 项目配置
├── README.md                   # 本文件
├── src/
│   └── release_validator/
│       ├── __init__.py
│       ├── cli.py              # 命令行接口
│       ├── indexer.py          # 文件索引器
│       ├── quarantine.py       # 隔离区管理
│       ├── reporter.py         # 报告导出
│       ├── parsers/            # 解析器模块
│       │   ├── __init__.py
│       │   ├── checksum_parser.py
│       │   ├── sbom_parser.py
│       │   ├── license_parser.py
│       │   ├── changelog_parser.py
│       │   └── ci_log_parser.py
│       └── rules/              # 规则引擎模块
│           ├── __init__.py
│           └── rule_engine.py
├── examples/                   # 示例数据
│   ├── good_release/           # 合规发布包示例
│   └── bad_release/            # 有问题的发布包示例
└── tests/                      # 测试用例
    ├── __init__.py
    ├── conftest.py
    ├── test_indexer.py
    ├── test_parsers.py
    ├── test_rules.py
    ├── test_quarantine.py
    └── test_reporter.py
```

## 许可证

MIT License
