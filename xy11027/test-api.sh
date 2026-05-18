#!/bin/bash

echo "========================================"
echo "  职业培训班学员证书补办 API 测试脚本"
echo "========================================"
echo ""

BASE_URL="http://localhost:3000"

echo "1. 测试服务是否启动"
echo "------------------------"
curl -s $BASE_URL | head -50
echo ""
echo ""

echo "2. 查询所有补办申请"
echo "------------------------"
curl -s "$BASE_URL/api/certificate-reissue/applications"
echo ""
echo ""

echo "3. 查询XY001学员的申请详情"
echo "------------------------"
curl -s "$BASE_URL/api/certificate-reissue/applications/SQ20240001001
echo ""
echo ""

echo "4. 测试提交补办申请（材料齐全）"
echo "------------------------"
curl -s -X POST "$BASE_URL/api/certificate-reissue/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "学员编号": "XY004",
    "原始证书编号": "ZS00120230004",
    "申请校区编号": "XQ004",
    "补办原因": "遗失",
    "补办原因说明": "出差途中遗失",
    "遗失地点": "北京市海淀区",
    "登报声明编号": "CB202405001",
    "申请人联系电话": "13800138004",
    "申请人通讯地址": "深圳市南山区某某大厦",
    "收件方式": "邮寄"
  }'
echo ""
echo ""

echo "5. 测试多校区重复申请检测（会进入待处理状态）"
echo "------------------------"
echo "先在XQ001校区提交申请:"
curl -s -X POST "$BASE_URL/api/certificate-reissue/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "学员编号": "XY002",
    "原始证书编号": "ZS00220230002",
    "申请校区编号": "XQ001",
    "补办原因": "损毁",
    "申请人联系电话": "13800138002",
    "收件方式": "自取"
  }'
echo ""
echo ""

echo "再在XQ002校区提交同一学员的申请:"
curl -s -X POST "$BASE_URL/api/certificate-reissue/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "学员编号": "XY002",
    "原始证书编号": "ZS00220230002",
    "申请校区编号": "XQ002",
    "补办原因": "遗失",
    "申请人联系电话": "13800138002",
    "收件方式": "邮寄"
  }'
echo ""
echo ""

echo "6. 测试异常场景 - 无效的证书编号"
echo "------------------------"
curl -s -X POST "$BASE_URL/api/certificate-reissue/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "学员编号": "XY001",
    "原始证书编号": "INVALID_CERT",
    "申请校区编号": "XQ001",
    "补办原因": "遗失",
    "申请人联系电话": "13800138001",
    "收件方式": "邮寄"
  }'
echo ""
echo ""

echo "7. 测试导出JSON格式数据"
echo "------------------------"
curl -s "$BASE_URL/api/export/applications" | head -100
echo ""
echo ""

echo "8. 查询待处理状态的申请"
echo "------------------------"
curl -s "$BASE_URL/api/certificate-reissue/applications?申请状态=待处理"
echo ""
echo ""

echo "========================================"
echo "  测试完成！"
echo "========================================"
