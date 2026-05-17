# GraphQL 字段用量分析 CLI

分析 GraphQL 查询中的字段使用情况，帮助你安全地删除 schema 中不再使用的字段。

## ✨ 功能特性

- **Schema 解析**: 自动解析 GraphQL Schema 文件
- **查询扫描**: 从文件中提取所有 GraphQL 查询
- **字段用量统计**: 统计每个字段的使用次数
- **客户端分组**: 按客户端来源分组统计
- **多格式报告**: 支持终端摘要、JSON、Markdown 报告
- **错误处理**: 保留坏行和异常样本的原始位置和原因
- **自检功能**: 一键验证工具是否正常工作

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 编译

```bash
npm run build
```

### 运行自检（推荐首次使用）

```bash
npm run self-test
# 或者
node dist/cli.js self-test
```

自检通过后，你就可以开始使用了！

## 📖 使用说明

### 基本用法

```bash
node dist/cli.js --schema ./schema.graphql --queries ./queries.txt
```

### 导出报告

```bash
node dist/cli.js \
  --schema ./schema.graphql \
  --queries ./queries.txt \
  --output ./field-usage-report
```

这会生成两个文件：
- `field-usage-report.json` - 机器可读的完整数据
- `field-usage-report.md` - 适合发给同事的 Markdown 报告

### 指定输出格式

```bash
# 只导出 JSON
node dist/cli.js -s schema.gql -q queries.gql -o report --format json

# 只导出 Markdown
node dist/cli.js -s schema.gql -q queries.gql -o report --format markdown
```

### 客户端标签识别

如果你的查询文件中有客户端标签，可以使用正则表达式来识别：

```bash
node dist/cli.js \
  -s schema.gql \
  -q queries.gql \
  --client-tag-pattern "#\\s*client:\\s*(\\S+)"
```

查询文件示例：
```graphql
# client: web-app
query GetUser {
  user(id: "1") {
    id
    name
  }
}

# client: mobile-app
query GetPosts {
  posts {
    id
    title
  }
}
```

## 📁 文件格式要求

### Schema 文件

标准的 `.graphql` 或 `.gql` 文件，例如：

```graphql
type Query {
  user(id: ID!): User
  posts: [Post!]!
}

type User {
  id: ID!
  name: String!
  email: String!
}
```

### 查询样本文件

包含一个或多个 GraphQL 查询的文本文件，查询之间用空行分隔：

```graphql
query GetUser {
  user(id: "1") {
    id
    name
    email
  }
}

query GetPosts {
  posts {
    id
    title
  }
}
```

## 📊 输出说明

### 终端摘要

- 概览统计：总查询数、成功/失败数
- 客户端分布：各客户端的查询数量
- 字段使用排名：Top 20 最常用字段
- 错误详情：所有解析错误的位置和原因

### JSON 报告

包含完整的分析数据，适合程序进一步处理：

```json
{
  "fieldUsage": [
    {
      "fieldName": "id",
      "typeName": "Query.user",
      "fullPath": "Query.user.id",
      "count": 42,
      "clients": {
        "web-app": 30,
        "mobile-app": 12
      }
    }
  ],
  "totalQueries": 100,
  "successfulQueries": 98,
  "failedQueries": 2,
  "errors": [...],
  "clientStats": {...}
}
```

### Markdown 报告

适合直接发给同事或粘贴到文档中，包含：
- 概览统计表
- 客户端分布
- 字段使用排名（Top 50）
- 错误详情
- 操作建议

## 🔍 错误处理

工具会保留所有错误的详细信息：
- 错误所在的文件和行号
- 错误消息
- 原始内容（截断前 100 字符）
- 有问题的查询内容

这让你可以轻松定位并修复问题。

## 💡 使用场景

1. **字段删除前的验证**: 确认要删除的字段确实没有客户端在使用
2. **字段弃用计划**: 识别低使用率字段，制定弃用时间表
3. **客户端使用分析**: 了解不同客户端对 schema 的使用情况
4. **性能优化**: 识别高频查询路径，针对性优化

## 🛠 命令行参数

| 参数 | 别名 | 说明 | 必填 |
|------|------|------|------|
| `--schema` | `-s` | Schema 文件路径 | ✅ |
| `--queries` | `-q` | 查询样本文件路径 | ✅ |
| `--output` | `-o` | 输出报告路径（不含扩展名） | ❌ |
| `--format` | | 输出格式: json, markdown, both (默认) | ❌ |
| `--client-tag-pattern` | | 识别客户端标签的正则表达式 | ❌ |
| `--help` | | 显示帮助信息 | ❌ |

## 🧪 自检

每次修改代码或在新环境中使用时，建议先运行自检：

```bash
npm run self-test
```

自检会：
1. 创建临时测试文件
2. 验证 Schema 解析
3. 验证查询解析和字段提取
4. 验证报告导出
5. 清理临时文件
6. 给出"通过/失败"的结果

## 📝 注意事项

1. 查询文件中的 fragment 目前只处理内联的，外部 fragment 引用暂不展开
2. 字段路径按 `Type.field.subField` 格式统计，不区分 operation 类型
3. 建议查询样本尽可能完整，覆盖所有客户端的使用场景
4. 如果查询文件很大，首次运行可能需要几秒钟

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT
