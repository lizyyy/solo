#!/bin/bash
BASE_URL="http://localhost:8080/api"

echo "=== 测试完整许可流程 ==="
echo ""

echo "=== 1. 创建基础资料 ==="
echo ""

echo "--- 创建地块 ---"
curl --noproxy localhost -s -X POST "$BASE_URL/master/plots" \
  -H "Content-Type: application/json" \
  -d '{"plotCode":"TEST-P001","plotName":"测试地块一","village":"东岗村","area":50.0,"cropType":"小麦","pestType":"蚜虫","location":"东经116.4°,北纬39.9°","approved":false}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('Plot ID:', d['id'], '| Approved:', d['approved'])"

echo ""
echo "--- 审批地块 ---"
curl --noproxy localhost -s -X PUT "$BASE_URL/master/plots/1/approve" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Plot ID:', d['id'], '| Approved:', d['approved'])"

echo ""
echo "--- 创建无人机 ---"
curl --noproxy localhost -s -X POST "$BASE_URL/master/drones" \
  -H "Content-Type: application/json" \
  -d '{"droneCode":"TEST-D001","droneModel":"DJI T30","status":"可用"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('Drone ID:', d['id'], '| Status:', d['status'])"

echo ""
echo "--- 创建药剂 ---"
curl --noproxy localhost -s -X POST "$BASE_URL/master/pesticides" \
  -H "Content-Type: application/json" \
  -d '{"pesticideCode":"TEST-PEST001","pesticideName":"吡虫啉","category":"杀虫剂","applicableCrops":"小麦,水稻","targetPests":"蚜虫,飞虱"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('Pesticide ID:', d['id'])"

echo ""
echo "--- 创建药剂批次 ---"
curl --noproxy localhost -s -X POST "$BASE_URL/master/pesticide-batches" \
  -H "Content-Type: application/json" \
  -d '{"batchNumber":"TEST-BATCH-001","pesticide":{"id":1},"productionDate":"2026-01-15"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('Batch ID:', d['id'])"

echo ""
echo "--- 创建天气窗口 ---"
curl --noproxy localhost -s -X POST "$BASE_URL/master/weather-windows" \
  -H "Content-Type: application/json" \
  -d '{"startTime":"2026-05-25T08:00:00","endTime":"2026-05-25T12:00:00","weatherCondition":"晴","temperature":25.0,"humidity":60.0,"windSpeed":3.5,"rainfall":0.0}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('WeatherWindow ID:', d['id'])"

echo ""
echo "--- 创建飞手 ---"
curl --noproxy localhost -s -X POST "$BASE_URL/master/pilots" \
  -H "Content-Type: application/json" \
  -d '{"pilotCode":"TEST-PILOT001","pilotName":"测试飞手","qualificationLevel":"高级","status":"在岗"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('Pilot ID:', d['id'])"

echo ""
echo "=== 2. 创建并提交许可申请 ==="
echo ""

echo "--- 创建许可申请 ---"
PERM_ID=$(curl --noproxy localhost -s -X POST "$BASE_URL/permissions" \
  -H "Content-Type: application/json" \
  -d '{
    "operationType": "防虫作业",
    "plannedStartTime": "2026-05-25T09:00:00",
    "plannedEndTime": "2026-05-25T11:00:00",
    "pilot": {"id": 1},
    "drone": {"id": 1},
    "weatherWindow": {"id": 1}
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print('Permission ID:', d['id'], '| No:', d['permissionNo'], '| Status:', d['status']); print(d['id'])")

echo ""
echo "许可ID: $PERM_ID"

echo ""
echo "--- 提交许可（触发系统校验） ---"
curl --noproxy localhost -s -X POST "$BASE_URL/permissions/$PERM_ID/submit" | python3 -c "
import sys,json
d = json.load(sys.stdin)
print('提交后状态:', d.get('status', 'ERROR'))
if 'error' in d:
    print('错误:', d['error'])
    sys.exit(1)
"

echo ""
echo "=== 3. 查看校验记录和处理历史 ==="
echo ""

echo "--- 校验记录 ---"
curl --noproxy localhost -s "$BASE_URL/permissions/$PERM_ID/check-records" | python3 -c "
import sys,json
records = json.load(sys.stdin)
for r in records:
    print(f'  {r[\"checkType\"]}: {r[\"checkResult\"]}')
    print(f'    详情: {r[\"checkDetail\"]}')
    print(f'    处置: {r[\"disposalInstruction\"]}')
    print()
"

echo "--- 处理流转历史 ---"
curl --noproxy localhost -s "$BASE_URL/permissions/$PERM_ID/processing-history" | python3 -c "
import sys,json
records = json.load(sys.stdin)
for r in records:
    from_s = r.get('fromStatus') or '无'
    print(f'  {from_s} → {r[\"toStatus\"]}')
    print(f'    动作: {r[\"action\"]}')
    print(f'    处理人: {r[\"processedBy\"]} @ {r[\"processedAt\"]}')
    print()
"

echo ""
echo "=== 4. 人工复核并批准 ==="
echo ""

echo "--- 开始人工复核 ---"
curl --noproxy localhost -s -X POST "$BASE_URL/permissions/$PERM_ID/review/start" | python3 -c "
import sys,json
d = json.load(sys.stdin)
print('复核开始后状态:', d.get('status', 'ERROR'))
"

echo ""
echo "--- 批准许可 ---"
curl --noproxy localhost -s -X POST "$BASE_URL/permissions/$PERM_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"conclusion":"同意作业","remark":"各项条件符合要求"}' | python3 -c "
import sys,json
d = json.load(sys.stdin)
print('批准后状态:', d.get('status', 'ERROR'))
print('最终结论:', d.get('finalConclusion'))
print('结论说明:', d.get('conclusionRemark'))
"

echo ""
echo "=== 5. 完整追溯查询 ==="
echo ""

curl --noproxy localhost -s "$BASE_URL/permissions/$PERM_ID/trace" | python3 -c "
import sys,json
d = json.load(sys.stdin)
perm = d['permission']
print('许可基本信息:')
print(f'  编号: {perm[\"permissionNo\"]}')
print(f'  状态: {perm[\"status\"]}')
print(f'  结论: {perm[\"finalConclusion\"]}')
print(f'  校验记录数: {len(d[\"checkRecords\"])}')
print(f'  流转记录数: {len(d[\"processingHistory\"])}')
print(f'  修正记录数: {len(d[\"amendmentHistory\"])}')
"

echo ""
echo "=== 流程测试完成 ==="
