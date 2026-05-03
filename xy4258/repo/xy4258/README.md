# 潮汐车堆预警台

城市夜间共享单车调度数据分析可视化工具

## 功能概述

潮汐车堆预警台是一个面向城市夜间共享单车调度员的本地数据分析可视化工具，主要功能包括：

- 📊 **数据导入**：支持加载示例数据或上传自定义数据（车辆GPS CSV、站点容量JSON、维修工单CSV）
- 🔍 **异常检测**：自动清洗低精度GPS、无效坐标、位置异常等数据
- 📈 **供需分析**：按时间段聚合计算各站点供需缺口
- 🗺️ **可视化展示**：
  - 地图视图：直观展示各站点位置和风险等级
  - 热力图：展示车辆分布密度
  - 趋势图：展示车辆数量随时间变化
- ⚠️ **风险预警**：站点风险排行，自动识别爆仓/缺车风险
- 💡 **调度建议**：智能生成站点间调运、车场补车、遗弃车辆回收等建议
- 📝 **结果导出**：
  - Markdown简报：完整的分析报告
  - CSV调拨单：可直接执行的任务列表
- 📋 **状态管理**：支持手动标记调度结果，记录执行历史

## 项目结构

```
tidal-bike-alert/
├── src/
│   ├── index.js              # Express服务主入口
│   └── core/
│       ├── dataParser.js     # 数据解析模块（CSV/JSON读取）
│       ├── metrics.js        # 指标计算模块（供需缺口聚合）
│       ├── riskRules.js      # 风险规则模块（异常检测、风险评估）
│       ├── storage.js        # 状态存储模块（调度结果持久化）
│       └── exporter.js       # 导出模块（Markdown简报、CSV调拨单）
├── public/
│   ├── index.html            # 前端主页面
│   ├── css/
│   │   └── style.css         # 前端样式
│   └── js/
│       └── app.js            # 前端交互逻辑
├── data/
│   └── sample/               # 示例数据目录
│       ├── bike_gps.csv      # 车辆GPS示例数据
│       ├── station_capacity.json  # 站点容量示例数据
│       └── work_orders.csv   # 维修工单示例数据
├── tests/
│   ├── dataParser.test.js    # 数据解析模块测试
│   └── riskRules.test.js     # 风险规则模块测试
├── storage/                  # 状态存储目录（运行时自动创建）
├── exports/                  # 导出文件目录（运行时自动创建）
├── uploads/                  # 上传文件目录（运行时自动创建）
├── package.json              # 项目依赖配置
└── README.md                 # 本文档
```

## 技术栈

- **后端**：Node.js + Express
- **数据处理**：Papa Parse（CSV解析）、Lodash（数据处理）、Day.js（时间处理）
- **前端**：原生HTML/CSS/JavaScript
- **地图**：Leaflet.js + Leaflet.heat（热力图）
- **图表**：Chart.js
- **测试**：Jest

## 安装与运行

### 环境要求

- Node.js >= 14.0.0
- npm >= 6.0.0

### 安装步骤

1. 安装项目依赖：

```bash
npm install
```

2. 启动服务：

```bash
npm start
```

或者使用开发模式（支持热重载）：

```bash
npm run dev
```

3. 访问应用：

打开浏览器访问 http://localhost:3000

### 运行测试

```bash
npm test
```

## 使用说明

### 快速开始（使用示例数据）

1. 启动服务后，点击左侧 **"加载示例数据"** 按钮
2. 数据加载成功后，点击 **"开始分析"** 按钮
3. 系统将自动进行数据清洗和分析
4. 分析完成后，即可在各个视图中查看结果

### 上传自定义数据

支持上传以下三种数据文件：

1. **车辆GPS数据**（CSV格式，必需）

```csv
bike_id,timestamp,latitude,longitude,accuracy,status
BK001,2026-05-02 23:45:00,31.2354,121.4787,5.2,available
BK002,2026-05-02 23:45:30,31.2356,121.4789,6.1,available
```

字段说明：
- `bike_id`：车辆唯一标识
- `timestamp`：定位时间（支持多种时间格式）
- `latitude`：纬度（-90 ~ 90）
- `longitude`：经度（-180 ~ 180）
- `accuracy`：GPS精度（米，值越小越精确）
- `status`：车辆状态（available/rented/maintenance等）

2. **站点容量数据**（JSON格式，必需）

```json
[
  {
    "station_id": "ST001",
    "name": "人民广场站",
    "latitude": 31.2355,
    "longitude": 121.4787,
    "capacity": 15,
    "current_bikes": 12,
    "address": "上海市黄浦区人民大道120号"
  }
]
```

字段说明：
- `station_id`：站点唯一标识
- `name`：站点名称
- `latitude`/`longitude`：站点坐标
- `capacity`：站点最大容量（桩位数）
- `current_bikes`：当前站点内车辆数
- `address`：站点地址（可选）

3. **维修工单数据**（CSV格式，可选）

```csv
work_order_id,bike_id,created_at,completed_at,status,issue_type,latitude,longitude,description
WO001,BK051,2026-05-02 14:30:00,,pending,flat_tire,31.2353,121.4786,车辆轮胎漏气
```

字段说明：
- `work_order_id`：工单号
- `bike_id`：关联车辆ID
- `created_at`：工单创建时间
- `completed_at`：工单完成时间（可选）
- `status`：工单状态（pending/completed/cancelled）
- `issue_type`：问题类型（flat_tire/battery_low/broken_lock等）
- `latitude`/`longitude`：车辆位置
- `description`：问题描述

### 功能视图说明

#### 1. 地图视图

- 直观展示所有站点的地理分布
- 不同颜色表示不同风险等级：
  - 🔴 红色：极高风险（需立即处理）
  - 🟠 橙色：高风险（需优先处理）
  - 🔵 蓝色：中风险（需关注）
  - 🟢 绿色：低风险（状态正常）
- 圆圈大小表示风险分数高低
- 紫色区域表示车辆堆积群
- 点击标记可查看站点详情

#### 2. 热力图

- 展示车辆分布密度
- 颜色越深表示车辆越集中
- 可快速识别热点区域

#### 3. 趋势图

- 展示车辆数量随时间变化趋势
- 蓝色线：GPS记录数
- 紫色线：唯一车辆数
- 可用于分析潮汐规律

#### 4. 站点排行

- 按风险分数降序排列所有站点
- 显示站点名称、风险等级、供需类型、现状、利用率等信息
- 支持按风险等级和供需类型筛选
- 点击"详情"查看完整信息

#### 5. 调度建议

- 智能生成四种类型的调度建议：
  - 🔄 站点间调运：从爆车站点调车到缺车站点
  - 🚛 车场补车：从车场调车补充到缺车站点
  - 📦 移车入场：将爆车站点的车辆移回车场
  - 🔍 遗弃车辆回收：回收长时间闲置的车辆
- 每条建议包含：优先级、详细信息、操作按钮
- 可标记任务完成状态

#### 6. 异常数据

- 展示所有被清洗的异常GPS数据
- 异常类型包括：
  - 低精度GPS（accuracy > 50米）
  - 无效坐标（超出经纬度有效范围）
  - 坐标为(0,0)（GPS信号丢失）
  - 统计异常（偏离车辆历史位置过远）

### 导出功能

#### 导出Markdown简报

点击底部 **"导出Markdown简报"** 按钮，生成完整的分析报告，包含：

- 风险概览（统计数据）
- 极高/高风险站点列表
- 调度建议详情
- 车辆堆积群信息
- 异常数据清洗报告
- 操作建议

报告保存在 `exports/` 目录下。

#### 导出CSV调拨单

点击底部 **"导出Markdown简报"** 旁边的 **"导出CSV调拨单"** 按钮，生成可直接执行的任务列表，包含：

- 任务类型
- 优先级
- 源站点/目标站点信息
- 车辆数量
- 预计距离
- 任务说明

调拨单保存在 `exports/` 目录下，可用Excel打开或导入调度系统。

### 风险等级说明

| 风险等级 | 颜色 | 触发条件 | 处理建议 |
|---------|------|---------|---------|
| 极高风险 | 红色 | 利用率 >= 95% 或 < 10% | 立即处理 |
| 高风险 | 橙色 | 利用率 80% ~ 95% 或 10% ~ 20% | 优先处理 |
| 中风险 | 蓝色 | 利用率 20% ~ 30% 或 60% ~ 80% | 关注即可 |
| 低风险 | 绿色 | 利用率 30% ~ 60% | 状态正常 |

### 供需类型说明

| 类型 | 说明 | 利用率范围 |
|------|------|-----------|
| CRITICAL_OVERFLOW | 严重爆仓 | >= 95% |
| OVERFLOW | 爆仓 | 80% ~ 95% |
| NORMAL_HIGH | 偏高 | 60% ~ 80% |
| NORMAL | 正常 | 30% ~ 60% |
| LOW | 偏低 | 10% ~ 30% |
| CRITICAL_SHORTAGE | 严重缺车 | < 10% |

## API 接口说明

### 基础接口

#### 健康检查
```
GET /api/health
```

返回服务状态和数据加载情况。

### 数据接口

#### 加载示例数据
```
POST /api/data/upload/sample
```

#### 上传自定义数据
```
POST /api/data/upload
Content-Type: multipart/form-data

参数：
- bikeGPS: 车辆GPS CSV文件
- stations: 站点容量 JSON文件
- workOrders: 维修工单 CSV文件（可选）
```

### 分析接口

#### 运行分析
```
POST /api/analyze
```

执行数据清洗、风险评估、调度建议生成等操作。

#### 获取分析摘要
```
GET /api/analysis/summary
```

### 查询接口

#### 获取站点列表
```
GET /api/stations?risk_level={CRITICAL|HIGH|MEDIUM|LOW}&gap_type={OVERFLOW|LOW|...}
```

参数可选，用于筛选站点。

#### 获取调度建议
```
GET /api/suggestions?type={TRANSFER|SUPPLY|REMOVE|ABANDONED}&priority={CRITICAL|HIGH|MEDIUM|LOW}
```

参数可选，用于筛选建议。

#### 获取车辆堆积群
```
GET /api/clusters
```

#### 获取异常数据
```
GET /api/anomalies?page=1&limit=50
```

支持分页查询。

#### 获取时间序列
```
GET /api/timeseries
```

### 调度接口

#### 标记调度任务完成
```
POST /api/dispatch/mark
Content-Type: application/json

{
  "suggestionIndex": 0,
  "operator": "调度员姓名",
  "notes": "备注信息（可选）"
}
```

#### 获取调度历史
```
GET /api/dispatch/history?status={pending|completed}&date=2026-05-03
```

参数可选。

### 导出接口

#### 导出Markdown报告
```
POST /api/export/report
Content-Type: application/json

{
  "operator": "操作员姓名（可选）"
}
```

#### 导出CSV调拨单
```
POST /api/export/dispatch
```

#### 获取导出文件列表
```
GET /api/exports
```

#### 下载导出文件
```
GET /api/download/:filename
```

## 数据持久化

### 调度结果存储

调度任务的标记结果会持久化到 `storage/dispatch_results.json` 文件中，包含：
- 任务详情
- 创建时间
- 完成时间
- 操作员
- 备注信息

### 会话状态存储

当前会话状态存储在 `storage/session_state.json` 文件中，包含：
- 已加载的数据集类型
- 分析结果缓存
- 最后分析时间

### 数据快照

可通过代码调用 `storage.saveDataSnapshot()` 创建数据快照，用于：
- 数据备份
- 历史对比
- 问题追溯

快照文件保存在 `storage/` 目录下，格式为 `snapshot_{name}_{timestamp}.json`。

## 配置说明

### 风险规则配置

在 `src/core/riskRules.js` 中可调整以下参数：

```javascript
this.config = {
  accuracyThreshold: 50,        // GPS精度阈值（米）
  outlierIqrMultiplier: 1.5,    // 异常值IQR倍数
  minClusterSize: 5,            // 最小堆积群大小
  clusterDistanceThreshold: 100 // 堆积群距离阈值（米）
};
```

### 供需阈值配置

在 `src/core/metrics.js` 中可调整供需分类阈值：

```javascript
classifyGap(utilizationRate, totalAvailable, capacity) {
  // utilizationRate: 利用率（0 ~ 1）
  // 可根据实际业务需求调整阈值
}
```

## 常见问题

### Q: 如何处理大量数据？

A: 系统设计上支持处理大量数据，但建议：
- 单次上传文件不超过 50MB
- 对于超大数据集，可分批处理
- 系统会自动清理超过7天的旧快照

### Q: 地图无法加载？

A: 地图使用 OpenStreetMap 瓦片服务，需要：
- 确保网络连接正常
- 可能需要科学上网（部分地区访问 OSM 较慢）

### Q: 示例数据中的车辆为什么显示为遗弃车辆？

A: 示例数据中 BK051-BK055 车辆的定位时间是 2026-05-01（早于当前时间24小时以上），根据规则会被识别为疑似遗弃车辆。

### Q: 如何自定义风险规则？

A: 可修改 `src/core/riskRules.js` 中的 `assessStationRisk` 方法，添加自定义的风险评估逻辑。

## 更新日志

### v1.0.0 (2026-05-03)

- 初始版本发布
- 实现数据解析和清洗功能
- 实现供需缺口分析和风险评估
- 实现调度建议生成
- 实现地图、热力图、趋势图可视化
- 实现Markdown报告和CSV调拨单导出
- 实现调度结果持久化
- 提供示例数据和单元测试

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

## 联系方式

如有问题或建议，请通过以下方式联系：
- 提交 GitHub Issue
- 发送邮件至项目维护者
