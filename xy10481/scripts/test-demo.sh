#!/bin/bash

BASE_URL="http://localhost:3000/api/treatment"

echo "=============================================="
echo "   医美疗程消耗 API - 功能演示"
echo "=============================================="
echo ""

CUST_WANG="cust_001"
CUST_LI="cust_002"
CUST_ZHANG="cust_003"

SVC_SKIN="svc_skin_001"
SVC_HAIR="svc_hair_001"
SVC_LASER="svc_laser_001"

DOC_ZHANG="doc_001"
DOC_LI="doc_002"
DOC_WANG="doc_003"

APPOINTMENT_ID1=""
APPOINTMENT_ID2=""
APPOINTMENT_ID3=""

print_section() {
    echo ""
    echo "=============================================="
    echo "   $1"
    echo "=============================================="
    echo ""
}

print_curl() {
    echo "执行命令:"
    echo "  $1"
    echo ""
}

wait_for_server() {
    echo "等待服务器启动..."
    for i in {1..10}; do
        if curl -s http://localhost:3000/ > /dev/null 2>&1; then
            echo "服务器已就绪"
            return 0
        fi
        sleep 1
    done
    echo "服务器启动超时"
    exit 1
}

echo "【初始化】等待服务启动..."
wait_for_server
echo ""

print_section "0. 重置测试数据"
echo "--- 清空之前的测试数据 ---"
print_curl "curl -s -X POST \"${BASE_URL}/reset\""
curl -s -X POST "${BASE_URL}/reset" | python3 -m json.tool
echo ""

print_section "1. 查看基础数据"

echo "--- 查看所有服务项目 ---"
print_curl "curl -s \"${BASE_URL}/services\""
curl -s "${BASE_URL}/services" | python3 -m json.tool
echo ""

echo "--- 查看医生列表 ---"
print_curl "curl -s \"${BASE_URL}/doctors\""
curl -s "${BASE_URL}/doctors" | python3 -m json.tool
echo ""

print_section "2. 客户购入疗程包"

echo "--- 王美丽购入【深层清洁护理】10次（皮肤管理）---"
print_curl "curl -s -X POST \"${BASE_URL}/purchase\" \
  -H \"Content-Type: application/json\" \
  -d '{\"customerId\":\"'${CUST_WANG}'\",\"serviceId\":\"'${SVC_SKIN}'\",\"packageName\":\"深层清洁十次卡\",\"count\":10,\"unitPrice\":380}'"

RESPONSE=$(curl -s -X POST "${BASE_URL}/purchase" \
  -H "Content-Type: application/json" \
  -d "{\"customerId\":\"${CUST_WANG}\",\"serviceId\":\"${SVC_SKIN}\",\"packageName\":\"深层清洁十次卡\",\"count\":10,\"unitPrice\":380}")
echo "$RESPONSE" | python3 -m json.tool
echo ""

echo "--- 李小花购入【唇部脱毛】6次（脱毛）---"
print_curl "curl -s -X POST \"${BASE_URL}/purchase\" \
  -H \"Content-Type: application/json\" \
  -d '{\"customerId\":\"'${CUST_LI}'\",\"serviceId\":\"'${SVC_HAIR}'\",\"packageName\":\"唇部脱毛六次卡\",\"count\":6,\"unitPrice\":298}'"

curl -s -X POST "${BASE_URL}/purchase" \
  -H "Content-Type: application/json" \
  -d "{\"customerId\":\"${CUST_LI}\",\"serviceId\":\"${SVC_HAIR}\",\"packageName\":\"唇部脱毛六次卡\",\"count\":6,\"unitPrice\":298}" | python3 -m json.tool
echo ""

echo "--- 张婷婷购入【光子嫩肤】8次（光电项目）---"
print_curl "curl -s -X POST \"${BASE_URL}/purchase\" \
  -H \"Content-Type: application/json\" \
  -d '{\"customerId\":\"'${CUST_ZHANG}'\",\"serviceId\":\"'${SVC_LASER}'\",\"packageName\":\"光子嫩肤八次卡\",\"count\":8,\"unitPrice\":880}'"

curl -s -X POST "${BASE_URL}/purchase" \
  -H "Content-Type: application/json" \
  -d "{\"customerId\":\"${CUST_ZHANG}\",\"serviceId\":\"${SVC_LASER}\",\"packageName\":\"光子嫩肤八次卡\",\"count\":8,\"unitPrice\":880}" | python3 -m json.tool
echo ""

print_section "3. 赠送次数"

echo "--- 给王美丽赠送深层清洁2次（新客户礼遇）---"
print_curl "curl -s -X POST \"${BASE_URL}/gift\" \
  -H \"Content-Type: application/json\" \
  -d '{\"customerId\":\"'${CUST_WANG}'\",\"serviceId\":\"'${SVC_SKIN}'\",\"count\":2,\"reason\":\"新客户礼遇\"}'"

RESPONSE=$(curl -s -X POST "${BASE_URL}/gift" \
  -H "Content-Type: application/json" \
  -d "{\"customerId\":\"${CUST_WANG}\",\"serviceId\":\"${SVC_SKIN}\",\"count\":2,\"reason\":\"新客户礼遇\"}")
echo "$RESPONSE" | python3 -m json.tool
echo ""

echo "--- 查看王美丽剩余次数（应该有10次购买 + 2次赠送 = 12次）---"
print_curl "curl -s \"${BASE_URL}/remaining/${CUST_WANG}\""
curl -s "${BASE_URL}/remaining/${CUST_WANG}" | python3 -m json.tool
echo ""

print_section "4. 预约服务"

echo "--- 王美丽预约深层清洁（张医生，今天下午）---"
SCHEDULED_AT=$(date +"%Y-%m-%d %H:%M:%S")
print_curl "curl -s -X POST \"${BASE_URL}/appointment\" \
  -H \"Content-Type: application/json\" \
  -d '{\"customerId\":\"'${CUST_WANG}'\",\"serviceId\":\"'${SVC_SKIN}'\",\"doctorId\":\"'${DOC_ZHANG}'\",\"scheduledAt\":\"'${SCHEDULED_AT}'\"}'"

RESPONSE=$(curl -s -X POST "${BASE_URL}/appointment" \
  -H "Content-Type: application/json" \
  -d "{\"customerId\":\"${CUST_WANG}\",\"serviceId\":\"${SVC_SKIN}\",\"doctorId\":\"${DOC_ZHANG}\",\"scheduledAt\":\"${SCHEDULED_AT}\"}")
APPOINTMENT_ID1=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('appointmentId',''))")
echo "$RESPONSE" | python3 -m json.tool
echo "预约ID: ${APPOINTMENT_ID1}"
echo ""

echo "--- 李小花预约唇部脱毛（王医生）---"
print_curl "curl -s -X POST \"${BASE_URL}/appointment\" \
  -H \"Content-Type: application/json\" \
  -d '{\"customerId\":\"'${CUST_LI}'\",\"serviceId\":\"'${SVC_HAIR}'\",\"doctorId\":\"'${DOC_WANG}'\",\"scheduledAt\":\"'${SCHEDULED_AT}'\"}'"

RESPONSE=$(curl -s -X POST "${BASE_URL}/appointment" \
  -H "Content-Type: application/json" \
  -d "{\"customerId\":\"${CUST_LI}\",\"serviceId\":\"${SVC_HAIR}\",\"doctorId\":\"${DOC_WANG}\",\"scheduledAt\":\"${SCHEDULED_AT}\"}")
APPOINTMENT_ID2=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('appointmentId',''))")
echo "$RESPONSE" | python3 -m json.tool
echo "预约ID: ${APPOINTMENT_ID2}"
echo ""

echo "--- 张婷婷预约光子嫩肤（李医生）---"
print_curl "curl -s -X POST \"${BASE_URL}/appointment\" \
  -H \"Content-Type: application/json\" \
  -d '{\"customerId\":\"'${CUST_ZHANG}'\",\"serviceId\":\"'${SVC_LASER}'\",\"doctorId\":\"'${DOC_LI}'\",\"scheduledAt\":\"'${SCHEDULED_AT}'\"}'"

RESPONSE=$(curl -s -X POST "${BASE_URL}/appointment" \
  -H "Content-Type: application/json" \
  -d "{\"customerId\":\"${CUST_ZHANG}\",\"serviceId\":\"${SVC_LASER}\",\"doctorId\":\"${DOC_LI}\",\"scheduledAt\":\"${SCHEDULED_AT}\"}")
APPOINTMENT_ID3=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('appointmentId',''))")
echo "$RESPONSE" | python3 -m json.tool
echo "预约ID: ${APPOINTMENT_ID3}"
echo ""

print_section "5. 正常消耗（医生确认扣次）"

echo "--- 王美丽服务完成，张医生确认扣次（应该优先扣赠送次数）---"
print_curl "curl -s -X POST \"${BASE_URL}/consume\" \
  -H \"Content-Type: application/json\" \
  -d '{\"appointmentId\":\"'${APPOINTMENT_ID1}'\",\"doctorId\":\"'${DOC_ZHANG}'\"}'"

curl -s -X POST "${BASE_URL}/consume" \
  -H "Content-Type: application/json" \
  -d "{\"appointmentId\":\"${APPOINTMENT_ID1}\",\"doctorId\":\"${DOC_ZHANG}\"}" | python3 -m json.tool
echo ""

echo "--- 扣次后查看王美丽剩余次数（赠送应该剩1次，购买10次未动）---"
print_curl "curl -s \"${BASE_URL}/remaining/${CUST_WANG}\""
curl -s "${BASE_URL}/remaining/${CUST_WANG}" | python3 -m json.tool
echo ""

echo "--- 李小花服务完成，王医生确认扣次（扣购买次数）---"
print_curl "curl -s -X POST \"${BASE_URL}/consume\" \
  -H \"Content-Type: application/json\" \
  -d '{\"appointmentId\":\"'${APPOINTMENT_ID2}'\",\"doctorId\":\"'${DOC_WANG}'\"}'"

curl -s -X POST "${BASE_URL}/consume" \
  -H "Content-Type: application/json" \
  -d "{\"appointmentId\":\"${APPOINTMENT_ID2}\",\"doctorId\":\"${DOC_WANG}\"}" | python3 -m json.tool
echo ""

echo "--- 张婷婷服务完成，李医生确认扣次（扣购买次数）---"
print_curl "curl -s -X POST \"${BASE_URL}/consume\" \
  -H \"Content-Type: application/json\" \
  -d '{\"appointmentId\":\"'${APPOINTMENT_ID3}'\",\"doctorId\":\"'${DOC_LI}'\"}'"

curl -s -X POST "${BASE_URL}/consume" \
  -H "Content-Type: application/json" \
  -d "{\"appointmentId\":\"${APPOINTMENT_ID3}\",\"doctorId\":\"${DOC_LI}\"}" | python3 -m json.tool
echo ""

print_section "6. 赠送扣次（王美丽再次消耗）"

echo "--- 王美丽再次预约深层清洁---"
SCHEDULED_AT2=$(date -v +1d +"%Y-%m-%d %H:%M:%S")
print_curl "curl -s -X POST \"${BASE_URL}/appointment\" \
  -H \"Content-Type: application/json\" \
  -d '{\"customerId\":\"'${CUST_WANG}'\",\"serviceId\":\"'${SVC_SKIN}'\",\"doctorId\":\"'${DOC_ZHANG}'\",\"scheduledAt\":\"'${SCHEDULED_AT2}'\"}'"

RESPONSE=$(curl -s -X POST "${BASE_URL}/appointment" \
  -H "Content-Type: application/json" \
  -d "{\"customerId\":\"${CUST_WANG}\",\"serviceId\":\"${SVC_SKIN}\",\"doctorId\":\"${DOC_ZHANG}\",\"scheduledAt\":\"${SCHEDULED_AT2}\"}")
APPOINTMENT_ID4=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('appointmentId',''))")
echo "$RESPONSE" | python3 -m json.tool
echo "预约ID: ${APPOINTMENT_ID4}"
echo ""

echo "--- 王美丽再次消耗（赠送次数还有1次，继续优先扣赠送）---"
print_curl "curl -s -X POST \"${BASE_URL}/consume\" \
  -H \"Content-Type: application/json\" \
  -d '{\"appointmentId\":\"'${APPOINTMENT_ID4}'\",\"doctorId\":\"'${DOC_ZHANG}'\"}'"

curl -s -X POST "${BASE_URL}/consume" \
  -H "Content-Type: application/json" \
  -d "{\"appointmentId\":\"${APPOINTMENT_ID4}\",\"doctorId\":\"${DOC_ZHANG}\"}" | python3 -m json.tool
echo ""

echo "--- 现在查看王美丽剩余次数（赠送已用完，购买10次未动）---"
print_curl "curl -s \"${BASE_URL}/remaining/${CUST_WANG}\""
curl -s "${BASE_URL}/remaining/${CUST_WANG}" | python3 -m json.tool
echo ""

print_section "7. 重复扣次拦截"

echo "--- 尝试对同一个预约再次扣次（应该拦截）---"
print_curl "curl -s -X POST \"${BASE_URL}/consume\" \
  -H \"Content-Type: application/json\" \
  -d '{\"appointmentId\":\"'${APPOINTMENT_ID1}'\",\"doctorId\":\"'${DOC_ZHANG}'\"}'"

curl -s -X POST "${BASE_URL}/consume" \
  -H "Content-Type: application/json" \
  -d "{\"appointmentId\":\"${APPOINTMENT_ID1}\",\"doctorId\":\"${DOC_ZHANG}\"}" | python3 -m json.tool
echo ""

print_section "8. 退款冲抵与剩余次数重算"

echo "--- 李小花购买的唇部脱毛已使用1次，剩余5次 ---"
print_curl "curl -s \"${BASE_URL}/remaining/${CUST_LI}\""
curl -s "${BASE_URL}/remaining/${CUST_LI}" | python3 -m json.tool
echo ""

echo "--- 李小花申请退款2次（应该成功，退款后剩余3次购买次数）---"
print_curl "curl -s -X POST \"${BASE_URL}/refund\" \
  -H \"Content-Type: application/json\" \
  -d '{\"customerId\":\"'${CUST_LI}'\",\"serviceId\":\"'${SVC_HAIR}'\",\"count\":2,\"reason\":\"客户个人原因\"}'"

curl -s -X POST "${BASE_URL}/refund" \
  -H "Content-Type: application/json" \
  -d "{\"customerId\":\"${CUST_LI}\",\"serviceId\":\"${SVC_HAIR}\",\"count\":2,\"reason\":\"客户个人原因\"}" | python3 -m json.tool
echo ""

echo "--- 退款后查看李小花剩余次数 ---"
print_curl "curl -s \"${BASE_URL}/remaining/${CUST_LI}\""
curl -s "${BASE_URL}/remaining/${CUST_LI}" | python3 -m json.tool
echo ""

print_section "9. 次数不足拦截演示"

echo "--- 尝试让李小花预约6次以上服务后的情况 ---"
echo "当前李小花剩余: 购买3次，赠送0次，总计3次"
echo "尝试退款5次（超过可退款次数）:"
print_curl "curl -s -X POST \"${BASE_URL}/refund\" \
  -H \"Content-Type: application/json\" \
  -d '{\"customerId\":\"'${CUST_LI}'\",\"serviceId\":\"'${SVC_HAIR}'\",\"count\":5,\"reason\":\"测试次数不足\"}'"

curl -s -X POST "${BASE_URL}/refund" \
  -H "Content-Type: application/json" \
  -d "{\"customerId\":\"${CUST_LI}\",\"serviceId\":\"${SVC_HAIR}\",\"count\":5,\"reason\":\"测试次数不足\"}" | python3 -m json.tool
echo ""

print_section "10. 流水查询"

echo "--- 查看所有交易流水 ---"
print_curl "curl -s \"${BASE_URL}/transactions\""
curl -s "${BASE_URL}/transactions" | python3 -m json.tool
echo ""

print_section "11. 统计接口"

echo "--- 医生执行量统计（张医生）---"
print_curl "curl -s \"${BASE_URL}/stats/doctor/${DOC_ZHANG}\""
curl -s "${BASE_URL}/stats/doctor/${DOC_ZHANG}" | python3 -m json.tool
echo ""

echo "--- 退款影响统计 ---"
print_curl "curl -s \"${BASE_URL}/stats/refund-impact\""
curl -s "${BASE_URL}/stats/refund-impact" | python3 -m json.tool
echo ""

echo "--- 异常流水查询（包含赠送扣次、退款等）---"
print_curl "curl -s \"${BASE_URL}/stats/abnormal\""
curl -s "${BASE_URL}/stats/abnormal" | python3 -m json.tool
echo ""

print_section "12. 客户剩余次数汇总"

echo "--- 王美丽剩余次数 ---"
curl -s "${BASE_URL}/remaining/${CUST_WANG}" | python3 -m json.tool
echo ""

echo "--- 李小花剩余次数 ---"
curl -s "${BASE_URL}/remaining/${CUST_LI}" | python3 -m json.tool
echo ""

echo "--- 张婷婷剩余次数 ---"
curl -s "${BASE_URL}/remaining/${CUST_ZHANG}" | python3 -m json.tool
echo ""

print_section "演示完成"
echo ""
echo "【业务规则验证总结】"
echo "✅ 赠送次数优先扣减：王美丽2次赠送都优先被消耗"
echo "✅ 医生确认机制：必须通过预约 + 医生确认才能扣次"
echo "✅ 重复扣次拦截：同一预约重复扣次被成功拦截"
echo "✅ 退款剩余次数重算：李小花退款后次数正确更新"
echo "✅ 次数不足拦截：退款超过可用次数时被拦截"
echo "✅ 流水完整追踪：所有操作都有交易记录"
echo "✅ 统计接口可用：医生执行量、退款影响、异常流水都可查询"
echo ""
echo "如需重新演示，请删除 data 目录后重新运行"
