# 叉车盲区冲突复盘工具

一个基于 Web 的 3D 仓库叉车盲区冲突复盘工具，安全员可以导入仓库布局、叉车轨迹、行人事件和安全规则，在三维场景中播放时间轴，查看货架遮挡、转弯盲区、近失距离和逆行风险。

## 功能特性

- 📊 **多格式数据导入**: 支持 JSON、CSV、JSONL、YAML 等多种数据格式
- 🎮 **3D 可视化**: 使用 Three.js 实现仓库场景的三维可视化
- ⏱️ **时间轴播放**: 支持播放、暂停、快进、快退、多倍速播放
- 🚨 **风险检测**: 自动检测货架盲区、转弯盲区、近失事件、逆行违规
- 📋 **报告导出**: 支持导出 Markdown 和 JSON 格式的风险报告
- 🔧 **异常处理**: 自动处理跨午夜轨迹和缺失坐标两类异常

## 项目结构

```
forklift-blind-spot-analyzer/
├── index.html              # 主页面
├── package.json            # 项目配置
├── vite.config.js          # Vite 配置
├── README.md              # 本文档
├── src/
│   ├── main.js            # 主入口文件
│   ├── styles/
│   │   └── main.css       # 主样式文件
│   └── modules/
│       ├── dataParser/
│       │   └── index.js   # 数据解析模块
│       ├── ruleEngine/
│       │   └── index.js   # 规则计算模块
│       ├── renderer3d/
│       │   └── index.js   # 3D渲染模块
│       └── reportExporter/
│           └── index.js   # 报告导出模块
└── samples/                # 示例数据
    ├── warehouse-layout.json      # 仓库布局
    ├── forklift-trajectory.csv    # 叉车轨迹
    ├── pedestrian-events.jsonl    # 行人事件
    └── safety-rules.yaml          # 安全规则
```

## 模块说明

### 1. 数据解析模块 (dataParser)

负责解析各种格式的数据文件：

- **仓库布局 (JSON)**: 解析货架、通道、区域信息
- **叉车轨迹 (CSV)**: 解析时间戳、坐标、速度、方向
- **行人事件 (JSONL)**: 解析行人生成的事件数据
- **安全规则 (YAML)**: 解析盲区检测、近失事件、逆行检测等规则

**异常处理**:
- **跨午夜轨迹**: 自动检测并调整跨午夜的时间戳
- **缺失坐标**: 使用线性插值补全缺失的坐标数据

### 2. 规则计算模块 (ruleEngine)

根据安全规则自动检测各类风险：

| 风险类型 | 检测逻辑 |
|---------|---------|
| **货架盲区** | 检测货架是否遮挡叉车驾驶员视线 |
| **转弯盲区** | 检测叉车转弯时是否存在额外盲区 |
| **近失事件** | 检测叉车与行人的距离是否过近 |
| **逆行违规** | 检测叉车是否在单向通道逆向行驶 |

### 3. 3D渲染模块 (renderer3d)

使用 Three.js 实现三维可视化：

- **仓库布局渲染**: 货架、通道、区域的 3D 展示
- **叉车轨迹可视化**: 轨迹线和动态叉车模型
- **行人显示**: 行人事件点的可视化
- **风险高亮**: 风险点的动态高亮显示
- **时间轴控制**: 播放、暂停、跳转、倍速控制

### 4. 报告导出模块 (reportExporter)

支持导出两种格式的风险报告：

- **JSON 格式**: 结构化数据，便于程序处理
- **Markdown 格式**: 格式化文档，便于人工阅读

报告包含：
- 风险概览和统计数据
- 各类风险的详细信息
- 风险类型说明和建议

## 数据格式说明

### 仓库布局 (JSON)

```json
{
  "name": "示例仓库",
  "dimensions": { "width": 40, "height": 8, "depth": 50 },
  "racks": [
    {
      "id": "RACK-001",
      "name": "A区货架1",
      "position": { "x": 5, "z": 10 },
      "dimensions": { "width": 4, "height": 5, "depth": 1 },
      "rotation": 90,
      "levels": 4
    }
  ],
  "aisles": [
    {
      "id": "AISLE-001",
      "name": "主通道1",
      "bounds": { "minX": 8, "maxX": 12, "minZ": 5, "maxZ": 40 },
      "allowedDirection": "forward"
    }
  ]
}
```

### 叉车轨迹 (CSV)

```csv
timestamp,x,y,z,forklift_id,speed,direction
08:00:00,10,0,5,FL-001,0.5,0
08:00:02,10,0,8,FL-001,0.8,0
08:00:04,,0,11,FL-001,1.0,0
```

**注意**: 缺失的坐标值会被自动插值处理。

### 行人事件 (JSONL)

每行一个 JSON 对象：

```json
{"id": "PED-001", "timestamp": "08:00:15", "x": 11, "z": 16, "action": "walking"}
{"id": "PED-002", "timestamp": "08:00:25", "x": 19, "z": 12, "action": "standing"}
```

### 安全规则 (YAML)

```yaml
blindSpot:
  enabled: true
  detectionAngle: 120
  detectionDistance: 5.0
  warningDistance: 3.0

nearMiss:
  enabled: true
  warningDistance: 2.0
  criticalDistance: 1.0

wrongWay:
  enabled: true
  allowedDirection: both
  violationThreshold: 30.0

turningBlindSpot:
  enabled: true
  turningAngleThreshold: 30
  extraBlindDistance: 2.0
```

## 安装和运行

### 环境要求

- Node.js 16+
- 支持 WebGL 的现代浏览器

### 本地预览步骤

1. **安装依赖**

```bash
npm install
```

2. **启动开发服务器**

```bash
npm run dev
```

3. **打开浏览器**

服务器会自动在默认浏览器打开 (通常是 http://localhost:3000)

4. **加载示例数据**

点击页面右上角的 **"加载示例数据"** 按钮，系统会自动加载 samples 目录下的示例数据并进行分析。

5. **播放时间轴**

- 点击播放按钮 ▶ 开始播放
- 使用滑块或按钮控制播放进度
- 选择播放速度 (0.5x - 10x)

6. **查看风险**

- 左侧面板显示风险统计
- 时间轴上的标记点表示风险事件
- 播放到风险点时会高亮显示

7. **导出报告**

点击 **"导出报告"** 按钮，选择导出 Markdown 或 JSON 格式。

### 构建生产版本

```bash
npm run build
```

构建产物会输出到 `dist` 目录。

### 预览生产版本

```bash
npm run preview
```

## 使用流程

1. **导入数据**: 依次导入或选择加载示例数据：
   - 仓库布局 (JSON)
   - 叉车轨迹 (CSV)
   - 行人事件 (JSONL) - 可选
   - 安全规则 (YAML)

2. **开始分析**: 点击 "开始分析" 按钮，系统会自动检测各类风险。

3. **可视化查看**:
   - 在 3D 场景中查看仓库布局
   - 播放时间轴观察叉车移动
   - 关注风险点的高亮显示

4. **导出报告**: 导出 Markdown 或 JSON 格式的风险报告供后续分析。

## 风险等级说明

| 等级 | 颜色 | 说明 |
|-----|------|------|
| 🔴 Critical (严重) | 红色 | 需要立即关注的高风险事件 |
| 🟡 Warning (警告) | 黄色 | 需要注意的中等风险事件 |
| 🔵 Info (信息) | 蓝色 | 一般风险，建议关注 |

## 技术栈

- **前端框架**: 原生 JavaScript (ES6+)
- **3D 引擎**: Three.js
- **构建工具**: Vite
- **数据解析**: PapaParse (CSV), js-yaml (YAML)

## 浏览器兼容性

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

需要浏览器支持 WebGL 和 ES6+ 特性。

## 许可证

MIT License
