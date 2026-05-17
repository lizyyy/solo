# OpenAPI 错误体一致性检查工具

一个用于检查 REST API 错误响应体一致性的 CLI 工具，帮助团队统一 API 错误响应格式。

## 功能特性

- ✅ **OpenAPI 契约解析**: 支持解析 JSON/YAML 格式的 OpenAPI 3.0 规范
- 📊 **状态码分组分析**: 按 HTTP 状态码分组，分析每组错误响应的通用字段
- 🔍 **不一致性检测**: 检测同一状态码下字段不一致、跨状态码通用字段缺失等问题
- 📝 **多格式报告输出**:
  - 终端彩色摘要输出
  - 机器可读 JSON 报告
  - 适合发给同事的 Markdown 报告
- 🎯 **保留原始位置**: 问题记录包含精确的接口路径、方法、状态码位置

## 安装

```bash
npm install
npm run build
```

## 使用方法

### 基础用法

```bash
node dist/cli.js <openapi-file> [options]
```

### 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<input>` | OpenAPI 规范文件路径 (必填) | - |
| `-o, --output-dir <dir>` | 报告输出目录 | `./reports` |
| `--json <path>` | JSON 报告自定义输出路径 | - |
| `--markdown <path>` | Markdown 报告自定义输出路径 | - |
| `--fail-on-error` | 发现错误时以非零状态码退出 | - |

### 示例

```bash
# 基础检查
node dist/cli.js examples/test-api.yaml

# 自定义输出目录
node dist/cli.js examples/test-api.yaml -o ./my-reports

# 指定报告路径
node dist/cli.js examples/test-api.yaml \
  --json ./results/consistency.json \
  --markdown ./results/consistency.md

# CI 环境使用（发现错误时失败）
node dist/cli.js examples/test-api.yaml --fail-on-error
```

## 输出示例

### 终端输出

包含：
- 检查元数据（输入文件、时间、接口数等）
- 问题摘要统计（错误、警告、信息数量）
- 状态码分组分析表格
- 详细问题列表（含位置和改进建议）

### JSON 报告

完整的机器可读报告，包含：
- `metadata`: 检查元数据
- `summary`: 问题统计摘要
- `statusCodeGroups`: 状态码分组详情
- `issues`: 问题详细列表
- `recommendations`: 改进建议

### Markdown 报告

适合团队分享的格式化报告，包含表格、问题详情和建议。

## 项目结构

```
.
├── src/
│   ├── cli.ts          # CLI 入口
│   ├── parser.ts       # OpenAPI 解析器
│   ├── checker.ts      # 一致性检查逻辑
│   ├── reporter.ts     # 报告生成器
│   └── types.ts        # 类型定义
├── examples/
│   └── test-api.yaml   # 测试用 OpenAPI 文件
├── reports/            # 默认输出目录
└── dist/               # 编译输出
```

## 开发

```bash
# 开发模式运行
npm run dev -- examples/test-api.yaml

# 构建
npm run build
```

## License

MIT
