#!/bin/bash

echo "====================================="
echo "  简化版HTTP API服务"
echo "====================================="
echo ""
echo "使用bash + nc实现，无需Java编译"
echo ""

PORT=8080
PID_FILE="/tmp/simple-api-server.pid"

# 存储操作数据
declare -A OPERATIONS
declare -A OP_CONFIRMERS  # 记录每个操作的确认人列表

REQUIRED_CONFIRMERS=2

json_response() {
    local code="$1"
    local data="$2"
    echo "HTTP/1.1 $code OK"
    echo "Content-Type: application/json; charset=utf-8"
    echo ""
    echo "{\"code\":$code,\"message\":\"success\",\"data\":$data}"
}

error_response() {
    local code="$1"
    local message="$2"
    echo "HTTP/1.1 $code Error"
    echo "Content-Type: application/json; charset=utf-8"
    echo ""
    echo "{\"code\":$code,\"message\":\"$message\"}"
}

get_current_time() {
    date +"%Y-%m-%dT%H:%M:%S"
}

generate_token() {
    echo "TOKEN-$(cat /dev/urandom | tr -dc 'A-Z0-9' | head -c 8)"
}

operation_to_json() {
    local id="$1"
    local op_data="${OPERATIONS[$id]}"
    
    IFS='|' read -r opType reqId reqName risk status expTime token execTime <<< "$op_data"
    
    # 构建确认记录
    local confirmers="${OP_CONFIRMERS[$id]}"
    local confirmations="[]"
    if [ -n "$confirmers" ]; then
        confirmations="["
        local first=true
        IFS=',' read -ra CONF_LIST <<< "$confirmers"
        for conf in "${CONF_LIST[@]}"; do
            [ "$first" = false ] && confirmations="$confirmations,"
            IFS=':' read -r cid cname ctime ccomment <<< "$conf"
            confirmations="$confirmations{\"confirmerId\":\"$cid\",\"confirmerName\":\"$cname\",\"confirmedAt\":\"$ctime\"}"
            first=false
        done
        confirmations="$confirmations]"
    fi
    
    local token_field=""
    [ -n "$token" ] && token_field="\"executionToken\":\"$token\","
    
    local exec_field=""
    [ -n "$execTime" ] && exec_field="\"executedAt\":\"$execTime\","
    
    echo "{\"id\":\"$id\",\"operationType\":\"$opType\",\"requesterId\":\"$reqId\",\"requesterName\":\"$reqName\",\"riskLevel\":\"$risk\",\"status\":\"$status\",\"operationData\":\"\",\"expireTime\":\"$expTime\",\"createdAt\":\"$(get_current_time)\",$token_field $exec_field \"confirmations\":$confirmations}"
}

handle_request() {
    local method="$1"
    local path="$2"
    local body="$3"
    
    # 根路径
    if [ "$path" = "/" ] || [ "$path" = "" ]; then
        echo "HTTP/1.1 200 OK"
        echo "Content-Type: text/html; charset=utf-8"
        echo ""
        echo "<html><body><h1>敏感操作双人确认API</h1><p>服务运行正常（简化版）</p>"
        echo "<h3>可用端点:</h3><ul><li>POST /api/operations</li><li>GET /api/operations/{id}</li><li>POST /api/operations/{id}/confirm</li><li>POST /api/operations/{id}/execute</li></ul></body></html>"
        return
    fi
    
    # 创建操作
    if [ "$method" = "POST" ] && [ "$path" = "/api/operations" ]; then
        local requestId=$(echo "$body" | grep -o '"requestId"[^}]*' | cut -d'"' -f4)
        local operationType=$(echo "$body" | grep -o '"operationType"[^}]*' | cut -d'"' -f4)
        local requesterId=$(echo "$body" | grep -o '"requesterId"[^}]*' | cut -d'"' -f4)
        local requesterName=$(echo "$body" | grep -o '"requesterName"[^}]*' | cut -d'"' -f4)
        local riskLevel=$(echo "$body" | grep -o '"riskLevel"[^}]*' | cut -d'"' -f4)
        
        # 幂等检查
        if [ -n "${OPERATIONS[$requestId]}" ]; then
            local op_json=$(operation_to_json "$requestId")
            json_response 200 "$op_json"
            return
        fi
        
        local status="PENDING"
        [ "$riskLevel" = "HIGH" ] && status="CONFIRMING"
        
        local expTime=$(date -v +1H +"%Y-%m-%dT%H:%M:%S" 2>/dev/null || date +"%Y-%m-%dT%H:%M:%S")
        
        OPERATIONS[$requestId]="$operationType|$requesterId|$requesterName|$riskLevel|$status|$expTime||"
        OP_CONFIRMERS[$requestId]=""
        
        echo "✅ 创建操作: $requestId 风险: $riskLevel 状态: $status" >&2
        
        local op_json=$(operation_to_json "$requestId")
        json_response 200 "$op_json"
        return
    fi
    
    # 查询单个操作
    if [ "$method" = "GET" ] && [[ "$path" =~ ^/api/operations/[^/]+$ ]]; then
        local opId="${path##*/}"
        if [ -z "${OPERATIONS[$opId]}" ]; then
            error_response 404 "操作不存在: $opId"
            return
        fi
        local op_json=$(operation_to_json "$opId")
        json_response 200 "$op_json"
        return
    fi
    
    # 确认操作
    if [ "$method" = "POST" ] && [[ "$path" =~ ^/api/operations/[^/]+/confirm$ ]]; then
        local opId=$(echo "$path" | cut -d'/' -f4)
        if [ -z "${OPERATIONS[$opId]}" ]; then
            error_response 404 "操作不存在: $opId"
            return
        fi
        
        local confirmerId=$(echo "$body" | grep -o '"confirmerId"[^}]*' | cut -d'"' -f4)
        local confirmerName=$(echo "$body" | grep -o '"confirmerName"[^}]*' | cut -d'"' -f4)
        
        IFS='|' read -r opType reqId reqName risk status expTime token execTime <<< "${OPERATIONS[$opId]}"
        
        # 安全检查：申请人不能确认自己的操作
        if [ "$reqId" = "$confirmerId" ]; then
            error_response 400 "申请人不能确认自己的操作"
            return
        fi
        
        # 幂等检查
        local existing_confirmers="${OP_CONFIRMERS[$opId]}"
        if [[ "$existing_confirmers" == *"$confirmerId:"* ]]; then
            local op_json=$(operation_to_json "$opId")
            json_response 200 "$op_json"
            return
        fi
        
        # 添加确认记录
        local confirm_time=$(get_current_time)
        if [ -z "$existing_confirmers" ]; then
            OP_CONFIRMERS[$opId]="$confirmerId:$confirmerName:$confirm_time:"
        else
            OP_CONFIRMERS[$opId]="$existing_confirmers,$confirmerId:$confirmerName:$confirm_time:"
        fi
        
        # 计数确认人数
        local conf_count=$(echo "${OP_CONFIRMERS[$opId]}" | tr ',' '\n' | grep -c .)
        
        # 检查是否满足确认人数要求
        local required=1
        [ "$risk" = "HIGH" ] && required=$REQUIRED_CONFIRMERS
        
        local new_status="$status"
        local new_token="$token"
        if [ "$conf_count" -ge "$required" ] && [ "$status" != "CONFIRMED" ]; then
            new_status="CONFIRMED"
            new_token=$(generate_token)
            echo "✅ 操作确认完成，生成执行凭证: $new_token" >&2
            OPERATIONS[$opId]="$opType|$reqId|$reqName|$risk|$new_status|$expTime|$new_token|$execTime"
        fi
        
        echo "✅ 确认操作: $opId 确认人: $confirmerName 确认人数: $conf_count/$required" >&2
        
        local op_json=$(operation_to_json "$opId")
        json_response 200 "$op_json"
        return
    fi
    
    # 执行操作
    if [ "$method" = "POST" ] && [[ "$path" =~ ^/api/operations/[^/]+/execute ]]; then
        local opId=$(echo "$path" | cut -d'/' -f4)
        if [ -z "${OPERATIONS[$opId]}" ]; then
            error_response 404 "操作不存在: $opId"
            return
        fi
        
        # 提取token
        local token=$(echo "$path" | grep -o 'token=[^&]*' | cut -d'=' -f2)
        
        IFS='|' read -r opType reqId reqName risk status expTime storedToken execTime <<< "${OPERATIONS[$opId]}"
        
        if [ "$status" != "CONFIRMED" ]; then
            error_response 400 "只有已确认的操作才能执行"
            return
        fi
        
        if [ -z "$storedToken" ] || [ "$storedToken" != "$token" ]; then
            error_response 401 "执行凭证无效"
            return
        fi
        
        # 执行成功
        OPERATIONS[$opId]="$opType|$reqId|$reqName|$risk|EXECUTED|$expTime||$(get_current_time)"
        echo "✅ 操作执行成功: $opId" >&2
        
        local op_json=$(operation_to_json "$opId")
        json_response 200 "$op_json"
        return
    fi
    
    # 导出JSON
    if [ "$method" = "GET" ] && [ "$path" = "/api/operations/export/json" ]; then
        local data="["
        local first=true
        for id in "${!OPERATIONS[@]}"; do
            [ "$first" = false ] && data="$data,"
            data="$data$(operation_to_json "$id")"
            first=false
        done
        data="$data]"
        
        echo "HTTP/1.1 200 OK"
        echo "Content-Type: application/json; charset=utf-8"
        echo "Content-Disposition: attachment; filename=\"operations.json\""
        echo ""
        echo "$data"
        return
    fi
    
    # 导出CSV
    if [ "$method" = "GET" ] && [ "$path" = "/api/operations/export/csv" ]; then
        local csv="操作ID,操作类型,申请人ID,申请人姓名,风险等级,状态,确认人数\n"
        for id in "${!OPERATIONS[@]}"; do
            IFS='|' read -r opType reqId reqName risk status expTime token execTime <<< "${OPERATIONS[$id]}"
            local conf_count=$(echo "${OP_CONFIRMERS[$id]}" | tr ',' '\n' | grep -c .)
            csv="$csv$id,$opType,$reqId,$reqName,$risk,$status,$conf_count\n"
        done
        
        echo "HTTP/1.1 200 OK"
        echo "Content-Type: text/csv; charset=utf-8"
        echo "Content-Disposition: attachment; filename=\"operations.csv\""
        echo ""
        echo -e "$csv"
        return
    fi
    
    error_response 404 "未找到资源"
}

echo "🔧 启动服务监听端口 $PORT..."
echo "📡 服务地址: http://localhost:$PORT"
echo "✅ 服务已就绪，可以运行 ./verify-api.sh 进行验证"
echo "按 Ctrl+C 停止服务"
echo ""

while true; do
    request=$(nc -l $PORT 2>/dev/null)
    if [ -n "$request" ]; then
        method=$(echo "$request" | head -n 1 | cut -d' ' -f1)
        path=$(echo "$request" | head -n 1 | cut -d' ' -f2)
        body=$(echo "$request" | sed '1,/^\r$/d' | tr -d '\r')
        
        response=$(handle_request "$method" "$path" "$body")
        echo -e "$response" | nc -l $PORT > /dev/null 2>&1 &
    fi
done
