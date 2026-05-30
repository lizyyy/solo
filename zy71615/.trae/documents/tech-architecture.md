## 1. 架构设计

```mermaid
graph TD
    "前端 React App" --> "Zustand 状态管理"
    "Zustand 状态管理" --> "游戏引擎（回合/汇率/舱位/违约）"
    "Zustand 状态管理" --> "现金账本模块"
    "Zustand 状态管理" --> "经营报告模块"
    "游戏引擎（回合/汇率/舱位/违约）" --> "数据持久化（localStorage）"
    "现金账本模块" --> "数据持久化（localStorage）"
    "经营报告模块" --> "报告导出（CSV/JSON）"
```

纯前端架构，无后端服务。所有游戏状态通过 Zustand 管理，使用 localStorage 持久化。

## 2. 技术说明

- **前端**：React@18 + TypeScript + Tailwind CSS@3 + Vite
- **初始化工具**：vite-init（react-ts 模板）
- **状态管理**：Zustand（游戏状态、账本、报告）
- **拖拽交互**：HTML5 Drag and Drop API（原生实现，无需额外库）
- **图表**：轻量 SVG 折线图（自绘，无需 Chart.js）
- **导出**：原生 Blob + URL.createObjectURL 实现 CSV/JSON 导出
- **后端**：无
- **数据库**：无，使用 localStorage 持久化游戏存档

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| `/` | 游戏主面板（订单拖拽、货柜分配、舱位选择、汇率牌） |
| `/ledger` | 现金账本页面（收支流水、余额走势） |
| `/report` | 经营报告页面（全链路追溯、失败回放、导出、易错标记） |

## 4. 数据模型

### 4.1 核心类型定义

```typescript
interface Order {
  id: string
  commodity: string
  quantity: number
  foreignPrice: number
  currency: string
  deadlineRound: number
  breachRate: number
  status: 'pending' | 'loaded' | 'shipped' | 'breached' | 'cancelled'
  assignedContainerId: string | null
  createdRound: number
}

interface ExchangeRate {
  round: number
  rate: number
  previousRate: number
  direction: 'up' | 'down' | 'stable'
}

interface CabinSlot {
  id: string
  tier: 'first' | 'standard' | 'economy'
  costPerContainer: number
  capacity: number
  usedCapacity: number
  locked: boolean
}

interface Container {
  id: string
  orderId: string | null
  status: 'empty' | 'loaded' | 'shipped'
}

interface LedgerEntry {
  id: string
  round: number
  type: 'income' | 'cabin_fee' | 'breach_penalty' | 'overbooking_penalty'
  amount: number
  orderId: string | null
  description: string
  timestamp: number
}

interface ReportEntry {
  id: string
  round: number
  orderId: string
  steps: TraceStep[]
  finalProfit: number
  hasError: boolean
  errorTypes: ErrorType[]
}

type ErrorType = 'exchange_rate_reversal' | 'cabin_overbooking' | 'breach_penalty_missed'

interface TraceStep {
  stage: 'order_selected' | 'container_assigned' | 'rate_locked' | 'cabin_booked' | 'breach_checked' | 'settled'
  description: string
  value: number | null
}
```

### 4.2 游戏状态结构

```typescript
interface GameState {
  currentRound: number
  totalRounds: number
  phase: 'playing' | 'finished'
  orders: Order[]
  exchangeRates: ExchangeRate[]
  cabinSlots: CabinSlot[]
  containers: Container[]
  ledger: LedgerEntry[]
  reports: ReportEntry[]
  balance: number
  roundHistory: RoundSnapshot[]
}
```

## 5. 文件结构

```
src/
├── components/
│   ├── ExchangeRateBoard.tsx    # 汇率牌组件
│   ├── OrderCard.tsx            # 订单卡组件（可拖拽）
│   ├── ContainerSlot.tsx        # 货柜槽位组件（可接收拖拽）
│   ├── CabinSelector.tsx        # 舱位选择器组件
│   ├── ActionBar.tsx            # 操作按钮栏
│   ├── RoundInfo.tsx            # 回合信息栏
│   ├── LedgerTable.tsx          # 账本流水表
│   ├── BalanceChart.tsx         # 余额走势图
│   ├── ReportTable.tsx          # 经营报告追溯表
│   ├── TraceTimeline.tsx        # 链路追溯时间线
│   └── ExportButton.tsx         # 导出按钮
├── pages/
│   ├── GameBoard.tsx            # 游戏主面板页面
│   ├── LedgerPage.tsx           # 现金账本页面
│   └── ReportPage.tsx           # 经营报告页面
├── store/
│   └── gameStore.ts             # Zustand 游戏状态
├── engine/
│   ├── rateEngine.ts            # 汇率跳动引擎
│   ├── orderGenerator.ts        # 订单生成器
│   ├── settlementEngine.ts      # 结算引擎（收入、舱位费、违约金）
│   └── reportEngine.ts          # 报告生成引擎
├── data/
│   └── scenarios.ts             # 场景配置（含易错样例）
├── utils/
│   └── export.ts                # CSV/JSON 导出工具
├── App.tsx
└── main.tsx
```
