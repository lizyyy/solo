#!/bin/bash

echo "=========================================="
echo "接口路径一致性验证"
echo "=========================================="
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXPECTED_PREFIX="/api/evidence"

echo "✓ 预期 API 路径前缀: $EXPECTED_PREFIX"
echo ""

# 检查 Controller
echo "1. 检查 Controller 映射..."
CONTROLLER_PATH=$(grep "@RequestMapping" "$PROJECT_DIR/src/main/java/com/evidence/controller/EvidenceChainController.java" | grep -o '".*"' | tr -d '"')
if [ "$CONTROLLER_PATH" = "$EXPECTED_PREFIX" ]; then
    echo "   ✓ Controller 映射正确: $CONTROLLER_PATH"
else
    echo "   ✗ Controller 映射不正确: $CONTROLLER_PATH (期望: $EXPECTED_PREFIX)"
fi
echo ""

# 检查 test-api.sh
echo "2. 检查测试脚本路径..."
TEST_BASE_URL=$(grep "^BASE_URL=" "$PROJECT_DIR/test-api.sh" | cut -d '=' -f 2)
if echo "$TEST_BASE_URL" | grep -q "$EXPECTED_PREFIX"; then
    echo "   ✓ test-api.sh BASE_URL 正确: $TEST_BASE_URL"
else
    echo "   ✗ test-api.sh BASE_URL 不正确: $TEST_BASE_URL"
fi
echo ""

# 检查 README.md 中的 curl 命令
echo "3. 检查 README.md 中的 API 路径..."
README_PATHS=$(grep -o "http://localhost:8080/api/evidence[^\" ]*" "$PROJECT_DIR/README.md" | head -5)
if [ -n "$README_PATHS" ]; then
    echo "   ✓ README.md API 路径正确:"
    echo "$README_PATHS" | sed 's/^/     • /'
else
    echo "   ! 未在 README.md 中找到 API 路径"
fi
echo ""

# 检查 start.sh 提示
echo "4. 检查 start.sh 提示信息..."
if grep -q "http://localhost:8080/swagger-ui.html" "$PROJECT_DIR/start.sh"; then
    echo "   ✓ start.sh Swagger URL 正确"
else
    echo "   ! start.sh Swagger URL 未找到"
fi
echo ""

echo "=========================================="
echo "验证完成！"
echo "=========================================="
echo ""
echo "所有 API 路径汇总:"
echo "  • Controller: @RequestMapping(\"$EXPECTED_PREFIX\")"
echo "  • 查询: GET $EXPECTED_PREFIX/{requestId}"
echo "  • 创建: POST $EXPECTED_PREFIX/create"
echo "  • 添加动作: POST $EXPECTED_PREFIX/action"
echo "  • 更新状态: POST $EXPECTED_PREFIX/status"
echo "  • 添加备注: POST $EXPECTED_PREFIX/remark"
echo "  • 业务单号查询: GET $EXPECTED_PREFIX/business/{businessNo}"
echo "  • 条件查询: GET $EXPECTED_PREFIX/query?..."
echo "  • 导出摘要: GET $EXPECTED_PREFIX/summary/{requestId}"
echo "  • 验证存在: GET $EXPECTED_PREFIX/validate/{requestId}"
