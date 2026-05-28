## 1. 架构设计

```mermaid
graph TB
    subgraph "前端层"
        A["3D期限墙组件<br/>@react-three/fiber"]
        B["筛选面板<br/>React + Tailwind"]
        C["侧边数据面板<br/>React + Tailwind"]
        D["风险钻取弹窗<br/>React Modal"]
        E["图例组件"]
        F["相机控制组件"]
        G["导出模块<br/>html2canvas + CSV"]
        H["月份切片视图<br/>Canvas 2D热力图"]
    end

    subgraph "状态管理"
        I["Zustand Store<br/>持仓数据/筛选/选中/导出记录"]
    end

    subgraph "数据处理层"
        J["数据校验器<br/>字段完整性检查"]
        K["风险校验器<br/>移仓/合并/重复检测"]
        L["数据聚合器<br/>品种/月份/客户聚合"]
    end

    subgraph "持久化层"
        M["IndexedDB<br/>持仓数据+导出记录"]
        N["localStorage<br/>筛选条件+UI状态"]
    end

    A --> I
    B --> I
    C --> I
    D --> I
    I --> J
    I --> K
    I --> L
    I --> M
    I --> N
```

## 2. 技术说明

- **前端**：React@18 + TypeScript + Tailwind CSS@3 + Vite
- **3D渲染**：three.js + @react-three/fiber + @react-three/drei + @react-three/postprocessing
- **初始化工具**：vite-init (react-ts 模板)
- **后端**：无（纯前端，数据通过文件导入或Mock）
- **数据库**：IndexedDB（浏览器本地持久化）+ localStorage（UI状态）
- **状态管理**：Zustand
- **导出**：html2canvas（截图PNG）+ 自定义CSV生成
- **图表**：自定义Canvas 2D渲染月份切片热力图

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| / | 期限墙主页面（3D墙+筛选+侧边面板+图例+导出） |
| /slice/:month | 月份切片视图（指定月份的2D横截面热力图） |

## 4. API定义

本项目为纯前端应用，无后端API。数据通过以下方式获取：

- **Mock数据**：内置模拟持仓数据集，首次加载时自动填充
- **文件导入**：用户可上传CSV/JSON文件导入持仓数据

### 4.1 数据结构定义

```typescript
interface PositionRecord {
  id: string
  clientId: string
  clientName: string | null
  varietyCode: string
  varietyName: string | null
  contractMonth: string | null
  direction: "long" | "short" | null
  margin: number | null
  quantity: number | null
  riskReport: string | null
  fieldFlags: FieldFlags
}

interface FieldFlags {
  clientIdMissing: boolean
  varietyCodeMissing: boolean
  contractMonthMissing: boolean
  directionMissing: boolean
  marginMissing: boolean
  riskReportMissing: boolean
}

interface ValidationResult {
  crossMonthRollWarnings: CrossMonthWarning[]
  clientMergeIssues: ClientMergeIssue[]
  duplicateMarginEntries: DuplicateMarginEntry[]
}

interface CrossMonthWarning {
  clientId: string
  varietyCode: string
  fromMonth: string
  toMonth: string
  netChangePercent: number
}

interface ClientMergeIssue {
  clientName: string
  distinctIds: string[]
}

interface DuplicateMarginEntry {
  clientId: string
  varietyCode: string
  contractMonth: string
  direction: string
  duplicateCount: number
  marginAmount: number
}

interface ExportRecord {
  id: string
  timestamp: number
  filterSnapshot: FilterState
  dataHash: string
  fileName: string
  format: "csv" | "png"
}
```

## 5. 核心组件架构

```mermaid
graph TD
    App["App"] --> Layout["布局组件"]
    Layout --> Header["顶部工具栏<br/>Logo/导入/导出/视角预设"]
    Layout --> Main["主内容区"]
    Layout --> FilterPanel["左侧筛选面板"]
    Layout --> DataPanel["右侧数据面板"]
    Layout --> LegendBar["底部图例条"]
    
    Main --> Canvas3D["3D画布<br/>@react-three/fiber"]
    Canvas3D --> TermWall["期限墙方块组<br/>InstancedMesh"]
    Canvas3D --> GridFloor["网格地面"]
    Canvas3D --> AxisLabels["轴标签"]
    Canvas3D --> CameraController["相机控制器"]
    Canvas3D --> PostProcessing["后处理效果"]
    
    DataPanel --> DetailCard["选中项明细卡片"]
    DataPanel --> SummaryChart["汇总统计"]
    DataPanel --> MissingAlert["缺失字段警示"]
    DataPanel --> LastProcessed["上次处理时间"]
    
    Header --> DrillDownModal["风险钻取弹窗"]
    Header --> MonthSliceModal["月份切片视图"]
```

## 6. 数据模型

### 6.1 数据模型定义

```mermaid
erDiagram
    POSITION_RECORD {
        string id PK
        string clientId FK
        string clientName
        string varietyCode FK
        string varietyName
        string contractMonth
        string direction
        number margin
        number quantity
        string riskReport
    }

    CLIENT {
        string id PK
        string name
        string group
    }

    VARIETY {
        string code PK
        string name
        string exchange
    }

    EXPORT_RECORD {
        string id PK
        number timestamp
        string filterSnapshot
        string dataHash
        string fileName
        string format
    }

    VALIDATION_RESULT {
        string id PK
        number timestamp
        string dataHash
    }

    CLIENT ||--o{ POSITION_RECORD : holds
    VARIETY ||--o{ POSITION_RECORD : contains
    VALIDATION_RESULT ||--o{ CROSS_MONTH_WARNING : has
    VALIDATION_RESULT ||--o{ CLIENT_MERGE_ISSUE : has
    VALIDATION_RESULT ||--o{ DUPLICATE_MARGIN_ENTRY : has
```

### 6.2 IndexedDB 存储结构

- **stores**: position_records, clients, varieties, export_records, validation_results
- **索引**: position_records按clientId+varietyCode+contractMonth组合索引，export_records按timestamp索引
- **初始数据**: 内置Mock数据集含8个品种、12个月份、20个客户、约200条持仓记录

## 7. 校验与一致性机制

### 7.1 数据校验流程

1. 导入/加载数据 → 逐条检查字段完整性 → 生成FieldFlags
2. 去重检测 → 同客户同品种同月份同方向保证金完全一致则标记重复
3. 客户合并 → 仅按clientId合并，不同ID即使同名也不合并
4. 跨月移仓检测 → 同客户同品种相邻月份净持仓变化>30%标记预警

### 7.2 组件间交叉校验

| 校验对 | 规则 |
|--------|------|
| 3D墙 ↔ 侧边面板 | 选中方块数据与侧边面板明细一致 |
| 3D墙 ↔ 月份切片 | 切片视图总数=该月3D方块保证金之和 |
| 筛选 ↔ 3D墙 | 筛选后方块数量与筛选结果计数一致 |
| 导出 ↔ 当前视图 | 导出数据与当前筛选/视图展示数据一致 |
| 历史恢复 ↔ 数据哈希 | 重启后数据哈希与上次导出时一致则无篡改 |

## 8. 持久化策略

- 数据导入时生成SHA-256哈希存入IndexedDB
- 每次导出记录筛选条件快照+数据哈希
- 重启时：加载IndexedDB数据 → 比对哈希 → 一致则恢复，不一致则提示数据变更
- UI状态（筛选条件、面板开关、相机位置）存localStorage
