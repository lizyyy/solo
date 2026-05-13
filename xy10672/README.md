# 机场接送航班改派管理系统

这是一个完整的前后端一体工具，用于处理机场接送的航班改派业务，确保航班动态更新时客户行程和服务评价保持一致。

## 功能特性

### 前端页面
- **复核操作面板**：校验司机车辆、计算等待费用、保存改签重派
- **搜索过滤**：按航班号、客户姓名、状态筛选
- **统计卡片**：总行程数、待处理、已完成、已改派、等待费用、平均评分
- **数据展示**：航班动态、司机车辆、客户行程、等待计费、改签重派、服务评价、历史记录
- **导出报告**：按操作人和时间范围筛选并导出CSV报告

### 后端接口
- **校验司机车辆**：验证司机与车辆匹配关系及可用性
- **推进等待计费**：计算客户等待时间和费用
- **保存改签重派**：记录司机改派操作并更新行程

### 数据追踪
- 保留航班动态修改前后值
- 保留司机车辆修改前后值
- 保留客户行程修改前后值
- 历史记录可按操作人和时间筛选

## 本地启动

### 1. 安装后端依赖
```bash
npm install
```

### 2. 启动后端服务
```bash
npm start
```
后端服务将在 `http://localhost:5000` 启动

### 3. 打开前端页面
在浏览器中直接打开 `client/index.html` 文件，或使用任何静态文件服务器：

```bash
# 使用 Python (Python 3)
cd client && python -m http.server 8080

# 或使用 Node.js 的 http-server
npm install -g http-server
cd client && http-server -p 8080
```

然后在浏览器访问 `http://localhost:8080`

## 主要 API

### GET /api/flights
获取航班动态列表

**查询参数：**
- `flightNo`：航班号模糊搜索
- `status`：状态筛选 (on_time/delayed/cancelled)

### GET /api/drivers
获取司机车辆列表

**查询参数：**
- `name`：司机姓名模糊搜索
- `status`：状态筛选 (available/on_trip/offline)

### GET /api/trips
获取客户行程列表

**查询参数：**
- `customerName`：客户姓名模糊搜索
- `flightNo`：航班号模糊搜索
- `status`：状态筛选

### POST /api/validate-driver-vehicle
校验司机车辆匹配关系

**请求体：**
```json
{
  "driverId": "D001",
  "vehicleId": "V001",
  "tripId": "T001"
}
```

**响应示例：**
```json
{
  "success": true,
  "message": "校验通过",
  "data": {
    "driver": { "id": "D001", "name": "张三", "phone": "13800138001", "rating": 4.8 },
    "vehicle": { "id": "V001", "plate": "沪A12345", "model": "别克GL8" }
  }
}
```

### POST /api/calculate-waiting-fee
计算等待费用

**请求体：**
```json
{
  "tripId": "T002",
  "arriveTime": "2026-05-14 10:00:00",
  "pickupTime": "2026-05-14 10:45:00",
  "handler": "调度员A"
}
```

**响应示例：**
```json
{
  "success": true,
  "message": "等待费用计算成功",
  "data": {
    "id": "W002",
    "waitingMinutes": 45,
    "freeMinutes": 30,
    "chargeMinutes": 15,
    "amount": 30,
    "status": "calculated"
  }
}
```

### POST /api/save-reassign
保存改签重派

**请求体：**
```json
{
  "tripId": "T001",
  "oldDriverId": "D001",
  "newDriverId": "D003",
  "reason": "航班延误，原司机已有其他安排",
  "handler": "调度员B"
}
```

**响应示例：**
```json
{
  "success": true,
  "message": "改签重派保存成功",
  "data": {
    "id": "R002",
    "oldDriverName": "张三",
    "newDriverName": "王五",
    "reason": "航班延误，原司机已有其他安排",
    "handler": "调度员B"
  }
}
```

### GET /api/history
获取历史操作记录

**查询参数：**
- `handler`：操作人模糊搜索
- `startTime`：开始时间筛选
- `endTime`：结束时间筛选

### GET /api/export-report
导出历史操作报告

**查询参数：**
- `handler`：操作人模糊搜索
- `startTime`：开始时间筛选
- `endTime`：结束时间筛选

## 测试数据

系统预置了完整的测试数据：

### 航班动态 (4条)
- CA1234 北京首都→上海浦东 (延误)
- MU5678 广州白云→上海虹桥 (准点)
- CZ9012 深圳宝安→北京大兴 (延误)
- HU3456 成都天府→上海浦东 (取消)

### 司机车辆 (4人)
- 张三 (沪A12345 别克GL8) - 可用
- 李四 (沪B67890 丰田埃尔法) - 执行中
- 王五 (沪C11111 奔驰V级) - 可用
- 赵六 (沪D22222 大众迈腾) - 离线

### 客户行程 (3单)
- ORD20260514001 王先生 (CA1234)
- ORD20260514002 李女士 (MU5678)
- ORD20260514003 张总 (CZ9012)

### 其他测试数据
- 等待计费记录 1 条
- 改签重派记录 1 条
- 服务评价记录 2 条
- 历史操作记录 5 条

## 会失败的操作

### 1. 司机与车辆不匹配
**操作：** 校验司机车辆时，选择司机"张三"但车辆ID填"V002"

**结果：**
```json
{
  "success": false,
  "message": "司机与车辆不匹配",
  "code": "DRIVER_VEHICLE_MISMATCH"
}
```

### 2. 司机不可用（执行中）
**操作：** 校验司机车辆时选择司机"李四"

**结果：**
```json
{
  "success": false,
  "message": "司机当前执行中",
  "code": "DRIVER_NOT_AVAILABLE"
}
```

### 3. 新老司机相同
**操作：** 改签重派时，原司机和新司机都选"张三"

**结果：**
```json
{
  "success": false,
  "message": "新司机不能与原司机相同",
  "code": "SAME_DRIVER"
}
```

### 4. 接客时间早于到达时间
**操作：** 计算等待费用时，接客时间设为比到达时间更早

**结果：**
```json
{
  "success": false,
  "message": "接客时间不能早于到达时间",
  "code": "PICKUP_BEFORE_ARRIVE"
}
```

### 5. 选择离线司机
**操作：** 改签重派时新司机选择"赵六"

**结果：**
```json
{
  "success": false,
  "message": "新司机不可用",
  "code": "NEW_DRIVER_NOT_AVAILABLE"
}
```

## 幂等性保证

系统设计了幂等性保护，重复操作不会产生重复数据：

- 同一行程重复计算等待费用：只会返回已有记录，不会创建新记录
- 同一行程、同一原司机和新司机重复改派：只会返回已有记录，不会创建新记录
- 用户刷新页面或重复点击按钮：结果稳定，数据不会重复

## 技术栈

- **后端：** Node.js + Express
- **前端：** 原生 JavaScript + Bootstrap 5
- **数据：** 内存数据存储（方便演示）
- **报告导出：** CSV 格式

## 项目结构

```
.
├── server/
│   ├── index.js          # 后端服务入口
│   ├── services.js       # 业务逻辑层
│   └── data/
│       └── sampleData.js # 样例数据
├── client/
│   ├── index.html        # 前端页面
│   └── app.js            # 前端逻辑
├── package.json          # 项目配置
└── README.md             # 本文档
```
