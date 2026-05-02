# 🛫 风场航迹黑匣子

**无人机巡检航线回放与风险分析工具**

专为海上风机巡检工程师设计的本地Web应用，支持无人机飞控轨迹、气象数据、告警点和禁飞区的导入与可视化分析。

## 功能特性

### 📊 数据解析
- **飞控轨迹 (JSON)**: 支持多种飞控数据格式，自动解析经纬度、高度、速度、航向、云台角度等
- **气象数据 (CSV)**: 时间序列风速、风向、温度、湿度数据导入
- **告警点/禁飞区 (GeoJSON)**: 支持Point、Polygon、MultiPolygon、Circle等几何类型

### 🎯 风险事件分析
自动检测以下风险类型：

| 风险类型 | 检测逻辑 | 严重级别 |
|---------|---------|---------|
| **速度超限** | 速度 > 12m/s (警告) / >15m/s (严重) | 警告/严重 |
| **风航夹角异常** | 风向与航向夹角 >60° (警告) / >75° (严重) | 警告/严重 |
| **云台角度异常** | 云台俯仰角 >75° (警告) / >85° (严重) | 警告/严重 |
| **禁飞区闯入** | 轨迹点进入禁飞区范围 | 严重 |
| **接近禁飞区** | 距离禁飞区 <100m (信息) / <50m (警告) | 信息/警告 |
| **告警点** | 轨迹接近预设告警点 | 信息/警告/严重 |

### 🎮 回放控制
- **播放/暂停**: 实时回放飞行轨迹
- **速度调节**: 0.5x、1x、2x、5x、10x 多种倍速
- **拖拽定位**: 拖动时间轴任意定位
- **事件跳转**: 一键跳转到上一个/下一个风险事件
- **键盘快捷键**:
  - `Space`: 播放/暂停
  - `←/→`: 后退/前进
  - `Shift + ←/→`: 跳转到上一个/下一个事件
  - `↑/↓`: 加快/减慢播放速度
  - `R/E`: 跳转到开始/结束

### 📍 地图可视化
- **Leaflet地图**: 支持OpenStreetMap等多种底图
- **轨迹绘制**: 飞行路径可视化
- **无人机位置**: 实时显示无人机当前位置和状态
- **禁飞区高亮**: 红色半透明区域标记禁飞区
- **风险事件标记**: 按级别使用不同颜色标记事件位置
- **事件定位**: 点击事件列表自动定位到地图对应位置

### 💾 数据管理
- **本地Session**: 自动保存会话数据到浏览器LocalStorage
- **导出报告**: 
  - **Markdown巡检复盘**: 包含所有风险事件的详细报告
  - **CSV风险清单**: 结构化的风险事件表格
- **人工标注**: 支持在任意时间点添加自定义标注

## 项目结构

```
xy4094/
├── src/
│   ├── main.js              # 主应用入口
│   ├── style.css            # 样式文件
│   └── modules/
│       ├── parser.js        # 数据解析模块
│       ├── geo.js           # 地理计算/碰撞检测
│       ├── replay.js        # 回放状态机
│       ├── visualization.js # 可视化模块
│       ├── riskEngine.js    # 风险事件引擎
│       ├── importExport.js  # 导入导出
│       └── storage.js       # 本地存储
├── tests/
│   └── index.js             # 单元测试
├── index.html               # HTML入口
├── package.json             # 项目配置
├── vite.config.js           # Vite配置
└── README.md                # 本文档
```

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run dev
```

启动后浏览器会自动打开 `http://localhost:3000`

### 构建生产版本

```bash
npm run build
```

构建产物位于 `dist/` 目录

### 预览生产版本

```bash
npm run preview
```

### 运行测试

```bash
npm run test
```

## 使用指南

### 1. 加载示例数据

点击顶部导航栏的 **"📦 加载示例数据"** 按钮，系统会生成模拟数据供您体验所有功能。

示例数据包含：
- 120个轨迹点，包含速度、云台角度等异常数据
- 气象数据（风速、风向随时间变化）
- 2个告警点
- 2个禁飞区（多边形、圆形各一个）

### 2. 导入自定义数据

点击 **"📁 导入数据"** 按钮，可导入以下类型的文件：

#### 飞控轨迹数据 (JSON)
支持两种格式：

**格式一（包含points数组）：**
```json
{
  "points": [
    {
      "timestamp": 1700000000000,
      "latitude": 30.5,
      "longitude": 121.2,
      "altitude": 50,
      "speed": 10,
      "heading": 90,
      "gimbalPitch": -45
    }
  ]
}
```

**格式二（数组直接作为点列表）：**
```json
[
  {
    "time": "2024-01-15T10:00:00Z",
    "lat": 30.5,
    "lng": 121.2,
    "alt": 50,
    "velocity": 10,
    "yaw": 90,
    "gimbal_pitch": -45
  }
]
```

**支持的字段别名：**
| 字段 | 别名 |
|-----|------|
| timestamp | time, t |
| latitude | lat |
| longitude | lng, lon |
| altitude | alt |
| speed | velocity |
| heading | yaw, azimuth |
| gimbalPitch | gimbal_pitch, cameraAngle |

#### 气象数据 (CSV)
```csv
timestamp,windSpeed,windDirection,temperature,humidity
2024-01-15T10:00:00Z,8.5,180,22.5,65
2024-01-15T10:05:00Z,9.2,190,22.3,63
2024-01-15T10:10:00Z,8.8,175,22.6,67
```

**列名要求（不区分大小写）：**
- 时间: timestamp, time, t
- 风速: windSpeed, wind_speed
- 风向: windDirection, wind_dir, wind_direction
- 温度: temperature, temp
- 湿度: humidity

#### 禁飞区/告警点 (GeoJSON)

**Polygon 多边形禁飞区：**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [121.199, 30.501],
          [121.201, 30.501],
          [121.201, 30.503],
          [121.199, 30.503],
          [121.199, 30.501]
        ]]
      },
      "properties": {
        "name": "军事管制区",
        "level": "critical"
      }
    }
  ]
}
```

**Circle 圆形禁飞区（扩展格式）：**
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Circle",
    "coordinates": [121.204, 30.505],
    "radius": 150
  },
  "properties": {
    "name": "机场净空区"
  }
}
```

**Point 告警点：**
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [121.202, 30.504]
  },
  "properties": {
    "name": "叶片异常告警点",
    "description": "上次巡检发现叶片有损伤迹象",
    "level": "warning"
  }
}
```

### 3. 回放与分析

1. **查看风险事件**: 左侧面板列出所有检测到的风险事件，按严重程度分类统计
2. **播放回放**: 点击底部时间轴的播放按钮开始回放
3. **定位事件**: 点击左侧事件列表自动定位到地图对应位置并暂停
4. **添加标注**: 在任意时间点通过右侧面板添加人工标注
5. **导出报告**: 点击顶部"导出报告"生成复盘文档

### 4. 导出报告

支持两种导出格式：

**Markdown 巡检复盘报告**
包含：
- 基本信息统计
- 风险事件统计表
- 严重事件详细分析
- 巡检结论与建议

**CSV 风险清单**
包含：
- 序号、事件类型、级别
- 时间、经纬度、高度
- 描述、详细信息
- 是否人工标注

## 技术栈

- **构建工具**: Vite 5.x
- **地图库**: Leaflet 1.9.x
- **语言**: 原生 JavaScript (ES6+)
- **样式**: 原生 CSS
- **存储**: localStorage
- **测试**: Node.js 原生测试

## 风险引擎配置

可通过修改 `src/modules/riskEngine.js` 中的默认配置：

```javascript
this.config = {
  maxSpeed: 15,           // 严重速度阈值 (m/s)
  warningSpeed: 12,       // 警告速度阈值 (m/s)
  criticalWindAngle: 75,  // 严重风航夹角阈值 (°)
  warningWindAngle: 60,   // 警告风航夹角阈值 (°)
  maxGimbalAngle: 85,     // 严重云台角度阈值 (°)
  warningGimbalAngle: 75, // 警告云台角度阈值 (°)
  noFlyZoneWarningDistance: 50,   // 禁飞区警告距离 (m)
  noFlyZoneInfoDistance: 100      // 禁飞区信息距离 (m)
};
```

## 浏览器兼容性

- Chrome >= 80
- Firefox >= 75
- Safari >= 14
- Edge >= 80

要求浏览器支持：
- ES6+ 语法
- Canvas API
- localStorage

## 本地验证流程

1. **安装依赖**
   ```bash
   npm install
   ```

2. **运行单元测试**
   ```bash
   npm run test
   ```
   验证所有核心算法是否正常工作

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

4. **验证功能**
   - 打开浏览器访问显示的地址
   - 点击"加载示例数据"
   - 验证左侧是否显示风险事件列表
   - 点击播放按钮，验证无人机是否沿轨迹移动
   - 点击左侧事件，验证是否自动定位
   - 尝试拖动时间轴，验证跳转功能
   - 点击"导出报告"，验证文件下载

5. **构建生产版本**
   ```bash
   npm run build
   ```
   验证构建是否成功

## 常见问题

### Q: 为什么地图不显示？
A: 请检查网络连接，Leaflet需要从CDN加载地图瓦片。如果是离线环境，可以考虑配置本地瓦片服务。

### Q: 导入数据后没有风险事件？
A: 可能是数据格式不匹配。请参考示例数据格式，确保字段名正确。也可能是数据中没有触发风险阈值的情况。

### Q: 回放速度很慢？
A: 可以通过时间轴上的速度选择器切换到更高倍速（最高10x）。也可以使用键盘 `↑` 键加速。

### Q: Session数据会丢失吗？
A: Session保存在浏览器的localStorage中，只要不清除浏览器数据就不会丢失。最多保存10个会话。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
