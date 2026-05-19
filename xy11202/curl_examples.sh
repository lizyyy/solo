#!/bin/bash

BASE_URL="http://localhost:8000"

echo "========================================="
echo "社区药房库存管理系统 - curl 命令示例"
echo "========================================="
echo ""

echo "1. 查看统计摘要"
echo "curl $BASE_URL/api/stats"
curl -s "$BASE_URL/api/stats" | python3 -m json.tool
echo ""

echo "2. 入库登记 - 正常温度疫苗"
echo 'curl -X POST -H "Content-Type: application/json" -d '\''{"batch_number":"VAC-CURL-001","product_name":"流感疫苗","product_type":"疫苗","temperature":6.2,"receiver":"李药师","has_damage":false}'\'' $BASE_URL/api/inventory'
curl -s -X POST -H "Content-Type: application/json" -d '{"batch_number":"VAC-CURL-001","product_name":"流感疫苗","product_type":"疫苗","temperature":6.2,"receiver":"李药师","has_damage":false}' "$BASE_URL/api/inventory" | python3 -m json.tool
echo ""

echo "3. 入库登记 - 温度异常且有破损"
echo 'curl -X POST -H "Content-Type: application/json" -d '\''{"batch_number":"INS-CURL-001","product_name":"赖脯胰岛素","product_type":"胰岛素","temperature":12.5,"receiver":"王药师","has_damage":true,"damage_description":"冷链箱显示温度异常，有2支外壳变形"}'\'' $BASE_URL/api/inventory'
curl -s -X POST -H "Content-Type: application/json" -d '{"batch_number":"INS-CURL-001","product_name":"赖脯胰岛素","product_type":"胰岛素","temperature":12.5,"receiver":"王药师","has_damage":true,"damage_description":"冷链箱显示温度异常，有2支外壳变形"}' "$BASE_URL/api/inventory" | python3 -m json.tool
echo ""

echo "4. 查询所有记录"
echo "curl $BASE_URL/api/inventory"
curl -s "$BASE_URL/api/inventory" | python3 -m json.tool
echo ""

echo "5. 筛选查询 - 温度异常"
echo "curl '$BASE_URL/api/inventory?temperature_status=abnormal'"
curl -s "$BASE_URL/api/inventory?temperature_status=abnormal" | python3 -m json.tool
echo ""

echo "6. 筛选查询 - 按签收人"
echo "curl '$BASE_URL/api/inventory?receiver=李药师'"
curl -s "$BASE_URL/api/inventory?receiver=李药师" | python3 -m json.tool
echo ""

echo "7. 筛选查询 - 待复核状态"
echo "curl '$BASE_URL/api/inventory?status=pending'"
curl -s "$BASE_URL/api/inventory?status=pending" | python3 -m json.tool
echo ""

echo "8. 复核 - 通过"
echo 'curl -X POST -H "Content-Type: application/json" -d '\''{"batch_number":"VAC-CURL-001","reviewed_by":"张主管","status":"approved","review_notes":"温度在正常范围内，无破损，同意入库"}'\'' $BASE_URL/api/inventory/review'
curl -s -X POST -H "Content-Type: application/json" -d '{"batch_number":"VAC-CURL-001","reviewed_by":"张主管","status":"approved","review_notes":"温度在正常范围内，无破损，同意入库"}' "$BASE_URL/api/inventory/review" | python3 -m json.tool
echo ""

echo "9. 复核 - 拒绝"
echo 'curl -X POST -H "Content-Type: application/json" -d '\''{"batch_number":"INS-CURL-001","reviewed_by":"张主管","status":"rejected","review_notes":"温度异常且有破损，做退货处理"}'\'' $BASE_URL/api/inventory/review'
curl -s -X POST -H "Content-Type: application/json" -d '{"batch_number":"INS-CURL-001","reviewed_by":"张主管","status":"rejected","review_notes":"温度异常且有破损，做退货处理"}' "$BASE_URL/api/inventory/review" | python3 -m json.tool
echo ""

echo "10. 查询单条记录详情"
echo "curl $BASE_URL/api/inventory/VAC-CURL-001"
curl -s "$BASE_URL/api/inventory/VAC-CURL-001" | python3 -m json.tool
echo ""

echo "11. 导出Excel报告"
echo "curl -o report.xlsx $BASE_URL/api/inventory/export"
curl -s -o report.xlsx "$BASE_URL/api/inventory/export"
echo "报告已保存为 report.xlsx"
echo ""

echo "========================================="
echo "所有 curl 命令示例执行完成！"
echo "========================================="
