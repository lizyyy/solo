## 1. 架构设计

```mermaid
flowchart TB
    subgraph "前端层"
        A["React 18 + TypeScript"]
        B["TailwindCSS"]
        C["Zustand 状态管理"]
        D["React Router DOM"]
    end
    subgraph "数据层"
        E["Mock 数据（前端内置）"]
        F["Zustand Store 持久化"]
    end
    A --> C
    A --> D
    A --> B
    C --> F
    F --> E
```

## 2. 技术说明

- 前端：React@18 + TailwindCSS@3 + Vite + TypeScript
- 初始化工具：vite-init
- 后端：无（纯前端，Mock 数据）
- 数据库：无（前端 Zustand 持久化 + Mock 数据）

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| / | 试算总览页：三步流程进度 + 结果卡片列表 + 冲突横幅 |
| /import | 数据导入页：节假日顺延说明导入 + 尾差调整条补录 |
| /conflict | 冲突裁决页：双源证据对比 + 确认/驳回操作 |
| /audit | 审核追踪页：变更时间线 |
| /summary | 负责人摘要页：摘要卡片 + 历史记录表 |

## 4. API 定义

无后端 API，使用前端 Mock 数据和 Zustand Store 管理状态。

## 5. 服务端架构图

不适用。

## 6. 数据模型

### 6.1 数据模型定义

```mermaid
erDiagram
    "试算记录" {
        string id PK
        string name
        number amount
        string status "正常 | 已冲正 | 尾差补录 | 待风控复核"
        string remark
        string source "顺延说明 | 尾差调整条"
        string caliber "新口径 | 旧口径"
        datetime createdAt
        datetime updatedAt
    }
    "冲突记录" {
        string id PK
        string recordId FK
        string holidayEvidence "节假日顺延说明侧证据"
        string adjustmentEvidence "尾差调整条侧证据"
        string conflictField
        string resolution "待裁决 | 已确认 | 已驳回"
        string resolvedBy
        datetime resolvedAt
        string resolveReason
    }
    "审核记录" {
        string id PK
        string recordId FK
        string operator
        string action "导入 | 补录 | 确认冲突 | 驳回冲突 | 风控复核"
        string detail
        string reason
        string impactResult
        datetime operatedAt
    }
    "风控复核" {
        string id PK
        string recordId FK
        string reviewer
        string opinion "通过 | 驳回 | 待补充"
        string comment
        datetime reviewedAt
    }
    "试算记录" ||--o{ "冲突记录" : has
    "试算记录" ||--o{ "审核记录" : has
    "试算记录" ||--o{ "风控复核" : has
```

### 6.2 数据定义语言

前端 TypeScript 类型定义，存储于 `src/types/index.ts`：

```typescript
type RecordStatus = '正常' | '已冲正' | '尾差补录' | '待风控复核'
type RecordSource = '顺延说明' | '尾差调整条'
type CaliberType = '新口径' | '旧口径'
type ConflictResolution = '待裁决' | '已确认' | '已驳回'
type AuditAction = '导入' | '补录' | '确认冲突' | '驳回冲突' | '风控复核'
type RiskOpinion = '通过' | '驳回' | '待补充'
type WorkflowStep = 1 | 2 | 3

interface TrialRecord { id: string; name: string; amount: number; status: RecordStatus; remark: string; source: RecordSource; caliber: CaliberType; createdAt: string; updatedAt: string }
interface ConflictRecord { id: string; recordId: string; holidayEvidence: string; adjustmentEvidence: string; conflictField: string; resolution: ConflictResolution; resolvedBy: string; resolvedAt: string; resolveReason: string }
interface AuditRecord { id: string; recordId: string; operator: string; action: AuditAction; detail: string; reason: string; impactResult: string; operatedAt: string }
interface RiskReview { id: string; recordId: string; reviewer: string; opinion: RiskOpinion; comment: string; reviewedAt: string }
```

### 6.3 初始 Mock 数据

三条样例记录：
1. 顺利记录：金额 1250000，来源顺延说明，状态正常，新口径
2. 已冲正记录：金额 0，来源顺延说明，状态待风控复核，备注「已冲正」，新口径
3. 尾差补录记录：金额 3500，来源尾差调整条，状态尾差补录，旧口径
