## 1. 架构设计

```mermaid
graph TD
    A["UI 层 (React Pages)"] --> B["状态层 (Zustand Store)"]
    B --> C["数据层 (Mock + Utils)"]
    C --> D["统一数据源 (preReviewStore)"]
    
    A --> A1["预审面板 Page"]
    A --> A2["签证单详情 Page"]
    A --> A3["月底复核 Page"]
    
    B --> B1["筛选条件 State"]
    B --> B2["碰撞记录 State"]
    B --> B3["签证单 State"]
    B --> B4["统计数字 State (派生)"]
```

## 2. 技术描述

- 前端：React@18 + TypeScript + Vite@5 + TailwindCSS@3 + Zustand@4
- 路由：react-router-dom@6
- 图标：lucide-react
- 后端：无（纯前端 Mock 数据）
- 初始化：react-ts 模板

## 3. 路由定义

| Route | 用途 |
|-------|------|
| `/` | 预审面板（筛选 + 统计 + 明细 + 截图说明） |
| `/visa/:id` | 签证单详情（行级追踪） |
| `/review` | 月底复核（三Tab：已确认 / 待补件 / 退回） |

## 4. 数据模型

### 4.1 ER 图

```mermaid
erDiagram
    PRE_REVIEW ||--o{ COLLISION : contains
    COLLISION }o--|| VISA_LINE : references
    COLLISION ||--o{ SCREENSHOT : has
    
    PRE_REVIEW {
        string id PK
        string building
        number floor
        date reviewDate
        string status
    }
    
    COLLISION {
        string id PK
        string preReviewId FK
        string pointCode
        string description
        string status "confirmed/pending/rejected"
        boolean isDuplicate
        string duplicateReason
        string visaLineId FK
    }
    
    VISA_LINE {
        string id PK
        string visaNo
        number lineNo
        string content
        number offsetMm
        boolean causesBias
    }
    
    SCREENSHOT {
        string id PK
        string collisionId FK
        string url
        string viewpoint
        string coords
        string note
    }
```

### 4.2 TypeScript 类型定义

```typescript
type CollisionStatus = 'confirmed' | 'pending' | 'rejected';

interface Collision {
  id: string;
  preReviewId: string;
  pointCode: string;
  description: string;
  status: CollisionStatus;
  isDuplicate: boolean;
  duplicateReason?: string;
  duplicateCount?: number;
  visaLineId: string;
  screenshot: Screenshot;
}

interface VisaLine {
  id: string;
  visaNo: string;
  lineNo: number;
  content: string;
  offsetMm: number;
  causesBias: boolean;
}

interface Screenshot {
  id: string;
  url: string;
  viewpoint: string;
  coords: string;
  note: string;
}

interface PreReviewFilters {
  building?: string;
  floor?: number;
  dateFrom?: string;
  dateTo?: string;
  status?: CollisionStatus | 'all';
}
```

## 5. Store 设计

单一 `usePreReviewStore` 管理统一数据源，派生统计数字：

```typescript
const usePreReviewStore = create((set, get) => ({
  filters: { ... },
  collisions: [ ... ],
  visaLines: [ ... ],
  setFilters: (f) => set({ filters: { ...get().filters, ...f } }),
  filteredCollisions: () => get().collisions.filter(byFilters(get().filters)),
  stats: () => computeStats(get().filteredCollisions()),
  markCollision: (id, status) => set(/* 更新状态 */),
}));
```
