## 1. 架构设计

```mermaid
flowchart LR
    subgraph "前端层 (React + TypeScript)"
        A["路由层 (React Router)"]
        B["组件层 (UI Components)"]
        C["状态管理 (Zustand)"]
        D["业务逻辑层 (Hooks/Services)"]
    end
    
    subgraph "核心引擎层"
        E["材料导入模块"]
        F["条款解析引擎"]
        G["档位试算引擎"]
        H["复核校验引擎"]
        I["兑付匹配模块"]
        J["证据链追踪"]
        K["更新检测模块"]
    end
    
    subgraph "数据层"
        L["本地存储 (IndexedDB)"]
        M["Mock数据服务"]
    end
    
    subgraph "工具层"
        N["Excel/CSV解析"]
        O["导出服务 (xlsx)"]
        P["差异对比 (diff)"]
        Q["数据指纹 (hash)"]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    D --> F
    D --> G
    D --> H
    D --> I
    D --> J
    D --> K
    E --> N
    E --> Q
    F --> Q
    G --> Q
    H --> Q
    I --> Q
    K --> P
    K --> Q
    E --> L
    F --> L
    G --> L
    H --> L
    I --> L
    J --> L
    D --> O
    M --> L
```

## 2. 技术描述

- **前端**：React@18 + TypeScript + Vite
- **样式**：TailwindCSS@3
- **状态管理**：Zustand（轻量级，适合本地数据管理）
- **本地数据库**：IndexedDB (Dexie.js)
- **路由**：React Router@6
- **UI组件**：原生Table组件（自定义开发，保持朴素实用风格）
- **Excel处理**：xlsx (SheetJS)
- **数据对比**：deep-object-diff
- **数据指纹**：object-hash

## 3. 核心模块设计

### 3.1 目录结构

```
src/
├── assets/          # 静态资源
├── components/    # 公共组件
│   ├── common/     # 基础组件（Button, Table, Form等）
│   └── business/ # 业务组件（材料上传、问题列表等）
├── engine/      # 核心引擎
│   ├── import.ts      # 材料导入
│   ├── parser.ts      # 条款解析
│   ├── calculator.ts  # 档位试算
│   ├── validator.ts   # 复核校验
│   ├── payout.ts     # 兑付匹配
│   ├── evidence.ts  # 证据链
│   └── deduplicate.ts # 更新检测
├── hooks/       # 自定义Hooks
├── pages/       # 页面组件
├── store/       # Zustand状态管理
├── types/       # TypeScript类型定义
├── utils/       # 工具函数
└── mock/        # Mock数据
```

### 3.2 路由定义

| 路由 | 页面 | 用途 |
|-------|------|-------|
| / | 工作台 | 批次列表、快捷操作 |
| /batch/:id | 批次详情 | 材料管理、条款解析、档位试算、复核校验、兑付方案 |
| /batch/:id/version/:versionId | 版本对比 | 同一批次多版本对比 |
| /history | 历史回看 | 所有批次筛选、查看 |

## 4. 数据模型

### 4.1 ER图

```mermaid
erDiagram
    BATCH ||--o{ MATERIAL : contains
    BATCH ||--o{ PARSED_TERM : produces
    BATCH ||--o{ CALCULATION : produces
    BATCH ||--o{ VALIDATION_ISSUE : produces
    BATCH ||--o{ PAYOUT_PLAN : produces
    BATCH ||--o{ OPERATION_LOG : has
    BATCH ||--o{ BATCH_VERSION : has
    MATERIAL ||--o{ EVIDENCE : produces
    PARSED_TERM ||--o{ EVIDENCE : produces
    CALCULATION ||--o{ EVIDENCE : produces
    VALIDATION_ISSUE ||--o{ EVIDENCE : produces
    
    BATCH {
        string id PK
        string name
        string status
        date created_at
        date updated_at
    }
    
    MATERIAL {
        string id PK
        string batch_id FK
        string type
        string filename
        json content
        string data_hash
        date imported_at
        string source
        int version
    }
    
    PARSED_TERM {
        string id PK
        string batch_id FK
        string product_code
        string underlying
        json observation_intervals
        json return_tiers
        json early_termination
        string evidence_ref
    }
    
    CALCULATION {
        string id PK
        string batch_id FK
        string tier_id
        number principal
        number calculated_return
        number payout_amount
        json calculation_steps
    }
    
    VALIDATION_ISSUE {
        string id PK
        string batch_id FK
        string severity
        string type
        string description
        string triggered_by
        string blocked_at
        string suggestion
        json evidence
    }
    
    PAYOUT_PLAN {
        string id PK
        string batch_id FK
        string name
        number total_payout
        json details
        boolean is_selected
    }
    
    OPERATION_LOG {
        string id PK
        string batch_id FK
        string action
        string operator
        json before_value
        json after_value
        date timestamp
    }
    
    BATCH_VERSION {
        string id PK
        string batch_id FK
        int version
        string change_summary
        date created_at
    }
    
    EVIDENCE {
        string id PK
        string source_type
        string source_id FK
        string material_id FK
        string location
        string value
    }
```

### 4.2 核心类型定义

```typescript
// 材料类型
type MaterialType = 'product_terms' | 'customer_position' | 'underlying_price';

interface Material {
  id: string;
  batchId: string;
  type: MaterialType;
  filename: string;
  content: Record<string, any>;
  dataHash: string;
  importedAt: Date;
  source: string;
  version: number;
}

// 条款解析结果
interface ParsedTerms {
  id: string;
  batchId: string;
  productCode: string;
  underlying: string;
  observationIntervals: ObservationInterval[];
  returnTiers: ReturnTier[];
  earlyTermination: EarlyTermination | null;
  evidenceRef: Record<string, EvidenceRef>;
}

interface ObservationInterval {
  startDate: string;
  endDate: string;
  lowerBound: number;
  upperBound: number;
  lowerInclusive: boolean;
  upperInclusive: boolean;
}

interface ReturnTier {
  id: string;
  lowerBound: number;
  upperBound: number;
  lowerInclusive: boolean;
  upperInclusive: boolean;
  returnRate: number;
}

// 复核问题
interface ValidationIssue {
  id: string;
  batchId: string;
  severity: 'error' | 'warning' | 'info';
  type: 'boundary_error' | 'tier_mismatch' | 'early_termination_missing' | 'data_missing' | 'logic_conflict';
  description: string;
  triggeredBy: string;
  blockedAt: string;
  suggestion: string;
  evidence: EvidenceRef[];
}

// 证据引用
interface EvidenceRef {
  materialId: string;
  filename: string;
  location: string;
  value: string;
}
```

## 5. 核心引擎设计

### 5.1 条款解析引擎

```typescript
// 解析产品条款，识别关键信息
function parseProductTerms(
  material: Material
): ParseResult<ParsedTerms> {
  // 1. 提取产品代码
  // 2. 识别挂钩标的
  // 3. 解析观察区间（含边界处理）
  // 4. 提取收益档位
  // 5. 识别提前终止条款
  // 6. 为每个解析结果关联证据引用
}
```

### 5.2 档位试算引擎

```typescript
// 根据标的价格匹配收益档位
function calculateReturn(
  terms: ParsedTerms,
  position: CustomerPosition,
  prices: UnderlyingPrice[]
): CalculationResult {
  // 1. 验证价格验证
  // 2. 观察区间匹配
  // 3. 档位匹配（注意边界处理）
  // 4. 收益计算
  // 5. 记录每一步证据
}
```

### 5.3 复核校验引擎

```typescript
// 检查各类错误
function validateBatch(batchId: string): ValidationIssue[] {
  // 1. 区间边界检查
  // 2. 档位匹配检查
  // 3. 提前终止检查
  // 4. 数据完整性检查
  // 5. 逻辑一致性检查
}
```

### 5.4 材料更新检测

```typescript
// 检测材料是否重复或更新
function detectMaterialUpdate(
  newMaterial: Material,
  existingMaterials: Material[]
): UpdateDetectionResult {
  // 1. 计算数据指纹
  // 2. 对比现有材料
  // 3. 生成差异报告
  // 4. 标注更新/重复
}
```

## 6. 状态管理设计

```typescript
// Zustand Store
interface BatchStore {
  batches: Batch[];
  currentBatch: Batch | null;
  materials: Material[];
  parsedTerms: ParsedTerms | null;
  calculations: Calculation[];
  validationIssues: ValidationIssue[];
  operations: OperationLog[];
  
  // Actions...
}
```

## 7. 导出服务

支持导出：
- Excel格式复核报告
- CSV格式计算明细
- PDF格式问题清单
