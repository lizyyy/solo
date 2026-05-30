## 1. 架构设计

```mermaid
flowchart TD
    "浏览器" --> "React前端"
    "React前端" --> "Zustand状态管理"
    "Zustand状态管理" --> "游戏引擎模块"
    "游戏引擎模块" --> "AI竞价逻辑"
    "游戏引擎模块" --> "冲突检测器"
    "游戏引擎模块" --> "异常事件追踪器"
    "异常事件追踪器" --> "报告生成器"
    "报告生成器" --> "JSON导出"
```

纯前端架构，无需后端服务。所有游戏逻辑、AI对手行为、冲突检测和报告生成均在浏览器端完成。

## 2. 技术说明

- 前端：React@18 + TypeScript + Tailwind CSS@3 + Vite
- 初始化工具：vite-init (react-ts 模板)
- 状态管理：Zustand
- 后端：无
- 数据库：无，使用内存数据 + 预置样例

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| / | 拍卖主界面（含游戏控制、竞价面板、出价历史） |
| /review | 复盘面板（回合回顾、冲突留痕、异常事件） |

## 4. API定义

不适用（纯前端项目）

## 5. 服务器架构

不适用（纯前端项目）

## 6. 数据模型

### 6.1 数据模型定义

```mermaid
erDiagram
    "GameSession" ||--o{ "AuctionRound" : "contains"
    "AuctionRound" ||--|| "Artwork" : "features"
    "AuctionRound" ||--o{ "BidRecord" : "records"
    "AuctionRound" ||--o{ "ConflictLog" : "tracks"
    "AuctionRound" ||--o{ "AnomalyEvent" : "detects"
    "Artwork" ||--|| "Valuation" : "has"
    "Artwork" ||--o{ "CollectorProfile" : "attracts"

    "GameSession" {
        string "id PK"
        number "totalBudget"
        number "remainingBudget"
        string "status"
        number "currentRoundIndex"
    }

    "AuctionRound" {
        string "id PK"
        string "gameSessionId FK"
        number "roundIndex"
        string "status"
        number "finalPrice"
        string "winner"
        number "reservePrice"
    }

    "Artwork" {
        string "id PK"
        string "name"
        string "description"
        string "imageUrl"
        string "category"
    }

    "Valuation" {
        string "id PK"
        string "artworkId FK"
        number "lowEstimate"
        number "highEstimate"
        string "source"
        number "confidence"
    }

    "CollectorProfile" {
        string "id PK"
        string "name"
        string "preferenceType"
        number "aggressiveness"
        number "maxBudget"
        string "favoriteCategory"
    }

    "BidRecord" {
        string "id PK"
        string "roundId FK"
        string "bidder"
        number "amount"
        number "timestamp"
        boolean "isImpulsive"
    }

    "ConflictLog" {
        string "id PK"
        string "roundId FK"
        string "conflictType"
        string "description"
        string "resolution"
    }

    "AnomalyEvent" {
        string "id PK"
        string "roundId FK"
        string "anomalyType"
        string "description"
        number "severity"
        string "context"
    }
```

### 6.2 数据定义语言

不适用（使用TypeScript接口定义，无数据库）

#### 核心TypeScript接口

```typescript
interface Artwork {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
}

interface Valuation {
  lowEstimate: number;
  highEstimate: number;
  source: string;
  confidence: number;
}

interface CollectorProfile {
  id: string;
  name: string;
  preferenceType: 'aggressive' | 'conservative' | 'selective' | 'opportunistic';
  aggressiveness: number;
  maxBudget: number;
  favoriteCategory: string;
}

interface BidRecord {
  bidder: string;
  amount: number;
  timestamp: number;
  isImpulsive: boolean;
}

interface ConflictLog {
  conflictType: 'estimate_vs_description' | 'collector_vs_estimate' | 'collector_vs_description';
  description: string;
  resolution: 'deferred' | 'player_judgment';
}

interface AnomalyEvent {
  anomalyType: 'impulsive_bid' | 'reserve_misjudgment' | 'budget_overrun';
  description: string;
  severity: number;
  context: string;
}
```
