## 1. Architecture Design

```mermaid
graph TB
    subgraph "Frontend Layer"
        A["React Components"] --> B["State Management (Zustand)"]
        B --> C["LocalStorage Persistence"]
    end
    
    subgraph "Business Logic Layer"
        D["限额状态机引擎"] --> E["交易归集计算"]
        D --> F["白名单版本管理"]
        D --> G["风险标记引擎"]
    end
    
    subgraph "Data Layer"
        H["Mock Data Service"] --> I["限额记录数据"]
        H --> J["交易流水数据"]
        H --> K["白名单数据"]
        H --> L["导出记录数据"]
    end
    
    A --> D
    B --> D
```

## 2. Technology Description

- **Frontend**: React@18 + TypeScript + tailwindcss@3 + vite@5
- **State Management**: Zustand (轻量级状态管理，支持持久化)
- **UI 组件库**: Headless UI + Heroicons
- **图表可视化**: Recharts
- **数据持久化**: localStorage + Zustand persist middleware
- **日期处理**: date-fns
- **文件导出**: json2csv + xlsx

## 3. Route Definitions

| Route | Purpose |
|-------|---------|
| / | 限额复核列表页 |
| /detail/:id | 限额详情页 |
| /edit/:id | 限额修正页 |
| /export | 报告导出页 |

## 4. Data Model

### 4.1 Data Model Definition

```mermaid
erDiagram
    WALLET_LIMIT ||--o{ LIMIT_HISTORY : has
    WALLET_LIMIT ||--o{ TRANSACTION : has
    WALLET_LIMIT ||--o{ WHITELIST_VERSION : has
    WALLET_LIMIT ||--o{ RISK_MARK : has
    WALLET_LIMIT ||--o{ EXPORT_RECORD : has
    
    WALLET_LIMIT {
        string id PK
        string walletAccount
        number dailyLimit
        number singleLimit
        string status
        date createdAt
        date updatedAt
    }
    
    LIMIT_HISTORY {
        string id PK
        string walletLimitId FK
        number beforeDailyLimit
        number afterDailyLimit
        number beforeSingleLimit
        number afterSingleLimit
        string operator
        string remark
        date createdAt
    }
    
    TRANSACTION {
        string id PK
        string walletLimitId FK
        string transactionNo
        number amount
        string status
        date transactionTime
        boolean isDuplicate
        boolean isAbnormal
    }
    
    WHITELIST_VERSION {
        string id PK
        string walletLimitId FK
        number version
        number tempDailyLimit
        number tempSingleLimit
        date effectiveTime
        date expireTime
        string status
        string creator
    }
    
    RISK_MARK {
        string id PK
        string walletLimitId FK
        string type
        string level
        string description
        boolean isResolved
        date createdAt
    }
    
    EXPORT_RECORD {
        string id PK
        string walletLimitId FK
        string fileName
        string format
        string operator
        string contentHash
        date createdAt
    }
```

### 4.2 TypeScript Type Definitions

```typescript
// 限额状态枚举
type LimitStatus = 'pending' | 'processing' | 'approved' | 'rejected' | 'to_confirm';

// 风险等级
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// 钱包限额
interface WalletLimit {
  id: string;
  walletAccount: string;
  walletName: string;
  dailyLimit: number;
  singleLimit: number;
  usedDailyLimit: number;
  status: LimitStatus;
  riskLevel: RiskLevel;
  createdAt: string;
  updatedAt: string;
}

// 历史记录
interface LimitHistory {
  id: string;
  walletLimitId: string;
  beforeDailyLimit: number;
  afterDailyLimit: number;
  beforeSingleLimit: number;
  afterSingleLimit: number;
  operator: string;
  remark: string;
  createdAt: string;
}

// 交易记录
interface Transaction {
  id: string;
  walletLimitId: string;
  transactionNo: string;
  amount: number;
  status: 'success' | 'failed' | 'pending';
  transactionTime: string;
  isDuplicate: boolean;
  isAbnormal: boolean;
}

// 白名单版本
interface WhitelistVersion {
  id: string;
  walletLimitId: string;
  version: number;
  tempDailyLimit: number;
  tempSingleLimit: number;
  effectiveTime: string;
  expireTime: string;
  status: 'active' | 'expired' | 'pending';
  creator: string;
}

// 风险标记
interface RiskMark {
  id: string;
  walletLimitId: string;
  type: 'whitelist_expired' | 'limit_exceeded' | 'duplicate_transaction' | 'calculation_missing' | 'other';
  level: RiskLevel;
  description: string;
  isResolved: boolean;
  createdAt: string;
}

// 导出记录
interface ExportRecord {
  id: string;
  walletLimitId: string;
  fileName: string;
  format: 'csv' | 'xlsx' | 'pdf';
  operator: string;
  contentHash: string;
  createdAt: string;
}
```

## 5. Core Business Logic

### 5.1 限额状态机

```
pending → processing → approved/rejected → to_confirm
   ↓           ↓            ↓
to_confirm  to_confirm   to_confirm
```

### 5.2 风险检测规则

1. **白名单过期**: 白名单版本 expireTime < 当前时间 → 自动标记为待处理
2. **累计限额漏算**: usedDailyLimit > dailyLimit * 0.9 → 高风险标记
3. **重复交易**: 同一交易号出现多次 → 自动标记待处理
4. **异常交易**: 单笔金额 > singleLimit * 1.5 → 高风险标记
