
## 1. 架构设计

```mermaid
graph TD
    subgraph "前端层 (React)"
        A["仪表盘页面"]
        B["样本管理页面"]
        C["漂移检测页面"]
        D["人工改判页面"]
        E["报告中心页面"]
    end
    
    subgraph "状态管理层 (Zustand)"
        F["样本状态 Store"]
        G["检测状态 Store"]
        H["报告状态 Store"]
    end
    
    subgraph "数据层"
        I["Mock 数据 (JSON)"]
        J["本地存储 (LocalStorage)"]
        K["导出工具 (CSV/PDF)"]
    end
    
    subgraph "组件层"
        L["通用组件 (表格/卡片/弹窗)"]
        M["业务组件 (证据卡片/时间线/对比面板)"]
        N["图表组件 (趋势图/统计饼图)"]
    end
    
    A --> F
    B --> F
    C --> G
    D --> G
    E --> H
    
    F --> I
    G --> I
    H --> I
    
    F --> J
    G --> J
    H --> J
    
    A --> N
    B --> L
    C --> M
    D --> M
    E --> L
    
    H --> K
```

## 2. 技术描述

- **前端框架**: React@18 + TypeScript
- **构建工具**: Vite@5
- **样式方案**: TailwindCSS@3 + PostCSS
- **状态管理**: Zustand@4 (轻量级状态管理)
- **路由方案**: React Router@6
- **图表库**: Recharts@2 (趋势图表)
- **UI 组件库**: Headless UI (无样式组件) + Heroicons (图标)
- **数据持久化**: LocalStorage (保存改判记录和备注)
- **导出功能**: 原生 JS 实现 CSV/PDF 导出

## 3. 路由定义

| 路由 | 页面名称 | 主要功能 |
|------|----------|----------|
| / | 检测仪表盘 | 概览统计、趋势图表、快捷入口 |
| /samples | 样本管理 | 材料上传、样本列表、版本切换 |
| /detection | 漂移检测 | 自动检测、证据溯源、冲突展示 |
| /review | 人工改判 | 样本评审、改判操作、补录备注 |
| /reports | 报告中心 | 分类报告、导出功能、交接文档 |

## 4. 数据模型

### 4.1 数据模型定义

```mermaid
erDiagram
    SAMPLE ||--o{ DETECTION_RESULT : "has"
    SAMPLE ||--o{ REVIEW_RECORD : "has"
    SAMPLE ||--o{ VERSION_HISTORY : "has"
    DETECTION_RESULT ||--o{ EVIDENCE : "contains"
    
    SAMPLE {
        string id "样本ID"
        string content "客服对话内容"
        string originalIntent "原始意图"
        string source "来源(模型/人工)"
        string status "状态(待检测/已检测/待复核/已完成)"
        date createdAt "创建时间"
        date updatedAt "更新时间"
    }
    
    DETECTION_RESULT {
        string id "检测ID"
        string sampleId "样本ID"
        string modelIntent "模型判断意图"
        number modelConfidence "模型置信度"
        string manualIntent "人工标注意图"
        boolean isDrift "是否漂移"
        number driftScore "漂移分数"
        string thresholdVersion "阈值版本"
        date detectedAt "检测时间"
    }
    
    EVIDENCE {
        string id "证据ID"
        string detectionId "检测ID"
        string type "证据类型(模型输出/人工标注/阈值配置)"
        string content "证据内容"
        string highlight "高亮关键词"
    }
    
    REVIEW_RECORD {
        string id "记录ID"
        string sampleId "样本ID"
        string reviewer "评审人"
        string finalIntent "最终判定意图"
        string reason "改判理由"
        string remark "补录备注"
        boolean isRemarkAdded "是否补录过"
        string remarkDiff "补录差异内容"
        date reviewedAt "评审时间"
    }
    
    VERSION_HISTORY {
        string id "版本ID"
        string sampleId "样本ID"
        number version "版本号"
        string field "修改字段"
        string oldValue "旧值"
        string newValue "新值"
        string operator "操作人"
        date operatedAt "操作时间"
    }
```

### 4.2 TypeScript 类型定义

```typescript
// 样本类型
interface Sample {
  id: string;
  content: string;
  originalIntent: string;
  source: 'model' | 'manual' | 'online';
  status: 'pending' | 'detected' | 'reviewing' | 'completed';
  createdAt: string;
  updatedAt: string;
}

// 检测结果类型
interface DetectionResult {
  id: string;
  sampleId: string;
  modelIntent: string;
  modelConfidence: number;
  manualIntent?: string;
  isDrift: boolean;
  driftScore: number;
  thresholdVersion: string;
  detectedAt: string;
  evidences: Evidence[];
}

// 证据类型
interface Evidence {
  id: string;
  type: 'model_output' | 'manual_label' | 'threshold_config';
  content: string;
  highlight?: string[];
}

// 评审记录类型
interface ReviewRecord {
  id: string;
  sampleId: string;
  reviewer: string;
  finalIntent: string;
  reason: string;
  remark?: string;
  isRemarkAdded: boolean;
  remarkDiff?: {
    before: string;
    after: string;
  };
  reviewedAt: string;
}

// 版本历史类型
interface VersionHistory {
  id: string;
  sampleId: string;
  version: number;
  field: string;
  oldValue: string;
  newValue: string;
  operator: string;
  operatedAt: string;
}

// 报告类型
interface Report {
  id: string;
  name: string;
  generatedAt: string;
  statistics: {
    totalSamples: number;
    modelDecision: number;
    manualCorrection: number;
    needReview: number;
    driftRate: number;
  };
  samples: {
    modelDecision: string[];
    manualCorrection: string[];
    needReview: string[];
  };
}
```

## 5. 前端组件架构

```
src/
├── assets/              # 静态资源
├── components/
│   ├── common/         # 通用组件
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Table.tsx
│   │   ├── Tabs.tsx
│   │   └── Badge.tsx
│   ├── business/       # 业务组件
│   │   ├── EvidenceCard.tsx
│   │   ├── ConflictPanel.tsx
│   │   ├── Timeline.tsx
│   │   ├── SampleRow.tsx
│   │   ├── RemarkDiff.tsx
│   │   └── UploadArea.tsx
│   └── charts/         # 图表组件
│       ├── TrendChart.tsx
│       └── StatChart.tsx
├── pages/              # 页面组件
│   ├── Dashboard.tsx
│   ├── Samples.tsx
│   ├── Detection.tsx
│   ├── Review.tsx
│   └── Reports.tsx
├── store/              # 状态管理
│   ├── sampleStore.ts
│   ├── detectionStore.ts
│   └── reportStore.ts
├── types/              # 类型定义
│   └── index.ts
├── data/               # Mock 数据
│   ├── samples.ts
│   ├── detections.ts
│   └── reviews.ts
├── utils/              # 工具函数
│   ├── export.ts
│   ├── storage.ts
│   └── drift.ts
├── App.tsx
├── main.tsx
└── index.css
```

## 6. 核心功能实现方案

### 6.1 证据溯源
- 每条检测结果关联多个证据卡片
- 点击证据卡片展开详细内容，高亮关键差异点
- 支持证据链接跳转，在样本详情中定位具体位置

### 6.2 冲突处理
- 左右分栏布局，左侧展示模型证据，右侧展示人工标注
- 中间"VS"分隔，清晰对比
- 底部展示建议动作，不自动决策，由人工判断

### 6.3 补录备注
- 检测完成后允许添加备注
- 使用 diff 算法对比补录前后内容
- 高亮显示新增或修改的文字

### 6.4 版本回溯
- 每个样本维护版本历史记录
- 时间线组件展示修改历程
- 支持点击查看任意版本的完整内容
