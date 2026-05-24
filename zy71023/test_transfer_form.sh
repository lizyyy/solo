#!/bin/bash
echo "Starting server..."
cd /Users/lzy/pro/solo/workspaces/zy71023
rm -rf ./data
mvn spring-boot:run > /tmp/server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

sleep 20

echo "=== Testing Transfer Form Protection ==="
echo ""

echo "1. Get initial transfer forms:"
curl -s http://localhost:8080/api/transfer-forms > /tmp/tf1.json
cat /tmp/tf1.json | head -80

echo ""
echo "2. Sign transfer form TF-HW08-2024001:"
curl -s -X POST http://localhost:8080/api/transfer-forms/TF-HW08-2024001/sign \
  -H "Content-Type: application/json" \
  -d '{"receiver":"张三","signature":"sig123"}' > /tmp/tf2.json
cat /tmp/tf2.json | head -40

echo ""
echo "3. Create waste record REC-001:"
curl -s -X POST http://localhost:8080/api/waste-records/submit \
  -H "Content-Type: application/json" \
  -d '{"recordNo":"REC-001","category":"HW08","wasteName":"废机油","weight":50,"submitter":"李四"}' > /tmp/wr1.json
cat /tmp/wr1.json | head -40

echo ""
echo "4. Review REC-001:"
curl -s -X POST http://localhost:8080/api/waste-records/review \
  -H "Content-Type: application/json" \
  -d '{"recordNo":"REC-001","reviewer":"王五","passed":true}' > /tmp/wr2.json
cat /tmp/wr2.json | head -40

echo ""
echo "5. Mark REC-001 for transfer with TF-HW08-2024001 (should succeed):"
curl -s -X POST "http://localhost:8080/api/waste-records/mark-transfer?recordNo=REC-001&transferFormNo=TF-HW08-2024001&operator=TEST" > /tmp/wr3.json
cat /tmp/wr3.json | head -50

echo ""
echo "6. Check transfer form is now used:"
curl -s http://localhost:8080/api/transfer-forms/TF-HW08-2024001 > /tmp/tf3.json
cat /tmp/tf3.json | grep -E '"(formNo|isUsed|isSigned)"' | head -5

echo ""
echo "7. Create waste record REC-002:"
curl -s -X POST http://localhost:8080/api/waste-records/submit \
  -H "Content-Type: application/json" \
  -d '{"recordNo":"REC-002","category":"HW08","wasteName":"废柴油","weight":30,"submitter":"赵六"}' > /tmp/wr4.json
cat /tmp/wr4.json | head -30

echo ""
echo "8. Review REC-002:"
curl -s -X POST http://localhost:8080/api/waste-records/review \
  -H "Content-Type: application/json" \
  -d '{"recordNo":"REC-002","reviewer":"王五","passed":true}' > /tmp/wr5.json
cat /tmp/wr5.json | head -30

echo ""
echo "9. Try to bind REC-002 with same TF-HW08-2024001 (should FAIL with TRANSFER_FORM_USED):"
curl -s -X POST "http://localhost:8080/api/waste-records/mark-transfer?recordNo=REC-002&transferFormNo=TF-HW08-2024001&operator=TEST" > /tmp/wr6.json
cat /tmp/wr6.json

echo ""
echo "=== Test Complete ==="
echo ""
echo "Key verification:"
echo "- First bind succeeded (isUsed should be true)"
echo "- Second bind should fail with error code 409 (TRANSFER_FORM_USED)"

kill $SERVER_PID 2>/dev/null
