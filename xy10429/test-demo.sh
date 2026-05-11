#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "========================================"
echo "  课程作业补交 API 演示脚本"
echo "========================================"
echo ""

echo "[1] 查看所有课程"
curl -s "$BASE_URL/courses" | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "[2] 查看所有学生"
curl -s "$BASE_URL/students" | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "[3] 老师发布 2 门作业"
echo "  - 数据结构作业 (截止: 未来 1 天)"
echo "  - 计算机网络作业 (截止: 过去 1 天 - 用于测试迟交)"
FUTURE=$(date -u -v+1d +"%Y-%m-%dT%H:%M:%SZ")
PAST=$(date -u -v-1d +"%Y-%m-%dT%H:%M:%SZ")

curl -s -X POST "$BASE_URL/assignments" \
  -H "Content-Type: application/json" \
  -d "{
    \"courseId\": \"C001\",
    \"title\": \"数据结构第一次作业\",
    \"description\": \"实现链表和栈\",
    \"deadline\": \"$FUTURE\",
    \"createdBy\": \"T001\"
  }" | python3 -m json.tool
echo ""

curl -s -X POST "$BASE_URL/assignments" \
  -H "Content-Type: application/json" \
  -d "{
    \"courseId\": \"C002\",
    \"title\": \"计算机网络第一次作业\",
    \"description\": \"TCP/IP 协议分析\",
    \"deadline\": \"$PAST\",
    \"createdBy\": \"T002\"
  }" | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "[4] 查看所有作业"
ASSIGNMENTS=$(curl -s "$BASE_URL/assignments")
echo "$ASSIGNMENTS" | python3 -m json.tool
A001=$(echo "$ASSIGNMENTS" | python3 -c "import sys,json; d=json.load(sys.stdin); print([a['id'] for a in d['data'] if a['courseId']=='C001'][0])")
A002=$(echo "$ASSIGNMENTS" | python3 -c "import sys,json; d=json.load(sys.stdin); print([a['id'] for a in d['data'] if a['courseId']=='C002'][0])")
echo "作业 ID: $A001 (数据结构), $A002 (计算机网络)"
echo ""
echo "----------------------------------------"

echo "[5] 正常提交: 张三 (S001) 提交数据结构作业"
curl -s -X POST "$BASE_URL/assignments/$A001/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "S001",
    "content": "张三的链表实现代码..."
  }' | python3 -m json.tool
echo ""

echo "[6] 覆盖提交: 张三 (S001) 重新提交数据结构作业 (版本号增加)"
curl -s -X POST "$BASE_URL/assignments/$A001/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "S001",
    "content": "张三的链表实现代码 v2.0 (修复了边界问题)..."
  }' | python3 -m json.tool
echo ""

echo "[7] 李四 (S002) 也提交数据结构作业"
curl -s -X POST "$BASE_URL/assignments/$A001/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "S002",
    "content": "李四的作业答案..."
  }' | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "[8] 测试迟交: 赵六 (S004) 尝试直接提交已截止的计算机网络作业"
echo "  (应该被拒绝，提示需要先申请补交)"
curl -s -X POST "$BASE_URL/assignments/$A002/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "S004",
    "content": "赵六迟交的作业..."
  }' | python3 -m json.tool
echo ""

echo "[9] 赵六 (S004) 申请补交"
REQ_RES=$(curl -s -X POST "$BASE_URL/assignments/$A002/extension-request" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "S004",
    "reason": "家里有事耽误了，恳请老师批准补交"
  }')
echo "$REQ_RES" | python3 -m json.tool
REQ_ID=$(echo "$REQ_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])")
echo ""

echo "[10] 测试重复申请: 赵六再次点击申请补交"
echo "  (应该返回已有待审批申请，不产生重复记录)"
curl -s -X POST "$BASE_URL/assignments/$A002/extension-request" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "S004",
    "reason": "家里有事耽误了，恳请老师批准补交"
  }' | python3 -m json.tool
echo ""

echo "[11] 老师审批: 批准赵六的补交申请"
curl -s -X POST "$BASE_URL/extension-requests/$REQ_ID/review" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "reviewedBy": "T002",
    "comment": "批准一次，下次注意"
  }' | python3 -m json.tool
echo ""

echo "[12] 赵六获批后提交迟交作业"
curl -s -X POST "$BASE_URL/assignments/$A002/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "S004",
    "content": "赵六的迟交作业答案..."
  }' | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "[13] 钱七 (S005) 也申请补交，但被老师驳回"
REQ_RES2=$(curl -s -X POST "$BASE_URL/assignments/$A002/extension-request" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "S005",
    "reason": "忘记了"
  }')
REQ_ID2=$(echo "$REQ_RES2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])")
echo "申请已创建: $REQ_ID2"

curl -s -X POST "$BASE_URL/extension-requests/$REQ_ID2/review" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "reject",
    "reviewedBy": "T002",
    "comment": "理由不充分，不予批准"
  }' | python3 -m json.tool
echo ""

echo "[14] 钱七被驳回后尝试提交 (应该被拒绝)"
curl -s -X POST "$BASE_URL/assignments/$A002/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "S005",
    "content": "钱七的作业..."
  }' | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "[15] 老师批改张三的数据结构作业"
SUB_LIST=$(curl -s "$BASE_URL/submissions?assignmentId=$A001")
echo "当前提交列表:"
echo "$SUB_LIST" | python3 -m json.tool
S001_SUB_ID=$(echo "$SUB_LIST" | python3 -c "import sys,json; d=json.load(sys.stdin); print([s['id'] for s in d['data'] if s['studentId']=='S001'][0])")
S002_SUB_ID=$(echo "$SUB_LIST" | python3 -c "import sys,json; d=json.load(sys.stdin); print([s['id'] for s in d['data'] if s['studentId']=='S002'][0])")
echo ""

echo "给张三打 95 分"
curl -s -X POST "$BASE_URL/assignments/$A001/submissions/$S001_SUB_ID/grade" \
  -H "Content-Type: application/json" \
  -d '{
    "grade": 95,
    "feedback": "代码清晰，考虑周全，优秀！",
    "gradedBy": "T001"
  }' | python3 -m json.tool
echo ""

echo "[16] 退回重交: 老师把李四的作业退回，让他重写"
curl -s -X POST "$BASE_URL/assignments/$A001/submissions/$S002_SUB_ID/return" \
  -H "Content-Type: application/json" \
  -d '{
    "feedback": "逻辑有问题，请重新检查第 3 部分",
    "returnedBy": "T001"
  }' | python3 -m json.tool
echo ""

echo "[17] 李四重交作业"
curl -s -X POST "$BASE_URL/assignments/$A001/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "S002",
    "content": "李四的作业答案 v2 (已修复第 3 部分的逻辑问题)..."
  }' | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "[18] 老师给李四的重交作业打分，然后锁定成绩"
S002_SUB_ID_V2=$(curl -s "$BASE_URL/submissions?assignmentId=$A001&studentId=S002" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'])")
echo "新提交 ID: $S002_SUB_ID_V2"

curl -s -X POST "$BASE_URL/assignments/$A001/submissions/$S002_SUB_ID_V2/grade" \
  -H "Content-Type: application/json" \
  -d '{
    "grade": 88,
    "feedback": "修正正确，这次不错",
    "gradedBy": "T001"
  }' | python3 -m json.tool
echo ""

echo "[19] 锁定数据结构作业成绩"
curl -s -X POST "$BASE_URL/assignments/$A001/lock" | python3 -m json.tool
echo ""

echo "[20] 锁定后张三尝试再次修改提交 (应该被拒绝)"
curl -s -X POST "$BASE_URL/assignments/$A001/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "S001",
    "content": "张三想再改一下..."
  }' | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "[21] 查询统计 - 数据结构作业完成情况"
curl -s "$BASE_URL/assignments/$A001/stats" | python3 -m json.tool
echo ""

echo "[22] 查询统计 - 计算机网络作业完成情况"
curl -s "$BASE_URL/assignments/$A002/stats" | python3 -m json.tool
echo ""

echo "[23] 查看待审批清单"
curl -s "$BASE_URL/extension-requests?status=pending" | python3 -m json.tool
echo ""

echo "[24] 查看所有补交申请记录"
curl -s "$BASE_URL/extension-requests" | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo ""
echo "========================================"
echo "  演示结束"
echo "========================================"
