## 1. 架构设计

```mermaid
graph TB
    subgraph "前端层"
        A["React SPA"] --> B["Zustand 状态管理"]
        B --> C["数据持久化 (localStorage)"]
    end
    subgraph "数据层"
        D["修复记录 Store"]
        E["保险单 Store"]
        F["布展清单 Store"]
        G["操作日志 Store"]
    end
    B --> D
    B --> E
    B --> F
    B --> G
    D <-->|"证据链关联"| E
    D <-->|"灯光/布展关联"| F
    D -->|"审计追踪"| G
    E -->|"变更记录"| G
```

采用纯前端架构，使用localStorage进行数据持久化，Zustand进行状态管理。所有数据在浏览器本地运行，无需后端服务。

## 2. 技术说明

- 前端：React@18 + TypeScript + Tailwind CSS@3 + Vite
- 初始化工具：vite-init (react-ts 模板)
- 后端：无（纯前端，数据存储在 localStorage）
- 状态管理：Zustand（含持久化中间件）
- 图标库：lucide-react
- 日期处理：date-fns
- 数据导出：原生实现（JSON/CSV）

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| / | 修复记录总览页（默认首页） |
| /record/:id | 修复记录详情页，含证据链时间线 |
| /insurance | 保险单管理页 |
| /exhibition | 布展清单页 |
| /operations | 操作中心（导入/撤回/导出） |

## 4. API 定义

无后端 API。前端通过 Zustand Store 直接操作数据，所有数据模型定义如下：

### 4.1 核心数据类型

```typescript
interface RestorationRecord {
  id: string;
  artifactName: string;
  artifactId: string;
  restorer: string;
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  description: string;
  insurancePolicyId: string | null;
  exhibitionId: string | null;
  lightingRecordId: string | null;
  confirmations: Confirmation[];
  evidenceChain: EvidenceChainEntry[];
  correctionHistory: CorrectionEntry[];
  createdAt: string;
  updatedAt: string;
}

interface InsurancePolicy {
  id: string;
  policyNumber: string;
  artifactId: string;
  coverage: string;
  validFrom: string;
  validTo: string;
  status: 'active' | 'expired' | 'pending' | 'cancelled';
  changeHistory: PolicyChange[];
  linkedRecordIds: string[];
}

interface ExhibitionChecklist {
  id: string;
  exhibitionName: string;
  startDate: string;
  endDate: string;
  items: ExhibitionItem[];
}

interface ExhibitionItem {
  id: string;
  artifactId: string;
  lightingRecordId: string | null;
  position: string;
  notes: string;
  isDuplicate: boolean;
}

interface LightingRecord {
  id: string;
  artifactId: string;
  lightType: string;
  intensity: number;
  angle: number;
  notes: string;
  createdAt: string;
}

interface Confirmation {
  id: string;
  recordId: string;
  confirmedBy: string;
  confirmedAt: string;
  note: string;
  type: 'insurance_verified' | 'lighting_checked' | 'exhibition_confirmed' | 'manual_review';
}

interface EvidenceChainEntry {
  id: string;
  recordId: string;
  type: 'insurance_change' | 'confirmation' | 'lighting_update' | 'exhibition_update' | 'correction' | 'status_change';
  referenceId: string;
  referenceType: 'insurance' | 'lighting' | 'exhibition' | 'confirmation';
  description: string;
  timestamp: string;
  operator: string;
}

interface CorrectionEntry {
  id: string;
  recordId: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  reverted: boolean;
  revertedAt: string | null;
  revertedBy: string | null;
  timestamp: string;
  operator: string;
}

interface PolicyChange {
  id: string;
  policyId: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  timestamp: string;
  operator: string;
  affectedRecordIds: string[];
}

interface ImportResult {
  id: string;
  type: 'insurance' | 'record' | 'exhibition';
  totalCount: number;
  successCount: number;
  skippedCount: number;
  errorCount: number;
  conflicts: ImportConflict[];
  timestamp: string;
}

interface ImportConflict {
  localId: string;
  importedId: string;
  conflictType: 'duplicate' | 'field_mismatch';
  resolution: 'skip' | 'overwrite' | 'keep_both' | null;
  fields: string[];
}
```

## 5. 服务器架构图

不适用（纯前端架构）

## 6. 数据模型

### 6.1 数据模型定义

```mermaid
erDiagram
    "RestorationRecord" {
        string id PK
        string artifactName
        string artifactId
        string restorer
        string status
        string description
        string insurancePolicyId FK
        string exhibitionId FK
        string lightingRecordId FK
        string createdAt
        string updatedAt
    }
    "InsurancePolicy" {
        string id PK
        string policyNumber
        string artifactId
        string coverage
        string validFrom
        string validTo
        string status
    }
    "ExhibitionChecklist" {
        string id PK
        string exhibitionName
        string startDate
        string endDate
    }
    "ExhibitionItem" {
        string id PK
        string exhibitionId FK
        string artifactId
        string lightingRecordId FK
        string position
        string notes
        boolean isDuplicate
    }
    "LightingRecord" {
        string id PK
        string artifactId
        string lightType
        number intensity
        number angle
        string notes
        string createdAt
    }
    "Confirmation" {
        string id PK
        string recordId FK
        string confirmedBy
        string confirmedAt
        string note
        string type
    }
    "EvidenceChainEntry" {
        string id PK
        string recordId FK
        string type
        string referenceId
        string referenceType
        string description
        string timestamp
        string operator
    }
    "CorrectionEntry" {
        string id PK
        string recordId FK
        string field
        string oldValue
        string newValue
        string reason
        boolean reverted
        string timestamp
        string operator
    }
    "PolicyChange" {
        string id PK
        string policyId FK
        string field
        string oldValue
        string newValue
        string reason
        string timestamp
        string operator
    }

    "RestorationRecord" ||--o| "InsurancePolicy" : "关联保险单"
    "RestorationRecord" ||--o| "ExhibitionChecklist" : "关联布展清单"
    "RestorationRecord" ||--o| "LightingRecord" : "关联灯光记录"
    "RestorationRecord" ||--o{ "Confirmation" : "包含人工确认"
    "RestorationRecord" ||--o{ "EvidenceChainEntry" : "证据链"
    "RestorationRecord" ||--o{ "CorrectionEntry" : "修正历史"
    "InsurancePolicy" ||--o{ "PolicyChange" : "变更历史"
    "ExhibitionChecklist" ||--o{ "ExhibitionItem" : "布展项目"
    "ExhibitionItem" ||--o| "LightingRecord" : "灯光记录"
```

### 6.2 数据定义语言

使用 localStorage 存储，数据以 JSON 序列化形式保存。初始种子数据包含以下场景：

1. **正常保险单场景**：完整的保险单 + 灯光记录 + 布展清单
2. **缺灯光记录场景**：保险单正常但灯光记录为null，界面显示缺失警告
3. **重复策展备注场景**：同一藏品出现在多个布展清单中，isDuplicate标记为true
4. **边界情况**：保险单已过期、修复记录无关联、确认记录缺失等

```typescript
const SEED_DATA = {
  insurancePolicies: [...],
  restorationRecords: [...],
  exhibitionChecklists: [...],
  lightingRecords: [...],
};
```
