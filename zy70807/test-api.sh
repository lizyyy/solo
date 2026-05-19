#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=== 跨境包裹申报补税 API 测试 ==="
echo ""

echo "1. 健康检查"
curl -s "${BASE_URL}/health" | jq .
echo ""

echo "2. 提交申报材料（第一次）"
curl -s -X POST "${BASE_URL}/api/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "declarationNo": "DECL-2024-001",
    "submitter": "张三",
    "submitTime": "2024-01-15T10:00:00Z",
    "totalAmount": 5000,
    "customsCode": "SH20240115",
    "logisticsNo": "SF1234567890",
    "packages": [
      {
        "itemNo": "ITEM-001",
        "name": "智能手表",
        "category": "电子产品",
        "quantity": 10,
        "unitPrice": 300,
        "currency": "USD",
        "taxRate": 0.13
      },
      {
        "itemNo": "ITEM-002",
        "name": "蓝牙耳机",
        "category": "电子产品",
        "quantity": 20,
        "unitPrice": 100,
        "currency": "USD",
        "taxRate": 0.13
      }
    ]
  }' | jq .
echo ""

echo "3. 重复提交相同材料（应该识别为重复）"
curl -s -X POST "${BASE_URL}/api/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "declarationNo": "DECL-2024-001",
    "submitter": "张三",
    "submitTime": "2024-01-15T10:00:00Z",
    "totalAmount": 5000,
    "customsCode": "SH20240115",
    "logisticsNo": "SF1234567890",
    "packages": [
      {
        "itemNo": "ITEM-001",
        "name": "智能手表",
        "category": "电子产品",
        "quantity": 10,
        "unitPrice": 300,
        "currency": "USD",
        "taxRate": 0.13
      },
      {
        "itemNo": "ITEM-002",
        "name": "蓝牙耳机",
        "category": "电子产品",
        "quantity": 20,
        "unitPrice": 100,
        "currency": "USD",
        "taxRate": 0.13
      }
    ]
  }' | jq .
echo ""

echo "4. 提交有缺失字段的材料（应该返回错误）"
curl -s -X POST "${BASE_URL}/api/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "declarationNo": "",
    "submitter": "",
    "submitTime": "2024-13-01T10:00:00Z",
    "totalAmount": -100,
    "packages": [
      {
        "itemNo": "ITEM-001",
        "name": "",
        "quantity": -5,
        "unitPrice": 100,
        "taxRate": 1.5
      }
    ]
  }' | jq .
echo ""

echo "5. 查询申报记录"
curl -s "${BASE_URL}/api/query?submitter=张三" | jq .
echo ""

echo "6. 获取统计数据"
curl -s "${BASE_URL}/api/statistics" | jq .
echo ""

echo "7. 处理申报 - 退单"
curl -s -X PUT "${BASE_URL}/api/process/1" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "rejected",
    "processor": "李四",
    "rejectionReason": "商品归类错误，缺少原产地证明"
  }' | jq .
echo ""

echo "8. 再次获取统计数据（查看变化）"
curl -s "${BASE_URL}/api/statistics" | jq .
echo ""

echo "9. 导出数据（JSON格式）"
curl -s "${BASE_URL}/api/export" | jq .
echo ""

echo "10. 导出数据（CSV格式）"
curl -s "${BASE_URL}/api/export?format=csv"
echo ""

echo "=== 测试完成 ==="
