# 室内儿童活动室空气放行看板系统

一个用于室内儿童活动室空气质量监测和课程放行评估的本地看板系统。

## 功能特性

- 📊 **多数据导入**：支持导入传感器数据、通风记录、课程预约、清洁消毒记录
- 📈 **时间线对齐**：自动对齐所有数据的时间线
- 🔍 **智能计算**：自动计算通风恢复时长、峰值暴露、课程放行建议
- 📋 **人工改判**：支持老师人工改判放行状态并添加备注
- 💾 **数据持久化**：本地 SQLite 数据库存储，刷新不丢失数据
- 📄 **报告导出**：支持导出 Markdown 放行单和 JSON 明细
- 🎨 **可视化展示**：空气质量趋势曲线图、时间线视图

## 技术栈

### 后端
- Node.js + Express
- SQLite3 (本地数据库)
- PapaParse (CSV 解析)
- dayjs (日期处理)

### 前端
- React 18
- Chart.js + react-chartjs-2 (图表)
- Axios (HTTP 请求)

## 项目结构

```
air-quality-dashboard/
├── server/                    # 后端服务
│   ├── index.js              # 服务器入口
│   ├── database.js           # 数据库配置
│   ├── routes.js             # API 路由
│   ├── csvParser.js          # CSV 解析器
│   └── calculator.js         # 计算引擎
├── client/                    # 前端应用
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── index.js          # 入口文件
│       ├── App.js            # 主组件
│       ├── api.js            # API 接口
│       └── index.css         # 样式文件
├── examples/                  # 示例数据
│   ├── sensor_data.csv
│   ├── course_bookings.csv
│   ├── ventilation_records.csv
│   └── cleaning_records.csv
├── data/                      # 数据库文件目录
├── uploads/                   # 上传文件临时目录
├── package.json               # 后端依赖
└── README.md
```

## 安装与运行

### 环境要求

- Node.js 16.x 或更高版本
- npm 或 yarn

### 安装步骤

1. **安装后端依赖**
```bash
npm install
```

2. **安装前端依赖**
```bash
cd client
npm install
cd ..
```

或者使用一键安装：
```bash
npm run install-all
```

### 运行开发模式

同时启动后端和前端开发服务器：

```bash
npm run dev
```

这会启动：
- 后端服务：http://localhost:3001
- 前端服务：http://localhost:3000 (会自动打开浏览器)

### 单独运行

**仅启动后端：**
```bash
npm run server
```

**仅启动前端：**
```bash
npm run client
```

### 生产构建

```bash
npm run build
npm start
```

## 使用指南

### 1. 导入数据

访问系统后，切换到「数据导入」标签页，依次导入以下 CSV 文件：

1. **传感器数据** - CO2、PM2.5、TVOC 浓度数据
2. **课程预约** - 每日课程安排
3. **通风记录** - 开窗或新风操作记录
4. **清洁消毒** - 清洁消毒操作记录

### 2. CSV 文件格式

#### 传感器数据 (sensor_data.csv)
```csv
时间,CO2,PM2.5,TVOC
2026-05-05 08:00:00,650,12,0.3
2026-05-05 08:10:00,680,14,0.32
```

#### 课程预约 (course_bookings.csv)
```csv
课程名称,开始时间,结束时间,教师,学生人数
创意绘画班,2026-05-05 09:00:00,2026-05-05 09:45:00,张老师,12
```

#### 通风记录 (ventilation_records.csv)
```csv
开始时间,结束时间,类型,备注
2026-05-05 07:30:00,2026-05-05 08:30:00,开窗,课前开窗通风
```
- 类型：`开窗` 或 `新风`

#### 清洁消毒记录 (cleaning_records.csv)
```csv
时间,类型,操作人员,备注
2026-05-05 07:45:00,清洁,保洁阿姨,地面清洁
```
- 类型：`清洁` 或 `消毒`

### 3. 查看数据看板

切换到「数据看板」标签页：

1. **选择教室和日期** - 在顶部筛选器中选择
2. **课程放行评估** - 查看每场课程的空气质量评估
3. **执行评估** - 点击「重新评估所有课程」生成风险评估
4. **人工改判** - 点击「人工改判 / 添加备注」可修改放行状态
5. **查看曲线** - 查看 CO2、PM2.5、TVOC 的趋势曲线图
6. **时间线** - 查看课程、通风、清洁的时间线

### 4. 导出报告

切换到「导出与管理」标签页：

- **导出 Markdown 放行单** - 生成可读的放行报告
- **导出 JSON 明细** - 导出完整数据用于存档
- **清空数据** - 清空当前教室的所有数据

## 风险阈值

系统使用以下阈值进行风险评估：

| 指标 | 警告阈值 | 危险阈值 | 单位 |
|------|---------|---------|------|
| CO₂ | 1000 | 1500 | ppm |
| PM2.5 | 35 | 75 | μg/m³ |
| TVOC | 0.6 | 3.0 | mg/m³ |

### 评估逻辑

1. **风险等级**：根据实时数据与阈值比较，判定为「安全」、「警告」或「危险」
2. **通风恢复**：根据超标程度估算恢复到安全水平所需时间
3. **放行判定**：
   - 安全：自动放行 ✅
   - 警告且恢复时间 ≤ 15 分钟：放行 ✅
   - 警告且恢复时间 > 15 分钟：拒绝 ❌
   - 危险：拒绝 ❌

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/rooms | 获取教室列表 |
| GET | /api/timeline?room=&date= | 获取时间线数据 |
| POST | /api/assess | 评估所有课程 |
| PUT | /api/assessment/:id/override | 更新人工改判 |
| POST | /api/import/sensor | 导入传感器数据 |
| POST | /api/import/ventilation | 导入通风记录 |
| POST | /api/import/course | 导入课程预约 |
| POST | /api/import/cleaning | 导入清洁记录 |
| GET | /api/export/json?room=&date= | 导出 JSON |
| GET | /api/export/markdown?room=&date= | 导出 Markdown |
| DELETE | /api/clear/:room | 清空教室数据 |

## 快速体验

项目提供了示例数据，可快速体验系统功能：

1. 启动系统
2. 进入「数据导入」页面
3. 依次导入 `examples/` 目录下的 4 个 CSV 文件
4. 进入「数据看板」查看效果

## 注意事项

1. **日期格式**：CSV 文件中的日期时间格式需为 `YYYY-MM-DD HH:mm:ss` 或 `YYYY/MM/DD HH:mm:ss`
2. **本地存储**：所有数据存储在 `data/air_quality.db` SQLite 数据库中
3. **教室管理**：多教室数据通过导入时指定的教室名称区分
4. **数据安全**：本系统为本地部署，数据不经过云端

## 许可证

MIT License
