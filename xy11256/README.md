# 隐患闭环管理系统

一个真正能落地的服务端小系统，帮助安全员解决巡检照片、整改责任人和复查结果分散在多个表，月底很难说明隐患是否闭环的问题。

## ✨ 核心特性

- 📊 **数据统一管理**: 隐患、照片、整改、复查记录一体化
- ✅ **完整闭环流程**: 新建 → 分配责任人 → 整改 → 复查 → 闭环
- 🚫 **错误数据保留**: 坏数据不吞掉，保留原始位置、失败原因和修改建议
- 🔄 **批量操作安全**: 部分成功部分失败，重试不破坏已成功记录
- 📈 **一键导出报告**: Excel格式，月底统计闭环率一目了然
- 🔍 **数据完整性复核**: 自动检查数据缺失、超期等问题

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行完整样例（推荐）

一键运行完整流程，体验所有功能：

```bash
npm run test:sample
```

这个命令会：
- 导入正常隐患数据
- 导入照片索引
- 导入异常数据（演示错误处理）
- 执行数据复核
- 模拟状态变更流程
- 导出闭环报告

### 3. 初始化系统

```bash
npm start
```

## 📖 完整操作指南

### 数据导入

#### 导入隐患数据 (CSV)

```bash
npm run import:hazards -- --file data/samples/hazards.csv
```

**CSV格式要求：**
```csv
隐患编号,隐患标题,隐患描述,隐患位置,隐患级别,发现日期,发现人,所属部门,整改责任人,整改期限
HZ-2024-001,消防通道堵塞,杂物堆积占用消防通道,一楼东侧走廊,high,2024-01-15,王安全,生产部,张工,2024-01-25
```

#### 导入照片索引 (JSON)

```bash
npm run import:photos -- --file data/samples/photos.json
```

**JSON格式要求：**
```json
[
  {
    "照片ID": "PHO-001",
    "隐患编号": "HZ-2024-001",
    "照片类型": "inspection",
    "文件路径": "/photos/HZ-2024-001_before.jpg",
    "上传日期": "2024-01-15",
    "上传人": "王安全",
    "描述": "消防通道堵塞现场照片"
  }
]
```

照片类型可选：`inspection`(巡检), `rectification`(整改), `review`(复查)

#### 导入复查记录 (CSV)

```bash
npm run import:reviews -- --file data/samples/reviews.csv
```

### 查看导入批次

```bash
node src/cli.js list-batches
```

### 处理导入错误

查看失败记录：
```bash
node src/cli.js import-errors --batch <批次ID>
```

重试导入：
```bash
node src/cli.js retry --batch <批次ID>
```

### 数据复核

复核所有数据完整性：
```bash
npm run review
```

自动检查：
- 责任人是否分配
- 整改期限是否设置
- 是否超期
- 照片是否齐全
- 复查记录是否完整

### 状态管理

#### 批量分配责任人

```bash
node src/cli.js assign --codes HZ-2024-001,HZ-2024-002 --person 张工 --deadline 2024-12-31
```

#### 批量复查通过

```bash
node src/cli.js review --codes HZ-2024-001,HZ-2024-002 --result pass --reviewer 李四 --comments "整改合格"
```

### 查看统计

查看整体统计：
```bash
npm run status
```

查看单条隐患详情：
```bash
node src/cli.js status --code HZ-2024-001
```

### 数据导出

导出隐患清单：
```bash
npm run export -- --type hazards
```

导出闭环统计：
```bash
npm run export -- --type closure
```

导出照片清单：
```bash
npm run export -- --type photos
```

导出导入错误：
```bash
npm run export -- --type errors --batch <批次ID>
```

生成月度报告：
```bash
npm run export -- --type monthly --year 2024 --month 1
```

## 📁 目录结构

```
.
├── data/
│   ├── samples/          # 样例数据
│   │   ├── hazards.csv          # 正常隐患数据
│   │   ├── hazards_with_errors.csv # 含错误的隐患数据
│   │   ├── photos.json          # 照片索引
│   │   └── reviews.csv          # 复查记录
│   ├── exports/          # 导出的报告
│   └── hazards.db        # SQLite数据库（自动生成）
├── src/
│   ├── models/           # 数据模型
│   │   ├── hazard.js     # 隐患模型
│   │   ├── photo.js      # 照片模型
│   │   ├── importBatch.js # 导入批次模型
│   │   └── init.js       # 数据库初始化
│   ├── services/         # 业务服务
│   │   ├── importService.js   # 导入服务
│   │   ├── statusService.js   # 状态管理服务
│   │   ├── reviewService.js   # 复核服务
│   │   └── exportService.js   # 导出服务
│   ├── utils/            # 工具类
│   │   ├── database.js   # 数据库连接
│   │   ├── validator.js  # 数据校验
│   │   └── constants.js  # 常量定义
│   ├── cli.js            # CLI命令入口
│   └── index.js          # 主入口
├── package.json
└── README.md
```

## 🔄 隐患状态流转

```
新建 (new)
  ↓
已分配 (assigned) → 分配整改责任人和期限
  ↓
整改中 (rectifying) → 开始整改
  ↓
复查中 (reviewing) → 整改完成申请复查
  ↓
已闭环 (closed) ✅  → 复查通过
  ↗
已驳回 (rejected) ❌ → 复查不通过，重回整改
```

## 💡 常见问题

### Q: 批量导入时部分成功部分失败怎么办？

A: 系统会自动记录每条记录的状态，成功的不会重复处理。查看失败原因后修改数据，使用 `retry` 命令重试即可，只会重新处理之前失败的记录。

### Q: 如何知道月底还有多少隐患未闭环？

A: 运行 `npm run export -- --type closure` 会生成完整的闭环统计Excel，包含：
- 总数、已闭环、待处理数量
- 闭环率百分比
- 每条隐患的责任人、期限、是否超期

### Q: 照片和隐患怎么关联？

A: 通过「隐患编号」字段关联。照片数据中的「隐患编号」必须对应已存在的隐患编号，否则会被跳过。

### Q: 支持哪些隐患级别？

A: `critical`(重大), `high`(高), `medium`(中), `low`(低)

## 🎯 数据字段说明

### 隐患字段

| 字段 | 说明 | 必填 |
|------|------|------|
| 隐患编号 | 唯一标识 | ✅ |
| 隐患标题 | 简要描述 | ✅ |
| 隐患描述 | 详细说明 | - |
| 隐患位置 | 具体位置 | ✅ |
| 隐患级别 | critical/high/medium/low | ✅ |
| 发现日期 | YYYY-MM-DD | ✅ |
| 发现人 | 检查人员姓名 | ✅ |
| 所属部门 | 责任部门 | - |
| 整改责任人 | 负责整改的人 | - |
| 整改期限 | 整改截止日期 | - |

## 📝 开发说明

本项目使用纯Node.js + SQLite开发，无外部依赖，开箱即用。数据全部存在本地，适合企业内部部署使用。

---

**安全员福音：月底再也不用到处找表格统计闭环率了！** 🎉
