# 梯度下降学习率演示

反例验证与数据自检教学工具。

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 http://localhost:5173/

## 新人入门：从样例到报告

### 第一步：加载样例数据

1. 进入「主控台」页面
2. 点击底部「加载样例数据」
3. 状态卡片显示：反例总数、冲突数、待复核数

### 第二步：查看反例管理

1. 左侧导航点击「反例管理」
2. 查看反例列表：
   - **正常**（绿色）：原始值 < 阈值
   - **待复核**（橙色）：原始值 = 阈值，留给任课老师
   - **冲突**（红色）：手算反例与问卷原始行矛盾
3. 点击「查看问卷」对比原始行数据
4. 点击「冲突详情」查看左右对比证据

### 第三步：处理冲突

运营规划阿岚操作：
1. 在冲突行点击「冲突详情」
2. 查看反例数据 vs 问卷数据
3. 点击「确认反例」或「驳回反例」
4. 操作结果自动写入历史

### 第四步：运行材料

1. 左侧导航点击「材料运行」
2. 选择模式：正常材料 / 错口径材料 / 补录材料
3. 点击「运行」
4. 查看下方运行历史时间线

### 第五步：自检与导出

1. 左侧导航点击「自检与导出」
2. 点击「运行自检」
3. 四项自检全部通过后，点击「导出报告」
4. 自动下载 Markdown 格式报告

## 核心业务规则

### 边界值处理

> **关键规则：当原始值刚好等于阈值时，自动标记为「待复核」，不自动归入正常，留给任课老师复核。**

### 四项自检

| 自检项 | 检查内容 |
|--------|----------|
| 重复导入检测 | 是否存在来源+值+阈值相同的重复项 |
| 边界值阈值检测 | 所有值=阈值的条目是否都标记为 boundary/pending_review |
| 补录后重算检测 | 补录运行中的反例来源是否一致 |
| 导出一致性检测 | 运行记录摘要与实际反例计数是否匹配 |

### 冲突处理流程

1. 系统自动比对手算反例与问卷原始行
2. 发现字段不一致 → 标记冲突
3. 运营阿岚在冲突证据面板选择确认或驳回
4. 确认 → 保留冲突状态；驳回 → 改为正常

## 技术栈

- React 18 + TypeScript
- Vite
- Tailwind CSS 3
- Zustand (状态管理)
- Lucide React (图标)

## 数据持久化

所有数据存储在浏览器 localStorage，刷新不丢失：

- `gd_counter_examples` - 反例列表
- `gd_questionnaire_rows` - 问卷原始行
- `gd_run_records` - 运行历史
- `gd_conflict_evidences` - 冲突证据
- `gd_self_check_results` - 自检结果

## 项目结构

```
src/
├── components/     # UI 组件
│   ├── Layout.tsx
│   ├── Sidebar.tsx
│   ├── Toast.tsx
│   ├── GradientCanvas.tsx
│   ├── StatusCards.tsx
│   ├── CounterExampleTable.tsx
│   ├── QuestionnairePanel.tsx
│   ├── ConflictModal.tsx
│   ├── RunModeTabs.tsx
│   ├── RunHistory.tsx
│   └── SelfCheckCards.tsx
├── pages/          # 页面
│   ├── Dashboard.tsx
│   ├── CounterExamples.tsx
│   ├── Runs.tsx
│   └── Checks.tsx
├── store/          # 状态管理
│   └── useAppStore.ts
├── types/          # 类型定义
│   └── index.ts
├── utils/          # 工具函数
│   ├── gradient.ts     # 梯度下降引擎
│   ├── comparator.ts   # 反例比对器
│   ├── selfCheck.ts    # 自检引擎
│   ├── report.ts       # 报告生成
│   ├── sampleData.ts   # 样例数据
│   └── storage.ts      # localStorage 封装
├── App.tsx
├── main.tsx
└── index.css
```
