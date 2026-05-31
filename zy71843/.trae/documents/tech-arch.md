## 1. 架构设计

```mermaid
flowchart TD
    "前端 React SPA" --> "状态管理 Zustand"
    "状态管理 Zustand" --> "本地存储 LocalStorage"
    "前端 React SPA" --> "导出模块 CSV/PDF"
    "前端 React SPA" --> "一致性校验引擎"
```

纯前端架构，无后端服务。数据持久化到 LocalStorage，导出功能在浏览器端完成。

## 2. 技术说明

- 前端：React@18 + TypeScript + Tailwind CSS@3 + Vite
- 初始化工具：vite-init
- 状态管理：Zustand（含 persist 中间件持久化到 LocalStorage）
- 后端：无
- 数据库：无（LocalStorage 持久化）

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| / | 项目总览页，项目列表和全局状态 |
| /project/:id | 灯位校准详情页，灯位表格+变更历史+异常解释 |
| /project/:id/export | 巡检单导出页，复核+一致性校验+导出 |

## 4. API定义

不适用，纯前端应用。

## 5. 服务端架构

不适用，纯前端应用。

## 6. 数据模型

### 6.1 数据模型定义

```mermaid
erDiagram
    "Project" ||--o{ "LightPosition" : "contains"
    "LightPosition" ||--o{ "ChangeRecord" : "has"
    "LightPosition" ||--o{ "AnomalyNote" : "may_have"
    "Project" {
        "string id PK"
        "string name"
        "number totalPositions"
        "number calibratedCount"
        "number pendingCount"
        "number anomalyCount"
        "string lastModified"
    }
    "LightPosition" {
        "string id PK"
        "string projectId FK"
        "string code"
        "string location"
        "string status"
        "string source"
        "string currentValue"
        "string originalValue"
        "string lastModified"
    }
    "ChangeRecord" {
        "string id PK"
        "string positionId FK"
        "string type"
        "string previousValue"
        "string newValue"
        "string reason"
        "string timestamp"
    }
    "AnomalyNote" {
        "string id PK"
        "string positionId FK"
        "string category"
        "string description"
        "string suggestion"
        "boolean resolved"
    }
```

### 6.2 数据定义语言

使用 TypeScript 接口定义：

```typescript
type PositionStatus = 'calibrated' | 'pending_material' | 'conclusion_changed' | 'anomaly'
type ChangeType = 'material_supplement' | 'conclusion_change' | 'cad_manual_edit'
type SourceType = 'route' | 'equipment_note' | 'cad_manual'

interface Project {
  id: string
  name: string
  totalPositions: number
  calibratedCount: number
  pendingCount: number
  anomalyCount: number
  lastModified: string
}

interface LightPosition {
  id: string
  projectId: string
  code: string
  location: string
  status: PositionStatus
  source: SourceType
  currentValue: string
  originalValue: string
  routeOrder?: number
  isDuplicate?: boolean
  lastModified: string
}

interface ChangeRecord {
  id: string
  positionId: string
  type: ChangeType
  previousValue: string
  newValue: string
  reason: string
  timestamp: string
}

interface AnomalyNote {
  id: string
  positionId: string
  category: 'route_early' | 'note_late' | 'cad_conflict' | 'duplicate'
  description: string
  suggestion: string
  resolved: boolean
}

interface InspectionCheckItem {
  id: string
  projectId: string
  label: string
  passed: boolean
  detail: string
}

interface ConsistencyIssue {
  id: string
  projectId: string
  positionId: string
  inspectionValue: string
  detailValue: string
  field: string
}
```
