# CURL 测试命令集合

## 基础测试

### 1. 健康检查
```bash
curl -X GET http://localhost:3000/health
```

### 2. 查询所有维修记录
```bash
curl -X GET http://localhost:3000/api/v1/repair-records
```

### 3. 查询所有维修队伍
```bash
curl -X GET http://localhost:3000/api/v1/repair-teams
```

---

## 验收测试用例

### 📌 用例1: 正常记录合并
**场景**: 3号楼302宿舍两条报修（水龙头+日光灯）都分配给水电维修一组

```bash
# 第一步：先查询3号楼302的记录，获取前两条记录ID
curl -X GET "http://localhost:3000/api/v1/repair-records?building=3号楼&roomNumber=302"

# 第二步：合并前两条记录（替换为实际的ID）
curl -X POST http://localhost:3000/api/v1/repair-records/merge \
  -H "Content-Type: application/json" \
  -d '{
    "recordIds": ["RR1234567890000", "RR1234567890001"],
    "mergeOperator": "张管理员",
    "mergeReason": "同寝室多条水电报修合并处理"
  }'
```

---

### 📌 用例2: 冲突记录（同寝室不同队伍）
**场景**: 3号楼302宿舍三条报修，其中一条分配给水电维修二组

```bash
# 尝试合并三条记录（第三条分配给了不同队伍）
curl -X POST http://localhost:3000/api/v1/repair-records/merge \
  -H "Content-Type: application/json" \
  -d '{
    "recordIds": ["RR1234567890000", "RR1234567890001", "RR1234567890002"],
    "mergeOperator": "张管理员",
    "mergeReason": "同寝室全部报修合并"
  }'
```

**预期结果**: 返回 `DORM_TEAM_CONFLICT` 错误码

---

### 📌 用例3: 导入坏行
**场景**: 导入数据包含正常记录和缺少必填字段的坏记录

```bash
curl -X POST http://localhost:3000/api/v1/repair-records/import \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {
        "building": "1号楼",
        "roomNumber": "101",
        "repairType": "水电",
        "description": "宿舍灯不亮，已持续2天",
        "reporter": "小明",
        "reporterPhone": "13800138101"
      },
      {
        "building": "1号楼",
        "roomNumber": "102"
      },
      {
        "building": "2号楼",
        "roomNumber": "201",
        "repairType": "土木",
        "description": "门锁坏了，进不去宿舍",
        "reporter": "小红",
        "reporterPhone": "13800138102"
      },
      {
        "description": "窗户漏风"
      }
    ],
    "dryRun": false,
    "importOperator": "李管理员"
  }'
```

**预期结果**: 
- 第1、3行导入成功
- 第2、4行导入失败（缺少必填字段）
- 返回详细的成功/失败统计

---

## 班组交接复核口径测试

### 阶段1: 临时改动
```bash
curl -X POST http://localhost:3000/api/v1/repair-records/{记录ID}/review \
  -H "Content-Type: application/json" \
  -d '{
    "stage": "temporary_change",
    "operator": "李维修员",
    "operatorRole": "维修员",
    "changes": {
      "original": "窗户边框松动，刮风异响严重",
      "temporary": "使用胶带临时固定，减少异响",
      "estimatedFixDate": "2024-05-20"
    },
    "comments": "密封胶暂时缺货，先做紧急处理，已告知宿舍学生",
    "confirmationSignature": "li_worker_20240515_001"
  }'
```

### 阶段2: 负责人确认
```bash
curl -X POST http://localhost:3000/api/v1/repair-records/{记录ID}/review \
  -H "Content-Type: application/json" \
  -d '{
    "stage": "manager_confirm",
    "operator": "周队长",
    "operatorRole": "维修队长",
    "changes": {
      "confirmed": true,
      "purchaseApproved": true,
      "materialArrivalDate": "2024-05-20",
      "assignedPriority": "high"
    },
    "comments": "情况属实，已批准采购密封胶，预计5月20日到货后安排最终修复",
    "confirmationSignature": "zhou_manager_20240515_001"
  }'
```

### 阶段3: 最终归档
```bash
curl -X POST http://localhost:3000/api/v1/repair-records/{记录ID}/review \
  -H "Content-Type: application/json" \
  -d '{
    "stage": "final_archive",
    "operator": "王管理员",
    "operatorRole": "宿舍管理员",
    "changes": {
      "finalStatus": "已完成",
      "actualCompletionDate": "2024-05-21",
      "studentConfirmed": true,
      "qualityRating": "优秀"
    },
    "comments": "维修已完成，学生现场确认无问题，维修质量良好，归档保存",
    "confirmationSignature": "wang_admin_20240521_001"
  }'
```

---

## 其他功能测试

### 版本控制（防止静默覆盖）
```bash
curl -X PUT http://localhost:3000/api/v1/repair-records/{记录ID} \
  -H "Content-Type: application/json" \
  -d '{
    "expectedVersion": 1,
    "status": "in_progress",
    "assignedTeam": "水电维修一组"
  }'
```

### 导出CSV
```bash
curl -X GET http://localhost:3000/api/v1/repair-records/export/csv -o repair-records.csv
```

### 周报统计
```bash
curl -X GET "http://localhost:3000/api/v1/repair-records/report/weekly?weekStart=2024-05-01&weekEnd=2024-05-31"
```

### 创建新维修记录
```bash
curl -X POST http://localhost:3000/api/v1/repair-records \
  -H "Content-Type: application/json" \
  -d '{
    "building": "6号楼",
    "roomNumber": "606",
    "repairType": "水电",
    "description": "卫生间淋浴喷头堵塞，出水很小",
    "reporter": "赵同学",
    "reporterPhone": "13800138666",
    "assignedTeam": "水电维修二组",
    "priority": "medium"
  }'
```
