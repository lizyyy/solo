#!/bin/bash

BASE_URL="http://localhost:8000/api/v1"

echo "========================================"
echo "  模型发布审批系统 - 完整流程演示"
echo "========================================"
echo ""

echo "检查服务是否启动..."
if ! curl -s "$BASE_URL/summary" > /dev/null; then
    echo "❌ 服务未启动！请先运行：uvicorn main:app --reload --port 8000"
    exit 1
fi
echo "✅ 服务正常"
echo ""

echo "========================================"
echo "步骤 1: 创建模型版本"
echo "========================================"
CREATE_RESP=$(curl -s -X POST "$BASE_URL/models" \
  -H "Content-Type: application/json" \
  -d '{
    "model_name": "推荐算法模型",
    "version": "v1.2.3",
    "description": "优化了用户冷启动策略"
  }')

echo "API 响应："
echo "$CREATE_RESP"
echo ""

MODEL_ID=$(echo "$CREATE_RESP" | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
echo "模型 ID: $MODEL_ID"
echo ""

echo "========================================"
echo "步骤 2: 提交评测结果"
echo "========================================"
EVAL_RESP=$(curl -s -X POST "$BASE_URL/models/$MODEL_ID/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "evaluator": "张三",
    "accuracy_score": "96.5%",
    "performance_score": "92ms",
    "stability_score": "优秀",
    "overall_result": "通过",
    "findings": "冷启动场景下表现提升明显"
  }')

echo "API 响应："
echo "$EVAL_RESP"
echo ""

echo "========================================"
echo "步骤 3: 灰度审批"
echo "========================================"
GRAY_APPROVE_RESP=$(curl -s -X POST "$BASE_URL/models/$MODEL_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "李四",
    "approval_type": "灰度审批",
    "decision": "通过",
    "comments": "评测数据完备，同意进入灰度"
  }')

echo "API 响应："
echo "$GRAY_APPROVE_RESP"
echo ""

echo "========================================"
echo "步骤 4: 调整灰度流量"
echo "========================================"
TRAFFIC_RESP=$(curl -s -X POST "$BASE_URL/models/$MODEL_ID/traffic" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "王五",
    "traffic_weight": 30,
    "reason": "灰度第一天，先切30%流量观察"
  }')

echo "API 响应："
echo "$TRAFFIC_RESP"
echo ""

echo "========================================"
echo "步骤 5: 查看模型详情"
echo "========================================"
DETAIL_RESP=$(curl -s "$BASE_URL/models/$MODEL_ID")
echo "当前状态："
echo "$DETAIL_RESP" | python3 -c "
import json,sys
d = json.load(sys.stdin)
print(f'模型: {d[\"basic_info\"][\"model_name\"]} {d[\"basic_info\"][\"version\"]}')
print(f'状态: {d[\"basic_info\"][\"current_status\"]}')
print(f'流量: {d[\"basic_info\"][\"traffic_weight\"]}%')
print(f'下一步: {d[\"next_step\"]}')
"
echo ""

echo "========================================"
echo "步骤 6: 正式发布审批"
echo "========================================"
PROD_APPROVE_RESP=$(curl -s -X POST "$BASE_URL/models/$MODEL_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "赵六",
    "approval_type": "正式发布审批",
    "decision": "通过",
    "comments": "灰度3天数据稳定，同意正式上线"
  }')

echo "API 响应："
echo "$PROD_APPROVE_RESP"
echo ""

echo "========================================"
echo "步骤 7: 流量全量"
echo "========================================"
FULL_TRAFFIC_RESP=$(curl -s -X POST "$BASE_URL/models/$MODEL_ID/traffic" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "王五",
    "traffic_weight": 100,
    "reason": "正式发布，流量全量"
  }')

echo "API 响应："
echo "$FULL_TRAFFIC_RESP"
echo ""

echo "========================================"
echo "步骤 8: 查看最终状态"
echo "========================================"
FINAL_DETAIL=$(curl -s "$BASE_URL/models/$MODEL_ID")
echo "最终状态："
echo "$FINAL_DETAIL" | python3 -c "
import json,sys
d = json.load(sys.stdin)
print(f'模型: {d[\"basic_info\"][\"model_name\"]} {d[\"basic_info\"][\"version\"]}')
print(f'状态: {d[\"basic_info\"][\"current_status\"]}')
print(f'流量: {d[\"basic_info\"][\"traffic_weight\"]}%')
print(f'是否生产: {d[\"basic_info\"][\"is_production\"]}')
print(f'下一步: {d[\"next_step\"]}')
"
echo ""

echo "========================================"
echo "步骤 9: 查看系统总览"
echo "========================================"
SUMMARY=$(curl -s "$BASE_URL/summary")
echo "系统总览："
echo "$SUMMARY" | python3 -c "
import json,sys
d = json.load(sys.stdin)
print(f'总版本数: {d[\"total_models\"]}')
print(f'待评测: {d[\"pending_evaluation\"]}')
print(f'审批中: {d[\"pending_approval\"]}')
print(f'灰度中: {d[\"in_grayscale\"]}')
print(f'已上线: {d[\"in_production\"]}')
print(f'已回滚: {d[\"rolled_back\"]}')
"
echo ""

echo "========================================"
echo "步骤 10: 测试重复调用处理"
echo "========================================"
echo "尝试再次创建相同的模型版本..."
DUP_CREATE=$(curl -s -X POST "$BASE_URL/models" \
  -H "Content-Type: application/json" \
  -d '{
    "model_name": "推荐算法模型",
    "version": "v1.2.3",
    "description": "重复创建"
  }')
echo "重复创建响应："
echo "$DUP_CREATE"
echo ""

echo "尝试再次审批已上线的模型..."
DUP_APPROVE=$(curl -s -X POST "$BASE_URL/models/$MODEL_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "测试",
    "approval_type": "正式发布审批",
    "decision": "通过"
  }')
echo "重复审批响应："
echo "$DUP_APPROVE"
echo ""

echo "尝试设置相同的流量比例..."
DUP_TRAFFIC=$(curl -s -X POST "$BASE_URL/models/$MODEL_ID/traffic" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "测试",
    "traffic_weight": 100,
    "reason": "测试重复"
  }')
echo "重复调流量响应："
echo "$DUP_TRAFFIC"
echo ""

echo "========================================"
echo "演示完成！"
echo "========================================"
echo ""
echo "你可以访问以下地址查看："
echo "  - Web 界面: http://localhost:8000/"
echo "  - API 文档: http://localhost:8000/docs"
echo ""
echo "测试回滚功能（可选）："
echo "curl -X POST $BASE_URL/models/$MODEL_ID/rollback \\"
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{"operator": "测试人员", "reason": "模拟线上问题回滚"}'"'"''
echo ""
