# 风电场叶片无人机巡检3D可视化工具

一个用于风电场运维复盘的本地3D交互可视化工具，支持叶片无人机巡检数据的可视化分析。

## 功能特性

- 🎯 **3D交互可视化** - 三支叶片展开成可旋转3D模型，支持旋转、缩放、平移
- 🛩️ **航线覆盖显示** - 叠加无人机巡检航线，绿色到红色渐变表示风速变化
- 🎯 **缺陷点标注** - 按严重等级（高/中/低危）显示缺陷位置
- 📋 **列表交互** - 点击缺陷列表自动定位到对应叶片段
- 🔍 **智能分析** - 自动计算漏拍区、重复拍摄、缺陷等级、风速超限风险
- ⚠️ **边界段处理** - 自动检测并标记位于段边界的缺陷
- ✅ **手动复核** - 支持标记缺陷为已复核状态
- 📊 **报告导出** - 导出Markdown/CSV格式的完整巡检报告

## 项目结构

```
zy8249/
├── package.json              # 项目配置
├── README.md                 # 本文档
├── sample/                   # 示例数据（可直接演示）
│   ├── turbine.json          # 风机和叶片基本信息
│   ├── flight_path.jsonl     # 无人机航线数据（JSON Lines格式）
│   ├── defects.csv           # 缺陷检测数据
│   └── rules.yaml            # 巡检规则配置
└── src/
    ├── index.html            # 主页面
    ├── css/
    │   └── style.css         # 样式文件
    └── js/
        ├── main.js           # 主入口
        ├── app.js            # 应用主逻辑
        ├── dataParser.js     # 数据解析模块
        ├── analysisEngine.js # 分析引擎（漏拍/重复/缺陷等级/风速）
        └── threeDRenderer.js # 3D渲染模块（坐标换算/边界处理）
```

## 快速开始

### 本地预览

**方式一：使用npm（推荐）**

```bash
# 进入项目目录
cd /path/to/zy8249

# 启动本地服务器
npm run start
```

**方式二：使用Python**

```bash
# Python 3
python -m http.server 8080

# 或 Python 2
python -m SimpleHTTPServer 8080
```

**方式三：使用Node.js http-server**

```bash
# 全局安装http-server（如果还没有）
npm install -g http-server

# 启动服务器
http-server -p 8080
```

启动后，在浏览器中访问：
```
http://localhost:8080/src/
```

### 操作说明

- **左键拖动**：旋转3D视图
- **滚轮**：缩放视图
- **右键拖动**：平移视图
- **点击缺陷列表**：自动定位并高亮对应叶片段
- **勾选/取消勾选**：控制航线和缺陷的显示
- **点击导出按钮**：下载Markdown或CSV报告

## 数据格式说明

### 1. turbine.json - 风机和叶片数据

```json
{
  "turbineId": "WT-001",
  "location": "华能风电场A1区",
  "inspectionDate": "2026-04-28",
  "blades": [
    {
      "bladeId": "BL-001",
      "name": "叶片1",
      "length": 61.5,
      "chordRoot": 4.5,
      "chordTip": 1.2,
      "segments": [
        { 
          "segmentId": "S1-01", 
          "start": 0, 
          "end": 5, 
          "name": "叶根段1",
          "position": "root"
        }
      ]
    }
  ],
  "hubHeight": 100
}
```

### 2. flight_path.jsonl - 航线数据（JSON Lines）

每行一个JSON对象：

```json
{
  "flightId": "FL-001",
  "timestamp": "2026-04-28T08:15:30Z",
  "position": {"x": 15, "y": 0, "z": 5},
  "angle": {"pitch": 0, "yaw": 0, "roll": 0},
  "windSpeed": 4.2,
  "bladeId": "BL-001",
  "segmentId": "S1-01",
  "coverageArea": {"start": 0, "end": 5},
  "photoCount": 3,
  "altitude": 102
}
```

### 3. defects.csv - 缺陷数据

```csv
defectId,bladeId,segmentId,position,distanceFromRoot,size,type,severity,description,detectedTime,photoUrl,reviewStatus
D-001,BL-001,S1-02,pressure_side,8.5,15.2,crack,high,叶中段表面裂纹,2026-04-28T08:16:15Z,/photos/D-001.jpg,unreviewed
```

**字段说明：**
- `position`: 缺陷位置，可选值：pressure_side(压力面)、suction_side(吸力面)、leading_edge(前缘)、trailing_edge(后缘)
- `distanceFromRoot`: 距离叶根的距离（米）
- `size`: 缺陷尺寸（厘米）
- `type`: 缺陷类型：crack(裂纹)、pitting(点蚀)、erosion(侵蚀)、scratch(划痕)、bonding_issue(粘接问题)、delamination(分层)
- `severity`: 严重等级：high(高危)、medium(中危)、low(低危)
- `reviewStatus`: 复核状态：unreviewed(待复核)、reviewed(已复核)

### 4. rules.yaml - 巡检规则配置

```yaml
inspection:
  coverage:
    minPhotoPerSegment: 2      # 每段最少照片数
    requiredCoverage: 0.95      # 要求覆盖率
    maxOverlap: 0.3             # 最大允许重叠率
  
  windSpeed:
    maxAllowable: 6.0           # 最大允许风速 (m/s)
    warningThreshold: 5.0       # 预警阈值 (m/s)

defect:
  severity:
    high:
      threshold: 20.0           # 高危尺寸阈值
      types: [crack, delamination, erosion]
      action: 立即安排维修
    medium:
      threshold: 10.0
      types: [pitting, bonding_issue]
      action: 计划内维修
    low:
      threshold: 5.0
      types: [scratch]
      action: 持续监测
```

## 关键技术点

### 1. 跨叶片坐标换算

三支叶片在3D空间中以120°间隔分布。程序通过以下方式进行坐标转换：

```javascript
const bladeAngles = {
  'BL-001': 0,                    // 叶片1沿X轴正方向
  'BL-002': (2 * Math.PI) / 3,   // 叶片2旋转120°
  'BL-003': (4 * Math.PI) / 3    // 叶片3旋转240°
};

// 使用旋转矩阵进行坐标转换
const cos = Math.cos(rotationAngle);
const sin = Math.sin(rotationAngle);
const localX = offset.x * cos - offset.z * sin;
const localZ = offset.x * sin + offset.z * cos;
```

### 2. 缺陷落在边界段处理

程序专门处理缺陷位于段边界的情况：

```javascript
const epsilon = 0.5;  // 边界容差（米）

for (const segment of blade.segments) {
  // 检查是否靠近段的起始或结束边界
  if (Math.abs(distanceFromRoot - segment.start) < epsilon || 
      Math.abs(distanceFromRoot - segment.end) < epsilon) {
    analysis.isNearBoundary = true;
    analysis.boundaryInfo = {
      segmentId: segment.segmentId,
      boundaryType: distanceFromRoot < (segment.start + segment.end) / 2 ? 'start' : 'end',
      distanceToBoundary: Math.min(
        Math.abs(distanceFromRoot - segment.start),
        Math.abs(distanceFromRoot - segment.end)
      )
    };
    break;
  }
}
```

在UI中，边界缺陷会显示警告标识 ⚠️。

### 3. 分析计算逻辑

- **漏拍区检测**：检查每个段的覆盖率（需≥95%）和照片数量（需≥2张）
- **重复拍摄检测**：检测航线覆盖重叠率超过30%的区域
- **缺陷等级判定**：根据尺寸和类型自动判定有效严重等级，可能升级
- **风速超限**：检测超过6.0m/s的飞行记录，5.0-6.0m/s为预警

## 依赖说明

本项目使用以下技术：

- **Three.js** (v0.160.0) - 3D渲染引擎（通过CDN加载）
- **OrbitControls** - 相机控制（通过CDN加载）
- **http-server** - 本地开发服务器（可选）

所有3D相关依赖通过CDN动态加载，无需本地npm install即可运行。

## 使用自己的数据

将您的数据文件放入 `sample/` 目录，替换示例文件：

1. `turbine.json` - 风机和叶片结构数据
2. `flight_path.jsonl` - 无人机巡检航线
3. `defects.csv` - 缺陷检测结果
4. `rules.yaml` - 巡检规则配置

确保数据格式与示例文件一致，即可在浏览器中查看您的巡检数据。

## 常见问题

**Q: 为什么需要本地服务器？**

A: 浏览器出于安全考虑，不允许本地HTML文件直接通过fetch加载本地JSON/CSV文件。使用本地服务器可以解决跨域问题。

**Q: 支持哪些浏览器？**

A: 推荐使用 Chrome、Firefox、Safari 或 Edge 的最新版本。需要浏览器支持 ES6 modules 和 WebGL。

**Q: 如何修改默认规则？**

A: 编辑 `sample/rules.yaml` 文件中的阈值和参数。刷新页面后新规则立即生效。

**Q: 导出的报告保存在哪里？**

A: 点击导出按钮后，浏览器会自动下载文件到您的默认下载目录。

## 许可证

MIT License

## 更新日志

### v1.0.0 (2026-04-28)
- 初始版本发布
- 实现3D叶片可视化和交互
- 实现航线和缺陷点叠加显示
- 实现漏拍区、重复拍摄、缺陷等级、风速超限分析
- 实现手动标记已复核功能
- 实现Markdown/CSV报告导出
- 处理跨叶片坐标换算和边界段缺陷问题
