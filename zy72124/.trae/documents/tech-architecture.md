## 1. 架构设计

```mermaid
flowchart TB
    subgraph "前端层"
        "UI[受力计算看板 + 阈值管理]"
        "CALC[物理近似计算引擎]"
        "CONV[单位换算模块]"
        "TRACE[判断溯源模块]"
    end
    subgraph "数据层"
        "STORE[本地状态管理 Store]"
        "SAMPLE[样例数据集]"
    end
    UI --> CALC
    UI --> CONV
    CALC --> TRACE
    CONV --> CALC
    TRACE --> STORE
    STORE --> SAMPLE
    UI --> STORE
```

纯前端架构，所有计算和状态管理在浏览器端完成，无需后端服务。

## 2. 技术说明

- **前端框架**：React@18 + TypeScript + Vite
- **样式方案**：Tailwind CSS@3
- **状态管理**：Zustand（轻量级 Store，持久化到 localStorage）
- **图表**：无外部图表库，用 CSS + SVG 手绘仪表盘
- **数据存储**：localStorage 持久化（阈值版本历史、计算记录）
- **初始化工具**：Vite

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| `/` | 受力计算看板主页，数据输入、计算结果、判断溯源、报告导出 |
| `/threshold` | 阈值管理面板，阈值调整、版本历史 |

## 4. 数据模型

### 4.1 核心数据结构

```typescript
interface MooringRecord {
  id: string
  label: string
  source: "manual" | "sensor_log" | "legacy_supplement"
  sourceNote: string
  timestamp: string
  rawData: RawDataPoint[]
  processedData: ProcessedDataPoint[]
  forceResult: ForceResult
  judgment: Judgment
}

interface RawDataPoint {
  sampleIndex: number
  value: number
  unit: "kN" | "N" | "lbf" | "kgf"
  isGap: boolean
  interpolated: boolean
}

interface ProcessedDataPoint {
  sampleIndex: number
  valueKilonewtons: number
  originalUnit: string
  originalValue: number
  wasInterpolated: boolean
}

interface ForceResult {
  totalForceKN: number
  currentForceKN: number
  waveForceKN: number
  windForceKN: number
  formulaUsed: string
  paramsUsed: CalculationParams
}

interface CalculationParams {
  waterDensity: number
  airDensity: number
  dragCoeffCurrent: number
  inertiaCoeff: number
  dragCoeffWind: number
  submergedArea: number
  aerialArea: number
  currentVelocity: number
  waveAcceleration: number
  windVelocity: number
}

interface Judgment {
  status: "pass" | "confirm" | "exceed"
  statusLabel: string
  reason: string
  thresholdVersion: string
  thresholdValueKN: number
  ratioToThreshold: number
  judgedAt: string
}

interface ThresholdVersion {
  version: string
  valueKN: number
  changedAt: string
  changeReason: string
}
```

### 4.2 Store 结构

```typescript
interface AppStore {
  records: MooringRecord[]
  thresholdVersions: ThresholdVersion[]
  currentThreshold: ThresholdVersion
  addRecord: (record: MooringRecord) => void
  updateThreshold: (valueKN: number, reason: string) => void
  loadSampleData: () => void
  exportReport: () => string
}
```

## 5. 单位换算表

| 原始单位 | 换算到 kN 的系数 |
|----------|------------------|
| kN | 1 |
| N | 0.001 |
| lbf | 0.00444822 |
| kgf | 0.00980665 |

## 6. 物理近似公式

```
F_current = 0.5 × ρ_water × C_d × A × V²
F_wave    = 0.5 × ρ_water × C_m × A × a_wave
F_wind    = 0.5 × ρ_air × C_d_air × A_air × V_wind²
F_total   = F_current + F_wave + F_wind
```

默认参数：
- ρ_water = 1025 kg/m³
- ρ_air = 1.225 kg/m³
- C_d (水流) = 1.2
- C_m (惯性) = 2.0
- C_d_air (风) = 1.0
- A (水下截面积) = 2.0 m²
- A_air (水上截面积) = 1.5 m²
- V (流速) = 1.5 m/s（REC-001）、2.0 m/s（REC-002）、1.0 m/s（REC-003）、2.8 m/s（REC-004）、1.8 m/s（REC-005）
- a_wave (波浪加速度) = 1.2 m/s²（REC-001）、2.5 m/s²（REC-002）、0.8 m/s²（REC-003）、3.2 m/s²（REC-004）、1.5 m/s²（REC-005）
- V_wind (风速) = 10 m/s（REC-001）、20 m/s（REC-002）、8 m/s（REC-003）、28 m/s（REC-004）、15 m/s（REC-005）

## 7. 样例数据定义

### REC-001：顺利记录
- 8个采样点，无缺口，kN 单位
- 原始力值序列：[11.2, 11.8, 12.1, 12.5, 12.3, 11.9, 12.0, 11.7] kN
- 实测峰值 12.50 kN → 通过（≤24 kN 即 80%阈值）

### REC-002：需人工确认
- 8个采样点，第3-4点缺失，kN 单位
- 原始力值序列：[24.5, 25.2, null, null, 26.8, 26.1, 25.8, 25.5] kN
- 缺口用线性插值补充：25.2→26.8 → 插值 26.0, 26.4
- 实测峰值 26.80 kN → 需确认（80%-100%阈值区间，89.3%）

### REC-003：旧口径补录
- 8个采样点，第5点缺失，N 单位（传感器日志旧口径补录）
- 原始力值序列：[5200, 5400, 5600, 5800, null, 5500, 5300, 5100] N
- 缺口插值：5800→5500 → 插值 5700
- 换算后：5.2~5.8 kN → 通过（19.3%）
- 标注来源：传感器日志补录（旧口径）

### REC-004：超限记录
- 8个采样点，第2点缺失，lbf 单位（传感器日志直接采集）
- 原始力值序列：[7200, null, 7600, 7800, 7900, 7700, 7500, 7300] lbf
- 缺口插值：7200→7600 → 插值 7400
- 换算后峰值 7900 lbf = 35.14 kN → 超限告警（117.1%，超过30kN阈值）
- 标注来源：传感器日志直接采集

### REC-005：单位混写记录
- 8个采样点，第6点缺失，kgf 单位（传感器日志直接采集）
- 原始力值序列：[950, 980, 1020, 1060, 1080, null, 1000, 940] kgf
- 缺口插值：1080→1000 → 插值 1040
- 换算后峰值 1080 kgf = 10.59 kN → 通过（35.3%）
- 标注来源：传感器日志直接采集

## 8. 报告导出格式

导出为 JSON 文件，结构包含：
- 报告生成时间
- 当前阈值版本信息
- 每条记录的完整溯源链（原始数据 → 换算 → 计算 → 判断）
- 报告与明细一一对应，不出现矛盾
