## 1. 架构设计

```mermaid
graph TB
    subgraph "前端应用"
        A["React 应用层"] --> B["页面组件"]
        B --> B1["数据导入页"]
        B --> B2["安全阈值表页"]
        B --> B3["参数回放页"]
        B --> B4["历史记录页"]
        A --> C["状态管理 (Zustand)"]
        A --> D["图表组件 (ECharts)"]
        A --> E["路由管理 (React Router)"]
    end
    subgraph "数据层"
        F["Mock 数据服务"] --> G["演示数据 (JSON)"]
        F --> H["模拟 API 接口"]
    end
    subgraph "工具层"
        I["工具函数"] --> I1["温度校验"]
        I --> I2["日期处理"]
        I --> I3["状态计算"]
    end
```

## 2. 技术描述
- **前端框架**: React@18 + TypeScript
- **构建工具**: Vite@5
- **样式方案**: TailwindCSS@3
- **路由管理**: React Router@6
- **状态管理**: Zustand@4
- **图表库**: ECharts@5
- **图标库**: Lucide React@0.344
- **后端**: 无后端，使用 Mock 数据模拟

## 3. 路由定义
| 路由 | 页面 | 说明 |
|------|------|------|
| / | 数据导入页 | 首页，选择演示数据并导入 |
| /threshold | 安全阈值表页 | 查看温度阈值和历史口径 |
| /playback/:id | 参数回放页 | 展示升温曲线和处理详情 |
| /history | 历史记录页 | 所有批次记录和对比 |

## 4. 数据模型

### 4.1 数据模型定义

```mermaid
erDiagram
    BATCH_RECORD ||--o{ TEMPERATURE_POINT : contains
    BATCH_RECORD ||--o{ PROCESS_LOG : has
    BATCH_RECORD {
        string id "批次ID"
        string name "批次名称"
        string materialType "材料类型"
        string status "处理状态: normal/pending_review/supplemented"
        string remark "巡检备注"
        boolean hasManualCorrection "是否人工修正"
        string correctionReason "修正原因"
        string source "数据来源"
        Date createdAt "创建时间"
        Date updatedAt "更新时间"
    }
    TEMPERATURE_POINT {
        string id "数据点ID"
        string batchId "批次ID"
        number timeIndex "时间点(分钟)"
        number temperature "温度(℃)"
        number targetTemp "目标温度(℃)"
        boolean isAbnormal "是否异常"
        boolean isCorrected "是否修正"
    }
    PROCESS_LOG {
        string id "日志ID"
        string batchId "批次ID"
        string action "操作类型"
        string operator "操作人"
        string description "描述"
        Date timestamp "时间戳"
    }
    THRESHOLD_CONFIG {
        string id "配置ID"
        string version "口径版本"
        number zone "温区"
        number minTemp "最低温度"
        number maxTemp "最高温度"
        number warningThreshold "预警阈值"
        boolean isCurrent "是否当前口径"
        Date effectiveDate "生效日期"
    }
```

### 4.2 演示数据定义

#### 三种类型批次数据
1. **正常批次 (normal)**
   - 顺利记录，无人工修改
   - 温度曲线在安全范围内
   - 状态：正常

2. **待复核批次 (pending_review)**
   - 人工改过系数但没写原因
   - 系统标记为待复核
   - 需设备工程师确认

3. **补录批次 (supplemented)**
   - 错口径材料
   - 从安全阈值表补录旧口径
   - 标注补录来源和时间

## 5. 核心工具函数

### 温度校验函数
- 输入：温度值、阈值配置
- 输出：校验结果、异常信息
- 错误提示：使用自然语言描述，如"第15分钟温度超过上限10℃"而非"temp_out_of_range"

### 状态计算函数
- 输入：批次数据、修正记录
- 输出：处理状态、操作建议

### 曲线生成函数
- 输入：温度点数组
- 输出：ECharts 配置对象
