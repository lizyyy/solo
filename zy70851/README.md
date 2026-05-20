# 保险理赔材料预审 API 服务

基于 Node.js + Express + SQLite 构建的保险理赔材料智能预审系统，支持批量导入、自动分类、任务状态追踪和报告导出。

## 功能特性

- 📦 **批次管理**：创建、查询、管理理赔批次
- 📋 **材料导入**：批量导入理赔材料，支持关键字段追踪
- 🔍 **智能预审**：
  - 保单责任校验
  - 材料缺口检测
  - 重复报案识别
- 🎯 **自动分类**：
  - 正常：材料齐全，属于保险责任
  - 待补充：缺少必要材料，需客户补充
  - 已拦截：不属于保险责任或重复报案
- 👤 **人工复核**：金额超过 5 万元自动进入人工审核
- 📊 **报告导出**：支持 CSV 和 JSON 格式导出
- 💾 **状态持久化**：处理中、处理失败、人工确认、已导出等状态

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

服务默认运行在：http://localhost:3000

### 4. 健康检查

```bash
curl http://localhost:3000/health
```

## 完整测试流程

以下是从创建批次到下载报告的完整 curl 命令：

### 步骤 1：创建批次

```bash
# 创建一个新的理赔批次
BATCH_RESPONSE=$(curl -s -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{"operator": "理赔内勤张三"}')

echo "创建批次响应: $BATCH_RESPONSE"
BATCH_ID=$(echo $BATCH_RESPONSE | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).id)")
echo "批次ID: $BATCH_ID"
```

### 步骤 2：上传理赔材料

```bash
curl -X POST http://localhost:3000/api/claims/batch/$BATCH_ID \
  -H "Content-Type: application/json" \
  -d '{
    "claims": [
      {
        "claim_no": "CLAIM-001",
        "policy_no": "POL-2024-001",
        "insured_name": "张三",
        "insured_id_card": "110101199001011234",
        "accident_date": "2024-01-15",
        "claim_amount": 3000,
        "diagnosis": "急性阑尾炎",
        "hospital": "北京协和医院",
        "materials": ["身份证", "住院发票", "出院小结", "费用清单", "诊断证明"],
        "claim_type": "住院理赔"
      },
      {
        "claim_no": "CLAIM-002",
        "policy_no": "POL-2024-002",
        "insured_name": "李四",
        "insured_id_card": "110101199002022345",
        "accident_date": "2024-02-20",
        "claim_amount": 60000,
        "diagnosis": "骨折",
        "hospital": "上海瑞金医院",
        "materials": ["身份证", "住院发票", "出院小结", "费用清单", "诊断证明"],
        "claim_type": "住院理赔"
      },
      {
        "claim_no": "CLAIM-003",
        "policy_no": "POL-2024-003",
        "insured_name": "王五",
        "insured_id_card": "110101199003033456",
        "accident_date": "2024-03-10",
        "claim_amount": 8000,
        "diagnosis": "肺炎",
        "hospital": "广州中山医院",
        "materials": ["身份证", "住院发票"],
        "claim_type": "住院理赔"
      },
      {
        "claim_no": "CLAIM-004",
        "policy_no": "POL-2024-004",
        "insured_name": "赵六",
        "insured_id_card": "110101199004044567",
        "accident_date": "2024-04-05",
        "claim_amount": 5000,
        "diagnosis": "抑郁症",
        "hospital": "深圳人民医院",
        "materials": ["身份证", "住院发票", "出院小结", "费用清单", "诊断证明"],
        "claim_type": "住院理赔"
      },
      {
        "claim_no": "CLAIM-005",
        "policy_no": "POL-2024-001",
        "insured_name": "张三",
        "insured_id_card": "110101199001011234",
        "accident_date": "2024-01-15",
        "claim_amount": 2000,
        "diagnosis": "急性阑尾炎",
        "hospital": "北京协和医院",
        "materials": ["身份证", "住院发票", "出院小结", "费用清单", "诊断证明"],
        "claim_type": "住院理赔"
      }
    ]
  }'
```

### 步骤 3：执行批量预审

```bash
curl -X POST http://localhost:3000/api/precheck/batch/$BATCH_ID
```

### 步骤 4：查看预审结果

```bash
# 查看所有结果
curl http://localhost:3000/api/precheck/batch/$BATCH_ID/results

# 只看正常的
curl "http://localhost:3000/api/precheck/batch/$BATCH_ID/results?category=normal"

# 只看待补充的
curl "http://localhost:3000/api/precheck/batch/$BATCH_ID/results?category=supplement"

# 只看已拦截的
curl "http://localhost:3000/api/precheck/batch/$BATCH_ID/results?category=blocked"
```

### 步骤 5：查看批次统计摘要

```bash
curl http://localhost:3000/api/reports/batch/$BATCH_ID/summary
```

### 步骤 6：导出报告（CSV 格式）

```bash
EXPORT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/reports/batch/$BATCH_ID/export \
  -H "Content-Type: application/json" \
  -d '{"format": "csv"}')

echo "导出响应: $EXPORT_RESPONSE"
DOWNLOAD_URL=$(echo $EXPORT_RESPONSE | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).download_url)")
echo "下载地址: $DOWNLOAD_URL"
```

### 步骤 7：下载报告

```bash
curl -O "http://localhost:3000$DOWNLOAD_URL"
echo "报告已下载完成"
```

### 步骤 8：查看批次状态和任务历史

```bash
curl http://localhost:3000/api/batches/$BATCH_ID
```

### 导出 JSON 格式报告

```bash
curl -X POST http://localhost:3000/api/reports/batch/$BATCH_ID/export \
  -H "Content-Type: application/json" \
  -d '{"format": "json"}'
```

## API 接口说明

### 批次管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/batches | 创建新批次 |
| GET | /api/batches | 获取所有批次 |
| GET | /api/batches/:batchId | 获取批次详情和任务历史 |
| PATCH | /api/batches/:batchId/status | 更新批次状态 |

### 理赔材料

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/claims/batch/:batchId | 批量上传理赔材料 |
| GET | /api/claims/batch/:batchId | 获取批次下所有理赔材料 |
| GET | /api/claims/:claimId | 获取单个理赔材料详情 |

### 预审处理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/precheck/batch/:batchId | 批量预审 |
| POST | /api/precheck/claim/:claimId | 单个预审 |
| GET | /api/precheck/batch/:batchId/results | 获取预审结果 |
| GET | /api/precheck/categories | 获取分类说明 |

### 报告导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/reports/batch/:batchId/summary | 获取批次统计摘要 |
| POST | /api/reports/batch/:batchId/export | 导出报告 |
| GET | /api/reports/download/:filename | 下载报告文件 |

## 预审逻辑说明

### 1. 保单责任校验

- 诊断病种必须在保障范围内（急性阑尾炎、骨折、肺炎、冠心病、糖尿病）
- 事故日期必须在保单生效日期后（2020-01-01 之后）
- 缺少诊断信息直接判定为不属于责任

### 2. 材料缺口检测

**住院理赔必需材料**：
- 身份证
- 住院发票
- 出院小结
- 费用清单
- 诊断证明

**门诊理赔必需材料**：
- 身份证
- 门诊发票
- 门诊病历
- 费用清单

**大额理赔（≥1万元）**：额外需要银行卡信息

### 3. 重复报案识别

- 同一身份证 + 同一事故日期
- 同一保单号 + 同一事故日期

### 4. 人工复核触发

- 理赔金额 ≥ 50,000 元
- 且预审分类为"正常"

## 分类说明

| 分类 | 标识 | 说明 | 后续动作 |
|------|------|------|----------|
| 正常 | normal | 材料齐全，属于保险责任 | 进入理赔流程 |
| 待补充 | supplement | 缺少必要材料 | 通知客户补充材料 |
| 已拦截 | blocked | 不属于保险责任或重复报案 | 做拒赔或撤案处理 |

## 任务状态

| 状态 | 说明 |
|------|------|
| pending | 待处理 |
| processing | 处理中 |
| completed | 已完成 |
| failed | 处理失败 |
| manual_confirm | 人工确认 |
| exported | 已导出 |

## 项目结构

```
.
├── src/
│   ├── server.js          # 服务入口
│   ├── db/
│   │   └── index.js       # 数据库连接
│   ├── routes/
│   │   ├── batches.js     # 批次路由
│   │   ├── claims.js      # 理赔材料路由
│   │   ├── precheck.js    # 预审路由
│   │   └── reports.js     # 报告路由
│   ├── services/
│   │   └── precheckService.js  # 预审核心逻辑
│   └── scripts/
│       └── init-db.js     # 数据库初始化脚本
├── data/                  # SQLite 数据库文件
├── reports/               # 导出的报告文件
├── package.json
└── README.md
```

## 一键测试脚本

创建 `test-flow.sh`：

```bash
#!/bin/bash

echo "=== 保险理赔预审系统完整流程测试 ==="

echo ""
echo "1. 创建批次..."
BATCH_RESPONSE=$(curl -s -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{"operator": "理赔内勤张三"}')
BATCH_ID=$(echo $BATCH_RESPONSE | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).id)")
echo "批次ID: $BATCH_ID"

echo ""
echo "2. 上传理赔材料..."
curl -s -X POST http://localhost:3000/api/claims/batch/$BATCH_ID \
  -H "Content-Type: application/json" \
  -d '{
    "claims": [
      {"claim_no": "CLAIM-001","policy_no": "POL-2024-001","insured_name": "张三","insured_id_card": "110101199001011234","accident_date": "2024-01-15","claim_amount": 3000,"diagnosis": "急性阑尾炎","hospital": "北京协和医院","materials": ["身份证", "住院发票", "出院小结", "费用清单", "诊断证明"]},
      {"claim_no": "CLAIM-002","policy_no": "POL-2024-002","insured_name": "李四","insured_id_card": "110101199002022345","accident_date": "2024-02-20","claim_amount": 60000,"diagnosis": "骨折","hospital": "上海瑞金医院","materials": ["身份证", "住院发票", "出院小结", "费用清单", "诊断证明"]},
      {"claim_no": "CLAIM-003","policy_no": "POL-2024-003","insured_name": "王五","insured_id_card": "110101199003033456","accident_date": "2024-03-10","claim_amount": 8000,"diagnosis": "肺炎","hospital": "广州中山医院","materials": ["身份证", "住院发票"]},
      {"claim_no": "CLAIM-004","policy_no": "POL-2024-004","insured_name": "赵六","insured_id_card": "110101199004044567","accident_date": "2024-04-05","claim_amount": 5000,"diagnosis": "抑郁症","hospital": "深圳人民医院","materials": ["身份证", "住院发票", "出院小结", "费用清单", "诊断证明"]},
      {"claim_no": "CLAIM-005","policy_no": "POL-2024-001","insured_name": "张三","insured_id_card": "110101199001011234","accident_date": "2024-01-15","claim_amount": 2000,"diagnosis": "急性阑尾炎","hospital": "北京协和医院","materials": ["身份证", "住院发票", "出院小结", "费用清单", "诊断证明"]}
    ]
  }' > /dev/null
echo "材料上传完成"

echo ""
echo "3. 执行批量预审..."
curl -s -X POST http://localhost:3000/api/precheck/batch/$BATCH_ID
echo ""

echo ""
echo "4. 查看预审结果统计..."
curl -s http://localhost:3000/api/reports/batch/$BATCH_ID/summary | node -e "
const data = JSON.parse(require('fs').readFileSync(0));
console.log('总报案数:', data.total_claims);
console.log('总金额:', data.total_amount.toFixed(2), '元');
console.log('预审完成数:', data.precheck_completed);
console.log('');
console.log('分类统计:');
console.log('  正常:', data.categories.normal, '件, 金额:', data.category_amounts.normal.toFixed(2), '元');
console.log('  待补充:', data.categories.supplement, '件, 金额:', data.category_amounts.supplement.toFixed(2), '元');
console.log('  已拦截:', data.categories.blocked, '件, 金额:', data.category_amounts.blocked.toFixed(2), '元');
console.log('  需人工复核:', data.categories.manual_review, '件');
"

echo ""
echo "5. 导出 CSV 报告..."
EXPORT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/reports/batch/$BATCH_ID/export \
  -H "Content-Type: application/json" \
  -d '{"format": "csv"}')
FILENAME=$(echo $EXPORT_RESPONSE | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).filename)")
echo "报告文件名: $FILENAME"

echo ""
echo "=== 测试完成 ==="
echo "批次ID: $BATCH_ID"
echo "查看详情: curl http://localhost:3000/api/batches/$BATCH_ID"
```

运行测试：

```bash
chmod +x test-flow.sh
./test-flow.sh
```
