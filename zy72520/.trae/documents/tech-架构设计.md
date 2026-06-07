## 1. 架构设计

```mermaid
graph TD
    subgraph "前端层"
        A["React 应用入口"] --> B["路由层 (React Router)"]
        B --> C["回看列表页"]
        B --> D["回看详情页"]
        C --> E["状态管理 (React Context)"]
        D --> E
        C --> F["UI 组件库"]
        D --> F
    end
    
    subgraph "数据层"
        G["Mock 数据服务"] --> H["类型定义 (TypeScript)"]
        E --> G
        F --> G
    end
    
    subgraph "样式层"
        I[TailwindCSS 3] --> J[自定义主题配置]
        F --> I
    end
```

## 2. 技术说明

- **前端框架**：React@18 + TypeScript@5
- **构建工具**：Vite@5
- **样式方案**：TailwindCSS@3 + 自定义主题变量
- **路由管理**：React Router DOM@6
- **状态管理**：React Context + useReducer（轻量级，满足单页应用需求）
- **图标库**：Lucide React（轻量、现代化图标）
- **后端**：无后端，使用本地 Mock 数据模拟
- **数据持久化**：LocalStorage（保存用户复核操作结果）

## 3. 路由定义

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 回看列表页 | 首页，展示所有回看记录，支持分类筛选 |
| `/review/:id` | 回看详情页 | 展示单条记录的完整证据链、冲突处理、复核操作 |

## 4. 数据模型

### 4.1 核心数据模型

```mermaid
erDiagram
    REVIEW_RECORD ||--o{ EVIDENCE : "包含多条证据"
    REVIEW_RECORD ||--o{ OPERATION_LOG : "有多条操作日志"
    REVIEW_RECORD ||--o{ CONFLICT : "可能有冲突"
    REVIEW_RECORD ||--|| MODEL_PARAMS : "关联参数"
    
    REVIEW_RECORD {
        string id PK "记录ID"
        string type "类型: normal/duplicate/supplement"
        string status "状态: pending/confirmed/rejected"
        string userFeedback "用户反馈摘要"
        string userId "用户ID"
        string modelVersion "模型版本"
        string batchId "灰度批次"
        datetime createdAt "创建时间"
        datetime updatedAt "更新时间"
        string currentStep "当前步骤: step1/step2/step3"
    }
    
    EVIDENCE {
        string id PK "证据ID"
        string recordId FK "关联记录ID"
        string type "类型: kb_reference/work_order/duplicate_check"
        string title "证据标题"
        string content "证据内容"
        string source "来源: 知识库/线上工单/系统检测"
        string url "引用链接"
        datetime timestamp "证据时间"
        string operator "操作人"
    }
    
    CONFLICT {
        string id PK "冲突ID"
        string recordId FK "关联记录ID"
        string kbContent "知识库内容"
        string workOrderContent "工单内容"
        string conflictingPoints "矛盾点描述"
        string resolution "解决方案"
        string resolvedBy "解决人"
        datetime resolvedAt "解决时间"
    }
    
    OPERATION_LOG {
        string id PK "日志ID"
        string recordId FK "关联记录ID"
        string operator "操作人"
        string action "操作类型"
        string detail "操作详情"
        datetime timestamp "操作时间"
    }
    
    MODEL_PARAMS {
        string id PK "参数ID"
        string recordId FK "关联记录ID"
        string version "参数版本"
        object params "具体参数键值对"
        string tradeOffReason "取舍理由"
    }
```

### 4.2 TypeScript 类型定义

```typescript
// 记录类型
type RecordType = 'normal' | 'duplicate' | 'supplement';
type RecordStatus = 'pending' | 'confirmed' | 'rejected';
type ReviewStep = 'step1' | 'step2' | 'step3';
type EvidenceType = 'kb_reference' | 'work_order' | 'duplicate_check' | 'system';

interface ReviewRecord {
  id: string;
  type: RecordType;
  status: RecordStatus;
  userFeedback: string;
  userId: string;
  modelVersion: string;
  batchId: string;
  createdAt: string;
  updatedAt: string;
  currentStep: ReviewStep;
  evidences: Evidence[];
  conflicts?: Conflict[];
  operationLogs: OperationLog[];
  modelParams: ModelParams;
}

interface Evidence {
  id: string;
  type: EvidenceType;
  title: string;
  content: string;
  source: string;
  url?: string;
  timestamp: string;
  operator?: string;
}

interface Conflict {
  id: string;
  kbContent: string;
  workOrderContent: string;
  conflictingPoints: string[];
  resolution?: 'confirm_kb' | 'confirm_work_order' | 'reject_both';
  resolvedBy?: string;
  resolvedAt?: string;
}

interface OperationLog {
  id: string;
  operator: string;
  action: string;
  detail: string;
  timestamp: string;
}

interface ModelParams {
  version: string;
  params: Record<string, string | number | boolean>;
  tradeOffReason: string;
}
```

## 5. 项目目录结构

```
src/
├── types/               # TypeScript 类型定义
│   └── index.ts
├── data/                # Mock 数据
│   └── mockRecords.ts   # 三条样例数据（正常/重复/补录）
├── context/             # React Context
│   └── ReviewContext.tsx
├── components/          # 可复用组件
│   ├── layout/          # 布局组件
│   │   ├── Header.tsx
│   │   └── Layout.tsx
│   ├── list/            # 列表页组件
│   │   ├── FilterBar.tsx
│   │   ├── CategoryTabs.tsx
│   │   ├── RecordCard.tsx
│   │   └── RecordList.tsx
│   └── detail/          # 详情页组件
│       ├── BasicInfo.tsx
│       ├── StepProgress.tsx
│       ├── EvidenceTimeline.tsx
│       ├── HistoryLogs.tsx
│       ├── ConflictSection.tsx
│       ├── ParamsSection.tsx
│       └── ActionButtons.tsx
├── pages/               # 页面组件
│   ├── ListPage.tsx
│   └── DetailPage.tsx
├── hooks/               # 自定义 Hooks
│   └── useReviewData.ts
├── utils/               # 工具函数
│   └── format.ts
├── App.tsx
├── main.tsx
└── index.css
```

## 6. 三种样例数据设计

### 样例一：顺利记录（normal）
- 用户反馈正常，知识库引用清晰
- 无重复计入，无线上工单冲突
- 三步流程自动走完，状态为 confirmed

### 样例二：同一用户反馈被重复计入（duplicate）
- 同一用户ID在知识库中出现两次相同反馈
- 系统检测到重复，标记为待复核
- 停在 step2，等待标注负责人确认

### 样例三：后来从线上反馈工单补来的旧口径（supplement）
- 先有知识库引用，后补录线上工单
- 两者口径存在冲突
- 需要标注负责人选择确认哪一方
