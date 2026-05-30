#!/bin/bash

BASE_URL="http://localhost:3001/api"
OPERATOR="test-admin"

echo "========================================="
echo "演出返场曲单决策系统 - 完整API测试"
echo "========================================="

echo ""
echo "=== 1. 健康检查 ==="
curl -s "$BASE_URL/health" | python3 -m json.tool

echo ""
echo "=== 2. 创建3首测试曲目 ==="
for i in 1 2 3; do
  case $i in
    1) NAME="海阔天空"; ARTIST="Beyond"; DURATION=326; STAMINA=3 ;;
    2) NAME="光辉岁月"; ARTIST="Beyond"; DURATION=295; STAMINA=4 ;;
    3) NAME="真的爱你"; ARTIST="Beyond"; DURATION=278; STAMINA=2 ;;
  esac
  RESULT=$(curl -s -X POST "$BASE_URL/tracks" \
    -H "Content-Type: application/json" \
    -H "x-operator: $OPERATOR" \
    -d "{\"name\":\"$NAME\",\"artist\":\"$ARTIST\",\"duration\":$DURATION,\"staminaLevel\":$STAMINA}")
  echo "创建: $NAME - $(echo $RESULT | python3 -c "import sys,json; d=json.load(sys.stdin); print('成功' if d['success'] else '失败: ' + d.get('error',''))")"
done

echo ""
echo "=== 3. 获取曲目列表 ==="
TRACKS_RESPONSE=$(curl -s "$BASE_URL/tracks")
echo $TRACKS_RESPONSE | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'共 {len(d[\"data\"])} 首曲目:')
for t in d['data']:
    print(f'  - {t[\"name\"]} ({t[\"artist\"]}) - {t[\"duration\"]}秒, 体力等级:{t[\"staminaLevel\"]}')
"

echo ""
echo "=== 4. 导入投票CSV（含重复投票和坏数据） ==="
curl -s -X POST "$BASE_URL/import/votes" \
  -H "x-operator: $OPERATOR" \
  -F "file=@test_votes.csv" \
  -F "fileName=test_votes.csv" | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d['data']
print(f'导入结果: 成功={r[\"success\"]}, 失败={r[\"failed\"]}, 去重={r[\"duplicates\"]}')
if r['badData']:
    print(f'坏数据记录 {len(r[\"badData\"])} 条:')
    for bd in r['badData']:
        print(f'  行{bd[\"lineNumber\"]}: {bd[\"errorType\"]} - {bd[\"errorMessage\"]}')
"

echo ""
echo "=== 5. 导入版权CSV（海阔天空为过期版权） ==="
curl -s -X POST "$BASE_URL/import/copyright" \
  -H "x-operator: $OPERATOR" \
  -F "file=@test_copyright.csv" \
  -F "fileName=test_copyright.csv" | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d['data']
print(f'导入结果: 成功={r[\"success\"]}, 失败={r[\"failed\"]}')
"

echo ""
echo "=== 6. 查看海阔天空版权状态（应为 expired + high） ==="
TRACK_ID=$(echo $TRACKS_RESPONSE | python3 -c "import sys,json; d=json.load(sys.stdin); print([t['id'] for t in d['data'] if t['name']=='海阔天空'][0])")
echo "海阔天空 ID: $TRACK_ID"
curl -s "$BASE_URL/copyright/track/$TRACK_ID" | python3 -c "
import sys, json
d = json.load(sys.stdin)
c = d['data']
print(f'状态: {c[\"status\"]}, 警告级别: {c[\"warningLevel\"]}, 过期时间: {c[\"expiredAt\"]}')
print(f'来源: {c[\"source\"][\"sourceType\"]} - {c[\"source\"][\"fileName\"]}')
"

echo ""
echo "=== 7. 测试版权过期保护：尝试覆盖海阔天空的过期版权 ==="
OVERRIDE_RESULT=$(curl -s -X POST "$BASE_URL/import/copyright" \
  -H "x-operator: $OPERATOR" \
  -F "file=@test_override.csv" \
  -F "fileName=test_override.csv")
echo $OVERRIDE_RESULT | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d['data']
print(f'导入结果: 成功={r[\"success\"]}, 失败={r[\"failed\"]}')
if r['badData']:
    for bd in r['badData']:
        print(f'  被拒绝: {bd[\"errorMessage\"]}')
"

echo ""
echo "=== 8. 验证海阔天空版权仍为 expired（未被覆盖） ==="
curl -s "$BASE_URL/copyright/track/$TRACK_ID" | python3 -c "
import sys, json
d = json.load(sys.stdin)
c = d['data']
status = '✓ 保护成功' if c['status'] == 'expired' and c['warningLevel'] == 'high' else '✗ 保护失败'
print(f'{status}: 状态={c[\"status\"]}, 警告级别={c[\"warningLevel\"]}')
"

echo ""
echo "=== 9. 查看坏数据档案 ==="
curl -s "$BASE_URL/bad-data" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'共 {len(d[\"data\"])} 条坏数据记录:')
for bd in d['data']:
    print(f'  [{bd[\"sourceFile\"]}:{bd[\"lineNumber\"]}] {bd[\"errorType\"]}: {bd[\"errorMessage\"]}')
"

echo ""
echo "=== 10. 保存决策（创建完整快照） ==="
TRACK_IDS=$(echo $TRACKS_RESPONSE | python3 -c "
import sys, json
d = json.load(sys.stdin)
ids = [t['id'] for t in d['data'] if t['name'] in ['光辉岁月', '真的爱你']]
print(json.dumps(ids))
")
echo "选中曲目ID: $TRACK_IDS"

DECISION_RESULT=$(curl -s -X POST "$BASE_URL/decisions" \
  -H "Content-Type: application/json" \
  -H "x-operator: $OPERATOR" \
  -d "{
    \"name\": \"2024北京演唱会返场曲单\",
    \"selectedTrackIds\": $TRACK_IDS,
    \"filters\": {\"copyrightStatus\": [\"active\", \"pending\"], \"maxStamina\": 4},
    \"deduplicationRules\": [{\"field\": \"voterId\", \"enabled\": true}],
    \"decisionReason\": \"海阔天空版权过期，选择光辉岁月和真的爱你作为返场曲目\"
  }")
echo $DECISION_RESULT | python3 -c "
import sys, json
d = json.load(sys.stdin)
dec = d['data']
print(f'决策保存成功!')
print(f'  名称: {dec[\"name\"]}')
print(f'  总时长: {dec[\"totalDuration\"]}秒')
print(f'  总票数: {dec[\"totalVotes\"]}')
print(f'  平均体力: {dec[\"avgStamina\"]}')
print(f'  版权风险: {dec[\"copyrightRisk\"]}')
print(f'  快照包含: {len(dec[\"snapshot\"][\"tracks\"])}首曲目, {len(dec[\"snapshot\"][\"votes\"])}条投票, {len(dec[\"snapshot\"][\"copyrights\"])}条版权')
"

echo ""
echo "=== 11. 导出决策报告 ==="
DECISION_ID=$(echo $DECISION_RESULT | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])")
echo "决策ID: $DECISION_ID"
curl -s "$BASE_URL/decisions/$DECISION_ID/export?format=json" | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d['data']
print(f'=== 可复查报告 ===')
print(f'决策: {r[\"decision\"][\"name\"]}')
print(f'筛选条件: {r[\"filters\"]}')
print(f'去重规则: {r[\"deduplicationRules\"]}')
print(f'时长计算: {r[\"durationCalculation\"][\"totalFormatted\"]}')
print(f'去重统计: {r[\"deduplicationStats\"]}')
print(f'版权风险: {r[\"copyrightRiskAssessment\"][\"level\"]}')
print(f'数据来源可追溯: {len(r[\"sourceTraces\"])}条记录')
"

echo ""
echo "=== 12. 查看审计日志 ==="
curl -s "$BASE_URL/audit/logs?limit=5" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'最近5条操作日志:')
for log in d['data']:
    print(f'  [{log[\"timestamp\"]}] {log[\"operator\"]} {log[\"action\"]} {log[\"entityType\"]}')
"

echo ""
echo "========================================="
echo "所有核心功能测试完成!"
echo "========================================="
