## 1. 架构设计
```mermaid
graph TD
    A["前端 React 应用"] --> B["状态管理层 (useReducer)"]
    A --> C["组件层"]
    C --> C1["Timeline 时间线"]
    C --> C2["RecordCard 记录卡片"]
    C --> C3["DetailPanel 详情侧栏"]
    C --> C4["AnomalyPanel 异常面板"]
    C --> C5["Toolbar 工具栏"]
    B --> D["业务逻辑层"]
    D --> D1["AnomalyDetector 异常检测"]
    D --> D2["EvidenceChain 证据链"]
    D --> D3["StatusManager 状态管理"]
    B --> E["数据层"]
    E --> E1["Mock 数据包"]
    E --> E2["localStorage 持久化"]
```

## 2. 技术描述
- **前端框架**：React@18 + TypeScript + Vite@5
- **样式方案**：TailwindCSS@3 + CSS 变量
- **状态管理**：React useReducer + Context（轻量方案，避免过度设计）
- **数据持久化**：localStorage 存储处理后的记录和状态变更
- **图表展示**：使用原生 Canvas 绘制简单结果趋势图（避免引入重型图表库）
- **图标**：使用 inline SVG 图标，无需额外图标库

## 3. 路由定义
| 路由 | 用途 |
|------|------|
| / | 主页面，包含时间线、记录卡片、详情侧栏 |

## 4. 数据模型

### 4.1 数据模型定义
```mermaid
erDiagram
    RECORD {
        string id "记录ID"
        string source "来源：队员/模型/人工"
        string title "标题"
        string type "类型：笔记/结果图/实验数据"
        string status "状态：正常/待确认/已更正/重复"
        string timestamp "时间戳"
        string author "提交人"
        json data "数据内容"
        string[] attachmentIds "附件ID列表"
        json anomalyReason "异常原因（如待确认）"
    }
    
    EVIDENCE {
        string id "证据ID"
        string recordId "关联记录ID"
        string type "类型：队员笔记/人工确认/模型说明"
        string content "内容"
        string author "作者"
        string timestamp "时间戳"
    }
    
    STATUS_HISTORY {
        string id "历史ID"
        string recordId "关联记录ID"
        string fromStatus "原状态"
        string toStatus "新状态"
        string reason "变更原因"
        string operator "操作人"
        string timestamp "时间戳"
    }
    
    ATTACHMENT {
        string id "附件ID"
        string name "文件名"
        string type "类型：图片/数据/文档"
        string arrivedLate "是否晚到"
        string delayedTime "延迟时间（小时）"
    }
    
    RECORD ||--o{ EVIDENCE : "包含多个证据"
    RECORD ||--o{ STATUS_HISTORY : "有多次状态变更"
    RECORD ||--o{ ATTACHMENT : "有多个附件"
```

### 4.2 核心类型定义
```typescript
type RecordStatus = 'normal' | 'pending' | 'corrected' | 'duplicate';
type RecordType = 'note' | 'result' | 'data';
type EvidenceType = 'note' | 'confirmation' | 'model';
type AnomalyType = 'drift' | 'unit_mismatch' | 'constraint_override' | 'late_attachment' | 'duplicate';

interface AnomalyReason {
  type: AnomalyType;
  description: string;
  details: Record<string, unknown>;
}

interface DataRecord {
  id: string;
  source: 'teammate' | 'model' | 'manual';
  title: string;
  type: RecordType;
  status: RecordStatus;
  timestamp: string;
  author: string;
  data: {
    value?: number;
    unit?: string;
    constraints?: Record<string, unknown>;
    runId?: string;
    [key: string]: unknown;
  };
  attachments: Attachment[];
  anomalyReason?: AnomalyReason;
  evidence: Evidence[];
  statusHistory: StatusChange[];
}

interface Evidence {
  id: string;
  type: EvidenceType;
  content: string;
  author: string;
  timestamp: string;
}

interface StatusChange {
  id: string;
  fromStatus: RecordStatus;
  toStatus: RecordStatus;
  reason: string;
  operator: string;
  timestamp: string;
}

interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'data' | 'doc';
  arrivedLate: boolean;
  delayedHours?: number;
  url?: string;
}
```

## 5. 异常检测核心逻辑

### 5.1 重复运行结果漂移检测
- 相同 `runId` 的多次运行结果对比
- 偏差阈值：数值差异 > 5% 或相对误差 > 2σ
- 标记为 `pending`，原因标注漂移值和对比数据

### 5.2 单位混用检测
- 同类型数据（如产能、时间）的单位一致性检查
- 预定义单位组：`['pcs/h', '件/小时', 'units/hr']` 视为同一量纲
- 跨组单位出现标记为 `pending`

### 5.3 约束覆盖检测
- 记录中 `constraints` 字段变更历史比对
- 后续记录的约束条件与原始约束冲突时标记
- 记录被覆盖的约束项和新值

### 5.4 晚到附件检测
- 附件 `arrivedLate` 标记为 `true` 时自动标记记录
- 记录延迟到达时间，提醒教练注意时序合理性

## 6. 项目目录结构
```
src/
├── types/              # 类型定义
│   └── index.ts
├── data/               # Mock 数据包
│   ├── samplePacket.ts # 混合数据包
│   └── initialData.ts
├── logic/              # 业务逻辑
│   ├── anomalyDetector.ts
│   ├── evidenceChain.ts
│   └── statusManager.ts
├── components/         # UI 组件
│   ├── Timeline/
│   ├── RecordCard/
│   ├── DetailPanel/
│   ├── AnomalyPanel/
│   └── Toolbar/
├── hooks/              # 自定义 Hooks
│   └── useRecords.ts
├── store/              # 状态管理
│   └── RecordsContext.tsx
├── App.tsx
├── main.tsx
└── index.css
```
