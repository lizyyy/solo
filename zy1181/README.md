# Config Diagnostic CLI

本地配置仓库诊断 CLI 工具，专门用于检测桌面工具或小服务中多种配置格式混用的问题。

## 功能特性

- **配置项来源识别**：识别配置项来自哪个配置文件（JSON、.env、YAML、SQLite）
- **优先级覆盖分析**：分析不同配置源之间的优先级覆盖关系
- **版本迁移检测**：检测多个版本之间的配置变化，生成迁移计划
- **缺省值分析**：识别使用默认值、显式设置和缺少默认值的配置项
- **安全分析**：
  - 敏感字段明文检测（密码、API Key、Token 等）
  - 无效枚举值检测
  - 弱密码检测
  - 硬编码密钥检测
  - 不安全默认值检测
- **回滚风险评估**：评估版本变更的回滚风险
- **报告导出**：支持导出 Markdown 和 JSON 格式的诊断报告

## 支持的配置格式

- `settings.json` / `config.json`
- `.env` / `.env.*`
- `config.yaml` / `config.yml`
- SQLite 数据库（`.db`, `.sqlite`, `.sqlite3`）

## 安装

```bash
# 使用 pip 安装
pip install -e .

# 或安装开发依赖
pip install -e ".[dev]"
```

## 命令说明

### validate - 验证配置并生成诊断报告

扫描项目目录中的所有配置文件，执行全面的诊断分析。

```bash
# 基本用法
config-diagnostic validate /path/to/project

# 导出报告
config-diagnostic validate /path/to/project -o report.md
config-diagnostic validate /path/to/project -o report.json -f json

# 仅运行安全检查
config-diagnostic validate /path/to/project --security-only

# 跳过安全检查
config-diagnostic validate /path/to/project --no-security
```

### diff - 比较两个项目的配置差异

分析两个项目目录之间的配置差异，包括新增、删除和修改的配置项。

```bash
# 基本用法
config-diagnostic diff /path/to/project-a /path/to/project-b

# 显示实际值
config-diagnostic diff /path/to/project-a /path/to/project-b --show-values

# 导出差异报告
config-diagnostic diff /path/to/project-a /path/to/project-b -o diff.txt
config-diagnostic diff /path/to/project-a /path/to/project-b -o diff.json -f json
```

### migrate-plan - 生成版本迁移计划

分析多个版本的配置变化，生成详细的迁移计划和回滚风险评估。

```bash
# 比较多个版本
config-diagnostic migrate-plan /path/to/v1 /path/to/v2 /path/to/v3

# 导出迁移计划
config-diagnostic migrate-plan /path/to/v1 /path/to/v2 -o migration.md
config-diagnostic migrate-plan /path/to/v1 /path/to/v2 -o migration.json -f json
```

### export - 导出配置分析报告

分析项目配置并导出为指定格式的报告文件。

```bash
# 导出 Markdown 报告
config-diagnostic export /path/to/project report.md

# 导出 JSON 报告
config-diagnostic export /path/to/project report.json -f json

# 自定义报告标题
config-diagnostic export /path/to/project report.md -t "My Project Config Report"
```

## 优先级规则

配置源按以下优先级从低到高排列：

1. **Default Values** - 程序内置默认值
2. **Global JSON** - `settings.json` 等全局配置
3. **YAML Config** - `config.yaml` 等 YAML 配置
4. **SQLite / Local JSON** - SQLite 数据库或 `settings.local.json`
5. **Environment File** - `.env` 文件（最高优先级）

## 示例

### 使用 Seed 样例（良好配置）

```bash
# 创建示例 SQLite 数据库
python examples/create_samples.py

# 分析良好配置
config-diagnostic validate examples/seed -v

# 导出报告
config-diagnostic export examples/seed seed-report.md
```

### 使用 Bad 样例（包含各种问题）

```bash
# 分析有问题的配置
config-diagnostic validate examples/bad -v

# 导出安全分析报告
config-diagnostic validate examples/bad -o bad-report.md
```

### 版本迁移分析

```bash
# 分析 v1 → v2 → v3 的迁移
config-diagnostic migrate-plan examples/migration/v1 examples/migration/v2 examples/migration/v3 -o migration-plan.md
```

### 配置差异比较

```bash
# 比较 seed 和 bad 配置
config-diagnostic diff examples/seed examples/bad --show-values

# 比较两个版本
config-diagnostic diff examples/migration/v1 examples/migration/v2
```

## 检测的安全问题类型

| 类型 | 严重性 | 描述 |
|------|--------|------|
| `sensitive_plaintext` | High/Critical | 敏感字段以明文存储 |
| `invalid_enum` | Medium | 无效的枚举值 |
| `weak_password` | High/Medium | 弱密码检测 |
| `hardcoded_secret` | Critical | 硬编码的密钥/Token |
| `insecure_default` | High/Medium/Low | 不安全的默认值 |
| `exposed_credential` | High | 暴露的凭证 |
| `empty_secret` | Medium | 空的密钥值 |

## 项目结构

```
config-diagnostic/
├── config_diagnostic/
│   ├── __init__.py
│   ├── cli.py                    # CLI 入口
│   ├── parsers/                  # 配置解析器
│   │   ├── __init__.py
│   │   ├── base.py              # 解析器基类
│   │   ├── json_parser.py       # JSON 解析器
│   │   ├── env_parser.py        # .env 解析器
│   │   ├── yaml_parser.py       # YAML 解析器
│   │   └── sqlite_parser.py     # SQLite 解析器
│   ├── analyzers/                # 分析引擎
│   │   ├── __init__.py
│   │   ├── analyzer.py          # 统一分析器
│   │   ├── priority.py          # 优先级分析
│   │   ├── migration.py         # 版本迁移分析
│   │   └── defaults.py          # 缺省值分析
│   ├── security/                 # 安全分析
│   │   ├── __init__.py
│   │   └── analyzer.py          # 安全分析器
│   └── reports/                  # 报告导出
│       ├── __init__.py
│       └── exporter.py          # 报告导出器
├── examples/                     # 示例配置
│   ├── seed/                    # 良好配置样例
│   ├── bad/                     # 坏样例（包含问题）
│   ├── migration/               # 迁移测试版本
│   └── create_samples.py        # 创建示例脚本
├── tests/                        # 测试用例
│   ├── __init__.py
│   ├── test_parsers.py          # 解析器测试
│   ├── test_analyzers.py        # 分析器测试
│   └── test_security.py         # 安全分析测试
├── pyproject.toml               # 项目配置
└── README.md
```

## 运行测试

```bash
# 运行所有测试
pytest

# 运行测试并显示覆盖率
pytest --cov=config_diagnostic

# 运行特定测试文件
pytest tests/test_parsers.py -v

# 运行特定测试函数
pytest tests/test_security.py::TestSecurityAnalyzer::test_check_sensitive_plaintext -v
```

## 开发指南

### 添加新的配置格式

1. 在 `config_diagnostic/parsers/` 下创建新的解析器类
2. 继承 `ConfigParser` 基类
3. 实现 `can_parse()` 和 `parse()` 方法
4. 在 `config_diagnostic/analyzers/analyzer.py` 的 `PARSERS` 列表中添加新解析器

### 添加新的安全检查

1. 在 `config_diagnostic/security/analyzer.py` 中添加新的 `_check_*` 方法
2. 在 `FindingType` 枚举中添加新类型
3. 在 `analyze()` 方法中调用新的检查方法

### 添加新的命令

1. 在 `config_diagnostic/cli.py` 中使用 `@main.command()` 装饰器添加新命令
2. 使用 `@click.option` 添加命令参数
3. 实现命令逻辑

## License

MIT License
