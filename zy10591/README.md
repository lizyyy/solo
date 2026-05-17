# 镜像标签命名检查工具 (image-tag-linter)

一个用于检查Docker镜像标签命名规范的CLI工具，帮助团队统一镜像标签命名，便于回滚和环境管理。

## 功能特性

- ✅ **标签解析**: 自动识别版本号、提交哈希、环境阶段、构建时间
- 🔍 **命名规则检查**: 内置6条常用命名规则，支持自定义
- 📊 **多种输出格式**: 终端彩色摘要、JSON机器可读、Markdown报告
- 🐛 **异常处理**: 保留坏数据原始位置和原因，友好的错误提示
- 🔧 **灵活输入**: 支持文件输入、标准输入管道

## 安装

```bash
# 安装依赖
pip install -e .

# 验证安装
image-tag-linter --version
```

## 快速开始

### 1. 查看命名规则

```bash
image-tag-linter list-rules
```

### 2. 检查镜像列表

```bash
# 从文件检查
image-tag-linter lint examples/images.txt

# 从管道输入
cat examples/images.txt | image-tag-linter lint

# 输出详细结果（包括通过的）
image-tag-linter lint examples/images.txt --show-all

# 生成报告文件
image-tag-linter lint examples/images.txt \
  --output-json results.json \
  --output-md report.md
```

### 3. 解析单个标签

```bash
image-tag-linter parse v1.2.3-dev
```

## 输入格式

每行一个镜像，支持以下格式：

```
# 基本格式
镜像名:标签

# 带提交哈希
镜像名:标签 提交哈希

# 带提交哈希和环境
镜像名:标签 提交哈希 环境
```

示例：

```
registry.example.com/myapp:v1.2.3-dev a1b2c3d dev
registry.example.com/service:2.0.0-prod abc123def prod
```

支持的分隔符：空格 ` `、逗号 `,`、分号 `;`

## 命名规则

| 规则 | 要求 | 说明 |
|------|------|------|
| semantic_version | ✅ 必需 | 标签必须包含语义化版本号 (x.y.z) |
| environment_stage | ✅ 必需 | 标签应以环境阶段结尾 (-dev/-test/-staging/-prod) |
| no_latest | ✅ 必需 | 禁止使用 'latest' 标签 |
| lowercase_only | ✅ 必需 | 标签只能使用小写字母、数字、点、下划线和连字符 |
| length_limit | ✅ 必需 | 标签长度在1-128字符之间 |
| commit_hash | ⚠️ 建议 | 标签应包含Git提交哈希 (7-40位十六进制) |

### 正确示例

```
v1.2.3-dev
2.0.1-test a1b2c3d
v3.1.0-staging def456ghi
3.0.0-prod jkl789mno prod
```

### 错误示例

```
latest           # 使用了latest
V1.2.3-Prod     # 包含大写字母
build-123        # 没有版本号
v1-dev           # 版本号不完整
dev-v1.0.0       # 环境不在结尾
```

## 输出格式

### 终端输出

- 彩色摘要统计
- 详细检查结果
- 无法解析的行（保留原始行号和内容）

### JSON输出

```json
{
  "metadata": {
    "generated_at": "2024-01-01T12:00:00",
    "input_file": "examples/images.txt",
    "duration_seconds": 0.002
  },
  "statistics": {
    "total": 10,
    "valid": 4,
    "warning": 2,
    "invalid": 4
  },
  "results": [...]
}
```

### Markdown报告

适合发给团队同事的结构化报告，包含：
- 检查统计摘要
- 环境阶段分布
- 命名规则说明
- 详细检查结果

## 命令行选项

### lint 命令

```
--output-json, -j PATH    输出JSON结果文件
--output-md, -m PATH    输出Markdown报告文件
--show-all, -a           显示所有检查结果（包括通过的）
--quiet, -q              静默模式，仅输出错误摘要
--strict, -s              严格模式，警告也视为失败
```

## 使用场景

### CI/CD 集成

```bash
# 在CI流水线中检查，失败时退出非0
image-tag-linter lint images.txt --quiet
if [ $? -ne 0 ]; then
  echo "镜像标签命名不规范！"
  exit 1
fi
```

### 批量检查并生成报告

```bash
# 生成完整报告用于团队审查
image-tag-linter lint production-images.txt \
  --output-json results/$(date +%Y%m%d)_tag_check.json \
  --output-md reports/$(date +%Y%m%d)_tag_check.md
```

## 错误处理

工具会优雅处理以下情况：
- 文件不存在或无法读取
- 格式错误的输入行
- 空输入
- 编码问题

所有错误都会显示：
- 原始行号
- 原始内容
- 错误原因
- 改进建议

## 项目结构

```
.
├── src/
│   └── image_tag_linter/
│       ├── __init__.py
│       ├── cli.py          # CLI入口
│       ├── models.py         # 数据模型
│       ├── parser.py         # 标签解析器
│       ├── validator.py      # 规则验证器
│       └── reporter.py      # 报告生成器
├── examples/
│   └── images.txt          # 示例输入
├── pyproject.toml           # 项目配置
└── README.md                # 本文档
```

## 开发

```bash
# 开发模式安装
pip install -e .

# 运行测试（待完善）
python -m pytest
```

## 许可证

MIT
