#!/bin/bash

echo "=========================================="
echo "供应商资料校验API - 示例测试脚本"
echo "=========================================="
echo ""

BASE_URL="http://localhost:3000"

echo "1. 检查服务健康状态..."
curl -s "$BASE_URL/health" | head -5
echo -e "\n"

echo "2. 测试缺失字段拦截（应该失败）..."
curl -s -X POST "$BASE_URL/api/vendors" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_code": "VENDOR002",
    "vendor_name": "测试供应商",
    "contact_person": "李四",
    "payment_bank": "中国建设银行"
  }' | python3 -m json.tool
echo -e "\n"

echo "3. 测试格式错误校验（应该失败）..."
curl -s -X POST "$BASE_URL/api/vendors" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_code": "VENDOR003",
    "vendor_name": "格式测试公司",
    "business_license": "91110108MA001ABC12",
    "business_license_expiry": "2030-12-31",
    "contact_person": "王五",
    "contact_phone": "12345",
    "contact_email": "not-an-email",
    "payment_bank": "中国银行",
    "payment_account": "123",
    "payment_account_name": "格式测试公司"
  }' | python3 -m json.tool
echo -e "\n"

echo "4. 测试完整数据提交（应该通过）..."
VALIDATION_RESULT=$(curl -s -X POST "$BASE_URL/api/vendors" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_code": "VENDOR001",
    "vendor_name": "示例供应商有限公司",
    "business_license": "91110108MA001ABC12",
    "business_license_expiry": "2030-12-31",
    "contact_person": "张三",
    "contact_phone": "13800138000",
    "contact_email": "zhangsan@example.com",
    "payment_bank": "中国工商银行北京分行",
    "payment_account": "6222020200010001234",
    "payment_account_name": "示例供应商有限公司"
  }')
echo "$VALIDATION_RESULT" | python3 -m json.tool
echo -e "\n"

echo "5. 测试幂等性 - 再次提交相同数据..."
curl -s -X POST "$BASE_URL/api/vendors" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_code": "VENDOR001",
    "vendor_name": "示例供应商有限公司",
    "business_license": "91110108MA001ABC12",
    "business_license_expiry": "2030-12-31",
    "contact_person": "张三",
    "contact_phone": "13800138000",
    "contact_email": "zhangsan@example.com",
    "payment_bank": "中国工商银行北京分行",
    "payment_account": "6222020200010001234",
    "payment_account_name": "示例供应商有限公司"
  }' | python3 -m json.tool
echo -e "\n"

echo "6. 查询供应商列表..."
curl -s "$BASE_URL/api/vendors" | python3 -m json.tool
echo -e "\n"

echo "7. 查询供应商详情..."
curl -s "$BASE_URL/api/vendors/VENDOR001" | python3 -m json.tool
echo -e "\n"

echo "8. 更新供应商状态..."
curl -s -X PUT "$BASE_URL/api/vendors/VENDOR001/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "corrected"}' | python3 -m json.tool
echo -e "\n"

echo "测试完成！"
echo "=========================================="
