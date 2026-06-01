## 1. 架构设计

```mermaid
graph TB
    subgraph "前端层"
        UI["React SPA<br/>诊断看板 / 阈值管理 / 报告历史"]
        Chart["Recharts 图表"]
        Store["LocalStorage 持久化"]
    end

    subgraph "计算引擎层"
        Parser["日志解析器<br/>分隔符/列头/单位识别"]
        Converter["单位换算引擎<br/>dB↔Pa / m/s↔加速度"]
        GapDetector["采样缺口检测"]
        StandingWave["驻波计算器<br/>f = nc/2L 各阶模态"]
        ThresholdJudge["阈值判定器<br/>安全/警告/危险"]
    end

    subgraph "数据层"
        SensorLog["传感器日志数据"]
        ThresholdVersions["阈值版本表"]
        HistoryRuns["历史运行记录"]
        Reports["诊断报告"]
    end

    UI --> Parser
    UI --> StandingWave
    UI --> ThresholdJudge
    Parser --> Converter
    Converter --> GapDetector
    GapDetector --> StandingWave
    StandingWave --> ThresholdJudge
    ThresholdJudge --> Reports
    Store --> ThresholdVersions
    Store --> HistoryRuns
    Store --> Reports
    SensorLog --> Parser
    ThresholdVersions --> ThresholdJudge
    Chart --> StandingWave
```

## 2. 技术说明

- **前端**：React 18 + TypeScript + Tailwind CSS 3 + Vite
- **初始化工具**：Vite (react-ts 模板)
- **后端**：无（纯前端，数据持久化至 LocalStorage）
- **数据库**：LocalStorage（结构化 JSON 存储），无需外部数据库
- **图表**：Recharts（折线图、柱状图）
- **状态管理**：React Context + useReducer（轻量级，无需 Redux）
- **唯一依赖补充**：lucide-react（图标）、uuid（版本号生成）

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| `/` | 诊断看板页 - 数据导入、解析、计算、判定 |
| `/thresholds` | 阈值管理页 - 版本管理、编辑、对比 |
| `/reports` | 报告与历史页 - 报告查看、导出、历史对比、补录 |

## 4. API 定义

无后端 API，所有计算在浏览器端完成。核心函数接口定义如下：

```typescript
interface SensorRecord {
  id: string;
  timestamp: string;
  frequency: number;
  soundPressure: number;
  unit: 'Pa' | 'dB' | 'm/s';
  rawValue: string;
  isGap: boolean;
  isDuplicate: boolean;
  source: 'import' | 'supplement';
}

interface ThresholdVersion {
  version: number;
  createdAt: string;
  modifiedBy: string;
  reason: string;
  bands: ThresholdBand[];
}

interface ThresholdBand {
  frequencyRange: [number, number];
  safeMax: number;
  warnMax: number;
  dangerMax: number;
  unit: 'Pa' | 'dB';
}

interface DiagnosisResult {
  recordId: string;
  level: 'safe' | 'warn' | 'danger';
  frequency: number;
  measuredValue: number;
  convertedValue: number;
  thresholdUsed: number;
  thresholdVersion: number;
  note: string;
}

interface DiagnosisReport {
  id: string;
  createdAt: string;
  thresholdVersion: number;
  roomDimensions: { length: number; width: number; height: number };
  results: DiagnosisResult[];
  gapIntervals: [string, string][];
  summary: { safe: number; warn: number; danger: number };
}
```

## 5. 数据模型

### 5.1 数据模型定义

```mermaid
erDiagram
    SensorRecord ||--o{ DiagnosisResult : "produces"
    ThresholdVersion ||--o{ DiagnosisReport : "used_in"
    DiagnosisReport ||--|{ DiagnosisResult : "contains"

    SensorRecord {
        string id PK
        string timestamp
        number frequency
        number soundPressure
        string unit
        string rawValue
        boolean isGap
        boolean isDuplicate
        string source
    }

    ThresholdVersion {
        number version PK
        string createdAt
        string modifiedBy
        string reason
    }

    DiagnosisReport {
        string id PK
        string createdAt
        number thresholdVersion FK
        number roomLength
        number roomWidth
        number roomHeight
        number safeCount
        number warnCount
        number dangerCount
    }

    DiagnosisResult {
        string id PK
        string recordId FK
        string level
        number frequency
        number measuredValue
        number convertedValue
        number thresholdUsed
        number thresholdVersion
        string note
    }
```

### 5.2 LocalStorage 键设计

| 键名 | 值类型 | 说明 |
|------|--------|------|
| `swd_thresholds` | ThresholdVersion[] | 所有阈值版本 |
| `swd_reports` | DiagnosisReport[] | 所有诊断报告 |
| `swd_records` | SensorRecord[] | 当前导入的传感器记录 |
| `swd_current_threshold_version` | number | 当前使用的阈值版本号 |
