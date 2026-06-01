## 1. 架构设计

```mermaid
graph TB
    "前端展示层" --> "状态管理层(Zustand)"
    "状态管理层(Zustand)" --> "数据处理层"
    "数据处理层" --> "Mock数据"
    "前端展示层" --> "Three.js渲染引擎"
    "前端展示层" --> "截图导出模块"
    "数据处理层" --> "数据质量检测器"
    "数据处理层" --> "审计日志器"
    "数据处理层" --> "增量差异计算器"
```

纯前端架构，无后端依赖。所有数据以 Mock JSON 提供，状态管理用 Zustand，3D 渲染用 Three.js 生态。

## 2. 技术说明

- 前端：React@18 + TypeScript + Tailwind CSS@3 + Vite
- 初始化工具：vite-init
- 3D 渲染：three + @react-three/fiber + @react-three/drei + @react-three/postprocessing
- 状态管理：zustand
- 图标：lucide-react
- 截图：html2canvas（Canvas 合成水印）
- 数据：Mock JSON 内嵌，模拟真实运维数据（含异常样例）
- 无后端、无数据库

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| / | 站厅热力图主页面（唯一页面，所有功能集成） |

## 4. 数据模型

### 4.1 核心数据结构

```typescript
interface StationPoint {
  id: string
  name: string
  floor: string
  type: "entrance" | "exit" | "escalator" | "elevator" | "gate" | "corridor" | "camera"
  x: number
  y: number
  congestion: number
  photo?: string
  rawNote: string
  qualityFlags: QualityFlag[]
  lastModified: string
}

interface QualityFlag {
  type: "offset" | "duplicate" | "missing_photo" | "cross_floor"
  description: string
  relatedIds?: string[]
  resolved: boolean
  resolvedNote?: string
}

interface TimeSlot {
  hour: number
  points: { id: string; congestion: number }[]
}

interface AuditLog {
  id: string
  timestamp: string
  action: "filter" | "select" | "annotate" | "correct" | "export" | "supplement"
  targetId?: string
  details: string
  snapshot?: Record<string, unknown>
}

interface FilterState {
  floors: string[]
  types: string[]
  qualityStatus: ("ok" | "warning" | "error")[]
  timeHour: number
}
```

### 4.2 Mock 数据规格

- 站厅数据：1 个地铁站厅，2 层（B1 站厅层、B2 站台层）
- 设备点位：约 30-40 个（含入口、扶梯、闸机、通道、摄像头）
- 时间数据：6:00-23:00，每小时一个拥堵值
- 异常样例数据：
  - 坐标偏移：2 个点位超出站厅边界
  - 重名设备：1 对名称高度相似的设备（"A出口摄像头" vs "A出口摄像"）
  - 缺照片：3 个点位 photo 字段为空
  - 跨楼层异常：1 个设备 ID 同时出现在 B1 和 B2

## 5. 模块划分

```
src/
  components/
    HeatmapCanvas.tsx       # Three.js 热力渲染主组件
    FloorPlan.tsx           # GIS 底图 SVG 层
    DeviceMarkers.tsx       # 设备点位标记层
    Timeline.tsx            # 底部时间轴
    FilterPanel.tsx         # 左侧筛选面板
    DetailPanel.tsx         # 右侧详情/补录面板
    AuditLogPanel.tsx       # 底部审计日志
    ExportButton.tsx        # 截图导出按钮
    QualityBadge.tsx        # 数据质量标记徽章
    DiffViewer.tsx          # 增量补录差异展示
  hooks/
    useHeatmapData.ts       # 热力数据加载与计算
    useDataQuality.ts       # 数据质量检测逻辑
    useAuditLog.ts          # 审计日志记录
    useExport.ts            # 截图导出逻辑
  store/
    useAppStore.ts          # Zustand 全局状态
  data/
    mockStation.ts          # Mock 站厅数据
    mockTimeSlots.ts        # Mock 时间段数据
  utils/
    qualityDetector.ts      # 数据质量检测器
    diffCalculator.ts       # 增量差异计算
    watermarkRenderer.ts    # 水印渲染
  App.tsx
  main.tsx
```
