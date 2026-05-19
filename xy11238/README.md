# 高校实验室试剂管理系统 - CLI工具

一个用于管理高校实验室试剂申领、库存管理、危化品规则校验的命令行工具。支持数据持久化、错误记录和修改建议。

## 功能特性

- 📥 **数据导入**: 支持申领单CSV、库存JSON、危化品规则JSON导入
- ✅ **智能校验**: 自动校验数据格式，保留原始记录、错误原因和修改建议
- 🔍 **复核功能**: 核对库存、危险等级、审批记录一致性
- 💾 **持久化存储**: 本地JSON文件存储，重启后数据不丢失
- 📤 **数据导出**: 支持多种数据格式导出
- 📊 **历史记录**: 完整的导入历史和错误记录追踪

## 快速开始

### 安装依赖

```bash
npm install
```

### 查看帮助

```bash
node src/index.js --help
```

## 使用指南

### 1. 导入申领单 (CSV)

导入试剂申领单数据，CSV格式需包含以下字段：
- reagentName: 试剂名称
- applicant: 申请人
- quantity: 数量
- applicationDate: 申请日期
- department: 部门
- purpose: 用途
- approved: 是否已审批 (true/false)
- approver: 审批人

```bash
# 导入样例数据
node src/index.js import-applications samples/applications.csv
```

### 2. 导入库存 (JSON)

导入试剂库存数据，校验试剂名称、数量等字段。

```bash
# 导入样例数据
node src/index.js import-inventory samples/inventory.json
```

### 3. 导入危化品规则 (JSON)

导入危化品管理规则，包括危险等级、是否需要审批、最大申领量等。

```bash
# 导入样例数据
node src/index.js import-hazard-rules samples/hazardRules.json
```

### 4. 复核申领记录

复核所有申领记录，核对库存是否充足、危化品审批是否完整、申领数量是否超限。

```bash
node src/index.js review
```

### 5. 导出数据

```bash
# 导出所有数据
node src/index.js export -a all-data.json

# 导出错误记录
node src/index.js export -e errors.json

# 导出复核结果
node src/index.js export -r review-results.json

# 导出申领记录
node src/index.js export -p applications.json

# 导出库存记录
node src/index.js export -i inventory.json

# 导出导入历史
node src/index.js export -h history.json
```

### 6. 查看错误记录

查看所有数据导入和复核过程中产生的错误记录，包括原始数据、错误原因和修改建议。

```bash
# 查看所有错误
node src/index.js list-errors

# 按来源过滤错误
node src/index.js list-errors -s application
node src/index.js list-errors -s inventory
node src/index.js list-errors -s hazardRule
node src/index.js list-errors -s review
```

### 7. 查看导入历史

```bash
node src/index.js list-history
```

### 8. 查看数据状态

```bash
node src/index.js status
```

### 9. 清空数据

⚠️ 谨慎操作，此操作不可恢复！

```bash
node src/index.js clear

# 强制清空（不提示确认）
node src/index.js clear -f
```

## 样例数据说明

`samples/` 目录包含了正常数据和异常数据，用于测试：

### applications.csv
- 正常记录: 乙醇、浓硫酸、蒸馏水、盐酸、丙酮 (5条)
- 异常记录:
  - 第7行: 试剂名称为空
  - 第8行: 数量为负数
  - 第9行: 申请日期为空

### inventory.json
- 正常记录: 乙醇、浓硫酸、蒸馏水、盐酸、丙酮 (5条)
- 异常记录:
  - 第6条: 试剂名称为空
  - 第7条: 库存数量为负数

### hazardRules.json
- 正常记录: 乙醇、浓硫酸、蒸馏水、盐酸、丙酮、氢氧化钠、高锰酸钾、甲醛 (8条)
- 异常记录:
  - 第9条: 危险等级为非法值("超级高")，requiresApproval类型错误

## 数据持久化

所有数据存储在 `data/storage.json` 文件中，包括：
- 申领记录 (applications)
- 库存记录 (inventory)
- 危化品规则 (hazardRules)
- 导入历史 (importHistory)
- 复核结果 (reviewResults)
- 错误记录 (errorRecords)

即使重启程序或重新运行，所有历史数据都会保留。

## 错误处理机制

系统会自动捕获并记录以下类型的错误：

1. **数据缺失**: 必填字段为空（试剂名称、申请人、数量、日期等）
2. **数据格式错误**: 数量非正数、非法的危险等级、布尔值类型错误
3. **业务规则错误**: 库存不足、超量申领、需要审批但未审批等

每条错误记录包含：
- `source`: 错误来源
- `rowNumber`: 原始行号
- `originalData`: 原始数据
- `errorType`: 错误类型
- `errorMessage`: 错误描述
- `suggestion`: 修改建议
- `timestamp`: 错误时间

## 命令列表

| 命令 | 说明 |
|------|------|
| `import-applications <file>` | 导入申领单CSV |
| `import-inventory <file>` | 导入库存JSON |
| `import-hazard-rules <file>` | 导入危化品规则JSON |
| `review` | 复核申领记录 |
| `export [options] [output]` | 导出数据 |
| `list-errors [options]` | 查看错误记录 |
| `list-history` | 查看导入历史 |
| `status` | 查看数据状态 |
| `clear [options]` | 清空所有数据 |

## 项目结构

```
.
├── src/
│   ├── index.js        # CLI入口
│   ├── storage.js      # 持久化存储
│   ├── importer.js     # 数据导入
│   ├── reviewer.js     # 复核逻辑
│   ├── exporter.js     # 数据导出
│   └── errorHandler.js # 错误处理
├── data/
│   └── storage.json    # 数据存储文件
├── samples/            # 样例数据
│   ├── applications.csv
│   ├── inventory.json
│   └── hazardRules.json
├── package.json
└── README.md
```

## 运行示例

### 完整流程演示

```bash
# 1. 安装依赖
npm install

# 2. 导入申领单
node src/index.js import-applications samples/applications.csv

# 3. 导入库存
node src/index.js import-inventory samples/inventory.json

# 4. 导入危化品规则
node src/index.js import-hazard-rules samples/hazardRules.json

# 5. 查看错误记录
node src/index.js list-errors

# 6. 复核申领记录
node src/index.js review

# 7. 查看数据状态
node src/index.js status

# 8. 导出所有数据
node src/index.js export -a all-data.json
```

运行以上命令后，您可以：
- 看到导入过程中自动识别的错误记录（包含详细的修改建议）
- 看到复核结果，哪些申请通过、哪些有警告、哪些不通过
- 所有数据都会保存到 `data/storage.json`，即使关闭程序再次运行也能看到历史数据
