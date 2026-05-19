# 家电售后仓库管理系统

一个完整的家电售后仓库管理系统，解决工程师领件、旧件返还和厂商索赔的对账问题。

## 功能特性

- ✅ **数据导入**: 支持领件单CSV、返修单JSON、索赔规则JSON导入
- ✅ **错误处理**: 坏记录不吞掉，保留原始位置、失败原因和修改建议
- ✅ **本地持久化**: SQLite数据库存储，重启服务数据不丢失
- ✅ **索赔匹配**: 自动根据规则匹配返修单，生成索赔记录
- ✅ **审核流程**: 支持单条和批量审核（通过/驳回）
- ✅ **数据导出**: 支持多种格式导出（CSV/JSON）
- ✅ **历史记录**: 完整的导入历史和操作记录

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 导入示例数据

```bash
# 导入领件单（包含正常和异常数据）
npm run import:parts samples/part_orders.csv

# 导入返修单
npm run import:repair samples/repair_orders.json

# 导入索赔规则
npm run import:rules samples/claim_rules.json
```

### 3. 处理索赔

```bash
npm run dev process
```

### 4. 查看待审核索赔

```bash
npm run review
```

### 5. 审核索赔

```bash
# 单条通过
npm run review approve 1 资料齐全

# 单条驳回
npm run review reject 2 旧件未返还

# 批量通过所有
npm run review all
```

### 6. 导出数据

```bash
# 导出所有索赔
npm run export claims

# 只导出已通过的索赔
npm run export claims approved

# 导出领件单
npm run export parts

# 导出导入错误
npm run export errors

# 导出索赔汇总
npm run export summary
```

### 7. 查询功能

```bash
# 查看系统状态
npm run dev status

# 查看导入历史
npm run dev history

# 查看导入错误
npm run dev errors

# 查看无法匹配索赔的返修单
npm run dev unmatched
```

## 示例数据说明

samples目录下的示例数据包含：

### part_orders.csv - 领件单（含异常数据）
- 第1-4行：正常数据
- 第5行：空行（缺少必填字段）
- 第6行：数量错误（abc不是数字）
- 第7行：正常数据
- 第8行：重复单号

### repair_orders.json - 返修单
- R20240501001: 完整数据，可正常索赔
- R20240501002: 缺少旧件返还（需要旧件的规则会失败）
- R20240501003: 旧件损坏（状态为damaged）
- R20240501004: 完整数据，可正常索赔

### claim_rules.json - 索赔规则
- R001: 空调压缩机索赔（需旧件）
- R002: 空调主板索赔（需旧件）
- R003: 冰箱温控器索赔（需旧件）
- R004: 洗衣机电机索赔（无需旧件）

## 数据持久化

系统使用SQLite数据库（warehouse.db）进行本地持久化。重启服务或第二次运行后仍能查询到之前处理的所有数据。

## 项目结构

```
.
├── src/
│   ├── types.ts          # 数据类型定义
│   ├── database.ts       # 数据库操作层
│   ├── importService.ts  # 导入服务（含错误处理）
│   ├── businessService.ts # 业务逻辑层（索赔匹配、审核）
│   ├── exportService.ts  # 导出服务
│   └── cli.ts           # CLI入口
├── samples/             # 示例数据（含正常和异常）
├── exports/             # 导出文件目录（自动创建）
├── warehouse.db         # SQLite数据库文件（自动创建）
├── package.json
├── tsconfig.json
└── README.md
```

## 完整流程示例

```bash
# 1. 首次运行 - 导入数据
npm run import:rules samples/claim_rules.json
npm run import:parts samples/part_orders.csv
npm run import:repair samples/repair_orders.json

# 2. 查看导入错误
npm run dev errors

# 3. 处理索赔
npm run dev process

# 4. 查看哪些返修单无法匹配索赔
npm run dev unmatched

# 5. 查看待审核索赔
npm run review

# 6. 审核索赔
npm run review all

# 7. 查看系统状态
npm run dev status

# 8. 导出已通过的索赔
npm run export claims approved

# 9. 重启服务后再次查询，验证数据持久化
npm run dev status
```

## 错误处理机制

系统会完整保留导入错误，包括：
- 原始数据内容
- 错误类型（缺少字段、格式错误、重复数据等）
- 具体错误信息
- 修改建议
- 导入批次号

可以通过 `npm run dev errors` 查看所有导入错误，或导出为CSV进行处理。
