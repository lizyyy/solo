## 1. 架构设计

```mermaid
graph TB
    subgraph "前端层"
        UI["React UI<br/>侧栏/面板/导入页/报告页"]
        SCENE["3D 场景层<br/>R3F + Drei"]
        STORE["状态管理<br/>Zustand"]
    end
    subgraph "业务逻辑层"
        PARSER["数据解析器<br/>CSV/JSON/文本"]
        VALIDATOR["校验引擎<br/>缺项/异常检测"]
        COLLISION["碰撞检测<br/>重叠/遮挡/回流"]
        SOURCE["溯源管理<br/>出处标签"]
    end
    subgraph "数据层"
        LOCAL["本地存储<br/>IndexedDB"]
        MOCK["模拟数据<br/>内置示例包"]
    end
    UI --> SCENE
    UI --> STORE
    SCENE --> STORE
    STORE --> COLLISION
    STORE --> PARSER
    PARSER --> VALIDATOR
    VALIDATOR --> SOURCE
    STORE --> LOCAL
    LOCAL --> MOCK
```

## 2. 技术说明

- **前端**：React@18 + TypeScript + Tailwind CSS@3 + Vite
- **3D 渲染**：Three.js + @react-three/fiber + @react-three/drei + @react-three/postprocessing
- **状态管理**：Zustand
- **数据解析**：PapaParse（CSV）、原生 JSON.parse、自定义文本正则
- **持久化**：IndexedDB（Dexie.js）
- **导出**：html2canvas + jsPDF（报告）、原生 Blob（JSON）
- **初始化工具**：vite-init
- **后端**：无（纯前端本地工具）

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| `/` | 3D 展厅主页面 |
| `/import` | 数据导入页面 |
| `/report` | 冲突报告与导出页面 |

## 4. API 定义

无后端 API。所有数据在浏览器本地处理。

## 5. 服务器架构图

无后端服务。

## 6. 数据模型

### 6.1 数据模型定义

```mermaid
erDiagram
    EXHIBITION ||--o{ WALL : contains
    EXHIBITION ||--o{ ARTWORK : contains
    EXHIBITION ||--o{ LIGHT : contains
    EXHIBITION ||--o{ PATH : contains
    EXHIBITION ||--o{ SAFETY_ZONE : contains
    ARTWORK }o--|| SOURCE : "来源"
    LIGHT }o--|| SOURCE : "来源"
    PATH }o--|| SOURCE : "来源"
    SAFETY_ZONE }o--|| SOURCE : "来源"

    EXHIBITION {
        string id PK
        string name
        string createdAt
    }
    WALL {
        string id PK
        string exhibitionId FK
        float startX
        float startY
        float startZ
        float endX
        float endY
        float endZ
        float height
        string sourceId FK
    }
    ARTWORK {
        string id PK
        string exhibitionId FK
        string title
        float width
        float height
        float depth
        float posX
        float posY
        float posZ
        float rotY
        string wallId FK
        string sourceId FK
        string validationStatus
        int processingOrder
    }
    LIGHT {
        string id PK
        string exhibitionId FK
        string type
        float posX
        float posY
        float posZ
        float intensity
        float range
        string color
        string sourceId FK
        string validationStatus
        int processingOrder
    }
    PATH {
        string id PK
        string exhibitionId FK
        string name
        json points
        string sourceId FK
        string validationStatus
        int processingOrder
    }
    SAFETY_ZONE {
        string id PK
        string exhibitionId FK
        string artworkId FK
        float distance
        string sourceId FK
    }
    SOURCE {
        string id PK
        string type
        string label
        string detail
        string importedAt
    }
    CONFLICT {
        string id PK
        string type
        string severity
        json affectedIds
        string description
        string resolvedAt
    }
```

### 6.2 数据定义语言

```sql
-- 以下为概念模型，实际使用 IndexedDB + Dexie.js 存储

CREATE TABLE exhibition (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE wall (
  id TEXT PRIMARY KEY,
  exhibition_id TEXT NOT NULL REFERENCES exhibition(id),
  start_x REAL, start_y REAL, start_z REAL,
  end_x REAL, end_y REAL, end_z REAL,
  height REAL NOT NULL,
  source_id TEXT REFERENCES source(id)
);

CREATE TABLE artwork (
  id TEXT PRIMARY KEY,
  exhibition_id TEXT NOT NULL REFERENCES exhibition(id),
  title TEXT,
  width REAL, height REAL, depth REAL,
  pos_x REAL, pos_y REAL, pos_z REAL,
  rot_y REAL DEFAULT 0,
  wall_id TEXT REFERENCES wall(id),
  source_id TEXT REFERENCES source(id),
  validation_status TEXT DEFAULT 'normal',
  processing_order INTEGER
);

CREATE TABLE light (
  id TEXT PRIMARY KEY,
  exhibition_id TEXT NOT NULL REFERENCES exhibition(id),
  type TEXT NOT NULL,
  pos_x REAL, pos_y REAL, pos_z REAL,
  intensity REAL DEFAULT 1,
  range REAL,
  color TEXT DEFAULT '#ffffff',
  source_id TEXT REFERENCES source(id),
  validation_status TEXT DEFAULT 'normal',
  processing_order INTEGER
);

CREATE TABLE path (
  id TEXT PRIMARY KEY,
  exhibition_id TEXT NOT NULL REFERENCES exhibition(id),
  name TEXT,
  points TEXT NOT NULL,
  source_id TEXT REFERENCES source(id),
  validation_status TEXT DEFAULT 'normal',
  processing_order INTEGER
);

CREATE TABLE safety_zone (
  id TEXT PRIMARY KEY,
  exhibition_id TEXT NOT NULL REFERENCES exhibition(id),
  artwork_id TEXT NOT NULL REFERENCES artwork(id),
  distance REAL NOT NULL,
  source_id TEXT REFERENCES source(id)
);

CREATE TABLE source (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  detail TEXT,
  imported_at TEXT NOT NULL
);

CREATE TABLE conflict (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  affected_ids TEXT NOT NULL,
  description TEXT,
  resolved_at TEXT
);
```
