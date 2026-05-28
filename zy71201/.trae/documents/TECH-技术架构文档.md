## 1. 架构设计

```mermaid
graph TB
    subgraph "前端层"
        A["React SPA (Vite)"]
        B["状态管理 (Zustand)"]
        C["路由 (React Router)"]
        D["图表 (Recharts)"]
        E["UI组件 (Tailwind CSS)"]
    end
    
    subgraph "数据持久化层"
        F["LocalStorage (状态保存)"]
        G["IndexedDB (版本历史)"]
        H["Mock Data Service"]
    end
    
    subgraph "核心业务层"
        I["净值归集模块"]
        J["预警状态机"]
        K["话术分层引擎"]
        L["版本追踪服务"]
        M["周报导出器"]
    end
    
    A --> B
    A --> C
    A --> D
    A --> E
    B --> I
    B --> J
    B --> K
    B --> L
    B --> M
    I --> F
    J --> F
    L --> G
    M --> H
```

## 2. 技术描述

- **前端框架**: React@18 + TypeScript
- **构建工具**: Vite@5
- **样式方案**: TailwindCSS@3 + PostCSS
- **状态管理**: Zustand (轻量级、支持持久化)
- **路由**: React Router@6
- **图表**: Recharts
- **数据持久化**: 
  - localStorage (页面状态、筛选条件、草稿)
  - IndexedDB (版本历史、大量数据存储)
- **导出**: xlsx (Excel导出) + jspdf (PDF导出)
- **日期处理**: date-fns

## 3. 路由定义

| 路由 | 页面 | 功能 |
|------|------|------|
| / | 预警列表页 | 产品列表、筛选、搜索、概览统计 |
| /product/:id | 详情编辑页 | 产品详情、净值走势、话术编辑、备注 |
| /product/:id/history | 历史记录页 | 版本列表、版本对比、操作日志 |
| /import | 数据导入页 | 多源数据导入、预览校验 |
| /export | 周报导出页 | 周报生成、模板选择、批量导出 |

## 4. 数据模型

### 4.1 数据模型定义

```mermaid
erDiagram
    PRODUCT ||--o{ NET_VALUE : has
    PRODUCT ||--o{ VALUATION : has
    PRODUCT ||--o{ REDEMPTION : has
    PRODUCT ||--o{ WARNING_LINE : has
    PRODUCT ||--o{ CUSTOMER_NOTE : has
    PRODUCT ||--o{ VERSION_HISTORY : has
    
    PRODUCT {
        string id PK
        string name
        string code
        string manager
        date establish_date
        number scale
        string status
    }
    
    NET_VALUE {
        string id PK
        string product_id FK
        date value_date
        number net_value
        number accumulated_value
        number drawdown_rate
        string source
        datetime created_at
    }
    
    VALUATION {
        string id PK
        string product_id FK
        date valuation_date
        string holding_name
        number holding_ratio
        number market_value
        string source
        datetime created_at
    }
    
    REDEMPTION {
        string id PK
        string product_id FK
        date effective_date
        string status
        string restriction_type
        string description
        string source
        datetime created_at
    }
    
    WARNING_LINE {
        string id PK
        string product_id FK
        date effective_date
        number warning_line
        number stop_loss_line
        string source
        datetime created_at
    }
    
    CUSTOMER_NOTE {
        string id PK
        string product_id FK
        string content
        string script_type
        string created_by
        datetime created_at
        datetime updated_at
    }
    
    VERSION_HISTORY {
        string id PK
        string product_id FK
        string version_number
        string operation_type
        string operator
        string before_data
        string after_data
        string diff_summary
        datetime created_at
    }
```

### 4.2 核心TypeScript类型定义

```typescript
// 产品基础信息
interface Product {
  id: string;
  name: string;
  code: string;
  manager: string;
  establishDate: string;
  scale: number;
  status: 'normal' | 'warning' | 'stop_loss';
  latestNetValue: number;
  latestDrawdownRate: number;
  warningLine: number;
  stopLossLine: number;
  anomalies: Anomaly[];
}

// 异常类型
type AnomalyType = 'date_mismatch' | 'warning_line_changed' | 'redemption_suspended';

interface Anomaly {
  type: AnomalyType;
  description: string;
  level: 'high' | 'medium' | 'low';
  detectedAt: string;
}

// 净值数据
interface NetValue {
  id: string;
  productId: string;
  valueDate: string;
  netValue: number;
  accumulatedValue: number;
  drawdownRate: number;
  source: string;
}

// 话术类型
type ScriptType = 'normal' | 'warning' | 'special';

interface CustomerScript {
  productId: string;
  type: ScriptType;
  title: string;
  content: string;
  lastModified: string;
  modifiedBy: string;
}

// 版本历史
interface VersionRecord {
  id: string;
  productId: string;
  versionNumber: string;
  operationType: 'create' | 'update' | 'import' | 'export';
  operator: string;
  beforeData: Record<string, unknown>;
  afterData: Record<string, unknown>;
  diffSummary: string;
  createdAt: string;
}
```

## 5. 核心模块设计

### 5.1 预警状态机

```typescript
type WarningState = 'normal' | 'monitoring' | 'warning' | 'critical' | 'resolved';

interface WarningStateMachine {
  currentState: WarningState;
  transition(event: WarningEvent): void;
  getStateDescription(): string;
}
```

### 5.2 话术分层引擎

```typescript
interface ScriptEngine {
  generateScript(product: Product, type: ScriptType): string;
  validateScript(script: string, product: Product): ValidationResult;
  getTemplate(type: ScriptType, anomalyType?: AnomalyType): ScriptTemplate;
}
```

### 5.3 版本追踪服务

```typescript
interface VersionTracker {
  recordVersion(productId: string, operation: OperationData): string;
  getHistory(productId: string): VersionRecord[];
  compareVersions(versionId1: string, versionId2: string): DiffResult;
  rollback(versionId: string): boolean;
}
```

## 6. 状态持久化策略

| 数据类型 | 存储方式 | 过期策略 |
|----------|----------|----------|
| 列表筛选条件 | localStorage | 永不过期 |
| 编辑草稿 | localStorage | 7天自动清理 |
| 分页位置 | localStorage | 会话级 |
| 版本历史 | IndexedDB | 永不过期 |
| 导出记录 | IndexedDB | 30天自动清理 |
| 产品主数据 | IndexedDB | 永不过期 |
