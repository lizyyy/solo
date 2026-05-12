# 仓库盘点差异 CLI (inv-diff)

一个用于仓库盘点差异分析的命令行工具，围绕仓库盘点合并扫码、手工补录、冻结库位和复盘结果，解释差异来源。

## 功能特性

- ✅ **数据整合**: 合并账面库存、扫码结果、冻结库位、手工补录和复盘记录
- 🔍 **差异分析**: 自动检测差异并分析来源（出入库、扫码遗漏、账面错误）
- 📋 **规则引擎**: 处理重复扫码、未冻结库位、补录无原因、复盘差异扩大、批次混放
- 🔄 **幂等性**: 重复执行或重复导入保持幂等
- 📝 **操作追踪**: 人工修正留下前后差异和操作者记录
- 📊 **报告生成**: 生成完整盘点报告，支持业务闭环判断

## 安装

```bash
# 本地使用
node bin/cli.js --help

# 或创建全局链接
npm link
inv-diff --help
```

## 快速开始

### 1. 运行成功演示路径

```bash
npm run test:sample
```

这个演示会串起 `init → import → check → detail → report` 的完整流程，展示复盘修正案例。

### 2. 运行失败路径演示

```bash
npm run test:sample-failure
```

演示包含问题数据的场景（未冻结库位 + 补录无原因）。

## 命令参考

### init - 初始化盘点任务

```bash
inv-diff init --name "2026年5月月度盘点"
```

### import - 导入数据

```bash
# 导入账面库存
inv-diff import book path/to/book.json

# 导入扫码结果
inv-diff import scan path/to/scan.json

# 导入冻结库位
inv-diff import freeze path/to/freeze.json

# 导入手工补录
inv-diff import manual path/to/manual.json

# 导入复盘记录
inv-diff import recheck path/to/recheck.json
```

### check - 检查数据一致性

```bash
inv-diff check
```

### detail - 查看差异详情

```bash
# 按SKU筛选
inv-diff detail --sku SKU001

# 按库位筛选
inv-diff detail --location A-01-01
```

### report - 生成盘点报告

```bash
inv-diff report
```

### status - 查看当前状态

```bash
inv-diff status
```

### log - 查看操作历史

```bash
inv-diff log
```

### list - 列出所有盘点任务

```bash
inv-diff list
```

### switch - 切换盘点任务

```bash
inv-diff switch <audit-id>
```

## 数据格式

### 账面库存 (book.json)

```json
[
  { "sku": "SKU001", "location": "A-01-01", "quantity": 100 }
]
```

### 扫码结果 (scan.json)

```json
[
  {
    "sku": "SKU001",
    "location": "A-01-01",
    "quantity": 100,
    "scanTime": "2026-05-10T09:00:00Z",
    "operator": "worker01",
    "batchNo": "B20260501"
  }
]
```

### 冻结库位 (freeze.json)

```json
[
  {
    "location": "A-01-01",
    "freezeTime": "2026-05-10T08:00:00Z",
    "operator": "manager01",
    "reason": "月度盘点"
  }
]
```

### 手工补录 (manual.json)

```json
[
  {
    "sku": "SKU001",
    "location": "A-01-01",
    "quantity": -5,
    "reason": "发现破损报废",
    "operator": "manager02"
  }
]
```

### 复盘记录 (recheck.json)

```json
[
  {
    "sku": "SKU001",
    "location": "A-01-01",
    "quantity": 95,
    "recheckTime": "2026-05-10T16:00:00Z",
    "operator": "manager03",
    "reason": "复盘确认：账面100，扫码100，残次品5，实际95"
  }
]
```

## 内置样例

| 样例 | 场景 | 说明 |
|------|------|------|
| case1-normal | 正常一致 | 账面与扫码完全一致 |
| case2-understock | 少货 | 扫码少于账面，含手工补录 |
| case3-overstock | 多货 | 扫码多于账面 |
| case4-unfrozen | 库位未冻结 | 未冻结库位 + 补录无原因 |
| case5-recheck | 复盘修正 | 完整流程，复盘后闭环 |

## 手动造数演示

### 成功路径

```bash
# 1. 初始化
node bin/cli.js init --name "我的盘点" --work-dir ./my-data

# 2. 导入数据
node bin/cli.js import book samples/case5-recheck/book.json --work-dir ./my-data
node bin/cli.js import freeze samples/case5-recheck/freeze.json --work-dir ./my-data
node bin/cli.js import scan samples/case5-recheck/scan.json --work-dir ./my-data
node bin/cli.js import manual samples/case5-recheck/manual.json --work-dir ./my-data

# 3. 查看状态和检查
node bin/cli.js status --work-dir ./my-data
node bin/cli.js check --work-dir ./my-data

# 4. 查看差异详情
node bin/cli.js detail --sku SKU009 --work-dir ./my-data

# 5. 生成报告
node bin/cli.js report --work-dir ./my-data

# 6. 导入复盘记录
node bin/cli.js import recheck samples/case5-recheck/recheck.json --work-dir ./my-data

# 7. 最终报告
node bin/cli.js report --work-dir ./my-data

# 8. 查看操作历史
node bin/cli.js log --work-dir ./my-data
```

### 失败路径

```bash
# 1. 初始化
node bin/cli.js init --name "问题数据演示" --work-dir ./my-failure

# 2. 导入问题数据
node bin/cli.js import book samples/case4-unfrozen/book.json --work-dir ./my-failure
node bin/cli.js import freeze samples/case4-unfrozen/freeze.json --work-dir ./my-failure
node bin/cli.js import scan samples/case4-unfrozen/scan.json --work-dir ./my-failure

# 3. 导入有问题的手工补录（无原因）
node bin/cli.js import manual samples/case4-unfrozen/manual.json --work-dir ./my-failure

# 4. 检查（会发现严重问题）
node bin/cli.js check --work-dir ./my-failure

# 5. 报告（业务未闭环）
node bin/cli.js report --work-dir ./my-failure
```

## 业务规则

### 1. 重复扫码检测
- 同一 SKU + 库位组合被多次扫码
- 标记为 warning，需要人工确认

### 2. 未冻结库位检测
- 扫码时库位未被冻结
- 标记为 error，数据可能不准确

### 3. 补录无原因检测
- 手工补录缺少 reason 字段
- 标记为 error，必须补充原因

### 4. 复盘差异扩大检测
- 复盘后差异绝对值 > 初始差异
- 标记为 warning，需要关注

### 5. 批次混放检测
- 同一库位同一商品存在多个批次
- 标记为 warning

## 差异来源分析

| 来源类型 | 置信度 | 说明 |
|---------|--------|------|
| 扫码遗漏 | 80% | 账面有库存但扫码为0 |
| 账面错误 | 70% | 扫码大于账面 |
| 出入库差异 | 75% | 扫码小于账面 |
| 手工调整 | 90% | 存在手工补录 |
| 复盘调整 | 95% | 复盘后数量变化 |

## 业务闭环判断标准

报告末尾会给出业务闭环判断：

✅ **已闭环**:
- 无严重问题
- 复盘后无差异，或差异已确认处理

⚠️ **未闭环**:
- 存在严重问题（未冻结库位、补录无原因）
- 存在未复盘的差异
- 复盘后仍有未处理差异

## 项目结构

```
.
├── bin/
│   └── cli.js              # CLI 入口
├── src/
│   ├── commands.js         # 命令实现
│   ├── core/
│   │   ├── diff-engine.js  # 差异分析引擎
│   │   └── validator.js    # 数据验证器
│   └── utils/
│       ├── logger.js       # 日志工具
│       └── storage.js      # 存储管理
├── samples/                # 内置样例数据
│   ├── case1-normal/
│   ├── case2-understock/
│   ├── case3-overstock/
│   ├── case4-unfrozen/
│   └── case5-recheck/
├── scripts/                # 演示脚本
│   ├── run-demo.js
│   └── run-demo-failure.js
└── package.json
```

## 数据存储

盘点数据存储在 `--work-dir` 指定的目录下（默认 `./inventory-data`）：

```
inventory-data/
├── .current               # 当前活动的盘点任务ID
└── audits/
    └── <audit-id>/
        ├── audit.json     # 盘点任务元数据
        ├── log.json       # 操作历史记录
        └── data/
            ├── book.json
            ├── scan.json
            ├── freeze.json
            ├── manual.json
            └── recheck.json
```
