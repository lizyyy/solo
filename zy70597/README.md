# 归档包路径净化CLI

一个专业的命令行工具，用于处理压缩包中的**绝对路径**、**中文空格**和**重复文件名**等问题，防止自动解包时的文件覆盖风险。

## ✨ 主要特性

- 📦 支持 **ZIP** 和 **TAR** 系列压缩格式
- 🛡️ **解包预演**：先分析再操作，安全第一
- 🔍 **重复检测**：按路径检测重复文件名并自动重命名
- 📝 **双格式报告**：
  - 机器可读的 **JSON** 报告（用于自动化）
  - 美观易读的 **Markdown** 报告（用于团队分享）
- 🚪 **清晰退出码**：便于脚本调用和CI/CD集成
- 🧹 自动净化：绝对路径、空格、特殊字符一键处理

## 🚀 快速开始

### 安装依赖

```bash
pip install click rich pydantic charset-normalizer
# 或使用 poetry
poetry install
```

### 基本用法

#### 1. 分析归档包（预演模式）

```bash
# 仅分析，生成报告
python archive_cleaner_cli.py analyze your_archive.zip \
    --json-report result.json \
    --md-report report.md
```

#### 2. 净化并解包

```bash
# 先预演再确认解包
python archive_cleaner_cli.py extract problematic.zip ./output_dir
```

#### 3. 完整命令示例

```bash
python archive_cleaner_cli.py analyze client_delivery.zip \
    -o ./cleaned_output \
    --json-report ./reports/result.json \
    --md-report ./reports/report.md \
    --no-dry-run
```

## 📋 命令参考

### analyze - 分析归档包

| 参数 | 说明 |
|------|------|
| `archive_path` | 归档文件路径（必需） |
| `-o, --output-dir` | 解包输出目录 |
| `--json-report` | JSON报告输出路径 |
| `--md-report` | Markdown报告输出路径 |
| `--dry-run/--no-dry-run` | 仅分析不解包（默认开启） |
| `--no-absolute` | 不移除绝对路径 |
| `--no-spaces` | 不替换空格 |
| `--no-dedup` | 不处理重复文件名 |

### extract - 净化并解包

| 参数 | 说明 |
|------|------|
| `archive_path` | 归档文件路径 |
| `output_dir` | 输出目录 |
| `--preview/--no-preview` | 显示预演列表（默认开启） |

## 🚪 退出码说明

| 退出码 | 含义 | 说明 |
|--------|------|------|
| `0` | 成功 | 无警告无错误 |
| `1` | 有警告 | 发现可净化的问题 |
| `2` | 有错误 | 部分文件处理失败 |
| `3` | 无效输入 | 参数或文件无效 |
| `4` | IO错误 | 文件读写失败 |

## 📊 输出报告说明

### Markdown 报告包含

1. **归档包基本信息**
2. **净化结果摘要**（处理文件数、问题文件数等）
3. **问题类型统计**
4. **净化规则配置**
5. **问题文件详细清单**（保留原始位置和原因）
6. **退出码说明**

### JSON 报告包含

完整的机器可读数据结构，可直接用于后续自动化处理。

## 🔧 净化规则

默认启用以下净化规则：

- ✅ 移除绝对路径前缀
- ✅ 替换普通空格为下划线
- ✅ 替换中文全角空格（\u3000）为下划线
- ✅ 重复文件名自动加索引后缀
- ✅ 标准化路径分隔符
- ✅ 移除路径中的特殊字符

## 🧪 测试

```bash
# 创建测试用归档包
python create_test_zip.py

# 运行测试
python archive_cleaner_cli.py analyze test_archive.zip --md-report test_report.md
```

## 📁 项目结构

```
archive_cleaner/
├── __init__.py          # 包入口
├── models.py            # 数据模型定义
├── archive_reader.py    # 归档文件读取
├── path_normalizer.py   # 路径规范化
├── duplicate_detector.py # 重复检测
├── analyzer.py          # 核心分析整合
├── report_generator.py  # 报告生成
└── cli.py               # CLI命令行接口
```

## 💡 使用场景

1. **客户交付物检查**：收到客户压缩包后先检查路径问题
2. **CI/CD集成**：作为构建流水线的前置检查步骤
3. **归档整理**：批量净化历史归档文件的路径问题
4. **团队协作**：生成规范报告发给同事说明问题

## ⚠️ 注意事项

- 重复运行时报告文件会自动加时间戳，不会覆盖旧结果
- 默认启用预演模式，请确认后再实际解包
- 问题文件会保留原始位置和问题原因记录
