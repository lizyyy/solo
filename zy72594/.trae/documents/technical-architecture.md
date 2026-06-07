## 1. 架构设计

```mermaid
graph TB
    subgraph "前端层"
        A["React SPA应用"]
        A1["报告列表模块"]
        A2["报告详情模块"]
        A3["可视化模块"]
        A4["异常样本模块"]
        A5["状态管理(Redux/Zustand)"]
    end
    
    subgraph "数据层"
        B["Mock数据服务"]
        C["本地存储(localStorage)"]
        D["图表库(Chart.js + Three.js)"]
    end
    
    A --> A1
    A --> A2
    A --> A3
    A --> A4
    A --> A5
    
    A1 --> B
    A2 --> B
    A3 --> B
    A4 --> B
    
    A3 --> D
    A5 --> C
```

## 2. 技术描述

- **前端框架**: React@18 + TypeScript
- **构建工具**: Vite@5
- **样式方案**: TailwindCSS@3
- **路由管理**: React Router@6
- **状态管理**: Zustand（轻量高效）
- **图表库**: Chart.js + react-chartjs-2（2D图表）
- **3D渲染**: Three.js + @react-three/fiber + @react-three/drei
- **UI组件**: 自定义组件 + Lucide Icons
- **数据持久化**: localStorage 模拟后端存储
- **Mock数据**: 内置JSON数据，模拟真实业务场景

## 3. 路由定义

| 路由 | 页面 | 说明 |
|------|------|------|
| / | 报告列表页 | 展示所有置信度校准报告列表 |
| /report/:id | 报告详情页 | 展示单个报告的详细信息、版本历史、参数记录 |
| /report/:id/visualization | 可视化展示页 | 2D图表/3D展示与数据回溯 |
| /report/:id/anomalies | 异常样本页 | 异常样本列表与详情 |
| /import | 导入页 | 线上实验桶导入与去重校验 |

## 4. 数据模型

### 4.1 数据模型定义

```mermaid
erDiagram
    EXPERIMENT_BUCKET ||--o{ CONFIDENCE_REPORT : "生成"
    NEGATIVE_SAMPLE ||--o{ CONFIDENCE_REPORT : "关联"
    CONFIDENCE_REPORT ||--o{ REPORT_VERSION : "包含"
    CONFIDENCE_REPORT ||--o{ ANOMALY_SAMPLE : "包含"
    CONFIDENCE_REPORT ||--o{ CALCULATION_PARAM : "记录"
    
    EXPERIMENT_BUCKET {
        string id PK "桶ID"
        string name "桶名称"
        string importTime "导入时间"
        string importUser "导入人"
        string hash "内容哈希(用于去重)"
        json data "桶数据"
    }
    
    NEGATIVE_SAMPLE {
        string id PK "样本ID"
        string bucketId FK "所属桶ID"
        string content "样本内容"
        string remark "备注"
        string createTime "创建时间"
    }
    
    CONFIDENCE_REPORT {
        string id PK "报告ID"
        string bucketId FK "关联桶ID"
        string name "报告名称"
        string status "状态: normal/pending_review/reviewed"
        string createTime "创建时间"
        string updateTime "更新时间"
        string currentVersion "当前版本号"
        boolean hasTimeWindowIssue "是否有时间窗穿越问题"
    }
    
    REPORT_VERSION {
        string id PK "版本ID"
        string reportId FK "报告ID"
        string version "版本号"
        string remarkBefore "修改前备注"
        string remarkAfter "修改后备注"
        string modifyUser "修改人"
        string modifyTime "修改时间"
        string diff "差异描述"
    }
    
    ANOMALY_SAMPLE {
        string id PK "异常ID"
        string reportId FK "报告ID"
        string sampleId FK "关联样本ID"
        string reason "异常原因"
        string missingMaterials "缺失材料"
        string nextOwner "下一步责任人"
        string nextAction "下一步行动"
        string status "状态: open/in_progress/resolved"
        string createTime "创建时间"
    }
    
    CALCULATION_PARAM {
        string id PK "参数ID"
        string reportId FK "报告ID"
        string paramName "参数名称"
        string paramValue "参数值"
        string version "参数版本"
        string tradeOffReason "取舍理由"
        string createTime "记录时间"
    }
```

### 4.2 核心业务逻辑

1. **去重机制**: 基于实验桶内容生成hash值，重复导入时比对hash，相同则提示不重复创建
2. **版本追踪**: 每次备注修改生成新版本记录，保存修改前后对比
3. **三步流程**: 
   - 步骤1：导入线上实验桶 → 生成初始报告
   - 步骤2：推荐策略老唐补看负样本列表 → 添加备注
   - 步骤3：系统更新异常样本页 → 生成异常分析
4. **时间窗穿越检测**: 检测到数据中存在时间窗穿越问题时，自动标记为待复核状态，不自动归为正常

## 5. 核心组件结构

```
src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   ├── report/
│   │   ├── ReportCard.tsx
│   │   ├── VersionTimeline.tsx
│   │   └── ParamCard.tsx
│   ├── visualization/
│   │   ├── Chart2D.tsx
│   │   ├── Scene3D.tsx
│   │   └── BacktrackButton.tsx
│   ├── anomaly/
│   │   ├── AnomalyCard.tsx
│   │   └── OwnerTag.tsx
│   └── common/
│       ├── StatusBadge.tsx
│       └── StepIndicator.tsx
├── pages/
│   ├── ReportList.tsx
│   ├── ReportDetail.tsx
│   ├── Visualization.tsx
│   ├── AnomalyList.tsx
│   └── ImportPage.tsx
├── store/
│   └── useReportStore.ts
├── types/
│   └── index.ts
├── utils/
│   ├── hash.ts
│   └── mockData.ts
└── App.tsx
```
