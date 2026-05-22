# 公共充电桩退款审核 API 服务

新能源客服退款审核系统，支持材料批量提交、重复检测、状态流转、审计追踪和报告导出。

## 功能特性

- ✅ 批量提交退款材料
- ✅ 重复提交自动识别（基于材料哈希）
- ✅ 任务状态持久化（处理中/处理失败/人工确认/已导出）
- ✅ 完整审计日志（谁改的、为什么改、改动前值）
- ✅ 数据链路追踪（原始输入 → 最终报告）
- ✅ 多维度退款判断（支付渠道 + 桩端日志 + 客服备注）
- ✅ CSV 报告导出下载

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

---

## 接口文档

### 1. 创建批次（提交退款材料）

**接口**: `POST /api/batches`

**请求体**:
```json
{
  "operator": "客服小王",
  "remark": "5月第一周退款申请",
  "materials": [
    {
      "orderNo": "ORD20240501001",
      "paymentChannel": "alipay",
      "amount": 58.50,
      "chargeDuration": 3600,
      "startTime": 1714521600,
      "endTime": 1714525200,
      "pileId": "PILE-BJ-001",
      "userId": "USER123456",
      "pileStartLog": {
        "startTime": "2024-05-01 10:00:00",
        "voltage": 380,
        "current": 15,
        "connectStatus": "success"
      },
      "customerServiceRemark": "用户反馈充电中途中断"
    }
  ]
}
```

**响应**:
- 首次提交：返回新批次信息
- 重复提交：返回原有处理结果

---

### 2. 查询批次列表

```bash
curl http://localhost:3000/api/batches
```

### 3. 查询单个批次详情

```bash
curl http://localhost:3000/api/batches/{batchId}
```

### 4. 人工修改审核结论

```bash
curl -X PUT http://localhost:3000/api/records/{recordId}/conclusion \
  -H "Content-Type: application/json" \
  -d '{
    "conclusion": "refund_full",
    "reason": "经核实充电桩确实存在故障",
    "operator": "客服主管"
  }'
```

### 5. 导出批次报告

```bash
curl -X POST http://localhost:3000/api/batches/{batchId}/export
```

### 6. 下载 CSV 报告

```bash
curl -O -J http://localhost:3000/api/batches/{batchId}/download
```

### 7. 查看审计日志

```bash
# 查看单条记录的修改历史
curl http://localhost:3000/api/records/{recordId}/audit-logs

# 查看整个批次的审计日志
curl http://localhost:3000/api/batches/{batchId}/audit-logs

# 查看所有审计日志
curl http://localhost:3000/api/audit-logs
```

---

## 完整测试脚本

将以下内容保存为 `test.sh` 并运行：

```bash
#!/bin/bash
BASE_URL="http://localhost:3000"

echo "=== 1. 健康检查 ==="
curl -s $BASE_URL/api/health
echo -e "\n"

echo "=== 2. 创建退款批次 ==="
BATCH_RESPONSE=$(curl -s -X POST $BASE_URL/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "客服小王",
    "remark": "5月测试批次",
    "materials": [
      {
        "orderNo": "ORD20240501001",
        "paymentChannel": "alipay",
        "amount": 58.50,
        "chargeDuration": 3600,
        "startTime": 1714521600,
        "endTime": 1714525200,
        "pileId": "PILE-BJ-001",
        "userId": "USER123456",
        "pileStartLog": {
          "startTime": "2024-05-01 10:00:00",
          "voltage": 380,
          "current": 15,
          "connectStatus": "success"
        },
        "customerServiceRemark": "用户反馈充电中途中断"
      },
      {
        "orderNo": "ORD20240501002",
        "paymentChannel": "wechat",
        "amount": 0,
        "chargeDuration": 30,
        "startTime": 1714531600,
        "endTime": 1714531630,
        "pileId": "PILE-SH-002",
        "userId": "USER654321",
        "pileStartLog": {},
        "customerServiceRemark": "订单异常，金额为0"
      }
    ]
  }')

echo "$BATCH_RESPONSE" | head -c 500
BATCH_ID=$(echo "$BATCH_RESPONSE" | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo -e "\n批次ID: $BATCH_ID"
echo -e "\n"

sleep 2

echo "=== 3. 查询批次详情 ==="
curl -s $BASE_URL/api/batches/$BATCH_ID | head -c 800
echo -e "\n"

echo "=== 4. 重复提交（应该返回已有结果）==="
curl -s -X POST $BASE_URL/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "客服小王",
    "remark": "5月测试批次",
    "materials": [
      {
        "orderNo": "ORD20240501001",
        "paymentChannel": "alipay",
        "amount": 58.50,
        "chargeDuration": 3600,
        "startTime": 1714521600,
        "endTime": 1714525200,
        "pileId": "PILE-BJ-001",
        "userId": "USER123456",
        "pileStartLog": {
          "startTime": "2024-05-01 10:00:00",
          "voltage": 380,
          "current": 15,
          "connectStatus": "success"
        },
        "customerServiceRemark": "用户反馈充电中途中断"
      },
      {
        "orderNo": "ORD20240501002",
        "paymentChannel": "wechat",
        "amount": 0,
        "chargeDuration": 30,
        "startTime": 1714531600,
        "endTime": 1714531630,
        "pileId": "PILE-SH-002",
        "userId": "USER654321",
        "pileStartLog": {},
        "customerServiceRemark": "订单异常，金额为0"
      }
    ]
  }' | head -c 300
echo -e "\n"

echo "=== 5. 获取记录ID ==="
RECORD_ID=$(curl -s $BASE_URL/api/batches/$BATCH_ID | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "记录ID: $RECORD_ID"
echo -e "\n"

echo "=== 6. 人工修改结论 ==="
curl -s -X PUT $BASE_URL/api/records/$RECORD_ID/conclusion \
  -H "Content-Type: application/json" \
  -d '{
    "conclusion": "refund_full",
    "reason": "经核实充电桩确实存在故障",
    "operator": "客服主管"
  }'
echo -e "\n"

echo "=== 7. 查看审计日志 ==="
curl -s $BASE_URL/api/records/$RECORD_ID/audit-logs
echo -e "\n"

echo "=== 8. 导出并下载报告 ==="
curl -s -X POST $BASE_URL/api/batches/$BATCH_ID/export
echo -e "\n"

curl -s -O -J $BASE_URL/api/batches/$BATCH_ID/download
echo "报告已下载: refund-batch-$BATCH_ID.csv"
```

运行测试：
```bash
chmod +x test.sh
./test.sh
```

---

## 审核结论说明

| 结论值 | 说明 |
|--------|------|
| `pending` | 待处理 |
| `normal` | 订单正常，无需退款 |
| `refund_partial` | 部分退款 |
| `refund_full` | 全额退款 |
| `manual_review` | 需要人工审核 |

## 状态流转

```
处理中 (processing)
    ↓
  自动审核
    ↓
人工确认 (manual_confirm) ←── 人工修改
    ↓
  导出报告
    ↓
已导出 (exported)
```

## 数据结构

### batches 批次表
- id: 批次ID
- material_hash: 材料哈希（用于重复检测）
- status: 批次状态
- operator: 操作人
- remark: 备注
- created_at/updated_at: 时间戳

### refund_records 退款记录表
- id: 记录ID
- batch_id: 所属批次
- order_no: 订单号
- payment_channel: 支付渠道
- pile_start_log: 桩端启动日志（JSON）
- customer_service_remark: 客服备注
- amount: 订单金额
- conclusion: 审核结论
- conclusion_reason: 结论原因

### audit_logs 审计日志表
- id: 日志ID
- record_id: 关联记录ID
- field_name: 修改字段
- old_value: 修改前值
- new_value: 修改后值
- operator: 操作人
- reason: 修改原因
