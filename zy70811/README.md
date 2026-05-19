# 消防维保到期提醒 API 服务

楼宇维保公司材料处理系统，支持数据分类（正常/待补充/已拦截）和流程跟踪。

## 功能特性

- 创建批次管理材料
- 上传CSV文件或手动登记材料
- 自动拆分和分类处理
  - **正常**：信息完整有效 → 正常处理-生成提醒通知
  - **待补充**：缺少非关键信息 → 发送补充信息请求
  - **已拦截**：关键信息缺失或错误 → 拦截-标记为无效数据
- 查询单条明细和处理轨迹
- 导出CSV报告（含维保表轮换和处理人信息）
- 多表格轮换维护（灭火器、喷淋、报警主机各2套表）

## 安装启动

```bash
npm install
npm start
```

服务运行在 http://localhost:3000

## API 接口列表

### 1. 健康检查
```bash
curl http://localhost:3000/api/health
```

### 2. 创建批次
```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024年5月消防维保批次",
    "description": "本月度各楼宇消防维保到期提醒处理",
    "created_by": "张三"
  }'
```

### 3. 上传CSV材料文件
```bash
curl -X POST http://localhost:3000/api/materials/upload \
  -F "file=@sample-data.csv" \
  -F "batch_id=YOUR_BATCH_ID" \
  -F "uploaded_by=张三"
```

### 4. 手动登记材料
```bash
curl -X POST http://localhost:3000/api/materials/register \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "YOUR_BATCH_ID",
    "content": [
      {
        "building_name": "阳光大厦",
        "address": "北京市朝阳区xxx路123号",
        "contact_person": "李经理",
        "contact_phone": "13800138000",
        "extinguisher_date": "2024-06-15",
        "sprinkler_date": "2024-07-20",
        "alarm_date": "2024-05-30"
      }
    ],
    "uploaded_by": "张三"
  }'
```

### 5. 触发处理流程
```bash
curl -X POST http://localhost:3000/api/processing/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "YOUR_BATCH_ID",
    "processor": "李四"
  }'
```

### 6. 查询批次详情（含统计）
```bash
curl http://localhost:3000/api/batches/YOUR_BATCH_ID
```

### 7. 查询明细列表
```bash
# 按批次查询
curl "http://localhost:3000/api/details?batch_id=YOUR_BATCH_ID"

# 按分类查询（normal/pending_supplement/blocked）
curl "http://localhost:3000/api/details?category=normal"
```

### 8. 查询单条明细和处理轨迹
```bash
curl http://localhost:3000/api/details/YOUR_DETAIL_ID
```

### 9. 导出报告
```bash
# 导出CSV格式
curl "http://localhost:3000/api/exports?batch_id=YOUR_BATCH_ID&format=csv"

# 导出JSON格式
curl "http://localhost:3000/api/exports?batch_id=YOUR_BATCH_ID&format=json"
```

### 10. 下载导出的报告
```bash
curl -O "http://localhost:3000/api/exports/download/report-YOUR_BATCH_ID-xxxxxx.csv"
```

## 完整流程示例脚本

```bash
#!/bin/bash

# 1. 启动服务
npm start &
sleep 3

# 2. 创建批次
BATCH_RESPONSE=$(curl -s -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试批次",
    "description": "API测试用",
    "created_by": "admin"
  }')
BATCH_ID=$(echo $BATCH_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "创建批次: $BATCH_ID"

# 3. 登记材料（使用示例数据）
curl -X POST http://localhost:3000/api/materials/register \
  -H "Content-Type: application/json" \
  -d "{
    \"batch_id\": \"$BATCH_ID\",
    \"content\": [
      {
        \"building_name\": \"阳光大厦\",
        \"address\": \"北京市朝阳区xxx路123号\",
        \"contact_person\": \"李经理\",
        \"contact_phone\": \"13800138000\",
        \"extinguisher_date\": \"2024-06-15\",
        \"sprinkler_date\": \"2024-07-20\",
        \"alarm_date\": \"2024-05-30\"
      },
      {
        \"building_name\": \"幸福小区\",
        \"address\": \"北京市海淀区xxx路456号\",
        \"contact_person\": \"王主任\",
        \"contact_phone\": \"\",
        \"extinguisher_date\": \"2024-08-01\",
        \"sprinkler_date\": \"invalid-date\",
        \"alarm_date\": \"2024-09-15\"
      },
      {
        \"building_name\": \"\",
        \"address\": \"\",
        \"contact_person\": \"\",
        \"contact_phone\": \"\",
        \"extinguisher_date\": \"\",
        \"sprinkler_date\": \"\",
        \"alarm_date\": \"\"
      }
    ],
    \"uploaded_by\": \"admin\"
  }"

# 4. 触发处理
echo "触发处理流程..."
curl -X POST http://localhost:3000/api/processing/trigger \
  -H "Content-Type: application/json" \
  -d "{\"batch_id\": \"$BATCH_ID\", \"processor\": \"admin\"}"

# 5. 查询批次统计
echo "查询批次统计..."
curl "http://localhost:3000/api/batches/$BATCH_ID"

# 6. 查询明细列表
echo "查询所有明细..."
curl "http://localhost:3000/api/details?batch_id=$BATCH_ID"

# 7. 导出报告
echo "导出报告..."
EXPORT_RESPONSE=$(curl -s "http://localhost:3000/api/exports?batch_id=$BATCH_ID&format=csv")
echo $EXPORT_RESPONSE

echo "\n流程完成!"
```

## CSV 文件格式要求

上传的CSV文件需包含以下列：

| 列名 | 说明 | 必填 |
|------|------|------|
| building_name | 楼宇名称 | 是 |
| address | 地址 | 是 |
| contact_person | 联系人 | 是 |
| contact_phone | 联系电话 | 是 |
| extinguisher_date | 灭火器维保日期 | 否 |
| sprinkler_date | 喷淋维保日期 | 否 |
| alarm_date | 报警主机维保日期 | 否 |

示例 sample-data.csv：
```csv
building_name,address,contact_person,contact_phone,extinguisher_date,sprinkler_date,alarm_date
阳光大厦,北京市朝阳区xxx路123号,李经理,13800138000,2024-06-15,2024-07-20,2024-05-30
幸福小区,北京市海淀区xxx路456号,王主任,13900139000,2024-08-01,2024-09-15,2024-10-01
```

## 分类规则说明

### ✅ 正常 (normal)
- 所有必填字段完整
- 日期格式正确（如有）
- 后续动作：正常处理-生成提醒通知

### ⚠️ 待补充 (pending_supplement)
- 缺少1-2个必填字段，或
- 1个日期格式错误
- 后续动作：发送补充信息请求

### ❌ 已拦截 (blocked)
- 缺少3个及以上必填字段，或
- 2个及以上日期格式错误
- 后续动作：拦截-标记为无效数据

## 项目结构

```
.
├── src/
│   ├── app.js                 # 应用入口
│   ├── models/
│   │   └── database.js        # 数据库模型
│   ├── controllers/
│   │   ├── batchController.js    # 批次管理
│   │   ├── materialController.js # 材料上传/登记
│   │   ├── processingController.js # 处理流程
│   │   └── exportController.js   # 导出功能
│   ├── services/
│   │   ├── processingService.js  # 分类处理逻辑
│   │   └── exportService.js      # 导出服务
│   └── routes/
│       └── index.js           # 路由定义
├── uploads/                   # 上传文件目录
├── exports/                   # 导出文件目录
├── data/                      # SQLite数据库目录
└── package.json
```
