# GraphQL 空值漂移检测报告

> 生成时间: 2026-05-24T10:59:56.522Z

## 检测摘要

| 指标 | 数值 |
|------|------|
| 扫描字段数 | 21 |
| 扫描查询数 | 2 |
| 受影响查询 | 3 |
| CRITICAL 问题 | 0 |
| HIGH 问题 | 11 |
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

### [ND001] User.profile

- **严重程度**: HIGH
- **变更类型**: 字段从 Profile! → Profile，失去了非空保证
- **类型变化**: `Profile! → Profile`
- **客户端影响**: 客户端代码可能假设该字段永远不会为null，缺少null检查会导致运行时崩溃
- **修复优先级**: 高 - 发布前必须添加兜底逻辑
- **规则说明**: 字段从非空(!)变为可空，客户端必须添加null检查或兜底逻辑，否则可能导致运行时崩溃。

### [ND001] Profile.avatar

- **严重程度**: HIGH
- **变更类型**: 字段从 String! → String，失去了非空保证
- **类型变化**: `String! → String`
- **客户端影响**: 客户端代码可能假设该字段永远不会为null，缺少null检查会导致运行时崩溃
- **修复优先级**: 高 - 发布前必须添加兜底逻辑
- **规则说明**: 字段从非空(!)变为可空，客户端必须添加null检查或兜底逻辑，否则可能导致运行时崩溃。

### [ND001] Profile.address

- **严重程度**: HIGH
- **变更类型**: 字段从 Address! → Address，失去了非空保证
- **类型变化**: `Address! → Address`
- **客户端影响**: 客户端代码可能假设该字段永远不会为null，缺少null检查会导致运行时崩溃
- **修复优先级**: 高 - 发布前必须添加兜底逻辑
- **规则说明**: 字段从非空(!)变为可空，客户端必须添加null检查或兜底逻辑，否则可能导致运行时崩溃。

### [ND001] Address.street

- **严重程度**: HIGH
- **变更类型**: 字段从 String! → String，失去了非空保证
- **类型变化**: `String! → String`
- **客户端影响**: 客户端代码可能假设该字段永远不会为null，缺少null检查会导致运行时崩溃
- **修复优先级**: 高 - 发布前必须添加兜底逻辑
- **规则说明**: 字段从非空(!)变为可空，客户端必须添加null检查或兜底逻辑，否则可能导致运行时崩溃。

### [ND002] Query.posts

- **严重程度**: HIGH
- **变更类型**: 列表从 [Post]! → [Post]，列表本身可能为null
- **类型变化**: `[Post!]! → [Post!]`
- **客户端影响**: 客户端可能直接遍历列表，当列表为null时会导致"Cannot read property map of null"
- **修复优先级**: 高 - 遍历前必须判空
- **规则说明**: 列表外层从非空变为可空，列表本身可能为null，需要先判空后再遍历。

### [ND001] Post.content

- **严重程度**: HIGH
- **变更类型**: 字段从 String! → String，失去了非空保证
- **类型变化**: `String! → String`
- **客户端影响**: 客户端代码可能假设该字段永远不会为null，缺少null检查会导致运行时崩溃
- **修复优先级**: 高 - 发布前必须添加兜底逻辑
- **规则说明**: 字段从非空(!)变为可空，客户端必须添加null检查或兜底逻辑，否则可能导致运行时崩溃。

### [ND003] Post.comments

- **严重程度**: HIGH
- **变更类型**: 列表元素从 [Comment!] → [Comment]，元素可能为null
- **类型变化**: `[Comment!]! → [Comment]!`
- **客户端影响**: 客户端遍历列表时可能假设元素非空，访问元素属性时会崩溃
- **修复优先级**: 高 - 遍历时必须过滤或检查null
- **规则说明**: 列表内部元素从非空变为可空，遍历列表时必须检查每个元素是否为null，否则数组访问时崩溃。

### [ND001] Comment.text

- **严重程度**: HIGH
- **变更类型**: 字段从 String! → String，失去了非空保证
- **类型变化**: `String! → String`
- **客户端影响**: 客户端代码可能假设该字段永远不会为null，缺少null检查会导致运行时崩溃
- **修复优先级**: 高 - 发布前必须添加兜底逻辑
- **规则说明**: 字段从非空(!)变为可空，客户端必须添加null检查或兜底逻辑，否则可能导致运行时崩溃。

### [ND003] Query.search

- **严重程度**: HIGH
- **变更类型**: 列表元素从 [SearchResult!] → [SearchResult]，元素可能为null
- **类型变化**: `[SearchResult!]! → [SearchResult]!`
- **客户端影响**: 客户端遍历列表时可能假设元素非空，访问元素属性时会崩溃
- **修复优先级**: 高 - 遍历时必须过滤或检查null
- **规则说明**: 列表内部元素从非空变为可空，遍历列表时必须检查每个元素是否为null，否则数组访问时崩溃。

## 受影响的查询

### query GetPosts

- **文件**: `/Users/lzy/pro/solo/workspaces/zy71053/examples/queries/posts.graphql`

| 查询路径 | Schema路径 | 变更类型 | 兜底建议 |
|----------|------------|----------|----------|
| `posts` | `Query.posts` | LIST_WRAPPER_NON_NULL_TO_NULLABLE | 列表判空后遍历: (data?.posts || []).map(...) |
| `posts.posts.content` | `Post.content` | NON_NULL_TO_NULLABLE | 添加null检查: data?.content || defaultValue |
| `posts.author.posts.author.name` | `User.name` | NON_NULL_TO_NULLABLE | 添加null检查: data?.name || defaultValue |
| `posts.posts.comments` | `Post.comments` | LIST_INNER_NON_NULL_TO_NULLABLE | 遍历时过滤null: data.comments.filter(Boolean).map(...) |
| `posts.comments.posts.comments.text` | `Comment.text` | NON_NULL_TO_NULLABLE | 添加null检查: data?.text || defaultValue |
| `posts.comments.author.posts.comments.author.name` | `User.name` | NON_NULL_TO_NULLABLE | 添加null检查: data?.name || defaultValue |

### query Search

- **文件**: `/Users/lzy/pro/solo/workspaces/zy71053/examples/queries/posts.graphql`

| 查询路径 | Schema路径 | 变更类型 | 兜底建议 |
|----------|------------|----------|----------|
| `search` | `Query.search` | LIST_INNER_NON_NULL_TO_NULLABLE | 遍历时过滤null: data.search.filter(Boolean).map(...) |

### query GetUser

- **文件**: `/Users/lzy/pro/solo/workspaces/zy71053/examples/queries/user.graphql`

| 查询路径 | Schema路径 | 变更类型 | 兜底建议 |
|----------|------------|----------|----------|
| `user` | `Query.user` | NON_NULL_TO_NULLABLE | 添加null检查: data?.user || defaultValue |
| `user.user.name` | `User.name` | NON_NULL_TO_NULLABLE | 添加null检查: data?.name || defaultValue |
| `user.user.profile` | `User.profile` | NON_NULL_TO_NULLABLE | 添加null检查: data?.profile || defaultValue |
| `user.profile.user.profile.avatar` | `Profile.avatar` | NON_NULL_TO_NULLABLE | 添加null检查: data?.avatar || defaultValue |
| `user.profile.user.profile.address` | `Profile.address` | NON_NULL_TO_NULLABLE | 添加null检查: data?.address || defaultValue |
| `user.profile.address.user.profile.address.street` | `Address.street` | NON_NULL_TO_NULLABLE | 添加null检查: data?.street || defaultValue |

## 失败路径导出

### Query.posts

- **严重程度**: HIGH
- **根因**: 客户端可能直接遍历列表，当列表为null时会导致"Cannot read property map of null"
- **建议行动**: 列表判空后遍历: (data?.posts || []).map(...)

**影响的查询:**

- query GetPosts (/Users/lzy/pro/solo/workspaces/zy71053/examples/queries/posts.graphql)

### Post.content

- **严重程度**: HIGH
- **根因**: 客户端代码可能假设该字段永远不会为null，缺少null检查会导致运行时崩溃
- **建议行动**: 添加null检查: data?.content || defaultValue

**影响的查询:**

- query GetPosts (/Users/lzy/pro/solo/workspaces/zy71053/examples/queries/posts.graphql)

### User.name

- **严重程度**: HIGH
- **根因**: 客户端代码可能假设该字段永远不会为null，缺少null检查会导致运行时崩溃
- **建议行动**: 添加null检查: data?.name || defaultValue

**影响的查询:**

- query GetPosts (/Users/lzy/pro/solo/workspaces/zy71053/examples/queries/posts.graphql)
- query GetUser (/Users/lzy/pro/solo/workspaces/zy71053/examples/queries/user.graphql)

### Post.comments

- **严重程度**: HIGH
- **根因**: 客户端遍历列表时可能假设元素非空，访问元素属性时会崩溃
- **建议行动**: 遍历时过滤null: data.comments.filter(Boolean).map(...)

**影响的查询:**

- query GetPosts (/Users/lzy/pro/solo/workspaces/zy71053/examples/queries/posts.graphql)

### Comment.text

- **严重程度**: HIGH
- **根因**: 客户端代码可能假设该字段永远不会为null，缺少null检查会导致运行时崩溃
- **建议行动**: 添加null检查: data?.text || defaultValue

**影响的查询:**

- query GetPosts (/Users/lzy/pro/solo/workspaces/zy71053/examples/queries/posts.graphql)

### Query.search

- **严重程度**: HIGH
- **根因**: 客户端遍历列表时可能假设元素非空，访问元素属性时会崩溃
- **建议行动**: 遍历时过滤null: data.search.filter(Boolean).map(...)

**影响的查询:**

- query Search (/Users/lzy/pro/solo/workspaces/zy71053/examples/queries/posts.graphql)

### Query.user

- **严重程度**: HIGH
- **根因**: 客户端代码可能假设该字段永远不会为null，缺少null检查会导致运行时崩溃
- **建议行动**: 添加null检查: data?.user || defaultValue

**影响的查询:**

- query GetUser (/Users/lzy/pro/solo/workspaces/zy71053/examples/queries/user.graphql)

### User.profile

- **严重程度**: HIGH
- **根因**: 客户端代码可能假设该字段永远不会为null，缺少null检查会导致运行时崩溃
- **建议行动**: 添加null检查: data?.profile || defaultValue

**影响的查询:**

- query GetUser (/Users/lzy/pro/solo/workspaces/zy71053/examples/queries/user.graphql)

### Profile.avatar

- **严重程度**: HIGH
- **根因**: 客户端代码可能假设该字段永远不会为null，缺少null检查会导致运行时崩溃
- **建议行动**: 添加null检查: data?.avatar || defaultValue

**影响的查询:**

- query GetUser (/Users/lzy/pro/solo/workspaces/zy71053/examples/queries/user.graphql)

### Profile.address

- **严重程度**: HIGH
- **根因**: 客户端代码可能假设该字段永远不会为null，缺少null检查会导致运行时崩溃
- **建议行动**: 添加null检查: data?.address || defaultValue

**影响的查询:**

- query GetUser (/Users/lzy/pro/solo/workspaces/zy71053/examples/queries/user.graphql)

### Address.street

- **严重程度**: HIGH
- **根因**: 客户端代码可能假设该字段永远不会为null，缺少null检查会导致运行时崩溃
- **建议行动**: 添加null检查: data?.street || defaultValue

**影响的查询:**

- query GetUser (/Users/lzy/pro/solo/workspaces/zy71053/examples/queries/user.graphql)

## 退出码

- **退出码**: 2
- **说明**: 发现高危问题 - 存在HIGH级空值变更

> ⚠️ **检测到需要修复的空值漂移问题，请在发布前处理**