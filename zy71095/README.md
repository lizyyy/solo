# Log4j 配置链分析工具

追踪多层 Log4j 配置覆盖，生成完整的配置链路报告，解决线上日志级别突然变化的排查问题。

## 功能特性

- ✅ **多格式配置解析**: 支持 Log4j 1.x (properties) 和 Log4j 2.x (XML) 格式
- ✅ **Include 文件处理**: 自动递归解析 XML 中的 include 引用
- ✅ **环境变量覆盖**: 支持 .env 文件和系统环境变量中的 LOG4J_* 配置
- ✅ **包名通配符匹配**: 支持 `com.example.*.dao` 等通配符模式
- ✅ **配置覆盖链追踪**: 完整展示每个包的日志级别是如何被层层覆盖的
- ✅ **多格式输出**: 终端彩色摘要、机器可读 JSON、给同事看的 Markdown
- ✅ **稳定退出码**: 每个退出码都有清晰的解释，便于 CI/CD 集成
- ✅ **命令行覆盖**: 支持通过 CLI 参数临时覆盖指定包的日志级别

## 安装

### 环境要求

- Python 3.9+
- pip 或 pip3

### 安装步骤

```bash
# 克隆或下载项目后，进入项目目录
cd log4j-chain-analyzer

# 以开发模式安装
pip3 install -e .
```

**注意**: 如果安装后提示 `log4j-chain` 命令找不到，需要将 Python 的 bin 目录加入 PATH:
```bash
# macOS 用户通常需要执行
export PATH="$HOME/Library/Python/3.9/bin:$PATH"
```

## 快速开始

### 基础用法

```bash
# 分析单个配置文件，指定要检查的包
log4j-chain analyze \
  -c /path/to/log4j2.xml \
  -p com.example.service \
  -p com.example.dao
```

### 完整示例

```bash
# 使用示例配置进行测试
log4j-chain analyze \
  -c examples/log4j2.xml \
  -e examples/.env \
  --package-file examples/packages.txt \
  -d output \
  -n my-report
```

## 命令参考

### analyze - 分析配置链

**常用参数**:

| 参数 | 说明 | 示例 |
|------|------|------|
| `-c, --config` | Log4j 配置文件路径（可多次指定） | `-c log4j2.xml` |
| `-e, --env-file` | 环境变量文件路径（可多次指定） | `-e .env` |
| `-p, --package` | 要分析的包名（可多次指定） | `-p com.example.service` |
| `--package-file` | 包含包名列表的文件，每行一个 | `--package-file packages.txt` |
| `-o, --override` | 命令行覆盖格式: `PACKAGE LEVEL` | `-o com.example DEBUG` |
| `--load-system-env` | 加载系统环境变量中的 LOG4J_* 配置 | `--load-system-env` |
| `-d, --output-dir` | 输出报告的目录（默认: 当前目录） | `-d ./reports` |
| `-n, --output-name` | 输出文件的基础名称（默认: log4j-chain-report） | `-n prod-log4j` |
| `--no-json` | 不生成 JSON 报告 | `--no-json` |
| `--no-markdown` | 不生成 Markdown 报告 | `--no-markdown` |
| `-q, --quiet` | 静默模式，不输出终端摘要 | `-q` |
| `--base-dir` | 基础目录，用于解析相对路径的 include 文件 | `--base-dir ./config` |

**示例**:

```bash
# 使用命令行覆盖进行临时调试
log4j-chain analyze \
  -c log4j2.xml \
  -p com.example.service \
  -o com.example.service TRACE \
  -o org.springframework WARN
```

### list-levels - 列出支持的日志级别

```bash
log4j-chain list-levels
```

支持的日志级别（优先级从低到高）:
- ALL, TRACE, DEBUG, INFO, WARN, ERROR, FATAL, OFF

### explain-exit-codes - 解释退出码

```bash
log4j-chain explain-exit-codes
```

## 输入目录结构

### 推荐的项目配置目录结构

```
your-project/
├── config/
│   ├── log4j2.xml          # 主配置文件
│   ├── log4j-common.xml    # 被 include 的公共配置
│   └── .env                # 环境变量覆盖
├── packages-to-check.txt   # 需要检查的包名列表
└── ...
```

### 配置文件格式示例

**Log4j 2 XML 格式**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Configuration>
    <Appenders>
        <Console name="Console" target="SYSTEM_OUT"/>
    </Appenders>
    <Loggers>
        <Root level="INFO">
            <AppenderRef ref="Console"/>
        </Root>
        <Logger name="com.example" level="INFO"/>
        <Logger name="com.example.service" level="WARN"/>
        <Logger name="com.example.*.dao" level="DEBUG"/>
    </Loggers>
</Configuration>
```

**Log4j 1 properties 格式**:
```properties
log4j.rootLogger=INFO, Console
log4j.logger.com.example=INFO
log4j.logger.com.example.service=WARN
log4j.logger.org.springframework=ERROR
```

**环境变量文件 (.env)**:
```env
LOG4J_ROOT_LEVEL=DEBUG
LOG4J_LOGGER_COM_EXAMPLE_SERVICE=DEBUG
LOG4J_LOGGER_ORG_SPRINGFRAMEWORK=INFO
```

**包名列表文件 (packages.txt)**:
```txt
# 这是注释，空行会被忽略
com.example
com.example.service
com.example.service.order
com.example.user.dao
org.springframework
org.hibernate
```

## 配置优先级规则

配置源按以下优先级从低到高排列（高优先级会覆盖低优先级）:

1. **默认值** (INFO) - 最低优先级
2. **配置文件** (log4j2.xml, log4j.properties)
3. **Include 文件** - 略高于主配置文件
4. **环境文件** (.env)
5. **系统环境变量** (LOG4J_*)
6. **命令行参数 (-o)** - 最高优先级

## 输出说明

### 终端输出示例

```
=== Log4j 配置链分析报告 ===

退出码: 0 - 执行成功

com.example.service → DEBUG
└── 🌍 com.example.service → DEBUG (was: WARN)
    └── 优先级 303000 - 来自 系统环境变量: LOG4J_LOGGER_COM_EXAMPLE_SERVICE
├── 📄 com.example.service → WARN (was: INFO)
│   └── 优先级 103000 - 来自 配置文件: log4j2.xml
└── 📄 com.example → INFO (was: DEBUG)
    └── 优先级 100200 - 来自 配置文件: log4j2.xml
```

**图标说明**:
- 📄 - 配置文件
- 📎 - Include 文件
- 🔧 - 环境文件
- 🌍 - 系统环境变量
- ⌨️ - 命令行参数

### JSON 输出

生成的 JSON 文件包含完整的分析数据，便于程序处理:
```json
{
  "exit_code": 0,
  "exit_code_description": "执行成功",
  "resolutions": {
    "com.example.service": {
      "package_name": "com.example.service",
      "final_level": "DEBUG",
      "chain": [ ... ]
    }
  }
}
```

### Markdown 输出

生成的 Markdown 文件可以直接发给同事查看，包含完整的表格和说明。

## 退出码说明

| 退出码 | 说明 | 排查方向 |
|--------|------|----------|
| 0 | 执行成功 | - |
| 1 | 命令行参数无效 | 检查参数拼写和格式 |
| 2 | 配置文件未找到 | 检查文件路径是否正确 |
| 3 | 配置文件解析错误 | 检查 XML/properties 语法 |
| 4 | Include 文件处理错误 | 检查 include 路径是否存在 |
| 5 | 环境变量处理错误 | 检查 .env 文件格式 |
| 6 | 输入数据校验失败 | 检查包名格式和日志级别 |
| 99 | 未知错误 | 请提交 issue |

在 shell 中可以通过 `$?` 获取退出码:
```bash
log4j-chain analyze ...
echo "退出码: $?"
```

## 坏数据处理

### 无效的配置文件

- **XML 语法错误**: 会在错误信息中显示具体行号
- **properties 格式错误**: 会跳过无效的配置项
- **未知文件格式**: 产生警告但继续执行

### 无效的包名

- 包含非法字符的包名会被参数校验拒绝
- 没有匹配到任何规则的包会继承 root logger 级别

### 无效的日志级别

- 不支持的日志级别值会被忽略
- 会产生警告信息提示用户

### 循环 include

- 工具会自动检测已处理过的文件，避免死循环
- 重复的 include 只会处理一次

## 常见问题

### Q: 为什么线上日志级别突然变成 DEBUG？

**A**: 使用本工具排查步骤:
1. 收集所有相关配置文件（包括被 include 的）
2. 导出线上环境变量（`env | grep -i log4j`）
3. 运行分析命令，查看覆盖链报告
4. 通常会发现是某个环境变量或 Kubernetes ConfigMap 覆盖导致的

### Q: 通配符匹配的规则是什么？

**A**: 
- `*` 匹配任意字符（不跨包层级）
- `?` 匹配单个字符
- `com.example.*` 匹配 `com.example.service` 但不匹配 `com.example.service.order`
- `com.example.*.dao` 匹配 `com.example.user.dao`

### Q: 可以同时分析多个配置文件吗？

**A**: 可以，多次使用 `-c` 参数即可，后指定的配置优先级更高。

## 项目结构

```
log4j-chain-analyzer/
├── src/
│   └── log4j_analyzer/
│       ├── __init__.py
│       ├── cli.py           # 命令行入口
│       ├── analyzer.py      # 核心分析逻辑
│       ├── parser.py        # 配置文件解析
│       ├── environment.py   # 环境变量处理
│       ├── matcher.py       # 包名匹配引擎
│       ├── reporter.py      # 报告生成
│       ├── models.py        # 数据模型
│       └── constants.py     # 常量定义
├── examples/                # 示例配置文件
├── pyproject.toml           # 项目配置
└── README.md
```

## License

MIT
