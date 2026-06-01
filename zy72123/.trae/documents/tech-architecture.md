## 1. 架构设计

```mermaid
flowchart TB
    subgraph "前端层"
        UI["React + TypeScript + Tailwind"]
        Store["Zustand 状态管理"]
        Chart["Recharts 图表库"]
    end
    subgraph "计算引擎层"
        Engine["估算计算引擎"]
        Anomaly["异常检测模块"]
        Conflict["冲突检测模块"]
        Version["参数版本管理"]
    end
    subgraph "数据层"
        DataStore["浏览器 IndexedDB 存储"]
        SampleData["样例数据集"]
        ExportService["导出服务"]
    end
    UI --> Store
    Store --> Engine
    Store --> Anomaly
    Store --> Conflict
    Store --> Version
    Engine --> DataStore
    Anomaly --> DataStore
    Conflict --> DataStore
    Version --> DataStore
    SampleData --> DataStore
    Chart --> Store
    ExportService --> DataStore
```

## 2. 技术说明

- **前端**：React@18 + TypeScript + Tailwind CSS@3 + Vite
- **初始化工具**：vite-init（react-ts 模板）
- **后端**：无（纯前端，数据存储在浏览器 IndexedDB）
- **图表库**：Recharts（React 图表组件库）
- **数据存储**：Dexie.js（IndexedDB 封装库），用于持久化传感器数据、参数版本、估算结果
- **状态管理**：Zustand
- **路由**：react-router-dom
- **导出**：前端生成 CSV/JSON/PDF（使用 jsPDF）

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| `/` | 重定向到数据导入页 |
| `/import` | 数据导入页：传感器记录、设备参数、备注、修正 |
| `/workspace` | 估算工作台：参数配置、估算计算、图表可视化 |
| `/review` | 冲突与异常审查页：冲突证据、脏数据审查 |
| `/compare` | 历史对比页：参数版本并排、结果差异 |
| `/export` | 导出与交接页：结果导出、交接文档 |

## 4. 数据模型

### 4.1 数据模型定义

```mermaid
erDiagram
    "SensorBatch" ||--o{ "SensorRecord" : "包含"
    "SensorBatch" ||--o{ "FieldNote" : "关联"
    "SensorBatch" ||--o{ "ManualCorrection" : "包含"
    "DeviceParam" ||--o{ "ParamVersion" : "版本历史"
    "EstimationRun" }o--|| "SensorBatch" : "基于"
    "EstimationRun" }o--|| "ParamVersion" : "使用"
    "EstimationRun" ||--o{ "EstimationResult" : "产出"
    "EstimationRun" ||--o{ "AnomalyRecord" : "标记"
    "EstimationRun" ||--o{ "ConflictRecord" : "发现"
    "DirtyDataRecord" }o--|| "SensorBatch" : "属于"

    "SensorBatch" {
        string id PK
        string name
        datetime importTime
        string source
        int recordCount
    }
    "SensorRecord" {
        string id PK
        string batchId FK
        number timestamp
        number vehicleSpeed
        number brakePressure
        number motorRpm
        number batteryVoltage
        number batteryCurrent
        number temperature
        string status
    }
    "FieldNote" {
        string id PK
        string batchId FK
        number startTime
        number endTime
        string content
        string eventType
    }
    "ManualCorrection" {
        string id PK
        string batchId FK
        string recordId FK
        string field
        number oldValue
        number newValue
        string reason
        string correctedBy
        datetime correctedAt
    }
    "DeviceParam" {
        string id PK
        string name
        string description
    }
    "ParamVersion" {
        string id PK
        string paramId FK
        number versionNumber
        json values
        string changedBy
        datetime changedAt
        string changeNote
    }
    "EstimationRun" {
        string id PK
        string batchId FK
        string paramVersionId FK
        datetime runTime
        string status
    }
    "EstimationResult" {
        string id PK
        string runId FK
        number timestamp
        number regenBrakeForce
        number energyRecoveryRate
        number totalEnergyRecovered
        string anomalyFlag
    }
    "AnomalyRecord" {
        string id PK
        string runId FK
        string recordId FK
        string level
        string type
        string description
        string evidence
        string resolution
    }
    "ConflictRecord" {
        string id PK
        string runId FK
        string noteId FK
        string recordId FK
        string sensorEvidence
        string noteEvidence
        string suggestedAction
        string userDecision
        string decisionReason
        datetime decisionTime
    }
    "DirtyDataRecord" {
        string id PK
        string batchId FK
        string recordId FK
        string dirtyType
        string field
        string description
        string suggestion
        string resolution
    }
```

### 4.2 核心计算逻辑

**再生制动力估算**：
- 制动力 F_regen = (T_motor × η_trans) / R_wheel
- T_motor = f(motorRpm, batteryVoltage, batteryCurrent) — 电机转矩特性查表
- 能量回收率 η_recovery = E_recovered / E_kinetic × 100%
- E_kinetic = 0.5 × m × v²

**异常检测规则**：
- 物理极限检测：车速 > 设计极限、制动力 > 最大制动力
- 趋势偏离检测：连续N个点偏离拟合曲线超过2σ
- 备注矛盾检测：现场备注标记"无制动"但传感器记录有制动压力
- 空值检测：关键字段缺失
- 重复检测：时间戳+车速完全相同的记录
- 边界检测：值等于量程上下限的记录

**冲突检测规则**：
- 备注时间区间内的传感器数据与备注描述不一致
- 人工修正与后续传感器读数矛盾
- 设备参数与传感器测量范围不匹配

## 5. 样例数据设计

样例数据包含以下场景：
1. **正常数据**：30条平滑的制动过程传感器记录
2. **空值记录**：3条关键字段缺失的记录（vehicleSpeed为空、motorRpm为空、batteryVoltage为空）
3. **重复记录**：2条时间戳和所有字段完全重复的记录
4. **边界记录**：1条车速等于设计极限(200km/h)的记录
5. **异常数据**：2条制动力超出物理极限的记录
6. **现场备注**：3条备注（含1条与传感器数据矛盾的备注："第15-18秒无制动操作"）
7. **人工修正**：2条修正记录（修正车速、修正制动力阈值）
8. **设备参数**：2个版本（v1初始参数、v2修改了制动力上限阈值）
