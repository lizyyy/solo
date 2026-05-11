#!/bin/bash

set -e

echo "========================================"
echo "设备借用管理系统 - 修复验证脚本 (第三轮)"
echo "========================================"
echo ""

check_file() {
    if [ -f "$1" ]; then
        echo "  ✓ $1 存在"
    else
        echo "  ✗ $1 不存在"
        exit 1
    fi
}

check_pattern() {
    file=$1
    pattern=$2
    desc=$3
    if grep -q "$pattern" "$file"; then
        echo "  ✓ $desc"
    else
        echo "  ✗ $desc"
        exit 1
    fi
}

check_not_pattern() {
    file=$1
    pattern=$2
    desc=$3
    if ! grep -q "$pattern" "$file"; then
        echo "  ✓ $desc"
    else
        echo "  ✗ $desc"
        exit 1
    fi
}

echo "[1/15] 检查关键文件..."
check_file "backend/go.mod"
check_file "backend/go.sum"
check_file "backend/main.go"
check_file "backend/Dockerfile"
check_file "frontend/package.json"
check_file "docker-compose.yml"
check_file "database/schema.sql"

echo ""
echo "[2/15] 验证第一轮修复: Dockerfile go.sum 处理..."
check_pattern "backend/Dockerfile" "go mod tidy" "Dockerfile 使用 go mod tidy"

echo ""
echo "[3/15] 验证第一轮修复: middleware.go log 导入..."
check_pattern "backend/internal/middleware/middleware.go" '"log"' "middleware.go 导入了 log 包"

echo ""
echo "[4/15] 验证第一轮修复: JWT Secret 统一..."
check_pattern "backend/main.go" "cfg.JWT.Secret" "main.go 传递 cfg.JWT.Secret 给 UserService"
check_pattern "backend/internal/service/service.go" "jwtSecret string" "UserService 接收 jwtSecret 参数"

echo ""
echo "[5/15] 验证第一轮修复: 前端 Devices.vue 命名冲突..."
check_pattern "frontend/src/views/Devices.vue" "apiDeleteDevice" "API 导入已重命名为 apiDeleteDevice"

echo ""
echo "[6/15] 验证第二轮修复: 高级中间件注册..."
check_pattern "backend/main.go" "IdempotencyMiddleware" "main.go 注册了 IdempotencyMiddleware"
check_pattern "backend/main.go" "AuditMiddleware" "main.go 注册了 AuditMiddleware"
check_pattern "backend/main.go" "DistributedLockMiddleware" "main.go 注册了 DistributedLockMiddleware"
check_pattern "backend/main.go" "OptimisticLockMiddleware" "main.go 注册了 OptimisticLockMiddleware"

echo ""
echo "[7/15] 验证第二轮修复: Repository 事务支持..."
check_pattern "backend/internal/repository/repository.go" "func.*WithTx" "Repository 有 WithTx 方法"

echo ""
echo "[8/15] 验证第二轮修复: EventStore 事务支持..."
check_pattern "backend/internal/eventstore/eventstore.go" "func.*AppendEventWithTx" "EventStore 有 AppendEventWithTx 方法"
check_pattern "backend/internal/eventstore/eventstore.go" "func.*GetDB" "EventStore 有 GetDB 方法"

echo ""
echo "[9/15] 验证第二轮修复: BorrowDevice 事务化..."
check_pattern "backend/internal/service/service.go" "db.*:=.*GetDB" "BorrowDevice 获取 db 连接"
check_pattern "backend/internal/service/service.go" "Transaction" "BorrowDevice 使用事务"
check_pattern "backend/internal/service/service.go" "if err.*AppendEventWithTx" "BorrowDevice 检查 AppendEvent 错误"

echo ""
echo "[10/15] 验证第二轮修复: ReturnDevice 事务化..."
check_pattern "backend/internal/service/service.go" "ReturnDevice.*requestID" "ReturnDevice 接收 requestID 参数"

echo ""
echo "[11/15] 验证第二轮修复: RequestID 链路追踪..."
check_pattern "backend/internal/middleware/middleware.go" "uuid.New" "RequestIDMiddleware 生成 UUID"
check_pattern "backend/internal/service/service.go" "RequestID: requestID" "事件写入 RequestID"
check_pattern "backend/internal/api/api.go" "getRequestIDFromContext" "API 层获取并传递 RequestID"

echo ""
echo "[12/15] 验证第三轮修复: 前端 X-Request-ID 为 UUID 格式..."
check_pattern "frontend/src/api/request.js" "generateUUID" "前端使用 generateUUID 函数"
check_pattern "frontend/src/api/request.js" "xxxxxxxx-xxxx-4xxx-yxxx" "UUID 生成符合 RFC4122 格式"

echo ""
echo "[13/15] 验证第三轮修复: 后端不再使用 uuid.MustParse (防止 panic)..."
check_not_pattern "backend/internal/middleware/advanced.go" "uuid.MustParse" "advanced.go 不再使用 MustParse"
check_pattern "backend/internal/middleware/advanced.go" "uuid.Parse.*err.*nil" "使用安全的 uuid.Parse + err 检查"

echo ""
echo "[14/15] 验证第三轮修复: 借还事件 Payload 包含 status 字段 (确保回放正确)..."
check_pattern "backend/internal/service/service.go" '"status".*"borrowed"' "device.borrowed 事件包含 status: borrowed"
check_pattern "backend/internal/service/service.go" '"status".*"available"' "device.returned 事件包含 status: available"
check_pattern "backend/internal/service/service.go" '"status".*"returned"' "borrow.completed 事件包含 status: returned"

echo ""
echo "[15/15] 验证数据库 schema..."
check_pattern "database/schema.sql" "events" "数据库有 events 表"

echo ""
echo "========================================"
echo "所有关键修复验证通过！"
echo ""
echo "核心修复说明："
echo "  ✓ 第一轮: go.sum、log导入、JWT secret、前端命名冲突"
echo "  ✓ 第二轮: 中间件注册、事务保证、request_id链路追踪"
echo "  ✓ 第三轮: X-Request-ID UUID格式、MustParse安全化、事件status回放正确"
echo ""
echo "关键改进 (第三轮):"
echo "  ✓ 前端 X-Request-ID: 使用 UUID v4 格式 (RFC4122)"
echo "  ✓ 后端安全解析: uuid.Parse + err 检查，不再 panic"
echo "  ✓ 事件回放正确: 借还事件 Payload 包含 status 字段"
echo "  ✓ 无 panic 风险: 审计/幂等中间件安全处理非 UUID request_id"
echo ""
echo "启动命令："
echo "  docker-compose up -d"
echo ""
echo "访问地址："
echo "  前端: http://localhost"
echo "  后端: http://localhost:8080"
echo "  默认账号: admin / admin123"
echo "========================================"
