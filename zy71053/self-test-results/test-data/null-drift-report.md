# GraphQL 空值漂移检测报告

> 生成时间: 2026-05-24T10:59:42.421Z

## 检测摘要

| 指标 | 数值 |
|------|------|
| 扫描字段数 | 3 |
| 扫描查询数 | 1 |
| 受影响查询 | 1 |
| CRITICAL 问题 | 0 |
| HIGH 问题 | 2 |
| MEDIUM 问题 | 0 |
| LOW 问题 | 0 |

## 空值变更详情

### [ND001] Query.user

- **严重程度**: HIGH
- **变更类型**: 字段从 User! → User，失去了非空保证
- **类型变化**: `User! → User`
- **客户端影响**: 客户端代码可能假设该字段永远不会为null，缺少null检查会导致运行时崩溃
- **修复优先级**: 高 - 发布前必须添加兜底逻辑
- **规则说明**: 字段从非空(!)变为可空，客户端必须添加null检查或兜底逻辑，否则可能导致运行时崩溃。

### [ND001] User.name

- **严重程度**: HIGH
- **变更类型**: 字段从 String! → String，失去了非空保证
- **类型变化**: `String! → String`
- **客户端影响**: 客户端代码可能假设该字段永远不会为null，缺少null检查会导致运行时崩溃
- **修复优先级**: 高 - 发布前必须添加兜底逻辑
- **规则说明**: 字段从非空(!)变为可空，客户端必须添加null检查或兜底逻辑，否则可能导致运行时崩溃。

## 受影响的查询

### query GetUser

- **文件**: `test.graphql`

| 查询路径 | Schema路径 | 变更类型 | 兜底建议 |
|----------|------------|----------|----------|
| `user` | `Query.user` | NON_NULL_TO_NULLABLE | 添加null检查: data?.user || defaultValue |
| `user.user.name` | `User.name` | NON_NULL_TO_NULLABLE | 添加null检查: data?.name || defaultValue |

## 失败路径导出

### Query.user

- **严重程度**: HIGH
- **根因**: 客户端代码可能假设该字段永远不会为null，缺少null检查会导致运行时崩溃
- **建议行动**: 添加null检查: data?.user || defaultValue

**影响的查询:**

- query GetUser (test.graphql)

### User.name

- **严重程度**: HIGH
- **根因**: 客户端代码可能假设该字段永远不会为null，缺少null检查会导致运行时崩溃
- **建议行动**: 添加null检查: data?.name || defaultValue

**影响的查询:**

- query GetUser (test.graphql)

## 退出码

- **退出码**: 2
- **说明**: 发现高危问题 - 存在HIGH级空值变更

> ⚠️ **检测到需要修复的空值漂移问题，请在发布前处理**