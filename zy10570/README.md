# 数据库表注释检查CLI工具

用于检查DDL/SQL文件中表和字段注释缺失、矛盾和重复的命令行工具。

## 功能特性

- ✅ **注释缺失检测**: 检查表和字段是否缺少COMMENT说明
- ⚔️ **注释矛盾检测**: 识别同名表或字段的不同注释说明
- 🔄 **重复注释检测**: 发现不同字段/表使用相同注释文本的情况
- 📋 **坏行保留**: 保留无法解析的异常行及其位置和原因
- 📊 **多种输出**: 终端彩色摘要、机器可读JSON、可分享Markdown报告
- 🚪 **正确退出码**: 0=无问题，1=检测到问题，2=执行错误

## 安装

```bash
npm install
```

## 使用方法

### 基本用法
```bash
node bin/db-comment.js <文件或目录路径>
```

### 导出报告
```bash
# 导出JSON和Markdown报告
node bin/db-comment.js test/sample.sql --json report.json --md report.md

# 指定输出目录
node bin/db-comment.js ./sql --json result.json --md report.md --output-dir ./reports
```

### 仅显示终端摘要
```bash
node bin/db-comment.js test/sample.sql
```

### 不显示终端摘要，只导出报告
```bash
node bin/db-comment.js test/sample.sql --no-summary --json report.json
```

## 命令行选项

- `<paths...>`: 必需，一个或多个DDL/SQL文件或目录路径
- `--json <path>`: 导出JSON报告到指定路径
- `--md <path>`: 导出Markdown报告到指定路径
- `--output-dir <dir>`: 报告输出目录（默认: 当前目录）
- `--no-summary`: 不显示终端摘要
- `-V, --version`: 显示版本号
- `-h, --help`: 显示帮助信息

## 退出码说明

| 退出码 | 说明 |
|--------|------|
| 0 | 执行成功，未发现任何问题 |
| 1 | 执行成功，但发现了注释缺失、矛盾或解析异常 |
| 2 | 执行出错（如文件不存在、权限问题等） |

## 示例输出

```
============================================================
           数据库表注释检查报告
============================================================

📊 概览统计:
  总表数: 6
  总字段数: 20
  解析异常行数: 1

⚠️  缺失注释:
  表注释缺失: 1 个
  字段注释缺失: 3 个

❌ 注释矛盾:
  表注释矛盾: 1 组
  字段注释矛盾: 3 组

...
```

## 测试

```bash
# 运行测试示例
node bin/db-comment.js test/sample.sql --json report.json --md report.md
```
