# 3D 机坪作业复盘工具

一款基于 Three.js 的机场地服作业回放分析工具，支持离线导入数据、3D 可视化展示、风险事件检测和报告导出。

## 功能特性

### 📊 数据导入
- 支持拖拽或选择文件导入
- 支持以下数据格式：
  - `stands.json` - 机位数据
  - `vehicle_tracks.csv` - 车辆轨迹数据
  - `turnarounds.yaml` - 航班周转数据
  - `safety_rules.json` - 安全规则配置

### 🎮 3D 可视化
- 机位 3D 渲染（包含多边形区域显示）
- 车辆 3D 模型（按类型区分颜色）
- 轨迹线路径展示
- 轨道控制（旋转、缩放、平移）
- 实时状态面板

### ⏱️ 时间轴与回放
- 航班周转时间轴展示
- 车辆活动时间条
- 风险事件时间标记
- 播放/暂停控制
- 多倍速播放（0.5x / 1x / 2x / 5x / 10x）
- 点击时间轴跳转

### 🔍 筛选功能
- 按航班筛选
- 按车辆类型筛选
- 按风险级别筛选（高危/中危/低危）

### ⚠️ 风险检测
- **超速违规** - 检测超过限速阈值的车辆
- **禁入区违规** - 检测进入禁入区域的车辆
- **车辆冲突** - 检测车辆之间距离过近
- **加油车与登机桥重叠** - 检测加油作业期间登机桥同时作业

### 📄 报告导出
- 导出 `apron_review.md` - 详细的复盘报告（Markdown 格式）
- 导出 `risk_events.csv` - 风险事件列表（CSV 格式）

### 🛡️ 异常处理
- **跨午夜航班** - 自动处理时间跨越午夜的航班和轨迹数据
- **GPS 断点插值** - 对轨迹数据中的时间间隙进行线性插值补全

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

浏览器会自动打开 `http://localhost:3000`

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist` 目录

### 预览生产版本

```bash
npm run preview
```

## 数据格式说明

### stands.json（机位数据）

```json
{
  "stands": [
    {
      "id": "101",
      "name": "101",
      "latitude": 31.1434,
      "longitude": 121.8060,
      "type": "passenger",
      "gate": "A1",
      "restricted": false,
      "polygon": [
        { "lat": 31.1433, "lon": 121.8059 },
        { "lat": 31.1433, "lon": 121.8061 },
        { "lat": 31.1435, "lon": 121.8061 },
        { "lat": 31.1435, "lon": 121.8059 }
      ]
    }
  ]
}
```

### vehicle_tracks.csv（车辆轨迹数据）

```csv
vehicle_id,vehicle_type,timestamp,latitude,longitude,speed,heading,status
FUEL-001,fuel_truck,08:00:00,31.1434,121.8060,25,90,moving
FUEL-001,fuel_truck,08:00:30,31.14341,121.8061,25,90,moving
```

字段说明：
- `vehicle_id` - 车辆唯一标识
- `vehicle_type` - 车辆类型（fuel_truck, bus, passenger_bridge, cargo_loader, tug 等）
- `timestamp` - 时间戳（格式：HH:MM:SS 或 ISO 格式）
- `latitude` - 纬度
- `longitude` - 经度
- `speed` - 速度（km/h）
- `heading` - 方向角（度）
- `status` - 状态（moving, stopped, idle）

### turnarounds.yaml（航班周转数据）

```yaml
turnarounds:
  - flight_id: CA1234
    flight_number: CA1234
    aircraft_type: B737-800
    stand_id: 101
    gate: A1
    arrival_time: "08:30:00"
    departure_time: "10:15:00"
    operations:
      - type: fueling
        start: "08:45:00"
        end: "09:15:00"
      - type: boarding
        start: "09:30:00"
        end: "10:00:00"
```

### safety_rules.json（安全规则配置）

```json
{
  "rules": {
    "speed_limits": [
      { "limit": 30, "area": "general" },
      { "limit": 15, "area": "stand_area" }
    ],
    "no_entry_zones": [
      {
        "name": "跑道禁区",
        "polygon": [
          { "lat": 31.1450, "lon": 121.8040 },
          { "lat": 31.1450, "lon": 121.8100 },
          { "lat": 31.1440, "lon": 121.8100 },
          { "lat": 31.1440, "lon": 121.8040 }
        ]
      }
    ],
    "proximity_rules": { "min_distance": 10 },
    "fueling_rules": { "no_bridge_during_fueling": true }
  }
}
```

## 使用说明

### 加载数据

1. **使用示例数据**：点击顶部"加载示例数据"按钮，系统会自动加载预设的示例数据
2. **拖拽导入**：将数据文件拖拽到左侧"数据导入"区域
3. **选择文件**：点击"选择文件"按钮，从文件系统中选择数据文件

### 播放回放

1. 点击底部时间轴左侧的播放按钮开始回放
2. 使用速度下拉框调整播放速度
3. 点击时间轴上的任意位置跳转到对应时间点
4. 点击暂停按钮停止播放

### 查看风险事件

1. 左侧"风险事件"列表显示所有检测到的风险
2. 使用"风险级别筛选"下拉框过滤风险
3. 点击任意风险事件，系统会自动跳转到风险发生的时间点并高亮相关车辆

### 导出报告

1. 点击顶部"导出报告"按钮
2. 系统会自动下载两个文件：
   - `apron_review.md` - 详细的复盘报告
   - `risk_events.csv` - 风险事件列表

## 项目结构

```
.
├── samples/                    # 示例数据
│   ├── stands.json
│   ├── vehicle_tracks.csv
│   ├── turnarounds.yaml
│   └── safety_rules.json
├── src/
│   ├── data/
│   │   ├── dataManager.js     # 数据管理器
│   │   ├── parsers.js         # 数据解析器
│   │   └── riskDetector.js    # 风险检测引擎
│   ├── utils/
│   │   ├── timeUtils.js       # 时间工具函数
│   │   ├── geoUtils.js        # 地理计算工具
│   │   └── exporter.js        # 报告导出器
│   ├── visualization/
│   │   └── scene3D.js         # 3D 场景渲染
│   └── main.js                 # 主应用入口
├── index.html                  # 页面入口
├── package.json
├── vite.config.js
└── README.md
```

## 技术栈

- **前端框架** - Vanilla JavaScript (ES6+)
- **3D 引擎** - Three.js
- **构建工具** - Vite
- **数据解析** - PapaParse (CSV), js-yaml (YAML)
- **时间轴** - 原生实现

## 注意事项

1. **跨午夜航班处理**：系统会自动检测并处理时间跨越午夜的数据。当轨迹时间从 23:xx 变为 00:xx 时，系统会自动将次日时间加上一天的毫秒数，确保时间顺序正确。

2. **GPS 断点处理**：当轨迹数据中存在超过 60 秒的时间间隙时，系统会进行线性插值补全，并在插值点标记 `interpolated: true`。

3. **坐标系统**：使用 WGS84 经纬度坐标，渲染时转换为平面坐标（米为单位）。中心点基于机位数据自动计算。

4. **浏览器兼容**：需要支持 WebGL 的现代浏览器（Chrome, Firefox, Safari, Edge）。

## License

MIT License
