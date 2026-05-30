# 债券久期凸性解释器

专业的固定收益分析工具，帮助固收分析师解释收益率变动时的价格差异。

## 核心功能

- **债券管理**：录入债券条款，自动生成现金流，异常检测与追溯
- **收益率曲线管理**：导入曲线数据，支持线性/样条插值
- **计算分析**：久期、凸性计算，分步展示计算过程
- **敏感性对比**：小变动(±1bp) vs 大变动(±100bp)价格差异分析
- **报告中心**：生成分析报告，标记状态，导出Excel/PDF

## 技术栈

- React 18 + TypeScript
- Vite 构建工具
- TailwindCSS 样式
- Zustand 状态管理
- Decimal.js 高精度计算
- ECharts 图表
- SheetJS / jsPDF 导出

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 项目结构

```
src/
├── components/     # 通用组件
│   ├── Layout.tsx
│   ├── ExceptionDrawer.tsx
│   ├── CalculationSteps.tsx
│   └── CashFlowTable.tsx
├── pages/          # 页面组件
│   ├── Dashboard.tsx
│   ├── BondManagement.tsx
│   ├── CurveManagement.tsx
│   ├── Calculator.tsx
│   └── ReportCenter.tsx
├── store/          # 状态管理
│   └── index.ts
├── types/          # 类型定义
│   └── index.ts
├── utils/          # 工具函数
│   ├── calculationEngine.ts
│   └── exportUtils.ts
├── App.tsx
├── main.tsx
└── index.css
```
