# Pip 依赖哈希 CLI

一个功能完整的 Python 包哈希校验命令行工具，用于验证 Python 依赖包的完整性和来源。

## 功能特性

- ✅ **依赖解析**: 支持 `requirements.txt` 和 `constraints.txt` 文件
- 🔍 **哈希校验**: 验证包的 SHA256/384/512/MD5 哈希值
- 📦 **Wheelhouse 扫描**: 扫描本地 wheel 目录并计算哈希
- 📊 **多格式输出**: 终端摘要、JSON（机器可读）、Markdown（给同事看）
- 🎯 **包源归因**: 追踪包的来源（requirements/constraints/wheelhouse）
- 🚨 **约束冲突检测**: 检测 requirements 和 constraints 之间的版本冲突
- 📋 **完整报告**: 缺失包、缺失哈希、哈希不匹配的详细报告
- 🔢 **稳定退出码**: 可用于 CI/CD 流水线

## 安装

```bash
pip install -e .
```

## 使用方法

### 1. 检查 requirements/constraints 中的包哈希

```bash
pip-hash check \
  -r requirements.txt \
  -c constraints.txt \
  -w wheelhouse/ \
  -o reports/ \
  --report-name my-project
```

**参数说明:**
- `-r, --requirements`: requirements.txt 文件路径
- `-c, --constraints`: constraints.txt 文件路径
- `-w, --wheelhouse`: wheelhouse 目录路径
- `-o, --output-dir`: 输出报告目录（默认: pip-hash-reports）
- `--strict/--no-strict`: 严格模式（默认启用）
- `--color/--no-color`: 终端颜色输出
- `--report-name`: 报告文件名前缀

### 2. 验证单个包的哈希值

```bash
pip-hash verify requests 2.31.0 \
  -H sha256:abc123... \
  -w wheelhouse/
```

### 3. 为 wheelhouse 生成哈希

```bash
pip-hash generate \
  -w wheelhouse/ \
  -o reports/ \
  --format requirements \
  --algorithm sha256
```

## 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 所有检查通过，未发现问题 |
| 1 | 输入参数错误或文件读取失败 |
| 2 | 发现哈希值不匹配 |
| 3 | 缺少必需的包或哈希值 |
| 4 | 依赖约束存在冲突 |
| 5 | 包来源不匹配预期 |
| 10 | 发生未知错误 |

## 输出文件

### 1. 终端摘要
- 彩色输出（可禁用）
- 快速查看整体状态
- 关键问题高亮显示

### 2. JSON 报告 (`*.json`)
- 机器可读格式
- 包含完整的校验数据
- 可用于自动化处理

### 3. Markdown 报告 (`*.md`)
- 人类友好的格式
- 表格化展示
- 适合分享给团队成员
- 包含完整的退出码说明

## 项目结构

```
src/pip_hash_cli/
├── __init__.py          # 版本信息
├── cli.py               # CLI 入口和命令定义
├── constants.py         # 常量和枚举
├── models.py            # 数据模型
├── dependency_parser.py # 依赖文件解析
├── wheel_scanner.py     # Wheel 扫描和包源归因
├── hash_validator.py    # 哈希计算和校验
└── report_generator.py  # 报告生成器
```

## 测试

```bash
# 干净输入测试 + wheelhouse（应返回退出码 0，所有哈希匹配）
pip-hash check -r test-fixtures/clean/requirements.txt -c test-fixtures/clean/constraints.txt -w test-fixtures/wheelhouse

# 脏输入测试（应返回约束冲突退出码 4）
pip-hash check -r test-fixtures/dirty/requirements.txt -c test-fixtures/dirty/constraints.txt -w test-fixtures/wheelhouse
```
