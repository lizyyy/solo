# 社区上门服务路线规划工具

一个针对社区上门服务团队的路线规划与派单优化工具，适用于维修、家政、取送洗等场景。

## 功能特性

### 📊 数据导入
- 支持导入 `jobs.csv` - 客户任务信息（位置、时间窗、服务类型等）
- 支持导入 `workers.csv` - 师傅信息（技能、起终点、工作时间等）
- 支持导入 `travel-times.json` - 地点间行程时间矩阵
- 支持导入 `road-rules.json` - 限行规则、午休规则等

### 🚀 路线优化
- 基于贪心策略的 VRP（车辆路径问题）求解器
- 自动按约束条件优化：
  - 客户时间窗要求
  - 师傅技能匹配
  - 午休时间安排
  - 限行规则规避
  - 最短总距离和总时间

### 📈 可视化视图
- **甘特图视图**：直观展示每个师傅的时间线，包括行程、服务、午休时段
- **地图视图**：基于坐标的路线节点展示，按师傅分色区分

### ⚡ 实时调整
- 手动调整任务顺序
- 换派任务给其他师傅
- 调整后即时重算 ETA、总路程/耗时
- 实时风险评估（迟到风险、超时风险、技能不匹配、限行冲突）

### 📋 方案管理
- 临时加单重排
- 多方案对比（最多 3 个）
- 方案版本管理
- 激活指定方案

### 📤 导出报告
- **派单表**：CSV、JSON 格式（给师傅）
- **复盘报告**：HTML、Markdown、CSV、JSON 格式（给老板）

## 项目结构

```
route-planner/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── database/          # SQLite 数据库
│   │   │   └── index.js
│   │   ├── models/            # 数据模型
│   │   │   ├── Job.js
│   │   │   └── Worker.js
│   │   ├── repositories/      # 数据访问层
│   │   │   ├── JobRepository.js
│   │   │   ├── WorkerRepository.js
│   │   │   └── PlanRepository.js
│   │   ├── routes/            # API 路由
│   │   │   ├── jobs.js
│   │   │   ├── workers.js
│   │   │   ├── plans.js
│   │   │   ├── optimize.js
│   │   │   ├── import.js
│   │   │   └── export.js
│   │   ├── services/          # 核心服务
│   │   │   ├── TravelTimeService.js
│   │   │   ├── ConstraintChecker.js
│   │   │   └── RouteOptimizer.js
│   │   ├── utils/             # 工具函数
│   │   │   └── time.js
│   │   └── server.js          # 服务器入口
│   ├── package.json
│   └── tests/                 # 测试文件
│       ├── time.test.js
│       └── models.test.js
│
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── components/        # 组件
│   │   │   └── Layout.jsx
│   │   ├── pages/             # 页面
│   │   │   ├── Dashboard.jsx
│   │   │   ├── DataImport.jsx
│   │   │   ├── PlanView.jsx
│   │   │   ├── CompareView.jsx
│   │   │   ├── Reports.jsx
│   │   │   └── Settings.jsx
│   │   ├── utils/             # 工具
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── data/                       # 样例数据
│   ├── jobs.csv
│   ├── workers.csv
│   ├── travel-times.json
│   └── road-rules.json
│
└── README.md
```

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 启动服务

**方式一：分别启动**

```bash
# 启动后端服务 (端口 3001)
cd backend
npm run dev

# 新终端启动前端服务 (端口 5173)
cd frontend
npm run dev
```

**方式二：使用 concurrently（推荐）**

```bash
# 在项目根目录
npm install -g concurrently
concurrently "cd backend && npm run dev" "cd frontend && npm run dev"
```

### 访问应用
- 前端地址：http://localhost:5173
- 后端 API：http://localhost:3001

## 使用流程

### 1. 准备数据
确保 `data/` 目录下有以下样例数据文件（已预置）：
- `jobs.csv` - 20 个样例任务
- `workers.csv` - 5 位样例师傅
- `travel-times.json` - 完整的行程时间矩阵
- `road-rules.json` - 限行规则配置

### 2. 导入数据
1. 打开应用，进入"数据导入"页面
2. 依次导入四个数据文件
3. 可以选择"导入时清空现有数据"以重置

### 3. 生成方案
1. 进入"路线规划"页面
2. 点击"生成方案"按钮
3. 系统将自动优化路线并显示结果

### 4. 查看路线
- **甘特图视图**：查看每个师傅的时间线，风险任务会高亮显示
- **地图视图**：查看路线节点分布，按师傅分色

### 5. 导出报告
1. 进入"导出报告"页面
2. 选择要导出的方案
3. 导出派单表（给师傅）或复盘报告（给老板）

## 数据格式说明

### jobs.csv（任务数据）
```csv
id,location_name,address,lat,lng,service_type,time_window_start,time_window_end,service_duration_minutes,priority,notes
1,阳光花园1号楼101,阳光路88号,31.234,121.456,维修,09:00,11:00,30,1,空调维修
```

**字段说明**：
- `id`：任务唯一标识
- `location_name`：地点名称（显示用）
- `address`：详细地址
- `lat/lng`：坐标
- `service_type`：服务类型（维修/保洁/洗衣）
- `time_window_start/end`：客户时间窗
- `service_duration_minutes`：预计服务时长（分钟）
- `priority`：优先级（1-5，1 最高）
- `notes`：备注

### workers.csv（师傅数据）
```csv
id,name,phone,skills,start_location_name,start_lat,start_lng,end_location_name,end_lat,end_lng,work_start_time,work_end_time,max_jobs,vehicle_type
1,张师傅,13800138001,"维修,保洁",站点A,31.230,121.450,站点A,31.230,121.450,08:00,18:00,6,电动车
```

**字段说明**：
- `id`：师傅唯一标识
- `name`：姓名
- `phone`：手机号
- `skills`：技能列表（逗号分隔）
- `start_location_name/start_lat/start_lng`：起点（早上出发地点）
- `end_location_name/end_lat/end_lng`：终点（晚上返回地点）
- `work_start_time/end_time`：工作时间
- `max_jobs`：一天最大任务数
- `vehicle_type`：车辆类型

### travel-times.json（行程时间矩阵）
```json
{
  "locations": ["站点A", "站点B", "阳光花园1号楼", ...],
  "timeMatrix": [
    [0, 15, 10, ...],
    [15, 0, 20, ...],
    ...
  ],
  "distanceMatrix": [
    [0, 5, 3, ...],
    ...
  ]
}
```

**说明**：
- `locations`：地点名称列表
- `timeMatrix`：从地点 i 到 j 的时间（分钟）
- `distanceMatrix`：从地点 i 到 j 的距离（公里）

### road-rules.json（限行规则）
```json
{
  "restrictedAreas": [
    {
      "name": "市中心限行区",
      "latMin": 31.23,
      "latMax": 31.25,
      "lngMin": 121.46,
      "lngMax": 121.50,
      "vehicleTypes": ["货车"],
      "timeSlots": [
        { "start": "08:00", "end": "10:00" },
        { "start": "16:00", "end": "19:00" }
      ]
    }
  ],
  "lunchBreak": {
    "enabled": true,
    "startTime": "12:00",
    "endTime": "13:00",
    "durationMinutes": 60
  },
  "timeSlotWeights": [
    { "start": "07:00", "end": "09:00", "multiplier": 1.5 },
    { "start": "16:30", "end": "18:30", "multiplier": 1.5 }
  ]
}
```

**说明**：
- `restrictedAreas`：限行区域配置
- `lunchBreak`：午休规则
- `timeSlotWeights`：高峰时段时间乘数（早高峰、晚高峰）

## 风险类型说明

| 风险类型 | 说明 |
|---------|------|
| 迟到风险 | 预计到达时间晚于客户时间窗开始 |
| 超时风险 | 预计结束时间晚于师傅工作时间限制 |
| 技能不匹配 | 师傅技能与任务服务类型不匹配 |
| 限行冲突 | 任务区域或时间存在限行规则冲突 |

## 运行测试

```bash
cd backend
npm test
```

测试覆盖：
- 时间工具函数（解析、格式化、转换）
- 数据模型验证（Job、Worker）

## API 接口

### 任务管理
- `GET /api/jobs` - 获取所有任务
- `POST /api/jobs` - 创建任务
- `GET /api/jobs/:id` - 获取单个任务
- `PUT /api/jobs/:id` - 更新任务
- `DELETE /api/jobs/:id` - 删除任务
- `POST /api/jobs/batch` - 批量创建任务

### 师傅管理
- `GET /api/workers` - 获取所有师傅
- `POST /api/workers` - 创建师傅
- `GET /api/workers/:id` - 获取单个师傅
- `PUT /api/workers/:id` - 更新师傅
- `DELETE /api/workers/:id` - 删除师傅
- `POST /api/workers/batch` - 批量创建师傅

### 方案管理
- `GET /api/plans` - 获取所有方案
- `POST /api/plans` - 创建方案
- `GET /api/plans/:id` - 获取单个方案详情
- `PUT /api/plans/:id` - 更新方案
- `DELETE /api/plans/:id` - 删除方案
- `PUT /api/plans/:id/activate` - 激活方案
- `GET /api/plans/active` - 获取激活方案
- `POST /api/plans/compare` - 对比多个方案

### 路线优化
- `POST /api/optimize` - 生成最优路线方案
- `POST /api/optimize/reoptimize-route` - 重优化路线
- `POST /api/optimize/recalculate-eta` - 重算 ETA
- `POST /api/optimize/move-job` - 移动任务
- `POST /api/optimize/add-job` - 临时加单

### 数据导入
- `POST /api/import/jobs` - 导入任务 CSV
- `POST /api/import/workers` - 导入师傅 CSV
- `POST /api/import/travel-times` - 导入行程时间矩阵
- `POST /api/import/road-rules` - 导入限行规则

### 数据导出
- `GET /api/export/plan/:id/dispatch-table?format=csv|json` - 导出派单表
- `GET /api/export/plan/:id/report?format=html|markdown|csv|json` - 导出复盘报告

## 技术栈

### 后端
- **框架**：Express.js
- **数据库**：SQLite3
- **依赖**：cors、csv-parser、json2csv、multer、uuid
- **测试**：Jest

### 前端
- **框架**：React 18
- **构建工具**：Vite
- **样式**：Tailwind CSS
- **图标**：Lucide React
- **HTTP 客户端**：Axios
- **路由**：React Router

## 算法说明

### 路线优化策略
采用贪心插入策略求解 VRP 问题：

1. **任务排序**：按优先级、时间窗起始时间排序
2. **分配尝试**：为每个任务尝试所有可用师傅
3. **插入位置评估**：计算插入到路线不同位置的成本增量
4. **选择最优**：选择成本增量最小的位置插入
5. **约束检查**：验证是否满足所有约束条件

### 约束条件
- ✅ 技能匹配检查
- ✅ 时间窗检查
- ✅ 工作时间检查
- ✅ 任务数量限制
- ✅ 限行规则检查
- ✅ 午休时间安排

### ETA 计算
```
预计到达时间(ETA) = 上一站离开时间 + 行程时间 + 等待时间
预计离开时间(ETD) = ETA + 服务时长
```

考虑因素：
- 行程时间（从 timeMatrix 获取）
- 高峰时段乘数
- 时间窗等待（早到则等待到时间窗开始）
- 午休插入（如果服务时间跨午休时段）

## 许可证

MIT License
