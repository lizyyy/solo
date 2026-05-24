# Parquet Schema 演进报告 - compat_test

**生成时间**: 2026-05-24 23:11:31

## 兼容性评估

❌ **不兼容**

## 变更摘要

| 指标 | 数量 |
|------|------|
| 总变更数 | 3 |
| 删除字段 | 1 |
| 类型变更 | 1 |
| Nullable 变更 | 1 |
| 破坏性变更 | 3 |
| 高严重性 | 3 |

## Schema 源信息

### 旧 Schema
- 来源: examples/test_data/compatibility_test/old.parquet
- 字段数: 3
- 行数: 3
- 文件数: 1

### 新 Schema
- 来源: examples/test_data/compatibility_test/new.parquet
- 字段数: 2
- 行数: 3
- 文件数: 1

## 详细变更

### 🔴 删除字段

- **to_remove** ![High](https://img.shields.io/badge/-HIGH-red)
  - 描述: 字段 'to_remove' 已被移除
  - 旧值: `to_remove: int32?`
  - 兼容性影响: **breaking**

### 🟡 类型变更

- **value** ![High](https://img.shields.io/badge/-HIGH-red)
  - 描述: 类型不兼容变更: string -> int64
  - 旧值: `string`
  - 新值: `int64`
  - 兼容性影响: **breaking**

### 🟣 Nullable 变更

- **id** ![High](https://img.shields.io/badge/-HIGH-red)
  - 描述: 字段 'id' 从 nullable 变为 non-nullable
  - 旧值: `nullable`
  - 新值: `non-nullable`
  - 兼容性影响: **breaking**

## 建议

- ⚠️  存在破坏性变更，建议在发布前进行完整的数据迁移测试
-    - 字段 'to_remove' 已被移除
-    - 类型不兼容变更: string -> int64
-    - 字段 'id' 从 nullable 变为 non-nullable
- ⚠️  nullable 变为 non-nullable 可能导致旧数据读取失败，建议添加默认值或确保数据中没有 NULL 值

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
    "name": "value",
    "path": "value",
    "data_type": "string",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "string"
  },
  {
    "name": "to_remove",
    "path": "to_remove",
    "data_type": "int32",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "int32"
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
    "nullable": false,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "int64"
  },
  {
    "name": "value",
    "path": "value",
    "data_type": "int64",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "int64"
  }
]
```

</details>