# REST API 调用示例

## 基础信息

- 服务地址: `http://localhost:3000`
- 健康检查: `GET /health`

---

## 1. 健康检查

```bash
curl http://localhost:3000/health
```

---

## 2. 门店管理

### 2.1 获取所有门店

```bash
curl http://localhost:3000/api/stores
```

### 2.2 搜索门店

```bash
curl "http://localhost:3000/api/stores?search=火锅"
```

### 2.3 按状态筛选门店

```bash
curl "http://localhost:3000/api/stores?status=active"
```

### 2.4 创建新门店

```bash
curl -X POST http://localhost:3000/api/stores \
  -H "Content-Type: application/json" \
  -d '{
    "name": "新测试餐厅",
    "code": "ST006",
    "address": "北京市朝阳区测试路100号",
    "latitude": 39.9000,
    "longitude": 116.4000,
    "contact": "测试经理",
    "phone": "13900139006",
    "contractStartDate": "2024-01-01",
    "contractEndDate": "2025-12-31",
    "status": "active"
  }'
```

### 2.5 获取单个门店详情

```bash
curl http://localhost:3000/api/stores/{storeId}
```

### 2.6 更新门店信息

```bash
curl -X PUT http://localhost:3000/api/stores/{storeId} \
  -H "Content-Type: application/json" \
  -d '{
    "contact": "新联系人",
    "phone": "13900139999"
  }'
```

---

## 3. 车辆管理

### 3.1 获取所有车辆

```bash
curl http://localhost:3000/api/vehicles
```

### 3.2 搜索车辆

```bash
curl "http://localhost:3000/api/vehicles?search=京A"
```

### 3.3 按状态筛选车辆

```bash
curl "http://localhost:3000/api/vehicles?status=active"
```

### 3.4 创建新车辆

```bash
curl -X POST http://localhost:3000/api/vehicles \
  -H "Content-Type: application/json" \
  -d '{
    "plateNumber": "京E99999",
    "type": "油罐车",
    "capacity": 8.0,
    "driverName": "测试司机",
    "driverPhone": "13900139999",
    "status": "active"
  }'
```

### 3.5 获取单个车辆详情

```bash
curl http://localhost:3000/api/vehicles/{vehicleId}
```

---

## 4. 批次管理

### 4.1 获取所有批次

```bash
curl http://localhost:3000/api/batches
```

### 4.2 按日期筛选批次

```bash
curl "http://localhost:3000/api/batches?date=2026-05-04"
```

### 4.3 筛选有风险的批次

```bash
curl "http://localhost:3000/api/batches?hasRisks=true"
```

### 4.4 创建新批次

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleId": "your-vehicle-uuid",
    "date": "2026-05-04",
    "batchNumber": "B20260504-TEST01"
  }'
```

### 4.5 获取批次详情

```bash
curl http://localhost:3000/api/batches/{batchId}
```

### 4.6 上传文件到批次

```bash
curl -X POST http://localhost:3000/api/batches/{batchId}/upload \
  -F "weighingCSV=@data/examples/weighing_normal.csv" \
  -F "waybillJSON=@data/examples/waybill_normal.json" \
  -F "gpsTrack=@data/examples/gps_track_normal.json"
```

### 4.7 上传带有重复称重的文件（测试风险检测）

```bash
curl -X POST http://localhost:3000/api/batches/{batchId}/upload \
  -F "weighingCSV=@data/examples/weighing_with_duplicate.csv"
```

### 4.8 上传带有无效门店的文件（测试风险检测）

```bash
curl -X POST http://localhost:3000/api/batches/{batchId}/upload \
  -F "weighingCSV=@data/examples/weighing_with_invalid_store.csv"
```

### 4.9 上传带有超时回收的文件（测试风险检测）

```bash
curl -X POST http://localhost:3000/api/batches/{batchId}/upload \
  -F "waybillJSON=@data/examples/waybill_with_overdue.json"
```

### 4.10 上传 GPS 轨迹未到店的文件（测试风险检测）

```bash
curl -X POST http://localhost:3000/api/batches/{batchId}/upload \
  -F "weighingCSV=@data/examples/weighing_normal.csv" \
  -F "gpsTrack=@data/examples/gps_track_not_at_store.json"
```

---

## 5. 复核管理

### 5.1 添加复核意见

```bash
curl -X POST http://localhost:3000/api/batches/{batchId}/review \
  -H "Content-Type: application/json" \
  -d '{
    "reviewerName": "张主管",
    "comment": "数据核实无误，无异常",
    "decision": "approve"
  }'
```

### 5.2 驳回批次

```bash
curl -X POST http://localhost:3000/api/batches/{batchId}/review \
  -H "Content-Type: application/json" \
  -d '{
    "reviewerName": "李主管",
    "comment": "发现重复称重记录，需要司机核实",
    "decision": "reject"
  }'
```

### 5.3 升级处理

```bash
curl -X POST http://localhost:3000/api/batches/{batchId}/review \
  -H "Content-Type: application/json" \
  -d '{
    "reviewerName": "王主管",
    "comment": "疑似偷倒风险，需升级处理",
    "decision": "escalate"
  }'
```

---

## 6. 风险处理

### 6.1 解决风险

```bash
curl -X POST http://localhost:3000/api/batches/risks/{riskId}/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolvedBy": "张主管",
    "resolutionNote": "经核实，重复记录是操作失误，已删除重复项"
  }'
```

---

## 7. 导出功能

### 7.1 导出当天稽核 Markdown

```bash
curl -O -J "http://localhost:3000/api/batches/export/markdown"
```

### 7.2 导出指定日期稽核 Markdown

```bash
curl -O -J "http://localhost:3000/api/batches/export/markdown?date=2026-05-04"
```

### 7.3 导出当天审计 JSON

```bash
curl -O -J "http://localhost:3000/api/batches/export/json"
```

### 7.4 导出指定日期审计 JSON

```bash
curl -O -J "http://localhost:3000/api/batches/export/json?date=2026-05-04"
```

---

## 8. 完整工作流程示例

### 8.1 准备工作

```bash
# 1. 获取车辆ID
VEHICLE_ID=$(curl -s http://localhost:3000/api/vehicles | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['items'][0]['id'])")
echo "车辆ID: $VEHICLE_ID"
```

### 8.2 创建批次

```bash
BATCH_RESPONSE=$(curl -s -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d "{
    \"vehicleId\": \"$VEHICLE_ID\",
    \"date\": \"2026-05-04\"
  }")

BATCH_ID=$(echo $BATCH_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "批次ID: $BATCH_ID"
```

### 8.3 上传文件

```bash
curl -X POST "http://localhost:3000/api/batches/$BATCH_ID/upload" \
  -F "weighingCSV=@data/examples/weighing_normal.csv" \
  -F "waybillJSON=@data/examples/waybill_normal.json" \
  -F "gpsTrack=@data/examples/gps_track_normal.json"
```

### 8.4 检查风险

```bash
curl "http://localhost:3000/api/batches/$BATCH_ID"
```

### 8.5 复核批次

```bash
curl -X POST "http://localhost:3000/api/batches/$BATCH_ID/review" \
  -H "Content-Type: application/json" \
  -d '{
    "reviewerName": "张主管",
    "comment": "数据核实无误",
    "decision": "approve"
  }'
```

### 8.6 导出稽核报告

```bash
curl -O -J "http://localhost:3000/api/batches/export/markdown?date=2026-05-04"
curl -O -J "http://localhost:3000/api/batches/export/json?date=2026-05-04"
```

---

## 9. 风险测试场景

### 9.1 测试重复称重检测

```bash
# 创建批次
BATCH_ID=$(curl -s -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d "{\"vehicleId\": \"$VEHICLE_ID\", \"date\": \"2026-05-04\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# 上传带重复的称重文件
curl -X POST "http://localhost:3000/api/batches/$BATCH_ID/upload" \
  -F "weighingCSV=@data/examples/weighing_with_duplicate.csv"

# 检查风险
curl "http://localhost:3000/api/batches/$BATCH_ID"
```

### 9.2 测试门店不匹配检测

```bash
BATCH_ID=$(curl -s -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d "{\"vehicleId\": \"$VEHICLE_ID\", \"date\": \"2026-05-04\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

curl -X POST "http://localhost:3000/api/batches/$BATCH_ID/upload" \
  -F "weighingCSV=@data/examples/weighing_with_invalid_store.csv"

curl "http://localhost:3000/api/batches/$BATCH_ID"
```

### 9.3 测试超时回收检测

```bash
BATCH_ID=$(curl -s -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d "{\"vehicleId\": \"$VEHICLE_ID\", \"date\": \"2026-05-04\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

curl -X POST "http://localhost:3000/api/batches/$BATCH_ID/upload" \
  -F "waybillJSON=@data/examples/waybill_with_overdue.json"

curl "http://localhost:3000/api/batches/$BATCH_ID"
```

### 9.4 测试 GPS 未到店检测

```bash
BATCH_ID=$(curl -s -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d "{\"vehicleId\": \"$VEHICLE_ID\", \"date\": \"2026-05-04\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

curl -X POST "http://localhost:3000/api/batches/$BATCH_ID/upload" \
  -F "weighingCSV=@data/examples/weighing_normal.csv" \
  -F "gpsTrack=@data/examples/gps_track_not_at_store.json"

curl "http://localhost:3000/api/batches/$BATCH_ID"
```

---

## 10. 注意事项

1. 所有 POST 请求需要设置 `Content-Type: application/json`
2. 文件上传使用 `-F` 参数，支持多文件上传
3. 日期格式请使用 `YYYY-MM-DD`
4. 时间格式请使用 `YYYY-MM-DD HH:mm:ss`
5. 复核决定有效值: `approve`, `reject`, `pending`, `escalate`
6. 风险严重程度: `low`, `medium`, `high`, `critical`
7. 门店状态: `active`, `inactive`, `suspended`
8. 车辆状态: `active`, `inactive`, `maintenance`
