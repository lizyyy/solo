## 1. 架构设计

```mermaid
flowchart TB
    subgraph "前端层"
        "A[React SPA]" --> "B[状态管理 Zustand]"
        "B" --> "C[计算引擎]"
        "B" --> "D[图表渲染 Chart.js]"
    end
    subgraph "数据层"
        "E[本地 Mock 数据]"
        "F[三条样例记录]"
    end
    "C" --> "G[物理近似模块]"
    "C" --> "H[单位换算模块]"
    "C" --> "I[阈值判定模块]"
    "C" --> "J[数据验证模块]"
    "A" --> "E"
    "F" --> "E"
```

## 2. 技术说明

- **前端框架**：React 18 + TypeScript + Vite
- **样式方案**：Tailwind CSS 3
- **状态管理**：Zustand
- **图表库**：Chart.js + react-chartjs-2
- **路由**：react-router-dom v6
- **后端**：无（纯前端，数据使用本地 Mock）
- **数据持久化**：localStorage（可选）

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| `/` | 重定向到数据录入页 |
| `/input` | 数据录入页：表单+数据列表 |
| `/dashboard` | 频谱分析看板页：图表+阈值状态 |
| `/report` | 分析报告页：可复盘的图表+明细 |

## 4. API定义

无后端API，所有数据通过 Zustand store 管理，初始数据从 mock 模块加载。

## 5. 核心计算模块设计

### 5.1 物理近似模块

- 基频识别：根据转速(RPM)计算基频 f₁ = RPM/60
- 倍频分量：2×f₁, 3×f₁ ... 自动标注
- 振动速度→位移换算：d = v / (2πf)
- RMS→峰值换算：Peak = RMS × √2

### 5.2 单位换算模块

- 速度：mm/s ↔ in/s (1 mm/s = 0.03937 in/s)
- 位移：μm ↔ mil (1 μm = 0.03937 mil)
- 频率：Hz ↔ CPM (1 Hz = 60 CPM)
- 加速度：m/s² ↔ g (1 g = 9.81 m/s²)

### 5.3 阈值判定模块

| 等级 | 速度阈值(mm/s) | 状态色 |
|------|----------------|--------|
| 正常 | < 4.5 | 绿 |
| 警告 | 4.5 ~ 11.2 | 黄 |
| 危险 | > 11.2 | 红 |

> 参照 ISO 10816-3 标准，针对旋转机械

### 5.4 数据验证模块

- **方向符号检查**：测点方向必须为 H(水平)/V(垂直)/A(轴向) 之一
- **单位校验**：幅值单位必须为 mm/s 或 μm，自动换算并标记
- **时间间隔检查**：相邻记录时间差 < 5min 视为可能重复
- **空值检测**：关键字段(频率、幅值)为空时明确提醒
- **极端值保护**：不做简单平均，单独标记超过2倍标准差的极端值

## 6. 数据模型

### 6.1 数据模型定义

```mermaid
erDiagram
    "压缩机" ||--o{ "测点记录" : "包含"
    "测点记录" {
        "string id PK"
        "string compressorId FK"
        "string direction"
        "number frequencyHz"
        "number amplitudeMmPerS"
        "string amplitudeUnit"
        "number rpm"
        "string dataSource"
        "datetime recordTime"
        "string status"
        "string validationNote"
        "string confirmationNote"
    }
    "压缩机" {
        "string id PK"
        "string name"
        "string model"
        "number ratedRpm"
    }
```

### 6.2 样例数据

三条样例记录设计：

1. **顺利记录**：方向V，频率50Hz，幅值2.8mm/s，来源"实验表"，状态"正常"——所有字段完整，验证通过，阈值绿色
2. **需人工确认记录**：方向H，频率100Hz，幅值8.5mm/s，来源"实验表"，状态"需确认"——幅值超标(黄区)，且时间间隔异常(与上条仅隔2min)
3. **微信补录旧口径记录**：方向A，频率25Hz，幅值0.3in/s(≈7.62mm/s)，来源"维修微信群"，状态"旧口径"——单位为in/s需换算，数据来源非正式，注明"按2024年3月微信群口径补录"
