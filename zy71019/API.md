# 分时租车损伤仲裁 API

## 项目结构

```
.
├── cmd/server/          # 服务入口
├── internal/
│   ├── models/          # 数据模型和DTO
│   ├── database/        # 数据库层 (SQLite)
│   ├── service/         # 业务逻辑层
│   ├── api/             # REST API层
│   └── export/          # 报告导出服务
├── data/                # SQLite数据库文件目录
└── bin/                 # 编译输出
```

## 状态机流转

```
created → validating → blocked → processing → appealing → closed
                          ↓           ↓
                      processing  (处理申诉后)
```

## 核心功能

1. **校验阶段**: 照片时间连续性验证、损伤重复检测
2. **处理阶段**: 状态流转、证据留痕、改动差异
3. **结案阶段**: 结论记录、报告导出

## API 接口

### 基础URL: `http://localhost:8080/api/v1`

### 1. 登记仲裁记录
**POST** `/arbitration`
```json
{
  "order_id": "ORDER20240101001",
  "vehicle_id": "VEH001",
  "user_id": "USER001",
  "pickup_time": "2024-01-01T10:00:00Z",
  "return_time": "2024-01-02T18:00:00Z",
  "pickup_photos": [
    {"photo_url": "http://example.com/p1.jpg", "photo_time": "2024-01-01T10:00:00Z", "remark": "左前门"}
  ],
  "return_photos": [
    {"photo_url": "http://example.com/r1.jpg", "photo_time": "2024-01-02T18:00:00Z", "remark": "左前门刮蹭"}
  ],
  "damages": [
    {"damage_type": "scratch", "location": "左前门", "severity": "minor", "description": "长约10cm刮痕", "deduct_amount": 200, "photo_urls": ["http://example.com/d1.jpg"]}
  ],
  "operator_id": "OP001",
  "operator_name": "张三"
}
```

### 2. 拦截仲裁
**POST** `/arbitration/block`
```json
{
  "arbitration_id": 1,
  "operator_id": "OP001",
  "operator_name": "张三",
  "reason": "照片时间异常，需人工审核"
}
```

### 3. 放行仲裁
**POST** `/arbitration/release`
```json
{
  "arbitration_id": 1,
  "operator_id": "OP001",
  "operator_name": "张三",
  "reason": "照片核实无误"
}
```

### 4. 补录信息
**POST** `/arbitration/supplement`
```json
{
  "arbitration_id": 1,
  "operator_id": "OP001",
  "operator_name": "张三",
  "damages": [{"damage_type": "dent", "location": "右后视镜", "severity": "minor", "deduct_amount": 100}],
  "photos": [{"photo_type": "damage", "photo_url": "http://example.com/d2.jpg", "photo_time": "2024-01-02T18:05:00Z", "remark": "补录"}],
  "remark": "补录右后视镜损伤"
}
```

### 5. 结案
**POST** `/arbitration/close`
```json
{
  "arbitration_id": 1,
  "handler_id": "OP001",
  "handler_name": "张三",
  "final_result": "用户责任",
  "final_remark": "刮蹭属实，扣除押金200元",
  "refund_amount": 0
}
```

### 6. 查询详情
**GET** `/arbitration/{id}`

### 7. 列表查询
**GET** `/arbitration?order_id=&vehicle_id=&user_id=&status=&start_date=&end_date=&page=1&page_size=20`

### 8. 用户提交申诉
**POST** `/appeal/submit`
```json
{
  "arbitration_id": 1,
  "user_id": "USER001",
  "content": "该刮伤取车时已有",
  "evidence_urls": ["http://example.com/evidence1.jpg"]
}
```

### 9. 处理申诉
**POST** `/appeal/handle`
```json
{
  "arbitration_id": 1,
  "handler_id": "OP001",
  "handler_name": "张三",
  "handler_remark": "申诉属实，予以退款",
  "approve": true,
  "refund_amount": 200
}
```

### 10. 导出报告
- **GET** `/export/json?status=closed` - JSON格式
- **GET** `/export/csv?status=closed` - CSV格式
- **GET** `/export/damage/{id}/csv` - 单条损伤明细
- **GET** `/export/logs/{id}/csv` - 操作日志

## 启动服务

```bash
# 编译
go build -o bin/server ./cmd/server

# 运行
./bin/server

# 或直接运行
go run ./cmd/server
```

环境变量:
- `PORT`: 服务端口 (默认 8080)
- `DB_PATH`: 数据库路径 (默认 ./data/arbitration.db)

## 核心特性

1. **重复扣费拦截**: 通过车辆历史损伤库自动检测重复损伤
2. **证据留痕**: 所有状态变更都记录操作日志
3. **改动差异**: 补录时记录字段级变更历史
4. **照片校验**: 自动检测照片时间连续性和时序问题
5. **灵活导出**: 支持按条件导出JSON/CSV格式报告
