## 1. 架构设计

```mermaid
graph TB
    subgraph "前端层"
        "数据输入页" --> "Zustand Store"
        "估算看板页" --> "Zustand Store"
        "历史对比页" --> "Zustand Store"
        "报告页" --> "Zustand Store"
    end

    subgraph "计算引擎层"
        "Zustand Store" --> "单位换算模块"
        "Zustand Store" --> "扬程计算模块"
        "Zustand Store" --> "管损计算模块"
        "Zustand Store" --> "阈值判断模块"
        "Zustand Store" --> "冲突检测模块"
    end

    subgraph "数据持久层"
        "Zustand Store" --> "localStorage"
        "Zustand Store" --> "报告生成模块"
    end
```

纯前端架构，所有计算和数据存储在浏览器本地完成，无需后端服务。

## 2. 技术说明

- 前端：React@18 + TypeScript + Tailwind CSS@3 + Vite
- 初始化工具：vite-init（react-ts 模板）
- 状态管理：Zustand（含 persist 中间件自动持久化到 localStorage）
- 后端：无
- 数据库：localStorage（浏览器本地存储），用于历史记录和参数持久化
- 图表：recharts（折线图、饼图）
- 日期处理：dayjs

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| / | 重定向到 /input |
| /input | 数据输入页：传感器记录、设备参数、现场备注、人工修正 |
| /dashboard | 估算看板页：扬程/管损计算结果、阈值提醒、处理建议 |
| /compare | 历史对比页：同批数据重跑并排比较 |
| /report | 报告页：完整报告生成与导出 |

## 4. API 定义

无后端 API，所有数据通过 Zustand Store 在前端内存和 localStorage 之间流转。

## 5. 服务器架构图

不适用（纯前端项目）

## 6. 数据模型

### 6.1 数据模型定义

```mermaid
erDiagram
    "计算批次" ||--o{ "传感器记录" : "包含"
    "计算批次" ||--|| "设备参数" : "关联"
    "计算批次" ||--o{ "现场备注" : "包含"
    "计算批次" ||--o{ "人工修正" : "包含"
    "计算批次" ||--|| "计算结果" : "产出"
    "计算结果" ||--o{ "阈值提醒" : "触发"
    "计算结果" ||--o{ "处理建议" : "生成"
    "计算批次" ||--o{ "冲突记录" : "检测到"

    "计算批次" {
        string "batchId PK"
        datetime "createTime"
        datetime "processTime"
        string "operatorName"
        string "source"
    }

    "传感器记录" {
        string "recordId PK"
        string "batchId FK"
        string "parameterName"
        number "rawValue"
        string "rawUnit"
        number "standardValue"
        string "standardUnit"
        datetime "timestamp"
        string "direction"
    }

    "设备参数" {
        string "paramId PK"
        string "batchId FK"
        string "pumpModel"
        number "ratedHead"
        string "ratedHeadUnit"
        number "ratedFlow"
        string "ratedFlowUnit"
        number "pipeDiameter"
        string "pipeDiameterUnit"
        number "pipeLength"
        string "pipeLengthUnit"
        number "roughness"
        number "efficiency"
    }

    "现场备注" {
        string "noteId PK"
        string "batchId FK"
        text "content"
        datetime "noteTime"
        string "author"
    }

    "人工修正" {
        string "correctionId PK"
        string "batchId FK"
        string "fieldName"
        number "originalValue"
        string "originalUnit"
        number "correctedValue"
        string "correctedUnit"
        text "reason"
        datetime "correctionTime"
    }

    "计算结果" {
        string "resultId PK"
        string "batchId FK"
        number "staticHead"
        number "dynamicHead"
        number "frictionLoss"
        number "localLoss"
        number "totalHead"
        number "totalLoss"
        number "pumpEfficiency"
        datetime "calcTime"
        string "formulaUsed"
    }

    "阈值提醒" {
        string "alertId PK"
        string "resultId FK"
        string "alertType"
        string "level"
        number "value"
        number "threshold"
        string "unit"
        text "message"
    }

    "处理建议" {
        string "suggestionId PK"
        string "resultId FK"
        string "category"
        text "action"
        text "explanation"
        string "priority"
    }

    "冲突记录" {
        string "conflictId PK"
        string "batchId FK"
        string "fieldName"
        string "inspectionValue"
        string "importedValue"
        string "inspectionUnit"
        string "importedUnit"
        text "evidence"
        text "suggestedAction"
    }
```

### 6.2 TypeScript 类型定义

核心数据类型以 TypeScript interface 在前端定义，通过 Zustand Store 管理，持久化至 localStorage。无需 DDL 语句。
