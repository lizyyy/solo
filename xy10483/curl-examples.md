# 资料室借阅逾期 API - 样例Curl

## 环境说明
- 服务地址: http://localhost:3000
- 默认用户:
  - admin / admin123 (管理员, 密级3)
  - approver / approver123 (审批人, 密级2)
  - user / user123 (普通用户, 密级1)

---

## 1. 登录获取Token

```bash
# 管理员登录
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 审批人登录
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"approver","password":"approver123"}'

# 普通用户登录
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"user123"}'
```

---

## 2. 资料建档 (管理员)

```bash
# 先登录获取ADMIN_TOKEN
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

# 创建普通资料 (密级0)
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "title": "日常办公规范手册",
    "type": "technical",
    "secret_level": 0,
    "description": "公司日常办公流程规范"
  }'

# 创建机密资料 (密级2)
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "title": "2026年度财务预算报告",
    "type": "contract",
    "secret_level": 2,
    "description": "公司2026年度详细财务预算"
  }'
```

---

## 3. 普通资料借还流程

```bash
# 普通用户登录
USER_TOKEN=$(curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"user123"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

# 查看所有可借阅资料
curl -X GET http://localhost:3000/api/documents \
  -H "Authorization: Bearer $USER_TOKEN"

# 借阅普通资料 (doc-001: 普通合同模板, 密级0 - 无需审批)
BORROW_RESULT=$(curl -s -X POST http://localhost:3000/api/borrow \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{"document_id":"doc-001","borrow_days":7}')
echo "$BORROW_RESULT"
BORROW_ID=$(echo "$BORROW_RESULT" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

# 查看借阅历史
curl -X GET "http://localhost:3000/api/borrow/history" \
  -H "Authorization: Bearer $USER_TOKEN"

# 归还资料 (幂等: 重复调用同一接口返回相同结果)
curl -X POST "http://localhost:3000/api/borrow/$BORROW_ID/return" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN"

# 再次归还 (验证幂等性)
curl -X POST "http://localhost:3000/api/borrow/$BORROW_ID/return" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN"
```

---

## 4. 高密级资料审批流程

```bash
# 普通用户登录
USER_TOKEN=$(curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"user123"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

# 审批人登录
APPROVER_TOKEN=$(curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"approver","password":"approver123"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

# 普通用户申请借阅高密级资料 (doc-003: 密级2 - 需要审批)
# 注意: 需要user的max_secret_level >= 2才能申请，这里先用admin创建一个高权限用户测试
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

# 先创建一个可以访问密级2的用户
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"username":"senior_user","password":"senior123","role":"user","max_secret_level":2}'

# 高权限用户登录
SENIOR_TOKEN=$(curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"senior_user","password":"senior123"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

# 申请借阅高密级资料 (doc-003)
echo "=== 高级用户申请借阅高密级资料 ==="
BORROW_PENDING=$(curl -s -X POST http://localhost:3000/api/borrow \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SENIOR_TOKEN" \
  -d '{"document_id":"doc-003","borrow_days":14}')
echo "$BORROW_PENDING"
PENDING_BORROW_ID=$(echo "$BORROW_PENDING" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

# 审批人查看待审批事项
echo -e "\n=== 审批人查看待审批借阅申请 ==="
curl -X GET http://localhost:3000/api/borrow/pending \
  -H "Authorization: Bearer $APPROVER_TOKEN"

# 审批人查看所有待审批事项统计
echo -e "\n=== 审批人查看待审批统计 ==="
curl -X GET http://localhost:3000/api/statistics/pending-approvals \
  -H "Authorization: Bearer $APPROVER_TOKEN"

# 审批人批准申请
echo -e "\n=== 审批人批准申请 ==="
curl -X POST "http://localhost:3000/api/borrow/$PENDING_BORROW_ID/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $APPROVER_TOKEN" \
  -d '{"borrow_days":14}'
```

---

## 5. 续借流程 (追踪审批人)

```bash
# 使用上面的SENIOR_TOKEN

# 先借一个普通资料来测试续借
echo -e "\n=== 借阅普通资料用于续借测试 ==="
BORROW_RENEW=$(curl -s -X POST http://localhost:3000/api/borrow \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SENIOR_TOKEN" \
  -d '{"document_id":"doc-001","borrow_days":3}')
echo "$BORROW_RENEW"
RENEW_TEST_ID=$(echo "$BORROW_RENEW" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

# 第一次续借 (普通资料无需审批)
echo -e "\n=== 第一次续借 ==="
curl -X POST "http://localhost:3000/api/borrow/$RENEW_TEST_ID/renew" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SENIOR_TOKEN" \
  -d '{"renew_days":7}'

# 第二次续借
echo -e "\n=== 第二次续借 ==="
curl -X POST "http://localhost:3000/api/borrow/$RENEW_TEST_ID/renew" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SENIOR_TOKEN" \
  -d '{"renew_days":7}'

# 第三次续借 (应该失败 - 已达最大次数)
echo -e "\n=== 第三次续借 (应该失败) ==="
curl -X POST "http://localhost:3000/api/borrow/$RENEW_TEST_ID/renew" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SENIOR_TOKEN" \
  -d '{"renew_days":7}'

# 高密级资料续借 (需要审批)
echo -e "\n=== 高密级资料续借申请 ==="
curl -X POST "http://localhost:3000/api/borrow/$PENDING_BORROW_ID/renew" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SENIOR_TOKEN" \
  -d '{"renew_days":7}'

# 审批人查看待审批续借
echo -e "\n=== 审批人查看待审批续借 ==="
curl -X GET http://localhost:3000/api/renew/pending \
  -H "Authorization: Bearer $APPROVER_TOKEN"
```

---

## 6. 逾期处理

```bash
# 先创建一个资料并借阅，然后我们手动修改数据库来制造逾期
# 实际生产中应该使用定时任务

# 先借一个普通资料
echo -e "\n=== 借阅资料用于逾期测试 ==="
OVERDUE_BORROW=$(curl -s -X POST http://localhost:3000/api/borrow \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SENIOR_TOKEN" \
  -d '{"document_id":"doc-002","borrow_days":1}')
echo "$OVERDUE_BORROW"
OVERDUE_ID=$(echo "$OVERDUE_BORROW" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

# 管理员手动检查逾期 (实际会根据due_time判断)
echo -e "\n=== 检查逾期 ==="
curl -X POST http://localhost:3000/api/overdue/check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $APPROVER_TOKEN"

# 查看逾期名单
echo -e "\n=== 查看逾期名单 ==="
curl -X GET http://localhost:3000/api/statistics/overdue-list \
  -H "Authorization: Bearer $APPROVER_TOKEN"

# 逾期用户尝试新借阅 (应该失败 - 有逾期未处理)
echo -e "\n=== 逾期用户尝试新借阅 (应该失败) ==="
curl -X POST http://localhost:3000/api/borrow \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SENIOR_TOKEN" \
  -d '{"document_id":"doc-001","borrow_days":7}'

# 处理逾期 - 提醒
echo -e "\n=== 处理逾期: 发送提醒 ==="
curl -X POST http://localhost:3000/api/overdue/handle \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $APPROVER_TOKEN" \
  -d '{
    "borrow_record_id":"'"$OVERDUE_ID"'",
    "action":"remind",
    "description":"已发送逾期提醒邮件"
  }'

# 处理逾期 - 强制归还
echo -e "\n=== 处理逾期: 强制归还 ==="
curl -X POST http://localhost:3000/api/overdue/handle \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $APPROVER_TOKEN" \
  -d '{
    "borrow_record_id":"'"$OVERDUE_ID"'",
    "action":"force_return",
    "description":"逾期超过7天，强制归还"
  }'
```

---

## 7. 销毁流程 (不可逆提示 + 确认记录)

```bash
# 先创建一个待销毁的资料
echo -e "\n=== 创建待销毁资料 ==="
DESTROY_DOC=$(curl -s -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "title": "2020年度旧合同",
    "type": "contract",
    "secret_level": 0,
    "description": "已过期的2020年度合同"
  }')
echo "$DESTROY_DOC"
DESTROY_DOC_ID=$(echo "$DESTROY_DOC" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

# 尝试销毁但不确认 (应该失败)
echo -e "\n=== 尝试销毁但不确认 (应该失败) ==="
curl -X POST "http://localhost:3000/api/documents/$DESTROY_DOC_ID/destroy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "reason": "合同已过保存期限，按规定销毁"
  }'

# 正确销毁 (带确认)
echo -e "\n=== 正确销毁 (带确认) ==="
curl -X POST "http://localhost:3000/api/documents/$DESTROY_DOC_ID/destroy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "reason": "合同已过保存期限，按规定销毁",
    "confirmation": "确认销毁，此操作不可逆"
  }'

# 尝试借阅已销毁资料 (应该失败)
echo -e "\n=== 尝试借阅已销毁资料 (应该失败) ==="
curl -X POST http://localhost:3000/api/borrow \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SENIOR_TOKEN" \
  -d '{"document_id":"'"$DESTROY_DOC_ID"'","borrow_days":7}'
```

---

## 8. 查询接口

```bash
# 借阅历史
echo -e "\n=== 借阅历史 ==="
curl -X GET http://localhost:3000/api/borrow/history \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 按用户筛选借阅历史
echo -e "\n=== 按用户筛选借阅历史 ==="
curl -X GET "http://localhost:3000/api/borrow/history?user_id=admin-001" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 密级分布统计
echo -e "\n=== 密级分布统计 ==="
curl -X GET http://localhost:3000/api/statistics/secret-distribution \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 待审批事项
echo -e "\n=== 待审批事项 ==="
curl -X GET http://localhost:3000/api/statistics/pending-approvals \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 逾期名单
echo -e "\n=== 逾期名单 ==="
curl -X GET http://localhost:3000/api/statistics/overdue-list \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 9. 权限限制测试

```bash
# 普通用户尝试访问密级3资料 (doc-004)
echo -e "\n=== 普通用户尝试查看密级3资料 ==="
curl -X GET http://localhost:3000/api/documents/doc-004 \
  -H "Authorization: Bearer $USER_TOKEN"

# 普通用户尝试创建资料 (应该失败)
echo -e "\n=== 普通用户尝试创建资料 ==="
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{"title":"测试","type":"contract","secret_level":0}'

# 普通用户尝试审批 (应该失败)
echo -e "\n=== 普通用户尝试审批 ==="
curl -X POST "http://localhost:3000/api/borrow/test-id/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN"
```
