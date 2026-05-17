# REST 分页一致性 CLI 工具

用于检查 OpenAPI 规范中分页接口的参数和响应字段一致性，解决前端封装列表组件时的规范不一致问题。

## 功能特性

- ✅ **契约解析**: 支持 OpenAPI 3.0 规范的 YAML/JSON 文件解析
- ✅ **参数归一化**: 检查分页参数命名是否一致
- ✅ **响应字段对比**: 检查响应字段命名是否一致
- ✅ **不一致定位**: 精确定位问题位置，保留原始位置信息
- ✅ **多格式报告**: 终端摘要、JSON 机器可读结果、Markdown 报告
- ✅ **CI 友好**: 支持 `--fail-on-error` 选项，发现错误时非零退出
- ✅ **灵活配置**: 支持自定义期望的参数和字段命名

## 安装

```bash
# 克隆项目
git clone <repo-url>
cd rest-pagination-consistency-cli

# 安装依赖
npm install

# 构建
npm run build

# （可选）全局链接
npm link
```

## 快速开始

### 1. 创建示例文件

```bash
# 创建示例 OpenAPI 文件
pagination-check example

# 创建默认配置文件
pagination-check init
```

### 2. 运行检查

```bash
# 基本检查
pagination-check example-openapi.yaml

# 使用自定义配置
pagination-check example-openapi.yaml -c pagination-config.json

# 指定输出目录
pagination-check example-openapi.yaml -o ./my-reports

# CI 模式：发现错误时退出
pagination-check example-openapi.yaml --fail-on-error
```

## 命令行选项

```bash
pagination-check <openapi-file> [options]

参数:
  openapi-file              OpenAPI 规范文件路径 (YAML/JSON)

选项:
  -V, --version             输出版本号
  -c, --config <path>       配置文件路径
  -o, --output <dir>        报告输出目录 (默认: ./reports)
  --json <filename>         导出 JSON 报告的文件名 (默认: pagination-check.json)
  --md <filename>           导出 Markdown 报告的文件名 (默认: pagination-check.md)
  --no-terminal             不输出终端报告
  --fail-on-error           发现错误时以非零状态退出
  --include <paths...>      包含的路径模式 (如 /api/*)
  --exclude <paths...>      排除的路径模式 (如 /health)
  --methods <methods...>    检查的 HTTP 方法 (默认: get)
  -h, --help                显示帮助

子命令:
  init [options]            创建示例配置文件
  example [options]         创建示例 OpenAPI 文件用于测试
```

## 配置文件

使用 `pagination-check init` 创建配置文件，可自定义以下配置：

```json
{
  "expectedParams": {
    "page": ["page", "pageNum", "page_number", "current"],
    "pageSize": ["pageSize", "size", "per_page", "limit", "count"]
  },
  "expectedResponseFields": {
    "data": ["data", "items", "list", "records", "rows"],
    "total": ["total", "totalCount", "total_count", "totalElements"],
    "page": ["page", "pageNum", "current", "page_number"],
    "pageSize": ["pageSize", "size", "per_page", "limit"],
    "totalPages": ["totalPages", "pages", "page_count", "total_pages"]
  },
  "includePaths": ["/api/*"],
  "excludePaths": ["/health", "/metrics"],
  "httpMethods": ["get"]
}
```

### 配置说明

- **expectedParams**: 期望的分页参数命名，数组第一个为标准命名
- **expectedResponseFields**: 期望的响应字段命名，数组第一个为标准命名
- **includePaths**: 只检查匹配的路径模式（支持 `*` 通配符）
- **excludePaths**: 排除匹配的路径模式
- **httpMethods**: 检查的 HTTP 方法

## 输出说明

### 1. 终端输出

- 彩色统计概览
- 问题类型分布
- 严重问题详情
- 需要修复的接口列表

### 2. JSON 报告 (`pagination-check.json`)

机器可读格式，包含完整的检查结果，可用于自动化流程。

### 3. Markdown 报告 (`pagination-check.md`)

适合发给团队同事查看的格式，包含：
- 概览统计表
- 问题详情（按严重程度分类）
- 需要修复的接口列表
- 所有分页接口详情
- 检查配置说明

## 在 CI 中使用

### GitHub Actions 示例

```yaml
name: Pagination Check
on: [push, pull_request]

jobs:
  pagination-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          
      - name: Install dependencies
        run: |
          cd path/to/pagination-check
          npm install
          npm run build
          npm link
          
      - name: Run pagination consistency check
        run: |
          pagination-check openapi.yaml \
            --fail-on-error \
            --exclude /health /metrics \
            -o reports
          
      - name: Upload reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: pagination-reports
          path: reports/
```

### GitLab CI 示例

```yaml
pagination-check:
  image: node:18
  script:
    - cd path/to/pagination-check
    - npm install && npm run build && npm link
    - pagination-check openapi.yaml --fail-on-error -o reports
  artifacts:
    paths:
      - reports/
    when: always
```

## 项目结构

```
.
├── bin/
│   └── pagination-check.js    # CLI 入口
├── src/
│   ├── types.ts              # 类型定义
│   ├── parser.ts             # OpenAPI 解析器
│   ├── checker.ts            # 一致性检查逻辑
│   ├── reporter.ts           # 报告生成器
│   ├── cli.ts                # CLI 命令处理
│   └── index.ts              # 导出入口
├── package.json
├── tsconfig.json
└── README.md
```

## 开发

```bash
# 开发模式运行（使用 ts-node）
npm run dev -- example-openapi.yaml

# 构建
npm run build

# 运行
node dist/cli.js example-openapi.yaml
```

## 常见问题

### Q: 如何只检查特定的接口？

A: 使用 `--include` 选项：

```bash
pagination-check openapi.yaml --include /api/users/* /api/orders/*
```

### Q: 如何排除某些接口？

A: 使用 `--exclude` 选项：

```bash
pagination-check openapi.yaml --exclude /health /metrics /internal/*
```

### Q: 如何自定义标准命名？

A: 修改配置文件，将标准命名放在数组第一个位置：

```json
{
  "expectedParams": {
    "page": ["current", "page", "pageNum"],
    "pageSize": ["size", "pageSize", "limit"]
  }
}
```

## License

MIT
