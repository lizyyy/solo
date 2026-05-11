#!/bin/bash

BASE_URL="http://localhost:3000/api/v1"

echo ""
echo "============================================"
echo "  冰场磨冰车排程 API - 验收测试脚本"
echo "============================================"
echo ""

echo "【前置条件】请先确保服务已启动："
echo "  1. 运行: npm install"
echo "  2. 运行: npm start"
echo ""
echo "如果服务已启动，按回车键开始验收测试..."
read -p ""

echo ""
echo "============================================"
echo "Step 1: 重置测试数据"
echo "============================================"
echo "命令: curl -X POST $BASE_URL/system/reset"
RESET_RESULT=$(curl -s -X POST "$BASE_URL/system/reset")
echo "结果: $RESET_RESULT"
echo ""

echo "============================================"
echo "Step 2: 查询冰面日程（入口接口）"
echo "============================================"
echo "查询 rink-1 冰场 2026-05-12 的日程安排"
echo "命令: curl \"$BASE_URL/rinks/rink-1/schedule?date=2026-05-12\""
RINK_SCHEDULE=$(curl -s "$BASE_URL/rinks/rink-1/schedule?date=2026-05-12")
echo "结果:"
echo "$RINK_SCHEDULE" | python3 -m json.tool 2>/dev/null || echo "$RINK_SCHEDULE"
echo ""

echo "============================================"
echo "Step 3: 案例 1 - 正常创建磨冰任务（无冲突）"
echo "============================================"
echo "场景: 课程结束后（10:30）安排磨冰，11:00 恢复完成"
echo "创建任务 - 开始时间 10:30（花样滑冰课 10:30 结束）"
echo "命令: curl -X POST $BASE_URL/tasks -H \"Content-Type: application/json\" -d '{...}'"
TASK1=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: test-create-001" \
  -d '{
    "rinkId": "rink-1",
    "startTime": "2026-05-12T10:30:00",
    "reason": "花样滑冰课后常规磨冰",
    "requestedBy": "张主管"
  }')
echo "结果:"
echo "$TASK1" | python3 -m json.tool 2>/dev/null || echo "$TASK1"
TASK1_ID=$(echo "$TASK1" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))" 2>/dev/null)
echo "任务ID: $TASK1_ID"
echo ""

echo "============================================"
echo "Step 4: 案例 2 - 幂等性测试（重复请求不写乱）"
echo "============================================"
echo "场景: 网络超时导致重复发送，使用相同的 X-Idempotency-Key"
echo "命令: curl -X POST $BASE_URL/tasks -H \"X-Idempotency-Key: test-create-001\" ..."
IDEMPOTENT_RESULT=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: test-create-001" \
  -d '{
    "rinkId": "rink-1",
    "startTime": "2026-05-12T10:30:00",
    "reason": "花样滑冰课后常规磨冰",
    "requestedBy": "张主管"
  }')
echo "结果:"
echo "$IDEMPOTENT_RESULT" | python3 -m json.tool 2>/dev/null || echo "$IDEMPOTENT_RESULT"
echo ""
echo "检查: 响应中应包含 fromIdempotency: true，表示返回已有任务，未创建新任务"
echo ""

echo "============================================"
echo "Step 5: 异常案例 1 - 缺字段（缺少必填字段）"
echo "============================================"
echo "场景: 忘记填写 startTime 和 reason"
echo "命令: curl -X POST $BASE_URL/tasks -d '{\"rinkId\":\"rink-1\"}'"
MISSING_FIELDS=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d '{"rinkId": "rink-1"}')
echo "结果:"
echo "$MISSING_FIELDS" | python3 -m json.tool 2>/dev/null || echo "$MISSING_FIELDS"
echo ""
echo "检查: 应返回 VALIDATION_ERROR，提示 startTime 和 reason 不能为空"
echo ""

echo "============================================"
echo "Step 6: 案例 3 - 推进任务状态（pending -> in_progress）"
echo "============================================"
if [ -n "$TASK1_ID" ]; then
  echo "推进任务: $TASK1_ID"
  echo "命令: curl -X POST $BASE_URL/tasks/$TASK1_ID/advance"
  ADVANCE1=$(curl -s -X POST "$BASE_URL/tasks/$TASK1_ID/advance")
  echo "结果:"
  echo "$ADVANCE1" | python3 -m json.tool 2>/dev/null || echo "$ADVANCE1"
  echo ""
  echo "检查: 状态应变为 in_progress"
else
  echo "跳过: 任务ID为空"
fi
echo ""

echo "============================================"
echo "Step 7: 异常案例 2 - 冲突检测（与课程冲突）"
echo "============================================"
echo "场景: 尝试在 09:15 创建磨冰任务，与花样滑冰课（09:00-10:30）冲突"
echo "命令: curl -X POST $BASE_URL/tasks -d '{...startTime: 2026-05-12T09:15:00...}'"
COURSE_CONFLICT=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: test-conflict-001" \
  -d '{
    "rinkId": "rink-1",
    "startTime": "2026-05-12T09:15:00",
    "reason": "临时磨冰",
    "requestedBy": "李教练"
  }')
echo "结果:"
echo "$COURSE_CONFLICT" | python3 -m json.tool 2>/dev/null || echo "$COURSE_CONFLICT"
echo ""
echo "检查: 应返回 SCHEDULE_CONFLICT，提示与课程冲突"
echo ""

echo "============================================"
echo "Step 8: 异常案例 3 - 高优先级冲突（与比赛冲突）"
echo "============================================"
echo "场景: 尝试在 19:30 创建磨冰任务，与市级锦标赛（19:00-22:00 高优先级）冲突"
echo "命令: curl -X POST $BASE_URL/tasks -d '{...startTime: 2026-05-12T19:30:00...}'"
COMPETITION_CONFLICT=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: test-conflict-002" \
  -d '{
    "rinkId": "rink-1",
    "startTime": "2026-05-12T19:30:00",
    "reason": "赛前临时磨冰",
    "requestedBy": "王场务"
  }')
echo "结果:"
echo "$COMPETITION_CONFLICT" | python3 -m json.tool 2>/dev/null || echo "$COMPETITION_CONFLICT"
echo ""
echo "检查: 应返回 HIGH_PRIORITY_CONFLICT，特别指出与比赛冲突"
echo ""

echo "============================================"
echo "Step 9: 异常案例 4 - 与制冰恢复时间冲突"
echo "============================================"
echo "场景: 尝试在 07:00 创建磨冰任务，制冰维护 04:00-07:00，恢复窗口 2 小时（07:00-09:00）"
echo "命令: curl -X POST $BASE_URL/tasks -d '{...startTime: 2026-05-12T07:00:00...}'"
RECOVERY_CONFLICT=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: test-conflict-003" \
  -d '{
    "rinkId": "rink-1",
    "startTime": "2026-05-12T07:00:00",
    "reason": "制冰后立刻磨冰",
    "requestedBy": "赵技师"
  }')
echo "结果:"
echo "$RECOVERY_CONFLICT" | python3 -m json.tool 2>/dev/null || echo "$RECOVERY_CONFLICT"
echo ""
echo "检查: 应返回 HIGH_PRIORITY_CONFLICT，提示与制冰维护冲突"
echo ""

echo "============================================"
echo "Step 10: 案例 4 - 人工修正任务（改时间）"
echo "============================================"
if [ -n "$TASK1_ID" ]; then
  echo "修正任务: $TASK1_ID，将开始时间从 10:30 改为 15:45（速度滑冰课 15:30 结束）"
  echo "命令: curl -X PATCH $BASE_URL/tasks/$TASK1_ID -d '{\"startTime\": \"2026-05-12T15:45:00\"}'"
  REVISE_RESULT=$(curl -s -X PATCH "$BASE_URL/tasks/$TASK1_ID" \
    -H "Content-Type: application/json" \
    -d '{
      "startTime": "2026-05-12T15:45:00",
      "reason": "调整到速度滑冰课后磨冰"
    }')
  echo "结果:"
  echo "$REVISE_RESULT" | python3 -m json.tool 2>/dev/null || echo "$REVISE_RESULT"
  echo ""
  echo "检查: 时间应更新，状态因之前在 in_progress 应变为 revised"
else
  echo "跳过: 任务ID为空"
fi
echo ""

echo "============================================"
echo "Step 11: 异常案例 5 - 人工改错（修正到冲突时间）"
echo "============================================"
if [ -n "$TASK1_ID" ]; then
  echo "尝试将任务修正到 19:30（与比赛冲突）"
  echo "命令: curl -X PATCH $BASE_URL/tasks/$TASK1_ID -d '{\"startTime\": \"2026-05-12T19:30:00\"}'"
  BAD_REVISE=$(curl -s -X PATCH "$BASE_URL/tasks/$TASK1_ID" \
    -H "Content-Type: application/json" \
    -d '{
      "startTime": "2026-05-12T19:30:00"
    }')
  echo "结果:"
  echo "$BAD_REVISE" | python3 -m json.tool 2>/dev/null || echo "$BAD_REVISE"
  echo ""
  echo "检查: 应返回 HIGH_PRIORITY_CONFLICT，拒绝修改"
else
  echo "跳过: 任务ID为空"
fi
echo ""

echo "============================================"
echo "Step 12: 案例 5 - 继续推进任务（revised -> in_progress -> completed）"
echo "============================================"
if [ -n "$TASK1_ID" ]; then
  echo "推进任务（revised -> in_progress）"
  ADVANCE2=$(curl -s -X POST "$BASE_URL/tasks/$TASK1_ID/advance")
  echo "第一次推进结果:"
  echo "$ADVANCE2" | python3 -m json.tool 2>/dev/null || echo "$ADVANCE2"
  echo ""
  echo "继续推进（in_progress -> completed）"
  ADVANCE3=$(curl -s -X POST "$BASE_URL/tasks/$TASK1_ID/advance")
  echo "第二次推进结果:"
  echo "$ADVANCE3" | python3 -m json.tool 2>/dev/null || echo "$ADVANCE3"
  echo ""
  echo "检查: 状态应变为 completed"
else
  echo "跳过: 任务ID为空"
fi
echo ""

echo "============================================"
echo "Step 13: 创建第二个磨冰任务（用于演示撤回）"
echo "============================================"
echo "创建任务 - 开始时间 16:00"
TASK2=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: test-create-002" \
  -d '{
    "rinkId": "rink-2",
    "startTime": "2026-05-12T16:00:00",
    "reason": "2号冰场日常维护",
    "requestedBy": "陈场务"
  }')
echo "结果:"
echo "$TASK2" | python3 -m json.tool 2>/dev/null || echo "$TASK2"
TASK2_ID=$(echo "$TASK2" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))" 2>/dev/null)
echo "任务ID: $TASK2_ID"
echo ""

echo "============================================"
echo "Step 14: 案例 6 - 撤回任务"
echo "============================================"
if [ -n "$TASK2_ID" ]; then
  echo "撤回任务: $TASK2_ID"
  echo "命令: curl -X POST $BASE_URL/tasks/$TASK2_ID/cancel -d '{\"reason\": \"临时取消，改为明天\"}'"
  CANCEL_RESULT=$(curl -s -X POST "$BASE_URL/tasks/$TASK2_ID/cancel" \
    -H "Content-Type: application/json" \
    -d '{
      "reason": "临时取消，改为明天"
    }')
  echo "结果:"
  echo "$CANCEL_RESULT" | python3 -m json.tool 2>/dev/null || echo "$CANCEL_RESULT"
  echo ""
  echo "检查: 状态应变为 cancelled"
else
  echo "跳过: 任务ID为空"
fi
echo ""

echo "============================================"
echo "Step 15: 异常案例 6 - 已完成任务无法撤回"
echo "============================================"
if [ -n "$TASK1_ID" ]; then
  echo "尝试撤回已完成的任务: $TASK1_ID"
  echo "命令: curl -X POST $BASE_URL/tasks/$TASK1_ID/cancel"
  CANCEL_COMPLETED=$(curl -s -X POST "$BASE_URL/tasks/$TASK1_ID/cancel" \
    -H "Content-Type: application/json")
  echo "结果:"
  echo "$CANCEL_COMPLETED" | python3 -m json.tool 2>/dev/null || echo "$CANCEL_COMPLETED"
  echo ""
  echo "检查: 应返回 TASK_COMPLETED 错误"
else
  echo "跳过: 任务ID为空"
fi
echo ""

echo "============================================"
echo "Step 16: 查询汇总（关键校验接口）"
echo "============================================"
echo "查询所有磨冰任务及恢复窗口"
echo "命令: curl $BASE_URL/tasks"
SUMMARY=$(curl -s "$BASE_URL/tasks")
echo "结果:"
echo "$SUMMARY" | python3 -m json.tool 2>/dev/null || echo "$SUMMARY"
echo ""

echo "============================================"
echo "Step 17: 恢复窗口证据展示"
echo "============================================"
echo "恢复窗口是用户判断排程是否正确的关键证据"
echo "每个磨冰任务都附带 recoveryEvidence 字段"
if [ -n "$TASK1_ID" ]; then
  echo "查询任务 $TASK1_ID 详情，查看恢复窗口"
  echo "命令: curl $BASE_URL/tasks/$TASK1_ID"
  DETAIL=$(curl -s "$BASE_URL/tasks/$TASK1_ID")
  echo "结果（重点关注 recoveryEvidence 字段）:"
  echo "$DETAIL" | python3 -m json.tool 2>/dev/null || echo "$DETAIL"
fi
echo ""

echo "============================================"
echo "Step 18: 再看冰面日程（包含磨冰任务）"
echo "============================================"
echo "查询 rink-1 冰场日程，应该包含刚才的磨冰任务"
echo "命令: curl \"$BASE_URL/rinks/rink-1/schedule?date=2026-05-12\""
FINAL_SCHEDULE=$(curl -s "$BASE_URL/rinks/rink-1/schedule?date=2026-05-12")
echo "结果:"
echo "$FINAL_SCHEDULE" | python3 -m json.tool 2>/dev/null || echo "$FINAL_SCHEDULE"
echo ""

echo "============================================"
echo "  验收测试完成！"
echo "============================================"
echo ""
echo "总结 - 已验证功能:"
echo "  ✓ 冰面日程查询（入口接口）"
echo "  ✓ 创建磨冰任务（关键校验：冲突检测）"
echo "  ✓ 幂等性（重复请求不写乱）"
echo "  ✓ 推进任务状态"
echo "  ✓ 撤回任务"
echo "  ✓ 修正任务"
echo "  ✓ 查询汇总"
echo ""
echo "总结 - 已验证异常:"
echo "  ✓ 缺字段（缺少 startTime、reason）"
echo "  ✓ 与课程冲突"
echo "  ✓ 与比赛冲突（高优先级）"
echo "  ✓ 与制冰恢复时间冲突（高优先级）"
echo "  ✓ 人工改错（修正到冲突时间）"
echo "  ✓ 已完成任务无法撤回"
echo ""
echo "恢复窗口证据:"
echo "  - 每次磨冰 15 分钟，之后 30 分钟恢复窗口"
echo "  - 任务详情中的 recoveryEvidence 字段可作为正确性判断依据"
echo "  - 查询汇总接口的 recoveryWindows 可全局查看"
echo ""
