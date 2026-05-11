# 港口危险品堆存 API

按类别、隔离距离和作业计划安排，以违规风险高为主线的危险品堆存管理系统。

## 安装运行

```bash
npm install
npm start
```

服务启动后访问 `http://localhost:3000`

## 样例入口

```bash
# 查看样例数据
curl http://localhost:3000/api/sample

# 运行样例
curl -X POST http://localhost:3000/api/sample/run
```

## 核心操作

### 1. 提交危险品批次处理

```bash
curl -X POST http://localhost:3000/api/batches/process \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "MY-BATCH-001",
    "goods": [
      {
        "batchId": "MY-BATCH-001",
        "goodsNo": "DG-001",
        "category": "EXPLOSIVES",
        "weight": 5000,
        "operationType": "IMPORT",
        "containerNo": "CONT-001",
        "unCode": "UN0001"
      }
    ]
  }'
```

**危险品类别（category）**：EXPLOSIVES、GASES、FLAMMABLE_LIQUIDS、FLAMMABLE_SOLIDS、OXIDIZING、TOXIC、RADIOACTIVE、CORROSIVE、MISCELLANEOUS

**作业类型（operationType）**：IMPORT、EXPORT、INTERNAL_TRANSFER

### 2. 查询批次状态

```bash
curl http://localhost:3000/api/batches/BATCH-2024-001/status
```

### 3. 查看导出文件

```bash
# 列出所有导出
curl http://localhost:3000/api/batches/BATCH-2024-001/exports

# 查看特定导出（ASSIGNMENT_REPORT / VALIDATION_REPORT / JOB_PLAN / RISK_SUMMARY）
curl http://localhost:3000/api/batches/BATCH-2024-001/exports/JOB_PLAN
```

### 4. 人工修正

```bash
curl -X POST http://localhost:3000/api/batches/BATCH-2024-001/correct \
  -H "Content-Type: application/json" \
  -d '{
    "goodsNo": "DG-001",
    "correctionData": {
      "category": "FLAMMABLE_LIQUIDS",
      "weight": 8000,
      "reason": "申报错误，实际为易燃液体"
    },
    "operator": "操作员-001"
  }'
```

## 可复现场景

### 场景1：缺字段验证
```bash
curl -X POST http://localhost:3000/api/scenarios/missing-fields
```

### 场景2：重复提交验证
```bash
curl -X POST http://localhost:3000/api/scenarios/duplicate
```

### 场景3：非法流转/无效作业类型
```bash
curl -X POST http://localhost:3000/api/scenarios/illegal-flow
```

### 场景4：人工修正完整流程
```bash
curl -X POST http://localhost:3000/api/scenarios/manual-correction
```

## 如何检查结果

### 1. 检查堆位分配
- 访问 `/api/batches/{batchId}/exports/ASSIGNMENT_REPORT`
- 确认每个危险品分配到正确区域（如爆炸品→A区）
- 检查 `position` 坐标和 `requiredDistance` 隔离距离

### 2. 检查隔离校验
- 访问 `/api/batches/{batchId}/exports/VALIDATION_REPORT`
- 查看 `violations` 是否有隔离违规
- 确认 `riskLevel` 风险等级

### 3. 检查作业计划
- 访问 `/api/batches/{batchId}/exports/JOB_PLAN`
- 确认 `jobNo`、`priority` 优先级、`plannedTime` 计划时间
- 检查 `requiredEquipment` 所需设备

### 4. 验证幂等性（重跑不膨胀）
```bash
# 第一次运行
curl -X POST http://localhost:3000/api/sample/run

# 记录导出数量
curl http://localhost:3000/api/batches/BATCH-2024-001/exports | python3 -m json.tool | grep -c '"type"'

# 第二次运行（同一批数据）
curl -X POST http://localhost:3000/api/sample/run

# 再次检查导出数量（应该相同，不会增加）
curl http://localhost:3000/api/batches/BATCH-2024-001/exports | python3 -m json.tool | grep -c '"type"'

# 检查批次状态
curl http://localhost:3000/api/batches/BATCH-2024-001/status
```

## 其他接口

```bash
# 健康检查
curl http://localhost:3000/health

# 查看配置（类别、隔离距离、不相容规则）
curl http://localhost:3000/api/categories

# 清除批次数据
curl -X DELETE http://localhost:3000/api/batches/BATCH-2024-001
```
