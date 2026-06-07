# 强化学习仓储调度 - 评测追踪系统

解决评测运营与算法工程师之间证据链断裂、结论无法追溯的问题。

## 核心价值

- **证据链完整**：每一条结论都能追溯到训练日志的原始行号
- **边界规则明确**：少数类样本等异常情况的判定标准写在代码和 README 里，不靠口头约定
- **变更可回溯**：所有修改留痕，改前改后对比清晰，支持回滚
- **晚到材料友好**：阈值调参笔记晚上补进来时，只刷新相关明细，不洗掉已确认内容

## 三步工作流

1. **第一步：训练日志曲线第一次导入**
   - 系统自动记录原始行号、文件来源、导入时间
   - 基于文件哈希 + 行号去重，重复导入不翻倍数量
   - 自动触发边界规则检测

2. **第二步：评测运营小孟补看阈值调参笔记**
   - 阈值笔记可晚到补录，只刷新关联日志的备注字段
   - 已 confirmed 状态的日志，其他字段不被覆盖
   - 少数类样本被总指标盖住时，自动标记待复核

3. **第三步：阈值回放更新**
   - 算法工程师人工复核边界案例
   - 确认或驳回，系统生成变更历史
   - 所有操作可追溯、可回滚

## 边界规则（BR - Boundary Rules）

> **核心原则**：边界规则必须代码可执行、文档可查阅。任何规则变更必须同时更新代码实现和本文档。两侧不一致时，以本文档为准并同步修正代码。

---

### BR-001: 少数类样本被总指标盖住

**触发条件**：
```
总指标 >= 0.85 且 少数类指标 < 0.85 * 0.8
```

**处理动作**：
- `isBoundaryCase = true`
- `boundaryReason = "BR-001: 少数类样本被总指标盖住"`
- `status = 'reviewing'`（自动设为待复核，不允许直接确认）

**回滚流程**：
1. 算法工程师在「训练日志管理」页找到标记为边界案例的记录
2. 点击「复核」按钮，查看原始行号和少数类指标明细
3. 确认无误后选择「确认通过」或「驳回」
4. 系统生成变更历史记录，状态流转为 confirmed 或 rejected

**代码位置**：[src/utils/boundaryRules.ts#L6-L9](src/utils/boundaryRules.ts#L6-L9)

---

### BR-002: 晚到材料刷新规则

**触发条件**：
- 阈值调参笔记标记为「晚到材料」
- 关联的训练日志已存在（可能已被确认）

**处理动作**：
- 仅更新关联日志的 `remark` 字段（追加笔记摘要）
- 已 `confirmed` 状态的日志，`status` 和其他字段保持不变
- 每条关联日志生成一条变更历史记录

**回滚流程**：
1. 在「变更历史」页找到对应的更新操作
2. 点击「回滚」按钮
3. 系统将该条笔记关联的日志恢复到更新前的状态
4. 生成回滚操作的变更历史记录

**代码位置**：[src/store/useAppStore.ts#L162-L242](src/store/useAppStore.ts#L162-L242)

---

### BR-003: 重复导入去重规则

**触发条件**：
- 同一批训练日志被重复导入

**处理动作**：
- 唯一键：`fileHash + originalLineNumber`
- 已存在的行自动跳过，数量不翻倍
- 导入报告中明确显示：新增数、重复跳过数、边界案例数

**回滚流程**：
1. 在「训练日志管理」页按导入批次筛选
2. 选择需要撤销的导入批次
3. 点击「撤销导入」，删除该批次新增的记录
4. 保留变更历史以供审计

**代码位置**：[src/utils/deduplication.ts#L11-L39](src/utils/deduplication.ts#L11-L39)

---

## 数据模型

### TrainingLog（训练日志）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| originalLineNumber | number | 原始行号（追溯用） |
| fileHash | string | 源文件哈希（去重用） |
| fileName | string | 源文件名 |
| epoch | number | 训练轮次 |
| reward | number | 奖励值 |
| loss | number | 损失值 |
| minorityMetric | number | 少数类指标 |
| overallMetric | number | 总指标 |
| status | pending/reviewing/confirmed/rejected | 处理状态 |
| isBoundaryCase | boolean | 是否边界案例 |
| boundaryReason | string | 边界触发原因 |
| remark | string | 备注 |
| createdBy | string | 创建人 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

### ThresholdNote（阈值调参笔记）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| trainingLogIds | string[] | 关联的训练日志ID列表 |
| content | string | 笔记内容 |
| isLateArrival | boolean | 是否晚到材料 |
| createdBy | string | 创建人 |
| createdAt | datetime | 创建时间 |

### ChangeHistory（变更历史）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| entityType | training_log/threshold_note | 实体类型 |
| entityId | string | 实体ID |
| beforeSnapshot | JSON | 改前快照 |
| afterSnapshot | JSON | 改后快照 |
| changedFields | string[] | 变更字段列表 |
| operationType | create/update/import/rollback | 操作类型 |
| operator | string | 操作人 |
| operatedAt | datetime | 操作时间 |

## 项目结构

```
src/
├── components/          # 可复用组件
│   ├── StatusBadge.tsx  # 状态标签
│   ├── StepIndicator.tsx # 步骤指示器
│   └── DiffViewer.tsx   # 改前改后对比组件
├── pages/               # 页面组件
│   ├── Home.tsx         # 工作流向导页
│   ├── TrainingLogs.tsx # 训练日志管理
│   ├── ThresholdNotes.tsx # 阈值笔记
│   ├── ChangeHistory.tsx # 变更历史
│   └── BoundaryRules.tsx # 边界规则中心
├── store/               # Zustand 状态
│   └── useAppStore.ts
├── utils/               # 工具函数
│   ├── deduplication.ts # 去重引擎
│   ├── boundaryRules.ts # 边界规则
│   ├── changeTracker.ts # 变更追踪
│   └── hash.ts          # 哈希计算
├── types/               # TypeScript 类型
│   └── index.ts
├── data/                # Mock 数据
│   └── mockData.ts
├── App.tsx              # 主应用
├── main.tsx             # 入口
└── index.css            # 样式
```

## 开发

```bash
pnpm install
pnpm run dev
```

## 规则变更记录

| 版本 | 日期 | 变更内容 | 变更人 |
|------|------|---------|--------|
| v1.0 | 2026-06-07 | 初始版本，定义 BR-001/BR-002/BR-003 三条边界规则 | 系统初始化 |
