# 社区疫苗预约改签API服务

社区卫生服务站疫苗预约改签材料处理系统，支持批量导入、去重识别、处理轨迹追踪和报告导出。

## 功能特性

- ✅ 批次创建与材料登记
- ✅ 重复批次自动识别（基于材料指纹）
- ✅ 材料处理与状态更新
- ✅ 单条明细处理轨迹查询
- ✅ 缺苗通知标记
- ✅ 归档流程触发
- ✅ CSV报告导出（含统计信息、处理人）

## 技术栈

- Node.js + Express
- SQLite 数据库
- 支持文件导出

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

## API接口

### 健康检查
```bash
curl http://localhost:3000/api/health
```

---

## 完整流程演示

### 第一步：创建批次并登记材料

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "community_name": "阳光社区卫生服务站",
    "submitter": "张医生",
    "materials": [
      {
        "child_name": "小明",
        "child_id_card": "110101202001011234",
        "phone": "13800138001",
        "original_appointment_date": "2024-01-15",
        "target_vaccine": "乙肝疫苗",
        "reschedule_reason": "孩子感冒"
      },
      {
        "child_name": "小红",
        "child_id_card": "110101202002025678",
        "phone": "13800138002",
        "original_appointment_date": "2024-01-16",
        "target_vaccine": "百白破",
        "reschedule_reason": "疫苗缺苗"
      }
    ]
  }'
```

**注意：** 再次提交完全相同的材料，系统会自动识别为重复批次，返回原有处理结果。

---

### 第二步：处理单条材料记录

```bash
# 请将 MAT_xxx 替换为实际返回的material_id
curl -X POST http://localhost:3000/api/materials/MAT_xxx/process \
  -H "Content-Type: application/json" \
  -d '{
    "action": "电话通知",
    "handler": "李护士",
    "remark": "已电话通知家长改约时间",
    "status": "processing",
    "is_out_of_stock": false
  }'
```

```bash
# 完成处理
curl -X POST http://localhost:3000/api/materials/MAT_xxx/process \
  -H "Content-Type: application/json" \
  -d '{
    "action": "改签完成",
    "handler": "王医生",
    "remark": "已成功改约至2024年2月1日",
    "status": "success",
    "is_out_of_stock": false
  }'
```

```bash
# 标记为缺苗
curl -X POST http://localhost:3000/api/materials/MAT_xxx/process \
  -H "Content-Type: application/json" \
  -d '{
    "action": "缺苗登记",
    "handler": "李护士",
    "remark": "该疫苗暂时缺货，已通知家长",
    "status": "pending",
    "is_out_of_stock": true
  }'
```

---

### 第三步：查询单条明细的处理轨迹

```bash
# 请将 MAT_xxx 替换为实际的material_id
curl http://localhost:3000/api/materials/MAT_xxx/trace
```

---

### 第四步：查询批次详情

```bash
# 请将 BATCH_xxx 替换为实际返回的batch_id
curl http://localhost:3000/api/batches/BATCH_xxx
```

---

### 第五步：触发归档流程

```bash
# 请将 BATCH_xxx 替换为实际的batch_id
curl -X POST http://localhost:3000/api/archive \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "BATCH_xxx",
    "archived_by": "张主任"
  }'
```

---

### 第六步：导出报告（含统计信息）

```bash
# 请将 BATCH_xxx 替换为实际的batch_id
curl http://localhost:3000/api/export/BATCH_xxx
```

导出的CSV报告包含以下信息：
- 儿童姓名、身份证号、联系电话
- 原预约日期、目标疫苗、改签原因
- 是否缺苗、处理状态、最后处理人
- 创建时间

报告下载地址会在返回结果的 `download_url` 字段中。

---

## 完整自动化测试脚本

创建 `test-flow.sh` 文件：

```bash
#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "=== 1. 健康检查 ==="
curl -s "$BASE_URL/health" | jq .

echo -e "\n=== 2. 创建批次 ==="
BATCH_RESPONSE=$(curl -s -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "community_name": "阳光社区卫生服务站",
    "submitter": "张医生",
    "materials": [
      {
        "child_name": "小明",
        "child_id_card": "110101202001011234",
        "phone": "13800138001",
        "original_appointment_date": "2024-01-15",
        "target_vaccine": "乙肝疫苗",
        "reschedule_reason": "孩子感冒"
      },
      {
        "child_name": "小红",
        "child_id_card": "110101202002025678",
        "phone": "13800138002",
        "original_appointment_date": "2024-01-16",
        "target_vaccine": "百白破",
        "reschedule_reason": "疫苗缺苗"
      }
    ]
  }')

echo "$BATCH_RESPONSE" | jq .

BATCH_ID=$(echo "$BATCH_RESPONSE" | jq -r '.batch.id')
MAT_ID1=$(echo "$BATCH_RESPONSE" | jq -r '.materials[0].id')
MAT_ID2=$(echo "$BATCH_RESPONSE" | jq -r '.materials[1].id')

echo -e "\n=== 3. 处理第一条材料 ==="
curl -s -X POST "$BASE_URL/materials/$MAT_ID1/process" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "电话通知",
    "handler": "李护士",
    "remark": "已电话通知家长改约时间",
    "status": "processing"
  }' | jq .

echo -e "\n=== 4. 完成第一条材料处理 ==="
curl -s -X POST "$BASE_URL/materials/$MAT_ID1/process" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "改签完成",
    "handler": "王医生",
    "remark": "已成功改约至2024年2月1日",
    "status": "success"
  }' | jq .

echo -e "\n=== 5. 标记第二条材料为缺苗 ==="
curl -s -X POST "$BASE_URL/materials/$MAT_ID2/process" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "缺苗登记",
    "handler": "李护士",
    "remark": "该疫苗暂时缺货，已通知家长",
    "status": "pending",
    "is_out_of_stock": true
  }' | jq .

echo -e "\n=== 6. 查询第一条材料的处理轨迹 ==="
curl -s "$BASE_URL/materials/$MAT_ID1/trace" | jq .

echo -e "\n=== 7. 查询批次详情 ==="
curl -s "$BASE_URL/batches/$BATCH_ID" | jq .

echo -e "\n=== 8. 触发归档 ==="
curl -s -X POST "$BASE_URL/archive" \
  -H "Content-Type: application/json" \
  -d "{\"batch_id\": \"$BATCH_ID\", \"archived_by\": \"张主任\"}" | jq .

echo -e "\n=== 9. 导出报告 ==="
curl -s "$BASE_URL/export/$BATCH_ID" | jq .

echo -e "\n=== 10. 测试重复提交（应该返回原有数据） ==="
curl -s -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "community_name": "阳光社区卫生服务站",
    "submitter": "张医生",
    "materials": [
      {
        "child_name": "小明",
        "child_id_card": "110101202001011234",
        "phone": "13800138001",
        "original_appointment_date": "2024-01-15",
        "target_vaccine": "乙肝疫苗",
        "reschedule_reason": "孩子感冒"
      },
      {
        "child_name": "小红",
        "child_id_card": "110101202002025678",
        "phone": "13800138002",
        "original_appointment_date": "2024-01-16",
        "target_vaccine": "百白破",
        "reschedule_reason": "疫苗缺苗"
      }
    ]
  }' | jq .

echo -e "\n=== 测试完成 ==="
```

运行测试脚本：

```bash
chmod +x test-flow.sh
./test-flow.sh
```

---

## 数据模型

### batches（批次表）
- id: 批次ID
- community_name: 社区名称
- submitter: 提交人
- material_fingerprint: 材料指纹（用于去重）
- status: 状态
- total_materials: 材料总数
- processed_count: 已处理数量

### materials（材料表）
- id: 材料ID
- batch_id: 批次ID
- child_name: 儿童姓名
- child_id_card: 身份证号
- phone: 联系电话
- original_appointment_date: 原预约日期
- target_vaccine: 目标疫苗
- reschedule_reason: 改签原因
- status: 处理状态
- current_handler: 当前处理人
- is_out_of_stock: 是否缺苗

### process_logs（处理日志表）
- id: 日志ID
- material_id: 材料ID
- action: 处理动作
- handler: 处理人
- remark: 备注
- created_at: 创建时间

### archives（归档表）
- id: 归档ID
- batch_id: 批次ID
- archive_date: 归档日期
- archived_by: 归档人
- total_records: 总记录数
- success_count: 成功数
- fail_count: 失败数
