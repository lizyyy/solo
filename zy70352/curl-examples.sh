#!/bin/bash
BASE_URL="http://localhost:3000/api/attachments"

echo "======================================"
echo "1. 创建并上传干净附件 - 扫描通过"
echo "======================================"

CLEAN_ATTACHMENT=$(curl -s -X POST "$BASE_URL/create" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "invoice.pdf",
    "contentType": "application/pdf",
    "size": 1024000,
    "customerId": "cust_1001",
    "uploadSource": "customer"
  }')

echo "创建结果:"
echo "$CLEAN_ATTACHMENT" | python3 -m json.tool 2>/dev/null || echo "$CLEAN_ATTACHMENT"

CLEAN_ID=$(echo "$CLEAN_ATTACHMENT" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"\([^"]*\)"/\1/')
echo "附件ID: $CLEAN_ID"

echo ""
echo "--- 发起扫描 ---"
SCAN_RESULT=$(curl -s -X POST "$BASE_URL/$CLEAN_ID/scan" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "扫描结果:"
echo "$SCAN_RESULT" | python3 -m json.tool 2>/dev/null || echo "$SCAN_RESULT"

echo ""
echo "--- 查询附件状态 ---"
STATUS=$(curl -s "$BASE_URL/$CLEAN_ID")
echo "状态查询结果:"
echo "$STATUS" | python3 -m json.tool 2>/dev/null || echo "$STATUS"

echo ""
echo "--- 关联工单 ---"
REFERENCE=$(curl -s -X POST "$BASE_URL/$CLEAN_ID/reference" \
  -H "Content-Type: application/json" \
  -d '{
    "businessType": "ticket",
    "businessId": "TKT-2026-001"
  }')

echo "关联结果:"
echo "$REFERENCE" | python3 -m json.tool 2>/dev/null || echo "$REFERENCE"

echo ""
echo "--- 下载附件 ---"
DOWNLOAD=$(curl -s "$BASE_URL/$CLEAN_ID/download")
echo "下载结果:"
echo "$DOWNLOAD" | python3 -m json.tool 2>/dev/null || echo "$DOWNLOAD"

echo ""
echo "======================================"
echo "2. 创建可疑附件 - 扫描失败"
echo "======================================"

SUSPICIOUS_ATTACHMENT=$(curl -s -X POST "$BASE_URL/create" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "suspicious-file.exe",
    "contentType": "application/x-msdownload",
    "size": 512000,
    "customerId": "cust_1002",
    "uploadSource": "customer"
  }')

echo "创建结果:"
echo "$SUSPICIOUS_ATTACHMENT" | python3 -m json.tool 2>/dev/null || echo "$SUSPICIOUS_ATTACHMENT"

SUSPICIOUS_ID=$(echo "$SUSPICIOUS_ATTACHMENT" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"\([^"]*\)"/\1/')
echo "附件ID: $SUSPICIOUS_ID"

echo ""
echo "--- 发起扫描 ---"
SCAN_FAIL=$(curl -s -X POST "$BASE_URL/$SUSPICIOUS_ID/scan" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "扫描失败结果:"
echo "$SCAN_FAIL" | python3 -m json.tool 2>/dev/null || echo "$SCAN_FAIL"

echo ""
echo "--- 尝试下载失败附件 ---"
DOWNLOAD_FAIL=$(curl -s "$BASE_URL/$SUSPICIOUS_ID/download")
echo "下载失败结果:"
echo "$DOWNLOAD_FAIL" | python3 -m json.tool 2>/dev/null || echo "$DOWNLOAD_FAIL"

echo ""
echo "======================================"
echo "3. 复扫成功"
echo "======================================"

RESCAN_ATTACHMENT=$(curl -s -X POST "$BASE_URL/create" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "updated-archive.zip",
    "contentType": "application/zip",
    "size": 2048000,
    "customerId": "cust_1003",
    "uploadSource": "customer"
  }')

echo "创建结果:"
echo "$RESCAN_ATTACHMENT" | python3 -m json.tool 2>/dev/null || echo "$RESCAN_ATTACHMENT"

RESCAN_ID=$(echo "$RESCAN_ATTACHMENT" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"\([^"]*\)"/\1/')
echo "附件ID: $RESCAN_ID"

echo ""
echo "--- 首次扫描（强制失败）---"
FIRST_SCAN=$(curl -s -X POST "$BASE_URL/$RESCAN_ID/scan" \
  -H "Content-Type: application/json" \
  -d '{
    "forceResult": "infected"
  }')

echo "首次扫描失败:"
echo "$FIRST_SCAN" | python3 -m json.tool 2>/dev/null || echo "$FIRST_SCAN"

echo ""
echo "--- 尝试引用失败附件 ---"
REF_FAIL=$(curl -s -X POST "$BASE_URL/$RESCAN_ID/reference" \
  -H "Content-Type: application/json" \
  -d '{
    "businessType": "ticket",
    "businessId": "TKT-2026-002"
  }')

echo "引用失败结果:"
echo "$REF_FAIL" | python3 -m json.tool 2>/dev/null || echo "$REF_FAIL"

echo ""
echo "--- 复扫（强制通过）---"
RESCAN_OK=$(curl -s -X POST "$BASE_URL/$RESCAN_ID/rescan" \
  -H "Content-Type: application/json" \
  -d '{
    "force": true,
    "forceResult": "clean"
  }')

echo "复扫成功结果:"
echo "$RESCAN_OK" | python3 -m json.tool 2>/dev/null || echo "$RESCAN_OK"

echo ""
echo "--- 复扫后关联工单 ---"
REF_OK=$(curl -s -X POST "$BASE_URL/$RESCAN_ID/reference" \
  -H "Content-Type: application/json" \
  -d '{
    "businessType": "ticket",
    "businessId": "TKT-2026-002"
  }')

echo "关联成功结果:"
echo "$REF_OK" | python3 -m json.tool 2>/dev/null || echo "$REF_OK"

echo ""
echo "======================================"
echo "4. 人工放行"
echo "======================================"

MANUAL_ATTACHMENT=$(curl -s -X POST "$BASE_URL/create" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "eicar-test-file.txt",
    "contentType": "text/plain",
    "size": 68,
    "customerId": "cust_1004",
    "uploadSource": "customer"
  }')

echo "创建结果:"
echo "$MANUAL_ATTACHMENT" | python3 -m json.tool 2>/dev/null || echo "$MANUAL_ATTACHMENT"

MANUAL_ID=$(echo "$MANUAL_ATTACHMENT" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"\([^"]*\)"/\1/')
echo "附件ID: $MANUAL_ID"

echo ""
echo "--- 扫描 ---"
MANUAL_SCAN=$(curl -s -X POST "$BASE_URL/$MANUAL_ID/scan" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "扫描失败结果:"
echo "$MANUAL_SCAN" | python3 -m json.tool 2>/dev/null || echo "$MANUAL_SCAN"

echo ""
echo "--- 人工放行（带理由）---"
RELEASE=$(curl -s -X POST "$BASE_URL/$MANUAL_ID/release" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "已知安全文件，用于测试。业务紧急，经安全团队确认放行。",
    "releasedBy": "security_admin_01"
  }')

echo "人工放行结果:"
echo "$RELEASE" | python3 -m json.tool 2>/dev/null || echo "$RELEASE"

echo ""
echo "--- 人工放行后关联工单 ---"
MANUAL_REF=$(curl -s -X POST "$BASE_URL/$MANUAL_ID/reference" \
  -H "Content-Type: application/json" \
  -d '{
    "businessType": "ticket",
    "businessId": "TKT-2026-003"
  }')

echo "关联结果:"
echo "$MANUAL_REF" | python3 -m json.tool 2>/dev/null || echo "$MANUAL_REF"

echo ""
echo "--- 查询完整信息（包含扫描历史和审计记录）---"
FULL_STATUS=$(curl -s "$BASE_URL/$MANUAL_ID")
echo "完整信息:"
echo "$FULL_STATUS" | python3 -m json.tool 2>/dev/null || echo "$FULL_STATUS"

echo ""
echo "======================================"
echo "5. 工单查询 - 查看附件状态"
echo "======================================"
echo "业务系统在查询工单时，通过引用的附件ID查询，接口返回:"
echo "  - canReference: 是否可引用"
echo "  - canDownload: 是否可下载"
echo "  - unavailableReason: 不可用原因（给客服展示）"
echo "  - riskReason: 风险原因"
echo "  - scanRecords: 扫描历史"
echo "  - auditLogs: 审计记录"
echo "  - businessReferences: 引用业务号"

echo ""
echo "查询示例（clean 附件）:"
QUERY_STATUS=$(curl -s "$BASE_URL/$CLEAN_ID")
echo "$QUERY_STATUS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'状态: {data[\"status\"]}')
print(f'可引用: {data[\"canReference\"]}')
print(f'可下载: {data[\"canDownload\"]}')
print(f'扫描次数: {data[\"scanCount\"]}')
print(f'最后扫描结果: {data[\"lastScanResult\"]}')
if data.get('businessReferences'):
    print(f'引用工单: {data[\"businessReferences\"][0][\"businessId\"]}')
" 2>/dev/null || echo "$QUERY_STATUS"

echo ""
echo "======================================"
echo "所有示例执行完成！"
echo "======================================"
