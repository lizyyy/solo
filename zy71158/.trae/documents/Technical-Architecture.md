## 1. 架构设计

```mermaid
flowchart TD
    "Frontend Layer" --> "Game Engine"
    "Game Engine" --> "Canvas Renderer"
    "Game Engine" --> "State Manager"
    "State Manager" --> "Zustand Store"
    "Game Engine" --> "Simulation Logic"
    "Simulation Logic" --> "Electricity Calc"
    "Simulation Logic" --> "Smoke Diffusion"
    "Simulation Logic" --> "Complaint System"
    "Simulation Logic" --> "Random Events"
    "Simulation Logic" --> "Scoring Engine"
    "Game Engine" --> "History Recorder"
    "History Recorder" --> "Replay System"
    "Game Engine" --> "Report Generator"
```

## 2. 技术说明

- **前端框架**：React@18 + TypeScript
- **构建工具**：Vite@5
- **样式方案**：Tailwind CSS@3
- **状态管理**：Zustand
- **路由**：React Router DOM@6（单页面，主要用状态切换而非路由）
- **图标**：Lucide React
- **Canvas 渲染**：原生 Canvas 2D API
- **后端**：无后端，纯前端游戏，数据导出为 JSON 文件下载

## 3. 项目结构

```
src/
├── components/
│   ├── game/
│   │   ├── GameCanvas.tsx          # Canvas 渲染组件
│   │   ├── ControlPanel.tsx        # 左侧摊位控制面板
│   │   ├── Dashboard.tsx           # 右侧仪表盘
│   │   ├── EventLog.tsx            # 底部事件日志
│   │   ├── TopBar.tsx              # 顶部状态栏
│   │   ├── StallItem.tsx           # 单个摊位操作单元
│   │   └── SmokeOverlay.tsx        # 油烟覆盖层（Canvas 内）
│   ├── ui/
│   │   ├── Modal.tsx               # 通用弹窗
│   │   ├── ProgressBar.tsx         # 进度条组件
│   │   ├── Slider.tsx              # 滑块组件
│   │   └── Button.tsx              # 按钮组件
│   ├── modals/
│   │   ├── SettlementModal.tsx     # 结算弹窗
│   │   ├── ReplayModal.tsx         # 历史回放弹窗
│   │   └── LevelSelectModal.tsx    # 关卡选择弹窗
│   └── pages/
│       └── GamePage.tsx            # 游戏主页面
├── hooks/
│   ├── useGameLoop.ts              # 游戏主循环 Hook
│   ├── useCanvasRenderer.ts        # Canvas 渲染 Hook
│   └── useHistoryRecorder.ts       # 历史记录 Hook
├── store/
│   └── gameStore.ts                # Zustand 游戏状态
├── types/
│   └── game.ts                     # 类型定义
├── utils/
│   ├── simulation.ts               # 模拟逻辑（用电/油烟/投诉计算）
│   ├── scoring.ts                  # 评分引擎
│   ├── events.ts                   # 随机事件生成
│   ├── report.ts                   # 报告生成
│   └── levels.ts                   # 关卡配置
└── App.tsx
```

## 4. 类型定义

```typescript
// 摊位类型
interface Stall {
  id: string;
  name: string;
  type: 'food' | 'drink' | 'craft';
  position: { x: number; y: number };
  power: number;           // 当前功率 0-100
  maxPower: number;        // 最大功率
  exhaustLevel: number;    // 排烟档位 0-3
  isOn: boolean;
  smokeOutput: number;     // 油烟产出量
}

// 游戏状态
interface GameState {
  phase: 'menu' | 'playing' | 'paused' | 'settlement' | 'replay';
  level: number;
  round: number;
  maxRounds: number;
  timeRemaining: number;   // 本回合剩余秒数
  totalElectricity: number;
  maxElectricity: number;
  totalSmoke: number;
  complaints: number;
  maxComplaints: number;
  score: number;
  money: number;
  stalls: Stall[];
  customers: Customer[];
  events: GameEvent[];
  history: HistoryFrame[];
}

// 事件类型
interface GameEvent {
  id: string;
  type: 'warning' | 'info' | 'penalty' | 'reward';
  message: string;
  round: number;
  timestamp: number;
}

// 历史帧
interface HistoryFrame {
  round: number;
  timestamp: number;
  snapshot: Partial<GameState>;
  action: string;
}

// 评分明细
interface ScoreBreakdown {
  efficiency: number;      // 用电效率分
  compliance: number;      // 合规分（油烟/投诉）
  profit: number;          // 经营收益分
  penalty: number;         // 违规扣分
  total: number;
}
```

## 5. 核心算法

### 5.1 用电容量计算

```
总用电 = Σ(摊位功率 × 最大功率 × 开关状态)
超限判定：总用电 > 最大容量
超限处罚：每超限 10% 扣 5 分，累计超限 3 回合触发跳闸
```

### 5.2 油烟扩散算法

```
每摊位油烟产出 = 功率 × 油烟系数 × (1 - 排烟效率)
邻摊影响 = 距离衰减函数(当前摊位油烟, 距离)
总油烟 = 各摊位油烟 + 邻摊影响
投诉触发：油烟 > 阈值 持续 2 回合
```

### 5.3 评分引擎

```
效率分 = (1 - |实际用电 - 理想用电| / 理想用电) × 30
合规分 = (1 - 投诉 / 最大投诉) × 30 + (1 - 油烟 / 最大油烟) × 20
经营分 = 收益 / 目标收益 × 20
总扣分 = 错误操作 × 2 + 超时 × 5 + 资源浪费 × 3
最终分 = max(0, 效率分 + 合规分 + 经营分 - 总扣分)
```

### 5.4 失败判定

```
失败条件：
1. 投诉值 >= 最大投诉值
2. 连续 3 回合用电超限触发跳闸
3. 资金 < 0（可选困难模式）
```