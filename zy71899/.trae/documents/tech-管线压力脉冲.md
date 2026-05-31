## 1. 架构设计

```mermaid
graph TD
    subgraph "前端层"
        A["React SPA"] --> A1["数据看板"]
        A --> A2["脉冲分析"]
        A --> A3["记录管理"]
        A --> A4["历史追溯"]
        A --> A5["报告导出"]
    end
    
    subgraph "状态管理层"
        B["Zustand"] --> B1["分析数据Store"]
        B --> B2["记录数据Store"]
        B --> B3["UI状态Store"]
    end
    
    subgraph "数据层"
        C["LocalStorage + IndexedDB"] --> C1["工况日志"]
        C --> C2["班组记录"]
        C --> C3["维修单"]
        C --> C4["分析结果"]
        C --> C5["版本历史"]
    end
    
    subgraph "工具层"
        D["工具函数"] --> D1["脉冲分析算法"]
        D --> D2["阈值检测"]
        D --> D3["变更检测"]
        D --> D4["报告生成"]
        D --> D5["数据导入导出"]
    end
```

## 2. 技术描述

- **前端框架**: React@18 + TypeScript
- **构建工具**: Vite@5
- **样式方案**: TailwindCSS@3 + CSS Variables
- **状态管理**: Zustand
- **图表库**: Recharts（波形图）+ 自定义SVG交互
- **本地存储**: LocalStorage（配置）+ IndexedDB（大量历史数据）
- **后端**: 无后端，纯前端应用，数据本地持久化
- **数据库**: IndexedDB 作为本地文档数据库
- **图标**: Lucide React

## 3. 路由定义

| 路由 | 页面 | 功能 |
|------|------|------|
| `/` | 数据看板 | 压力脉冲总览、告警、快捷操作 |
| `/pulse-analysis` | 脉冲分析 | 波形分析、阈值检测、结论追溯 |
| `/records/shift` | 班组记录 | 班组交接班记录管理 |
| `/records/logs` | 工况日志 | 工况日志上传与版本管理 |
| `/records/maintenance` | 维修单 | 维修工单管理 |
| `/history` | 历史追溯 | 批次历史、版本对比 |
| `/export` | 报告导出 | 巡检报告生成与导出 |

## 4. 数据模型

### 4.1 数据模型定义

```mermaid
erDiagram
    BATCH ||--o{ ANALYSIS_RUN : "多次分析"
    ANALYSIS_RUN ||--o{ CONCLUSION : "产生多个结论"
    ANALYSIS_RUN ||--|| DATA_SOURCE : "使用数据源"
    CONCLUSION }o--|| SHIFT_RECORD : "关联班组记录"
    CONCLUSION }o--|| WORK_LOG : "关联工况日志"
    CONCLUSION }o--|| MAINTENANCE_ORDER : "关联维修单"
    WORK_LOG ||--o{ WORK_LOG_VERSION : "多个版本"
    BATCH ||--|| MATERIAL : "属于材料批次"
    
    MATERIAL {
        string id PK "材料ID"
        string batch_no "批次号"
        string name "材料名称"
        string spec "规格"
        datetime created_at "创建时间"
    }
    
    BATCH {
        string id PK "批次ID"
        string material_id FK "材料ID"
        string status "状态"
        datetime created_at "创建时间"
    }
    
    ANALYSIS_RUN {
        string id PK "分析ID"
        string batch_id FK "批次ID"
        int version "版本号"
        datetime analysis_time "分析时间"
        string analyst "分析人"
        json waveform_data "波形数据"
        string overall_result "总体结论"
    }
    
    CONCLUSION {
        string id PK "结论ID"
        string analysis_run_id FK "分析ID"
        string type "结论类型"
        decimal pressure_value "压力值"
        string threshold_level "阈值等级"
        boolean is_cross_threshold "是否跨档"
        string shift_record_id FK "关联班组记录ID"
        string work_log_id FK "关联工况日志ID"
        string work_log_version FK "关联日志版本"
        int work_log_line "关联日志行号"
        string maintenance_order_id FK "关联维修单ID"
        string description "结论描述"
        datetime created_at "创建时间"
    }
    
    DATA_SOURCE {
        string id PK "数据源ID"
        string analysis_run_id FK "分析ID"
        string shift_record_ids "班组记录ID列表"
        string work_log_ids "工况日志ID列表"
        string maintenance_order_ids "维修单ID列表"
        datetime time_range_start "时间范围开始"
        datetime time_range_end "时间范围结束"
    }
    
    SHIFT_RECORD {
        string id PK "记录ID"
        string shift "班次（白班/夜班）"
        string operator "操作员"
        datetime record_time "记录时间"
        string content "记录内容"
        json pressure_readings "压力读数"
        string anomalies "异常情况"
        datetime created_at "创建时间"
    }
    
    WORK_LOG {
        string id PK "日志ID"
        string equipment_id "设备ID"
        string current_version "当前版本"
        datetime created_at "创建时间"
    }
    
    WORK_LOG_VERSION {
        string id PK "版本ID"
        string work_log_id FK "日志ID"
        int version "版本号"
        string upload_source "上传来源（原始/补传）"
        text content "日志内容"
        json parsed_data "解析后数据"
        datetime uploaded_at "上传时间"
        string uploaded_by "上传人"
    }
    
    MAINTENANCE_ORDER {
        string id PK "工单ID"
        string order_no "工单号"
        string equipment "设备"
        string fault_description "故障描述"
        string maintenance_content "维修内容"
        string parts_replaced "更换部件"
        string technician "维修人员"
        datetime start_time "开始时间"
        datetime end_time "结束时间"
        string status "状态"
    }
```

### 4.2 关键数据结构（TypeScript）

```typescript
// 压力脉冲数据点
interface PressureDataPoint {
  timestamp: number;
  pressure: number;
  temperature?: number;
  flowRate?: number;
}

// 阈值配置
interface ThresholdConfig {
  level: 'normal' | 'warning' | 'danger';
  min: number;
  max: number;
  color: string;
}

// 分析结论
interface AnalysisConclusion {
  id: string;
  timestamp: number;
  pressure: number;
  thresholdCrossed: boolean;
  thresholdLevel: 'normal' | 'warning' | 'danger';
  sourceType: 'shift_record' | 'work_log' | 'maintenance';
  sourceId: string;
  sourceVersion?: number;
  sourceLine?: number;
  description: string;
}

// 版本差异
interface VersionDiff {
  line: number;
  type: 'added' | 'removed' | 'modified';
  oldValue: string;
  newValue: string;
  pressureChange?: number;
  affectsConclusion: string[];
}
```

## 5. 核心算法

### 5.1 压力脉冲分析算法
- 滑动窗口峰值检测：窗口大小 50 个数据点，敏感度 0.8
- 阈值跨档判定：连续 3 个点超过阈值即标记为跨档
- 时间轴对齐：以班组交接班时间为基准对齐多源数据

### 5.2 变更检测算法
- 行级 diff：基于 Myers 差分算法
- 影响分析：检测变更行是否关联已存在的结论点
- 置信度评估：根据变更幅度评估对原有结论的影响程度

### 5.3 数据持久化
- IndexedDB 存储大量时序数据和历史版本
- LocalStorage 存储用户配置和当前会话状态
- 导入导出格式：JSON + CSV 双格式支持

