# GitHub PR 评论采样分析工具 (ghcs)

一个用于分析 GitHub Pull Request 评论采样和分析的命令行工具。

## 功能特性

- 📝 **评论解析**: 支持 JSON、CSV 格式的评论数据导入
- 🧵 **线程归并**: 自动将同一位置的评论归并为讨论线程
- 🚦 **阻塞分类**: 自动识别包含阻塞性意见（基于关键词）
- 🔄 **重复检测**: 使用编辑距离算法检测重复讨论
- 📊 **多样输出**:
  - 控制台彩色摘要
  - 机器可读 JSON
  - 适合分享的 Markdown 报告
- 🛡️ **错误处理**: 坏行保留原始位置和原因，不中断分析

## 安装

```bash
npm install
chmod +x src/cli.js
```

## 快速开始

### 运行自检测试
```bash
npm run self-test
# 或
node src/cli.js self-test
```

### 分析评论文件
```bash
# 基本分析
node src/cli.js analyze samples/example-comments.json

# 输出 JSON 结果和 Markdown 报告
node src/cli.js analyze samples/example-comments.json -j -m

# 指定输出目录
node src/cli.js analyze samples/example-comments.json -j -m -o ./reports
```

## 命令说明

### `analyze <file>`

分析评论文件

**选项:**
- `-j, --json`: 输出 JSON 格式结果
- `-m, --markdown`: 输出 Markdown 格式报告
- `-o, --output <dir>`: 输出目录 (默认: ./output)
- `--no-console`: 不输出控制台摘要
- `--strict`: 严格模式，遇到解析错误时终止
- `--no-duplicates`: 禁用重复检测
- `--threshold <number>`: 重复检测相似度阈值 (0-1, 默认: 0.7)

### `self-test`

运行自检测试，验证工具功能

**选项:**
- `-v, --verbose`: 显示详细输出

## 输入数据格式

### JSON 数组格式:
```json
[
  {
    "id": 1,
    "author": "username",
    "body": "评论内容",
    "file_path": "src/file.js",
    "line": 42,
    "line": 42,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### GitHub 导出格式:
```json
{
  "comments": [...],
  "review_comments": [...],
  "reviews": [...]
}
```

## 阻塞关键词

工具会自动检测以下关键词作为阻塞意见：
- 英文: blocking, must fix, cannot merge, request changes, blocker 等
- 中文: 必须修复, 阻塞, 不能合并, 需要修复 等

## 项目结构

```
├── src/
│   ├── cli.js          # CLI 入口
│   ├── models.js        # 数据模型
│   ├── parser.js        # 评论解析器
│   ├── analyzer.js      # 分析引擎
│   ├── reporter.js      # 报告生成器
│   └── selftest.js     # 自检测试
├── samples/             # 示例数据
├── output/              # 输出目录
└── package.json
```

## 示例输出

### 终端输出
- 总体统计
- 分类统计（阻塞、已解决、重复）
- 活跃作者排行
- 热点文件排行
- 重复讨论组
- 解析错误详情

### Markdown 报告
- 执行摘要表格
- 阻塞意见详情
- 重复讨论
- 已解决问题
- 作者/文件统计

## 许可证

MIT
