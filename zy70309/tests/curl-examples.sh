#!/bin/bash

echo "========================================"
echo " 订单事件溯源 API - curl 示例"
echo "========================================"
echo ""
echo "注意：请确保 API 服务已在 localhost:3000 运行"
echo ""

BASE_URL="http://localhost:3000/api/orders"

echo "========================================"
echo "场景 1: 正常下单流程"
echo "========================================"
echo ""

echo "1. 创建订单"
echo "curl -X POST $BASE_URL \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{
    \"payload\": {
      \"userId\": \"USER-DEMO-001\",
      \"items\": [
        {
          \"productId\": \"PROD-IPHONE-15\",
          \"productName\": \"iPhone 15 Pro\",
          \"quantity\": 1,
          \"unitPrice\": 8999,
          \"totalPrice\": 8999
        }
      ],
      \"totalAmount\": 8999,
      \"shippingAddress\": {
        \"province\": \"广东省\",
        \"city\": \"深圳市\",
        \"district\": \"南山区\",
        \"detail\": \"科技园路 1 号腾讯大厦\",
        \"phone\": \"13800138001\",
        \"name\": \"张三\"
      },
      \"paymentMethod\": \"WECHAT_PAY\",
      \"remark\": \"请尽快发货\"
    },
    \"metadata\": {
      \"operator\": \"SYSTEM\",
      \"source\": \"ORDER_SERVICE\",
      \"description\": \"用户通过小程序下单\"
    }
  }'"
echo ""

read -p "按回车继续..."

echo ""
echo "请在下方输入返回的 orderId:"
read ORDER_ID

echo ""
echo "使用订单号: $ORDER_ID"
echo ""

echo "2. 发起支付"
echo "curl -X POST $BASE_URL/$ORDER_ID/events \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{
    \"eventType\": \"PAYMENT_INITIATED\",
    \"payload\": {},
    \"metadata\": {
      \"operator\": \"USER-DEMO-001\",
      \"source\": \"PAYMENT_GATEWAY\",
      \"description\": \"用户点击支付按钮\"
    }
  }'"
echo ""

echo "3. 支付成功"
echo "curl -X POST $BASE_URL/$ORDER_ID/events \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{
    \"eventType\": \"PAYMENT_SUCCEEDED\",
    \"payload\": {
      \"paymentId\": \"PAY-$(date +%Y%m%d%H%M%S)\",
      \"amount\": 8999,
      \"paidAt\": \"$(date -u +\"%Y-%m-%dT%H:%M:%SZ\")\"
    },
    \"metadata\": {
      \"operator\": \"PAYMENT_GATEWAY\",
      \"source\": \"PAYMENT_CALLBACK\",
      \"description\": \"微信支付回调成功\"
    }
  }'"
echo ""

echo "4. 锁定库存"
echo "curl -X POST $BASE_URL/$ORDER_ID/events \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{
    \"eventType\": \"INVENTORY_LOCKED\",
    \"payload\": {
      \"items\": [
        {
          \"productId\": \"PROD-IPHONE-15\",
          \"lockedQuantity\": 1
        }
      ]
    },
    \"metadata\": {
      \"operator\": \"INVENTORY_SERVICE\",
      \"source\": \"INVENTORY_LOCK\",
      \"description\": \"库存锁定成功\"
    }
  }'"
echo ""

echo "5. 发起发货"
echo "curl -X POST $BASE_URL/$ORDER_ID/events \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{
    \"eventType\": \"SHIPPING_INITIATED\",
    \"payload\": {},
    \"metadata\": {
      \"operator\": \"LOGISTICS-001\",
      \"source\": \"SHIPPING_DEPT\",
      \"description\": \"仓库开始打包\"
    }
  }'"
echo ""

echo "6. 查看订单时间线"
echo "curl -X GET $BASE_URL/$ORDER_ID/timeline"
echo ""

echo "7. 查看当前投影"
echo "curl -X GET $BASE_URL/$ORDER_ID/projection"
echo ""

echo "8. 导出解释报告（JSON）"
echo "curl -X GET $BASE_URL/$ORDER_ID/report"
echo ""

echo "9. 导出解释报告（文本，可下载）"
echo "curl -X GET $BASE_URL/$ORDER_ID/report/export -o report-$ORDER_ID.txt"
echo ""

read -p "按回车继续下一个场景..."

echo ""
echo "========================================"
echo "场景 2: 支付后取消失败"
echo "========================================"
echo ""

echo "创建一个新订单用于演示取消失败场景"
echo ""

echo "1. 创建订单"
NEW_ORDER=$(curl -s -X POST $BASE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {
      "userId": "USER-DEMO-002",
      "items": [
        {
          "productId": "PROD-MACBOOK",
          "productName": "MacBook Pro 14\"",
          "quantity": 1,
          "unitPrice": 14999,
          "totalPrice": 14999
        }
      ],
      "totalAmount": 14999,
      "shippingAddress": {
        "province": "北京市",
        "city": "北京市",
        "district": "朝阳区",
        "detail": "望京 SOHO T1",
        "phone": "13900139002",
        "name": "李四"
      },
      "paymentMethod": "ALIPAY"
    }
  }')

CANCEL_ORDER_ID=$(echo $NEW_ORDER | grep -o '"orderId":"[^"]*"' | cut -d'"' -f4)
echo "创建的订单号: $CANCEL_ORDER_ID"
echo ""

echo "2. 支付"
echo "curl -X POST $BASE_URL/$CANCEL_ORDER_ID/events \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"eventType\":\"PAYMENT_INITIATED\",\"payload\":{}}'"
echo ""

echo "curl -X POST $BASE_URL/$CANCEL_ORDER_ID/events \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{
    \"eventType\": \"PAYMENT_SUCCEEDED\",
    \"payload\": {
      \"paymentId\": \"PAY-CANCEL-TEST-001\",
      \"amount\": 14999
    }
  }'"
echo ""

echo "3. 库存锁定"
echo "curl -X POST $BASE_URL/$CANCEL_ORDER_ID/events \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{
    \"eventType\": \"INVENTORY_LOCKED\",
    \"payload\": {
      \"items\": [
        {
          \"productId\": \"PROD-MACBOOK\",
          \"lockedQuantity\": 1
        }
      ]
    }
  }'"
echo ""

echo "4. 发货"
echo "curl -X POST $BASE_URL/$CANCEL_ORDER_ID/events \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"eventType\":\"SHIPPING_INITIATED\",\"payload\":{}}'"
echo ""

echo "5. 尝试在发货后取消（应该失败）"
echo "curl -X POST $BASE_URL/$CANCEL_ORDER_ID/events \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{
    \"eventType\": \"CANCEL_REQUESTED\",
    \"payload\": {
      \"reason\": \"不想要了，想换个颜色\"
    },
    \"metadata\": {
      \"operator\": \"USER-DEMO-002\",
      \"source\": \"USER_APP\",
      \"description\": \"用户申请取消订单\"
    }
  }'"
echo ""

echo "预期结果：返回 400 错误，提示状态不允许取消"
echo ""

echo "6. 查看解释报告，客服能看到为什么不能取消"
echo "curl -X GET $BASE_URL/$CANCEL_ORDER_ID/report"
echo ""

read -p "按回车继续下一个场景..."

echo ""
echo "========================================"
echo "场景 3: 库存补偿"
echo "========================================"
echo ""

echo "1. 创建订单"
COMP_ORDER=$(curl -s -X POST $BASE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {
      "userId": "USER-DEMO-003",
      "items": [
        {
          "productId": "PROD-AIRPODS",
          "productName": "AirPods Pro",
          "quantity": 1,
          "unitPrice": 1899,
          "totalPrice": 1899
        }
      ],
      "totalAmount": 1899,
      "shippingAddress": {
        "province": "上海市",
        "city": "上海市",
        "district": "浦东新区",
        "detail": "张江高科园区",
        "phone": "13700137003",
        "name": "王五"
      },
      "paymentMethod": "WECHAT_PAY"
    }
  }')

COMP_ORDER_ID=$(echo $COMP_ORDER | grep -o '"orderId":"[^"]*"' | cut -d'"' -f4)
echo "创建的订单号: $COMP_ORDER_ID"
echo ""

echo "2. 支付成功"
echo "curl -X POST $BASE_URL/$COMP_ORDER_ID/events \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"eventType\":\"PAYMENT_INITIATED\",\"payload\":{}}'"
echo ""

echo "curl -X POST $BASE_URL/$COMP_ORDER_ID/events \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{
    \"eventType\": \"PAYMENT_SUCCEEDED\",
    \"payload\": {
      \"paymentId\": \"PAY-COMP-TEST-001\",
      \"amount\": 1899
    }
  }'"
echo ""

echo "3. 库存锁定失败（模拟缺货）"
INVENTORY_FAIL=$(curl -s -X POST $BASE_URL/$COMP_ORDER_ID/events \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "INVENTORY_FAILED",
    "payload": {
      "reason": "PROD-AIRPODS 库存不足，剩余 0 件"
    },
    "metadata": {
      "operator": "INVENTORY_SERVICE",
      "source": "INVENTORY_CHECK",
      "description": "库存检查失败"
    }
  }')

echo "库存失败事件的响应: $INVENTORY_FAIL"
echo ""

echo "4. 写入补偿事件：退款"
echo "curl -X POST $BASE_URL/$COMP_ORDER_ID/compensation \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{
    \"eventType\": \"COMPENSATION_PAYMENT_REFUNDED\",
    \"compensatesEventId\": \"[替换为上面库存失败事件的 eventId]\",
    \"payload\": {
      \"refundId\": \"REFUND-COMP-001\",
      \"amount\": 1899,
      \"reason\": \"库存锁定失败，自动退款\"
    },
    \"metadata\": {
      \"operator\": \"COMPENSATION_ENGINE\",
      \"source\": \"AUTO_COMPENSATION\",
      \"description\": \"系统自动执行补偿退款\"
    }
  }'"
echo ""

echo "5. 查看补偿后的解释报告"
echo "curl -X GET $BASE_URL/$COMP_ORDER_ID/report"
echo ""

read -p "按回车继续下一个场景..."

echo ""
echo "========================================"
echo "场景 4: 重复事件幂等"
echo "========================================"
echo ""

echo "1. 使用指定的 eventId 创建订单（第一次）"
IDEM_ORDER=$(curl -s -X POST $BASE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "EVT-IDEM-TEST-0001",
    "payload": {
      "userId": "USER-DEMO-004",
      "items": [
        {
          "productId": "PROD-WATCH",
          "productName": "Apple Watch",
          "quantity": 1,
          "unitPrice": 2999,
          "totalPrice": 2999
        }
      ],
      "totalAmount": 2999,
      "shippingAddress": {
        "province": "浙江省",
        "city": "杭州市",
        "district": "西湖区",
        "detail": "阿里巴巴园区",
        "phone": "13600136004",
        "name": "赵六"
      },
      "paymentMethod": "ALIPAY"
    }
  }')

IDEM_ORDER_ID=$(echo $IDEM_ORDER | grep -o '"orderId":"[^"]*"' | cut -d'"' -f4)
echo "创建的订单号: $IDEM_ORDER_ID"
echo ""

echo "2. 使用相同 eventId 再次创建（幂等处理，不会重复）"
echo "curl -X POST $BASE_URL \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{
    \"eventId\": \"EVT-IDEM-TEST-0001\",
    \"payload\": {
      \"userId\": \"USER-DEMO-004\",
      \"items\": [
        {
          \"productId\": \"PROD-WATCH\",
          \"productName\": \"Apple Watch\",
          \"quantity\": 1,
          \"unitPrice\": 2999,
          \"totalPrice\": 2999
        }
      ],
      \"totalAmount\": 2999,
      \"shippingAddress\": {
        \"province\": \"浙江省\",
        \"city\": \"杭州市\",
        \"district\": \"西湖区\",
        \"detail\": \"阿里巴巴园区\",
        \"phone\": \"13600136004\",
        \"name\": \"赵六\"
      },
      \"paymentMethod\": \"ALIPAY\"
    }
  }'"
echo ""

echo "预期结果：返回 isIdempotent: true，版本号不会增加"
echo ""

echo "3. 验证最终状态（应该只有 1 个事件）"
echo "curl -X GET $BASE_URL/$IDEM_ORDER_ID/projection"
echo ""

read -p "按回车继续下一个场景..."

echo ""
echo "========================================"
echo "场景 5: 投影重建"
echo "========================================"
echo ""

echo "使用第一个订单进行重建演示"
echo ""

echo "1. 查看重建前的投影"
echo "curl -X GET $BASE_URL/$ORDER_ID/projection"
echo ""

echo "2. 检查一致性"
echo "curl -X GET $BASE_URL/$ORDER_ID/consistency"
echo ""

echo "3. 执行投影重建"
echo "curl -X POST $BASE_URL/$ORDER_ID/rebuild"
echo ""

echo "4. 查看重建后的投影"
echo "curl -X GET $BASE_URL/$ORDER_ID/projection"
echo ""

echo "5. 再次检查一致性"
echo "curl -X GET $BASE_URL/$ORDER_ID/consistency"
echo ""

echo ""
echo "========================================"
echo "场景 6: 事件回放"
echo "========================================"
echo ""

echo "1. 按版本号回放（回放到支付成功的状态）"
echo "curl -X POST $BASE_URL/$ORDER_ID/replay \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"toVersion\": 3}'"
echo ""

echo "2. 按事件 ID 回放"
echo "curl -X POST $BASE_URL/$ORDER_ID/replay \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"toEventId\": \"[某个事件ID]\"}'"
echo ""

echo "3. 按时间回放"
echo "curl -X POST $BASE_URL/$ORDER_ID/replay \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"toTime\": \"2024-01-01T12:00:00Z\"}'"
echo ""

echo ""
echo "========================================"
echo "其他有用的接口"
echo "========================================"
echo ""

echo "查看 API 文档"
echo "curl -X GET $BASE_URL"
echo ""

echo "查看所有 API 端点"
echo "curl -X GET $BASE_URL/"
echo ""

echo ""
echo "========================================"
echo "curl 示例结束"
echo "========================================"
echo ""
