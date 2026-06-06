## 1. 架构设计

```mermaid
graph TD
    subgraph "前端层"
        A["React 单页应用"]
        B["状态管理 (useReducer)"]
        C["UI 组件 (TailwindCSS)"]
        D["模拟数据层"]
    end
    subgraph "业务逻辑层"
        E["批次处理引擎"]
        F["混批识别模块"]
        G["授权提醒模块"]
        H["历史记录模块"]
    end
    subgraph "数据层"
        I["曲目别名表 (Mock)"]
        J["签到照片数据 (Mock)"]
        K["复核记录 (Mock)"]
    end
    A --> B
    A --> C
    B --> D
    D --> E
    D --> F
    D --> G
    D --> H
    E --> I
    F --> J
    G --> K
    H --> K
```

## 2. 技术描述

- 前端：React@18 + TypeScript + TailwindCSS@3 + Vite
- 初始化工具：npm create vite@latest
- 后端：无（纯前端应用，使用 Mock 数据）
- 状态管理：React useReducer + Context
- 图标：Lucide React
- 动画：CSS Transitions + Framer Motion（可选）

## 3. 路由定义

| 路由 | 页面名称 | 用途 |
|-------|---------|------|
| / | 主面板 | 批次列表、统计概览、快捷操作 |
| /batch/:id | 批次详情 | 曲目列表、签到照片、人工修正 |
| /history | 历史记录 | 操作日志、重跑轨迹、变更追溯 |

## 4. 数据模型

### 4.1 数据模型定义

```mermaid
erDiagram
    BATCH ||--o{ TRACK : contains
    BATCH ||--o{ PHOTO : has
    TRACK ||--o{ HISTORY : has
    BATCH ||--o{ HISTORY : has
    
    BATCH {
        string id "批次号"
        string name "批次名称"
        string status "状态: normal/pending_review/supplemented"
        date createdAt "创建时间"
        date updatedAt "更新时间"
        string sceneType "场景类型: smooth/mixed/old_standard"
    }
    
    TRACK {
        string id "曲目ID"
        string name "曲目名称"
        string alias "别名"
        string status "状态: normal/removed/updated"
        string standard "口径: new/old"
        boolean hasMixedTickets "是否混票"
        string ticketType "票种: free/paid/mixed"
        string authorization "授权状态"
    }
    
    PHOTO {
        string id "照片ID"
        string url "照片URL"
        string remark "备注"
        date takenAt "拍摄时间"
        boolean hasOldStandard "是否含旧口径"
    }
    
    HISTORY {
        string id "记录ID"
        string targetId "目标ID"
        string targetType "目标类型: batch/track"
        string action "操作类型: import/correct/rerun/review"
        string operator "操作人"
        string beforeValue "变更前"
        string afterValue "变更后"
        date timestamp "时间戳"
    }
```

### 4.2 核心类型定义

```typescript
// 曲目状态
type TrackStatus = 'normal' | 'removed' | 'updated' | 'pending_review';

// 批次状态
type BatchStatus = 'processing' | 'normal' | 'pending_review' | 'supplemented' | 'completed';

// 场景类型
type SceneType = 'smooth' | 'mixed_tickets' | 'old_standard';

interface Track {
  id: string;
  name: string;
  alias: string;
  status: TrackStatus;
  standard: 'new' | 'old';
  hasMixedTickets: boolean;
  ticketType: 'free' | 'paid' | 'mixed';
  authorization: 'valid' | 'expired' | 'pending';
  remark?: string;
}

interface Batch {
  id: string;
  name: string;
  status: BatchStatus;
  sceneType: SceneType;
  tracks: Track[];
  photos: Photo[];
  createdAt: string;
  updatedAt: string;
  operator?: string;
}

interface Photo {
  id: string;
  url: string;
  remark: string;
  takenAt: string;
  hasOldStandard: boolean;
}

interface HistoryRecord {
  id: string;
  targetId: string;
  targetType: 'batch' | 'track';
  action: 'import' | 'correct' | 'rerun' | 'review' | 'supplement';
  operator: string;
  beforeValue: string;
  afterValue: string;
  timestamp: string;
}
```

## 5. 核心业务逻辑

### 5.1 批次处理引擎
- 导入曲目别名表，自动解析曲目和别名
- 识别票种类型（赠票/售票/混票）
- 混批自动标记为"待录音师复核"，不自动归为正常

### 5.2 混批识别规则
- 同批次内同时存在赠票和售票记录 → 触发混批标记
- 混批记录状态锁定为"待录音师复核"
- 录音师确认后才能变更状态

### 5.3 旧口径补录流程
- 从课时签到照片备注中提取旧口径信息
- 人工修正后生成历史记录，保留变更轨迹
- 授权提醒同步更新

### 5.4 重跑机制
- 保留原始数据，创建新的处理版本
- 历史记录可追溯每次重跑的差异

## 6. 错误提示规范

| 场景 | 提示文案 |
|------|----------|
| 导入格式错误 | "这个文件格式不对哦，请上传包含曲目名称和别名的表格文件" |
| 混批无法自动通过 | "这批里有赠票也有售票，得麻烦录音师看过才行" |
| 授权过期 | "这首曲子的授权快到期了，记得提醒商务续一下" |
| 重跑确认 | "确定要重新跑一遍吗？之前的修改记录会保留下来" |
