# 药企QA追踪系统 - API文档

## 概述
本系统用于药企QA部门的样品追踪、试验方案管理、环境箱记录以及异常事件处理。

## 服务启动
```bash
cd qa-tracking-system
go run main.go
```
服务默认运行在 `http://localhost:8080`

---

## API接口

### 1. 批次管理

#### 1.1 创建批次
```
POST /api/v1/batches
```
请求体：
```json
{
  "batch_no": "BATCH-2024-001",
  "product_name": "阿莫西林胶囊",
  "created_by": "张三"
}
```

#### 1.2 查询批次列表
```
GET /api/v1/batches?batch_no=&status=&offset=0&limit=10
```
参数：
- `batch_no`: 批次号（模糊查询）
- `status`: 状态（pending/processing/approved/rejected/returned）

#### 1.3 获取批次详情
```
GET /api/v1/batches/:id
```

#### 1.4 标记处理
```
PUT /api/v1/batches/:id/process
```
请求体：
```json
{
  "handler": "李四",
  "remark": "开始处理批次"
}
```

#### 1.5 退回修改
```
PUT /api/v1/batches/:id/return
```
请求体：
```json
{
  "handler": "李四",
  "reason": "样品数据不完整，请补充取样点信息"
}
```

#### 1.6 审核通过
```
PUT /api/v1/batches/:id/approve
```

#### 1.7 审核拒绝
```
PUT /api/v1/batches/:id/reject
```

#### 1.8 导出批次明细
```
GET /api/v1/batches/:id/export
```
返回CSV文件

---

### 2. 样品管理

#### 2.1 导入样品CSV
```
POST /api/v1/samples/import
```
表单数据：
- `file`: CSV文件
- `batch_id`: 批次ID

CSV格式：
```
sample_id,sample_name,sampling_point,sampling_time,sampler,description
S001,样品A,车间1号取样点,2024-01-15 09:30:00,王五,稳定性测试
```

#### 2.2 查询样品列表
```
GET /api/v1/samples?batch_id=&offset=0&limit=10
```

#### 2.3 样品追溯
```
GET /api/v1/samples/trace/:sample_id
```

---

### 3. 试验方案管理

#### 3.1 导入试验方案JSON
```
POST /api/v1/protocols/import?batch_id=1
```
请求体：
```json
{
  "protocol_id": "P001",
  "protocol_name": "加速稳定性试验方案",
  "version": "1.0",
  "created_by": "赵六",
  "conditions": {
    "temperature": 40,
    "humidity": 75,
    "duration": "6个月"
  }
}
```

#### 3.2 查询方案列表
```
GET /api/v1/protocols?batch_id=&offset=0&limit=10
```

---

### 4. 环境箱记录管理

#### 4.1 导入环境箱记录CSV
```
POST /api/v1/chambers/import
```
表单数据：
- `file`: CSV文件
- `sample_id`: 样品ID

CSV格式：
```
chamber_id,chamber_name,timestamp,temperature,humidity,pressure
CH001,稳定性试验箱1号,2024-01-15 10:00:00,40.2,75.3,101.3
```

#### 4.2 查询环境箱记录
```
GET /api/v1/chambers?chamber_id=&sample_id=&offset=0&limit=10
```

#### 4.3 环境箱历史查询
```
GET /api/v1/chambers/:chamber_id/history?start_time=&end_time=
```

---

### 5. 取样节点管理

#### 5.1 查询取样节点列表
```
GET /api/v1/nodes?sample_id=&offset=0&limit=10
```

#### 5.2 节点追溯（关键功能）
```
GET /api/v1/nodes/:node_id/trace
```
返回从根节点到当前节点的完整追溯链，可追踪每个节点的来源。

---

### 6. 异常事件管理

#### 6.1 创建异常事件
```
POST /api/v1/exceptions
```
请求体：
```json
{
  "batch_id": 1,
  "sample_node_id": "NODE-001",
  "event_type": "sampling_window",
  "severity": "high",
  "description": "取样窗口偏差超过2小时",
  "reason": "设备维护延误",
  "handler": "钱七",
  "resolution": "已重新取样"
}
```
事件类型（event_type）：
- `sampling_window`: 取样窗口
- `over_temperature`: 箱体超温
- `delay_approval`: 延期审批

#### 6.2 查询异常事件列表
```
GET /api/v1/exceptions?event_type=&batch_id=&offset=0&limit=10
```

---

### 7. 综合查询

#### 7.1 按批号查询
```
GET /api/v1/query/batch/:batch_no
```
返回批次完整信息，包括所有关联的样品、试验方案、追踪日志。

#### 7.2 按环境箱查询
```
GET /api/v1/query/chamber/:chamber_id?start_time=&end_time=
```

#### 7.3 按取样节点查询
```
GET /api/v1/query/node/:node_id
```

---

### 8. 导出功能

#### 8.1 导出查询结果
```
GET /api/v1/export/query?batch_no=&chamber_id=&node_id=&start_time=&end_time=
```
返回CSV文件。响应头 `X-Export-Count` 包含导出记录数，确保与查询结果一致。

---

## 数据追溯说明

每个取样节点通过 `parent_node_id` 建立父子关系，形成完整的追溯链。

**追溯示例：**
```
原始取样 (NODE-001)
    ↓
第一次分样 (NODE-002)
    ↓
第二次分样 (NODE-003)
    ↓
试验检测 (NODE-004)
```

通过 `GET /api/v1/nodes/NODE-004/trace` 可查看完整链路：
1. NODE-001 - 原始取样
2. NODE-002 - 第一次分样
3. NODE-003 - 第二次分样
4. NODE-004 - 试验检测

---

## 状态说明

### 批次状态
- `pending`: 待处理
- `processing`: 处理中
- `approved`: 已通过
- `rejected`: 已拒绝
- `returned`: 退回修改

### 异常级别
- `low`: 低
- `medium`: 中
- `high`: 高
- `critical`: 严重

---

## 项目结构
```
qa-tracking-system/
├── main.go              # 程序入口
├── go.mod               # 依赖管理
├── models/              # 数据模型
│   └── models.go
├── handlers/            # HTTP处理器
│   ├── handlers.go
│   └── query.go
├── services/            # 业务逻辑
│   ├── import.go
│   ├── batch.go
│   ├── query.go
│   └── export.go
├── config/              # 配置和数据库
│   ├── config.go
│   └── database.go
├── utils/               # 工具函数
│   └── utils.go
└── migrations/          # 数据库迁移
```
