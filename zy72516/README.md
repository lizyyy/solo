# 售后机器人转人工判断系统

用于质检和复核售后机器人的自动判断结果，特别是处理引用链接404仍被判通过等异常场景。

## 核心特性

### 1. 三步核心流程
- **标注员留言第一次导入**：上传CSV文件，系统保留原始行号和完整内容
- **AI产品经理阿宁补看模型输出片段**：逐条查看模型推理片段，进行初步判断
- **冲突样本表更新**：异常样本进入复核队列，由产品经理最终裁定

### 2. 统一数据源 (Single Source of Truth)
页面展示、导出明细、接口返回**读取同一份 Zustand Store 数据**，确保：
- 引用链接404仍被判通过的记录不会在一个地方显示异常、另一个地方消失
- 所有状态变更实时同步
- 数据持久化至 LocalStorage

### 3. 完整可追溯
每条记录保留：
- 原始行号（`originalLineNumber`）
- 标注员留言原文（不做任何删改）
- 人工改动记录（操作日志）
- 当前处理状态
- 操作人、时间戳

## 边界规则 (Boundary Rules)

> 所有规则已固化在代码中，位于 `src/utils/boundaryRules.ts`，禁止口头约定。

### 规则1：引用链接404仍被判通过
- **触发条件**：`urlStatus === false` 且 `robotJudgment` 包含"通过"
- **处理方式**：强制标记为「待产品经理复核」（`PM_REVIEW`），**不得直接归为正常**
- **复核流程**：产品经理可在质检工作台或冲突样本表中执行「复核通过」或「复核驳回」
- **允许回滚**：是，可回滚至「待处理」

### 规则2：错口径
- **触发条件**：标注员留言包含「错口径」「口径错误」「不符合标准」
- **处理方式**：标记为「错口径」（`WRONG_CRITERIA`）
- **允许回滚**：是

### 规则3：补录返工
- **触发条件**：标注员留言包含「补录」「返工」「重新标注」
- **处理方式**：标记为「补录返工」（`REWORK`）
- **允许回滚**：是

## 页面说明

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | 首页 | 数据概览、快捷入口 |
| `/import` | 标注导入 | CSV文件上传、数据预览、边界规则预检测 |
| `/workbench` | 质检工作台 | 逐条处理、模型输出查看、状态操作 |
| `/conflicts` | 冲突样本表 | 异常样本汇总、筛选、批量操作、详情展开 |
| `/export` | 数据导出 | CSV/JSON格式导出，统一数据源 |
| `/rules` | 边界规则 | 规则说明文档、处理流程 |

## 技术栈

- **前端框架**：React 18 + TypeScript
- **构建工具**：Vite
- **样式方案**：TailwindCSS 3
- **状态管理**：Zustand（带持久化）
- **路由**：React Router DOM
- **图标**：lucide-react
- **CSV处理**：papaparse

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

## 项目结构

```
src/
├── components/
│   ├── layout/Layout.tsx    # 全局布局（导航栏）
│   └── common/              # 通用组件（状态标签等）
├── pages/                   # 页面组件
│   ├── Home.tsx
│   ├── Import.tsx
│   ├── Workbench.tsx
│   ├── Conflicts.tsx
│   ├── Export.tsx
│   └── Rules.tsx
├── store/
│   └── useRecordStore.ts    # 统一状态管理（Single Source of Truth）
├── types/
│   └── index.ts             # TypeScript 类型定义
├── utils/
│   ├── boundaryRules.ts     # 边界判断规则（核心）
│   ├── csvParser.ts         # CSV解析工具
│   ├── exportUtil.ts        # 导出工具
│   └── mockData.ts          # Mock数据生成
├── App.tsx
├── main.tsx
└── index.css
```

## 数据模型

### AnnotationRecord（标注记录）
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识 |
| `originalLineNumber` | number | **原始行号，保留证据** |
| `annotatorMessage` | string | 标注员留言原文 |
| `referenceUrl` | string | 引用链接 |
| `urlStatus` | boolean | 链接状态（true=有效，false=404） |
| `robotJudgment` | string | 机器人原始判断 |
| `currentStatus` | RecordStatus | 当前处理状态 |
| `abnormalType` | AbnormalType | 异常类型 |
| `modelOutput` | ModelOutput | 模型输出片段 |
| `judgmentLogs` | JudgmentLog[] | **操作日志，可追溯** |
| `rawData` | object | 原始导入数据，不做删改 |

### 状态枚举
- `pending` - 待处理
- `passed` - 通过
- `rejected` - 驳回
- `rework` - 补录返工
- `wrong_criteria` - 错口径
- `pm_review` - 待产品经理复核（**404专用**）
- `review_passed` - 复核通过
- `review_rejected` - 复核驳回

## 重要提醒

1. **引用链接404仍被判通过的样本，在质检工作台中「标记通过」按钮会被禁用**，必须使用产品经理专属的复核操作
2. 所有状态变更都会生成操作日志，包含操作人、前后状态、备注、时间戳
3. 错口径和补录返工作为优先处理的常见问题分类，在冲突样本表中可单独筛选
4. 首次访问系统会自动加载10条Mock数据用于演示，包含各种异常场景
