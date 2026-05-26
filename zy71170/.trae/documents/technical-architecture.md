# 应急广播覆盖游戏 - 技术架构

## 1. 架构

```mermaid
flowchart LR
    "浏览器" --> "React 18 前端"
    "React 18 前端" --> "Canvas 渲染层"
    "React 18 前端" --> "游戏引擎 (纯 TS)"
    "游戏引擎" --> "关卡数据"
    "游戏引擎" --> "状态管理 Zustand"
    "状态管理 Zustand" --> "HUD UI"
    "游戏引擎" --> "历史记录器"
    "历史记录器" --> "localStorage"
```

## 2. 技术栈
- 前端：React 18 + TypeScript + Vite + TailwindCSS
- 状态管理：Zustand
- 渲染：原生 Canvas 2D
- 数据：JSON 静态关卡配置 + localStorage 历史
- 图标：lucide-react
- 后端：无（纯前端）

## 3. 目录结构
```
src/
├── engine/         # 游戏引擎（纯逻辑）
│   ├── types.ts    # 类型定义
│   ├── levels.ts   # 关卡配置
│   ├── coverage.ts # 覆盖计算
│   ├── scoring.ts  # 评分规则
│   └── recorder.ts # 历史记录
├── components/     # UI 组件
│   ├── GameCanvas.tsx
│   ├── HUD.tsx
│   ├── Toolbar.tsx
│   ├── MainMenu.tsx
│   ├── ResultModal.tsx
│   ├── HistoryList.tsx
│   └── ReportExport.tsx
├── pages/
│   ├── HomePage.tsx
│   ├── GamePage.tsx
│   ├── HistoryPage.tsx
│   └── ReportPage.tsx
├── store/
│   └── gameStore.ts
├── App.tsx
└── main.tsx
```

## 4. 数据模型
```ts
type Building = { id; x; y; population; name; };
type Slot = { id; x; y; type; };
type Broadcast = { id; slotId; radius; power; };
type ComplaintZone = { x; y; radius; threshold; };
type Level = { id; name; budget; maxComplaints; minCoverage; buildings; slots; zones; };
type GameState = { level; broadcasts; turn; phase; score; history; };
```

## 5. 路由
| 路由 | 用途 |
|------|------|
| `/` | 主菜单 + 关卡选择 |
| `/game/:levelId` | 对局页 |
| `/history` | 历史列表 |
| `/report/:runId` | 报告查看 |

## 6. 关键算法
- 覆盖判定：欧式距离 ≤ 广播半径，判定楼栋中心点
- 噪声叠加：对每栋楼累加所有广播的噪声贡献（距离衰减），超阈值产生投诉
- 评分：覆盖率得分 - 投诉扣分 - 预算扣分，三星阈值
- 回放：记录快照，按索引播放
