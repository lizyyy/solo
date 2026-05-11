#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "===================================================="
echo "  企业培训签到API - 完整演示脚本"
echo "  请确保服务器已启动: npm start"
echo "===================================================="
echo ""

echo "[步骤1] 清理旧数据库"
rm -f training.db
echo "已删除旧数据库"
echo ""

echo "[步骤2] 创建员工"
echo "----------------------------------------"
ZHANGSAN_ID=$(curl -s -X POST $BASE_URL/employees \
  -H "Content-Type: application/json" \
  -d '{"name":"张三","department":"安全部"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).id)})")
echo "张三 ID: $ZHANGSAN_ID"

LISI_ID=$(curl -s -X POST $BASE_URL/employees \
  -H "Content-Type: application/json" \
  -d '{"name":"李四","department":"安全部"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).id)})")
echo "李四 ID: $LISI_ID"

WANGWU_ID=$(curl -s -X POST $BASE_URL/employees \
  -H "Content-Type: application/json" \
  -d '{"name":"王五","department":"销售部"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).id)})")
echo "王五 ID: $WANGWU_ID"

ZHAOLIU_ID=$(curl -s -X POST $BASE_URL/employees \
  -H "Content-Type: application/json" \
  -d '{"name":"赵六","department":"销售部"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).id)})")
echo "赵六 ID: $ZHAOLIU_ID"

echo ""
echo "[步骤3] 创建培训场次"
echo "----------------------------------------"
SAFETY_SESSION_ID=$(curl -s -X POST $BASE_URL/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2026年度安全生产合规培训",
    "type": "safety",
    "start_time": "2026-05-15T09:00:00",
    "end_time": "2026-05-15T17:00:00",
    "grace_minutes": 15,
    "pass_score": 70,
    "location": "总部1号会议室"
  }' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).id)})")
echo "安全培训场次 ID: $SAFETY_SESSION_ID"

SALES_SESSION_ID=$(curl -s -X POST $BASE_URL/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2026年Q2销售合规培训",
    "type": "sales",
    "start_time": "2026-05-20T10:00:00",
    "end_time": "2026-05-20T16:00:00",
    "grace_minutes": 10,
    "pass_score": 60,
    "location": "销售中心培训室"
  }' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).id)})")
echo "销售培训场次 ID: $SALES_SESSION_ID"

echo ""
echo "[步骤4] 员工报名"
echo "----------------------------------------"
echo "张三报名安全培训:"
curl -s -X POST $BASE_URL/registrations \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SAFETY_SESSION_ID\",\"employee_id\":\"$ZHANGSAN_ID\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.stringify(JSON.parse(d),null,2))})"

echo ""
echo "李四报名安全培训:"
curl -s -X POST $BASE_URL/registrations \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SAFETY_SESSION_ID\",\"employee_id\":\"$LISI_ID\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.stringify(JSON.parse(d),null,2))})"

echo ""
echo "王五报名销售培训:"
curl -s -X POST $BASE_URL/registrations \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SALES_SESSION_ID\",\"employee_id\":\"$WANGWU_ID\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.stringify(JSON.parse(d),null,2))})"

echo ""
echo "赵六报名销售培训:"
curl -s -X POST $BASE_URL/registrations \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SALES_SESSION_ID\",\"employee_id\":\"$ZHAOLIU_ID\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.stringify(JSON.parse(d),null,2))})"

echo ""
echo "[场景测试1] 同一员工重复报名 (应该失败)"
echo "----------------------------------------"
echo "尝试让张三再次报名安全培训:"
curl -s -X POST $BASE_URL/registrations \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SAFETY_SESSION_ID\",\"employee_id\":\"$ZHANGSAN_ID\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.stringify(JSON.parse(d),null,2))})"

echo ""
echo "[场景测试2] 未报名员工签到 (应该失败)"
echo "----------------------------------------"
echo "尝试让未报名的赵六签到安全培训:"
curl -s -X POST $BASE_URL/checkins \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SAFETY_SESSION_ID\",\"employee_id\":\"$ZHAOLIU_ID\",\"checkin_time\":\"2026-05-15T09:05:00\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.stringify(JSON.parse(d),null,2))})"

echo ""
echo "[步骤5] 正常签到 (准时到达)"
echo "----------------------------------------"
echo "张三准时签到安全培训 (09:05到达, 宽限15分钟):"
ZHANGSAN_CHECKIN_ID=$(curl -s -X POST $BASE_URL/checkins \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SAFETY_SESSION_ID\",\"employee_id\":\"$ZHANGSAN_ID\",\"checkin_time\":\"2026-05-15T09:05:00\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{let j=JSON.parse(d);console.log(j.id);console.log(JSON.stringify(j,null,2))}")
echo "签到状态: approved (准时)"

echo ""
echo "[步骤6] 迟到签到 (超过宽限时间)"
echo "----------------------------------------"
echo "李四迟到签到安全培训 (09:30到达, 已超过15分钟宽限):"
LISI_CHECKIN_ID=$(curl -s -X POST $BASE_URL/checkins \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SAFETY_SESSION_ID\",\"employee_id\":\"$LISI_ID\",\"checkin_time\":\"2026-05-15T09:30:00\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{let j=JSON.parse(d);console.log(j.id);console.log(JSON.stringify(j,null,2))}")
echo "签到状态: pending_approval (迟到待审)"

echo ""
echo "[步骤7] 考试成绩录入"
echo "----------------------------------------"
echo "张三考试成绩 85分 (及格线70分):"
ZHANGSAN_EXAM_ID=$(curl -s -X POST $BASE_URL/exams \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SAFETY_SESSION_ID\",\"employee_id\":\"$ZHANGSAN_ID\",\"score\":85,\"exam_time\":\"2026-05-15T16:00:00\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{let j=JSON.parse(d);console.log(j.id);console.log(JSON.stringify(j,null,2))}")
echo "考试结果: is_passed=1 (通过)"

echo ""
echo "李四考试成绩 65分 (及格线70分):"
LISI_EXAM_ID=$(curl -s -X POST $BASE_URL/exams \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SAFETY_SESSION_ID\",\"employee_id\":\"$LISI_ID\",\"score\":65,\"exam_time\":\"2026-05-15T16:00:00\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{let j=JSON.parse(d);console.log(j.id);console.log(JSON.stringify(j,null,2))}")
echo "考试结果: is_passed=0 (未通过)"

echo ""
echo "[步骤8] 安排补考"
echo "----------------------------------------"
echo "为李四安排补考:"
LISI_RETAKE_ID=$(curl -s -X POST $BASE_URL/retakes \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SAFETY_SESSION_ID\",\"employee_id\":\"$LISI_ID\",\"original_exam_id\":\"$LISI_EXAM_ID\",\"scheduled_time\":\"2026-05-22T14:00:00\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{let j=JSON.parse(d);console.log(j.id);console.log(JSON.stringify(j,null,2))}")

echo ""
echo "[步骤9] 批准李四的迟到签到"
echo "----------------------------------------"
echo "审批通过李四的签到:"
curl -s -X PATCH $BASE_URL/checkins/$LISI_CHECKIN_ID/approve | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.stringify(JSON.parse(d),null,2))})"

echo ""
echo "[步骤10] 李四补考通过"
echo "----------------------------------------"
echo "李四补考成绩 78分:"
LISI_RETAKE_EXAM_ID=$(curl -s -X POST $BASE_URL/exams \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SAFETY_SESSION_ID\",\"employee_id\":\"$LISI_ID\",\"score\":78,\"exam_time\":\"2026-05-22T14:30:00\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{let j=JSON.parse(d);console.log(j.id);console.log(JSON.stringify(j,null,2))}")
echo "考试结果: is_passed=1 (补考通过)"

echo ""
echo "[步骤11] 发放证书"
echo "----------------------------------------"
echo "为张三发放证书:"
curl -s -X POST $BASE_URL/certificates \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SAFETY_SESSION_ID\",\"employee_id\":\"$ZHANGSAN_ID\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.stringify(JSON.parse(d),null,2))})"

echo ""
echo "为李四发放证书 (补考通过后):"
curl -s -X POST $BASE_URL/certificates \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SAFETY_SESSION_ID\",\"employee_id\":\"$LISI_ID\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.stringify(JSON.parse(d),null,2))})"

echo ""
echo "[场景测试3] 证书锁定后修改成绩 (应该失败)"
echo "----------------------------------------"
echo "尝试修改已发证员工张三的成绩:"
curl -s -X POST $BASE_URL/exams \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SAFETY_SESSION_ID\",\"employee_id\":\"$ZHANGSAN_ID\",\"score\":95,\"exam_time\":\"2026-05-15T16:00:00\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.stringify(JSON.parse(d),null,2))})"

echo ""
echo "===================================================="
echo "  查看统计数据"
echo "===================================================="
echo ""
echo "完整统计报告:"
curl -s $BASE_URL/statistics | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.stringify(JSON.parse(d),null,2))})"

echo ""
echo "===================================================="
echo "  演示完成！"
echo "===================================================="
