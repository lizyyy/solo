#!/bin/bash
# API 测试脚本 - 验证设备命令确认系统功能

BASE_URL="http://localhost:8080/api/commands"
BATCH_NO="TEST-BATCH-$(date +%Y%m%d%H%M%S)"

echo "========================================"
echo "设备命令确认 API - 功能测试"
echo "批次号: $BATCH_NO"
echo "========================================"

# 等待服务启动
wait_for_service() {
    echo ""
    echo "等待服务启动..."
    for i in {1..30}; do
        if curl -s "http://localhost:8080/h2-console" > /dev/null; then
            echo "服务已启动!"
            return 0
        fi
        sleep 1
    done
    echo "错误: 服务启动超时"
    exit 1
}

# 发送 HTTP 请求
http_post() {
    echo ""
    echo "▶ $2"
    response=$(curl -s -X POST "$1" \
        -H "Content-Type: application/json" \
        -d "$3")
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
}

http_get() {
    echo ""
    echo "▶ $2"
    response=$(curl -s "$1")
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
}

# 主测试流程
main() {
    wait_for_service

    echo ""
    echo "========== 1. 成功流测试 =========="
    
    # 创建命令
    http_post "$BASE_URL/create" "创建命令" '{
        "batchNo": "'"$BATCH_NO"'",
        "commandCode": "REBOOT",
        "commandName": "重启设备",
        "deviceId": 1,
        "deviceCode": "DEV001",
        "channelId": 1,
        "channelCode": "MQTT001",
        "timeoutSeconds": 300,
        "maxRetryCount": 3,
        "handler": "test_user"
    }'

    # 校验命令
    http_post "$BASE_URL/validate/$BATCH_NO?handler=test_user" "校验命令" ""

    # 下发命令
    http_post "$BASE_URL/dispatch/$BATCH_NO?handler=test_user" "下发命令" ""

    # 确认成功
    http_post "$BASE_URL/confirm" "确认执行成功" '{
        "batchNo": "'"$BATCH_NO"'",
        "confirmResult": "SUCCESS",
        "resultCode": "0000",
        "resultMessage": "设备重启成功",
        "confirmSource": "DEVICE_REPORT",
        "handler": "system"
    }'

    # 查询完整链路
    http_get "$BASE_URL/$BATCH_NO/full-trace" "查询完整链路"

    echo ""
    echo "========== 2. 失败流测试 =========="
    BATCH_NO2="TEST-FAILED-$(date +%Y%m%d%H%M%S)"
    
    http_post "$BASE_URL/create" "创建失败流命令" '{
        "batchNo": "'"$BATCH_NO2"'",
        "commandCode": "UPGRADE",
        "commandName": "固件升级",
        "deviceId": 1,
        "deviceCode": "DEV001",
        "timeoutSeconds": 300,
        "maxRetryCount": 3,
        "handler": "test_user"
    }'

    http_post "$BASE_URL/validate/$BATCH_NO2?handler=test_user" "校验命令" ""
    http_post "$BASE_URL/dispatch/$BATCH_NO2?handler=test_user" "下发命令" ""
    
    http_post "$BASE_URL/confirm" "确认执行失败" '{
        "batchNo": "'"$BATCH_NO2"'",
        "confirmResult": "FAILED",
        "resultCode": "E001",
        "resultMessage": "固件校验失败",
        "confirmSource": "DEVICE_REPORT",
        "handler": "system"
    }'

    http_get "$BASE_URL/$BATCH_NO2/full-trace" "查询失败流完整链路"

    echo ""
    echo "========== 3. 幂等性测试 =========="
    http_post "$BASE_URL/create" "重复创建相同批次号" '{
        "batchNo": "'"$BATCH_NO"'",
        "commandCode": "REBOOT",
        "deviceId": 1,
        "deviceCode": "DEV001",
        "handler": "test_user"
    }'

    echo ""
    echo "========== 4. 按设备查询 =========="
    http_get "$BASE_URL/device/DEV001" "查询设备 DEV001 的所有命令"

    echo ""
    echo "========================================"
    echo "测试完成!"
    echo "数据已持久化到 ./data 目录"
    echo "重启服务后可通过 /$BATCH_NO/full-trace 验证数据持久化"
    echo "========================================"
}

main
