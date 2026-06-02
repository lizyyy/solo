## 1. 架构设计

```mermaid
graph TB
    subgraph "前端应用 (React SPA)"
        A["页面组件层"] --> B["业务逻辑层"]
        B --> C["数据存储层"]
    end
    
    subgraph "数据来源"
        D["GIS点位文件<br/>(CSV/GeoJSON)"]
        E["居民反馈数据"]
        F["巡检照片"]
        G["街道手改备注"]
    end
    
    subgraph "本地存储"
        H["localStorage<br/>(点位数据、人工决策、标注)"]
    end
    
    subgraph "核心算法"
        I["地址相似度匹配<br/>(Levenshtein + 地理位置)"]
        J["智能归并引擎"]
    end
    
    D --> A
    E --> A
    F --> A
    G --> A
    B --> I
    B --> J
    C --> H
```

## 2. 技术描述
- 前端框架：React@18 + TypeScript + Vite
- 样式方案：TailwindCSS@3
- 地图组件：Leaflet + react-leaflet
- 状态管理：React Context + useReducer
- 数据持久化：localStorage
- 文件处理：papaparse (CSV解析)
- 图表展示：recharts

## 3. 路由定义
| 路由 | 页面组件 | 功能 |
|------|----------|------|
| / | DataImportPage | 数据导入页面，GIS点位上传、样例数据加载 |
| /merge | PointMergePage | 点位归并页面，智能归并、冲突处理 |
| /review | ManualReviewPage | 人工复核页面，待确认清单、判断留痕 |
| /export | PublicExportPage | 公示导出页面，地图展示、清单导出 |

## 4. 核心数据模型

### 4.1 数据模型定义

```mermaid
erDiagram
    MEAL_POINT {
        string id PK "点位ID"
        string name "点位名称"
        string address "地址"
        float lat "纬度"
        float lng "经度"
        string source "数据来源: GIS/反馈/巡检/街道"
        string status "状态: pending/merged/confirmed/rejected"
        string type "类型: 顺利/待确认/旧口径/边界"
        string[] mergeHistory "归并历史ID列表"
        string notes "人工备注"
        object auditTrail "审核轨迹"
        Date createdAt "创建时间"
        Date updatedAt "更新时间"
    }
    
    MERGE_SUGGESTION {
        string id PK "建议ID"
        string pointId1 FK "点位1 ID"
        string pointId2 FK "点位2 ID"
        float similarityScore "相似度分数"
        string reason "归并理由"
        string status "状态: pending/approved/rejected"
        Date suggestedAt "建议时间"
    }
    
    AUDIT_RECORD {
        string id PK "记录ID"
        string pointId FK "点位ID"
        string action "操作类型"
        string operator "操作人"
        string remark "操作备注"
        Date timestamp "操作时间"
    }
    
    MEAL_POINT ||--o{ MERGE_SUGGESTION : "产生归并建议"
    MEAL_POINT ||--o{ AUDIT_RECORD : "产生审核记录"
```

### 4.2 TypeScript 类型定义

```typescript
interface MealPoint {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  source: 'GIS' | 'feedback' | 'inspection' | 'street';
  status: 'pending' | 'merged' | 'confirmed' | 'rejected';
  type: 'smooth' | 'review' | 'legacy' | 'boundary' | 'duplicate' | 'empty';
  mergeHistory: string[];
  notes: string;
  auditTrail: AuditRecord[];
  createdAt: Date;
  updatedAt: Date;
}

interface MergeSuggestion {
  id: string;
  pointId1: string;
  pointId2: string;
  similarityScore: number;
  similarityBreakdown: {
    address: number;
    name: number;
    distance: number;
  };
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  suggestedAt: Date;
}

interface AuditRecord {
  id: string;
  action: 'import' | 'merge' | 'confirm' | 'reject' | 'note';
  operator: string;
  remark: string;
  timestamp: Date;
}

interface AppState {
  points: MealPoint[];
  suggestions: MergeSuggestion[];
  currentStep: 'import' | 'merge' | 'review' | 'export';
}
```

## 5. 核心算法模块

### 5.1 地址相似度算法
- 使用Levenshtein距离计算文本相似度
- 结合地理位置距离（Haversine公式）
- 综合评分 = 地址相似度×0.4 + 名称相似度×0.3 + 距离相似度×0.3
- 阈值：>0.85 自动归并，0.6-0.85 人工确认，<0.6 不处理

### 5.2 归并规则
- 同一地点不同写法（如"社区食堂" vs "社区助餐点"）优先归并
- 相邻点位（距离<50米但名称地址不同）保留并标注
- 空值记录单独分类处理
- 重复项保留主记录，标记合并历史
