#!/bin/bash

BASE_URL="http://localhost:3001/api"
OPERATOR="test-admin"

echo "=== 1. 创建海阔天空曲目 ==="
TRACK_RESULT=$(curl -s -X POST "$BASE_URL/tracks" \
  -H "Content-Type: application/json" \
  -H "x-operator: $OPERATOR" \
  -d '{"name":"海阔天空","artist":"Beyond","duration":326,"staminaLevel":3}')
echo $TRACK_RESULT | python3 -c "import sys,json; d=json.load(sys.stdin); print('成功' if d['success'] else '失败')"
TRACK_ID=$(echo $TRACK_RESULT | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])")
echo "曲目ID: $TRACK_ID"

echo ""
echo "=== 2. 导入版权CSV（海阔天空为过期版权，high级警告） ==="
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
echo "=== 3. 查看海阔天空版权状态 ==="
curl -s "$BASE_URL/copyright/track/$TRACK_ID" | python3 -c "
import sys, json
d = json.load(sys.stdin)
c = d['data']
print(f'状态: {c[\"status\"]}, 警告级别: {c[\"warningLevel\"]}')
"

echo ""
echo "=== 4. 测试版权保护：尝试覆盖海阔天空的过期版权 ==="
curl -s -X POST "$BASE_URL/import/copyright" \
  -H "x-operator: $OPERATOR" \
  -F "file=@test_override.csv" \
  -F "fileName=test_override.csv" | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d['data']
print(f'导入结果: 成功={r[\"success\"]}, 失败={r[\"failed\"]}')
if r['badData']:
    for bd in r['badData']:
        if 'high' in bd['errorMessage'] or '过期' in bd['errorMessage']:
            print(f'  ✓ 版权保护生效: {bd[\"errorMessage\"]}')
"

echo ""
echo "=== 5. 验证海阔天空版权仍为 expired ==="
curl -s "$BASE_URL/copyright/track/$TRACK_ID" | python3 -c "
import sys, json
d = json.load(sys.stdin)
c = d['data']
status = '✓ 保护成功' if c['status'] == 'expired' and c['warningLevel'] == 'high' else '✗ 保护失败'
print(f'{status}: 状态={c[\"status\"]}, 警告级别={c[\"warningLevel\"]}')
"

echo ""
echo "=== 6. 查看坏数据档案 ==="
curl -s "$BASE_URL/bad-data" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for bd in d['data']:
    if 'high' in bd['errorMessage'] or '过期' in bd['errorMessage']:
        print(f'  坏数据记录: [{bd[\"sourceFile\"]}:{bd[\"lineNumber\"]}] {bd[\"errorMessage\"]}')
"
