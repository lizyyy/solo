# Parquet Schema 演进报告 - rename_test

**生成时间**: 2026-05-24 23:11:05

## 兼容性评估

❌ **不兼容**

## 变更摘要

| 指标 | 数量 |
|------|------|
| 总变更数 | 6 |
| 新增字段 | 2 |
| 删除字段 | 2 |
| 重命名字段 | 2 |
| 破坏性变更 | 2 |
| 高严重性 | 2 |
| 中严重性 | 2 |
| 低严重性 | 2 |

## Schema 源信息

### 旧 Schema
- 来源: examples/test_data/rename_test/old.parquet
- 字段数: 3
- 行数: 3
- 文件数: 1

### 新 Schema
- 来源: examples/test_data/rename_test/new.parquet
- 字段数: 3
- 行数: 3
- 文件数: 1

## 详细变更

### 🟢 新增字段

- **email** ![Low](https://img.shields.io/badge/-LOW-green)
  - 描述: 新增字段 'email'
  - 新值: `email: string?`
  - 兼容性影响: **forward_only**
- **username** ![Low](https://img.shields.io/badge/-LOW-green)
  - 描述: 新增字段 'username'
  - 新值: `username: string?`
  - 兼容性影响: **forward_only**

### 🔴 删除字段

- **user_name** ![High](https://img.shields.io/badge/-HIGH-red)
  - 描述: 字段 'user_name' 已被移除
  - 旧值: `user_name: string?`
  - 兼容性影响: **breaking**
- **email_address** ![High](https://img.shields.io/badge/-HIGH-red)
  - 描述: 字段 'email_address' 已被移除
  - 旧值: `email_address: string?`
  - 兼容性影响: **breaking**

### 🔵 重命名字段

- **username** ![Medium](https://img.shields.io/badge/-MEDIUM-yellow)
  - 描述: 字段可能重命名: 'user_name' -> 'username'
  - 旧值: `user_name`
  - 新值: `username`
  - 兼容性影响: **potential_issue**
- **email** ![Medium](https://img.shields.io/badge/-MEDIUM-yellow)
  - 描述: 字段可能重命名: 'email_address' -> 'email'
  - 旧值: `email_address`
  - 新值: `email`
  - 兼容性影响: **potential_issue**

## 建议

- ⚠️  存在破坏性变更，建议在发布前进行完整的数据迁移测试
-    - 字段 'user_name' 已被移除
-    - 字段 'email_address' 已被移除
- 🔄 检测到可能的字段重命名，请确认是否为有意变更，并更新下游应用的字段引用

## 完整 Schema 对比

<details>
<summary>点击展开完整 Schema 对比</summary>

### 旧 Schema 字段
```json
[
  {
    "name": "id",
    "path": "id",
    "data_type": "int64",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "int64"
  },
  {
    "name": "user_name",
    "path": "user_name",
    "data_type": "string",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "string"
  },
  {
    "name": "email_address",
    "path": "email_address",
    "data_type": "string",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "string"
  }
]
```

### 新 Schema 字段
```json
[
  {
    "name": "id",
    "path": "id",
    "data_type": "int64",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "int64"
  },
  {
    "name": "username",
    "path": "username",
    "data_type": "string",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "string"
  },
  {
    "name": "email",
    "path": "email",
    "data_type": "string",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "string"
  }
]
```

</details>