# 电池轮换调度器

一款专为小型影棚设计的拍摄日相机电池和充电器轮换管理工具。

## 功能特性

### 📋 核心功能

- **时间轴模拟**：按时间轴模拟电池电量消耗和充电恢复
- **风险检测**：自动检测以下风险
  - 🔴 **电池耗尽**：模拟过程中电池电量降至 0
  - 🟠 **电量危急**：电量低于 5%
  - 🟡 **电量低**：电量低于 20%
  - ⚠️ **电池冲突**：同一电池被多个场景同时分配
  - ⏰ **跨场延迟**：电池在场景间转场时间不足 15 分钟

### 🎯 边界情况支持

- **跨午夜拍摄**：完美处理 `22:00 - 02:00` 这类跨越午夜的场景
- **电池冲突检测**：同一电池被两台机身同时占用时会自动标记为危急风险

### 🔧 用户操作

- **手动调整**：可手动调整电池分配（UI 支持，核心逻辑已实现）
- **撤销/重做**：支持 `Ctrl+Z` / `Cmd+Z` 撤销，`Ctrl+Shift+Z` / `Cmd+Shift+Z` 重做
- **数据导入**：支持粘贴 JSON 格式的拍摄计划
- **示例数据**：内置两个示例拍摄计划
  - 日间拍摄：含午休充电、夜戏跨午夜
  - 夜景延时：含电池冲突、电量不足风险

### 📥 导出功能

- **JSON 导出**：导出完整的拍摄计划和模拟结果
- **风险报告**：导出格式化的 `risk_report.md` 风险报告

## 本地预览

### 前置要求

- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

服务器启动后，在浏览器中访问显示的本地地址（通常是 `http://localhost:5173`）。

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

## 项目结构

```
src/
├── types/
│   └── index.ts          # 类型定义
├── data/
│   └── sampleSchedule.ts # 示例拍摄计划
├── engine/
│   └── scheduler.ts      # 排程引擎（核心算法）
├── store/
│   └── state.ts          # 状态管理（Reducer + Undo/Redo）
├── utils/
│   ├── time.ts           # 时间工具函数
│   ├── parser.ts         # JSON 解析器
│   └── exporter.ts       # 导出功能（JSON + Markdown）
├── styles/
│   └── main.css          # 样式文件
└── main.ts               # 主入口文件 + UI 渲染
```

## 模块说明

### 1. 解析模块 (`parser.ts`)

负责解析导入的 JSON 数据，进行完整的数据验证：

- 验证时间格式（支持 `{hour, minute}` 对象或 `"HH:MM"` 字符串）
- 验证相机、电池、充电器的必填字段
- 验证场景时间范围和相机分配

### 2. 排程引擎 (`scheduler.ts`)

核心模拟算法，执行以下步骤：

1. **预检查**：检测场景间电池冲突、跨场转场时间
2. **时间步进模拟**：以 5 分钟为步长模拟全天
3. **电量消耗**：根据相机功耗计算每步电量消耗
4. **充电恢复**：根据充电器功率计算充电速度
5. **冲突检测**：实时检测电池冲突、充电口抢占
6. **风险记录**：记录所有检测到的风险

### 3. 状态管理 (`state.ts`)

基于 Reducer 模式的状态管理：

- `LOAD_SCHEDULE`：加载新的拍摄计划
- `RUN_SIMULATION`：存储模拟结果
- `APPLY_ADJUSTMENT`：应用手动调整（记录历史）
- `UNDO` / `REDO`：撤销/重做操作

### 4. UI 组件 (`main.ts`)

响应式 UI 渲染，包含：

- **左侧栏**：场景列表、导入面板
- **中间内容**：时间轴、场景详情
- **右侧栏**：电池状态、充电器、风险检测面板

## 数据格式

### ShootingSchedule (拍摄计划)

```json
{
  "id": "sample-001",
  "name": "商业广告拍摄",
  "date": "2026-05-03",
  "cameras": [
    {
      "id": "cam-1",
      "name": "Sony A7 IV #1",
      "powerConsumption": 10,
      "compatibleBatteryTypes": ["NP-FZ100"]
    }
  ],
  "batteries": [
    {
      "id": "bat-1",
      "name": "FZ100 #1",
      "type": "NP-FZ100",
      "capacity": 100,
      "initialCharge": 100,
      "currentCharge": 100,
      "status": "idle"
    }
  ],
  "chargers": [
    {
      "id": "charger-1",
      "name": "索尼双充",
      "ports": [
        {
          "id": "port-1",
          "chargerId": "charger-1",
          "name": "A口",
          "compatibleBatteryTypes": ["NP-FZ100"],
          "chargingSpeed": 20
        }
      ]
    }
  ],
  "scenes": [
    {
      "id": "scene-1",
      "name": "开场 - 产品展示",
      "timeRange": {
        "start": { "hour": 9, "minute": 0 },
        "end": { "hour": 10, "minute": 30 }
      },
      "cameras": [
        { "cameraId": "cam-1", "batteryId": "bat-1" }
      ],
      "notes": "主镜头 + 侧机位"
    }
  ]
}
```

### 关键说明

- **powerConsumption**：相机每小时消耗的电量百分比
- **chargingSpeed**：充电器每小时充电的电量百分比
- **timeRange**：支持跨午夜（如 `start: 22:00, end: 02:00`）
- **compatibleBatteryTypes**：用于验证电池和相机/充电器的兼容性

## 风险类型说明

| 类型 | 严重程度 | 触发条件 |
|------|----------|----------|
| `battery_depleted` | critical | 电量 = 0% |
| `battery_critical` | high | 电量 ≤ 5% |
| `simultaneous_use` | critical | 同一电池被多个重叠场景同时分配 |
| `cross_scene_late` | medium/high | 转场时间 < 15 分钟（<5 分钟为 high） |
| `battery_low` | medium | 电量 ≤ 20% |
| `port_conflict` | (待实现) | 多个电池争抢同一充电口 |

## 使用流程

1. **选择示例或导入数据**
   - 点击左侧"日间拍摄"或"夜景延时"加载示例
   - 或粘贴自己的 JSON 数据，点击"解析并导入"

2. **查看场景和时间轴**
   - 左侧列表显示所有场景
   - 中间时间轴可视化场景时间
   - 点击场景查看详情

3. **运行模拟**
   - 点击顶部"运行模拟"按钮
   - 等待几秒钟完成模拟

4. **查看风险**
   - 右侧面板显示所有检测到的风险
   - 按严重程度排序（危急 > 高 > 中 > 低）
   - 场景列表中会用颜色标记有风险的场景

5. **导出报告**
   - 点击"导出 JSON"下载完整数据
   - 点击"导出报告"下载格式化的 Markdown 风险报告

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Z` / `Cmd+Z` | 撤销 |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | 重做 |

## 技术栈

- **Vite**：构建工具
- **TypeScript**：类型安全
- **原生 DOM**：无框架依赖，轻量快速
- **CSS Variables**：主题变量，支持明暗模式

## 开发说明

项目使用纯 TypeScript + 原生 DOM 实现，无额外前端框架依赖，便于理解和扩展。

### 扩展建议

- 添加拖拽功能：支持在时间轴上拖拽调整电池分配
- 添加实时编辑：在 UI 中直接编辑场景时间、电池分配
- 添加保存功能：使用 localStorage 保存当前状态
- 添加更多图表：电池电量随时间变化的曲线图
- 添加冲突解决建议：自动推荐如何调整电池分配来消除风险

## License

MIT
