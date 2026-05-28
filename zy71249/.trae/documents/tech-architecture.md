## 1. 架构设计

```mermaid
flowchart TD
    "React前端" --> "Zustand状态管理"
    "Zustand状态管理" --> "游戏引擎(GameEngine)"
    "游戏引擎" --> "事件系统(EventSystem)"
    "游戏引擎" --> "结算系统(SettlementSystem)"
    "游戏引擎" --> "报告系统(ReportSystem)"
    "事件系统" --> "港口拥堵事件"
    "事件系统" --> "汇率变化事件"
    "事件系统" --> "供应商断供事件"
    "结算系统" --> "库存账本"
    "结算系统" --> "现金流水"
    "结算系统" --> "订单违约检查"
    "报告系统" --> "经营报告生成"
    "报告系统" --> "材料去重"
    "报告系统" --> "导出(JSON/CSV)"
    "Zustand状态管理" --> "回放记录(ReplayStore)"
    "回放记录" --> "LocalStorage持久化"
```

## 2. 技术说明

- 前端：React@18 + TypeScript + Tailwind CSS@3 + Vite
- 初始化工具：vite-init
- 后端：无（纯前端，数据持久化至LocalStorage）
- 数据库：无，使用LocalStorage + 内存状态

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| / | 游戏首页/开始界面 |
| /game | 游戏主界面（回合制操作） |
| /report | 经营报告页面（含导出） |
| /replay | 回放记录列表 |
| /replay/:id | 具体游戏的回合回放 |

## 4. API定义

无后端API，所有数据通过Zustand store在内存中管理，通过LocalStorage持久化。

## 5. 服务器架构图

不适用（纯前端项目）

## 6. 数据模型

### 6.1 数据模型定义

```mermaid
erDiagram
    "GameSession" ||--o{ "Round" : "contains"
    "Round" ||--o{ "GameEvent" : "triggers"
    "Round" ||--o{ "PlayerAction" : "records"
    "GameSession" ||--|| "Supplier" : "selects"
    "GameSession" ||--o{ "InventoryItem" : "tracks"
    "GameSession" ||--o{ "CashTransaction" : "settles"
    "GameSession" ||--o{ "CustomerOrder" : "fulfills"
    "GameSession" ||--|| "BusinessReport" : "generates"
    "BusinessReport" ||--o{ "RiskRecord" : "tracks"
    "InventoryItem" ||--|| "Material" : "references"
    "Material" {
        "string id PK" : "物料编号"
        "string name" : "物料名称"
        "number safetyStock" : "安全库存"
        "number unitCost" : "单位成本"
        "string currency" : "采购币种"
    }
    "Supplier" {
        "string id PK" : "供应商编号"
        "string name" : "供应商名称"
        "number reliability" : "可靠性0-100"
        "number leadTime" : "交货周期(回合)"
        "number unitPrice" : "单价"
        "boolean isActive" : "是否活跃"
    }
    "GameEvent" {
        "string id PK" : "事件编号"
        "string type" : "PORT_CONGESTION|EXCHANGE_RATE|SUPPLIER_DISRUPTION"
        "string description" : "事件描述"
        "number impact" : "影响值"
        "number round" : "发生回合"
    }
    "RiskRecord" {
        "string id PK" : "记录编号"
        "string type" : "DISRUPTION|BACKLOG|FX_LOSS"
        "string materialId FK" : "关联物料"
        "number amount" : "影响金额"
        "string description" : "描述"
        "number round" : "发生回合"
    }
    "CashTransaction" {
        "string id PK" : "流水编号"
        "string type" : "INCOME|EXPENSE|FX_LOSS|PENALTY"
        "number amount" : "金额"
        "string description" : "描述"
        "number round" : "回合"
    }
```

### 6.2 数据定义语言

```typescript
interface Material {
  id: string
  name: string
  safetyStock: number
  unitCost: number
  currency: 'CNY' | 'USD' | 'EUR'
}

interface Supplier {
  id: string
  name: string
  reliability: number
  leadTime: number
  unitPrice: number
  currency: 'CNY' | 'USD' | 'EUR'
  isActive: boolean
  disruptionRound: number | null
}

interface InventoryItem {
  materialId: string
  quantity: number
  transactions: InventoryTransaction[]
}

interface InventoryTransaction {
  round: number
  type: 'IN' | 'OUT'
  quantity: number
  source: string
  materialId: string
}

interface GameEvent {
  id: string
  type: 'PORT_CONGESTION' | 'EXCHANGE_RATE' | 'SUPPLIER_DISRUPTION'
  description: string
  impact: number
  round: number
}

interface RiskRecord {
  id: string
  type: 'DISRUPTION' | 'BACKLOG' | 'FX_LOSS'
  materialId: string
  amount: number
  description: string
  round: number
}

interface CashTransaction {
  id: string
  type: 'INCOME' | 'EXPENSE' | 'FX_LOSS' | 'PENALTY'
  amount: number
  description: string
  round: number
}

interface CustomerOrder {
  id: string
  materialId: string
  quantity: number
  deadline: number
  unitPrice: number
  isDelivered: boolean
  penaltyAmount: number
}

interface BusinessReport {
  sessionId: string
  totalRevenue: number
  totalExpense: number
  totalFxLoss: number
  totalPenalty: number
  netProfit: number
  riskRecords: RiskRecord[]
  materialIds: string[]
}

interface GameSession {
  id: string
  currentRound: number
  maxRounds: number
  cash: number
  exchangeRate: { USD_CNY: number; EUR_CNY: number }
  materials: Material[]
  suppliers: Supplier[]
  inventory: InventoryItem[]
  events: GameEvent[]
  riskRecords: RiskRecord[]
  cashTransactions: CashTransaction[]
  orders: CustomerOrder[]
  selectedSupplierId: string
  isFinished: boolean
  report: BusinessReport | null
}

interface ReplayRecord {
  sessionId: string
  date: string
  finalScore: number
  rounds: RoundSnapshot[]
}

interface RoundSnapshot {
  round: number
  events: GameEvent[]
  actions: string[]
  cashAfterRound: number
  inventoryAfterRound: Record<string, number>
}
```
