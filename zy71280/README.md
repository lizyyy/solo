# 拍卖保留价优化系统

基于历史成交数据和买家活跃度，智能计算最优保留价，告别拍脑袋决策。

## 快速开始

### 启动

```bash
pnpm install
pnpm dev
```

### 四步走

| 步骤 | 页面 | 做什么 |
|------|------|--------|
| ① | **数据导入** | 点击「加载样例数据」，或上传CSV文件 |
| ② | **计算分析** | 选拍品，调参数，看三种情景收益曲线 |
| ③ | **异常检测** | 检查样本量、流拍成本、佣金阶梯问题 |
| ④ | **报告导出** | 下载PDF/Excel优化报告 |

## 核心功能

- **收益期望**：正态分布成交概率模型 + 买家活跃度加权
- **风险约束**：流拍概率、佣金保障、保留价区间约束
- **情景对比**：保守/中性/乐观三种参数调整
- **异常检测**：样本量检验、流拍成本核算、佣金阶梯校验

## 规则调整

修改 `src/data/rules.json` 可调口径：
- `sampleSizeThresholds`：样本量阈值
- `commissionIndustryStandard`：佣金行业标准
- `unsoldCostComponents`：流拍成本构成
- `scenarioAdjustments`：情景调整系数

## 项目结构

```
src/
├── types/auction.ts      # 数据类型定义
├── data/                 # 规则与样例数据
├── utils/                # 算法与工具
│   ├── calculator.ts     # 核心计算
│   ├── anomalyDetector.ts # 异常检测
│   └── reportGenerator.ts # 报告导出
├── components/           # 组件
├── pages/              # 页面
└── store/useAuctionStore.ts # 状态管理
```

---

**先跑什么？** → 打开「数据导入」，点「加载样例数据」

**再看哪里？** → 「计算分析」看最优保留价建议
