## 1. 架构设计

```mermaid
graph TD
    subgraph "前端层"
        A["React 单页应用"]
        B["状态管理 (Context + useReducer)"]
        C["UI组件库 (Tailwind CSS)"]
        D["可视化渲染 (SVG/Canvas)"]
    end
    
    subgraph "业务逻辑层"
        E["参数联动引擎"]
        F["异常检测引擎"]
        G["报告生成器"]
        H["数据导出模块"]
    end
    
    subgraph "数据层"
        I["Mock 样例数据"]
        J["本地状态存储 (localStorage)"]
        K["操作日志记录"]
    end
    
    A --> B
    A --> C
    A --> D
    B --> E
    B --> F
    B --> G
    E --> I
    F --> I
    G --> I
    G --> H
    B --> J
    B --> K
```

## 2. 技术描述

- **前端框架**：React@18 + TypeScript@5
- **构建工具**：Vite@5
- **样式方案**：Tailwind CSS@3 + PostCSS
- **状态管理**：React Context + useReducer（轻量级全局状态）
- **可视化**：原生 SVG + Canvas 2D（无需额外图表库）
- **图标**：Lucide React（轻量级图标库）
- **数据持久化**：localStorage（保存参数配置和操作记录）
- **后端**：无（纯前端应用，使用Mock数据）
- **数据库**：无（使用内存数据结构 + localStorage持久化）

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| / | 主工作台（唯一页面，包含所有功能模块） |

## 4. 数据模型

### 4.1 数据模型定义

```mermaid
erDiagram
    POINT["点位信息"] {
        string id "点位ID"
        string name "设备名称"
        string instrument "乐器类型"
        number x "X坐标"
        number y "Y坐标"
        string coordinateSystem "坐标系"
        number floor "楼层"
        string status "状态"
        string photoUrl "照片URL"
        string dataSource "数据来源"
        string[] anomalies "异常类型列表"
        string judgmentProcess "判断过程"
        string remark "备注"
        string confirmedBy "确认人"
        string confirmedAt "确认时间"
        object diffHistory "差异历史"
    }
    
    PARAMS["参数配置"] {
        number frequencyMin "最低频率"
        number frequencyMax "最高频率"
        number sampleRate "采样精度"
        number soundFieldThreshold "声场阈值"
        string coordinateSystem "主坐标系"
        boolean autoDetect "自动检测异常"
    }
    
    OPERATION_LOG["操作日志"] {
        string id "日志ID"
        string operator "操作人"
        string action "操作类型"
        string targetId "目标点位ID"
        object before "操作前状态"
        object after "操作后状态"
        string timestamp "时间戳"
        string reason "原因说明"
    }
    
    REPORT["报告"] {
        string id "报告ID"
        string generatedAt "生成时间"
        string generatedBy "生成人"
        object params "使用的参数配置"
        number totalPoints "总点数"
        number normalCount "正常数"
        number pendingCount "待确认数"
        number anomalyCount "异常数"
        string[] judgmentProcess "判断过程记录"
        object details "详细数据"
    }
```

### 4.2 TypeScript 类型定义

```typescript
// 点位状态
type PointStatus = 'normal' | 'pending' | 'anomaly';

// 异常类型
type AnomalyType = 
  | 'coordinate_offset'      // 坐标偏移
  | 'duplicate_name'         // 设备重名
  | 'missing_photo'          // 缺照片
  | 'cross_floor'            // 跨楼层
  | 'coordinate_mismatch';   // 坐标系不一致

// 数据来源
type DataSource = 'primary' | 'gis_legacy' | 'manual';

// 点位信息
interface SoundFieldPoint {
  id: string;
  name: string;
  instrument: string;
  x: number;
  y: number;
  coordinateSystem: string;
  floor: number;
  status: PointStatus;
  photoUrl?: string;
  dataSource: DataSource;
  anomalies: AnomalyType[];
  judgmentProcess: string;
  remark?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  diffHistory: DiffRecord[];
}

// 差异记录
interface DiffRecord {
  timestamp: string;
  operator: string;
  field: string;
  oldValue: any;
  newValue: any;
  reason: string;
}

// 参数配置
interface AnalysisParams {
  frequencyMin: number;
  frequencyMax: number;
  sampleRate: number;
  soundFieldThreshold: number;
  coordinateSystem: string;
  autoDetect: boolean;
}

// 操作日志
interface OperationLog {
  id: string;
  operator: string;
  action: 'import' | 'param_change' | 'confirm' | 'remark' | 'export';
  targetId?: string;
  before?: any;
  after?: any;
  timestamp: string;
  reason?: string;
}

// 报告
interface AnalysisReport {
  id: string;
  generatedAt: string;
  generatedBy: string;
  params: AnalysisParams;
  summary: {
    totalPoints: number;
    normalCount: number;
    pendingCount: number;
    anomalyCount: number;
    anomalies: Record<AnomalyType, number>;
  };
  judgmentProcess: string[];
  points: SoundFieldPoint[];
}
```

## 5. 核心模块设计

### 5.1 参数联动引擎
- 单一数据源原则：所有模块从同一状态树读取参数
- 参数变更时，通过 useReducer 派发 ACTION，触发所有关联模块更新
- 场景、明细、报告使用同一计算函数确保数据一致性

### 5.2 异常检测引擎
- 坐标偏移：检查点位是否超出合理范围或与同类乐器组距离异常
- 设备重名：比对所有点位名称，检测重复项
- 缺照片：检查 photoUrl 字段是否为空
- 跨楼层：检查同一设备是否分布在不同楼层
- 坐标系不一致：标注非主坐标系的点位，不硬画到同一空间

### 5.3 报告生成器
- 实时生成：参数或点位变更时自动重新计算
- 判断过程可追溯：每条结论附带判断依据和过程记录
- 导出一致性：报告和明细使用同一数据源，导出时校验两者一致性

### 5.4 数据导出模块
- 支持导出格式：JSON、CSV
- 导出内容包含：参数配置、点位数据、异常原因、判断过程
- 导出时自动添加导出人、导出时间、原因说明
