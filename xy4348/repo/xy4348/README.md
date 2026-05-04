# 路况勘察分析工具

一个用于分析骑行路线风险的本地工具，帮助骑行社快速定位高风险路段。

## 功能特性

- **文件导入**: 支持导入 GPX 路线文件、CSV 路况报告和照片索引
- **风险分析**: 按路段聚合风险次数、速度变化，智能计算风险分数
- **地图可视化**: 使用 Leaflet 地图直观展示高风险路段和照片证据位置
- **人工改判**: 支持人工审核和改判风险报告，确保分析准确性
- **数据导出**: 可导出 Markdown 整改建议和 JSON 审计包

## 技术栈

### 后端
- Node.js + Express
- SQL.js (本地 SQLite 数据库)
- fast-xml-parser (GPX 解析)
- papaparse (CSV 解析)

### 前端
- React 18
- Ant Design (UI 组件库)
- React Router (路由)
- Leaflet + React-Leaflet (地图)
- Recharts (数据可视化)

## 安装步骤

### 环境要求
- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖

1. 安装后端依赖:
```bash
npm install
```

2. 安装前端依赖:
```bash
cd client
npm install
cd ..
```

或者使用一键安装脚本:
```bash
npm run install:all
```

## 运行项目

### 开发模式

同时启动后端和前端:
```bash
npm run dev
```

或者分别启动:

1. 启动后端服务 (端口 3001):
```bash
npm start
```

2. 启动前端开发服务器 (端口 3000):
```bash
cd client
npm start
```

### 生产模式

1. 构建前端:
```bash
cd client
npm run build
cd ..
```

2. 启动后端服务:
```bash
npm start
```

访问 http://localhost:3001 即可使用。

## 使用指南

### 快速开始

1. **创建勘察批次**:
   - 点击"新建批次"按钮
   - 输入批次名称和描述
   - 点击"创建"

2. **上传数据文件**:
   进入批次详情页，上传以下文件:
   - **GPX 文件**: 骑行路线轨迹数据
   - **路况 CSV**: 路况问题报告
   - **照片索引 CSV**: 照片证据索引

3. **查看分析结果**:
   - **地图视图**: 在地图上查看路线和高风险路段
   - **风险分析**: 查看风险类型分布饼图和严重程度柱状图
   - **路线列表**: 查看所有导入的路线信息

4. **人工改判**:
   - 点击高风险路段的"详情"按钮
   - 在路况报告列表中点击"人工改判"
   - 选择改判操作并填写原因

5. **导出报告**:
   - 导出 Markdown 整改建议
   - 导出 JSON 审计包

### 文件格式说明

#### 1. GPX 路线文件
标准 GPX 1.1 格式，包含轨迹点的经纬度、高程和时间信息。

#### 2. 路况 CSV 文件格式
```csv
condition_type,severity,description,latitude,longitude,speed,speed_change,timestamp,photos
pothole,high,路面存在大坑洼,40.0048,116.3888,8.5,-12.3,2024-05-01T08:02:00Z,P101.jpg,P102.jpg
```

字段说明:
- `condition_type`: 风险类型 (pothole/lighting/wrong_way/obstacle/water/construction/other)
- `severity`: 严重程度 (high/medium/low)
- `description`: 描述说明
- `latitude`: 纬度
- `longitude`: 经度
- `speed`: 当前速度 (km/h)
- `speed_change`: 速度变化 (km/h)
- `timestamp`: 时间戳 (ISO 格式)
- `photos`: 关联的照片文件名 (可选)

#### 3. 照片索引 CSV 文件格式
```csv
filename,path,latitude,longitude,timestamp,description,tags
P101.jpg,/photos/P101.jpg,40.0048,116.3888,2024-05-01T08:02:00Z,坑洼特写,坑洼,严重
```

### 示例数据

项目包含示例数据文件，位于 `sample-data/` 目录:
- `sample-route.gpx`: 示例 GPX 路线文件
- `sample-road-conditions.csv`: 示例路况 CSV 文件
- `sample-photo-index.csv`: 示例照片索引 CSV 文件

可以使用这些文件测试系统功能。

## 风险类型说明

| 类型代码 | 名称 | 权重系数 | 说明 |
|---------|------|---------|------|
| pothole | 坑洼 | 3 | 路面存在坑洼、凹陷等损坏 |
| lighting | 照明差 | 2 | 路段照明不足，夜间视线差 |
| wrong_way | 逆行冲突 | 4 | 存在逆向行驶车辆 |
| obstacle | 障碍物 | 2 | 路面存在障碍物 |
| water | 积水 | 2 | 路段存在积水 |
| construction | 施工 | 3 | 路段正在施工 |
| other | 其他 | 1 | 其他未分类问题 |

## 风险分数计算

风险分数计算公式:
```
风险分数 = 风险次数 × 类型权重 × 严重程度权重 + 照片数量 × 0.5
```

严重程度权重:
- 高风险 (high): 3
- 中风险 (medium): 2
- 低风险 (low): 1

## 项目结构

```
road-inspection-analyzer/
├── server/                     # 后端代码
│   ├── index.js               # 入口文件和 API 路由
│   ├── database.js            # 数据库操作
│   ├── file-import.js         # 文件导入和解析
│   ├── risk-analysis.js       # 风险分析逻辑
│   └── exporter.js            # 导出功能
├── client/                     # 前端代码
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.js             # 主应用组件
│       ├── App.css            # 样式文件
│       ├── index.js           # 入口文件
│       ├── api/
│       │   └── index.js       # API 调用工具
│       └── pages/
│           ├── BatchList.js   # 批次列表页面
│           └── BatchDetail.js # 批次详情页面
├── sample-data/                # 示例数据
│   ├── sample-route.gpx
│   ├── sample-road-conditions.csv
│   └── sample-photo-index.csv
├── data/                       # 数据库文件目录 (运行时生成)
├── exports/                    # 导出文件目录 (运行时生成)
├── uploads/                    # 上传临时文件目录 (运行时生成)
├── package.json                # 后端依赖配置
└── README.md                   # 本文档
```

## API 接口

### 批次管理
- `GET /api/batches` - 获取所有批次
- `POST /api/batches` - 创建新批次
- `GET /api/batches/:id` - 获取批次详情
- `DELETE /api/batches/:id` - 删除批次
- `POST /api/batches/:id/upload` - 上传文件
- `POST /api/batches/:id/analyze` - 触发风险分析
- `GET /api/batches/:id/high-risk` - 获取高风险路段
- `GET /api/batches/:id/routes` - 获取路线列表
- `POST /api/batches/:id/export/markdown` - 导出 Markdown
- `POST /api/batches/:id/export/json` - 导出 JSON

### 其他接口
- `PUT /api/conditions/:id/overrule` - 人工改判
- `GET /api/risk-types` - 获取风险类型定义
- `GET /api/health` - 健康检查

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
