# 室内热区巡检沙盘

一个基于 Three.js 的 3D 交互式可视化系统，用于商场运维值班室监控室内温湿度异常区域。

## 功能特性

### 🌍 3D 立体沙盘
- 多层楼层叠层可视化
- 支持鼠标拖拽旋转、滚轮缩放
- 区域边界高亮显示

### 🌡️ 热力变化播放
- 时间轴控制器，支持播放/暂停
- 多档播放速度调节（0.5x - 10x）
- 传感器颜色随温度动态变化（蓝→绿→红）

### ⚠️ 智能规则引擎
- **连续超阈检测**: 检测连续30分钟以上温湿度超阈值的传感器
- **传感器离线检测**: 检测超过15分钟未上报数据的传感器
- **重复派单检测**: 检测同一区域同一运维人员24小时内多次派单的情况

### 📊 数据导入导出
- 支持拖拽导入楼层 JSON、传感器 CSV、工单 JSON
- 支持阈值配置（温湿度上下限）
- 导出巡检建议为 Markdown 报告
- 导出告警列表、传感器读数为 CSV

### 👆 交互功能
- 点击传感器点位查看详情
- 查看传感器当前读数和历史记录
- 查看关联告警和工单
- 点击告警自动聚焦对应传感器

## 技术栈

- **前端框架**: React 18 + TypeScript
- **3D 引擎**: Three.js
- **构建工具**: Vite 5
- **状态管理**: Zustand
- **数据解析**: PapaParse

## 项目结构

```
src/
├── components/           # UI 组件
│   ├── AlertPanel.tsx       # 告警中心面板
│   ├── ExportPanel.tsx      # 数据导出面板
│   ├── ImportPanel.tsx      # 数据导入面板
│   ├── SensorDetailPanel.tsx # 传感器详情面板
│   └── TimelineControl.tsx   # 时间轴控制器
├── data/                 # 示例数据
│   ├── floorPlans.ts        # 楼层平面数据
│   ├── sensorData.ts         # 传感器读数数据
│   └── workOrders.ts         # 巡检工单数据
├── store/                # 状态管理
│   └── index.ts
├── types/                # TypeScript 类型定义
│   └── index.ts
├── utils/                # 工具模块
│   ├── dataParser.ts         # 数据解析器
│   ├── exportUtils.ts        # 导出工具
│   ├── rulesEngine.ts        # 规则引擎
│   └── sceneManager.ts       # 3D 场景管理器
├── App.css               # 全局样式
├── App.tsx               # 主应用组件
└── main.tsx              # 应用入口
```

## 本地验证流程

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动，并自动打开浏览器。

### 3. 加载示例数据

1. 点击顶部导航栏的 **"数据导入"** 标签
2. 点击 **"📊 加载示例数据"** 按钮
3. 系统将自动加载预设的示例数据，包括：
   - 3 层楼（1F 零售层、2F 餐饮层、3F 办公层）
   - 14 个温湿度传感器
   - 8 条巡检工单

### 4. 体验 3D 沙盘

1. 切换到 **"3D沙盘"** 标签
2. **鼠标拖拽**: 旋转视角查看不同角度
3. **鼠标滚轮**: 缩放场景
4. **点击传感器**: 查看传感器详情面板

### 5. 时间轴播放

1. 使用底部时间轴控制器：
   - 点击 **"▶ 播放"** 按钮开始热力变化动画
   - 调节播放速度（0.5x - 10x）
   - 拖拽滑块手动切换时间点
2. 观察传感器颜色变化：
   - 蓝色: 低温
   - 绿色: 正常温度
   - 红色: 高温
   - 灰色: 离线
   - 闪烁红光: 有告警

### 6. 查看告警和巡检建议

左侧面板显示：
- **告警统计**: 按严重程度分类统计
- **告警列表**: 按严重程度和时间排序
- **巡检建议**: 基于告警生成的处理建议

### 7. 导出巡检报告

1. 切换到 **"数据导出"** 标签
2. 选择导出格式：
   - **导出 Markdown**: 完整的巡检报告
   - **导出 CSV**: 表格格式的巡检建议
   - **导出告警 CSV**: 所有告警详情
   - **导出读数 CSV**: 所有传感器历史读数

## 规则引擎详解

### 连续超阈检测

- **检测条件**: 传感器读数连续 30 分钟以上超出阈值范围
- **严重程度**:
  - 30 分钟以上: 错误 (error)
  - 1 小时以上: 严重 (critical)
- **阈值可配置**: 默认温度 18°C - 26°C，湿度 30% - 70%

### 传感器离线检测

- **检测条件**:
  - 最后读数标记为离线状态
  - 最后一次数据上报超过 15 分钟
- **严重程度**:
  - 15 - 60 分钟: 错误 (error)
  - 60 分钟以上: 严重 (critical)

### 重复派单检测

- **检测条件**: 过去 24 小时内，同一运维人员对同一区域派发 2 次以上工单
- **严重程度**:
  - 2 次: 警告 (warning)
  - 3 次以上 或 有待处理工单: 严重 (critical)

## 数据格式说明

### 楼层 JSON 格式

```json
{
  "id": "floor_1",
  "name": "1F 零售层",
  "level": 1,
  "zones": [
    {
      "id": "zone_f1_1",
      "name": "东北区域",
      "floorId": "floor_1",
      "points": [
        {"x": 0, "y": 0},
        {"x": 50, "y": 0},
        {"x": 50, "y": 30},
        {"x": 0, "y": 30}
      ]
    }
  ]
}
```

### 传感器 CSV 格式

```csv
sensorId,name,floorId,zoneId,x,y,temperature,humidity,timestamp,isOnline
sensor_1,1F-东北-A01,floor_1,zone_f1_1,25,15,23.5,52,1714640400000,true
sensor_1,1F-东北-A01,floor_1,zone_f1_1,25,15,24.0,53,1714640700000,true
```

### 工单 JSON 格式

```json
{
  "id": "WO-2026-001",
  "title": "1F东北区空调异常",
  "description": "传感器显示该区域温度持续偏高",
  "floorId": "floor_1",
  "zoneId": "zone_f1_1",
  "sensorId": "sensor_1",
  "status": "in_progress",
  "priority": "high",
  "createdAt": 1714640400000,
  "assignedTo": "张明",
  "assigneeId": "worker_001"
}
```

- `status`: `pending` | `in_progress` | `completed` | `cancelled`
- `priority`: `low` | `medium` | `high` | `critical`

## 其他命令

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

### 代码检查

```bash
npm run lint
```

## 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+

## 许可证

MIT License
