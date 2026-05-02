# 灯位安全预演台

一款专为舞台灯光设计助理打造的 3D 交互安全预演工具，帮助在彩排前识别并规避灯具碰撞、吊杆遮挡、照度断层等风险。

## 功能特性

- **3D 舞台视图**：基于 Three.js 的交互式 3D 场景，支持旋转、缩放、平移
- **时间轴回放**：按时间轴实时回放灯位变化和演员走位
- **多类型风险检测**：
  - 🔴 **碰撞风险**：灯具光束照射到演员、演员与灯具距离过近
  - 🟡 **遮挡风险**：吊杆之间高度不足导致互相遮挡
  - 🟡 **照度不足**：演员位置照度低于目标值
  - 🔴 **超高风险**：演员或吊杆超出限制高度
  - 🔴 **禁入区**：演员进入禁入区域
- **实时调整**：支持手动调整灯具角度（Pan/Tilt）、吊杆高度、灯具强度
- **数据导入**：支持 JSON（完整项目）和 CSV（单项数据）导入
- **报告导出**：导出 Markdown 格式风险报告和 JSON 格式调整记录

## 技术栈

- **前端框架**：React 18 + TypeScript
- **3D 渲染**：Three.js + OrbitControls
- **状态管理**：Zustand
- **数据解析**：PapaParse (CSV)
- **构建工具**：Vite 6
- **图标**：Lucide React
- **测试框架**：Vitest

## 项目结构

```
src/
├── components/           # React 组件
│   ├── App.tsx          # 主应用组件
│   ├── Stage3DView.tsx  # 3D 舞台视图组件
│   ├── TimelineControls.tsx  # 时间轴控制组件
│   ├── RiskPanel.tsx    # 风险面板组件
│   ├── PropertyPanel.tsx  # 属性编辑面板
│   ├── ImportDialog.tsx # 导入对话框
│   └── ExportDialog.tsx # 导出对话框
├── types/
│   └── index.ts         # 类型定义（StageProject, Risk, Actor 等）
├── store/
│   └── index.ts         # Zustand 状态管理
├── renderer/
│   └── StageRenderer.ts # Three.js 3D 渲染器
├── risk/
│   └── index.ts         # 风险规则引擎
├── parsers/
│   └── index.ts         # JSON/CSV 数据解析
├── persistence/
│   └── index.ts         # 本地存储持久化
├── export/
│   └── index.ts         # Markdown/JSON 导出
├── utils/
│   └── math.ts          # 数学工具函数（插值、角度转换等）
├── data/
│   ├── defaultProject.ts  # 默认示例项目数据
│   ├── sample-stage.csv   # 示例舞台尺寸 CSV
│   ├── sample-actors.csv  # 示例演员 CSV
│   └── sample-actor-timeline.csv  # 示例演员时间轴 CSV
├── tests/               # 单元测试
│   ├── utils.test.ts
│   ├── risk.test.ts
│   └── parsers.test.ts
├── main.tsx             # 应用入口
└── vite-env.d.ts        # Vite 环境类型
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

应用将在 `http://localhost:5173` 启动。

### 3. 运行测试

```bash
npm run test
```

### 4. 构建生产版本

```bash
npm run build
```

## 验证流程

### 流程一：基础功能验证

1. **启动应用**
   ```bash
   npm run dev
   ```
   打开浏览器访问显示的地址。

2. **检查 3D 视图**
   - 确认舞台、吊杆、灯具、演员模型正确显示
   - 尝试鼠标拖动旋转视图、滚轮缩放、右键平移
   - 确认台口框架（两侧柱子和顶部横梁）正确渲染

3. **测试时间轴控制**
   - 点击"播放"按钮，观察演员按时间轴移动
   - 拖动时间轴滑块，观察场景随时间变化
   - 调整播放速度（0.25x ~ 4x），确认播放速度变化
   - 使用"后退"和"前进"按钮步进时间

4. **验证风险检测**
   - 观察右侧风险面板，确认显示当前时刻的风险
   - 点击风险项，确认时间轴跳转到对应时刻
   - 观察 3D 视图中风险标记球（红色=严重，黄色=警告，蓝色=信息）

### 流程二：交互编辑验证

1. **选择对象**
   - 点击 3D 视图中的灯具、吊杆或演员
   - 确认左侧属性面板显示选中对象的详细信息
   - 确认选中对象在 3D 视图中高亮显示（绿色发光）

2. **调整灯具参数**
   - 选中任意灯具
   - 拖动"Pan (水平旋转)"滑块，观察灯具水平旋转
   - 拖动"Tilt (垂直俯仰)"滑块，观察灯具俯仰角度变化
   - 拖动"亮度"滑块，观察灯具强度变化
   - 在"调整原因"输入框中输入说明文字

3. **调整吊杆高度**
   - 选中任意吊杆
   - 拖动高度滑块，观察吊杆上下移动

4. **重置项目**
   - 点击顶部导航栏的"重置"按钮
   - 确认所有调整被还原到初始状态

### 流程三：数据导入导出验证

1. **导入 CSV 数据**
   - 点击"导入"按钮打开导入对话框
   - 可以使用 `src/data/` 目录下的示例 CSV 文件：
     - `sample-stage.csv` - 舞台尺寸
     - `sample-actors.csv` - 演员列表
     - `sample-actor-timeline.csv` - 演员时间轴
   - 尝试拖放文件或点击选择文件
   - 确认导入成功提示

2. **导出功能验证**
   - 点击"导出"按钮打开导出对话框
   - 选择"风险评估报告 (Markdown)"，确认下载 `.md` 文件
   - 打开下载的报告，确认包含：
     - 项目信息和报告生成时间
     - 风险统计概览（按类型、按级别）
     - 详细风险列表（带建议修复）
     - 已应用的调整记录（如有）
     - 项目配置摘要
   - 选择"完整项目 (JSON)"，确认下载 `.json` 文件
   - 选择"调整记录 (JSON)"（如有调整），确认下载调整记录

### 流程四：风险规则验证

示例项目已预设以下场景用于验证风险检测：

1. **碰撞风险（灯具照射演员）**
   - 播放时间轴，观察演员走位
   - 当演员进入灯具光束范围时，应检测到碰撞风险
   - 风险描述应包含"光束可能照射到演员"

2. **照度不足风险**
   - 示例项目目标照度为 500 lux
   - 在某些时间点，演员位置照度可能低于目标值
   - 风险应显示实际照度值和目标值对比

3. **吊杆遮挡风险**
   - 当两道吊杆高度差小于 0.5 米且水平位置重叠时
   - 应检测到遮挡风险

4. **超高风险**
   - 台口区域设置了 6 米高度限制
   - 当吊杆高度或演员位置（+身高）超出限制时
   - 应检测到超高风险

5. **禁入区风险**
   - 左侧翼道设置为禁入区
   - 当演员进入该区域时，应检测到碰撞风险

## 数据格式说明

### JSON 完整项目格式

```json
{
  "id": "project_id",
  "name": "项目名称",
  "created": "2026-05-02T...",
  "modified": "2026-05-02T...",
  "stage": {
    "width": 16,
    "depth": 12,
    "height": 10,
    "prosceniumWidth": 12,
    "prosceniumHeight": 8,
    "stageType": "proscenium"
  },
  "rigs": [...],
  "lightTypes": [...],
  "lights": [...],
  "actors": [...],
  "actorTimelines": [...],
  "rigTimelines": [...],
  "lightTimelines": [...],
  "restrictedZones": [...],
  "scenes": [...],
  "targetMinLux": 500
}
```

### CSV 单项数据格式

可导入的 CSV 类型（根据列名自动识别）：

**舞台尺寸**：`width, depth, height, prosceniumWidth, prosceniumHeight, stageType`

**吊杆**：`id, name, type, posX, posY, posZ, length, width, currentHeight, weight, maxLoad, motorized`

**灯具类型**：`id, name, wattage, intensity, beamAngle, fieldAngle, colorTemperature, dmxChannels`

**灯具**：`id, name, typeId, rigId, positionOnRig, pan, tilt, intensity, colorR, colorG, colorB, dmxAddress, dmxUniverse`

**演员**：`id, name, height, radius`

**演员时间轴**：`actorId, time, posX, posY, posZ, rotation, note`

**吊杆时间轴**：`rigId, time, height, note`

**灯具时间轴**：`lightId, time, pan, tilt, intensity, colorR, colorG, colorB, note`

**限制区**：`id, name, type, minX, minY, minZ, maxX, maxY, maxZ, maxHeight`

**场景**：`id, name, startTime, endTime, description`

## 风险检测规则

### 1. 碰撞风险 (Collision)

检测条件：
- 灯具光束与演员胶囊体距离 < 演员半径 + 0.5m
- 演员头顶与灯具物理距离 < 1.0m
- 演员进入禁入区

风险级别：`critical`

### 2. 遮挡风险 (Occlusion)

检测条件：
- 两道吊杆高度差 < 0.5m
- 吊杆水平位置存在重叠

风险级别：`warning`

### 3. 照度不足 (Illumination)

检测条件：
- 演员位置累加照度 < 目标照度（默认 500 lux）

照度计算：
```
照度 = (光源强度² * cos(入射角)) / 距离²
考虑光束角度衰减
```

风险级别：`warning`

### 4. 超高风险 (Height)

检测条件：
- 在 heightLimit 类型限制区内
- 演员位置.y + 演员身高 > 限制高度
- 或吊杆高度 > 限制高度

风险级别：
- 演员超高：`critical`
- 吊杆超高：`warning`

## 核心 API

### StageRenderer 类

```typescript
// 3D 渲染器
constructor(config: { canvas: HTMLCanvasElement; width: number; height: number })
setProject(project: StageProject)     // 设置项目数据
updateTime(time: number)              // 更新到指定时间
updateRisks(risks: Risk[])            // 更新风险标记
setSelected(type, id)                  // 设置选中对象高亮
setOnSelect(callback)                  // 设置点击选择回调
start() / stop() / dispose()           // 生命周期控制
```

### 风险引擎

```typescript
evaluateRisksAtTime(context: { project: StageProject; time: number })  // 计算单时刻风险
evaluateAllRisks(project, timeStep = 1.0)  // 计算全时间段风险
getTotalDuration(project)              // 获取项目总时长
```

### 数据解析

```typescript
detectAndParse(filename, content)      // 自动识别并解析文件
parseJSON(data)                         // 解析 JSON
parseCSV(data)                          // 解析 CSV
```

### 导出

```typescript
generateRiskReport(project, adjustments, timeStep = 1.0)  // 生成 Markdown 报告
exportRiskReportToMarkdown(...)        // 下载报告文件
exportProjectToFile(project)           // 导出项目 JSON
exportAdjustmentsToFile(...)           // 导出调整记录 JSON
```

## 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

需要 WebGL 2.0 支持。

## 许可证

MIT License
