# 管网阀门隔离演练系统

基于 WebGL 的交互式管网仿真工具，专为水务调度员设计，用于在抢修前模拟阀门关闭操作，预测影响用户范围，验证隔离方案的有效性。

## ✨ 功能特性

### 🎮 核心功能

- **WebGL 3D 管网可视化** - 基于 Three.js 的高性能 3D 渲染，支持管线发光效果、辉光后处理
- **阀门交互操作** - 点击阀门切换开/关状态，实时计算隔离区域
- **影响分析** - 自动统计受影响用户片区和户数，检测环网方向、阀门失效等冲突
- **时间轴回放** - 记录操作历史，支持播放/暂停/单步回放
- **方案管理** - 保存/加载多个隔离方案，导出 PDF/JSON 报告

### 📊 高级功能

- **自定义场景导入** - 支持 JSON 格式的自定义管网数据导入
- **多方案对比** - 支持最多 3 个方案并列对比，差异可视化
- **多视角切换** - 3D 视图 / 俯视图 / 正视图
- **图层控制** - 可切换显示用户片区、阀门、抢修点

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173 查看应用

### 生产构建

```bash
npm run build
```

### 代码检查

```bash
npm run lint
```

### TypeScript 类型检查

```bash
npm run check
```

## 📖 使用指南

### 1. 选择演练场景

在左侧「场景」面板中选择演练场景：

- **正常场景** - 典型城市供水环网，可有效隔离
- **冲突场景** - 包含失效阀门，隔离方案存在冲突
- **空结果场景** - 简单管网，用于测试边界情况

**导入自定义场景：**
1. 点击「下载模板」获取 JSON 模板
2. 按照模板格式填写管网数据
3. 点击「导入」按钮选择 JSON 文件

### 2. 操作阀门

在 3D 视图中：
- 🖱️ **左键拖动** - 旋转视角
- **滚轮** - 缩放视图
- **右键拖动** - 平移视图
- **点击阀门球体** - 切换开关状态

阀门状态颜色：
- 🟢 绿色 - 开启
- 🔴 红色 - 关闭
- 🟠 橙色 - 失效（不可操作）

### 3. 查看影响分析

切换到「分析」面板，实时查看：
- 受影响片区数量
- 受影响用户户数
- 隔离管线和节点数量
- 冲突检测（抢修点未隔离、阀门失效等）

### 4. 时间轴操作

使用底部时间轴：
- ⏮️ 回到开始
- ⏪ 上一步
- ▶️ 播放/暂停
- ⏩ 下一步
- 🎚️ 拖拽滑块快速定位

### 5. 方案管理

切换到「方案」面板：

**保存方案：**
1. 调整阀门状态后，点击「保存方案」
2. 输入方案名称
3. 方案会保存在浏览器内存中

**方案对比：**
1. 勾选需要对比的方案（最多 3 个）
2. 点击「对比」按钮
3. 查看并列视图和差异分析：
   - 用户数量差异
   - 阀门操作差异
   - 共同关闭的阀门
   - 片区差异

**导出报告：**
- 📄 PDF 格式报告 - 包含方案摘要、操作记录、影响详情
- 📋 JSON 格式数据 - 完整方案数据

### 6. 视图控制

切换到「视图」面板：
- 切换 3D/俯视/正视视角
- 控制用户片区、阀门、抢修点的显示
- 一键重置演练状态

## 📁 项目结构

```
src/
├── components/
│   ├── NetworkScene/          # 3D 场景组件
│   │   ├── NetworkCanvas.tsx  # R3F 画布
│   │   ├── PipeRenderer.tsx   # 管线渲染
│   │   ├── ValveRenderer.tsx  # 阀门渲染
│   │   ├── NodeRenderer.tsx   # 节点渲染
│   │   ├── ZoneRenderer.tsx   # 用户片区渲染
│   │   └── RepairPoint.tsx    # 抢修点渲染
│   └── ControlPanel/          # 控制面板组件
│       ├── ScenarioSelector.tsx    # 场景选择器
│       ├── ViewControls.tsx        # 视图控制
│       ├── ImpactAnalysis.tsx      # 影响分析
│       ├── SolutionManager.tsx     # 方案管理
│       ├── SolutionComparison.tsx  # 方案对比
│       └── Timeline.tsx            # 时间轴
├── store/                     # Zustand 状态管理
│   └── useNetworkStore.ts
├── utils/                     # 工具函数
│   ├── networkAnalyzer.ts     # 拓扑分析算法
│   └── reportGenerator.ts     # 报告生成
├── data/                      # 内置场景数据
│   └── scenarios/
├── types/                     # TypeScript 类型定义
├── pages/                     # 页面组件
└── App.tsx                    # 应用入口
```

## 🔧 核心算法

### 管网拓扑分析

- 使用**邻接表**表示管网连接关系
- **BFS 广度优先搜索**进行连通性分析
- 支持环网检测和方向验证

### 阀门隔离计算

- 基于**割集理论**的隔离区域识别
- 处理阀门失效的边界情况
- 去重统计受影响用户片区

### 冲突检测

- 检测隔离区域是否包含水源
- 验证阀门操作顺序的合理性
- 识别重复影响的用户区域

## 📋 场景数据格式

```json
{
  "name": "自定义场景名称",
  "type": "normal",
  "description": "场景描述",
  "initialNetwork": {
    "nodes": [
      {
        "id": "n1",
        "x": -15,
        "y": 0,
        "z": -10,
        "type": "source",
        "pressure": 4.5
      }
    ],
    "pipes": [
      {
        "id": "p1",
        "fromNode": "n1",
        "toNode": "n2",
        "diameter": 300,
        "length": 500,
        "flowDirection": "forward"
      }
    ],
    "valves": [
      {
        "id": "v1",
        "pipeId": "p1",
        "position": 0.2,
        "status": "open",
        "type": "gate"
      }
    ],
    "customerZones": [
      {
        "id": "z1",
        "name": "A区-住宅区",
        "nodeIds": ["n6", "n9"],
        "customerCount": 1250,
        "type": "residential",
        "color": "#4CAF50"
      }
    ],
    "repairPoints": [
      {
        "id": "r1",
        "pipeId": "p6",
        "position": 0.7,
        "description": "管段爆裂漏水",
        "priority": "high"
      }
    ]
  }
}
```

## 🛠️ 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite 6
- **样式方案**: TailwindCSS 3
- **状态管理**: Zustand 5
- **3D 渲染**: Three.js + React Three Fiber
- **后处理效果**: React Three Postprocessing
- **图标库**: Lucide React
- **报告导出**: jsPDF

## 📝 开发说明

### 快捷键

- `R` - 重置演练状态
- `空格` - 播放/暂停时间轴
- `←` / `→` - 单步后退/前进

### 浏览器兼容性

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

需要支持 WebGL 2.0 的浏览器

## 📄 许可证

MIT License
