# 餐厅预制菜留样API

中央厨房预制菜留样追溯管理系统后端API服务

## 功能特性

- **菜品批次管理**: 创建、查询生产批次信息
- **留样盒管理**: 留样入库、位置分配、状态追踪
- **冷藏位置管理**: 冷库分区管理、容量监控
- **抽检记录管理**: 质量抽检、多级审核、补偿流程
- **销毁确认**: 留样到期销毁、双人复核
- **追溯报告**: 一键生成批次/留样追溯报告
- **异常处理**: 异常自动记录、人工处理追踪
- **人工修正**: 数据修正审计、操作留痕
- **数据导出**: 追溯报告JSON格式导出

## 状态定义

### 抽检状态
- `pending_review`: 待复核
- `review_passed`: 已通过
- `review_rejected`: 已驳回
- `compensation_pending`: 补偿待确认
- `compensated`: 已补偿

### 留样状态
- `stored`: 已入库
- `inspected`: 已抽检
- `pending_destruction`: 待销毁
- `destroyed`: 已销毁
- `expired`: 已过期

### 销毁状态
- `pending`: 待确认
- `confirmed`: 已确认
- `cancelled`: 已取消

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化样例数据

```bash
npm run init-data
```

### 3. 启动服务

```bash
npm start
```

服务将在 http://localhost:3000 启动

## API接口文档

### 基础信息

- 服务地址: http://localhost:3000
- API前缀: /api
- 健康检查: GET /api/health

### 1. 批次管理

#### 创建批次
```
POST /api/batches
Content-Type: application/json

{
  "dish_name": "菜品名称",
  "production_date": "2024-01-01",
  "production_line": "Line-1",
  "chef": "厨师姓名",
  "quantity": 100,
  "shelf_life_days": 48,
  "ingredients": "原材料列表",
  "supplier": "供应商",
  "remarks": "备注"
}
```

#### 查询批次列表
```
GET /api/batches?status=sampled&dish_name=宫保鸡丁&page=1&limit=20
```

#### 查询批次详情
```
GET /api/batches/{id}
```

### 2. 留样盒管理

#### 创建留样盒
```
POST /api/sample-boxes
Content-Type: application/json

{
  "batch_id": 1,
  "location_id": 1,
  "sample_weight": 200,
  "operator": "留样员姓名",
  "remarks": "备注"
}
```

#### 查询留样盒列表
```
GET /api/sample-boxes?status=stored&batch_id=1&location_id=1
```

#### 查询留样盒详情
```
GET /api/sample-boxes/{id}
```

### 3. 冷藏位置管理

#### 创建冷藏位置
```
POST /api/storage-locations
Content-Type: application/json

{
  "code": "A01",
  "name": "冷藏区A-01",
  "description": "第一层左侧",
  "capacity": 50,
  "temperature_min": -20,
  "temperature_max": -15
}
```

#### 查询所有位置
```
GET /api/storage-locations
```

### 4. 抽检管理

#### 创建抽检记录
```
POST /api/inspections
Content-Type: application/json

{
  "sample_box_id": 1,
  "inspector": "质检员姓名",
  "temperature": -16,
  "appearance": "正常",
  "smell": "正常",
  "taste": "正常",
  "microorganism_result": "阴性",
  "result": "qualified",
  "conclusion": "符合留样标准"
}
```

#### 复核抽检记录
```
POST /api/inspections/{id}/review
Content-Type: application/json

{
  "passed": true,
  "reviewer": "主管姓名",
  "comment": "抽检合格，同意通过"
}
```

#### 申请补偿
```
POST /api/inspections/{id}/apply-compensation
Content-Type: application/json

{
  "details": "重新采样补偿申请"
}
```

#### 确认补偿
```
POST /api/inspections/{id}/confirm-compensation
Content-Type: application/json

{
  "operator": "处理人姓名"
}
```

#### 查询抽检列表
```
GET /api/inspections?status=pending_review&sample_box_id=1
```

### 5. 销毁管理

#### 申请销毁 (第一步：单人申请)
```
POST /api/destructions/request
Content-Type: application/json

{
  "sample_box_id": 1,
  "operator": "申请人姓名",
  "destruction_method": "高温销毁",
  "reason": "留样到期正常销毁"
}
```

#### 确认销毁 (第二步：双人复核)
```
POST /api/destructions/{id}/confirm
Content-Type: application/json

{
  "witness": "确认人姓名"
}
```

#### 取消销毁申请
```
POST /api/destructions/{id}/cancel
Content-Type: application/json

{
  "operator": "操作人姓名",
  "reason": "取消原因"
}
```

#### 查询销毁记录
```
GET /api/destructions?status=pending&sample_box_id=1
```

#### 查询销毁详情
```
GET /api/destructions/{id}
```

### 6. 追溯报告

#### 生成追溯报告
```
POST /api/trace-reports
Content-Type: application/json

{
  "batch_id": 1,
  "report_type": "batch_trace",
  "generated_by": "管理员"
}
```

或按留样盒生成:
```json
{
  "sample_box_id": 1,
  "report_type": "sample_trace",
  "generated_by": "管理员"
}
```

#### 查询报告列表
```
GET /api/trace-reports
```

#### 查询报告详情
```
GET /api/trace-reports/{id}
```

#### 导出报告
```
GET /api/export/trace-report/{id}
```

### 7. 异常处理

#### 查询异常日志
```
GET /api/exception-logs
```

#### 处理异常
```
POST /api/exception-logs/{id}/handle
Content-Type: application/json

{
  "conclusion": "已修复数据异常",
  "handled_by": "管理员姓名"
}
```

### 8. 人工修正

#### 修正数据
```
POST /api/manual-corrections
Content-Type: application/json

{
  "target_table": "batches",
  "target_id": 1,
  "field_name": "chef",
  "new_value": "李师傅",
  "reason": "原数据录入错误",
  "operator": "管理员姓名"
}
```

#### 查询修正记录
```
GET /api/manual-corrections
```

### 9. 统计信息

#### 汇总统计
```
GET /api/statistics/summary
```

## 数据库文件

数据库文件存储在 `data/database.db`，重启服务后数据不会丢失。

## 目录结构

```
.
├── src/
│   ├── server.js          # 服务入口
│   ├── database.js        # 数据库操作
│   ├── businessLogic.js   # 业务逻辑层
│   └── routes.js          # API路由
├── scripts/
│   └── initSampleData.js  # 样例数据初始化
├── data/                  # 数据库文件目录
├── package.json
└── README.md
```

## 核心业务规则

1. **批次绑定**: 每个留样盒必须关联一个生产批次
2. **留样时限**: 默认48小时留样期，自动计算过期时间
3. **抽检复核**: 抽检记录必须经过复核流程
4. **销毁状态机**: 留样销毁需要双人确认
5. **异常追踪**: 所有API异常自动记录并支持人工处理
6. **数据审计**: 所有人工修改操作留痕
