# Jenkins 参数审计 CLI

审计 Jenkins Job 配置文件中的参数，识别潜在风险，生成人类可读的报告和机器可读的结果。

## 功能特性

- ✅ **XML 解析**: 解析 Jenkins config.xml 配置文件
- ✅ **参数抽取**: 识别多种参数类型（String、Boolean、Choice、Password、Text、File）
- ✅ **步骤关联**: 追踪参数在构建步骤中的使用情况
- ✅ **风险分级**: 四级风险评估（SAFE / WARNING / DANGER / CRITICAL）
- ✅ **终端摘要**: 彩色终端输出，快速查看审计结果
- ✅ **JSON 输出**: 机器可读的结构化数据，便于自动化处理
- ✅ **Markdown 报告**: 适合发给同事的详细报告
- ✅ **异常追踪**: 保留解析错误的原始位置和原因
- ✅ **批量审计**: 支持批量审计整个目录下的所有配置文件

## 安装

```bash
# 使用 poetry 安装依赖
poetry install

# 激活虚拟环境
poetry shell
```

## 使用方法

### 单个文件审计

```bash
# 基本使用 - 仅输出终端摘要
jenkins-param-audit audit examples/config.xml

# 输出 JSON 结果
jenkins-param-audit audit examples/config.xml --json audit_result.json

# 输出 Markdown 报告
jenkins-param-audit audit examples/config.xml --markdown audit_report.md

# 同时输出所有格式
jenkins-param-audit audit examples/config.xml -j result.json -m report.md
```

### 批量审计

```bash
# 批量审计目录下所有 config.xml
jenkins-param-audit batch /path/to/jenkins/jobs

# 指定输出目录
jenkins-param-audit batch /path/to/jenkins/jobs -o my_audit_results
```

## 风险评估维度

### 参数风险

1. **无默认值**: 需要每次人工输入，容易出错
2. **敏感类型**: Password、File 等敏感参数类型
3. **危险名称**: 包含 force、delete、destroy、clean、purge、production 等
4. **危险默认值**: true、production、*、all 等
5. **危险步骤引用**: 被危险构建步骤使用
6. **冗余参数**: 未被任何构建步骤使用

### 构建步骤风险检测

检测常见的危险命令模式：
- `rm -rf` - 递归删除
- `sudo` - 提权操作
- `kubectl delete` - K8s 资源删除
- `terraform destroy` - Terraform 资源销毁
- `curl ... | bash` - 管道执行远程脚本
- `> /dev/sd*` - 直接操作磁盘
- 等等

## 输出格式说明

### 终端输出

- 彩色表格展示摘要数据
- 高风险参数高亮显示
- 危险构建步骤详情
- 解析错误列表

### JSON 输出

完整的结构化数据，包含：
- Job 基本信息
- 所有参数详情（名称、类型、默认值、风险等级、使用位置等）
- 所有构建步骤详情（类型、使用参数、是否危险等）
- 解析错误列表
- 统计摘要

### Markdown 报告

适合团队分享的报告：
- 审计摘要表格
- 风险分布统计
- 高风险参数详情
- 所有参数完整列表
- 危险构建步骤详情
- 解析错误（含原始内容）
- 审计建议

## 项目结构

```
jenkins_param_audit/
├── __init__.py          # 版本信息
├── models.py            # 数据模型定义
├── xml_parser.py        # XML 解析和参数抽取
├── risk_analyzer.py     # 风险分级逻辑
├── report_generator.py  # 报告生成（终端/JSON/Markdown）
└── cli.py               # 命令行入口
```

## 示例

运行示例：

```bash
cd /Users/lzy/pro/solo/workspaces/zy10579
poetry install
poetry run jenkins-param-audit audit examples/config.xml -m examples/report.md -j examples/result.json
```

查看生成的报告：
- `examples/result.json` - 机器可读的 JSON 结果
- `examples/report.md` - 人类可读的 Markdown 报告
