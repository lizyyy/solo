# 快递驿站滞留件处理 API 服务

一个用于处理快递驿站滞留件的小型 API 服务，支持批量导入、自动分类、重复检测和报告生成。

## 功能特性

- **批量处理**：支持批量导入滞留件数据
- **智能分类**：自动分为「正常」「待补充」「已拦截」三类
- **重复检测**：同一批材料重复提交时返回历史处理结果
- **错误定位**：缺字段、时间矛盾、重复编号等错误可追溯到原始材料位置
- **字段追踪**：关键字段从原始输入到最终报告全程可追溯
- **报告导出**：支持 JSON 和 CSV 格式报告下载

## 分类规则

| 分类 | 触发条件 | 后续动作 |
|------|----------|----------|
| **正常** | 信息完整，无格式错误，滞留时间≤7天 | 按正常流程等待收件人自取 |
| **待补充** | 缺少必要字段、滞留超过7天 | 3天内补充信息或联系收件人 |
| **已拦截** | 时间逻辑冲突、用户备注拦截 | 等待进一步处理指令 |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

## API 接口

### 创建批次

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "station_id": "STATION_001",
    "batch_no": "BATCH_20240527_001",
    "items": [
      {
        "waybill_no": "SF1234567890123",
        "receiver_name": "张三",
        "receiver_phone": "13800138001",
        "detained_at": "2024-05-25T09:00:00Z",
        "expected_pickup_at": "2024-05-30T18:00:00Z",
        "parcel_type": "普通",
        "storage_location": "A-01-01",
        "remark": ""
      }
    ]
  }'
```

### 查询批次列表

```bash
curl "http://localhost:3000/api/batches?station_id=STATION_001&page=1&page_size=20"
```

### 查询批次详情

```bash
# 替换 BATCH_ID 为实际批次ID
curl http://localhost:3000/api/batches/BATCH_ID
```

### 下载处理报告

```bash
# JSON 格式
curl http://localhost:3000/api/batches/BATCH_ID/report

# CSV 格式
curl "http://localhost:3000/api/batches/BATCH_ID/report?format=csv" -o report.csv
```

### 查看字段追踪链路

```bash
curl http://localhost:3000/api/batches/BATCH_ID/trace
```

### 查看错误明细

```bash
curl http://localhost:3000/api/batches/BATCH_ID/errors
```

## 完整测试流程脚本

创建 `test-flow.sh` 并运行：

```bash
chmod +x test-flow.sh
./test-flow.sh
```

脚本内容如下：

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=== 1. 健康检查 ==="
curl -s "$BASE_URL/api/health" | jq .

echo -e "\n=== 2. 创建包含多种情况的批次 ==="
RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "station_id": "STATION_001",
    "batch_no": "BATCH_20240527_001",
    "items": [
      {
        "waybill_no": "SF1234567890001",
        "receiver_name": "张三",
        "receiver_phone": "13800138001",
        "detained_at": "2024-05-25T09:00:00Z",
        "expected_pickup_at": "2024-05-30T18:00:00Z",
        "parcel_type": "普通",
        "storage_location": "A-01-01",
        "remark": ""
      },
      {
        "waybill_no": "SF1234567890002",
        "receiver_name": "",
        "receiver_phone": "13800138002",
        "detained_at": "2024-05-20T09:00:00Z",
        "expected_pickup_at": "2024-05-25T18:00:00Z",
        "parcel_type": "生鲜",
        "storage_location": "B-02-01",
        "remark": ""
      },
      {
        "waybill_no": "SF1234567890003",
        "receiver_name": "王五",
        "receiver_phone": "13800138003",
        "detained_at": "2024-05-28T09:00:00Z",
        "expected_pickup_at": "2024-05-26T18:00:00Z",
        "parcel_type": "贵重",
        "storage_location": "C-01-01",
        "remark": "用户要求拦截"
      },
      {
        "waybill_no": "SF1234567890001",
        "receiver_name": "赵六",
        "receiver_phone": "13800138004",
        "detained_at": "2024-05-24T09:00:00Z",
        "expected_pickup_at": "2024-05-29T18:00:00Z",
        "parcel_type": "普通",
        "storage_location": "A-01-02",
        "remark": ""
      }
    ]
  }')

echo "$RESPONSE" | jq .

BATCH_ID=$(echo "$RESPONSE" | jq -r '.batch_id')
echo -e "\n批次ID: $BATCH_ID"

echo -e "\n=== 3. 测试重复提交（应返回历史结果） ==="
curl -s -X POST "$BASE_URL/api/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "station_id": "STATION_001",
    "batch_no": "BATCH_20240527_002",
    "items": [
      {
        "waybill_no": "SF1234567890001",
        "receiver_name": "张三",
        "receiver_phone": "13800138001",
        "detained_at": "2024-05-25T09:00:00Z",
        "expected_pickup_at": "2024-05-30T18:00:00Z",
        "parcel_type": "普通",
        "storage_location": "A-01-01",
        "remark": ""
      },
      {
        "waybill_no": "SF1234567890002",
        "receiver_name": "",
        "receiver_phone": "13800138002",
        "detained_at": "2024-05-20T09:00:00Z",
        "expected_pickup_at": "2024-05-25T18:00:00Z",
        "parcel_type": "生鲜",
        "storage_location": "B-02-01",
        "remark": ""
      },
      {
        "waybill_no": "SF1234567890003",
        "receiver_name": "王五",
        "receiver_phone": "13800138003",
        "detained_at": "2024-05-28T09:00:00Z",
        "expected_pickup_at": "2024-05-26T18:00:00Z",
        "parcel_type": "贵重",
        "storage_location": "C-01-01",
        "remark": "用户要求拦截"
      },
      {
        "waybill_no": "SF1234567890001",
        "receiver_name": "赵六",
        "receiver_phone": "13800138004",
        "detained_at": "2024-05-24T09:00:00Z",
        "expected_pickup_at": "2024-05-29T18:00:00Z",
        "parcel_type": "普通",
        "storage_location": "A-01-02",
        "remark": ""
      }
    ]
  }' | jq .

echo -e "\n=== 4. 查看字段追踪链路 ==="
curl -s "$BASE_URL/api/batches/$BATCH_ID/trace" | jq .

echo -e "\n=== 5. 查看错误明细（包含原始材料位置） ==="
curl -s "$BASE_URL/api/batches/$BATCH_ID/errors" | jq .

echo -e "\n=== 6. 下载 JSON 格式报告 ==="
curl -s "$BASE_URL/api/batches/$BATCH_ID/report" | jq .

echo -e "\n=== 7. 下载 CSV 格式报告 ==="
curl -s "$BASE_URL/api/batches/$BATCH_ID/report?format=csv" -o batch_report.csv
echo "报告已保存到 batch_report.csv"

echo -e "\n=== 测试完成 ==="
```

## 输入字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| waybill_no | string | 是 | 运单号，8-20位字母数字 |
| receiver_name | string | 是 | 收件人姓名 |
| receiver_phone | string | 是 | 收件人电话，11位手机号 |
| detained_at | string | 是 | 滞留时间，ISO格式 |
| expected_pickup_at | string | 否 | 预计自取时间，ISO格式 |
| parcel_type | string | 否 | 包裹类型 |
| storage_location | string | 否 | 存放位置 |
| remark | string | 否 | 备注 |

## 错误类型说明

| 错误类型 | 说明 |
|----------|------|
| missing_field | 必填字段缺失 |
| invalid_format | 字段格式不正确 |
| time_conflict | 时间逻辑冲突 |
| duplicate_waybill | 运单号重复 |

## 项目结构

```
.
├── src/
│   ├── server.js          # 主服务入口
│   ├── database.js        # 数据库初始化
│   ├── classifier.js      # 分类引擎
│   └── report-generator.js # 报告生成器
├── data/                  # 数据库文件目录
├── package.json
└── README.md
```
