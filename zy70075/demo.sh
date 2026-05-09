#!/bin/bash

BASE_URL="http://localhost:3001"
FORM_ID=""

echo "=========================================="
echo "  员工离职权限回收服务 - 完整演示"
echo "=========================================="
echo ""

echo "【步骤 1】创建离职单（员工：王五，工号：E999）"
echo "------------------------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/offboarding-forms" \
  -H "Content-Type: application/json" \
  -d '{"employee_id": "E999", "employee_name": "王五", "department": "市场部", "last_day": "2026-05-25", "operator": "HR-赵六"}')

FORM_ID=$(echo "$RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d)['数据'].id)})")

echo "$RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('✅ 成功:',j['成功']);console.log('💬 提示:',j['提示']);console.log('📋 状态:',j['数据'].status);})"
echo ""

echo "【验证幂等性】再次创建同员工的离职单"
echo "------------------------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/offboarding-forms" \
  -H "Content-Type: application/json" \
  -d '{"employee_id": "E999", "employee_name": "王五", "department": "市场部", "last_day": "2026-05-25", "operator": "HR-赵六"}')
echo "$RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('✅ 成功:',j['成功']);console.log('🔄 重复操作:',j['重复操作']);console.log('💬 原因:',j['原因']);})"
echo ""

echo "【步骤 2】生成权限清单"
echo "------------------------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/offboarding-forms/$FORM_ID/generate-inventory" \
  -H "Content-Type: application/json" \
  -d '{"operator": "系统管理员"}')
echo "$RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('✅ 成功:',j['成功']);console.log('💬 提示:',j['提示']);console.log('📊 权限项数:',j['数据'].length);j['数据'].forEach((p,i)=>console.log('   ',i+1,p.system_name,'-',p.permission_type,'[',p.status,']'));})"
echo ""

echo "【验证幂等性】再次生成权限清单"
echo "------------------------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/offboarding-forms/$FORM_ID/generate-inventory" \
  -H "Content-Type: application/json" \
  -d '{"operator": "系统管理员"}')
echo "$RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('✅ 成功:',j['成功']);console.log('🔄 重复操作:',j['重复操作']);console.log('💬 原因:',j['原因']);})"
echo ""

echo "【步骤 3】创建回收任务"
echo "------------------------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/offboarding-forms/$FORM_ID/create-tasks" \
  -H "Content-Type: application/json" \
  -d '{"operator": "系统管理员"}')
echo "$RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('✅ 成功:',j['成功']);console.log('💬 提示:',j['提示']);console.log('📋 任务数:',j['数据'].length);})"
echo ""

echo "【步骤 4】获取离职单详情"
echo "------------------------------------------"
RESPONSE=$(curl -s "$BASE_URL/api/offboarding-forms/$FORM_ID")
echo "$RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);const f=j['数据']['离职单'];const p=j['数据']['权限清单'];console.log('👤 员工:',f.employee_name,'(',f.employee_id,')');console.log('🏢 部门:',f.department);console.log('📅 最后工作日:',f.last_day);console.log('📊 当前状态:',f.status);console.log('📋 权限清单:',p.length,'项');})"
echo ""

echo "【步骤 5】执行回收任务（先查一下任务ID）"
echo "------------------------------------------"
RESPONSE=$(curl -s "$BASE_URL/api/offboarding-forms/$FORM_ID")
TASKS_INFO=$(echo "$RESPONSE" | node -e "
let d='';
process.stdin.on('data',c=>d+=c).on('end',()=>{
  const j=JSON.parse(d);
  const perms=j['数据']['权限清单'];
  const map={};
  perms.forEach(p=>{
    map[p.system_name]={inventoryId:p.id,permStatus:p.status};
  });
  console.log(JSON.stringify(map));
});
")

VPN_INV_ID=$(echo "$TASKS_INFO" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d)['VPN 系统'].inventoryId)})")
EMAIL_INV_ID=$(echo "$TASKS_INFO" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d)['企业邮箱'].inventoryId)})")

echo "  - VPN 系统权限项 ID: $VPN_INV_ID"
echo "  - 企业邮箱权限项 ID: $EMAIL_INV_ID"
echo ""

echo "【步骤 6】为 VPN 权限申请豁免"
echo "------------------------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/exemptions" \
  -H "Content-Type: application/json" \
  -d "{\"form_id\": \"$FORM_ID\", \"inventory_id\": \"$VPN_INV_ID\", \"reason\": \"离职交接期间需要远程访问内网处理遗留工作\", \"applicant\": \"张三（主管）\"}")
EXEMPTION_ID=$(echo "$RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);if(j['成功']){console.log(j['数据'].id);}})")
echo "$RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('✅ 成功:',j['成功']);console.log('💬 提示:',j['提示']);console.log('📋 豁免状态:',j['数据'].status);})"
echo ""

echo "【步骤 7】审批通过豁免"
echo "------------------------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/exemptions/$EXEMPTION_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"approver": "经理-李四"}')
echo "$RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('✅ 成功:',j['成功']);console.log('💬 提示:',j['提示']);console.log('📋 豁免状态:',j['数据'].status);console.log('👤 审批人:',j['数据'].approver);})"
echo ""

echo "【步骤 8】查看审计报告"
echo "------------------------------------------"
RESPONSE=$(curl -s "$BASE_URL/api/audit-report/$FORM_ID")
echo "$RESPONSE" | node -e "
let d='';
process.stdin.on('data',c=>d+=c).on('end',()=>{
  const j=JSON.parse(d)['数据'];
  console.log('=== 离职单信息 ===');
  console.log('👤 员工:',j.form.employee_name,'(',j.form.employee_id,')');
  console.log('📊 当前状态:',j.form.status);
  console.log('');
  console.log('=== 权限清单汇总 ===');
  const p=j['权限清单'];
  console.log('总数:',p.总数,' | 已回收:',p.已回收,' | 已豁免:',p.已豁免,' | 回收失败:',p.回收失败,' | 待回收:',p.待回收);
  console.log('');
  console.log('=== 豁免申请汇总 ===');
  const e=j['豁免申请'];
  console.log('总数:',e.总数,' | 待审批:',e.待审批,' | 已通过:',e.已通过);
  console.log('');
  console.log('=== 操作日志 ===');
  j['操作日志'].forEach(l=>{
    console.log('🕐',l.时间.substring(11,19),'|',l.操作人,'|',l.动作,'|',l.详情);
  });
});
"
echo ""

echo "=========================================="
echo "  演示结束"
echo "=========================================="
echo ""
echo "离职单号: $FORM_ID"
echo "你可以用 curl 或 Postman 继续测试其他接口"
