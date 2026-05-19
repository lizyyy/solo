# 印刷车间品控数据管理系统

统一管理印刷批次的Lab测色数据、纸张批次信息和返工记录，支持多格式数据导入、坏记录保留、数据复核和导出功能。

## 功能特性

- ✅ **多格式导入**: 支持测色CSV、订单JSON、返工备注文本
- 📝 **坏记录保留**: 保留原始位置、失败原因、修改建议
- 🔍 **数据校验**: 字段格式、范围、必填项校验
- 📊 **数据复核**: 全量查询、按批次查询关联数据
- 📤 **数据导出**: CSV格式导出所有记录
- 📋 **审计日志**: 角色、操作人、时间完整记录
- 🔄 **失败重试**: 批量导入失败不影响已成功记录

## 环境要求

- Node.js 16+
- npm 8+

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 导入测色数据 (CSV)

**正常数据导入**:
```bash
npm run import:csv -- data/input/color-normal.csv
```

**包含异常数据导入 (演示坏记录功能)**:
```bash
npm run import:csv -- data/input/color-with-errors.csv
```

**指定操作人和角色**:
```bash
npm run import:csv -- data/input/color-normal.csv -o 张三 -r 品控员
```

### 3. 导入订单数据 (JSON)

```bash
npm run import:json -- data/input/order-normal.json
```

### 4. 导入返工记录 (TXT)

```bash
npm run import:text -- data/input/rework-normal.txt
```

### 5. 复核数据

**查看所有数据统计**:
```bash
npm run review
```

**按批次号查询 (关联品控+返工记录)**:
```bash
npm run review -- -b BATCH-2024-001
```

### 6. 导出数据

**基础导出**:
```bash
npm run export
```

**包含坏记录和审计日志**:
```bash
npm run export -- -b -a
```

**指定输出目录**:
```bash
npm run export -- -d ./my-exports
```

### 7. 标记坏记录为已解决

```bash
npm run resolve -- <bad-record-id>
```

## 数据格式说明

### CSV测色数据格式

| 字段 | 说明 | 示例 |
|------|------|------|
| batchId | 批次号 (必填) | BATCH-2024-001 |
| orderId | 订单号 (必填) | ORDER-2024-A001 |
| L | L值, 0-100 (必填) | 85.5 |
| a | a值, -128~127 (必填) | 12.3 |
| b | b值, -128~127 (必填) | -5.2 |
| paperBatch | 纸张批次 (必填) | PAPER-A01 |
| operator | 操作人 (必填) | 张三 |
| role | 角色 (必填) | 品控员 |
| measuredAt | 测量时间 (必填) | 2024-01-15 09:30:00 |

### JSON订单数据格式

```json
[
  {
    "batchId": "BATCH-2024-010",
    "orderId": "ORDER-2024-D001",
    "labValues": {
      "L": 87.2,
      "a": 11.5,
      "b": -6.8
    },
    "paperBatch": "PAPER-D04",
    "operator": "郑十一",
    "role": "品控员",
    "measuredAt": "2024-01-17 08:30:00"
  }
]
```

### TXT返工记录格式

记录间用 `---` 分隔:

```
批次号: BATCH-2024-001
返工原因: 颜色偏差超过标准范围
解决方案: 调整油墨配方
操作人: 李工
角色: 技术员
返工时间: 2024-01-15 16:00:00

---

批次号: BATCH-2024-002
...
```

## 样例数据说明

`data/input/` 目录提供以下样例数据:

| 文件 | 说明 |
|------|------|
| color-normal.csv | 正常测色数据 (3条) |
| color-with-errors.csv | 包含异常的测色数据 (1条正常, 5条异常) |
| order-normal.json | 正常订单数据 (2条) |
| rework-normal.txt | 正常返工记录 (2条) |

## 完整演示流程

```bash
# 1. 安装依赖
npm install

# 2. 导入正常测色数据
npm run import:csv -- data/input/color-normal.csv

# 3. 导入包含异常的数据 (查看坏记录功能)
npm run import:csv -- data/input/color-with-errors.csv

# 4. 导入订单数据
npm run import:json -- data/input/order-normal.json

# 5. 导入返工记录
npm run import:text -- data/input/rework-normal.txt

# 6. 查看所有数据统计
npm run review

# 7. 查询具体批次详情 (品控+返工记录)
npm run review -- -b BATCH-2024-001

# 8. 导出所有数据
npm run export -- -b -a
```

## 项目结构

```
.
├── src/
│   ├── models/
│   │   ├── types.ts          # 类型定义
│   │   └── database.ts       # 数据存储层
│   ├── importers/
│   │   ├── csvImporter.ts    # CSV导入器
│   │   ├── jsonImporter.ts   # JSON导入器
│   │   └── textImporter.ts   # 文本导入器
│   ├── services/
│   │   ├── reviewService.ts  # 复核服务
│   │   └── exportService.ts  # 导出服务
│   ├── utils/
│   │   └── validation.ts     # 校验工具
│   ├── cli.ts                # 命令行入口
│   └── index.ts              # 模块入口
├── data/
│   ├── input/                # 输入样例数据
│   ├── output/               # 导出数据目录
│   └── db.json               # 数据库文件
├── package.json
├── tsconfig.json
└── README.md
```

## 命令行参数说明

### 通用参数

所有命令都支持以下参数:
- `-o, --operator <name>`: 操作人姓名 (默认: 系统管理员)
- `-r, --role <role>`: 角色 (默认: 管理员)

### import:csv
- `<file>`: CSV文件路径 (必需)

### import:json
- `<file>`: JSON文件路径 (必需)

### import:text
- `<file>`: TXT文件路径 (必需)

### review
- `-b, --batch <batchId>`: 按批次号查询

### resolve
- `<id>`: 坏记录ID (必需)

### export
- `-d, --dir <directory>`: 输出目录 (默认: data/output)
- `-b, --include-bad`: 包含坏记录
- `-a, --include-audit`: 包含审计日志

## 坏记录处理

当导入数据遇到校验失败时:
1. 失败记录不会被丢弃，而是完整保留到坏记录表
2. 每条坏记录包含: 原始位置、原始数据、失败原因、修改建议
3. 批量导入时，已成功导入的记录不会被回滚
4. 可以通过 `npm run review` 查看所有坏记录
5. 问题修复后，可通过 `npm run resolve <id>` 标记为已解决

## 审计日志

所有操作都会记录审计日志，包含:
- 操作类型
- 实体类型
- 实体ID
- 操作人
- 角色
- 操作时间
- 详细信息

导出数据时使用 `-a` 参数可导出完整审计日志。

## 常见问题

**Q: 导入数据失败了，已经导入的记录会丢失吗?**
A: 不会。批量导入采用原子化处理，失败前已成功导入的记录会完整保留。

**Q: 如何查看导入失败的具体原因?**
A: 运行 `npm run review` 可以查看所有坏记录，包含原始位置、失败原因和修改建议。

**Q: 支持哪些数据校验规则?**
A: 目前支持: 必填项校验、数值范围校验、日期格式校验、字符串长度校验。

**Q: 数据库文件在哪里?**
A: 所有数据存储在 `data/db.json`，可以直接备份或迁移此文件。

**Q: 如何导出审计日志?**
A: 使用 `npm run export -- -a` 可以导出完整审计日志。
