## 1. 架构设计

```mermaid
graph TB
    subgraph "前端层"
        "React App" --> "游戏引擎"
        "React App" --> "状态管理(Zustand)"
        "React App" --> "路由(React Router)"
    end
    subgraph "游戏引擎层"
        "游戏引擎" --> "骰子状态机"
        "游戏引擎" --> "关卡控制器"
        "游戏引擎" --> "概率计算器"
        "游戏引擎" --> "错误诊断器"
    end
    subgraph "数据层"
        "状态管理(Zustand)" --> "localStorage持久化"
        "状态管理(Zustand)" --> "操作历史栈"
        "状态管理(Zustand)" --> "脏数据标记库"
    end
    subgraph "导出层"
        "成绩导出器" --> "JSON/CSV生成"
        "课堂报告导出器" --> "自说明报告生成"
    end
```

## 2. 技术说明

- 前端：React@18 + TypeScript + Tailwind CSS@3 + Vite
- 初始化工具：vite-init
- 后端：无（纯前端，数据存储于 localStorage）
- 数据库：无（localStorage + 内存状态管理）
- 状态管理：Zustand
- 路由：React Router DOM
- 图表：Canvas 手绘（避免引入重型库）
- 动画：CSS Animations + requestAnimationFrame

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| / | 入口页：选择角色（学生/教师） |
| /levels | 关卡选择页 |
| /play/:levelId | 游戏主界面（叠加/测量/偏差关卡） |
| /record/:studentName | 学生个人记录页 |
| /report | 课堂报告页（教师专属） |

## 4. 数据模型

### 4.1 数据模型定义

```mermaid
erDiagram
    "学生" ||--o{ "游戏记录" : "产生"
    "学生" ||--o{ "操作快照" : "记录"
    "关卡" ||--o{ "游戏记录" : "对应"
    "游戏记录" ||--o{ "操作快照" : "包含"
    "游戏记录" ||--o{ "失败反馈" : "触发"
    "操作快照" ||--o{ "脏数据标记" : "标记"

    "学生" {
        string "姓名 PK"
        string "角色"
        datetime "创建时间"
    }
    "关卡" {
        string "关卡ID PK"
        string "关卡名称"
        string "关卡类型"
        string "任务描述"
        string "正确答案"
    }
    "游戏记录" {
        string "记录ID PK"
        string "学生姓名 FK"
        string "关卡ID FK"
        int "尝试次数"
        int "星级"
        boolean "是否通过"
        datetime "开始时间"
        datetime "结束时间"
    }
    "操作快照" {
        string "快照ID PK"
        string "记录ID FK"
        string "操作类型"
        object "骰子状态"
        object "概率分布"
        int "样本量"
        int "实验频率"
        datetime "操作时间"
        boolean "是否异常操作"
    }
    "失败反馈" {
        string "反馈ID PK"
        string "记录ID FK"
        string "错因分类"
        string "错因描述"
        object "概率更新状态"
        object "测量状态"
        object "样本统计"
        string "回放快照ID FK"
    }
    "脏数据标记" {
        string "标记ID PK"
        string "快照ID FK"
        string "异常类型"
        string "异常描述"
        boolean "已人工确认"
        datetime "标记时间"
        datetime "确认时间"
        string "历史痕迹"
    }
```

### 4.2 核心类型定义

```typescript
type DiceState = 'superposition' | 'collapsed'
type LevelType = 'superposition' | 'measurement' | 'bias'
type ErrorCategory = 'probability' | 'measurement' | 'sample' | 'concept' | 'operation'
type AnomalyType = 'unnormalized_probability' | 'sample_reset_error' | 'repeated_measurement' | 'other'

interface DiceStateModel {
  state: DiceState
  probabilities: number[]
  collapsedValue: number | null
  measurementCount: number
  isRepeatedMeasurement: boolean
}

interface ProbabilityBoard {
  theoretical: number[]
  experimental: number[]
  sampleSize: number
  isNormalized: boolean
  normalizationError: string | null
}

interface OperationSnapshot {
  id: string
  timestamp: number
  operationType: 'roll' | 'measure' | 'change_sample' | 'submit_answer'
  diceState: DiceStateModel
  probabilityBoard: ProbabilityBoard
  sampleSize: number
  isAnomaly: boolean
  anomalyType: AnomalyType | null
}

interface FailureFeedback {
  id: string
  recordId: string
  errorCategory: ErrorCategory
  errorDescription: string
  probabilityUpdateStatus: { before: number[]; after: number[]; delta: number[] }
  measurementState: { collapsed: boolean; repeatedCount: number }
  sampleStatistics: { size: number; mean: number; variance: number }
  replaySnapshotId: string
}

interface DirtyDataMark {
  id: string
  snapshotId: string
  anomalyType: AnomalyType
  description: string
  manuallyConfirmed: boolean
  markedAt: number
  confirmedAt: number | null
  historyTrail: string[]
}

interface ExportMetadata {
  exportTime: string
  processingCaliber: string
  dataScope: string
  anomalyHandling: string
  version: string
}
```

## 5. 关卡设计

### 5.1 叠加关卡（Superposition）
- 任务：让学生理解骰子在"未测量"时没有确定值
- 机制：骰子显示叠加态（六面概率云），学生需选择"骰子现在确定是几？"→ 只能选"不确定"
- 失败诊断：选择具体数字→概念错误（认为叠加态有确定值）

### 5.2 测量关卡（Measurement）
- 任务：理解测量导致坍缩，且重复测量不改变已坍缩的结果
- 机制：骰子叠加态→点击测量→坍缩为确定值→再点击测量仍为同一值
- 失败诊断：
  - 测量后以为可以再变化→概念错误（不理解坍缩不可逆）
  - 重复测量未发现值不变→操作失误（未仔细观察）
  - 重复测量触发脏数据标记：`repeated_measurement`

### 5.3 偏差关卡（Bias）
- 任务：理解样本量对实验频率逼近理论概率的影响
- 机制：分别用1/10/100/1000个骰子投掷，观察频率与概率的偏差
- 失败诊断：
  - 小样本就下结论→概念错误（不理解大数定律）
  - 样本清零后统计未重置→操作失误→脏数据标记：`sample_reset_error`
  - 概率未归一→脏数据标记：`unnormalized_probability`

## 6. 边界情况与历史痕迹

### 6.1 概率未归一
- 触发：学生手动修改概率后各值之和不等于1
- 处理：概率板显示红色警告"概率未归一（总和=X）"，自动记录但不自动修正
- 历史痕迹：保留原始未归一值、警告时间戳、是否人工确认

### 6.2 样本清零错
- 触发：学生点击"清零"后实验频率未归零，或归零后历史统计混入新统计
- 处理：概率板显示"清零异常"标记，旧数据保留在历史栈
- 历史痕迹：清零前快照、清零后快照、差异对比

### 6.3 重复测量
- 触发：在已坍缩骰子上重复点击测量
- 处理：测量按钮变灰+提示"已坍缩，重复测量无效"，记录重复次数
- 历史痕迹：首次测量快照、每次重复测量的时间戳和结果

### 6.4 历史痕迹保护机制
- 所有脏数据标记一旦创建，不可被自动覆盖或删除
- 仅允许人工确认（教师操作），确认后状态从"待确认"变为"已确认"
- 任何状态变更追加到 `historyTrail` 数组，形成完整审计日志
- 导出时包含 `ExportMetadata`，说明处理口径（如何定义异常、如何统计、口径变更历史）

## 7. 失败反馈系统

失败反馈与以下模块挂钩，不是简单的"游戏结束"弹窗：

| 错因分类 | 概率更新状态 | 测量状态 | 样本统计 | 错因回放 | 成绩影响 |
|----------|-------------|---------|---------|---------|---------|
| 概念：叠加态有确定值 | 显示无变化 | 未测量 | 无关 | 回放到选择时刻 | 扣1星 |
| 概念：坍缩可逆 | 显示坍缩后不变 | 重复测量无效 | 无关 | 回放测量序列 | 扣1星 |
| 概念：小样本=大数定律 | 频率偏差大 | 已测量 | 均值偏差、方差大 | 回放样本量选择 | 扣1星 |
| 操作：未观察概率板 | 概率板有线索 | 忽略 | 数据充分但未利用 | 回放忽略时刻 | 不扣星 |
| 操作：样本清零异常 | 清零前后对比 | 已测量 | 混合统计标记 | 回放清零操作 | 不扣星 |

## 8. 导出自说明规范

所有导出文件（JSON/CSV）必须包含 `ExportMetadata`：

```json
{
  "_meta": {
    "exportTime": "2026-05-30T10:30:00+08:00",
    "processingCaliber": "异常操作定义为：概率未归一(|sum-1|>0.01)、样本清零后统计未重置、已坍缩骰子重复测量>3次",
    "dataScope": "2026年科普营第3期全部学生数据",
    "anomalyHandling": "异常数据保留原始值并标记，不自动修正，需人工确认",
    "version": "1.0.0",
    "caliberHistory": [
      { "version": "1.0.0", "date": "2026-05-30", "change": "初始口径" }
    ]
  },
  "data": [...]
}
```

CSV格式在首行注释中嵌入处理口径说明。
