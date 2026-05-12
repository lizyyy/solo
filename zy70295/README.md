# 学校校车临停点 API

## 安装运行

```bash
npm install
npm start
```

服务端口: `http://localhost:3000`

健康检查: `GET /health`

## 样例入口

API 前缀: `/api`

- 校车线路: `/api/bus-routes`
- 临停申请: `/api/temporary-stops`
- 学生站点: `/api/student-stops`
- 安全记录: `/api/safety`
- 报表汇总: `/api/reports`

## 核心操作

### 1. 获取现有数据
```bash
# 查看校车线路
curl http://localhost:3000/api/bus-routes

# 查看学生站点
curl http://localhost:3000/api/student-stops
```

### 2. 创建临停申请
```bash
curl -X POST http://localhost:3000/api/temporary-stops \
  -H "Content-Type: application/json" \
  -d '{
    "routeId": "<route-id>",
    "originalStopId": "<original-stop-id>",
    "temporaryStopName": "临时停靠点-东门辅路",
    "temporaryStopAddress": "学校东门辅路安全区域",
    "reason": "东门道路施工，无法正常停靠",
    "effectiveDate": "2026-05-12",
    "requestedBy": "调度员-李"
  }'
```

### 3. 推进临停申请
```bash
# 审批通过 (pending -> approved)
curl -X POST http://localhost:3000/api/temporary-stops/<request-id>/advance \
  -H "Content-Type: application/json" \
  -d '{"action": "approve", "processedBy": "主任-王"}'

# 执行 (approved -> implemented) - 此时会创建临时学生站点
curl -X POST http://localhost:3000/api/temporary-stops/<request-id>/advance \
  -H "Content-Type: application/json" \
  -d '{"action": "implement", "processedBy": "司机-张"}'

# 完成 (implemented -> completed)
curl -X POST http://localhost:3000/api/temporary-stops/<request-id>/advance \
  -H "Content-Type: application/json" \
  -d '{"action": "complete", "processedBy": "司机-张"}'
```

### 4. 确认学生站点
```bash
curl -X POST http://localhost:3000/api/student-stops/<stop-id>/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "actualTime": "07:35",
    "actualStudentCount": 14,
    "confirmedBy": "司机-张"
  }'
```

### 5. 记录安全确认
```bash
curl -X POST http://localhost:3000/api/safety \
  -H "Content-Type: application/json" \
  -d '{
    "stopId": "<stop-id>",
    "studentCount": 14,
    "boardingCount": 14,
    "alightingCount": 0,
    "safetyChecks": {
      "pedestrianSafety": true,
      "trafficSafety": true,
      "vehicleCondition": true,
      "studentBehavior": true
    },
    "notes": "临时停靠点安全，学生有序上下车",
    "recordedBy": "跟车老师-赵"
  }'
```

### 6. 撤回或修正
```bash
# 撤回临停申请
curl -X POST http://localhost:3000/api/temporary-stops/<request-id>/withdraw \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "施工提前完成，恢复原站点",
    "processedBy": "调度员-李"
  }'

# 修正临停信息
curl -X PUT http://localhost:3000/api/temporary-stops/<request-id>/correct \
  -H "Content-Type: application/json" \
  -d '{
    "temporaryStopAddress": "学校东门辅路更靠北安全区域",
    "actualStudentCount": 14
  }'
```

### 7. 查询汇总
```bash
# 今日汇总
curl http://localhost:3000/api/reports/summary

# 指定日期汇总
curl http://localhost:3000/api/reports/summary?date=2026-05-12

# 详细报告
curl http://localhost:3000/api/reports/detailed

# 导出 CSV
curl -X POST http://localhost:3000/api/reports/export
```

## 如何检查结果

### 状态流转检查
```bash
# 查看临停申请详情（含关联的学生站点和安全记录）
curl http://localhost:3000/api/temporary-stops/<request-id>

# 查看临时学生站点
curl http://localhost:3000/api/student-stops?isTemporary=true

# 查看安全记录
curl http://localhost:3000/api/safety
```

### 幂等性验证
创建临停申请时使用 `idempotencyKey`，重复请求不会产生重复数据：
```bash
# 第一次请求
curl -X POST http://localhost:3000/api/temporary-stops \
  -H "Content-Type: application/json" \
  -d '{
    "idempotencyKey": "unique-key-001",
    "routeId": "<route-id>",
    "originalStopId": "<original-stop-id>",
    "temporaryStopName": "测试临停点",
    "temporaryStopAddress": "测试地址",
    "reason": "测试",
    "requestedBy": "测试"
  }'

# 第二次相同 key 请求，返回 isDuplicate: true
curl -X POST http://localhost:3000/api/temporary-stops \
  -H "Content-Type: application/json" \
  -d '{
    "idempotencyKey": "unique-key-001",
    "routeId": "<route-id>",
    "originalStopId": "<original-stop-id>",
    "temporaryStopName": "测试临停点",
    "temporaryStopAddress": "测试地址",
    "reason": "测试",
    "requestedBy": "测试"
  }'
```

### 数据一致性
- 临停申请 `implemented` 后，会自动创建 `isTemporary: true` 的学生站点
- 学生站点确认后，会同步更新临停申请的实际信息
- 安全记录与学生站点一一对应
- 同一日期重复导出 CSV，旧文件会被覆盖，不会膨胀