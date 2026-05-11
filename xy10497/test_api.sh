#!/bin/bash
# 医院床位周转API测试脚本

BASE_URL="http://127.0.0.1:5001"

echo "=========================================="
echo "医院床位周转API测试"
echo "服务器地址: $BASE_URL"
echo "=========================================="

echo -e "\n[1] 健康检查"
curl -s "$BASE_URL/api/health" | python3 -m json.tool

echo -e "\n[2] 创建病区 - 内科"
curl -s -X POST "$BASE_URL/api/wards" \
  -H "Content-Type: application/json" \
  -d '{"name": "内科", "description": "内科病区"}' | python3 -m json.tool

echo -e "\n[3] 创建病区 - 外科"
curl -s -X POST "$BASE_URL/api/wards" \
  -H "Content-Type: application/json" \
  -d '{"name": "外科", "description": "外科病区"}' | python3 -m json.tool

echo -e "\n[4] 查看所有病区"
curl -s "$BASE_URL/api/wards" | python3 -m json.tool

echo -e "\n[5] 内科创建床位 A-001"
curl -s -X POST "$BASE_URL/api/beds" \
  -H "Content-Type: application/json" \
  -d '{"ward_id": 1, "bed_number": "A-001"}' | python3 -m json.tool

echo -e "\n[6] 内科创建床位 A-002"
curl -s -X POST "$BASE_URL/api/beds" \
  -H "Content-Type: application/json" \
  -d '{"ward_id": 1, "bed_number": "A-002"}' | python3 -m json.tool

echo -e "\n[7] 外科创建床位 B-001"
curl -s -X POST "$BASE_URL/api/beds" \
  -H "Content-Type: application/json" \
  -d '{"ward_id": 2, "bed_number": "B-001"}' | python3 -m json.tool

echo -e "\n[8] 查看所有床位"
curl -s "$BASE_URL/api/beds" | python3 -m json.tool

echo -e "\n=========================================="
echo "场景一: 正常入出院流程"
echo "=========================================="

echo -e "\n[9] 预约入院 - 张三 (床位 A-001)"
curl -s -X POST "$BASE_URL/api/admissions/reserve" \
  -H "Content-Type: application/json" \
  -d '{
    "reservation_id": "RES-001",
    "patient_id": "P-001",
    "patient_name": "张三",
    "bed_id": 1,
    "gender": "男",
    "age": 45
  }' | python3 -m json.tool

echo -e "\n[10] 查看床位 A-001 状态 (应显示 reserved)"
curl -s "$BASE_URL/api/beds/1" | python3 -m json.tool

echo -e "\n[11] 确认占床 - 张三"
curl -s -X POST "$BASE_URL/api/admissions/admit" \
  -H "Content-Type: application/json" \
  -d '{
    "admission_id": "ADM-001",
    "reservation_id": "RES-001"
  }' | python3 -m json.tool

echo -e "\n[12] 查看床位 A-001 状态 (应显示 occupied)"
curl -s "$BASE_URL/api/beds/1" | python3 -m json.tool

echo -e "\n[13] 系统统计概览"
curl -s "$BASE_URL/api/stats/overview" | python3 -m json.tool

echo -e "\n=========================================="
echo "场景二: 转科 (内科A-001 -> 外科B-001)"
echo "=========================================="

echo -e "\n[14] 转科 - 张三从A-001转到B-001"
curl -s -X POST "$BASE_URL/api/admissions/transfer" \
  -H "Content-Type: application/json" \
  -d '{
    "transfer_id": "TRF-001",
    "source_admission_id": "ADM-001",
    "target_bed_id": 3
  }' | python3 -m json.tool

echo -e "\n[15] 查看原床位 A-001 状态 (应显示 dirty)"
curl -s "$BASE_URL/api/beds/1" | python3 -m json.tool

echo -e "\n[16] 查看目标床位 B-001 状态 (应显示 occupied)"
curl -s "$BASE_URL/api/beds/3" | python3 -m json.tool

echo -e "\n[17] 转科前后床位占用对照查询"
curl -s "$BASE_URL/api/stats/transfer-history?patient_id=P-001" | python3 -m json.tool

echo -e "\n=========================================="
echo "场景三: 出院、清洁、释放"
echo "=========================================="

echo -e "\n[18] 办理出院 - 张三 (当前在B-001)"
curl -s -X POST "$BASE_URL/api/admissions/discharge" \
  -H "Content-Type: application/json" \
  -d '{
    "discharge_id": "DIS-001",
    "admission_id": "TRANSFER_ADMIT_TRF-001"
  }' | python3 -m json.tool

echo -e "\n[19] 查看床位 B-001 状态 (应显示 dirty)"
curl -s "$BASE_URL/api/beds/3" | python3 -m json.tool

echo -e "\n[20] 清洁床位 B-001"
curl -s -X POST "$BASE_URL/api/beds/3/clean" \
  -H "Content-Type: application/json" \
  -d '{"clean_id": "CLN-001"}' | python3 -m json.tool

echo -e "\n[21] 释放床位 B-001"
curl -s -X POST "$BASE_URL/api/beds/3/release" \
  -H "Content-Type: application/json" \
  -d '{"release_id": "REL-001"}' | python3 -m json.tool

echo -e "\n[22] 查看床位 B-001 状态 (应显示 available)"
curl -s "$BASE_URL/api/beds/3" | python3 -m json.tool

echo -e "\n=========================================="
echo "规则拦截测试"
echo "=========================================="

echo -e "\n[23] 清洁原床位 A-001"
curl -s -X POST "$BASE_URL/api/beds/1/clean" \
  -H "Content-Type: application/json" \
  -d '{"clean_id": "CLN-002"}' | python3 -m json.tool

echo -e "\n[24] 预约新患者李四到A-002"
curl -s -X POST "$BASE_URL/api/admissions/reserve" \
  -H "Content-Type: application/json" \
  -d '{
    "reservation_id": "RES-002",
    "patient_id": "P-002",
    "patient_name": "李四",
    "bed_id": 2
  }' | python3 -m json.tool

echo -e "\n[25] 确认占床李四"
curl -s -X POST "$BASE_URL/api/admissions/admit" \
  -H "Content-Type: application/json" \
  -d '{
    "admission_id": "ADM-002",
    "reservation_id": "RES-002"
  }' | python3 -m json.tool

echo -e "\n=========================================="
echo "规则测试1: 同一床位并发分配拦截"
echo "尝试给已被李四占用的A-002再预约王五"
echo "=========================================="

echo -e "\n[26] 尝试预约王五到A-002 (应被拦截)"
curl -s -X POST "$BASE_URL/api/admissions/reserve" \
  -H "Content-Type: application/json" \
  -d '{
    "reservation_id": "RES-003",
    "patient_id": "P-003",
    "patient_name": "王五",
    "bed_id": 2
  }' | python3 -m json.tool

echo -e "\n=========================================="
echo "规则测试2: 未清洁不能再入住"
echo "先让李四出院不清洁，再尝试预约"
echo "=========================================="

echo -e "\n[27] 办理李四出院"
curl -s -X POST "$BASE_URL/api/admissions/discharge" \
  -H "Content-Type: application/json" \
  -d '{
    "discharge_id": "DIS-002",
    "admission_id": "ADM-002"
  }' | python3 -m json.tool

echo -e "\n[28] 尝试预约王五到未清洁的A-002 (应被拦截)"
curl -s -X POST "$BASE_URL/api/admissions/reserve" \
  -H "Content-Type: application/json" \
  -d '{
    "reservation_id": "RES-004",
    "patient_id": "P-003",
    "patient_name": "王五",
    "bed_id": 2
  }' | python3 -m json.tool

echo -e "\n=========================================="
echo "规则测试3: 重复出院幂等"
echo "使用相同出院ID重复调用"
echo "=========================================="

echo -e "\n[29] 再次使用DIS-002办理出院 (应幂等返回成功)"
curl -s -X POST "$BASE_URL/api/admissions/discharge" \
  -H "Content-Type: application/json" \
  -d '{
    "discharge_id": "DIS-002",
    "admission_id": "ADM-002"
  }' | python3 -m json.tool

echo -e "\n=========================================="
echo "最终状态统计"
echo "=========================================="

echo -e "\n[30] 系统统计概览"
curl -s "$BASE_URL/api/stats/overview" | python3 -m json.tool

echo -e "\n[31] 查看所有床位状态"
curl -s "$BASE_URL/api/beds" | python3 -m json.tool

echo -e "\n[32] 查看所有占用记录"
curl -s "$BASE_URL/api/occupies" | python3 -m json.tool

echo -e "\n=========================================="
echo "测试完成！"
echo "=========================================="
