# Parquet Schema 演进报告 - v1_vs_v2

**生成时间**: 2026-05-24 21:04:40

## 兼容性评估

❌ **不兼容**

## 变更摘要

| 指标 | 数量 |
|------|------|
| 总变更数 | 8 |
| 新增字段 | 5 |
| 类型变更 | 2 |
| Nullable 变更 | 1 |
| 破坏性变更 | 2 |
| 高严重性 | 2 |
| 低严重性 | 6 |

## Schema 源信息

### 旧 Schema
- 来源: examples/test_data/v1/data.parquet
- 字段数: 6
- 行数: 5
- 文件数: 1

### 新 Schema
- 来源: examples/test_data/v2/data.parquet
- 字段数: 9
- 行数: 5
- 文件数: 1

## 详细变更

### 🟢 新增字段

- **address.city** ![Low](https://img.shields.io/badge/-LOW-green)
  - 描述: 新增字段 'address.city'
  - 新值: `address.city: string?`
  - 兼容性影响: **forward_only**
- **address** ![Low](https://img.shields.io/badge/-LOW-green)
  - 描述: 新增字段 'address'
  - 新值: `address: struct?`
  - 兼容性影响: **forward_only**
- **full_name** ![Low](https://img.shields.io/badge/-LOW-green)
  - 描述: 新增字段 'full_name'
  - 新值: `full_name: string?`
  - 兼容性影响: **forward_only**
- **email** ![Low](https://img.shields.io/badge/-LOW-green)
  - 描述: 新增字段 'email'
  - 新值: `email: string?`
  - 兼容性影响: **forward_only**
- **address.country** ![Low](https://img.shields.io/badge/-LOW-green)
  - 描述: 新增字段 'address.country'
  - 新值: `address.country: string?`
  - 兼容性影响: **forward_only**

### 🟡 类型变更

- **score** ![Low](https://img.shields.io/badge/-LOW-green)
  - 描述: 类型安全升级: float32 -> float64
  - 旧值: `float32`
  - 新值: `float64`
- **created_at** ![High](https://img.shields.io/badge/-HIGH-red)
  - 描述: 类型不兼容变更: timestamp[ns] -> timestamp[ms]
  - 旧值: `timestamp[ns]`
  - 新值: `timestamp[ms]`
  - 兼容性影响: **breaking**

### 🟣 Nullable 变更

- **id** ![High](https://img.shields.io/badge/-HIGH-red)
  - 描述: 字段 'id' 从 nullable 变为 non-nullable
  - 旧值: `nullable`
  - 新值: `non-nullable`
  - 兼容性影响: **breaking**

## 建议

- ⚠️  存在破坏性变更，建议在发布前进行完整的数据迁移测试
-    - 字段 'id' 从 nullable 变为 non-nullable
-    - 类型不兼容变更: timestamp[ns] -> timestamp[ms]
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
    "name": "name",
    "path": "name",
    "data_type": "string",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "string"
  },
  {
    "name": "age",
    "path": "age",
    "data_type": "int64",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "int64"
  },
  {
    "name": "score",
    "path": "score",
    "data_type": "float32",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "float"
  },
  {
    "name": "active",
    "path": "active",
    "data_type": "boolean",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "bool"
  },
  {
    "name": "created_at",
    "path": "created_at",
    "data_type": "timestamp[ns]",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "timestamp[ns]"
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
    "name": "name",
    "path": "name",
    "data_type": "string",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "string"
  },
  {
    "name": "full_name",
    "path": "full_name",
    "data_type": "string",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "string"
  },
  {
    "name": "age",
    "path": "age",
    "data_type": "int64",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "int64"
  },
  {
    "name": "score",
    "path": "score",
    "data_type": "float64",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "double"
  },
  {
    "name": "active",
    "path": "active",
    "data_type": "boolean",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "bool"
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
  },
  {
    "name": "created_at",
    "path": "created_at",
    "data_type": "timestamp[ms]",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "original_type": "timestamp[ms]"
  },
  {
    "name": "address",
    "path": "address",
    "data_type": "struct",
    "nullable": true,
    "is_struct": true,
    "is_list": false,
    "is_map": false,
    "children": [
      {
        "name": "city",
        "path": "address.city",
        "data_type": "string",
        "nullable": true,
        "is_struct": false,
        "is_list": false,
        "is_map": false,
        "original_type": "string"
      },
      {
        "name": "country",
        "path": "address.country",
        "data_type": "string",
        "nullable": true,
        "is_struct": false,
        "is_list": false,
        "is_map": false,
        "original_type": "string"
      }
    ],
    "original_type": "struct<city: string, country: string>"
  }
]
```

</details>