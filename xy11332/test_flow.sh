#!/bin/bash

BASE_URL="http://localhost:8000"

echo "=== 门诊服务台陪检调度系统 - 主流程测试脚本"
echo "=============================================="
echo ""

echo "1. 健康检查"
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""

echo "2. 创建陪检员数据"
echo "   创建陪检员 A"
curl -s -X POST "$BASE_URL/api/escorts/" \
  -H "Content-Type: application/json" \
  -d '{"name": "张三", "employee_id": "ESC001", "phone": "13800138001", "max_tasks": 3}' | python3 -m json.tool
echo ""

echo "   创建陪检员 B"
curl -s -X POST "$BASE_URL/api/escorts/" \
  -H "Content-Type: application/json" \
  -d '{"name": "李四", "employee_id": "ESC002", "phone": "13800138002", "max_tasks": 2}' | python3 -m json.tool
echo ""

echo "   创建陪检员 C（已停用，用于异常测试）"
curl -s -X POST "$BASE_URL/api/escorts/" \
  -H "Content-Type: application/json" \
  -d '{"name": "王五", "employee_id": "ESC003", "phone": "13800138003", "max_tasks": 3}' | python3 -m json.tool
echo ""

echo "3. 创建患者数据"
echo "   创建普通患者 1"
curl -s -X POST "$BASE_URL/api/patients/" \
  -H "Content-Type: application/json" \
  -d '{"name": "赵小明", "medical_record_no": "MR001", "age": 45, "gender": "男", "department": "内科"}' | python3 -m json.tool
echo ""

echo "   创建急诊患者 2"
curl -s -X POST "$BASE_URL/api/patients/" \
  -H "Content-Type: application/json" \
  -d '{"name": "钱小红", "medical_record_no": "MR002", "age": 32, "gender": "女", "department": "急诊科"}' | python3 -m json.tool
echo ""

echo "   创建紧急患者 3"
curl -s -X POST "$BASE_URL/api/patients/" \
  -H "Content-Type: application/json" \
  -d '{"name": "孙大伟", "medical_record_no": "MR003", "age": 58, "gender": "男", "department": "心内科"}' | python3 -m json.tool
echo ""

echo "4. 查看所有陪检员"
curl -s "$BASE_URL/api/escorts/" | python3 -m json.tool
echo ""

echo "5. 查看所有患者"
curl -s "$BASE_URL/api/patients/" | python3 -m json.tool
echo ""

echo ""
echo "=== 正常流程测试 ==="
echo ""

echo "6. 创建普通陪检任务（患者 1 - CT检查）"
curl -s -X POST "$BASE_URL/api/tasks/" \
  -H "Content-Type: application/json" \
  -d '{"patient_id": 1, "priority": "normal", "examination_type": "CT检查", "from_location": "内科病房", "to_location": "CT室"}' | python3 -m json.tool
echo ""

echo "7. 创建急诊任务（患者 2 - 急诊优先）"
curl -s -X POST "$BASE_URL/api/tasks/" \
  -H "Content-Type: application/json" \
  -d '{"patient_id": 2, "priority": "emergency", "examination_type": "急诊抢救", "from_location": "急诊科", "to_location": "抢救室"}' | python3 -m json.tool
echo ""

echo "8. 创建紧急任务（患者 3 - 心电图）"
curl -s -X POST "$BASE_URL/api/tasks/" \
  -H "Content-Type: application/json" \
  -d '{"patient_id": 3, "priority": "urgent", "examination_type": "心电图检查", "from_location": "心内科", "to_location": "功能检查科"}' | python3 -m json.tool
echo ""

echo "9. 查看所有待分配任务（按优先级排序）"
curl -s "$BASE_URL/api/tasks/?status=pending" | python3 -m json.tool
echo ""

echo "10. 分配任务 1 给陪检员 1"
curl -s -X POST "$BASE_URL/api/tasks/1/assign" \
  -H "Content-Type: application/json" \
  -d '{"escort_id": 1}' | python3 -m json.tool
echo ""

echo "11. 分配任务 2 给陪检员 1"
curl -s -X POST "$BASE_URL/api/tasks/2/assign" \
  -H "Content-Type: application/json" \
  -d '{"escort_id": 1}' | python3 -m json.tool
echo ""

echo "12. 陪检员 1 接单任务 1"
curl -s -X POST "$BASE_URL/api/tasks/1/accept" | python3 -m json.tool
echo ""

echo "13. 完成任务 1"
curl -s -X POST "$BASE_URL/api/tasks/1/complete" | python3 -m json.tool
echo ""

echo ""
echo "=== 异常流程测试 ==="
echo ""

echo "14. 分配任务 3 给不存在的陪检员（应失败）"
curl -s -X POST "$BASE_URL/api/tasks/3/assign" \
  -H "Content-Type: application/json" \
  -d '{"escort_id": 999}' | python3 -m json.tool
echo ""

echo "15. 取消任务 2（测试取消补位）"
curl -s -X POST "$BASE_URL/api/tasks/2/cancel" \
  -H "Content-Type: application/json" \
  -d '{"reason": "患者病情好转，无需陪检"}' | python3 -m json.tool
echo ""

echo "16. 转派任务（先创建一个新任务并分配）"
curl -s -X POST "$BASE_URL/api/tasks/" \
  -H "Content-Type: application/json" \
  -d '{"patient_id": 1, "priority": "normal", "examination_type": "B超检查", "from_location": "内科", "to_location": "B超室"}' | python3 -m json.tool
echo ""

echo "17. 分配新任务给陪检员 2"
curl -s -X POST "$BASE_URL/api/tasks/4/assign" \
  -H "Content-Type: application/json" \
  -d '{"escort_id": 2}' | python3 -m json.tool
echo ""

echo "18. 转派任务 4 从陪检员 2 转派给陪检员 1"
curl -s -X POST "$BASE_URL/api/tasks/4/transfer" \
  -H "Content-Type: application/json" \
  -d '{"new_escort_id": 1, "reason": "陪检员李四临时有事，转派给张三"}' | python3 -m json.tool
echo ""

echo ""
echo "=== 批量操作测试 ==="
echo ""

echo "19. 批量创建 3 个任务"
curl -s -X POST "$BASE_URL/api/tasks/batch/create" \
  -H "Content-Type: application/json" \
  -d '{
    "tasks": [
      {"patient_id": 1, "priority": "normal", "examination_type": "血常规",
      {"patient_id": 2, "priority": "emergency", "examination_type": "急诊检查"},
      {"patient_id": 3, "priority": "urgent", "examination_type": "心脏彩超"}
    ]
  }' | python3 -m json.tool
echo ""

echo "20. 查看所有任务"
curl -s "$BASE_URL/api/tasks/" | python3 -m json.tool
echo ""

echo ""
echo "=== 审计日志查询 ==="
echo ""

echo "21. 查看任务 4 的审计日志（转派留痕）"
curl -s "$BASE_URL/api/tasks/4/audit-logs" | python3 -m json.tool
echo ""

echo "22. 查看任务 2 的审计日志（取消补位）"
curl -s "$BASE_URL/api/tasks/2/audit-logs" | python3 -m json.tool
echo ""

echo ""
echo "=== 统计信息 ==="
echo ""

echo "23. 查看系统统计"
curl -s "$BASE_URL/api/tasks/statistics/overview" | python3 -m json.tool
echo ""

echo ""
echo "=== 测试完成 ==="
echo "所有主流程测试已完成！"
echo ""
echo "你可以通过以下命令导出数据："
echo "  - 查看所有任务: curl $BASE_URL/api/tasks/"
echo "  - 查看任务详情: curl $BASE_URL/api/tasks/1"
echo "  - 查看审计日志: curl $BASE_URL/api/tasks/1/audit-logs"