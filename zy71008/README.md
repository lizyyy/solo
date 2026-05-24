# 共享单车电池派送 API

## 项目概述

本项目是一个本地后端服务，用于管理城市运维队的共享单车电池派送业务。解决了禁停点无法换电、同电池重复派送、签收照片缺失等核心痛点。

## 技术栈

- **框架**: Spring Boot 3.2.5
- **数据库**: H2 (嵌入式文件数据库)
- **构建工具**: Maven
- **导出功能**: Apache POI (Excel)
- **JDK**: 17+

## 核心功能

### 1. 业务规则校验
- **禁停点拦截**: 自动识别禁停点并标记，需人工确认
- **重复派送检测**: 同一电池/车辆不能同时有多个活跃任务
- **电量阈值检查**: 高于阈值的车辆需确认是否需要换电
- **签收照片校验**: 强制要求签收照片，支持管理员跳过

### 2. 派送状态机
```
PENDING(待派送) → DISPATCHED(已派送) → ARRIVED(已到达) → COMPLETED(已完成)
     ↓                 ↓                 ↓
FORBIDDEN_LOCATION  CONFIRM_REQUIRED  PHOTO_MISSING
     ↓                 ↓                 ↓
CONFIRM_REQUIRED   人工确认后流转     人工确认/补照片
     ↓
  派送/取消
```

### 3. 全链路追踪
- 每条任务记录完整操作日志
- 保存原始输入数据
- 记录处置原因和状态变更历史

### 4. 报告导出
- 支持按时间/片区导出换电报告
- 支持导出任务明细报表
- 导出口径与业务判断保持一致

### 5. 错误分类
| 错误类型 | 说明 | HTTP状态码 |
|---------|------|-----------|
| 缺材料 | 必填字段缺失 | 400 |
| 状态不允许 | 状态流转非法 | 400 |
| 重复请求 | 电池/车辆重复派送 | 409 |
| 需要复核 | 需人工确认 | 409 |

## 快速开始

### 环境要求
- JDK 17+
- Maven 3.6+

### 启动服务
```bash
mvn spring-boot:run
```

服务默认端口: `8080`

### H2 数据库控制台
访问: `http://localhost:8080/h2-console`
- JDBC URL: `jdbc:h2:file:./data/battery_dispatch`
- 用户名: `sa`
- 密码: (空)

## API 接口

### 任务管理

#### 创建任务
```
POST /api/tasks
Content-Type: application/json

{
  "batchNo": "BATCH20240101",
  "vehicleNo": "V001",
  "batteryNo": "B101",
  "areaCode": "A001",
  "vehicleLocation": "东单路口",
  "locationCode": "L001",
  "dispatcherNo": "D001",
  "riderName": "张三",
  "originalBatteryLevel": 15,
  "rawInput": "原始输入数据..."
}
```

#### 查询任务详情
```
GET /api/tasks/{taskNo}
```

#### 按状态/批次查询任务
```
GET /api/tasks?statuses=PENDING,DISPATCHED
GET /api/tasks?batchNo=BATCH20240101
```

#### 开始派送
```
POST /api/tasks/{taskNo}/dispatch
{
  "operator": "张配送",
  "remark": "开始派送",
  "dispatcherNo": "D001"
}
```

#### 到达现场
```
POST /api/tasks/{taskNo}/arrive
{
  "operator": "张配送",
  "remark": "已到达"
}
```

#### 签收完成
```
POST /api/tasks/{taskNo}/sign
{
  "operator": "张配送",
  "remark": "换电完成",
  "photoUrl": "http://example.com/photo.jpg",
  "photoChecksum": "abc123",
  "overrideCheck": false
}
```

#### 人工确认/复核
```
POST /api/tasks/{taskNo}/confirm
{
  "operator": "管理员",
  "confirmed": true,
  "remark": "确认可以换电",
  "targetStatus": "DISPATCHED"
}
```

#### 取消任务
```
POST /api/tasks/{taskNo}/cancel
{
  "operator": "管理员",
  "remark": "车辆已被骑走"
}
```

### 报告导出

#### 导出换电报告
```
GET /api/reports/swap?startTime=2024-01-01T00:00:00&endTime=2024-01-31T23:59:59&areaCode=A001
```

#### 导出任务明细
```
GET /api/reports/tasks?startTime=2024-01-01T00:00:00&endTime=2024-01-31T23:59:59
```

### 基础数据管理

```
GET    /api/master/areas              # 查询片区
POST   /api/master/areas              # 新增片区
GET    /api/master/forbidden-locations # 查询禁停点
POST   /api/master/forbidden-locations # 新增禁停点
GET    /api/master/vehicles           # 查询车辆
POST   /api/master/vehicles           # 新增车辆
GET    /api/master/batteries          # 查询电池
POST   /api/master/batteries          # 新增电池
GET    /api/master/dispatchers        # 查询派送员
POST   /api/master/dispatchers        # 新增派送员
```

## 配置说明

`application.yml` 配置项:

```yaml
app:
  battery:
    low-battery-threshold: 20    # 低电量阈值(%)，高于此值需确认
  dispatch:
    photo-required: true         # 是否强制要求签收照片
```

## 数据模型

### 核心表
- `dispatch_tasks` - 派送任务主表
- `task_operation_logs` - 任务操作日志
- `battery_swap_reports` - 换电报告表
- `vehicles` - 车辆表
- `batteries` - 电池表
- `forbidden_locations` - 禁停点表
- `areas` - 片区表
- `dispatchers` - 派送员表

## 业务流程示例

### 正常流程
1. 创建任务 → 系统校验通过 → 状态 `PENDING`
2. 派送员接单 → 状态 `DISPATCHED`
3. 到达现场 → 状态 `ARRIVED`
4. 上传照片签收 → 状态 `COMPLETED`

### 禁停点流程
1. 创建任务 → 检测到禁停点 → 状态 `FORBIDDEN_LOCATION`
2. 管理员复核 → 确认可以换电 → 状态 `DISPATCHED`
3. 正常完成后续流程

### 照片缺失流程
1. 签收时未传照片 → 状态 `PHOTO_MISSING`
2. 补传照片或管理员跳过 → 状态 `COMPLETED`
