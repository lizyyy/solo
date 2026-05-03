# 仓库车辆轨迹安全复盘系统

一个用于仓库安全员的本地3D动线复盘工具，支持导入车辆轨迹CSV和库区JSON地图，在3D视图中按时间轴回放多辆车的位置、速度和风险点。

## 功能特性

- **3D可视化**：使用Three.js渲染仓库地图、车辆轨迹和风险点
- **时间轴回放**：支持播放/暂停、速度调节、拖动时间轴
- **多维度校验**：时间倒序、坐标越界、车辆编号缺失、速度异常等
- **风险检测**：会车风险、急停风险、禁行区靠近、超速、险兆事件
- **筛选功能**：按车辆、严重程度筛选风险和轨迹
- **风险详情**：点击风险点查看详细信息和证据数据
- **导出功能**：Markdown复盘报告、CSV风险清单
- **示例数据**：内置示例地图和轨迹，开箱即用

## 项目结构

```
仓库车辆轨迹安全复盘系统/
├── index.html              # 主页面
├── package.json            # 项目配置
├── package-lock.json
├── README.md              # 本文档
├── data/
│   ├── example_map.json        # 示例地图数据
│   └── example_trajectories.csv # 示例轨迹数据
└── src/
    ├── css/
    │   └── style.css        # 样式文件
    └── js/
        ├── main.js           # 主入口文件
        ├── parsers/
        │   ├── csvParser.js  # CSV解析和校验模块
        │   └── jsonParser.js # JSON地图解析模块
        ├── risk/
        │   └── rules.js      # 风险规则检测模块
        ├── state/
        │   └── store.js      # 状态管理模块
        ├── io/
        │   ├── import.js     # 导入模块
        │   └── export.js     # 导出模块
        └── visualization/
            ├── scene3D.js    # 3D场景渲染模块
            └── timeline.js   # 时间轴控制模块
```

## 快速开始

### 环境要求

- 现代浏览器（Chrome、Firefox、Safari、Edge）
- Node.js（用于安装依赖和启动开发服务器，可选）
- npm 或 yarn（包管理器）

### 安装依赖

```bash
# 进入项目目录
cd 仓库车辆轨迹安全复盘系统

# 安装依赖
npm install
```

### 启动应用

方式一：使用Node.js启动本地服务器（推荐）

```bash
# 使用http-server（需要先安装）
npx http-server -p 8080

# 然后在浏览器中打开 http://localhost:8080
```

方式二：使用其他HTTP服务器

```bash
# 使用Python 3
python3 -m http.server 8080

# 使用Python 2
python -m SimpleHTTPServer 8080
```

方式三：直接打开文件（部分浏览器可能限制ES模块加载）

```bash
# 在浏览器中直接打开 index.html 文件
```

### 验证功能

应用启动后，您应该能够看到：

1. **页面布局**：左侧是概览/车辆/风险/数据四个标签页，中间是3D视图，底部是时间轴
2. **示例数据**：自动加载示例地图和车辆轨迹数据
3. **3D场景**：显示仓库布局、货架、禁行区和车辆位置
4. **统计信息**：左侧显示数据点数、车辆数、风险数等统计
5. **风险列表**：显示检测到的各种风险事件

### 操作指南

#### 1. 播放控制

- 点击底部时间轴的 **播放/暂停** 按钮控制回放
- 使用 **前进/后退** 按钮按秒跳转
- 点击 **跳转到开始/结束** 快速定位
- 使用 **速度选择器** 调整播放速度（0.25x - 10x）
- 拖动时间轴上的 **播放头** 直接跳转到任意时间点

#### 2. 3D视图操作

- **左键拖动**：旋转视角
- **右键拖动**：平移视图
- **滚轮**：缩放视图
- **点击车辆**：高亮显示
- **点击风险点**：查看详细信息

#### 3. 数据筛选

##### 车辆筛选
- 点击左侧 **车辆** 标签页
- 勾选/取消勾选车辆ID来显示/隐藏对应车辆
- 使用 **全选/全不选** 快速操作

##### 风险筛选
- 点击左侧 **风险** 标签页
- 勾选/取消勾选 **高/中/低风险** 来过滤显示
- 点击风险列表中的条目查看详情

#### 4. 导入数据

##### 导入轨迹CSV
1. 点击顶部 **导入轨迹** 按钮
2. 选择符合格式的CSV文件
3. 系统会自动校验数据，问题数据会在 **数据** 标签页列出

##### 导入地图JSON
1. 点击顶部 **导入地图** 按钮
2. 选择符合格式的JSON文件
3. 3D场景会自动更新为新地图

#### 5. 导出数据

##### 导出Markdown报告
1. 点击顶部 **导出报告** 按钮
2. 系统会生成包含统计信息、风险摘要、详细列表的Markdown文件
3. 文件会自动下载

##### 导出CSV风险清单
1. 点击顶部 **导出风险** 按钮
2. 系统会生成包含所有风险事件的CSV文件
3. 文件会自动下载

#### 6. 查看风险详情

1. 在3D视图中点击 **风险标记点**，或在左侧 **风险** 标签页点击风险条目
2. 右侧会显示风险详情面板，包含：
   - 基本信息（类型、严重程度、时间）
   - 详细描述
   - 涉及车辆
   - 位置信息
   - 速度/加速度信息
   - 证据数据
3. 点击 **跳转到时间点** 按钮可直接回放该风险发生时的情景

## 数据格式

### 轨迹CSV格式

```csv
vehicleId,timestamp,x,y,z,speed
FORKLIFT-01,1735737600000,10.0,40.0,0.0,5.0
FORKLIFT-01,1735737605000,15.0,40.0,0.0,6.5
```

**字段说明：**

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| vehicleId | string | 是 | 车辆唯一标识 |
| timestamp | number | 是 | Unix时间戳（毫秒） |
| x | number | 是 | X坐标（米） |
| y | number | 是 | Y坐标（米） |
| z | number | 是 | Z坐标（米），通常为0 |
| speed | number | 是 | 速度（km/h） |

### 地图JSON格式

完整的地图JSON包含以下主要部分：

```json
{
  "id": "demo_warehouse",
  "name": "示例仓库",
  "version": "1.0",
  "bounds": {
    "minX": 0, "maxX": 100,
    "minY": 0, "maxY": 80,
    "minZ": 0, "maxZ": 5
  },
  "zones": [...],      // 区域定义
  "aisles": [...],     // 通道定义
  "racks": [...],      // 货架定义
  "restrictedAreas": [...],  // 禁行区定义
  "obstacles": [...],  // 障碍物定义
  "landmarks": [...],  // 地标定义
  "waypoints": [...]   // 路径点定义
}
```

**bounds（边界）：**

定义整个仓库的坐标范围，用于校验坐标越界。

**zones（区域）：**

```json
{
  "id": "zone_storage_a",
  "name": "存储区A",
  "type": "storage",
  "bounds": { "minX": 20, "maxX": 60, "minY": 0, "maxY": 40 },
  "speedLimit": 8
}
```

**aisles（通道）：**

```json
{
  "id": "aisle_main_1",
  "name": "主通道1",
  "type": "main",
  "width": 6,
  "bounds": { "minX": 60, "maxX": 80, "minY": 0, "maxY": 80 },
  "speedLimit": 10
}
```

**restrictedAreas（禁行区）：**

```json
{
  "id": "restricted_office",
  "name": "办公区",
  "type": "no_vehicle",
  "restriction": "no_vehicle",
  "bounds": { "minX": 85, "maxX": 95, "minY": 10, "maxY": 30 },
  "dangerLevel": "high"
}
```

**restriction类型：**
- `no_vehicle`：禁止车辆进入
- `speed_limit`：限速区域
- `no_parking`：禁止停车

## 风险检测规则

### 1. 会车风险（Collision）

**检测条件：**
- 两辆车在同一时间点（±1秒内）
- 距离小于阈值（默认3米）

**严重程度：**
- 高风险：距离 < 2米
- 中风险：距离 2-3米

### 2. 急停风险（Sudden Stop）

**检测条件：**
- 速度从 > 5 km/h 快速降为 0
- 加速度 < -3 m/s²

**严重程度：**
- 高风险：加速度 < -5 m/s²
- 中风险：加速度 -3 到 -5 m/s²

### 3. 禁行区靠近（Restricted Area）

**检测条件：**
- 车辆进入 `no_vehicle` 类型的禁行区
- 车辆靠近禁行区边界（< 2米）

**严重程度：**
- 高风险：进入禁行区内部
- 中风险：距离边界 < 1米
- 低风险：距离边界 1-2米

### 4. 超速风险（Speeding）

**检测条件：**
- 车辆速度超过区域限速
- 超过限速的20%

**严重程度：**
- 高风险：超过限速50%以上
- 中风险：超过限速30-50%
- 低风险：超过限速20-30%

### 5. 险兆事件（Near Miss）

**检测条件：**
- 多辆车在通道交会
- 距离在3-5米之间
- 相对速度 > 5 km/h

**严重程度：**
- 中风险：距离 3-4米
- 低风险：距离 4-5米

## 数据校验规则

导入CSV数据时会进行以下校验：

### 1. 字段完整性校验

检查是否包含所有必需字段：
- `vehicleId`（车辆编号）
- `timestamp`（时间戳）
- `x`, `y`, `z`（坐标）
- `speed`（速度）

### 2. 时间倒序校验

对同一辆车的轨迹点，按时间戳排序后检查：
- 时间戳是否递增
- 是否存在时间倒序的情况

### 3. 坐标越界校验

检查坐标是否在地图边界范围内：
- X坐标：`minX` - `maxX`
- Y坐标：`minY` - `maxY`
- Z坐标：`minZ` - `maxZ`

### 4. 速度异常校验

检查速度值是否合理：
- 速度不能为负数
- 速度不能超过合理最大值（默认150 km/h）

## 模块说明

### 1. CSV解析器（csvParser.js）

**类：** `CSVParser`

**主要方法：**
- `parse(text, options)`：解析CSV文本
- `parseAndValidateLine(line, lineNumber, context)`：解析并校验单行数据
- `mergeWithExistingData(existingData, newData)`：合并新旧数据

**特性：**
- 支持带引号的CSV格式
- 支持逗号分隔的标准格式
- 支持多维度数据校验
- 问题数据单独列出，不覆盖有效数据

### 2. JSON地图解析器（jsonParser.js）

**类：** `JSONMapParser`

**主要方法：**
- `parse(jsonData)`：解析地图JSON
- `isPointInPolygon(point, polygon)`：点是否在多边形内
- `isPointInZone(point, zone)`：点是否在区域内
- `isPointNearRestrictedArea(point, restrictedArea, threshold)`：点是否靠近禁行区

**特性：**
- 支持多种地图元素格式
- 提供碰撞检测功能
- 支持边界查询

### 3. 风险规则（rules.js）

**类：** `RiskRules`

**主要方法：**
- `detectRisks(trajectoryData, mapData, options)`：检测所有风险
- `detectCollisions(...)`：检测会车风险
- `detectSuddenStops(...)`：检测急停风险
- `detectRestrictedAreaApproaches(...)`：检测禁行区靠近
- `detectSpeeding(...)`：检测超速风险
- `detectNearMisses(...)`：检测险兆事件
- `filterRisksByTime(...)`：按时间筛选风险
- `filterRisksBySeverity(...)`：按严重程度筛选风险

**特性：**
- 五种风险类型检测
- 三级严重程度评估
- 支持多维度筛选

### 4. 状态管理（store.js）

**类：** `Store`

**主要方法：**
- `getState()`：获取当前状态
- `subscribe(listener, types)`：订阅状态变更
- `notify(changeType)`：通知状态变更
- `setTrajectoryData(...)`：设置轨迹数据
- `setMapData(...)`：设置地图数据
- `setCurrentTime(...)`：设置当前时间
- `play()` / `pause()` / `toggle()`：播放控制
- `setPlaybackSpeed(speed)`：设置播放速度
- `selectAllVehicles()` / `deselectAllVehicles()`：车辆筛选
- `toggleVehicleFilter(vehicleId)`：切换车辆筛选
- `setSeverityFilters(severities)`：设置严重程度筛选
- `setSelectedRisk(risk)`：设置选中的风险

**特性：**
- 发布订阅模式
- 集中式状态管理
- 支持状态变更监听

### 5. 导入管理（import.js）

**类：** `ImportManager`

**主要方法：**
- `importTrajectoryCSV(file)`：导入轨迹CSV文件
- `importMapJSON(file)`：导入地图JSON文件
- `validateTrajectoryData(data)`：校验轨迹数据

**特性：**
- 异步文件读取
- 自动校验
- 问题数据隔离

### 6. 导出管理（export.js）

**类：** `ExportManager`

**主要方法：**
- `generateMarkdownReport(options)`：生成Markdown报告
- `downloadMarkdownReport(options)`：下载Markdown报告
- `generateCSV(options)`：生成CSV风险清单
- `downloadCSV(options)`：下载CSV风险清单

**特性：**
- Markdown报告包含统计、摘要、详情
- CSV格式便于数据分析
- 支持自定义文件名

### 7. 3D场景（scene3D.js）

**类：** `Scene3D`

**主要方法：**
- `init()`：初始化3D场景
- `updateMap(mapData)`：更新地图
- `updateVehiclesAtTime(time)`：更新指定时间点的车辆
- `updateRisks(risks, filters)`：更新风险点
- `clearScene()`：清除场景

**特性：**
- 使用Three.js渲染
- 支持鼠标交互
- 可点击风险点查看详情
- 支持视角控制

### 8. 时间轴（timeline.js）

**类：** `Timeline`

**主要方法：**
- `init()`：初始化时间轴
- `updateTimeRange()`：更新时间范围
- `updateRiskMarkers()`：更新风险标记
- `setPlaybackSpeed(speed)`：设置播放速度
- `startPlaybackLoop()`：启动播放循环
- `updatePlayhead(time)`：更新播放头位置

**特性：**
- 完整的播放控制
- 时间轴上显示风险标记
- 可拖动定位
- 支持多种播放速度

### 9. 主入口（main.js）

**类：** `App`

**主要方法：**
- `init()`：初始化应用
- `initScene()`：初始化3D场景
- `initTimeline()`：初始化时间轴
- `initEventListeners()`：初始化事件监听
- `initStateListeners()`：初始化状态监听
- `loadSampleData()`：加载示例数据
- `importTrajectory(event)`：导入轨迹文件
- `importMap(event)`：导入地图文件
- `exportReport()`：导出报告
- `exportRisks()`：导出风险清单
- `showRiskDetail(risk)`：显示风险详情

**特性：**
- 整合所有模块
- 管理UI状态
- 处理用户交互

## 测试示例

### 使用示例数据测试

应用启动时会自动加载示例数据，您可以：

1. **查看统计信息**：左侧概览标签页显示数据点数、车辆数、风险数
2. **回放轨迹**：点击时间轴的播放按钮，观察车辆运动
3. **查看风险**：切换到风险标签页，点击任一风险条目
4. **查看详情**：右侧会显示风险详情面板
5. **跳转到时间点**：点击详情面板中的"跳转到时间点"

### 导入新数据测试

1. **准备CSV文件**：使用 `data/example_trajectories.csv` 作为模板
2. **准备JSON文件**：使用 `data/example_map.json` 作为模板
3. **导入轨迹**：点击"导入轨迹"按钮，选择您的CSV文件
4. **查看结果**：检查数据标签页，确认问题数据被正确识别
5. **查看风险**：检查风险标签页，确认新的风险被检测

### 导出测试

1. **导出报告**：点击"导出报告"按钮
2. **检查内容**：打开下载的Markdown文件，确认包含：
   - 统计概览
   - 风险分布
   - 风险类型统计
   - 风险详情列表
   - 地图信息
3. **导出风险**：点击"导出风险"按钮
4. **检查内容**：打开下载的CSV文件，确认包含所有风险字段

## 常见问题

### Q1: 为什么浏览器无法加载ES模块？

**原因：** 部分浏览器限制从本地文件系统加载ES模块。

**解决方案：** 使用HTTP服务器启动应用：
```bash
npx http-server -p 8080
```

### Q2: 3D场景显示空白？

**可能原因：**
1. Three.js加载失败
2. 浏览器不支持WebGL
3. 场景初始化错误

**排查：**
1. 打开浏览器开发者工具（F12）
2. 查看Console是否有错误信息
3. 检查Network面板确认 `three.module.js` 加载成功

### Q3: 数据导入失败？

**可能原因：**
1. CSV格式不正确
2. 缺少必需字段
3. 时间戳格式错误

**解决方案：**
1. 使用示例CSV作为模板
2. 确认所有必需字段存在
3. 时间戳使用Unix毫秒格式
4. 检查数据标签页的问题数据列表

### Q4: 风险检测不生效？

**可能原因：**
1. 车辆数量不足（会车风险需要至少2辆车）
2. 时间范围不匹配
3. 车辆距离太远

**解决方案：**
1. 确保有多辆车的轨迹数据
2. 检查车辆位置是否接近
3. 查看示例数据中的风险检测

### Q5: 导出的文件在哪里？

**答案：** 文件会下载到浏览器的默认下载目录：
- Chrome: 设置 > 下载内容
- Firefox: 设置 > 常规 > 文件和应用程序
- Safari: 偏好设置 > 通用 > 文件下载位置

## 性能优化建议

### 大数据量处理

当轨迹数据量很大（>10000条）时，建议：

1. **分批导入**：将大文件拆分为多个小文件
2. **按时间筛选**：只导入需要分析的时间段
3. **简化地图**：减少地图元素数量以提升渲染性能

### 3D渲染优化

1. **降低车辆数量**：筛选显示部分车辆
2. **关闭轨迹线**：大数据量时关闭轨迹线显示
3. **调整视角**：使用正交相机减少渲染压力

### 风险检测优化

1. **设置合理阈值**：调整距离、加速度等阈值减少误报
2. **按车辆筛选**：只分析特定车辆组合
3. **调整时间窗口**：缩小时间比较窗口

## 扩展开发

### 添加新的风险类型

1. 在 `risk/rules.js` 中添加新的检测方法
2. 在 `detectRisks` 方法中调用新方法
3. 更新 `generateStatistics` 统计新类型
4. 更新 `filterRisksByType` 支持筛选

### 添加新的数据校验规则

1. 在 `parsers/csvParser.js` 中添加校验函数
2. 在 `parseAndValidateLine` 中调用新校验
3. 更新错误类型枚举

### 自定义3D样式

1. 在 `visualization/scene3D.js` 中修改材质颜色
2. 调整光照参数
3. 添加自定义3D模型

## 技术栈

- **前端框架**：原生JavaScript（ES6+）
- **3D渲染**：Three.js ^0.160.0
- **样式**：CSS3
- **模块系统**：ES Modules

## 浏览器兼容性

- Chrome 61+
- Firefox 60+
- Safari 11+
- Edge 79+

需要支持ES Modules和WebGL的浏览器。

## 许可证

本项目仅供内部使用。

## 版本历史

### v1.0.0 (2025-01-01)

- 初始版本发布
- 实现基础3D可视化
- 实现时间轴回放控制
- 实现5种风险检测
- 实现数据导入导出
- 实现多维度数据校验
- 提供示例数据

## 技术支持

如遇到问题，请检查：

1. 浏览器控制台是否有错误信息
2. 网络面板确认所有资源加载成功
3. 数据格式是否符合规范
4. 地图边界是否与轨迹坐标匹配

---

**仓库车辆轨迹安全复盘系统** - 让安全员快速识别和分析仓库中的安全风险。
