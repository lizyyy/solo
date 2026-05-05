# CLI Contract Validator (CCV)

本地 CLI 契约验收器 - 用于验证命令行工具的子命令参数、输出和返回码是否符合预期。

## 功能特性

- ✅ **契约驱动**: 使用 YAML/JSON 定义 CLI 行为契约
- ✅ **参数验证**: 支持必填参数、互斥参数、依赖参数、默认值、可选值范围
- ✅ **输出验证**: 验证 stdout/stderr 关键字和期望错误码
- ✅ **批量执行**: 批量执行测试用例，生成通过/失败矩阵
- ✅ **数据持久化**: SQLite 存储测试历史和人工复核备注
- ✅ **报告导出**: 支持 Markdown 报告和 JSON 明细导出

## 安装

```bash
# 克隆项目
cd xy4777

# 安装依赖
pip install -e .
```

或者使用开发模式:

```bash
pip install pyyaml rich click
```

## 快速开始

### 1. 查看命令帮助

```bash
ccv --help
ccv run --help
ccv report --help
```

### 2. 验证示例契约

```bash
# 验证契约文件格式
ccv validate examples/sample_contract.yaml
```

### 3. 运行契约验证

```bash
# 运行所有测试用例
ccv run examples/sample_contract.yaml

# 按标签过滤测试用例
ccv run examples/sample_contract.yaml --tags smoke

# 显示详细输出
ccv run examples/sample_contract.yaml -V

# 不保存到数据库
ccv run examples/sample_contract.yaml --no-save
```

### 4. 生成报告

```bash
# 查看运行历史
ccv history
ccv history --contract data-processor

# 生成 Markdown 报告
ccv report --contract data-processor -o report.md

# 生成 JSON 报告
ccv report --run-id 1 -o report.json
```

### 5. 添加人工复核备注

```bash
ccv note <result_id> --notes "这是预期行为，因为..."
```

## 契约文件格式

契约文件支持 YAML 和 JSON 格式。以下是完整的契约结构说明:

### 顶层结构

```yaml
name: "工具名称"
version: "契约版本"
tool_path: "./path/to/tool"
description: "工具描述"

global_env:
  KEY: "value"

subcommands:
  - name: "subcommand1"
    # ... 子命令定义
  - name: "subcommand2"
    # ... 子命令定义
```

### 子命令定义

```yaml
- name: "transform"
  description: "子命令描述"
  
  parameters:
    - name: "input"
      required: true
      type: "file"
      description: "输入文件路径"
    
    - name: "format"
      required: false
      type: "string"
      default: "json"
      choices: ["json", "csv", "xml"]
      description: "输出格式"
    
    - name: "indent"
      required: false
      type: "integer"
      default: 2
      depends_on: ["pretty"]
      description: "缩进级别 (依赖 pretty 参数)"
    
    - name: "compress"
      required: false
      type: "boolean"
      default: false
      mutually_exclusive_with: ["pretty"]
      description: "压缩输出 (与 pretty 互斥)"
```

### 参数规则说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 参数名称 (必填) |
| `required` | boolean | 是否必填，默认 false |
| `type` | string | 参数类型: string, integer, float, boolean, file |
| `default` | any | 默认值 |
| `choices` | array | 可选值列表 |
| `depends_on` | array | 依赖的参数列表 |
| `mutually_exclusive_with` | array | 互斥的参数列表 |
| `description` | string | 参数描述 |

### 测试用例定义

```yaml
test_cases:
  - name: "测试用例名称"
    command: "subcommand"
    args:
      - "--arg1"
      - "value1"
    env:
      VAR: "value"
    input_files:
      input.txt: |
        文件内容
    expected:
      exit_code: 0
      stdout_contains:
        - "成功"
        - "完成"
      stdout_not_contains:
        - "错误"
      stderr_contains:
        - "警告"
      stderr_not_contains:
        - "Exception"
      timeout: 30
    description: "测试用例描述"
    tags:
      - "smoke"
      - "normal"
```

### 输出期望说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `exit_code` | integer | 期望的退出码，默认 0 |
| `stdout_contains` | array | stdout 必须包含的关键字列表 |
| `stdout_not_contains` | array | stdout 不能包含的关键字列表 |
| `stderr_contains` | array | stderr 必须包含的关键字列表 |
| `stderr_not_contains` | array | stderr 不能包含的关键字列表 |
| `timeout` | integer | 超时时间（秒），默认 30 |

## 示例被测 CLI

项目包含一个示例被测 CLI 工具 `examples/sample_cli.py`，用于演示契约验证。

### 工具功能

该工具包含两个子命令:

1. **transform** - 数据格式转换
   - 支持 CSV/JSON 输入
   - 输出格式: json, csv, xml, yaml
   - 支持美化输出、压缩输出

2. **validate** - 数据验证
   - 验证 JSON 格式
   - 支持 JSON Schema 验证

### 使用示例

```bash
# 查看帮助
python examples/sample_cli.py --help

# 数据转换
python examples/sample_cli.py transform --input data.csv --output data.json --format json

# 美化输出
python examples/sample_cli.py transform --input data.csv --output data.json --pretty --indent 4

# 验证 JSON
python examples/sample_cli.py validate --file data.json
```

## 验证流程

### 正常参数验证流程

```
1. 准备测试数据
   └── 在 input_files 中定义输入文件内容

2. 构建命令
   └── command + args 组成完整命令行

3. 准备执行环境
   └── 合并 global_env 和测试用例 env
   └── 在临时目录创建输入文件

4. 执行命令
   └── 捕获 stdout, stderr, exit_code

5. 验证输出
   ├── 检查 exit_code 是否匹配
   ├── 检查 stdout_contains 关键字
   ├── 检查 stdout_not_contains 关键字
   ├── 检查 stderr_contains 关键字
   └── 检查 stderr_not_contains 关键字

6. 生成结果
   └── 记录通过/失败状态和详细信息
```

### 异常参数验证流程

```
1. 构造异常参数组合
   ├── 缺少必填参数
   ├── 参数值不在 choices 范围内
   ├── 互斥参数同时使用
   └── 输入文件不存在

2. 执行命令
   └── 预期命令会失败

3. 验证错误行为
   ├── 检查 exit_code 是否为非零
   ├── 检查 stderr 是否包含错误信息
   └── 确认 stdout 不包含成功信息

4. 记录预期失败
   └── 验证 CLI 是否正确处理错误情况
```

## 项目结构

```
cli-contract-validator/
├── cli_contract_validator/
│   ├── __init__.py          # 版本信息
│   ├── cli.py               # 命令行入口
│   ├── models.py            # 数据模型定义
│   ├── contract_loader.py   # 契约文件加载器
│   ├── validator.py         # 参数验证逻辑
│   ├── executor.py          # 命令执行器
│   ├── storage.py           # SQLite 存储
│   └── reporter.py          # 报告生成器
├── examples/
│   ├── sample_contract.yaml # 示例契约文件
│   └── sample_cli.py        # 示例被测 CLI
├── pyproject.toml           # 项目配置
└── README.md                # 本文档
```

## 数据库结构

CCV 使用 SQLite 存储测试结果和历史记录:

### test_runs 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| contract_name | TEXT | 契约名称 |
| contract_version | TEXT | 契约版本 |
| run_at | TIMESTAMP | 运行时间 |
| total_tests | INTEGER | 总测试数 |
| passed_tests | INTEGER | 通过数 |
| failed_tests | INTEGER | 失败数 |
| skipped_tests | INTEGER | 跳过数 |
| error_tests | INTEGER | 错误数 |

### test_results 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| run_id | INTEGER | 关联的运行 ID |
| contract_name | TEXT | 契约名称 |
| subcommand_name | TEXT | 子命令名称 |
| test_case_name | TEXT | 测试用例名称 |
| status | TEXT | 状态: pass/fail/error/skip |
| command | TEXT | 执行的完整命令 |
| actual_exit_code | INTEGER | 实际退出码 |
| actual_stdout | TEXT | 标准输出 |
| actual_stderr | TEXT | 错误输出 |
| expected_exit_code | INTEGER | 期望退出码 |
| duration_seconds | REAL | 执行耗时 |
| timestamp | TIMESTAMP | 时间戳 |
| failures | TEXT | 失败原因列表 (JSON) |
| tags | TEXT | 标签列表 (JSON) |
| notes | TEXT | 人工复核备注 |

## 使用场景

### 1. CI/CD 集成

```yaml
# GitHub Actions 示例
jobs:
  test:
    steps:
      - uses: actions/checkout@v4
      
      - name: 安装 CCV
        run: pip install -e .
      
      - name: 运行契约验证
        run: |
          ccv run contracts/mytool.yaml -V
      
      - name: 生成报告
        if: always()
        run: |
          ccv report --contract mytool -o report.md
          ccv report --contract mytool -o report.json
      
      - name: 上传报告
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-reports
          path: |
            report.md
            report.json
```

### 2. 本地开发测试

```bash
# 修改 CLI 工具代码后，快速验证
ccv run contracts/mytool.yaml --tags smoke

# 发现失败后，查看详细信息
ccv run contracts/mytool.yaml -V

# 生成报告供团队评审
ccv report --contract mytool -o latest_report.md

# 添加人工复核备注
ccv note 42 --notes "这是已知问题，将在 v2.1 修复"
```

### 3. 多工具管理

```bash
# 验证多个工具
for contract in contracts/*.yaml; do
  echo "Testing $contract"
  ccv run "$contract"
done

# 查看所有运行历史
ccv history
```

## License

MIT License
