# 缓存命中分析命令行工具

基于复核班车预约名单的缓存命中分析工具，支持并发写入覆盖检测、统计分析、预览执行和回滚功能。

## 快速开始

### 安装依赖

```bash
npm install
```

### 编译TypeScript

```bash
npm run build
```

### 运行自检脚本

```bash
npm test
```

### 执行完整分析流程

数据默认持久化到 `./data/bus-reservations.json`，确保多命令间数据可复用：

```bash
# 1. 生成测试数据（自动包含并发覆盖场景，自动落盘）
npm run dev -- generate

# 2. 执行缓存分析（自动读取上一步生成的数据，可复现并发覆盖异常）
npm run dev -- analyze --show-raw

# 3. 生成最终摘要（同样自动读取已生成的数据）
npm run dev -- summary
```

> **重要提示**：`generate` 命令会自动将数据保存到默认文件，后续命令会自动读取该文件，确保完整流程可正确复现并发覆盖异常场景。

> 也可使用 `-o` / `-i` 参数自定义文件路径。

## 命令说明

### 1. generate - 生成测试数据

生成班车预约测试数据，默认包含并发覆盖场景。

```bash
npm run dev -- generate [选项]

选项:
  -c, --count <number>    生成数量 (默认: 20)
  -o, --output <file>     输出到JSON文件
  --no-with-conflict      不包含并发冲突场景
```

**样例:**
```bash
npm run dev -- generate -o data.json
```

### 2. analyze - 执行缓存命中分析

分析缓存命中率、并发冲突、异常记录等。

```bash
npm run dev -- analyze [选项]

选项:
  -i, --input <file>      从JSON文件加载数据
  --show-raw              显示原始数据样本
```

**样例:**
```bash
npm run dev -- analyze -i data.json --show-raw
```

### 3. preview - 预览批量操作影响范围

在执行批量操作前预览影响范围，避免误伤真实数据。

```bash
npm run dev -- preview [选项]

选项:
  --cleanup               预览清理异常记录
  --fix <id>              预览修复指定异常记录
```

**样例:**
```bash
npm run dev -- preview --cleanup
npm run dev -- preview --fix RES-CONFLICT-001
```

### 4. execute - 执行批量操作

执行异常修复、生成回滚计划等批量操作。

```bash
npm run dev -- execute [选项]

选项:
  --fix-all               修复所有异常记录
  --fix <id>              修复指定异常记录
  --rollback-plan         生成回滚计划并保存到JSON文件
```

**样例:**
```bash
npm run dev -- execute --rollback-plan
npm run dev -- execute --fix RES-CONFLICT-001
```

### 5. summary - 生成最终分析摘要

生成包含培训环境清单异常、修正建议和结论的完整摘要，默认从数据文件加载。

```bash
npm run dev -- summary [选项]

选项:
  -i, --input <file>      从JSON文件加载数据 (默认: ./data/bus-reservations.json)
```

**样例:**
```bash
# 使用默认路径（自动读取 generate 生成的数据）
npm run dev -- summary

# 自定义路径
npm run dev -- summary -i my-data.json
```

## 样例数据来源

本工具使用**复核班车预约名单**作为测试数据，包含以下字段：

| 字段 | 说明 | 示例 |
|------|------|------|
| id | 预约记录ID | RES-CONFLICT-001 |
| employeeId | 员工编号 | E001 |
| employeeName | 员工姓名 | 张三 |
| department | 所属部门 | 技术部 |
| busRoute | 班车线路 | A线-科技园直达 |
| busStop | 乘车站点 | 南门站 |
| date | 乘车日期 | 2024-05-20 |
| timeSlot | 乘车时段 | 08:00 |
| status | 预约状态 | pending/confirmed/cancelled |
| createdAt | 创建时间 | ISO时间戳 |
| updatedAt | 更新时间 | ISO时间戳 |
| source | 数据来源 | web-portal, mobile-app, etc. |
| version | 版本号 | 用于乐观锁检测 |

## 主流程分析

### 正常流程

1. **数据生成** → 生成班车预约记录（15条正常 + 1条冲突场景）
2. **缓存加载** → 将所有记录加载到缓存分析器
3. **命中统计** → 模拟缓存读取操作，统计命中/未命中
4. **异常检测** → 扫描并发写入覆盖、字段缺失等异常
5. **结果展示** → 表格展示统计数据、异常详情、字段变更对比

### 失败路径（并发覆盖场景）

**问题描述:**
两个写入操作同时修改同一条预约记录，后写入的操作覆盖了先写入的操作，导致数据丢失。

**场景构造:**
```
时间线:
  T0: 初始记录创建 (version=1, source=initial-booking)
      busRoute = A线-科技园直达
      busStop = 南门站
      
  T1: WriterA写入 (version=2, source=mobile-app-writer-A)
      busStop = 北门站  ← WriterA的修改
      
  T2: WriterB写入 (version=2, source=web-portal-writer-B)
      busRoute = B线-市中心环线
      timeSlot = 08:30  ← WriterB的修改
      
  结果: WriterA的"busStop=北门站"被覆盖丢失！
```

**检测方法:**
- 版本号未递增（两个写入都使用version=2）
- 更新时间戳不同但版本号相同
- 字段变更追踪显示中间状态丢失

**修正建议:**
1. 增加乐观锁机制，写入前校验版本号
2. 使用CAS（Compare-And-Swap）操作
3. 写入冲突时提示用户刷新重试

## 自检脚本

运行 `npm test` 执行自检，覆盖以下边界情况：

| 测试用例 | 说明 |
|----------|------|
| 空缓存统计正确 | 验证初始状态下统计清零 |
| 缓存写入和读取正确 | 验证基本CRUD操作 |
| 缓存命中统计正确 | 验证命中/未命中计数准确 |
| 命中率计算正确 | 验证百分比计算精度 |
| 并发覆盖场景能被检测到 | 核心功能验证 |
| 并发覆盖能正确追溯变更前后值 | 字段级别对比验证 |
| 原始输入字段完整可追溯 | 所有字段可回溯到原始输入 |
| 预览功能正确显示影响范围 | 批量操作安全验证 |
| 回滚计划生成正确 | 数据安全保障 |
| 异常修复功能正确 | 自动修复机制验证 |
| 清理缓存功能正确 | 状态重置验证 |
| 边界情况: 空数据检测 | 空输入处理 |
| 边界情况: 缺失字段检测 | 数据完整性校验 |

## 项目结构

```
.
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript配置
├── src/
│   ├── types.ts          # 类型定义
│   ├── data-generator.ts # 数据生成器
│   ├── cache-analyzer.ts # 缓存分析核心逻辑
│   ├── cli.ts            # 命令行接口
│   └── self-check.ts     # 自检脚本
└── README.md             # 本文档
```

## 核心特性

1. **真实业务场景** - 基于复核班车预约名单造数
2. **并发冲突检测** - 准确识别并发写入覆盖问题
3. **字段级追溯** - 所有字段可回溯到原始输入值
4. **安全批量操作** - 支持预览影响范围再执行
5. **回滚机制** - 清理/修改前自动生成回滚计划
6. **边界测试覆盖** - 自检脚本覆盖13种典型场景
7. **可视化报告** - 表格展示统计数据和变更对比

## 最终摘要示例

运行 `npm run dev -- summary` 将生成类似以下的报告：

```
=== 缓存命中分析摘要 ===
总操作数: 30
命中数: 10
未命中数: 1
命中率: 90.91%
并发冲突数: 2
被覆盖KEY: RES-CONFLICT-001

=== 培训环境清单异常 ===
异常ID: RES-CONFLICT-001
描述: 检测到并发写入覆盖: 员工 张三 的预约记录被覆盖
变更前: {"busRoute":"A线-科技园直达","busStop":"北门站","source":"mobile-app-writer-A","version":2}
变更后: {"busRoute":"B线-市中心环线","busStop":"南门站","source":"web-portal-writer-B","version":2}
影响字段: busStop, busRoute, timeSlot, version
修正建议: 增加版本号乐观锁，写入前校验版本
结论: 该记录存在并发写入覆盖问题，WriterA的修改丢失

=== 原始输入追溯 ===
所有记录字段均可追溯至原始输入，包含:
- employeeId, employeeName, department (员工信息)
- busRoute, busStop, date, timeSlot (预约信息)
- status, createdAt, updatedAt, source, version (系统字段)

样例数据来源: 复核班车预约名单
```
