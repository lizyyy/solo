## 1. 架构设计
```mermaid
flowchart LR
    A["前端 React + Vite"] --> B["Mock 数据层 (本地 JSON)"]
    A --> C["UI 渲染层 (Tailwind)"]
    A --> D["交互层 (状态管理 useState)"]
    B --> D
    D --> C
```

## 2. 技术描述
- 前端：React@18 + TypeScript + Vite
- 样式：TailwindCSS@3
- 图表：原生 SVG 绘制时序图（轻量、可控、无额外依赖）
- 状态管理：React useState / useReducer（单页工具，无需 Redux）
- 数据：本地 Mock JSON，模拟船上记录本、采样时序、异常、撤回、漂移
- 后端：无（纯前端交班工具）

## 3. 路由定义
| 路由 | 用途 |
|------|------|
| / | 主界面（含汇总 + 时序回放 + 追溯链路） |
| /report | 项目经理进展交代视图 |

## 4. 数据模型
```mermaid
erDiagram
    STATION["采样站位"] {
        string id PK
        string name
        number lat
        number lon
    }
    SAMPLE["采样记录"] {
        string id PK
        string stationId FK
        string timestamp
        number temperature
        number salinity
        number dissolvedOxygen
        string status "processed/pending/blocked"
        boolean isWithdrawn
        string withdrawReason
    }
    ANOMALY["异常记录"] {
        string id PK
        string sampleId FK
        string type "threshold/drift/other"
        string description
        string sourceLine FK
        string evidenceStatus "none/partial/complete"
    }
    DRIFT["传感器漂移事件"] {
        string id PK
        string sensorType
        string startTimestamp
        string endTimestamp
        string affectedStationIds
        string sourceLine FK
        string rootCause
    }
    LOGBOOK["船上记录本"] {
        string id PK
        string page
        number lineNumber
        string content
        string recorder
        string timestamp
        string recordType "normal/withdraw/note"
    }
```

### 数据说明
- STATION：深海采样站位的空间位置
- SAMPLE：单条时序采样记录（带状态、是否撤回）
- ANOMALY：异常标记，关联采样记录与记录本来源行
- DRIFT：传感器漂移事件，含影响范围和来源行
- LOGBOOK：船上记录本原始条目（含撤回记录专门标记）

## 5. 接口定义（前端导出数据结构，用于沟通/交班）

```typescript
interface HandoverReport {
  generatedAt: string;
  shift: string;
  summary: {
    processed: number;
    pendingEvidence: number;
    blocked: number;
    anomalies: number;
    withdrawn: number;
    driftEvents: number;
  };
  blockedItems: Array<{
    id: string;
    station: string;
    timestamp: string;
    description: string;
    blocker: string;
    logbookSource: { page: string; line: number; content: string };
  }>;
  pendingItems: Array<{
    id: string;
    station: string;
    description: string;
    missingEvidence: string[];
    logbookSource: { page: string; line: number; content: string };
  }>;
}
```
