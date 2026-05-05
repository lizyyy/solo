# 仓库无人车调度沙盘系统

一个基于3D可视化的本地仓库无人车调度系统，支持任务分配、路径规划、实时回放和方案对比。

## 功能特性

### 🗺️ 地图与数据导入
- 支持导入 `warehouse-map.json` - 仓库地图定义
- 支持导入 `orders.csv` - 订单数据
- 支持导入 `robots.yaml` - 机器人配置
- 内置标准仓库布局（40x30米，16个货架，多通道设计）

### 🤖 调度算法
- **路径规划**: A*算法，支持对角线移动和路径平滑
- **任务分配**: 贪心算法 + 拍卖算法
- **碰撞检测**: 基于预测位置的碰撞风险评估
- **窄通道管理**: 通行权请求、排队机制
- **多目标优化**: 距离、时间、电量、优先级综合考量

### 🚨 风险与状态管理
- **碰撞风险提示**: 四级风险等级（Low/Medium/High/Critical）
- **等待状态**: 机器人等待避让
- **充电状态**: 低电量自动充电
- **故障状态**: 机器人故障检测与任务重分配

### 🎬 回放与对比
- **实时回放**: 播放/暂停/快进/快退
- **帧级控制**: 精确到每一帧的播放控制
- **多速度播放**: 0.5x/1x/2x/4x
- **方案对比**: 两个调度方案的全方位对比分析
- **风险高亮**: 实时显示当前帧的风险警告

### 📊 报告导出
- **Markdown格式**: 美观的结构化报告
- **JSON格式**: 机器可读的完整数据
- **对比报告**: 双方案差异分析报告

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (Vue.js + Three.js)              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐  │
│  │ 3D Viewer   │  │ UI Panels   │  │ Replay Engine     │  │
│  │ (Three.js)  │  │ (Element+)  │  │ (Tween.js)        │  │
│  └─────────────┘  └─────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      后端 API (FastAPI)                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐  │
│  │ Data Import │  │ Scheduling  │  │ Report Export     │  │
│  │ Service     │  │ Service     │  │ Service           │  │
│  └─────────────┘  └─────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    核心算法层                                 │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌────────────────┐ ┌───────────────────┐ │
│  │ Pathfinding  │ │ TaskAssignment │ │ CollisionAvoidance │ │
│  │ (A*)         │ │ (Greedy/Auction)│ │ (Detection +      │ │
│  │              │ │                │ │  Narrow Passage)  │ │
│  └──────────────┘ └────────────────┘ └───────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    数据层 (SQLite)                           │
├─────────────────────────────────────────────────────────────┤
│  WarehouseMap │ Robot │ Order │ Task │ Batch │ Frame │ Risk│
└─────────────────────────────────────────────────────────────┘
```

## 安装与运行

### 环境要求
- Python 3.9+
- Node.js 18+
- npm/yarn

### 后端安装

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/macOS
# 或
venv\Scripts\activate     # Windows

# 安装依赖
pip install -r requirements.txt

# 运行服务
python run.py
```

后端服务将在 `http://localhost:8000` 启动。

### 前端安装

```bash
cd frontend

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建生产版本
npm run build
```

前端服务将在 `http://localhost:3000` 启动。

## 数据格式说明

### 1. 仓库地图 (warehouse-map.json)

```json
{
  "name": "自动化仓储中心 A区",
  "width": 40,
  "height": 30,
  "grid_size": 1,
  
  "shelves": [
    {
      "id": "S001",
      "x": 2,
      "y": 2,
      "width": 2,
      "height": 2,
      "zone": "A"
    }
  ],
  
  "stations": [
    {
      "id": "P001",
      "name": "拣货站 1",
      "x": 20,
      "y": 4,
      "type": "pickup"
    }
  ],
  
  "charging_stations": [
    {
      "id": "C001",
      "x": 25,
      "y": 2,
      "capacity": 2
    }
  ],
  
  "aisles": [],
  "narrow_passages": [],
  "obstacles": []
}
```

### 2. 订单数据 (orders.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 订单唯一标识 |
| priority | int | 优先级 (1-5，1最高) |
| pickup_x | float | 取货点X坐标 |
| pickup_y | float | 取货点Y坐标 |
| pickup_name | string | 取货点名称 |
| dropoff_x | float | 送货点X坐标 |
| dropoff_y | float | 送货点Y坐标 |
| dropoff_name | string | 送货点名称 |
| cargo_type | string | 货物类型 |
| cargo_weight | float | 货物重量(kg) |
| cargo_volume | float | 货物体积(m³) |

### 3. 机器人配置 (robots.yaml)

```yaml
robots:
  - id: R001
    name: "叉车一号"
    x: 25
    y: 2
    orientation: 0.0
    status: idle
    battery: 100.0
    max_speed: 1.5
    payload_capacity: 50.0
    type: "forklift"
```

## 使用流程

### 1. 数据导入

1. 打开系统，切换到「数据导入」标签页
2. 上传 `warehouse-map.json` - 地图文件
3. 上传 `robots.yaml` - 机器人配置
4. 上传 `orders.csv` - 订单数据

或直接使用内置的示例数据：点击「加载示例数据 (Seed)」

### 2. 执行调度

1. 切换到「调度控制」标签页
2. 选择调度算法：
   - **贪心算法**: 快速但可能非最优
   - **A*算法**: 基于路径优化
   - **遗传算法**: 多目标优化
   - **强化学习**: 需要预训练模型
3. 调整参数（安全距离、最大速度等）
4. 点击「创建并运行调度批次」

### 3. 回放查看

1. 切换到「回放控制」标签页
2. 选择已完成的调度批次
3. 点击「加载回放帧」
4. 使用播放控制：
   - 播放/暂停
   - 快进/快退
   - 速度调整 (0.5x ~ 4x)
   - 帧级拖动

### 4. 方案对比

1. 切换到「对比分析」标签页
2. 选择两个已完成的调度批次
3. 点击「执行对比分析」
4. 查看对比结果表格
5. 导出报告 (Markdown/JSON)

## 测试场景

系统内置了多种测试场景，位于 `data/examples/` 目录：

### 1. 碰撞风险测试 (collision-example)
- 两个机器人在交叉点相向而行
- 测试碰撞检测算法的响应速度
- 验证避让机制的正确性

### 2. 充电场景测试 (charging-example)
- 低电量机器人 (15%) vs 正常电量 (85%)
- 测试自动充电触发逻辑
- 验证充电状态的路径规划

### 3. 窄通道测试 (narrow-example)
- 宽度仅1.5米的窄通道
- 测试通行权管理机制
- 验证排队等待逻辑

### 4. 故障场景测试 (fault-example)
- 机器人在任务执行中故障
- 测试故障检测与任务重分配
- 验证系统容错能力

## API 文档

启动后端服务后，访问以下地址查看API文档：

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 核心接口

```
数据导入:
  POST /api/v1/import/map          # 导入地图
  POST /api/v1/import/robots       # 导入机器人
  POST /api/v1/import/orders       # 导入订单

调度:
  POST /api/v1/scheduling/batches       # 创建调度批次
  POST /api/v1/scheduling/batches/{id}/run    # 执行调度
  GET  /api/v1/scheduling/batches              # 获取批次列表

回放:
  POST /api/v1/scheduling/batches/{id}/generate-frames  # 生成回放帧
  GET  /api/v1/scheduling/batches/{id}/frames            # 获取回放帧

对比:
  POST /api/v1/scheduling/compare     # 对比两个批次

报告:
  GET /api/v1/reports/batch/{id}              # 获取单批次报告
  GET /api/v1/reports/comparison/{id1}/{id2}  # 获取对比报告
```

## 项目结构

```
warehouse-scheduler/
├── backend/                    # 后端服务
│   ├── app/
│   │   ├── models/            # 数据模型
│   │   │   ├── warehouse_map.py
│   │   │   ├── robot.py
│   │   │   ├── order.py
│   │   │   ├── task.py
│   │   │   ├── scheduling_batch.py
│   │   │   ├── replay_frame.py
│   │   │   └── collision_risk.py
│   │   ├── algorithms/        # 核心算法
│   │   │   ├── pathfinding.py      # A*路径规划
│   │   │   ├── task_assignment.py  # 任务分配
│   │   │   └── collision_avoidance.py # 碰撞避让
│   │   ├── services/          # 业务服务
│   │   │   ├── data_import_service.py
│   │   │   ├── scheduling_service.py
│   │   │   └── report_export_service.py
│   │   ├── controllers/       # API控制器
│   │   │   └── api_controller.py
│   │   ├── config.py
│   │   ├── database.py
│   │   └── main.py
│   ├── requirements.txt
│   └── run.py
│
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── components/
│   │   │   ├── Warehouse3DViewer.vue    # 3D场景
│   │   │   ├── DataImportPanel.vue      # 导入面板
│   │   │   ├── SchedulingPanel.vue      # 调度面板
│   │   │   ├── ReplayPanel.vue          # 回放面板
│   │   │   └── ComparisonPanel.vue      # 对比面板
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.vue
│   │   └── main.js
│   ├── package.json
│   └── vite.config.js
│
├── data/                       # 数据文件
│   ├── seed/                   # 标准测试数据
│   │   ├── warehouse-map.json
│   │   ├── orders.csv
│   │   └── robots.yaml
│   └── examples/               # 异常测试场景
│       ├── collision-example/
│       ├── charging-example/
│       ├── narrow-example/
│       └── fault-example/
│
└── tests/                      # 测试文件
    └── backend/
```

## 开发计划

- [x] 基础数据模型与API
- [x] 路径规划算法 (A*)
- [x] 任务分配算法
- [x] 碰撞检测与避让
- [x] 3D可视化展示
- [x] 回放控制
- [x] 方案对比
- [x] 报告导出
- [ ] 强化学习调度算法
- [ ] 实时WebSocket推送
- [ ] 更多3D特效与动画
- [ ] 性能优化与缓存

## 许可证

MIT License
