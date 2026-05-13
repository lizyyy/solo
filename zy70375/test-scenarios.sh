#!/bin/bash

BASE_URL="http://localhost:3000"
USER_ID="user_001"

echo "==========================================="
echo "  异地多活冲突 API - 测试场景演示"
echo "==========================================="
echo ""

echo "场景 1: 用户资料无冲突合并"
echo "-------------------------------------------"
echo "1. 在 CN-East 区域创建初始用户数据"
curl -s -X POST "$BASE_URL/api/regions/CN-East/users" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'"$USER_ID"'",
    "data": {
      "profile": {
        "name": "张三",
        "email": "zhangsan@example.com"
      },
      "address": {
        "street": "人民路100号",
        "city": "上海",
        "province": "上海",
        "postalCode": "200000"
      }
    },
    "timestamp": 1000000000000
  }' | python3 -m json.tool

echo ""
echo "2. 在 US-West 区域修改不同字段（不会冲突）"
curl -s -X POST "$BASE_URL/api/regions/US-West/users" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'"$USER_ID"'",
    "data": {
      "profile": {
        "name": "张三",
        "email": "zhangsan@example.com",
        "phone": "13800001111"
      },
      "address": {
        "street": "人民路100号",
        "city": "上海",
        "province": "上海",
        "postalCode": "200000"
      }
    },
    "timestamp": 1000000000001
  }' | python3 -m json.tool

echo ""
echo ""

echo "场景 2: 地址冲突检测"
echo "-------------------------------------------"
echo "1. 在 CN-East 区域修改地址"
curl -s -X POST "$BASE_URL/api/regions/CN-East/users" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'"$USER_ID"'",
    "data": {
      "profile": {
        "name": "张三",
        "email": "zhangsan@example.com"
      },
      "address": {
        "street": "南京路500号",
        "city": "上海",
        "province": "上海",
        "postalCode": "200001"
      }
    },
    "timestamp": 1000000000010
  }' | python3 -m json.tool

echo ""
echo "2. 在 US-West 区域同时修改同一个地址字段（冲突！）"
curl -s -X POST "$BASE_URL/api/regions/US-West/users" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'"$USER_ID"'",
    "data": {
      "profile": {
        "name": "张三",
        "email": "zhangsan@example.com"
      },
      "address": {
        "street": "北京路800号",
        "city": "北京",
        "province": "北京",
        "postalCode": "100000"
      }
    },
    "timestamp": 1000000000011
  }' | python3 -m json.tool

echo ""
echo "3. 查询冲突列表"
curl -s "$BASE_URL/api/regions/US-West/conflicts" | python3 -m json.tool

echo ""
echo ""

echo "场景 3: 库存冲突（保守合并策略）"
echo "-------------------------------------------"
echo "1. 在 CN-East 区域写入库存数据"
curl -s -X POST "$BASE_URL/api/regions/CN-East/users" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'"$USER_ID"'",
    "data": {
      "profile": {
        "name": "张三",
        "email": "zhangsan@example.com"
      },
      "inventory": {
        "quantity": 100
      }
    },
    "timestamp": 1000000000020
  }' | python3 -m json.tool

echo ""
echo "2. 在 US-West 区域同时修改库存为不同值"
echo "   注意：库存字段使用保守合并策略（取较小值）"
curl -s -X POST "$BASE_URL/api/regions/US-West/users" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'"$USER_ID"'",
    "data": {
      "profile": {
        "name": "张三",
        "email": "zhangsan@example.com"
      },
      "inventory": {
        "quantity": 80
      }
    },
    "timestamp": 1000000000021
  }' | python3 -m json.tool

echo ""
echo ""

echo "场景 4: 重复同步事件（幂等性验证）"
echo "-------------------------------------------"
echo "1. 发送同步事件（首次）"
SYNC_EVENT_ID="sync_event_001"
curl -s -X POST "$BASE_URL/api/sync/event" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "'"$SYNC_EVENT_ID"'",
    "userId": "'"$USER_ID"'",
    "sourceRegion": "CN-East",
    "targetRegion": "US-West",
    "data": {
      "profile": {
        "name": "李四",
        "email": "lisi@example.com"
      },
      "address": {
        "street": "深圳路123号",
        "city": "深圳",
        "province": "广东",
        "postalCode": "518000"
      }
    },
    "version": 1000000000030,
    "timestamp": 1000000000030
  }' | python3 -m json.tool

echo ""
echo "2. 发送相同的同步事件（重复，幂等处理）"
curl -s -X POST "$BASE_URL/api/sync/event" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "'"$SYNC_EVENT_ID"'",
    "userId": "'"$USER_ID"'",
    "sourceRegion": "CN-East",
    "targetRegion": "US-West",
    "data": {
      "profile": {
        "name": "李四",
        "email": "lisi@example.com"
      },
      "address": {
        "street": "深圳路123号",
        "city": "深圳",
        "province": "广东",
        "postalCode": "518000"
      }
    },
    "version": 1000000000030,
    "timestamp": 1000000000030
  }' | python3 -m json.tool

echo ""
echo ""

echo "场景 5: 人工仲裁和结果广播"
echo "-------------------------------------------"
echo "1. 首先创建一个新的地址冲突"
curl -s -X POST "$BASE_URL/api/regions/CN-East/users" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'"$USER_ID"'",
    "data": {
      "profile": {
        "name": "张三"
      },
      "address": {
        "street": "上海地址A",
        "city": "上海"
      }
    },
    "timestamp": 1000000000040
  }' | python3 -m json.tool

echo ""
echo "2. 在 US-West 区域同时修改（创建冲突）"
ARBITRATION_CONFLICT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/regions/US-West/users" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'"$USER_ID"'",
    "data": {
      "profile": {
        "name": "张三"
      },
      "address": {
        "street": "北京地址B",
        "city": "北京"
      }
    },
    "timestamp": 1000000000041
  }')

echo "$ARBITRATION_CONFLICT_RESPONSE" | python3 -m json.tool

CONFLICT_ID=$(echo "$ARBITRATION_CONFLICT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('conflictId', 'NONE'))")

echo ""
echo "3. 查询冲突详情 (Conflict ID: $CONFLICT_ID)"
if [ "$CONFLICT_ID" != "NONE" ]; then
  curl -s "$BASE_URL/api/conflicts/$CONFLICT_ID" | python3 -m json.tool
fi

echo ""
echo "4. 人工仲裁（选择使用 US-West 的地址）"
if [ "$CONFLICT_ID" != "NONE" ]; then
  curl -s -X POST "$BASE_URL/api/conflicts/$CONFLICT_ID/arbitrate" \
    -H "Content-Type: application/json" \
    -d '{
      "arbiter": "admin_user",
      "resolution": {
        "strategy": "USE_INCOMING"
      },
      "note": "经过电话确认，用户最终选择了北京地址"
    }' | python3 -m json.tool
fi

echo ""
echo "5. 验证两个区域的数据已对齐"
echo "   CN-East 区域用户数据:"
curl -s "$BASE_URL/api/regions/CN-East/users/$USER_ID" | python3 -m json.tool

echo ""
echo "   US-West 区域用户数据:"
curl -s "$BASE_URL/api/regions/US-West/users/$USER_ID" | python3 -m json.tool

echo ""
echo "==========================================="
echo "  所有场景测试完成"
echo "==========================================="
