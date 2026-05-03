# 叉车盲区回放沙盘

## 项目概述

**叉车盲区回放沙盘** 是一个给仓储安全员使用的本地 3D 交互复盘工具。通过导入货架布局、叉车 GPS 轨迹、近失事件记录和摄像头标注点，实现：

- 🎥 **3D 场景回放**：可视化货架布局、叉车轨迹、危险区域
- ⏯️ **时间轴控制**：暂停、拖动进度、调节播放速度
- 🔍 **智能事件检测**：规则引擎自动检测盲区交汇、超速、禁行区穿越
- 📝 **复核流程**：点选事件查看证据，保存复核意见
- 📊 **多格式导出**：支持 Markdown 报告、CSV 风险清单、JSON 审计包

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

浏览器打开 `http://localhost:5173` 即可访问。

### 本地验证流程

1. **一键加载示例数据**：点击左侧面板顶部的「加载示例数据」按钮
2. **查看 3D 场景**：
   - 鼠标左键拖动：旋转视角
   - 鼠标滚轮：缩放
   - 鼠标右键拖动：平移
3. **播放回放**：点击底部时间轴的「播放」按钮开始回放
4. **查看事件**：
   - 左侧面板显示检测到的事件列表
   - 点击事件可跳转到对应时间点并查看详情
5. **添加复核意见**：在事件详情弹窗中选择复核状态并输入意见
6. **导出报告**：点击「导出」按钮选择格式下载

### 构建生产版本

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

## 项目结构

```
forklift-blind-spot-replay/
├── index.html              # 主页面
├── package.json            # 项目配置
├── vite.config.js          # Vite 构建配置
├── src/
│   ├── main.js             # 主入口，整合所有模块
│   ├── parser.js           # 数据解析模块
│   ├── trajectory.js       # 轨迹计算模块
│   ├── rules.js            # 规则检测引擎
│   ├── renderer.js         # 3D 场景渲染
│   ├── timeline.js         # 时间轴控制器
│   ├── storage.js          # 状态存储
│   ├── exporter.js         # 导出模块
│   └── sample-data.js      # 示例数据
└── test/
    ├── parser.test.js      # 数据解析测试
    └── rules.test.js       # 规则引擎测试
```

## 模块说明

### 1. 数据解析模块 (parser.js)

`DataParser` 类负责解析各种数据格式：

- **JSON 解析**：`parseJSON()` 解析标准 JSON
- **CSV 解析**：`parseCSV()` 解析带引号的 CSV 格式，自动类型转换
- **货架布局**：`parseShelves()` 解析货架、禁行区、临时障碍物
- **叉车轨迹**：`parseForkliftTrajectory()` 解析 GPS/速度 CSV
- **近失事件**：`parseNearMissEvents()` 解析人工记录的事件
- **摄像头标注**：`parseCameraAnnotations()` 解析摄像头位置和角度

### 2. 轨迹计算模块 (trajectory.js)

`TrajectoryCalculator` 类处理轨迹数据：

- **坐标转换**：`gpsToLocal()` GPS 坐标转本地网格坐标
- **路径插值**：`interpolateAtTimestamp()` 在离散点间线性插值
- **速度计算**：`calculateSpeed()` 两点间瞬时速度
- **转向检测**：`getTurningPoints()` 检测方向变化超过阈值的点
- **倒车段识别**：`getReversingSegments()` 标记倒车行驶区间
- **盲区接近计算**：`getBlindSpotProximity()` 计算与盲区货架的距离和角度

### 3. 规则检测引擎 (rules.js)

`RuleEngine` 类执行安全规则检测：

#### 检测规则

| 规则类型 | 说明 | 触发条件 |
|---------|------|---------|
| **超速检测** | 正常行驶超速 | 速度 > 正向限速（默认 5 m/s） |
| **转弯超速** | 转弯时超速 | 速度 > 转弯限速（默认 3 m/s） |
| **倒车超速** | 倒车时超速 | 速度 > 倒车限速（默认 2 m/s） |
| **盲区交汇** | 进入盲区货架危险区 | 距离 < 盲区半径 且 角度在盲区扇形内 |
| **禁行区穿越** | 进入禁行区 | 坐标落在禁行区内 |
| **临时障碍物** | 接近临时占道 | 距离 < 安全距离 |

#### 配置参数

```javascript
{
  speedLimit: 5,           // 正向限速 (m/s)
  turningSpeedLimit: 3,    // 转弯限速 (m/s)
  reverseSpeedLimit: 2,    // 倒车限速 (m/s)
  blindSpotDistance: 5,    // 盲区检测距离 (m)
  minTurningAngle: 30      // 最小转弯角度 (度)
}
```

### 4. 3D 场景渲染 (renderer.js)

`SceneRenderer` 类使用 Three.js 渲染 3D 场景：

- **货架**：绿色立方体，有盲区的货架标红并显示扇形危险区
- **叉车**：橙色小车模型，根据方向旋转，倒车时显示红色尾灯
- **轨迹线**：蓝色线条，接近事件时渐变红色
- **事件标记**：脉动球体，不同颜色代表不同风险等级
- **危险区**：半透明区域，显示禁行区和临时占道
- **摄像头**：锥形显示视场角范围

### 5. 时间轴控制器 (timeline.js)

`TimelineController` 类控制回放：

- **播放/暂停**：`play()` / `pause()`
- **进度控制**：`setProgress(0-1)` 或直接拖动滑块
- **速度调节**：`setPlaybackSpeed()` 支持 0.5x 到 10x
- **跳转事件**：`goToEvent()` 跳转到指定事件时间点
- **状态回调**：`onUpdate()` 注册进度更新回调

### 6. 状态存储 (storage.js)

`StateStorage` 类管理本地存储：

- **会话管理**：`createSession()` 创建新会话，`save()` 保存
- **事件复核**：`updateEventReview()` 更新事件复核状态和意见
- **数据持久化**：使用 LocalStorage，支持跨会话保留

### 7. 导出模块 (exporter.js)

`Exporter` 类支持三种导出格式：

#### Markdown 报告
- 会话基本信息
- 统计汇总（事件数量、风险等级分布）
- 事件详情列表（含复核意见）

#### CSV 风险清单
- 表头：事件ID、类型、时间、严重程度、位置、持续时间、复核状态、复核人、复核意见

#### JSON 审计包
- 完整数据结构：会话信息、原始数据、检测事件、复核记录、统计摘要

## 数据格式说明

### 1. 货架布局 JSON

```json
{
  "version": "1.0",
  "warehouseSize": {
    "width": 50,
    "depth": 40,
    "height": 10
  },
  "shelves": [
    {
      "id": "shelf_001",
      "name": "A1-1 货架",
      "position": { "x": 10, "y": 0, "z": 10 },
      "size": { "width": 8, "depth": 2, "height": 6 },
      "isBlindSpot": true,
      "blindSpotZone": {
        "radius": 5,
        "angle": 120
      }
    }
  ],
  "noEntryZones": [
    {
      "id": "zone_001",
      "name": "消防通道",
      "type": "rectangle",
      "position": { "x": 20, "z": 20 },
      "width": 4,
      "depth": 10
    }
  ],
  "temporaryObstacles": [
    {
      "id": "obs_001",
      "description": "临时停放托盘",
      "position": { "x": 30, "z": 15 },
      "size": { "width": 1.2, "depth": 1.2, "height": 1.5 },
      "safetyDistance": 2
    }
  ]
}
```

### 2. 叉车轨迹 CSV

```csv
timestamp,forkliftId,x,y,z,speed,speedLimit,direction,isReversing
2024-01-15T09:00:00.000Z,FL-001,5,0,5,0,5,0,false
2024-01-15T09:00:00.500Z,FL-001,10,0,5,4,5,90,false
2024-01-15T09:00:01.000Z,FL-001,15,0,8,6,5,90,false
2024-01-15T09:00:01.500Z,FL-001,20,0,10,7,5,180,true
```

### 3. 近失事件 JSON

```json
{
  "events": [
    {
      "id": "evt_manual_001",
      "type": "near-miss",
      "timestamp": "2024-01-15T09:00:05.000Z",
      "description": "与行人差点碰撞",
      "position": { "x": 25, "z": 15 },
      "severity": "high",
      "reporter": "张安全员",
      "evidence": ["CAM-03_20240115_090005.jpg"]
    }
  ]
}
```

### 4. 摄像头标注 JSON

```json
{
  "cameras": [
    {
      "id": "cam_001",
      "name": "北门入口",
      "position": { "x": 5, "y": 5, "z": 0 },
      "rotation": { "x": -30, "y": 0, "z": 0 },
      "fov": 90,
      "ip": "192.168.1.101"
    }
  ]
}
```

## 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试
node --test test/parser.test.js
node --test test/rules.test.js
```

## 使用示例

### 加载示例数据

```javascript
import { sampleShelves, generateForkliftCSV, sampleNearMissEvents, sampleCameraAnnotations } from './src/sample-data.js';
import { DataParser } from './src/parser.js';

const parser = new DataParser();
const shelvesData = parser.parseShelves(sampleShelves);
const trajectoryCSV = generateForkliftCSV();
const trajectoryData = parser.parseForkliftTrajectory(trajectoryCSV);
```

### 检测事件

```javascript
import { RuleEngine } from './src/rules.js';

const ruleEngine = new RuleEngine({
  speedLimit: 5,
  turningSpeedLimit: 3,
  reverseSpeedLimit: 2,
  blindSpotDistance: 5
});

const events = ruleEngine.runAllChecks(
  trajectoryData, 
  shelvesData, 
  sampleNearMissEvents.events
);

console.log(`检测到 ${events.length} 个事件`);
```

### 导出报告

```javascript
import { Exporter } from './src/exporter.js';

const exporter = new Exporter();
const markdown = exporter.exportMarkdown(sessionData, detectedEvents, stats);
const csv = exporter.exportCSV(detectedEvents);
const json = exporter.exportJSON(sessionData, shelvesData, trajectoryData, detectedEvents, stats);

// 下载文件
exporter.downloadMarkdown(markdown, '复核报告.md');
exporter.downloadCSV(csv, '风险清单.csv');
exporter.downloadJSON(json, '审计包.json');
```

## 技术栈

- **Three.js**：3D 场景渲染
- **Vite**：构建工具
- **Node.js 内置 test**：单元测试

## 许可证

本项目仅供内部使用。

## 更新日志

### v1.0.0
- 初始版本发布
- 实现数据解析、轨迹计算、规则检测、3D 渲染
- 支持 Markdown/CSV/JSON 导出
- 提供示例数据和测试用例
