# 立体停车库调度三维复核工具

基于 Three.js + Vite 的立体停车库调度可视化复核工具，支持多层车位、升降横移设备、车辆移动轨迹的三维展示，并能自动检测调度冲突和风险。

## 功能特性

### 三维可视化
- **多层车位展示**：支持 3D 渲染多层停车楼结构，包括楼层、车位、支柱等建筑元素
- **升降横移设备**：可视化升降机（电梯）和横移车的运行状态
- **车辆模型**：3D 车辆模型，支持不同颜色区分
- **移动轨迹**：实时显示车辆行驶轨迹和方向指示

### 数据支持
支持以下格式的数据文件：

| 数据类型 | 格式 | 说明 |
|---------|------|------|
| 车库结构 | JSON | 定义楼层、车位、升降机位置和规格 |
| 预约/取车 | CSV | 入库/取车预约记录，包含车辆信息、目标车位 |
| 调度指令 | JSONL | 按时间排序的调度执行指令序列 |
| 设备规则 | YAML | 升降机、横移车的运行参数和安全规则 |

### 风险检测
自动检测以下类型的调度风险：

| 风险类型 | 严重程度 | 说明 |
|---------|---------|------|
| 车位重复占用 | Critical | 同一时间多个车辆占用同一车位 |
| 升降机跨层抢占 | Error | 同一升降机被多个任务同时占用 |
| 通道阻塞 | Error | 车辆行驶路径被其他车辆阻挡 |
| 取车超时 | Warning | 取车任务超过预期时间阈值 |
| 入库超时 | Warning | 入库任务超过预期时间阈值 |
| 设备超载 | Critical | 车辆重量超过设备承载能力 |

### 播放控制
- **播放/暂停/重置**：完整的时间线控制
- **速度调节**：0.5x ~ 10x 播放速度
- **视图切换**：俯视、正视、侧视、自由视角
- **时间线**：可视化时间进度条和刻度

### 导出功能
- **异常帧 JSON**：导出检测到的所有风险事件的详细数据
- **复核报告**：生成 Markdown 格式的调度复核报告，包含统计分析和建议

## 快速开始

### 环境要求
- Node.js 16+ (推荐使用 18 LTS)
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 本地预览

```bash
npm run dev
```

浏览器会自动打开 `http://localhost:3000`

### 使用步骤

1. **加载示例数据**：点击顶部工具栏的 "📁 加载示例数据" 按钮
2. **开始回放**：点击右侧面板的 "▶ 播放" 按钮
3. **观察风险**：右侧风险列表会实时显示检测到的问题
4. **导出报告**：播放完成后，点击 "📤 导出异常帧" 或 "📋 导出复核报告"

## 项目结构

```
zy8237/
├── sample/                    # 示例数据目录
│   ├── garage_structure.json  # 车库结构定义
│   ├── reservations.csv       # 预约记录
│   ├── schedule_commands.jsonl # 调度指令序列
│   └── device_rules.yaml      # 设备运行规则
├── src/
│   ├── config.js              # 全局配置（颜色、尺寸等）
│   ├── dataParser.js          # 数据解析模块（JSON/CSV/JSONL/YAML）
│   ├── sceneManager.js        # Three.js 3D 场景管理
│   ├── animationController.js # 动画控制器（TWEEN.js）
│   ├── playbackEngine.js      # 回放引擎
│   ├── riskDetector.js        # 风险检测引擎
│   ├── sampleData.js          # 内置示例数据
│   └── main.js                # 主入口
├── index.html                 # HTML 模板
├── vite.config.js             # Vite 配置
├── package.json               # 项目依赖
└── README.md                  # 本文档
```

## 数据格式说明

### 车库结构 (JSON)
定义停车库的物理结构，包括楼层、车位、升降机。

```json
{
  "id": "garage-001",
  "name": "立体停车库",
  "floors": [
    {
      "id": "floor-0",
      "level": 0,
      "name": "地面层",
      "height": 3.5,
      "slots": [
        {
          "id": "slot-0-01",
          "position": { "x": -12, "z": 0 },
          "size": { "width": 2.5, "depth": 5.0 },
          "type": "standard",
          "maxWeight": 2500
        }
      ]
    }
  ],
  "elevators": [
    {
      "id": "elevator-01",
      "position": { "x": -18, "z": 0 },
      "maxCapacity": 2500
    }
  ]
}
```

### 预约记录 (CSV)
入库/取车预约请求。

```csv
id,vehicle_id,type,request_time,target_floor,target_slot,weight,deadline
res-001,京A12345,park,2026-05-04 09:00:00,1,slot-1-01,1800,2026-05-04 09:02:00
```

字段说明：
- `type`: `park` (入库) 或 `pickup` (取车)
- `weight`: 车辆重量（千克），用于超载检测
- `deadline`: 预计完成时间，用于超时检测

### 调度指令 (JSONL)
每行一条 JSON 指令，按时间顺序排列。

```json
{"id":"cmd-001","time":"2026-05-04 09:00:05","type":"park","vehicle_id":"京A12345","elevator_id":"elevator-01","from_floor":0,"to_floor":1,"to_slot":"slot-1-01","path":[{"x":-15,"y":0.1,"z":5},{"x":-18,"y":0.1,"z":0}],"duration":30}
```

指令类型：
- `park`: 入库停车
- `pickup`: 取车出库
- `move`: 移库（车位间移动）
- `elevator`: 升降机运行
- `wait`: 等待

### 设备规则 (YAML)
定义升降机、横移车的运行参数和安全规则。

```yaml
elevators:
  - id: elevator-01
    max_capacity: 2500    # 最大载重（kg）
    speed: 2.0             # 运行速度（m/s）

safety:
  min_distance_between_cars: 1.5  # 车辆最小间距

timing:
  park_time_limit: 120      # 入库时间限制（秒）
  pickup_time_limit: 180    # 取车时间限制（秒）
```

## 风险检测逻辑

### 车位重复占用
检测条件：当新指令尝试占用一个已被其他车辆占用的车位时触发。

检测逻辑：
1. 维护全局车位占用状态 `Map<slotId, {vehicleId, since}>`
2. 执行 `park` 或 `move` 指令前检查目标车位
3. 如果已被占用且车辆 ID 不同，触发冲突

### 升降机抢占
检测条件：同一升降机被多个任务同时请求时触发。

检测逻辑：
1. 维护升降机使用状态 `Map<elevatorId, {taskId, targetFloor}>`
2. 执行 `elevator` 指令时检查升降机当前状态
3. 如果正在被其他任务使用，触发抢占冲突

### 通道阻塞
检测条件：车辆行驶路径上存在其他车辆时触发。

检测逻辑：
1. 解析指令中的 `path` 路径点数组
2. 检查每个路径点周围 2.5m 范围内是否有其他车辆
3. 存在阻挡车辆时触发阻塞风险

### 超时检测
检测条件：入库/取车任务超过配置的时间限制时触发。

检测逻辑：
1. 记录任务开始时间
2. 每帧检查已用时间
3. 超过 `park_time_limit` 或 `pickup_time_limit` 时触发

### 设备超载
检测条件：车辆重量超过升降机额定载重时触发。

检测逻辑：
1. 解析预约记录中的 `weight` 字段
2. 与升降机 `max_capacity` 比较
3. 超过时触发超载风险

## 构建部署

### 构建生产版本

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

### 本地预览构建结果

```bash
npm run preview
```

## 技术栈

- **前端框架**: Vite 5
- **3D 引擎**: Three.js 0.160
- **动画库**: @tweenjs/tween.js
- **数据解析**: papaparse (CSV), yaml (YAML)
- **日期处理**: dayjs

## 示例数据说明

`sample/` 目录下提供了一组演示数据，包含以下场景：

1. **正常入库**：京A12345、京B67890 正常停入一层
2. **设备超载**：沪C11111 重量 2800kg，超过升降机额定载重 2500kg
3. **车位冲突**：京A12345 从 slot-1-01 移走后，浙F44444 尝试停入同一车位
4. **正常取车**：车辆按指令取出车库

播放示例数据可观察到"设备超载"和"车位重复占用"等风险事件。

## 常见问题

**Q: 为什么加载数据后没有反应？**
A: 请确保已点击 "加载示例数据" 按钮，然后点击 "播放" 开始回放。

**Q: 如何使用自己的数据？**
A: 目前程序内置了示例数据。如需加载自定义数据，可修改 `src/sampleData.js` 或扩展数据导入功能。

**Q: 三维场景太卡怎么办？**
A: 可以尝试以下优化：
- 降低播放速度
- 关闭其他占用 GPU 的程序
- 使用 Chrome/Edge 浏览器（WebGL 性能更好）

**Q: 如何调整风险检测阈值？**
A: 可编辑 `sample/device_rules.yaml` 文件中的 `timing` 和 `safety` 配置。

## 开发指南

### 扩展数据解析器
数据解析逻辑在 `src/dataParser.js` 中，可通过以下方式扩展：

```javascript
// 添加新的时间格式支持
dataParser.parseTime = (timeStr) => {
  // 自定义解析逻辑
};
```

### 添加新的风险检测类型
在 `src/riskDetector.js` 中添加新的检测方法：

```javascript
class RiskDetector {
  detectNewRisk(command, context) {
    // 检测逻辑
    return riskObject;
  }
}
```

### 自定义 3D 模型
车辆和车位模型在 `src/sceneManager.js` 中定义，可修改 `createCar()` 和 `createSlot()` 方法自定义模型外观。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
