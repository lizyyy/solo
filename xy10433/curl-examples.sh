#!/bin/bash

BASE_URL="http://localhost:3002"

echo "=========================================="
echo "内部资产借调 API - Curl 流程示例"
echo "=========================================="
echo ""

echo "=========================================="
echo "场景一：正常借还流程"
echo "=========================================="
echo ""

echo "1. 资产建档 - 投影仪"
curl -X POST "$BASE_URL/api/assets" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_code": "PRJ-001",
    "name": "EPSON 投影仪",
    "category": "投影仪",
    "department": "行政部",
    "total_quantity": 1
  }'
echo ""
echo ""

echo "2. 查看资产列表"
curl -X GET "$BASE_URL/api/assets"
echo ""
echo ""

echo "3. 市场部提交借调申请"
curl -X POST "$BASE_URL/api/borrow-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_code": "PRJ-001",
    "request_department": "市场部",
    "applicant": "张三",
    "purpose": "产品发布会演示",
    "request_quantity": 1,
    "expected_return_date": "2026-05-20"
  }'
echo ""
echo ""

echo "4. 查看待审批申请"
curl -X GET "$BASE_URL/api/borrow-requests?status=pending"
echo ""
echo ""

echo "5. 审批通过，借出资产"
curl -X POST "$BASE_URL/api/borrow-requests/1/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approved_by": "行政经理"
  }'
echo ""
echo ""

echo "6. 查看占用情况"
curl -X GET "$BASE_URL/api/reports/occupancy"
echo ""
echo ""

echo "7. 归还验收（验收结论会记录）"
curl -X POST "$BASE_URL/api/borrow-records/1/return" \
  -H "Content-Type: application/json" \
  -d '{
    "return_quantity": 1,
    "accept_remark": "资产完整，无损坏，功能正常"
  }'
echo ""
echo ""

echo "8. 查看资产历史记录"
curl -X GET "$BASE_URL/api/reports/history?asset_code=PRJ-001"
echo ""
echo ""

echo "=========================================="
echo "场景二：延期未还（逾期列表查询）"
echo "=========================================="
echo ""

echo "1. 新建资产 - 测试机"
curl -X POST "$BASE_URL/api/assets" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_code": "TS-001",
    "name": "MacBook Pro 测试机",
    "category": "测试机",
    "department": "研发部",
    "total_quantity": 1
  }'
echo ""
echo ""

echo "2. 测试部申请借调，设置过期日期"
curl -X POST "$BASE_URL/api/borrow-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_code": "TS-001",
    "request_department": "测试部",
    "applicant": "李四",
    "purpose": "功能测试",
    "request_quantity": 1,
    "expected_return_date": "2026-05-01"
  }'
echo ""
echo ""

echo "3. 审批通过"
curl -X POST "$BASE_URL/api/borrow-requests/2/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approved_by": "研发经理"
  }'
echo ""
echo ""

echo "4. 查询逾期列表"
curl -X GET "$BASE_URL/api/reports/overdue"
echo ""
echo ""

echo "=========================================="
echo "场景三：损坏赔偿流程"
echo "=========================================="
echo ""

echo "1. 新建资产 - 展会物料"
curl -X POST "$BASE_URL/api/assets" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_code": "EXH-001",
    "name": "300寸幕布",
    "category": "展会物料",
    "department": "市场部",
    "total_quantity": 1
  }'
echo ""
echo ""

echo "2. 销售部申请借调"
curl -X POST "$BASE_URL/api/borrow-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_code": "EXH-001",
    "request_department": "销售部",
    "applicant": "王五",
    "purpose": "客户拜访展示",
    "request_quantity": 1,
    "expected_return_date": "2026-05-25"
  }'
echo ""
echo ""

echo "3. 审批通过"
curl -X POST "$BASE_URL/api/borrow-requests/3/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approved_by": "市场经理"
  }'
echo ""
echo ""

echo "4. 登记损坏"
curl -X POST "$BASE_URL/api/damage-records" \
  -H "Content-Type: application/json" \
  -d '{
    "record_id": 3,
    "damage_description": "幕布边角撕裂约5厘米",
    "damage_quantity": 1,
    "estimated_cost": 500.00
  }'
echo ""
echo ""

echo "5. 尝试直接归还（会失败，因为有未处理的损坏）"
curl -X POST "$BASE_URL/api/borrow-records/3/return" \
  -H "Content-Type: application/json" \
  -d '{
    "return_quantity": 1
  }'
echo ""
echo ""

echo "6. 确认赔偿"
curl -X POST "$BASE_URL/api/damage-records/1/compensate" \
  -H "Content-Type: application/json" \
  -d '{
    "compensation_amount": 500.00,
    "compensator": "王五"
  }'
echo ""
echo ""

echo "7. 再次归还"
curl -X POST "$BASE_URL/api/borrow-records/3/return" \
  -H "Content-Type: application/json" \
  -d '{
    "return_quantity": 1,
    "accept_remark": "已赔偿损坏费用，资产已回收"
  }'
echo ""
echo ""

echo "8. 查询损坏成本报表"
curl -X GET "$BASE_URL/api/reports/damage-cost"
echo ""
echo ""

echo "=========================================="
echo "场景四：同一部门重复申请（合并提示）"
echo "=========================================="
echo ""

echo "1. 新建资产 - 测试机2"
curl -X POST "$BASE_URL/api/assets" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_code": "TS-002",
    "name": "Windows 测试机",
    "category": "测试机",
    "department": "研发部",
    "total_quantity": 1
  }'
echo ""
echo ""

echo "2. 测试部第一次申请"
curl -X POST "$BASE_URL/api/borrow-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_code": "TS-002",
    "request_department": "测试部",
    "applicant": "赵六",
    "purpose": "兼容性测试",
    "request_quantity": 1,
    "expected_return_date": "2026-05-30"
  }'
echo ""
echo ""

echo "3. 测试部同一部门同一资产再次申请（会提示有重复申请）"
curl -X POST "$BASE_URL/api/borrow-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_code": "TS-002",
    "request_department": "测试部",
    "applicant": "钱七",
    "purpose": "另一个兼容性测试",
    "request_quantity": 1,
    "expected_return_date": "2026-06-01"
  }'
echo ""
echo ""

echo "=========================================="
echo "规则验证：已借出资产不能再借"
echo "=========================================="
echo ""

echo "1. 新建资产"
curl -X POST "$BASE_URL/api/assets" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_code": "PRJ-002",
    "name": "索尼投影仪",
    "category": "投影仪",
    "department": "行政部",
    "total_quantity": 1
  }'
echo ""
echo ""

echo "2. 财务部第一次申请并审批"
curl -X POST "$BASE_URL/api/borrow-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_code": "PRJ-002",
    "request_department": "财务部",
    "applicant": "孙八",
    "purpose": "年度汇报",
    "request_quantity": 1,
    "expected_return_date": "2026-05-28"
  }'
echo ""
echo ""

curl -X POST "$BASE_URL/api/borrow-requests/5/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approved_by": "行政"
  }'
echo ""
echo ""

echo "3. 人事部尝试申请同一资产（审批时会失败，因为已借出）"
curl -X POST "$BASE_URL/api/borrow-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_code": "PRJ-002",
    "request_department": "人事部",
    "applicant": "周九",
    "purpose": "培训使用",
    "request_quantity": 1,
    "expected_return_date": "2026-05-30"
  }'
echo ""
echo ""

echo "尝试审批（会失败）"
curl -X POST "$BASE_URL/api/borrow-requests/6/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approved_by": "行政"
  }'
echo ""
echo ""

echo "=========================================="
echo "规则验证：归还数量不一致"
echo "=========================================="
echo ""

echo "1. 新建资产"
curl -X POST "$BASE_URL/api/assets" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_code": "EXH-002",
    "name": "易拉宝展架",
    "category": "展会物料",
    "department": "市场部",
    "total_quantity": 2
  }'
echo ""
echo ""

echo "2. 申请借出2个"
curl -X POST "$BASE_URL/api/borrow-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_code": "EXH-002",
    "request_department": "销售部",
    "applicant": "吴十",
    "purpose": "展会使用",
    "request_quantity": 2,
    "expected_return_date": "2026-06-01"
  }'
echo ""
echo ""

echo "3. 审批通过"
curl -X POST "$BASE_URL/api/borrow-requests/7/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approved_by": "市场经理"
  }'
echo ""
echo ""

echo "4. 尝试只归还1个（会失败）"
curl -X POST "$BASE_URL/api/borrow-records/5/return" \
  -H "Content-Type: application/json" \
  -d '{
    "return_quantity": 1
  }'
echo ""
echo ""

echo "5. 正确归还2个"
curl -X POST "$BASE_URL/api/borrow-records/5/return" \
  -H "Content-Type: application/json" \
  -d '{
    "return_quantity": 2,
    "accept_remark": "数量正确，状态良好"
  }'
echo ""
echo ""

echo "=========================================="
echo "各查询接口示例"
echo "=========================================="
echo ""

echo "1. 按部门查询资产"
curl -X GET "$BASE_URL/api/assets?department=行政部"
echo ""
echo ""

echo "2. 按类别查询资产"
curl -X GET "$BASE_URL/api/assets?category=测试机"
echo ""
echo ""

echo "3. 按部门查询借调记录"
curl -X GET "$BASE_URL/api/borrow-records?department=销售部"
echo ""
echo ""

echo "4. 按部门查询占用情况"
curl -X GET "$BASE_URL/api/reports/occupancy?department=行政部"
echo ""
echo ""

echo "5. 按类别查询占用情况"
curl -X GET "$BASE_URL/api/reports/occupancy?category=投影仪"
echo ""
echo ""

echo "6. 查询待赔偿损坏记录"
curl -X GET "$BASE_URL/api/damage-records?status=pending_compensation"
echo ""
echo ""

echo "7. 查询已赔偿损坏记录"
curl -X GET "$BASE_URL/api/damage-records?status=compensated"
echo ""
echo ""

echo "=========================================="
echo "示例完成"
echo "=========================================="
