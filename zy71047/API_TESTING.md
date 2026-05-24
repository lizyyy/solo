# 牛只耳标转场 API 测试指南

## 启动服务

```bash
mvn spring-boot:run
```

服务启动后访问:
- API 地址: http://localhost:8888
- H2 控制台: http://localhost:8888/h2-console
  - JDBC URL: jdbc:h2:mem:livestock
  - 用户名: sa
  - 密码: (空)

## 基础数据查询

### 1. 查询所有牧场
```bash
curl http://localhost:8888/api/master/farms
```

### 2. 查询所有耳标
```bash
curl http://localhost:8888/api/master/ear-tags
```

### 3. 查询所有检疫证
```bash
curl http://localhost:8888/api/master/certificates
```

### 4. 查询所有运输车
```bash
curl http://localhost:8888/api/master/vehicles
```

---

## 场景一：正常流转流程

### 步骤1: 创建转场单
```bash
curl -X POST http://localhost:8888/api/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "sourceFarmCode": "F001",
    "targetFarmCode": "F002",
    "certificateNo": "Q20240501001",
    "vehiclePlateNo": "蒙A12345",
    "plannedQuantity": 3,
    "transferDate": "2024-06-15",
    "earTags": ["E0001", "E0002", "E0003"],
    "remark": "正常转场测试",
    "operator": "测试员A"
  }'
```

保存返回的 transferId (假设为 1)

### 步骤2: 提交转场单
```bash
curl -X POST "http://localhost:8888/api/transfers/1/submit?operator=测试员A"
```

### 步骤3: 查看校验结果
```bash
curl http://localhost:8888/api/transfers/1
```

### 步骤4: 开始运输
```bash
curl -X POST "http://localhost:8888/api/transfers/1/start-transport?operator=测试员A"
```

### 步骤5: 到场验收
```bash
curl -X POST http://localhost:8888/api/transfers/acceptance \
  -H "Content-Type: application/json" \
  -d '{
    "transferNo": "TFXXXXXXXXXXXXXX",
    "acceptanceTime": "2024-06-16T10:30:00",
    "acceptedTags": ["E0001", "E0002", "E0003"],
    "acceptor": "验收员B",
    "remark": "正常验收"
  }'
```

### 步骤6: 确认验收
```bash
curl -X POST "http://localhost:8888/api/transfers/acceptance/1/confirm?operator=验收员B"
```

### 步骤7: 完成转场
```bash
curl -X POST "http://localhost:8888/api/transfers/1/complete?operator=管理员"
```

### 步骤8: 生成报告
```bash
curl -X POST "http://localhost:8888/api/transfers/1/reports?operator=管理员"
```

### 步骤9: 导出报告CSV
```bash
curl -o report.csv http://localhost:8888/api/transfers/reports/1/export
```

---

## 场景二：耳标重复冲突

### 步骤1: 创建第一个转场单
```bash
curl -X POST http://localhost:8888/api/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "sourceFarmCode": "F001",
    "targetFarmCode": "F002",
    "certificateNo": "Q20240501001",
    "vehiclePlateNo": "蒙A12345",
    "plannedQuantity": 2,
    "transferDate": "2024-06-15",
    "earTags": ["E0004", "E0005"],
    "remark": "第一个转场单",
    "operator": "测试员A"
  }'
```

### 步骤2: 提交第一个转场单
```bash
curl -X POST "http://localhost:8888/api/transfers/2/submit?operator=测试员A"
```

### 步骤3: 创建第二个转场单（包含重复耳标）
```bash
curl -X POST http://localhost:8888/api/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "sourceFarmCode": "F001",
    "targetFarmCode": "F003",
    "certificateNo": "Q20240501001",
    "vehiclePlateNo": "蒙B67890",
    "plannedQuantity": 2,
    "transferDate": "2024-06-15",
    "earTags": ["E0004", "E0005"],
    "remark": "测试跨单耳标重复",
    "operator": "测试员A"
  }'
```

### 步骤4: 提交第二个转场单（会校验出跨单重复）
```bash
curl -X POST "http://localhost:8888/api/transfers/3/submit?operator=测试员A"
```

### 步骤5: 查看校验结果（应该有WARN级别的跨单重复警告）
```bash
curl http://localhost:8888/api/transfers/3
```

---

## 场景三：撤回操作

### 步骤1: 创建转场单
```bash
curl -X POST http://localhost:8888/api/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "sourceFarmCode": "F002",
    "targetFarmCode": "F003",
    "certificateNo": "Q20240501002",
    "vehiclePlateNo": "蒙B67890",
    "plannedQuantity": 2,
    "transferDate": "2024-06-20",
    "earTags": ["E0006", "E0007"],
    "remark": "测试撤回",
    "operator": "测试员A"
  }'
```

### 步骤2: 提交转场单
```bash
curl -X POST "http://localhost:8888/api/transfers/4/submit?operator=测试员A"
```

### 步骤3: 撤回（取消）转场单
```bash
curl -X POST "http://localhost:8888/api/transfers/4/cancel?operator=测试员A&reason=临时取消转场计划"
```

### 步骤4: 查看状态（应为 CANCELLED）
```bash
curl http://localhost:8888/api/transfers/4
```

---

## 场景四：验收差异与人工修正

### 步骤1: 创建转场单
```bash
curl -X POST http://localhost:8888/api/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "sourceFarmCode": "F001",
    "targetFarmCode": "F003",
    "certificateNo": "Q20240501001",
    "vehiclePlateNo": "蒙A12345",
    "plannedQuantity": 3,
    "transferDate": "2024-06-18",
    "earTags": ["E0001", "E0002", "E0003"],
    "remark": "测试验收差异",
    "operator": "测试员A"
  }'
```

### 步骤2: 提交并开始运输
```bash
curl -X POST "http://localhost:8888/api/transfers/5/submit?operator=测试员A"
curl -X POST "http://localhost:8888/api/transfers/5/start-transport?operator=测试员A"
```

### 步骤3: 到场验收（数量不一致，实际只到了2头，多了1头不明来源）
```bash
curl -X POST http://localhost:8888/api/transfers/acceptance \
  -H "Content-Type: application/json" \
  -d '{
    "transferNo": "TFXXXXXXXXXXXXXX",
    "acceptanceTime": "2024-06-19T08:00:00",
    "acceptedTags": ["E0001", "E0002", "E9999"],
    "acceptor": "验收员B",
    "remark": "E0003未到场，多出E9999"
  }'
```

### 步骤4: 确认验收（触发验收异议状态）
```bash
curl -X POST "http://localhost:8888/api/transfers/acceptance/2/confirm?differenceReason=运输途中有一头走失，一头混入&operator=验收员B"
```

### 步骤5: 查看验收差异明细
```bash
curl http://localhost:8888/api/transfers/5/acceptance-tags/2
```

### 步骤6: 人工修正（按现状接收）
```bash
curl -X POST "http://localhost:8888/api/transfers/acceptance/2/resolve?acceptAsIs=true&resolutionNote=经核实情况属实，按实际情况接收&operator=主管C"
```

### 步骤7: 完成转场
```bash
curl -X POST "http://localhost:8888/api/transfers/5/complete?operator=管理员"
```

---

## 统计查询

### 查询整体统计
```bash
curl http://localhost:8888/api/transfers/statistics
```

### 查询所有转场单
```bash
curl http://localhost:8888/api/transfers
```

### 查询操作日志（通过详情接口）
```bash
curl http://localhost:8888/api/transfers/1
```
查看返回的 operationLogs 字段

---

## 注意事项

1. 测试时注意替换 transferNo 和 transferId 为实际返回的值
2. 检疫证 Q20240301001 是过期的，用于测试过期校验
3. 运输车 冀C11111 是维修状态，用于测试车辆不可用校验
4. H2 数据库是内存型的，重启后数据会重置
