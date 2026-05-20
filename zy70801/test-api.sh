#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "=== 检验科危急值整合系统 API 测试 ==="
echo ""

echo "1. 健康检查"
curl -s "$BASE_URL/health" | head -5
echo ""
echo ""

echo "2. 上传值班表"
curl -s -X POST -F "file=@examples/duty-schedule.csv" "$BASE_URL/upload/duty" | head -5
echo ""
echo ""

echo "3. 上传回告记录"
curl -s -X POST -F "file=@examples/callbacks.json" "$BASE_URL/upload/callback" | head -5
echo ""
echo ""

echo "4. 上传危急值记录 (第一次)"
RESULT=$(curl -s -X POST -F "file=@examples/critical-values.csv" "$BASE_URL/upload/critical-value")
echo "   上传成功，分拣结果："
echo "$RESULT" | grep -o '"statistics":{[^}]*}'
echo ""

P002_ID=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); [print(r['id']) for r in d['normal'] if r['patientId']=='P002']")
P004_ID=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); [print(r['id']) for r in d['normal'] if r['patientId']=='P004']")
P001_PENDING_ID=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['pending'][0]['id'])")
echo "   获取到的ID: P002=$P002_ID, P004=$P004_ID, P001待确认=$P001_PENDING_ID"
echo ""

echo "5. 创建单条医生确认记录 (针对 P002 正常项)"
curl -s -X POST -H "Content-Type: application/json" -d "{
  \"criticalValueId\": \"$P002_ID\",
  \"confirmer\": \"张主任\",
  \"confirmerPhone\": \"13700137001\",
  \"confirmResult\": \"confirmed\",
  \"confirmNote\": \"人工复核：已通知临床，患者病情稳定\"
}" "$BASE_URL/confirm"
echo ""
echo ""

echo "6. 批量导入医生确认记录 (先动态生成包含真实ID的文件)"
cat > /tmp/confirm-batch.json << EOF
[
  {
    "criticalValueId": "$P004_ID",
    "confirmTime": "2024-01-15 10:30:00",
    "confirmer": "李主任",
    "confirmerPhone": "13700137002",
    "confirmResult": "confirmed",
    "confirmNote": "批量导入：已采取治疗措施",
    "sourceSystem": "HIS系统",
    "externalId": "HIS-2024-0001"
  },
  {
    "criticalValueId": "$P001_PENDING_ID",
    "confirmTime": "2024-01-15 09:15:00",
    "confirmer": "王主任",
    "confirmerPhone": "13700137003",
    "confirmResult": "confirmed",
    "confirmNote": "批量导入：待确认项已复核",
    "sourceSystem": "LIS系统",
    "externalId": "LIS-2024-0001"
  },
  {
    "criticalValueId": "INVALID-ID-12345",
    "confirmTime": "2024-01-15 11:00:00",
    "confirmer": "测试人",
    "confirmResult": "confirmed",
    "confirmNote": "无效ID，应该被校验拒绝"
  }
]
EOF
curl -s -X POST -F "file=@/tmp/confirm-batch.json" "$BASE_URL/upload/confirm"
echo ""
echo ""

echo "7. 值班主任复核追溯 (P004 - 验证批量导入的确认记录)"
echo "   危急值ID: $P004_ID"
REVIEW_RESULT=$(curl -s "$BASE_URL/critical-values/$P004_ID/review")
echo "$REVIEW_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('=== 危急值信息 ===')
cv=d['criticalValue']
print(f'患者: {cv[\"patientName\"]} ({cv[\"patientId\"]})')
print(f'项目: {cv[\"testItem\"]} = {cv[\"testValue\"]}{cv[\"unit\"]}')
print(f'状态: {cv[\"status\"]}')
print()
print('=== 电话回告记录 ===')
for cb in d['callbacks']:
    print(f'- {cb[\"callbackTime\"]} {cb[\"callbackPerson\"]} -> {cb[\"receiver\"]}: {cb[\"callbackResult\"]}')
print()
print('=== 医生确认记录 ===')
for cr in d['confirmRecords']:
    print(f'- {cr[\"confirmTime\"]} {cr[\"confirmer\"]}: {cr[\"confirmResult\"]}')
    print(f'  备注: {cr[\"confirmNote\"]}')
    print(f'  来源: {cr.get(\"source\",\"未知\")}')
    if cr.get('originalData'):
        print(f'  原始数据: 已保留 (来自分散系统)')
print()
print('=== 同患者历史记录 ===')
for h in d['samePatientHistory']:
    print(f'- {h[\"testTime\"]} {h[\"testItem\"]} = {h[\"testValue\"]} [{h[\"status\"]}]')
"
echo ""

echo "8. 获取批次列表 (应该包含 confirm 类型)"
curl -s "$BASE_URL/batches?limit=10" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for b in d['batches']:
    print(f'- {b[\"type\"]:15} {b[\"batchNo\"]} 记录数:{b[\"recordCount\"]} 状态:{b[\"status\"]}')
"
echo ""

echo "9. 获取统计数据"
curl -s "$BASE_URL/statistics"
echo ""
echo ""

echo "=== 测试完成 ==="
echo ""
echo "值班主任复核追溯验证命令:"
echo "  curl $BASE_URL/critical-values/$P004_ID/review"
