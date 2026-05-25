# 考古探方分层查看系统

基于 Three.js 的 3D 交互可视化工具，专为考古工作者设计，用于数字化管理和分析探方、土层、出土物等考古数据。

## 功能特性

### 🏺 3D 可视化
- **探方网格**：3D 展示探方的三维结构和网格系统
- **土层分层**：半透明显示各土层，支持单独显示/隐藏
- **出土物标注**：不同类型出土物使用不同几何体和颜色，支持点击、悬停交互

### 📦 内置样例数据
- **正常探方 T0101**：5 层土，15 件出土物，无冲突
- **冲突探方 T0202**：包含重复编号、深度冲突、位置越界等问题
- **稀疏探方 T0303**：3 层土，仅 2 件出土物（空结果场景）
- **复杂探方 T0404**：8 层土，30 件出土物，涵盖多个历史时期

### 🎮 交互控制
- **视角切换**：透视、俯视、正视、侧视四种视角
- **鼠标操作**：左键旋转、滚轮缩放、右键平移
- **土层控制**：全部显示/隐藏，单独切换，深度范围滑块

### 🔍 筛选功能
- 按出土物类型筛选（陶器、石器、骨器、金属器、其他）
- 按年代筛选
- 按深度范围筛选
- 筛选结果实时反映在 3D 场景中

### ⏱️ 时间轴动画
- **播放/暂停**：动画展示地层堆积过程
- **速度控制**：0.5x / 1x / 2x / 4x 四档速度
- **年代切换**：点击年代标签快速切换视角
- **步进控制**：上一时期/下一时期精确控制

### 📤 数据导出与报告
- **CSV 导出**：导出当前筛选的出土物清单
- **JSON 导出**：导出完整探方数据
- **考古报告生成**：生成包含统计信息、层位信息、出土物清单的 HTML 报告

### ✅ 数据校验
- 自动检测出土物编号重复
- 检测深度与层位不符
- 检测位置越界
- 冲突数据在 3D 场景中用红色标识

## 技术栈

- **前端框架**：React 18 + TypeScript
- **构建工具**：Vite 6
- **3D 渲染**：Three.js + @react-three/fiber + @react-three/drei
- **状态管理**：Zustand
- **样式方案**：TailwindCSS 3
- **后处理效果**：@react-three/postprocessing (Bloom 效果)

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173 查看应用

### 构建生产版本

```bash
npm run build
```

### 代码检查

```bash
npm run lint
npm run check
```

## 使用说明

1. **加载数据**：点击左上角「加载样例」选择内置探方数据，或点击「导入数据」上传自定义 JSON 文件
2. **操作 3D 场景**：
   - 鼠标左键拖拽：旋转视角
   - 鼠标滚轮：缩放
   - 鼠标右键拖拽：平移
3. **控制土层显示**：
   - 使用左侧面板的土层列表切换显示/隐藏
   - 拖动深度滑块筛选指定深度范围
4. **筛选出土物**：在右侧筛选面板按类型、年代筛选
5. **查看详情**：点击出土物在右上角显示详细信息
6. **时间轴动画**：使用底部时间轴控制播放地层堆积动画
7. **导出数据**：使用顶部按钮导出 CSV、JSON 或生成考古报告

## 项目结构

```
src/
├── components/
│   ├── three/          # Three.js 3D 组件
│   │   ├── ExcavationScene.tsx
│   │   ├── Grid3D.tsx
│   │   ├── SoilLayer3D.tsx
│   │   └── Artifact3D.tsx
│   └── ui/             # UI 控制组件
│       ├── Header.tsx
│       ├── LayerPanel.tsx
│       ├── FilterPanel.tsx
│       ├── Timeline.tsx
│       ├── InfoPanel.tsx
│       └── ViewControls.tsx
├── data/
│   └── samples.ts      # 内置样例数据
├── store/
│   └── useStore.ts     # Zustand 状态管理
├── types/
│   └── index.ts        # TypeScript 类型定义
├── utils/
│   ├── dataValidator.ts
│   ├── filterEngine.ts
│   ├── exporter.ts
│   └── reportGenerator.ts
└── pages/
    └── Home.tsx        # 主页面
```

## 数据格式

导入的 JSON 数据格式示例：

```json
{
  "id": "t0101",
  "name": "探方 T0101",
  "gridSize": { "x": 100, "y": 100, "z": 150 },
  "unit": "cm",
  "layers": [
    {
      "id": "layer1",
      "name": "第1层 耕土层",
      "color": "#8B7355",
      "depthTop": 0,
      "depthBottom": 20,
      "period": "现代",
      "description": "表层耕土",
      "visible": true
    }
  ],
  "artifacts": [
    {
      "id": "a1",
      "artifactId": "T0101:001",
      "name": "青花瓷片",
      "type": "pottery",
      "position": { "x": 25, "y": 30, "z": 35 },
      "layerId": "layer1",
      "period": "明清",
      "description": "清代青花瓷碗残片",
      "selected": false
    }
  ]
}
```
