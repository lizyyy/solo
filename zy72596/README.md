# 特征缓存失效复盘系统

面向算法团队的复盘工具，解决线上特征缺失给默认分后，训练日志曲线与阈值调参笔记证据链断裂的问题。

---

## 核心设计原则

**结论看着很满，追证据时不能断在半路。

- 每一条复盘结论都能追溯到原始证据
- 训练日志的原始行号、人工改动、处理状态全程留痕
- 边界规则代码化，不只靠口头约定

---

## 边界规则（代码与本文档同步）

### RULE-001：线上特征缺失却给了默认分

| 项目 | 说明 |
|------|------|
| **判定方式 | 训练日志内容包含 `默认分`、`default_score`、`feature_missing` 关键词 |
| **处理方式 | 1. 自动标记 `hasDefaultScoreIssue = true`<br>2. 状态自动流转到 `pending_review`<br>3. 必须推荐负责人复核后才能标记为完成 |
| **回滚方案 | 清除标记，退回到 `in_progress` 状态 |
| **代码位置 | [boundaryRules.ts](file:///Users/lzy/pro/solo/workspaces/zy72596/src/utils/boundaryRules.ts#L20-L46) |

### RULE-002：重复导入同一批训练日志

| 项目 | 说明 |
|------|------|
| **判定方式 | 通过 `sourceHash = hash(batchId + lineNumber + content)` 去重 |
| **处理方式 | 相同哈希的日志不重复创建，仅保留原有记录 |
| **回滚方案 | 无（不产生重复数据） |
| **代码位置 | [logParser.ts](file:///Users/lzy/pro/solo/workspaces/zy72596/src/utils/logParser.ts#L1-L16) |

### RULE-003：修改训练日志内容

| 项目 | 说明 |
|------|------|
| **判定方式 | 任何对训练日志 `content` 字段的修改 |
| **处理方式 | 1. 自动保留 `originalContent` 原始值<br>2. 生成 `CHANGE_HISTORY` 记录改前改后值<br>3. 标记 `isModified = true` |
| **回滚方案 | 从历史记录恢复 `oldValue` |
| **代码位置 | [useReviewStore.ts](file:///Users/lzy/pro/solo/workspaces/zy72596/src/store/useReviewStore.ts#L158-L196) |

### RULE-004：三步流程完整性校验

| 项目 | 说明 |
|------|------|
| **判定方式 | 标记为 `completed` 时检查 `currentStep` 必须是 `summary_update` |
| **处理方式 | 禁止标记为已完成，必须走完：<br>`log_import` → `threshold_note` → `summary_update` |
| **回滚方案 | 无 |
| **代码位置 | [boundaryRules.ts](file:///Users/lzy/pro/solo/workspaces/zy72596/src/utils/boundaryRules.ts#L48-L60) |

### RULE-005：待复核项确认校验

| 项目 | 说明 |
|------|------|
| **判定方式 | `hasDefaultScoreIssue = true` 且无 `reviewComment` |
| **处理方式 | 禁止标记为已完成，必须有推荐负责人复核意见 |
| **回滚方案 | 无 |
| **代码位置 | [boundaryRules.ts](file:///Users/lzy/pro/solo/workspaces/zy72596/src/utils/boundaryRules.ts#L62-L75) |

---

## 状态流转规则

```
草稿 → 进行中 → 待复核 → 已完成
              ↗          ↖
        退回重新分析
```

- `draft` → `in_progress`：导入训练日志完成
- `in_progress` → `pending_review`：检测到默认分问题
- `in_progress` → `completed`：无默认分问题 + 三步流程走完
- `pending_review` → `in_progress`：推荐负责人退回
- `pending_review` → `completed`：推荐负责人确认正常
- `completed` → `in_progress`：需要重新分析

---

## 标准三步流程

### 第一步：导入训练日志曲线

- 算法工程师小乔导入训练日志
- 系统按批次去重（相同内容不会重复导入
- 保留原始行号，支持编辑但永不丢失原始内容
- 自动检测是否存在特征缺失给默认分

### 第二步：补看阈值调参笔记

- 小乔补充阈值调参笔记
- 笔记可关联到具体的训练日志条目
- 修改记录完整可追溯

### 第三步：更新可解释摘要

- 每条结论标记来源：训练日志 / 阈值笔记 / 人工补充
- 需要确认的结论单独标记
- 存在默认分问题时，状态流转到待复核

### 推荐负责人复核

- 临时会前10分钟可只看摘要视图
- 摘要中明确哪条来自训练日志、哪条还等确认
- 复核后才能归档

---

## 项目结构

```
src/
├── types/           # 类型定义
├── store/           # Zustand 状态管理
├── utils/           # 工具函数
│   ├── boundaryRules.ts   # 边界规则引擎（核心）
│   ├── storage.ts        # LocalStorage 存储层
│   ├── logParser.ts      # 日志解析与去重
│   ├── mockData.ts       # Mock 数据
│   └── common.ts
├── components/      # 通用组件
│   ├── StepProgress.tsx   # 三步进度条
│   ├── StatusBadge.tsx  # 状态标签
│   ├── TrainingLogItem.tsx  # 训练日志条目
│   ├── ChangeHistoryItem.tsx # 修改历史
│   └── SummaryItemCard.tsx # 摘要卡片
└── pages/           # 页面
    ├── ReviewList.tsx   # 复盘列表（含会前摘要视图
    └── ReviewDetail.tsx # 复盘详情
```

---

## 开发运行

```bash
npm install
npm run dev
```

---

## 证据链追踪

任意字段修改时，系统自动记录：

1. **改前值** → 原始值永不丢失
2. **改后值** → 最新值
3. **操作人** → 谁改的
4. **时间戳** → 什么时候改的
5. **修改类型** → 创建/更新/状态变更

推荐负责人追问时，点击「修改历史」标签页即可看到完整证据链。
