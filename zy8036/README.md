# Markdown 示例验收器

一个用于验证 SDK 文档中代码示例正确性的工具。

## 功能

- 解析 Markdown 文件中的 fenced code block
- 支持 Python / JavaScript / Shell 代码执行
- 快照测试机制（比较或更新快照）
- 处理重复块 ID、执行超时、环境变量缺失
- 输出终端摘要和详细 Markdown 报告

## 安装

```bash
cd zy8036
pip install -e .
```

## 使用方法

### 基本命令

```bash
# 运行验收器
md-validator docs/

# 运行并生成报告
md-validator docs/ -o report.md

# 更新快照
md-validator docs/ -u

# 设置超时时间（默认为 30 秒）
md-validator docs/ -t 10
```

### 代码块格式

在 Markdown 文件中，代码块格式如下：

```python python:demo:init
from my_sdk import Client
client = Client(api_key="test-key")
print(client.get_status())
```

格式说明：
- `python` - 语言标识（支持 python, javascript/js, bash/shell）
- `python:demo:init` - 唯一的块 ID
- `env:VAR1,VAR2`（可选）- 需要的环境变量

```bash shell:demo:env_demo env:MY_SECRET_KEY
echo "My secret key is: $MY_SECRET_KEY"
```

## 目录结构

```
zy8036/
├── md_validator/
│   ├── __init__.py
│   ├── cli.py          # CLI 入口
│   ├── parser.py       # Markdown 解析器
│   ├── executor.py     # 代码执行器
│   ├── snapshot.py     # 快照管理
│   └── report.py       # 报告生成
├── docs/
│   └── getting-started.md  # 示例文档
├── tests/
│   └── test_parser.py      # 单元测试
└── README.md
```

## 运行测试

```bash
pytest tests/ -v
```

## 测试示例

运行示例文档验证：

```bash
# 首次运行会失败（因为有故意失败的示例）
md-validator docs/

# 查看失败原因：
# - python:demo:init - 模块不存在
# - python:demo:fail_test - 故意抛出异常
# - python:demo:timeout - 超时测试
# - shell:demo:env_demo - 环境变量缺失

# 成功的示例：
# - bash:demo:install - pip 命令执行成功
# - js:demo:js_test - JavaScript 执行成功
```