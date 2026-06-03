# 港股通汇率损益复盘系统

## 项目概述

本系统用于港股通汇率损益复盘过程中的税费率备注管理，核心目标是**保留完整证据链**，确保柜台流水尾号的备注等原始材料不被"洗成一行干净数据"。系统严格遵循边界规则，所有业务逻辑均在代码中明确定义，杜绝口头约定。

---

## 核心边界规则

> **重要提示**：以下规则均为系统强制执行的逻辑，不存在口头约定。如需修改规则，必须同时更新代码和本文档。

### RULE_001: 金额为0但备注含冲正

**代码位置**: [src/utils/boundaryRules.ts#L36-L45](file:///Users/lzy/pro/solo/workspaces/zy72246/src/utils/boundaryRules.ts#L36-L45)

**判断条件**:
```typescript
amount === 0 && remark.includes("冲正")
```

**处理动作**:
- 系统自动设置状态为 `REVERSAL_PENDING_REVIEW`（已冲正待复核）
- 推送至风控复核队列
- **不得直接归为「正常」状态**，必须经过风控同事人工复核

**回滚方式**:
- 恢复到上一状态
- 清除风控标记
- 回滚操作全程留痕，保留回滚记录

---

### RULE_002: 重复导入检测

**代码位置**: [src/utils/boundaryRules.ts#L47-L74](file:///Users/lzy/pro/solo/workspaces/zy72246/src/utils/boundaryRules.ts#L47-L74)

**判断条件**:
- 基于业务主键（交易日期 + 证券代码 + 流水号）检测重复
- 业务主键生成规则:
```typescript
`${tradeDate}_${stockCode}_${serialNumber}`
```

**处理动作**:
- 重复导入时**不增加记录数量**
- 对比字段变更（currentRemark、currentAmount、counterTailNumber、summary）
- 有变更则创建新版本，记录变更前后对比
- 每次修改版本号+1，记录操作人、时间、原因

**回滚方式**:
- 支持回滚到任意历史版本
- 回滚操作本身也创建新版本记录
- 原始数据永久保留，不可删除

---

### RULE_003: 三步流程强制流转

**代码位置**: [src/utils/stateMachine.ts](file:///Users/lzy/pro/solo/workspaces/zy72246/src/utils/stateMachine.ts)

**判断条件**:
- 状态变更必须符合预设的状态机流转路径
- 三步流程（导入→补看流水→摘要更新）必须按顺序执行

**处理动作**:
- 不符合流转路径的状态变更将被拒绝
- 提示具体错误信息

**状态流转路径**:
| 当前状态 | 可转换到 |
|---------|---------|
| PENDING（待处理） | SUPPLEMENT_COMPLETED（补看完成）、REJECTED（已驳回） |
| REVERSAL_PENDING_REVIEW（已冲正待复核） | NORMAL（正常）、REJECTED（已驳回） |
| NORMAL（正常） | SUPPLEMENT_COMPLETED（补看完成）、REJECTED（已驳回） |
| SUPPLEMENT_COMPLETED（补看完成） | PENDING_APPROVAL（待审批）、REJECTED（已驳回） |
| PENDING_APPROVAL（待审批） | COMPLETED（已完成）、REJECTED（已驳回） |
| REJECTED（已驳回） | PENDING（待处理） |
| COMPLETED（已完成） | PENDING（待处理） |

**三步流程阶段流转**:
| 当前阶段 | 可转换到 |
|---------|---------|
| STEP_1_IMPORT（第一步：导入） | STEP_2_SUPPLEMENT（第二步：补看流水） |
| STEP_2_SUPPLEMENT（第二步：补看流水） | STEP_3_SUMMARY（第三步：摘要更新） |
| STEP_3_SUMMARY（第三步：摘要更新） | （无后续阶段） |

**回滚方式**:
- 无（前置校验不通过，操作被拒绝）

---

## 三步流程详解

### 第一步：导入（税费率备注第一次导入）

**触发条件**: 投研助理上传原始文件

**系统动作**:
1. 自动解析并保留**原始行号**（永久保留，不可修改）
2. 检测边界情况（金额为0且备注已冲正）
3. 异常记录标记为 `REVERSAL_PENDING_REVIEW`（已冲正待复核）
4. 正常记录标记为 `PENDING`（待处理）
5. 保留**原始备注**（永久保留，不可修改）

**不可清洗字段**:
- 原始行号（永久保留）
- 原始备注（永久保留）
- 柜台流水尾号
- 冲正标记

---

### 第二步：补看流水（投研助理补看柜台流水尾号）

**触发条件**: 投研助理查看原始备注后操作

**系统动作**:
1. 根据柜台流水尾号补充或修正备注
2. 记录每次人工改动的**前后对比**
3. 状态更新为 `SUPPLEMENT_COMPLETED`（补看完成）
4. 创建历史版本记录

**版本追踪**:
- 每次修改版本号+1
- 记录变更字段、前后值
- 记录操作人、时间、原因
- 支持版本对比和回滚

---

### 第三步：摘要更新（给负责人看的摘要更新）

**触发条件**: 补看流水完成后生成摘要

**系统动作**:
1. 自动生成摘要信息
2. 投研助理可调整摘要内容
3. 状态更新为 `PENDING_APPROVAL`（待负责人审阅）
4. 负责人审阅后标记为 `COMPLETED`（已完成）

**特殊情况处理**:
- 金额为0已冲正：强制风控复核
- **不归为「正常」状态**
- 留给风控同事复核判断
- 支持驳回重处理和回滚

---

## 证据链完整性承诺

本系统设计确保以下证据链完整性：

1. ✓ **原始行号永久保留**，不可修改，不可删除
2. ✓ **原始备注永久保留**，不可修改，不可删除
3. ✓ **每次修改记录版本**，变更前后对比可查
4. ✓ **状态流转全程留痕**，操作人、时间、原因完整
5. ✓ **重复导入不增加记录数**，仅更新变更字段
6. ✓ **风控复核记录不可删除**，支持回滚但保留痕迹

---

## 页面功能说明

| 页面 | 路由 | 功能说明 |
|------|------|---------|
| 复盘主界面 | `/` | 记录列表展示、筛选、搜索、查看详情 |
| 数据导入 | `/import` | 上传CSV/Excel文件、预览、去重导入 |
| 历史变更 | `/history/:id` | 单条记录的完整变更历史、版本对比 |
| 风控复核 | `/review` | 处理金额为0但备注含冲正的异常记录 |
| 边界规则 | `/rules` | 查看所有系统规则的文档版本 |

---

## 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **状态管理**: Zustand（带 localStorage 持久化）
- **样式方案**: Tailwind CSS 3
- **路由管理**: React Router DOM 6
- **文件解析**: PapaParse（CSV）、SheetJS/xlsx（Excel）
- **图标库**: Lucide React

---

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 类型检查
npm run check

# 构建生产版本
npm run build
```

---

## 数据持久化

系统使用 `localStorage` 进行数据持久化，存储键为 `hkt-share-tax-review-storage`。

包含数据：
- 税费率备注记录（taxNotes）
- 版本历史（versions）
- 状态流转历史（statusHistories）
- 风控复核记录（reviewRecords）

首次加载时如无数据，自动加载模拟数据用于演示。

---

## 目录结构

```
src/
├── components/          # UI组件
│   ├── Layout.tsx       # 应用布局
│   ├── StatusBadge.tsx  # 状态标签
│   ├── ProcessStepIndicator.tsx  # 流程指示器
│   └── TaxNoteDetailModal.tsx    # 详情弹窗
├── pages/               # 页面组件
│   ├── Home.tsx         # 复盘主界面
│   ├── ImportPage.tsx   # 数据导入
│   ├── HistoryPage.tsx  # 历史变更
│   ├── ReviewPage.tsx   # 风控复核
│   └── RulesPage.tsx    # 边界规则
├── store/               # 状态管理
│   └── index.ts         # Zustand store
├── types/               # 类型定义
│   └── index.ts         # 核心类型
├── utils/               # 工具函数
│   ├── boundaryRules.ts # 边界规则引擎
│   ├── deduplication.ts # 去重校验
│   ├── versionControl.ts # 版本管理
│   ├── stateMachine.ts  # 状态机
│   └── fileParser.ts    # 文件解析
└── data/                # 模拟数据
    └── mockData.ts      # 10条模拟记录
```
