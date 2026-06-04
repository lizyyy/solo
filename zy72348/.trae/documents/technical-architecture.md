## 1. 架构设计

```mermaid
flowchart TB
    subgraph Frontend["前端层"]
        A["React 18 + TypeScript"]
        B["Zustand 状态管理"]
        C["Tailwind CSS"]
        D["Recharts 图表"]
    end
    subgraph DataLayer["数据层"]
        E["本地存储引擎"]
        F["自检引擎"]
        G["冲突检测引擎"]
        H["鲁棒中位数计算引擎"]
    end
    subgraph Workflow["工作流层"]
        I["三步工作流状态机"]
        J["证据链记录器"]
        K["导出器"]
    end
    A --> B
    B --> E
    B --> F
    B --> G
    B --> H
    B --> I
    I --> J
    J --> K
```

## 2. 技术说明

- 前端：React@18 + Tailwind CSS@3 + Vite + TypeScript
- 初始化工具：vite-init
- 后端：无（纯前端，数据存储在 localStorage）
- 数据库：无（使用 localStorage + 内存状态，mock 数据）
- 图表：Recharts
- 图标：lucide-react
- 日期处理：date-fns

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| / | 报警总览页，展示鲁棒中位数报警结果与待处理冲突 |
| /import | 数据导入与自检页，导入材料并执行自检 |
| /conflicts | 冲突裁定页，查看冲突证据并确认/驳回 |
| /workflow | 工作流追踪页，追踪三步工作流状态 |
| /history | 历史记录页，查看完整操作证据链 |

## 4. API 定义

不适用（纯前端项目，无后端 API）

## 5. 服务器架构图

不适用（纯前端项目）

## 6. 数据模型

### 6.1 数据模型定义

```mermaid
erDiagram
    ImportBatch ||--o{ Annotation : contains
    ImportBatch ||--o{ SampleRecord : contains
    ImportBatch {
        string id PK
        string materialType
        datetime importTime
        string operator
        string status
    }
    Annotation {
        string id PK
        string batchId FK
        string subject
        string teacherId
        number score
        string denominator
        string rawDenominator
        string source
    }
    SampleRecord {
        string id PK
        string batchId FK
        string subject
        number medianValue
        number threshold
        number sampleSize
        string source
    }
    ConflictItem ||--o| ConflictEvidence : has
    ConflictItem {
        string id PK
        string annotationId FK
        string sampleId FK
        string conflictType
        string status
        string resolution
        string resolvedBy
        datetime resolvedAt
    }
    ConflictEvidence {
        string id PK
        string conflictId FK
        string annotationValue
        string sampleValue
        string annotationSource
        string sampleSource
    }
    WorkflowStep {
        string id PK
        string batchId FK
        number stepIndex
        string stepName
        string status
        datetime startedAt
        datetime completedAt
        string operator
        string snapshot
    }
    AuditLog {
        string id PK
        string batchId FK
        string action
        string actor
        string detail
        datetime timestamp
    }
    SelfCheckResult {
        string id PK
        string batchId FK
        string checkType
        boolean passed
        string detail
        datetime checkedAt
    }
```

### 6.2 数据定义语言

本项目为纯前端，数据存储于 localStorage，以下为 TypeScript 类型定义：

```typescript
interface ImportBatch {
  id: string;
  materialType: 'normal' | 'wrong_caliber' | 'supplement';
  importTime: string;
  operator: string;
  status: 'pending' | 'checking' | 'checked' | 'conflicted' | 'resolved';
}

interface Annotation {
  id: string;
  batchId: string;
  subject: string;
  teacherId: string;
  score: number;
  denominator: string;
  rawDenominator: string;
  source: string;
}

interface SampleRecord {
  id: string;
  batchId: string;
  subject: string;
  medianValue: number;
  threshold: number;
  sampleSize: number;
  source: string;
}

interface ConflictItem {
  id: string;
  annotationId: string;
  sampleId: string;
  conflictType: 'score_mismatch' | 'denominator_zero_empty' | 'median_deviation' | 'duplicate';
  status: 'pending' | 'confirmed' | 'rejected' | 'needs_review';
  resolution: string;
  resolvedBy: string;
  resolvedAt: string;
}

interface ConflictEvidence {
  id: string;
  conflictId: string;
  annotationValue: string;
  sampleValue: string;
  annotationSource: string;
  sampleSource: string;
}

interface WorkflowStep {
  id: string;
  batchId: string;
  stepIndex: 1 | 2 | 3;
  stepName: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'completed';
  startedAt: string;
  completedAt: string;
  operator: string;
  snapshot: string;
}

interface AuditLog {
  id: string;
  batchId: string;
  action: string;
  actor: string;
  detail: string;
  timestamp: string;
}

interface SelfCheckResult {
  id: string;
  batchId: string;
  checkType: 'duplicate_import' | 'denominator_zero_empty' | 'recalc_after_supplement' | 'export_consistency';
  passed: boolean;
  detail: string;
  checkedAt: string;
}
```
