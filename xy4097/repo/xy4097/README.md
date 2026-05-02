# 🏛️ 展厅人流热区推演器

一个给博物馆布展安全员使用的本地 3D 交互工具，用于在临展前提前发现人流瓶颈。

## ✨ 功能特性

- 🎨 **3D 场景渲染** - 基于 Three.js 的 3D 展厅可视化
- 🔍 **智能寻路** - A* 算法实现的人流路径模拟
- 🌡️ **热力分析** - 实时显示人流密度和拥堵区域
- ⚠️ **风险评估** - 检测拥挤、滞留、逆行、瓶颈等风险
- 🖱️ **交互编辑** - 支持拖动展柜重新调整布局
- 💾 **数据导出** - 导出 PNG 截图和 Markdown 风险报告
- 📊 **时段模拟** - 支持不同预约时段的人流模拟

## 📁 项目结构

```
xy4097/
├── src/
│   ├── types/              # 类型定义
│   │   └── index.ts
│   ├── parsers/            # 数据解析模块
│   │   ├── jsonParser.ts   # JSON 展厅配置解析
│   │   └── csvParser.ts    # CSV 时段数据解析
│   ├── renderers/          # 场景渲染模块
│   │   ├── SceneRenderer.ts    # 主场景渲染器
│   │   ├── ObjectFactory.ts    # 3D 物体工厂
│   │   └── HeatmapRenderer.ts  # 热图渲染器
│   ├── engine/             # 模拟引擎模块
│   │   ├── SimulationEngine.ts # 人流模拟引擎
│   │   └── PathFinder.ts       # A* 寻路算法
│   ├── stores/             # 状态管理模块
│   │   └── AppState.ts     # 应用状态管理器
│   ├── exporters/          # 报告导出模块
│   │   └── ReportExporter.ts   # Markdown 报告生成
│   └── main.ts             # 主程序入口
├── tests/                  # 测试文件
│   ├── jsonParser.test.ts
│   ├── csvParser.test.ts
│   └── pathFinder.test.ts
├── public/                 # 公共资源
│   ├── exhibition_example.json  # 示例展厅配置
│   └── timeslots_example.csv   # 示例时段数据
├── index.html              # 主页面
├── package.json            # 项目配置
├── tsconfig.json           # TypeScript 配置
└── vite.config.ts          # Vite 配置
```

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- 现代浏览器（支持 WebGL）

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

启动后浏览器会自动打开 `http://localhost:3000`

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist/` 目录

### 预览生产版本

```bash
npm run preview
```

### 运行测试

```bash
npm run test
```

## 📖 使用指南

### 1. 数据导入

#### 方式一：加载示例数据

点击界面上的 **「加载示例数据」** 按钮，系统会自动加载预设的示例展厅和时段数据。

#### 方式二：导入自定义数据

1. **展厅配置 JSON** - 点击「选择展厅配置 JSON」按钮
2. **时段数据 CSV** - 点击「选择时段数据 CSV」按钮

### 2. 时段选择

在「时段选择」区域选择需要模拟的时段，不同时段对应不同的预约人数。

### 3. 开始模拟

1. 点击 **「开始模拟」** 按钮启动人流模拟
2. 点击 **「暂停」** 按钮暂停模拟
3. 点击 **「重置」** 按钮重置模拟状态

### 4. 调整布局

在 3D 场景中，你可以直接用鼠标 **拖动展柜** 来调整布局。调整后点击 **「重新计算」** 按钮重新进行人流模拟。

### 5. 导出结果

- **导出 PNG** - 导出当前 3D 场景的截图
- **导出报告** - 导出详细的 Markdown 风险分析报告
- **保存方案** - 保存当前的展厅布局配置

## 📝 数据格式说明

### 展厅配置 JSON

```json
{
  "version": "1.0.0",
  "exhibitionName": "展览名称",
  "exhibitionDate": "2026-06-01",
  "venue": "展馆名称",
  "floor": {
    "width": 20,
    "depth": 15,
    "height": 0.1
  },
  "elements": [
    {
      "id": "entrance_1",
      "type": "entrance",
      "name": "主入口",
      "position": { "x": -9, "z": 0 },
      "dimensions": { "width": 2, "depth": 2, "height": 0.1 }
    },
    {
      "id": "exit_1",
      "type": "exit",
      "name": "主出口",
      "position": { "x": 9, "z": 0 },
      "dimensions": { "width": 2, "depth": 2, "height": 0.1 }
    },
    {
      "id": "exhibit_1",
      "type": "exhibit",
      "name": "展柜名称",
      "position": { "x": 0, "z": 0 },
      "dimensions": { "width": 3, "depth": 2, "height": 2 }
    },
    {
      "id": "restricted_1",
      "type": "restricted",
      "name": "禁行区",
      "position": { "x": -9, "z": 5 },
      "dimensions": { "width": 2, "depth": 3, "height": 0.1 }
    }
  ]
}
```

#### 元素类型说明

| 类型 | 说明 | 颜色 |
|------|------|------|
| `entrance` | 入口 | 绿色 |
| `exit` | 出口 | 蓝色 |
| `exhibit` | 展柜 | 橙色 |
| `restricted` | 禁行区 | 灰色 |
| `obstacle` | 障碍物 | 棕色 |

### 时段数据 CSV

```csv
id,startTime,endTime,visitorCount,description
TS001,09:00,10:00,80,开馆第一时段
TS002,10:00,11:00,120,高峰时段
TS003,11:00,12:00,100,午间时段
```

#### 字段说明

| 字段 | 说明 | 示例 |
|------|------|------|
| `id` | 时段唯一标识 | TS001 |
| `startTime` | 开始时间 | 09:00 |
| `endTime` | 结束时间 | 10:00 |
| `visitorCount` | 该时段预计访客数 | 80 |
| `description` | 时段描述（可选） | 开馆第一时段 |

## ⚠️ 风险等级说明

| 等级 | 颜色 | 密度阈值 | 说明 |
|------|------|----------|------|
| 🔴 严重 | 红色 | >= 5 人/㎡ | 极高风险，需立即处理 |
| 🟠 高风险 | 橙色 | >= 3 人/㎡ | 高风险，建议调整 |
| 🟡 中风险 | 黄色 | >= 1.5 人/㎡ | 中等风险，需要关注 |
| 🟢 低风险 | 绿色 | < 1.5 人/㎡ | 正常状态 |

## 🔍 风险类型说明

| 类型 | 图标 | 说明 |
|------|------|------|
| 拥挤 | 🚶‍‍‍🚶‍‍‍ | 区域内人员密度过高 |
| 滞留 | ⏸️ | 人员在区域内停留时间过长 |
| 逆行 | ↔️ | 人员方向相反可能导致冲突 |
| 瓶颈 | 🚧 | 通道狭窄可能导致堵塞 |

## 🎮 操作说明

| 操作 | 说明 |
|------|------|
| 鼠标左键拖动 | 旋转 3D 视角 |
| 鼠标滚轮 | 缩放场景 |
| 鼠标左键拖动展柜 | 移动展柜位置 |
| 点击「加载示例数据」 | 快速体验功能 |
| 点击「开始模拟」 | 启动人流模拟 |

## 🧪 测试说明

项目使用 Vitest 进行单元测试，测试文件位于 `tests/` 目录。

### 运行所有测试

```bash
npm run test
```

### 测试覆盖模块

- `jsonParser.test.ts` - JSON 展厅配置解析测试
- `csvParser.test.ts` - CSV 时段数据解析测试
- `pathFinder.test.ts` - A* 寻路算法测试

## 🛠️ 技术栈

- **语言**: TypeScript
- **3D 引擎**: Three.js
- **构建工具**: Vite
- **测试框架**: Vitest
- **包管理**: npm

## 📋 本地验证流程

1. **安装依赖**
   ```bash
   npm install
   ```

2. **启动开发服务器**
   ```bash
   npm run dev
   ```

3. **验证功能**
   - 浏览器打开 `http://localhost:3000`
   - 点击「加载示例数据」按钮
   - 选择一个时段（如 10:00-11:00 高峰时段）
   - 点击「开始模拟」
   - 观察 3D 场景中的人流移动和热区显示
   - 拖动展柜调整位置
   - 点击「重新计算」查看调整后的效果
   - 点击「导出报告」生成风险分析报告

4. **运行测试（可选）**
   ```bash
   npm run test
   ```

5. **构建生产版本（可选）**
   ```bash
   npm run build
   ```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**注意**: 此工具仅用于临展前的人流模拟和风险评估，实际运营中请配合现场安全员和监控系统使用。
