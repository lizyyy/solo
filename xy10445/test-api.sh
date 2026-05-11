#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=== 1. 健康检查 ==="
curl -s "$BASE_URL/api/health" | python3 -m json.tool

echo -e "\n=== 2. 创建训练营 ==="
CAMP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/camps" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2026春季编程训练营",
    "start_date": "2026-05-01",
    "end_date": "2026-06-01",
    "max_retry_sign": 3
  }')
echo "$CAMP_RESPONSE" | python3 -m json.tool
CAMP_ID=$(echo "$CAMP_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "Camp ID: $CAMP_ID"

echo -e "\n=== 3. 学员报名 ==="
STUDENT1_ID="stu_001"
STUDENT2_ID="stu_002"

echo "--- 学员 1: 张三 ---"
ENROLL1=$(curl -s -X POST "$BASE_URL/api/camps/$CAMP_ID/enroll" \
  -H "Content-Type: application/json" \
  -d "{\"student_id\": \"$STUDENT1_ID\", \"student_name\": \"张三\"}")
echo "$ENROLL1" | python3 -m json.tool

echo "--- 学员 2: 李四 ---"
ENROLL2=$(curl -s -X POST "$BASE_URL/api/camps/$CAMP_ID/enroll" \
  -H "Content-Type: application/json" \
  -d "{\"student_id\": \"$STUDENT2_ID\", \"student_name\": \"李四\"}")
echo "$ENROLL2" | python3 -m json.tool

echo -e "\n=== 4. 连续打卡场景（学员张三连续打卡3天）==="

TODAY=$(date +%Y-%m-%d)
DAY1=$(date -v-2d +%Y-%m-%d 2>/dev/null || date -d "2 days ago" +%Y-%m-%d)
DAY2=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "1 day ago" +%Y-%m-%d)
DAY3=$TODAY
LEAK_DAY=$DAY1

echo "--- 第1天打卡 ($DAY1) ---"
SIGN1=$(curl -s -X POST "$BASE_URL/api/camps/$CAMP_ID/students/$STUDENT1_ID/sign" \
  -H "Content-Type: application/json" \
  -d "{\"sign_date\": \"$DAY1\", \"homework_url\": \"https://repo.example.com/day1\"}")
echo "$SIGN1" | python3 -m json.tool
SIGN1_ID=$(echo "$SIGN1" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo "--- 第2天打卡 ($DAY2) ---"
SIGN2=$(curl -s -X POST "$BASE_URL/api/camps/$CAMP_ID/students/$STUDENT1_ID/sign" \
  -H "Content-Type: application/json" \
  -d "{\"sign_date\": \"$DAY2\", \"homework_url\": \"https://repo.example.com/day2\"}")
echo "$SIGN2" | python3 -m json.tool
SIGN2_ID=$(echo "$SIGN2" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo "--- 第3天打卡 ($DAY3) ---"
SIGN3=$(curl -s -X POST "$BASE_URL/api/camps/$CAMP_ID/students/$STUDENT1_ID/sign" \
  -H "Content-Type: application/json" \
  -d "{\"sign_date\": \"$DAY3\", \"homework_url\": \"https://repo.example.com/day3\"}")
echo "$SIGN3" | python3 -m json.tool
SIGN3_ID=$(echo "$SIGN3" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo "--- 重复打卡测试（幂等性）---"
SIGN3_REPEAT=$(curl -s -X POST "$BASE_URL/api/camps/$CAMP_ID/students/$STUDENT1_ID/sign" \
  -H "Content-Type: application/json" \
  -d "{\"sign_date\": \"$DAY3\", \"homework_url\": \"https://repo.example.com/day3-v2\"}")
echo "$SIGN3_REPEAT" | python3 -m json.tool

echo -e "\n=== 5. 作业审核（审核通过3天打卡）==="
echo "--- 审核第1天通过 ---"
curl -s -X POST "$BASE_URL/api/camps/$CAMP_ID/signs/$SIGN1_ID/review" \
  -H "Content-Type: application/json" \
  -d '{"approved": true}' | python3 -m json.tool

echo "--- 审核第2天通过 ---"
curl -s -X POST "$BASE_URL/api/camps/$CAMP_ID/signs/$SIGN2_ID/review" \
  -H "Content-Type: application/json" \
  -d '{"approved": true}' | python3 -m json.tool

echo "--- 审核第3天通过 ---"
curl -s -X POST "$BASE_URL/api/camps/$CAMP_ID/signs/$SIGN3_ID/review" \
  -H "Content-Type: application/json" \
  -d '{"approved": true}' | python3 -m json.tool

echo -e "\n=== 6. 学员李四打卡但作业被退回 ==="
echo "--- 李四打卡 ---"
LI_SIGN=$(curl -s -X POST "$BASE_URL/api/camps/$CAMP_ID/students/$STUDENT2_ID/sign" \
  -H "Content-Type: application/json" \
  -d "{\"sign_date\": \"$TODAY\", \"homework_url\": \"https://repo.example.com/bad\"}")
echo "$LI_SIGN" | python3 -m json.tool
LI_SIGN_ID=$(echo "$LI_SIGN" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo "--- 审核不通过（作业被退回不算有效打卡）---"
curl -s -X POST "$BASE_URL/api/camps/$CAMP_ID/signs/$LI_SIGN_ID/review" \
  -H "Content-Type: application/json" \
  -d '{"approved": false}' | python3 -m json.tool

echo -e "\n=== 7. 漏打卡申请补签场景 ==="
MISS_DAY=$(date -v-3d +%Y-%m-%d 2>/dev/null || date -d "3 days ago" +%Y-%m-%d)
echo "--- 张三漏打卡日期: $MISS_DAY ---"
echo "--- 申请补签 ---"
RETRY1=$(curl -s -X POST "$BASE_URL/api/camps/$CAMP_ID/students/$STUDENT1_ID/retry" \
  -H "Content-Type: application/json" \
  -d "{\"retry_date\": \"$MISS_DAY\", \"homework_url\": \"https://repo.example.com/retry-day0\"}")
echo "$RETRY1" | python3 -m json.tool
RETRY1_ID=$(echo "$RETRY1" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo -e "\n=== 8. 查看统计和排行榜（补签前）==="
echo "--- 统计接口 ---"
curl -s "$BASE_URL/api/camps/$CAMP_ID/statistics" | python3 -m json.tool
echo "--- 排行榜 ---"
curl -s "$BASE_URL/api/camps/$CAMP_ID/leaderboard" | python3 -m json.tool

echo -e "\n=== 9. 审核补签申请 ==="
echo "--- 审核通过补签 ---"
curl -s -X POST "$BASE_URL/api/camps/$CAMP_ID/retries/$RETRY1_ID/review" \
  -H "Content-Type: application/json" \
  -d '{"approved": true}' | python3 -m json.tool

echo -e "\n=== 10. 查看统计和排行榜（补签后，连续天数应增加）==="
echo "--- 统计接口 ---"
curl -s "$BASE_URL/api/camps/$CAMP_ID/statistics" | python3 -m json.tool
echo "--- 排行榜 ---"
curl -s "$BASE_URL/api/camps/$CAMP_ID/leaderboard" | python3 -m json.tool

echo -e "\n=== 11. 补签被拒场景 ==="
MISS_DAY2=$(date -v-4d +%Y-%m-%d 2>/dev/null || date -d "4 days ago" +%Y-%m-%d)
echo "--- 申请另一个补签 ---"
RETRY2=$(curl -s -X POST "$BASE_URL/api/camps/$CAMP_ID/students/$STUDENT1_ID/retry" \
  -H "Content-Type: application/json" \
  -d "{\"retry_date\": \"$MISS_DAY2\", \"homework_url\": \"https://repo.example.com/bad-retry\"}")
echo "$RETRY2" | python3 -m json.tool
RETRY2_ID=$(echo "$RETRY2" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo "--- 审核拒绝（补签被拒）---"
curl -s -X POST "$BASE_URL/api/camps/$CAMP_ID/retries/$RETRY2_ID/review" \
  -H "Content-Type: application/json" \
  -d '{"approved": false}' | python3 -m json.tool

echo -e "\n=== 12. 锁定奖励场景 ==="
echo "--- 锁定张三的奖励 ---"
curl -s -X POST "$BASE_URL/api/camps/$CAMP_ID/students/$STUDENT1_ID/lock-reward" \
  -H "Content-Type: application/json" \
  -d '{"reward_name": "30天打卡金牌"}' | python3 -m json.tool

echo -e "\n=== 13. 奖励锁定后尝试补签（不应影响连续天数）==="
MISS_DAY3=$(date -v-5d +%Y-%m-%d 2>/dev/null || date -d "5 days ago" +%Y-%m-%d)
echo "--- 锁定后申请补签 ---"
RETRY3=$(curl -s -X POST "$BASE_URL/api/camps/$CAMP_ID/students/$STUDENT1_ID/retry" \
  -H "Content-Type: application/json" \
  -d "{\"retry_date\": \"$MISS_DAY3\", \"homework_url\": \"https://repo.example.com/locked-retry\"}")
echo "$RETRY3" | python3 -m json.tool
RETRY3_ID=$(echo "$RETRY3" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo "--- 审核通过（但奖励已锁定，连续天数不应增加）---"
curl -s -X POST "$BASE_URL/api/camps/$CAMP_ID/retries/$RETRY3_ID/review" \
  -H "Content-Type: application/json" \
  -d '{"approved": true}' | python3 -m json.tool

echo -e "\n=== 14. 最终统计和排行榜 ==="
echo "--- 统计接口（显示连续天数、待审补签、奖励状态）---"
curl -s "$BASE_URL/api/camps/$CAMP_ID/statistics" | python3 -m json.tool
echo "--- 排行榜（区分有效打卡和待审核）---"
curl -s "$BASE_URL/api/camps/$CAMP_ID/leaderboard" | python3 -m json.tool

echo -e "\n=== 测试完成 ==="
