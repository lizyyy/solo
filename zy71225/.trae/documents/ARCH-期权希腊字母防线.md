## 1. 架构设计

```mermaid
graph TD
    UI["React 视图层<br/>页面/组件"] --> STATE["Zustand 状态管理层<br/>游戏状态/持仓/行情"]
    STATE --> ENGINE["希腊值计算引擎<br/>Black-Scholes 模型"]
    STATE --> RULES["业务规则层<br/>保证金/爆仓/费用"]
    STATE --> STORAGE["本地持久化<br/>LocalStorage/JSON导出"]
    
    subgraph 数据层
        MOCK["Mock 数据<br/>初始头寸/行情序列"]
        ENGINE
        RULES
    end
    
    subgraph 工具层
        REPLAY["回放引擎<br/>操作记录/时间旅行"]
        EXPORT["导出服务<br/>PDF/JSON/图片"]
        DIFF["差异对比<br/>版本比较"]
    end
```

## 2. 技术栈说明

- **前端框架**：React@18 + TypeScript@5
- **构建工具**：Vite@5
- **样式方案**：TailwindCSS@3 + PostCSS
- **状态管理**：Zustand@4（轻量级，支持时间旅行便于回放）
- **图表库**：Recharts@2（用于保证金趋势图和结果对比图）
- **图标**：Lucide React（简洁图标）
- **字体**：Google Fonts（JetBrains Mono + Caveat + Noto Sans SC）
- **后端**：无（纯前端应用，所有数据本地处理）
- **数据库**：LocalStorage + 本地JSON文件导入导出

## 3. 路由定义

| 路由 | 页面 | 主要功能 |
|-------|------|----------|
| / | 首页/游戏入口 | 游戏介绍、开始游戏、加载存档、材料管理入口 |
| /game | 游戏主界面 | 头寸管理、希腊值监控、行情卡、操作面板 |
| /review | 复盘报告页 | 时间线、错误分析、多维度评分、回放功能 |
| /materials | 材料管理页 | 原始材料编辑、版本对比、差异可视化 |

## 4. 核心数据模型

### 4.1 数据模型定义

```mermaid
erDiagram
    GAME_MATERIALS {
        string id "材料ID"
        string name "材料名称"
        string createdAt "创建时间"
        Position[] initialPositions "初始头寸"
        MarketEvent[] marketEvents "行情事件序列"
        MarginConfig marginConfig "保证金配置"
        GreekTarget greekTargets "希腊值目标区间"
        FeeConfig feeConfig "调仓费用配置"
    }
    
    POSITION {
        string id "头寸ID"
        string contractCode "合约代码"
        string type "类型: call/put/underlying"
        number strike "行权价"
        number expiry "到期天数"
        number quantity "持仓数量（正为多头，负为空头"
        number costPrice "开仓价格"
    }
    
    MARKET_EVENT {
        number round "回合数"
        number underlyingPrice "标的价格"
        number priceChange "价格变动%"
        number volatility "波动率%"
        number volatilityChange "波动率变动%"
        number daysPassed "经过天数"
        boolean isShock "是否突变行情"
        string note "行情描述"
    }
    
    GAME_STATE {
        string id "游戏ID"
        string materialId "使用的材料ID"
        number currentRound "当前回合"
        Position[] positions "当前持仓"
        GreekValues greeks "当前希腊值"
        MarginStatus margin "保证金状态"
        number cash "现金余额"
        number totalPnL "总盈亏"
        ActionRecord[] actions "操作记录"
        string status "游戏状态: playing/ended/bankrupt"
    }
    
    GREEK_VALUES {
        number delta "Delta"
        number gamma "Gamma"
        number vega "Vega"
        number theta "Theta"
        number rho "Rho"
    }
    
    MARGIN_STATUS {
        number initialMargin "初始保证金"
        number maintenanceMargin "维持保证金"
        number availableMargin "可用保证金"
        number marginRatio "保证金比例"
        boolean marginCall "是否追缴"
    }
    
    ACTION_RECORD {
        number round "回合"
        string type "操作类型: adjust/stopLoss/hold"
        string details "操作详情"
        number cost "费用"
        GreekValues greeksBefore "操作前希腊值"
        GreekValues greeksAfter "操作后希腊值"
        string errorType "错误类型（如有）"
        string errorNote "错误说明"
    }
    
    REVIEW_REPORT {
        string gameId "游戏ID"
        Score scores "各项评分"
        ErrorAnalysis[] errors "错误分析"
        GameSnapshot[] timeline "时间线快照"
    }
    
    GAME_MATERIALS ||--o{ GAME_STATE : "被使用"
    GAME_STATE ||--o{ POSITION : "包含"
    GAME_STATE ||--o{ ACTION_RECORD : "记录"
    GAME_STATE ||--|| GREEK_VALUES : "计算"
    GAME_STATE ||--|| MARGIN_STATUS : "监控"
    GAME_STATE ||--|| REVIEW_REPORT : "生成"
```

### 4.2 关键类型定义 (TypeScript)

```typescript
// 期权类型
type OptionType = 'call' | 'put' | 'underlying';

// 头寸接口
interface Position {
  id: string;
  contractCode: string;
  type: OptionType;
  strike: number;
  expiryDays: number;
  quantity: number;
  costPrice: number;
  currentPrice?: number;
  marketValue?: number;
  pnl?: number;
  individualGreeks?: GreekValues;
}

// 希腊值接口
interface GreekValues {
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
}

// 行情事件接口
interface MarketEvent {
  round: number;
  underlyingPrice: number;
  priceChange: number;
  volatility: number;
  volatilityChange: number;
  daysPassed: number;
  isShock: boolean;
  description: string;
}

// 保证金配置
interface MarginConfig {
  initialMarginRate: number;  // 初始保证金比例
  maintenanceMarginRate: number;  // 维持保证金比例
  marginCallThreshold: number;   // 追缴阈值
}

// 费用配置
interface FeeConfig {
  optionTradingFee: number;   // 期权交易费率
  underlyingTradingFee: number; // 标的交易费率
  exerciseFee: number;       // 行权费用
  slippage: number;        // 滑点
}

// 希腊值目标区间
interface GreekTarget {
  delta: { min: number; max: number };
  gamma: { min: number; max: number };
  vega: { min: number; max: number };
}

// 游戏材料（原始材料）
interface GameMaterials {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  initialUnderlyingPrice: number;
  initialPositions: Position[];
  marketEvents: MarketEvent[];
  marginConfig: MarginConfig;
  feeConfig: FeeConfig;
  greekTargets: GreekTarget;
  initialCash: number;
}

// 游戏状态
interface GameState {
  id: string;
  materialId: string;
  materialName: string;
  currentRound: number;
  totalRounds: number;
  status: 'idle' | 'playing' | 'ended' | 'bankrupt';
  positions: Position[];
  currentGreeks: GreekValues;
  marginStatus: MarginStatus;
  cash: number;
  totalPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  actionHistory: ActionRecord[];
  marketHistory: MarketSnapshot[];
  currentMarket: MarketEvent | null;
}

// 操作记录
interface ActionRecord {
  round: number;
  timestamp: number;
  type: 'adjust' | 'stopLoss' | 'hold';
  positionChanges: PositionChange[];
  totalCost: number;
  greeksBefore: GreekValues;
  greeksAfter: GreekValues;
  errorType?: string;
  errorNote?: string;
}

// 复盘报告
interface ReviewReport {
  gameId: string;
  scores: {
    riskManagement: number;
    costControl: number;
    decisionTiming: number;
    greekStability: number;
    overall: number;
  };
  errors: ErrorAnalysis[];
  timeline: GameSnapshot[];
}
```

## 5. 核心算法说明

### 5.1 Black-Scholes 希腊值计算引擎

```typescript
// 核心计算函数
function calculateBlackScholes(
  S: number,      // 标的价格
  K: number,      // 行权价
  T: number,      // 到期时间（年）
  r: number,      // 无风险利率
  sigma: number,  // 波动率
  type: 'call' | 'put'
): {
  price: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
}

// 组合希腊值计算
function calculatePortfolioGreeks(
  positions: Position[],
  underlyingPrice: number,
  volatility: number,
  riskFreeRate: number
): GreekValues

// 正态分布累积函数
function normalCDF(x: number): number

// 正态分布概率密度函数
function normalPDF(x: number): number
```

### 5.2 保证金计算

```typescript
// 保证金计算
function calculateMargin(
  positions: Position[],
  config: MarginConfig,
  underlyingPrice: number
): MarginStatus
```

### 5.3 评分算法

```typescript
// 风险管理评分：基于希腊值在目标区间内的时间占比
function calculateRiskManagementScore(
  history: GreekValues[],
  targets: GreekTarget
): number

// 成本控制评分：基于调仓费用占总盈亏的比例
function calculateCostControlScore(
  actions: ActionRecord[],
  totalPnL: number
): number
```

## 6. 目录结构

```
src/
├── assets/              # 静态资源
├── components/        # 通用组件
│   ├── game/       # 游戏相关组件
│   ├── review/     # 复盘相关组件
│   └── materials/  # 材料管理相关组件
│   └── ui/         # 基础UI组件
├── engine/          # 计算引擎
│   ├── blackScholes.ts    # BS模型
│   ├── greekCalculator.ts # 希腊值计算
│   ├── marginCalculator.ts # 保证金计算
│   └── feeCalculator.ts # 费用计算
├── store/           # 状态管理
│   ├── useGameStore.ts # 游戏状态
│   └── useMaterialStore.ts # 材料状态
├── types/           # TypeScript类型定义
├── utils/           # 工具函数
├── data/            # Mock数据
│   ├── defaultMaterials.ts # 默认材料
├── pages/           # 页面组件
│   ├── Home.tsx
│   ├── Game.tsx
│   ├── Review.tsx
│   └── Materials.tsx
├── App.tsx
├── main.tsx
└── index.css
```

## 7. 关键技术决策

1. **纯前端架构**：无需后端，所有数据本地存储，便于培训师在无网络环境下使用
2. **Zustand状态管理**：轻量级，内置devtools，支持时间旅行，便于实现回放功能
3. **Black-Scholes模型**：实现完整的希腊值计算，确保金融模型的准确性
4. **LocalStorage持久化**：自动保存游戏进度和材料配置
5. **JSON导入导出**：支持材料的分享和复用
6. **Recharts图表**：实现保证金趋势、希腊值趋势的可视化
7. **TailwindCSS**：快速实现复杂的UI样式，支持深色主题
8. **TypeScript**：类型安全，减少金融计算中的错误
