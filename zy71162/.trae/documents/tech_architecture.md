# 公交改线调度游戏 技术架构

## 1. 架构设计
纯前端单页应用，无需后端。使用 React 负责界面与状态管理，Canvas 绘制 2D 地图与车辆。运行时模拟（simulation）与 React UI 通过共享状态和事件总线解耦。

```mermaid
flowchart LR
  "A[React UI 层]" --> "B[状态 Store (Zustand)]"
  "B" --> "C[仿真引擎 SimulationEngine]"
  "C" --> "D[Canvas 渲染]"
  "C" --> "E[事件日志/投诉系统]"
  "B" --> "F[LocalStorage 存档]"
  "F" --> "G[历史回放 ReplayPlayer]"
```

## 2. 技术选型
- 前端：React 18 + TypeScript + Vite 5
- 样式：TailwindCSS 3 + 自定义 CSS 变量（深色主题）
- 状态管理：Zustand（轻量、支持时间旅行，方便回放）
- 渲染：HTML5 Canvas 2D
- 图标：Lucide React
- 构建：Vite 5
- 后端：无
- 数据库：LocalStorage（用于保存历史回放）

## 3. 路由定义
| 路由 | 目的 |
|-----|-----|
| `/` | 主菜单：关卡选择、历史回放、规则说明 |
| `/level/:id` | 关卡调度界面 |
| `/replay/:id` | 历史回放界面 |

## 4. 数据模型

### 4.1 核心实体
- **Stop（站点）**：id, name, x, y, lines[]
- **Route（线路）**：id, name, color, stops[], optionalStops[]（备用站点集合）
- **Vehicle（车辆）**：id, routeId, stopIndex, progress, load, capacity, status
- **Closure（施工封路）**：id, fromStop, toStop, startMinute, endMinute
- **PassengerEvent（客流）**：minute, stopId, count
- **EventLog（事件）**：minute, level, message, relatedId

### 4.2 状态定义（Zustand）
```
GameState {
  phase: 'menu' | 'running' | 'paused' | 'ended'
  levelId: string
  currentMinute: number
  speed: 1 | 2 | 4
  routes: Route[]
  vehicles: Vehicle[]
  closures: Closure[]
  logs: EventLog[]
  stats: { punctuality, intervalCV, complaints, loadFactor, coverage }
  failures: string[]
  score: number
}
```

## 5. 仿真引擎规则
- 每 `tick` 推进游戏时间（由 `speed` 决定，1 tick = 1 游戏分钟 = 1000ms / speed）。
- 车辆按站点顺序推进，每站停留 30 秒，相邻站点间根据距离计算行驶时间。
- 乘客在站点等候，随车辆进站上下；若等待超过 10 分钟累积投诉。
- 施工封路触发：车辆所在线路原路段不可用 → 自动切换备用路径，增加延误。
- 玩家跳站：跳过指定站点 → 该站乘客累积投诉。
- 派车：从总站车库（总站站点可停车）发车投入指定线路。
- 评分在 `phase='ended'` 时基于累计 stats 计算。

## 6. 历史回放
- 每关开始时，在 Zustand 中开启 `history` 订阅，记录每 tick 的完整状态快照（或仅记录差异操作）。
- 关卡结束时将快照序列序列化写入 LocalStorage，键名为 `replay:levelId:timestamp`。
- 回放页读取快照，基于时间轴还原 UI 与 Canvas。

## 7. 结算与导出
- 结算页读取最终 stats，按权重计算总分。
- 导出：生成 JSON（完整 stats + 日志摘要）与 Markdown 文本，触发浏览器下载。

## 8. 目录结构
```
src/
  components/
    MapCanvas.tsx
    ControlPanel.tsx
    EventLog.tsx
    DispatchPanel.tsx
    ScoreReport.tsx
    LevelCard.tsx
  engine/
    SimulationEngine.ts
    types.ts
    scoring.ts
  store/
    gameStore.ts
    replayStore.ts
  levels/
    level1.ts
    level2.ts
    level3.ts
  pages/
    Home.tsx
    Level.tsx
    Replay.tsx
  App.tsx
  main.tsx
  index.css
```

## 9. 关卡数据示例（level1.ts）
```ts
{
  id: 'L1',
  name: '常规运营',
  durationMin: 15,
  routes: [
    { id: 'R1', color: '#3AA0FF', stops: ['S1','S2','S3','S4','S5'] }
  ],
  stations: [
    { id: 'S1', name: '火车站', x: 60, y: 200 },
    { id: 'S2', name: '市政府', x: 200, y: 200 },
    { id: 'S3', name: '中心广场', x: 380, y: 200 },
    { id: 'S4', name: '医院',   x: 560, y: 200 },
    { id: 'S5', name: '大学',   x: 720, y: 200 }
  ],
  initialFleet: 3,
  maxComplaints: 8,
  maxDelayMin: 6,
  minCoverage: 0.8,
  closures: [],
  passengerEvents: [
    { minute: 3,  stopId: 'S1', count: 6 },
    { minute: 5,  stopId: 'S3', count: 8 },
    { minute: 8,  stopId: 'S4', count: 5 }
  ]
}
```
