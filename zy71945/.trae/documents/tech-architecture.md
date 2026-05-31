## 1. 架构设计

```mermaid
flowchart TB
    subgraph "前端层"
        UI["React UI<br/>页面与组件"]
        Store["Zustand Store<br/>全局状态管理"]
    end
    subgraph "数据层"
        IDB["IndexedDB<br/>本地持久化存储"]
        Import["数据导入解析<br/>CSV/JSON 解析与校验"]
    end
    subgraph "业务逻辑层"
        Analysis["遮挡判断引擎<br/>自动分析+理由生成"]
        Review["复核修正引擎<br/>确认/修正/历史"]
        Brief["简报生成引擎<br/>分类+处理口径"]
        Export["导出引擎<br/>PDF/JSON/CSV"]
    end
    UI --> Store
    Store --> IDB
    Import --> IDB
    IDB --> Analysis
    IDB --> Review
    IDB --> Brief
    Review --> IDB
    Brief --> Export
```

## 2. 技术说明

- **前端**：React@18 + TypeScript + Tailwind CSS@3 + Vite
- **初始化工具**：vite-init (react-ts 模板)
- **后端**：无（纯本地应用）
- **数据库**：IndexedDB（通过 idb 库操作）
- **状态管理**：Zustand
- **路由**：react-router-dom
- **图标**：lucide-react

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| `/` | 重定向至时间线总览 |
| `/timeline` | 时间线总览页：三轨同轴展示 |
| `/import` | 数据导入页：轨道根数/遥测/窗口表导入 |
| `/analysis` | 星敏感器遮挡分析页：自动判断+理由+缺帧溯源 |
| `/review` | 复核与修正页：确认/修正/历史 |
| `/briefing` | 任务简报页：三栏分类+处理口径+导出 |

## 4. API 定义

无后端 API，所有数据操作通过 IndexedDB 本地完成。

## 5. 服务端架构

不涉及

## 6. 数据模型

### 6.1 数据模型定义

```mermaid
erDiagram
    OrbitalElements ||--o{ OcclusionEvent : "用于遮挡判断"
    TelemetrySegment ||--o{ OcclusionEvent : "触发遮挡判断"
    WindowTable ||--o{ OcclusionEvent : "窗口约束"
    OcclusionEvent ||--o{ ReviewRecord : "被复核"
    OcclusionEvent ||--o{ MissingFrameAlert : "关联缺帧"
    ReviewRecord ||--o{ ReviewHistory : "修改历史"

    OrbitalElements {
        string id PK
        number epochTime
        number semiMajorAxis
        number eccentricity
        number inclination
        number raan
        number argPerigee
        number trueAnomaly
        string source
        datetime importedAt
    }

    TelemetrySegment {
        string id PK
        number startTime
        number endTime
        string starSensorId
        string status
        string source
        datetime importedAt
    }

    WindowTable {
        string id PK
        string windowName
        number startTime
        number endTime
        string windowType
        datetime importedAt
    }

    OcclusionEvent {
        string id PK
        number startTime
        number endTime
        string reason
        string dataSource
        string confidence
        string status
        string handlingGuideline
        datetime analyzedAt
    }

    MissingFrameAlert {
        string id PK
        string occlusionEventId FK
        string source
        string description
        string nextStep
        string responsible
        datetime createdAt
    }

    ReviewRecord {
        string id PK
        string occlusionEventId FK
        string status
        string originalValue
        string correctedValue
        string reviewer
        datetime reviewedAt
    }

    ReviewHistory {
        string id PK
        string reviewRecordId FK
        string field
        string oldValue
        string newValue
        string operator
        datetime modifiedAt
    }
```

### 6.2 数据定义语言

IndexedDB 对象仓库（Object Store）定义：

- **orbital_elements**：轨道根数，索引 `epochTime`
- **telemetry_segments**：遥测片段，索引 `startTime`、`starSensorId`
- **window_tables**：窗口表，索引 `startTime`
- **occlusion_events**：遮挡事件，索引 `startTime`、`status`
- **missing_frame_alerts**：缺帧告警，索引 `occlusionEventId`、`source`
- **review_records**：复核记录，索引 `occlusionEventId`、`status`
- **review_history**：修改历史，索引 `reviewRecordId`
