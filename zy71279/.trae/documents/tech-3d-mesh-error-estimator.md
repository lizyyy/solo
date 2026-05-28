## 1. 架构设计

```mermaid
graph TD
    subgraph "前端层"
        A["React 18 UI层"] --> B["状态管理 (Zustand)"]
        A --> C["路由 (React Router)"]
        A --> D["3D渲染层 (Three.js)"]
        A --> E["图表可视化 (ECharts)"]
    end
    
    subgraph "核心算法层"
        F["网格解析模块"] --> G["网格采样器"]
        G --> H["误差估计算法"]
        H --> I["拓扑检测器 (法线/孔洞)"]
        H --> J["约束筛选器"]
        J --> K["打印时间估算器"]
    end
    
    subgraph "数据层"
        L["本地存储 (IndexedDB)"] --> M["任务记录库"]
        L --> N["材料库"]
        L --> O["配置库"]
        P["导出模块 (PDF/Excel/JSON)"] --> Q["文件系统 API"]
    end
    
    subgraph "外部服务"
        R["浏览器 WebGL"]
        S["浏览器 File API"]
    end
    
    D --> R
    F --> S
    B <--> L
    J <--> B
    P <--> B
```

## 2. 技术描述

- **前端框架**：React@18.2.0 + TypeScript@5.4.0
- **构建工具**：Vite@5.2.0
- **样式方案**：TailwindCSS@3.4.0 + CSS Variables
- **状态管理**：Zustand@4.5.0（轻量高性能，适合本地工具）
- **路由管理**：React Router@6.22.0
- **3D渲染**：Three.js@0.162.0 + @react-three/fiber@8.15.0 + @react-three/drei@9.99.0
- **图表可视化**：ECharts@5.5.0
- **本地数据库**：IndexedDB (Dexie.js@4.0.0)
- **PDF导出**：jspdf@2.5.0 + html2canvas@1.4.0
- **Excel导出**：xlsx@0.18.5
- **3D文件解析**：three.js 内置 STLLoader / OBJLoader

## 3. 路由定义

| 路由 | 页面名称 | 用途 |
|-------|---------|------|
| / | 估计工作台 | 主工作区，模型上传、参数配置、误差计算、结果预览 |
| /history | 历史记录 | 任务列表展示、筛选排序、详情查看 |
| /materials | 材料库 | 材料CRUD、重复编号管理、参数模板 |
| /reports | 报告中心 | 多任务对比图表、批量导出 |
| /settings | 系统设置 | 单位配置、阈值预设、导出格式 |

## 4. 数据模型

### 4.1 数据模型定义

```mermaid
erDiagram
    MATERIAL ||--o{ ESTIMATION_TASK : "使用"
    ESTIMATION_TASK ||--|| ERROR_ANALYSIS : "包含"
    ESTIMATION_TASK ||--|| PRINT_ESTIMATION : "包含"
    ESTIMATION_TASK ||--o{ CONSTRAINT_CHECK : "包含"
    
    MATERIAL {
        string id PK "材料唯一ID"
        string code UK "材料编号(唯一约束)"
        string name "材料名称"
        string type "材料类型"
        float density "密度(g/cm³)"
        float cost_per_gram "成本(元/克)"
        float print_speed "打印速度(mm/s)"
        float nozzle_temp "喷嘴温度(°C)"
        float bed_temp "热床温度(°C)"
        datetime created_at "创建时间"
        datetime updated_at "更新时间"
        boolean is_duplicate_warning "重复编号警告标记"
    }
    
    ESTIMATION_TASK {
        string id PK "任务ID"
        string model_name "模型名称"
        int original_faces "原始面数"
        int simplified_faces "简化后面数"
        float simplification_ratio "简化比例"
        string algorithm "简化算法"
        float error_threshold "误差阈值(mm)"
        float layer_height "打印层厚(mm)"
        float infill_rate "填充率(%)"
        string material_id FK "材料ID"
        string status "状态: pending/completed/failed"
        string error_message "错误信息(详细)"
        datetime created_at "创建时间"
        string duplicate_check_hash "防重哈希"
        boolean is_duplicate "是否重复"
    }
    
    ERROR_ANALYSIS {
        string id PK "分析ID"
        string task_id FK "任务ID"
        float max_error "最大误差(mm)"
        float min_error "最小误差(mm)"
        float mean_error "平均误差(mm)"
        float std_deviation "标准差"
        json error_distribution "误差分布直方图数据"
        json max_error_points "最大误差点坐标"
        boolean has_normal_flip "是否存在法线翻转"
        int normal_flip_count "法线翻转面数"
        boolean has_holes "是否存在孔洞"
        int hole_count "孔洞数量"
        float volume "模型体积(cm³)"
        float surface_area "表面积(cm²)"
    }
    
    PRINT_ESTIMATION {
        string id PK "估算ID"
        string task_id FK "任务ID"
        float print_time_hours "打印时间(小时)"
        float material_weight "材料重量(克)"
        float material_cost "材料成本(元)"
        float total_cost "总成本(元)"
        float energy_consumption "能耗(kWh)"
    }
    
    CONSTRAINT_CHECK {
        string id PK "检查ID"
        string task_id FK "任务ID"
        string constraint_name "约束名称"
        boolean passed "是否通过"
        string details "详细说明"
        float actual_value "实际值"
        float allowed_value "允许值"
    }
```

### 4.2 核心类型定义

```typescript
// 网格数据结构
interface MeshData {
  vertices: Float32Array;
  faces: Uint32Array;
  normals: Float32Array;
  faceCount: number;
  vertexCount: number;
  boundingBox: { min: [number, number, number]; max: [number, number, number] };
}

// 误差采样点
interface ErrorSample {
  position: [number, number, number];
  distance: number;
  faceIndex: number;
  normal: [number, number, number];
}

// 简化算法枚举
enum SimplificationAlgorithm {
  QUADRIC_EDGE_COLLAPSE = 'quadric_edge_collapse',
  CLUSTERING = 'clustering',
  VERTEX_CLUSTERING = 'vertex_clustering',
  MESHDECIMATOR = 'meshdecimator'
}

// 算法参数
interface EstimationParams {
  algorithm: SimplificationAlgorithm;
  targetFaceCount: number;
  errorThreshold: number;
  preserveBorders: boolean;
  preserveNormals: boolean;
}

// 打印参数
interface PrintParams {
  layerHeight: number;
  infillRate: number;
  printSpeed: number;
  wallThickness: number;
  nozzleDiameter: number;
}

// 检测结果
interface MeshQualityResult {
  hasNormalFlip: boolean;
  normalFlipFaces: number[];
  hasHoles: boolean;
  holeBoundaries: number[][];
  nonManifoldEdges: number[];
  degenerateFaces: number[];
}
```

## 5. 核心算法模块接口

```typescript
// 网格采样器
class MeshSampler {
  constructor(mesh: MeshData);
  samplePoints(count: number): ErrorSample[];
  sampleByFaceDensity(): ErrorSample[];
  sampleByCurvature(adaptive: boolean): ErrorSample[];
}

// 误差估计器
class ErrorEstimator {
  constructor(originalMesh: MeshData, simplifiedMesh: MeshData);
  computeHausdorffDistance(): { max: number; mean: number; min: number };
  computePointToMeshDistance(points: [number, number, number][]): number[];
  computeErrorDistribution(bins: number): { range: [number, number]; count: number }[];
}

// 拓扑检测器
class TopologyChecker {
  constructor(mesh: MeshData);
  checkNormals(): { flipped: number[]; consistent: boolean };
  checkHoles(): { count: number; boundaries: number[][] };
  checkManifold(): { nonManifoldEdges: number[]; isManifold: boolean };
}

// 约束筛选器
class ConstraintFilter {
  constructor(constraints: Constraint[]);
  validate(analysis: ErrorAnalysis, printEst: PrintEstimation): ConstraintCheck[];
  filterTasks(tasks: EstimationTask[], filters: FilterCriteria): EstimationTask[];
}

// 防重校验器
class DuplicateChecker {
  generateHash(task: EstimationTask, params: EstimationParams, printParams: PrintParams): string;
  checkDuplicate(hash: string): EstimationTask | null;
  markDuplicate(taskId: string, originalTaskId: string): void;
}
```

## 6. 状态管理设计

```typescript
// 全局状态切片
interface AppState {
  // 当前工作台状态
  currentTask: EstimationTask | null;
  currentMesh: MeshData | null;
  currentParams: EstimationParams;
  currentPrintParams: PrintParams;
  selectedMaterial: Material | null;
  
  // 分析结果
  errorAnalysis: ErrorAnalysis | null;
  printEstimation: PrintEstimation | null;
  constraintChecks: ConstraintCheck[];
  
  // UI状态
  isCalculating: boolean;
  viewMode: 'wireframe' | 'solid' | 'heatmap';
  showErrorOverlay: boolean;
  
  // 操作
  setMesh(mesh: MeshData | null): void;
  setParams(params: Partial<EstimationParams>): void;
  setPrintParams(params: Partial<PrintParams>): void;
  setMaterial(material: Material | null): void;
  runEstimation(): Promise<void>;
  clearCurrent(): void;
}
```
