# 宠物医院药房管理CLI

一个功能完整的宠物医院药房管理命令行工具，解决医生开药、体重剂量计算、库存批号核对等问题，特别支持小体重宠物的精确剂量计算。

## 功能特性

- ✅ **剂量自动计算** - 根据宠物体重和种类自动计算精确剂量，支持最小剂量保底
- ✅ **库存批号管理** - 自动批号追踪，先进先出，过期预警
- ✅ **处方复核流程** - 完整的创建-复核-发药流程
- ✅ **异常记录** - 自动记录剂量计算、库存等异常
- ✅ **多维度筛选** - 按负责人、时间、状态、异常类型筛选
- ✅ **报告导出** - 支持CSV/JSON格式导出查询结果
- ✅ **数据导入** - 支持处方JSON、库存CSV、剂量规则JSON导入
- ✅ **坏记录处理** - 保留原始位置、失败原因、修改建议

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 查看帮助

```bash
node src/index.js --help
```

### 3. 导入样例数据

#### 导入剂量规则

```bash
node src/index.js import-rules data/import/sample_dosage_rules.json
```

#### 导入库存

```bash
node src/index.js import-inventory data/import/sample_inventory.csv
```

#### 导入处方（包含正常和异常样例）

```bash
node src/index.js import-prescriptions data/import/sample_prescriptions.json
```

### 4. 查看导入错误

```bash
node src/index.js import-errors
```

导出错误记录：

```bash
node src/index.js import-errors --export
```

## 核心流程

### 1. 创建处方

```bash
node src/index.js create-prescription \
  --pet-name "小黑" \
  --species "犬" \
  --weight 3.5 \
  --doctor "张医生" \
  --diagnosis "中耳炎"
```

### 2. 查看处方列表

查看所有处方：

```bash
node src/index.js list-prescriptions
```

按医生筛选：

```bash
node src/index.js list-prescriptions --doctor "张医生"
```

按状态筛选：

```bash
node src/index.js list-prescriptions --status pending
```

只显示有异常的处方：

```bash
node src/index.js list-prescriptions --has-anomalies
```

按日期范围筛选：

```bash
node src/index.js list-prescriptions --start-date 2024-01-01 --end-date 2024-12-31
```

导出查询结果：

```bash
node src/index.js list-prescriptions --export
```

### 3. 查看处方详情

```bash
node src/index.js show-prescription <处方ID>
```

### 4. 复核处方

```bash
node src/index.js review-prescription <处方ID> \
  --reviewer "李药师" \
  --notes "剂量核对无误" \
  --allocate
```

参数说明：
- `--allocate` - 复核同时分配库存

### 5. 查看库存

```bash
node src/index.js inventory
```

导出库存：

```bash
node src/index.js inventory --export
```

### 6. 查看统计信息

```bash
node src/index.js stats
```

导出统计：

```bash
node src/index.js stats --export
```

### 7. 查看导出文件

```bash
node src/index.js list-exports
```

## 命令清单

| 命令 | 说明 |
|------|------|
| `import-prescriptions <file>` | 从JSON文件导入处方 |
| `import-inventory <file>` | 从CSV文件导入库存 |
| `import-rules <file>` | 从JSON文件导入剂量规则 |
| `import-errors [options]` | 查看导入错误 |
| `create-prescription [options]` | 创建新处方 |
| `review-prescription <id> [options]` | 复核处方 |
| `list-prescriptions [options]` | 查询处方列表 |
| `show-prescription <id>` | 查看处方详情 |
| `inventory [options]` | 查看库存概况 |
| `stats [options]` | 查看统计信息 |
| `list-exports` | 列出已导出的文件 |

## 数据格式说明

### 剂量规则 (JSON)

```json
[
  {
    "medicineName": "阿莫西林",
    "species": "犬",
    "minWeight": 0,
    "maxWeight": 50,
    "dosagePerKg": 10,
    "dosageUnit": "mg",
    "minDosage": 25,
    "maxDosage": 500,
    "frequency": "每日2次",
    "route": "口服",
    "notes": "饭后服用"
  }
]
```

### 库存 (CSV)

| 字段 | 说明 | 必填 |
|------|------|------|
| medicineName | 药品名称 | ✅ |
| batchNumber | 批号 | ✅ |
| quantity | 数量 | ✅ |
| unit | 单位 | |
| expiryDate | 有效期 | ✅ |
| location | 货位 | |
| supplier | 供应商 | |
| costPrice | 进价 | |

### 处方 (JSON)

```json
[
  {
    "petName": "旺财",
    "species": "犬",
    "breed": "金毛",
    "weight": 25,
    "weightUnit": "kg",
    "age": "3岁",
    "doctor": "张医生",
    "diagnosis": "皮肤感染",
    "medicines": [
      {
        "medicineName": "阿莫西林",
        "dosage": 250,
        "dosageUnit": "mg",
        "frequency": "每日2次",
        "quantity": 7
      }
    ],
    "notes": "注意观察过敏反应"
  }
]
```

## 异常类型

| 类型 | 说明 |
|------|------|
| `dosage_calculation` | 剂量计算失败 |
| `inventory_shortage` | 库存不足 |
| `expiring_inventory` | 库存即将过期 |
| `inventory_check` | 库存检查失败 |
| `inventory_allocation` | 库存分配失败 |
| `cancelled` | 处方已取消 |

## 数据存储位置

所有数据以JSON格式存储在 `data/` 目录下：

- `data/prescriptions.json` - 处方数据
- `data/inventory.json` - 库存数据
- `data/medicines.json` - 药品数据
- `data/dosage_rules.json` - 剂量规则
- `data/import_errors.json` - 导入错误记录

导出文件位于 `data/export/` 目录。

## 使用样例流程

```bash
# 1. 安装依赖
npm install

# 2. 导入剂量规则
node src/index.js import-rules data/import/sample_dosage_rules.json

# 3. 导入库存
node src/index.js import-inventory data/import/sample_inventory.csv

# 4. 查看导入错误
node src/index.js import-errors

# 5. 导入处方
node src/index.js import-prescriptions data/import/sample_prescriptions.json

# 6. 查看处方列表
node src/index.js list-prescriptions

# 7. 查看有异常的处方
node src/index.js list-prescriptions --has-anomalies

# 8. 查看库存
node src/index.js inventory

# 9. 查看统计
node src/index.js stats

# 10. 创建新处方
node src/index.js create-prescription \
  --pet-name "小白" \
  --species "猫" \
  --weight 2.5 \
  --doctor "李医生"

# 11. 查看处方详情（复制上面输出的处方ID）
node src/index.js show-prescription <处方ID>

# 12. 复核处方（替换为实际处方ID）
node src/index.js review-prescription <处方ID> \
  --reviewer "王药师" \
  --notes "核对无误"

# 13. 导出所有处方
node src/index.js list-prescriptions --export

# 14. 查看导出文件
node src/index.js list-exports
```

## 注意事项

1. **小体重宠物** - 系统自动应用最小剂量规则，确保小体重宠物（如<1kg）不会出现剂量过小的情况
2. **批号管理** - 库存分配默认采用先进先出原则，优先分配效期较早的批次
3. **过期预警** - 系统会自动标记30天内即将过期的库存
4. **数据导入** - 导入时遇到的坏记录不会直接丢弃，会保存到导入错误记录中，包含原始数据、失败原因和修改建议
5. **持久化存储** - 所有操作都会立即写入磁盘，命令之间共享同一份历史数据

## 技术栈

- Node.js (ESM)
- Commander - CLI框架
- csv-parse/csv-stringify - CSV处理
- chalk - 终端彩色输出
- cli-table3 - 终端表格

## License

MIT
