# 贝塞尔曲线路径平滑 - 数据一致性与可追溯处理系统

## 概述

"贝塞尔曲线路径平滑"是一个确保数据处理一致性、可追溯的工作流系统。专门解决**百分数和小数混着出现**这类数据格式不一致问题，确保页面展示、导出明细、接口返回读取同一份结果，活动负责人追问时能回到原始证据。

---

## 🔴 边界规则（核心！！！）

> 这些规则同时写在代码 `src/core/boundary-rules.ts` 和本 README 中，确保口头约定有书面依据。

| 规则ID | 规则名称 | 判断条件 | 处理动作 | 严重程度 |
|--------|----------|----------|----------|----------|
| **RULE_001** | **百分数小数混合检测** | 同一条记录中同时出现百分数（%）和小数（0-1之间）格式 | ⚠️ **标记为异常，留待活动负责人复核**，**不自动归正常** | warning |
| RULE_002 | 纯小数自动归一化 | 所有值都是 0-1 之间的小数格式 | ✅ 自动归一化为小数标准格式 | info |
| RULE_003 | 纯百分数自动归一化 | 所有值都是百分数格式 | ✅ 自动归一化为小数标准格式 | info |
| RULE_004 | 无法解析值标记 | 存在无法解析为数字的值 | ⚠️ 标记为待复核 | error |
| RULE_005 | 回滚窗口期检测 | 记录导入时间在24小时以内 | ↩️ 支持回滚 | info |
| RULE_006 | 数值范围异常检测 | 归一化后的值超出 0-1 范围 | ⚠️ 标记为待复核 | error |

### 混合格式处理流程（重点！）

```
检测到百分数和小数混合
        ↓
    标记为 pending_review
        ↓
    不自动归一化  ✋  别着急归正常！
        ↓
  分配给「活动负责人」复核
        ↓
  活动负责人决定：
  ├─ approve  → 按指定格式归一化 → 进入更新步骤
  ├─ reject   → 标记为拒绝 → 需重新导入
  └─ rollback → 回滚 → 恢复导入前状态
```

---

## 🎯 三步工作流

### 第一步：旧公式截图第一次导入
- 导入CSV数据，保留**原始行号**
- 关联旧公式截图引用
- 自动检测数据格式
- 触发边界规则，标记异常

### 第二步：运营规划阿岚补看老师批注
- 对异常记录添加批注
- 关联老师批注截图
- 说明数据来源和背景
- 不做最终决策，只补充信息

### 第三步：计算明细更新
- **仅在复核通过后执行**
- 更新计算明细
- 记录所有变更历史
- 生成最终统一格式结果

---

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 编译
```bash
npm run build
```

### 运行完整测试
```bash
npm test
```

### 命令行使用

```bash
# 查看帮助
node dist/cli/index.js help

# 运行完整工作流（导入+批注）
node dist/cli/index.js run examples/sample-data.csv --operator "运营规划阿岚"

# 单独导入
node dist/cli/index.js import --file examples/sample-data.csv --columns "转化率,完成率" --operator "运营规划阿岚" --screenshot "screenshots/formula_v1.png"

# 添加批注
node dist/cli/index.js annotate --id <记录ID> --author "运营规划阿岚" --content "老师批注：确认数值无误"

# 活动负责人复核（关键！混合格式必须走这一步）
node dist/cli/index.js review --id <记录ID> --reviewer "活动负责人" --decision approve --comment "混合格式确认，统一转为小数"

# 计算明细更新（必须复核通过后才能执行）
node dist/cli/index.js update --id <记录ID> --operator "运营规划阿岚"

# 查看记录详情
node dist/cli/index.js show --id <记录ID>

# 追溯来源和下一步（新同事必看！）
node dist/cli/index.js trace --id <记录ID>

# 导出数据（页面、导出、接口共用同一份结果）
node dist/cli/index.js export --format detail --output output/detail.txt --operator "运营规划阿岚" --raw --history --annotations

# 导出格式可选: json | csv | detail | summary

# 查看汇总
node dist/cli/index.js list

# 审计报告
node dist/cli/index.js audit

# 查看可重跑会话
node dist/cli/index.js replay

# 复盘重跑（其他同事复现流程）
node dist/cli/index.js replay --session <会话ID> --operator "新同事"
```

---

## 🔍 追溯功能：新同事也能快速上手

当你拿到一条计算明细，想知道：
1. **来源在哪？** → 看「原始行号」→ 对应源文件中的行
2. **为什么是这个格式？** → 看「原始值」→ 看「变更历史」→ 看「复核决定」
3. **下一步做什么？** → 看「状态」→ 看「追溯报告」

### 一条命令搞定：
```bash
node dist/cli/index.js trace --id <记录ID>
```

输出示例：
```
=== 追溯报告 - 记录 rec_xxx ===

--- 时间线 ---
1. [2024/1/2 10:00] 运营规划阿岚 - RECORD_IMPORTED
   详情: {原始行号: 3, 有混合格式: true, ...}

2. [2024/1/2 10:05] 运营规划阿岚 - ANNOTATION_ADDED
   详情: {内容: "老师批注：第3行数据来自旧公式截图..."}

--- 来源与下一步 ---
📌 来源查找:
   1. 查看"原始行号"字段，对应源文件中的行
   2. 查看"原始值"部分，了解导入时的原始格式
   3. 查看变更历史，了解每一次改动的原因

🎯 下一步动作:
   ⚠️  该记录存在百分数/小数混合格式
   → 需要活动负责人进行复核
   → 执行: bezier review --id <记录ID> --reviewer "活动负责人" --decision approve
```

---

## 📜 可复盘记录 & 可重跑命令

### 保存工作流会话
每次运行 `run` 命令会自动保存可重跑会话。也可以手动保存：
```bash
node dist/cli/index.js save-session --name "双11活动数据处理" --operator "运营规划阿岚"
```

### 查看所有会话
```bash
node dist/cli/index.js replay
```

### 重跑会话（复现完整流程）
```bash
node dist/cli/index.js replay --session session_xxx --operator "新同事李四"
```

重跑会：
1. 清空当前数据
2. 按顺序执行所有命令（导入→批注→复核→更新）
3. 生成复盘报告
4. 验证每一步结果一致

---

## 📂 目录结构

```
bezier-path-smoothing/
├── src/
│   ├── types/index.ts          # 类型定义
│   ├── utils/id.ts             # ID生成
│   ├── store/
│   │   ├── data-store.ts       # 数据存储
│   │   └── audit-log.ts        # 审计日志
│   ├── core/
│   │   ├── format-detector.ts  # 格式检测（百分数/小数/混合）
│   │   └── boundary-rules.ts   # 边界规则（！！！与README同步）
│   ├── import/
│   │   └── csv-importer.ts     # CSV导入（保留原始行号）
│   ├── workflow/
│   │   └── engine.ts           # 三步工作流引擎
│   ├── export/
│   │   └── unified-exporter.ts # 统一出口（页面/导出/接口）
│   ├── replay/
│   │   └── replay-engine.ts    # 复盘重跑引擎
│   ├── cli/
│   │   └── index.ts            # 命令行入口
│   ├── tests/
│   │   └── run-full-workflow.ts# 完整工作流测试
│   └── index.ts                # 导出所有模块
├── examples/
│   └── sample-data.csv         # 样例数据（含混合格式）
├── data/                       # 运行时数据（自动生成）
│   ├── records.json            # 处理记录
│   ├── audit-log.json          # 审计日志
│   └── replay-log.json         # 重跑会话
├── package.json
├── tsconfig.json
└── README.md                   # 本文档（边界规则在此）
```

---

## 🔐 数据一致性保证

### 单一数据源原则
- **页面展示** ← 调用 `buildRecordView()`
- **导出明细** ← 调用 `buildRecordView()`
- **接口返回** ← 调用 `buildRecordView()`

> 三者读取同一套数据，不会出现"一个地方显示异常、另一个地方消失"。

### 变更全记录
每条记录保存：
- ✅ `originalRowNumber` - 原始行号（可追溯到源文件）
- ✅ `rawValues` - 导入时的原始值（包含格式信息）
- ✅ `normalizedValues` - 归一化后的值
- ✅ `changeHistory` - 每一次改动（操作人、时间、原因、新旧值）
- ✅ `annotations` - 批注（含截图引用）
- ✅ `reviewDecision` - 复核决定（谁批的、什么时候批的）
- ✅ 完整的审计日志（所有操作留痕）

### 回滚机制
- 导入后24小时内可回滚
- 回滚后标记为 `rolled_back`
- 回滚操作本身也留痕

---

## ⚠️ 百分数和小数混着出现 - 典型场景

### 样例数据（`examples/sample-data.csv`）
| 行号 | 日期 | 活动名称 | 转化率 | 完成率 | 备注 |
|------|------|----------|--------|--------|------|
| 2 | 2024-01-01 | 双11预热 | 0.75 | 68.5% | 正常记录-小数 |
| **3** | **2024-01-02** | **双11正式** | **85.3%** | **0.72** | **⚠️混合格式-百分数在前** |
| 4 | 2024-01-03 | 双12预热 | 0.65 | 0.82 | 正常记录-纯小数 |
| 5 | 2024-01-04 | 双12正式 | 78.5% | 92.3% | 正常记录-纯百分数 |
| **6** | **2024-01-05** | **年货节** | **0.88** | **75%** | **⚠️混合格式-小数在前** |
| 7 | 2024-01-06 | 春节活动 | N/A | 65% | 异常记录-无法解析 |
| 8 | 2024-01-07 | 情人节 | 0.95 |  | 正常记录-空值 |

### 处理结果
- 行3、行6 → 标记为 `mixed` 格式 → 状态 `pending_review` → **等待活动负责人复核**
- 行4 → 纯小数 → 自动归一化
- 行5 → 纯百分数 → 自动归一化
- 行7 → 无法解析 → 标记待复核
- 行8 → 空值忽略

---

## 💡 给活动负责人的话

下次再追问"为什么前后不一致"时，请：

1. **运行 `node dist/cli/index.js list`** 查看汇总
2. **找到混合格式记录**（标记为 ⚠️）
3. **运行 `node dist/cli/index.js show --id <记录ID>`** 查看完整证据：
   - 原始行号是多少
   - 原始值分别是什么格式
   - 谁导入的、什么时候导入的
   - 老师批注是什么
   - 谁复核的、怎么批的
4. **运行 `node dist/cli/index.js trace --id <记录ID>`** 看下一步怎么做

---

## 💡 给运营规划阿岚的话

不用再手工解释了！按这个流程操作：

1. `bezier import` 导入数据
2. `bezier annotate` 补充老师批注
3. 告诉活动负责人去 `bezier review`
4. 等复核通过了再 `bezier update`
5. `bezier export` 导出统一结果

所有操作都留痕，活动负责人追问时直接甩记录ID就行。

---

## 💡 给接手同事的话

想复现之前的处理流程？

1. `bezier replay` 查看可重跑会话列表
2. `bezier replay --session <会话ID> --operator "你的名字"` 复现完整流程
3. `bezier trace --id <记录ID>` 查看每条记录的来龙去脉

不需要问任何人，凭计算明细就能找到来源和下一步动作。

---

## 📝 代码中的边界规则位置

边界规则同时存在于：
1. **README.md** → 本文档（人看的）
2. **`src/core/boundary-rules.ts`** → 代码中（机器执行的）

> 两处必须保持一致！修改规则时两处都要更新。

查看代码中的边界规则：
```typescript
// src/core/boundary-rules.ts
export const BOUNDARY_RULES: BoundaryRule[] = [
  {
    id: 'RULE_001',
    name: '百分数小数混合检测',
    description: '当同一条记录中同时出现百分数（%）和小数（0-1之间）格式时，标记为异常，留待活动负责人复核',
    condition: (record) => record.hasMixedFormat,
    action: 'flag_for_review',
    severity: 'warning',
  },
  // ... 更多规则
];
```
