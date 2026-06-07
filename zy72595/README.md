# 小样本 few-shot 评测系统

## 项目概述

解决"离线和线上分数差了一个桶"这类场景下的评测运营问题。将边界规则从口头约定落实到代码和文档中，支持阈值调参笔记导入、线上实验桶复核、实验对比更新的完整工作流。

## 核心功能

### 1. 边界规则（写在代码里，不靠口头约定）

**所有边界规则定义在 [boundaryRules.js](src/boundaryRules.js) 中**

| 规则ID | 规则名称 | 判定逻辑 | 处理方式 | 自动归正常 |
|--------|----------|----------|----------|------------|
| `ONE_BUCKET_DIFF` | 离线和线上分数差了一个桶 | 离线分桶和线上分桶相差1级 | 评测运营人工复核，不能自动判定 | ❌ 否 |
| `SAME_BUCKET` | 离线和线上分桶一致 | 离线分桶和线上分桶相同 | 系统自动处理 | ✅ 是 |
| `MORE_THAN_ONE_BUCKET_DIFF` | 离线和线上分桶相差超过1级 | 分桶相差2级及以上 | 推荐策略 + 评测运营共同复核 | ❌ 否 |

#### 离线和线上分数差了一个桶 - 处理细则

**怎么判：**
- 发现后自动标记为 `needs_recheck` 状态，**绝不自动归为正常**
- 必须由评测运营人工复核后才能改变状态

**怎么改：**
- 判定正常：保留当前数据，标记为已复核正常
- 判定异常：回退到导入步骤，重新导入修正后的数据

**怎么回滚：**
- 支持回滚到 `imported`（导入）步骤
- 回滚后需要重新走完整的工作流
- 回滚记录会保存在 `rollbackHistory` 中

### 2. 重复导入防翻倍机制

- 同一批次（`batchId`）只能导入一次
- 系统通过 `importBatchIds` 记录已导入的批次
- 重复导入会报错："该批次阈值调参笔记已经导入过了，系统不会重复计数"

### 3. 版本历史追踪

- 阈值调参笔记的每次修改都会记录版本
- 即使只改了一条备注，也能看出改前改后的差别
- 历史记录包含：版本号、时间戳、修改人、修改类型、改前值、改后值

### 4. 三步工作流

```
导入阈值调参笔记 → 补看线上实验桶 → 实验对比更新
     (imported)    (online_bucket_reviewed)  (comparison_updated)
```

**关键规则：**
- 不能跳过步骤直接推进
- 在"补看线上实验桶"步骤，如果发现离线和线上分数差了一个桶：
  - **别急着归正常**，自动标记为 `needs_recheck`
  - 留给评测运营复核
  - 全部复核完成后才会变为 `normal` 状态

### 5. 3D/图表展示服务复核

- 支持 `table`（表格）、`chart`（图表）、`3d`（3D）三种展示模式
- 点击任意一条记录（特别是"差了一个桶"的记录）：
  - 能回到阈值调参笔记详情
  - 能看到关联的线上实验桶数据
  - 能看到触发的边界规则和处理建议
  - **不会只剩漂亮画面**

### 6. 友好错误提示

所有错误提示都直接说人话，不吐内部字段名：

```
❌ 错误示例（不好）：INVALID_BATCH_ID, code=400
✅ 正确示例（我们的实现）：
   消息：该批次阈值调参笔记已经导入过了，系统不会重复计数，请检查批次号是否正确
   建议：如果确实需要重新导入，请先删除原有评测或使用新的批次号
```

完整错误列表见 [errors.js](src/utils/errors.js)

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行演示

```bash
npm start
```

演示会完整走一遍：
1. 创建评测
2. 导入阈值调参笔记（含差一个桶的记录）
3. 尝试重复导入（验证防翻倍）
4. 修改备注（验证版本历史）
5. 添加线上实验桶
6. 推进工作流到"补看线上实验桶"
7. 点击图表记录跳转详情
8. 评测运营复核分桶差异
9. 展示所有边界规则

### 运行测试

```bash
npm test
```

## 目录结构

```
src/
├── models/
│   ├── types.js              # 类型常量和工具函数
│   ├── ThresholdNote.js      # 阈值调参笔记模型（带版本历史）
│   ├── FewShotEval.js        # 小样本评测模型（带工作流）
│   └── OnlineExperimentBucket.js  # 线上实验桶模型
├── services/
│   └── EvalService.js        # 核心业务服务
├── utils/
│   └── errors.js             # 友好错误提示
├── boundaryRules.js          # 边界规则定义
└── index.js                  # 入口和演示
```

## 使用示例

```javascript
const EvalService = require('./src/services/EvalService');
const { WORKFLOW_STEP } = require('./src/models/types');

const service = new EvalService();

// 1. 创建评测
const eval1 = service.createEval('Q2评测', '推荐策略老唐');

// 2. 导入阈值调参笔记
const result = service.importThresholdBatch(
  eval1.id,
  'BATCH-001',
  [
    {
      thresholds: { click: 0.5 },
      remark: '初始配置',
      offlineBucket: '良好',
      onlineBucket: '一般'
    }
  ],
  '推荐策略老唐'
);

// 3. 推进工作流（会自动检测差一个桶的情况）
const workflowResult = service.advanceWorkflow(
  eval1.id,
  WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED,
  '推荐策略老唐'
);

// 4. 评测运营复核
service.reviewBucketDiff(
  eval1.id,
  result.importedNotes[0].id,
  '评测运营小王',
  'normal',
  '确认正常波动'
);
```

## 角色说明

- **推荐策略老唐**：导入阈值调参笔记、补看线上实验桶、修改备注
- **评测运营**：复核"差一个桶"的记录、最终判定
