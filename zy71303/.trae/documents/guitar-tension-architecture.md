## 1. 架构设计

```mermaid
graph TB
    subgraph "前端层"
        "React App" --> "3D 场景模块"
        "React App" --> "数据面板模块"
        "React App" --> "报告导出模块"
    end
    subgraph "计算层"
        "张力计算引擎" --> "弦振动公式 T=4μL²f²"
        "异常检测引擎" --> "八度检查"
        "异常检测引擎" --> "单位检查"
        "异常检测引擎" --> "超限检查"
    end
    subgraph "数据层"
        "Zustand Store" --> "弦参数状态"
        "Zustand Store" --> "计算结果状态"
        "Zustand Store" --> "异常标记状态"
        "预设调弦数据" --> "标准调弦/Drop D/DADGAD/Open G/Open D"
        "边界案例样例" --> "6组样例数据"
    end
    "数据面板模块" --> "张力计算引擎"
    "张力计算引擎" --> "异常检测引擎"
    "异常检测引擎" --> "3D 场景模块"
    "Zustand Store" --> "张力计算引擎"
    "报告导出模块" --> "Zustand Store"
```

## 2. 技术说明

- 前端框架：React@18 + TypeScript + Vite
- 3D 渲染：Three.js + @react-three/fiber + @react-three/drei + @react-three/postprocessing
- 样式：Tailwind CSS@3
- 状态管理：Zustand
- 初始化工具：vite-init
- 后端：无（纯前端，所有计算在浏览器端完成）
- 数据存储：内存状态 + CSV导出

## 3. 路由定义

| 路由 | 用途 |
|-----|------|
| / | 3D工作台主页面，包含所有功能模块 |

## 4. 核心数据结构

```typescript
interface StringParams {
  id: number;
  name: string;
  scaleLength: number;
  targetNote: string;
  frequency: number;
  linearDensity: number;
  linearDensityUnit: 'g/m' | 'kg/m' | 'lb/in';
  gauge: number;
  rawInputs: {
    scaleLength: string;
    frequency: string;
    linearDensity: string;
    gauge: string;
  };
}

interface TensionResult {
  stringId: number;
  tension: number;
  tensionUnit: 'N';
  isAnomalous: boolean;
  anomalies: Anomaly[];
}

interface Anomaly {
  type: 'OCTAVE_ERROR' | 'UNIT_SUSPICION' | 'TENSION_OVERLIMIT';
  severity: 'info' | 'warning' | 'danger';
  message: string;
  suggestion: string;
}

interface TuningPreset {
  name: string;
  strings: { note: string; frequency: number }[];
}

interface WorkbenchState {
  strings: StringParams[];
  results: TensionResult[];
  totalTension: number;
  anomalies: Anomaly[];
  activePreset: string;
  comparisonPreset: string | null;
  filter: {
    stringIds: number[];
    tensionRange: [number, number] | null;
    anomalyOnly: boolean;
  };
}
```

## 5. 核心计算公式

**弦振动基本公式**：T = 4 × μ × L² × f²

- T：张力（N）
- μ：线密度（kg/m），需从输入单位转换
- L：弦长（m），从mm转换
- f：频率（Hz）

**单位转换规则**：
- g/m → kg/m：除以1000
- lb/in → kg/m：乘以 17.858
- mm → m：除以1000

**异常检测阈值**：
- 八度检查：计算频率与该弦标准音高相差2倍以上（即一个八度以上）时触发
- 单位检查：线密度值<0.001 kg/m（疑似误用kg/m输入了g/m值）或>0.01 kg/m（疑似误用g/m输入了kg/m值）时触发
- 张力超限：总张力>800N为警告，>1000N为危险

## 6. 调弦预设数据

| 调弦方式 | 弦1 | 弦2 | 弦3 | 弦4 | 弦5 | 弦6 |
|---------|-----|-----|-----|-----|-----|-----|
| Standard | E4(329.6) | B3(246.9) | G3(196.0) | D3(146.8) | A2(110.0) | E2(82.4) |
| Drop D | E4(329.6) | B3(246.9) | G3(196.0) | D3(146.8) | A2(110.0) | D2(73.4) |
| DADGAD | D4(293.7) | A3(220.0) | G3(196.0) | D3(146.8) | A2(110.0) | D2(73.4) |
| Open G | D4(293.7) | B3(246.9) | G3(196.0) | D3(146.8) | G2(98.0) | D2(73.4) |
| Open D | D4(293.7) | A3(220.0) | F#3(185.0) | D3(146.8) | A2(110.0) | D2(73.4) |

## 7. 报告导出格式

CSV文件包含以下列：
- 弦序号、弦名、弦长(mm)、目标音高、频率(Hz)、线密度(g/m)、弦径(mm)
- 计算张力(N)、张力占比(%)、异常标记、异常描述
- 汇总行：总张力(N)、调弦方式、导出时间戳
