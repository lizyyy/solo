# 连锁门店现金长短款处理 API 服务

区域财务现金长短款自动化处理系统，支持批次提交、自动对账、智能分类、统计分析和报表导出。

## 功能特性

- ✅ **批次管理**：支持批量提交，自动去重识别
- ✅ **三方对账**：POS销售、现金缴存、备用金分开对账
- ✅ **智能分类**：自动分为「正常」「待补充」「已拦截」三类
- ✅ **原因追踪**：每类数据提供分类原因和后续动作
- ✅ **节假日支持**：节假日延迟入账说明保留
- ✅ **统计查询**：多维度统计分析，与导出数据一致
- ✅ **报表导出**：CSV格式导出，包含处理人信息

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

服务启动后访问：http://localhost:3000

## API 接口

### 健康检查
```bash
curl http://localhost:3000/health
```

### 提交批次
```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "BATCH-2024-001",
    "store_id": "STORE001",
    "store_name": "朝阳区望京店",
    "region": "华北区",
    "submit_date": "2024-01-15",
    "processor": "张财务",
    "remark": "1月上旬数据",
    "records": [
      {
        "record_date": "2024-01-01",
        "opening_cash": 5000,
        "pos_sales": 15680.50,
        "cash_deposit": 18000,
        "imprest_borrow": 500,
        "imprest_return": 0,
        "closing_cash": 2175.50,
        "is_holiday": true,
        "holiday_delay_note": "元旦假期，银行1月2日到账"
      }
    ]
  }'
```

### 查询批次列表
```bash
curl "http://localhost:3000/api/batches?region=华北区&page=1&pageSize=20"
```

### 查询批次详情
```bash
curl http://localhost:3000/api/batches/BATCH-2024-001
```

### 查看统计数据
```bash
curl "http://localhost:3000/api/statistics?region=华北区"
```

### 导出批次报告
```bash
curl http://localhost:3000/api/export/batch/BATCH-2024-001
```

### 导出统计报表
```bash
curl "http://localhost:3000/api/export/statistics?region=华北区"
```

### 下载导出文件
```bash
curl -O "http://localhost:3000/api/export/download/批次_BATCH-2024-001_xxx.csv"
```

## 完整测试脚本

创建 `test-flow.sh` 并执行：

```bash
#!/bin/bash

echo "🚀 开始完整流程测试..."

echo "1️⃣ 提交批次（正常数据）"
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "TEST-2024-001",
    "store_id": "STORE001",
    "store_name": "朝阳区望京店",
    "region": "华北区",
    "submit_date": "2024-01-15",
    "processor": "李财务",
    "records": [
      {
        "record_date": "2024-01-01",
        "opening_cash": 5000,
        "pos_sales": 15680.50,
        "cash_deposit": 15000,
        "imprest_borrow": 0,
        "imprest_return": 0,
        "closing_cash": 5682,
        "is_holiday": true,
        "holiday_delay_note": "元旦假期入账延迟"
      },
      {
        "record_date": "2024-01-02",
        "opening_cash": 5682,
        "pos_sales": 22350.00,
        "cash_deposit": 22000,
        "imprest_borrow": 200,
        "imprest_return": 0,
        "closing_cash": 5830
      },
      {
        "record_date": "2024-01-03",
        "opening_cash": 5830,
        "pos_sales": 18500.00,
        "cash_deposit": 18500,
        "imprest_borrow": 0,
        "imprest_return": 200,
        "closing_cash": 6032
      }
    ]
  }' | jq .

echo ""
echo "2️⃣ 重复提交同一批次（测试去重）"
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "TEST-2024-001",
    "store_id": "STORE001",
    "store_name": "朝阳区望京店",
    "region": "华北区",
    "submit_date": "2024-01-15",
    "processor": "李财务",
    "records": []
  }' | jq .

echo ""
echo "3️⃣ 提交包含异常数据的批次（待补充+已拦截）"
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "TEST-2024-002",
    "store_id": "STORE002",
    "store_name": "海淀区中关村店",
    "region": "华北区",
    "submit_date": "2024-01-15",
    "processor": "王财务",
    "records": [
      {
        "record_date": "2024-01-04",
        "opening_cash": 5000,
        "pos_sales": null,
        "cash_deposit": 10000,
        "closing_cash": 5000
      },
      {
        "record_date": "2024-01-05",
        "opening_cash": 5000,
        "pos_sales": 50000,
        "cash_deposit": 0,
        "imprest_borrow": 0,
        "closing_cash": 54500
      }
    ]
  }' | jq .

echo ""
echo "4️⃣ 查询批次详情"
curl http://localhost:3000/api/batches/TEST-2024-001 | jq .

echo ""
echo "5️⃣ 查看统计数据"
curl http://localhost:3000/api/statistics | jq .

echo ""
echo "6️⃣ 导出批次报告"
EXPORT_RESULT=$(curl -s http://localhost:3000/api/export/batch/TEST-2024-001)
echo "$EXPORT_RESULT" | jq .
FILENAME=$(echo "$EXPORT_RESULT" | jq -r '.data.filename')

echo ""
echo "7️⃣ 下载报告文件"
curl -O "http://localhost:3000/api/export/download/$FILENAME"
echo "已下载文件: $FILENAME"

echo ""
echo "✅ 测试完成！"
```

## 分类规则

| 分类 | 触发条件 | 后续动作 |
|------|----------|----------|
| **正常** | 现金长短款在±5元以内，所有字段完整 | 正常归档，纳入门店考核 |
| **待补充** | 缺少关键字段 / 节假日无延迟说明 / 长短款5-100元 | 3个工作日内补充数据 / 提交说明 |
| **已拦截** | 存在负数金额 / 长短款超过100元 | 驳回重交 / 通知区域经理专项核查 |

## 对账公式

```
理论应有现金 = 期初现金 + POS销售 - 现金缴存 - 备用金借支 + 备用金归还
现金长短款 = 期末实存现金 - 理论应有现金
```

## 项目结构

```
.
├── src/
│   ├── app.js                 # 应用入口
│   ├── db.js                  # 数据库连接
│   ├── routes.js              # 路由配置
│   ├── controllers/
│   │   └── batchController.js # 控制器
│   └── services/
│       ├── batchService.js    # 批次服务
│       ├── reconciliation.js  # 对账逻辑
│       └── exportService.js   # 导出服务
├── scripts/
│   └── init-db.js             # 数据库初始化
├── data/                      # SQLite数据库
├── exports/                   # 导出文件
└── package.json
```
