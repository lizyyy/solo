# Parquet Schema 演进报告 - decimal_test

**生成时间**: 2026-05-24 21:05:37

## 兼容性评估

✅ **完全兼容**

## 变更摘要

| 指标 | 数量 |
|------|------|
| 总变更数 | 1 |
| Decimal 精度变更 | 1 |
| 低严重性 | 1 |

## Schema 源信息

### 旧 Schema
- 来源: examples/test_data/decimal/v1_decimal.parquet
- 字段数: 2
- 行数: 3
- 文件数: 1

### 新 Schema
- 来源: examples/test_data/decimal/v2_decimal.parquet
- 字段数: 2
- 行数: 3
- 文件数: 1

## 详细变更

### 🟠 Decimal 精度变更

- **amount** ![Low](https://img.shields.io/badge/-LOW-green)
  - 描述: Decimal 精度从 (10,2) 变为 (18,4)
  - 旧值: `decimal(10,2)`
  - 新值: `decimal(18,4)`

## 建议

- 📊 Decimal 精度变更可能影响数值计算，建议验证数据转换后的值是否正确
- ✅ Schema 变更完全兼容，可以安全部署

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
    "name": "amount",
    "path": "amount",
    "data_type": "decimal(10,2)",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "decimal_info": {
      "precision": 10,
      "scale": 2
    },
    "original_type": "decimal128(10, 2)"
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
    "name": "amount",
    "path": "amount",
    "data_type": "decimal(18,4)",
    "nullable": true,
    "is_struct": false,
    "is_list": false,
    "is_map": false,
    "decimal_info": {
      "precision": 18,
      "scale": 4
    },
    "original_type": "decimal128(18, 4)"
  }
]
```

</details>