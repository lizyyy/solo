#!/bin/bash
set -e

CURL="curl -s --noproxy '*'"

echo "=== Test Script for Round 2 Bug Fixes ==="
echo ""

echo "=== 1. Creating batch ==="
BATCH_RESPONSE=$($CURL -X POST http://localhost:8080/api/batches \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Batch Round 2"}')
BATCH_ID=$(echo "$BATCH_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id', d.get('error', 'ERROR')))")
echo "   Batch ID: $BATCH_ID"
echo "$BATCH_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print('   Status:', d.get('status', d.get('error', 'ERROR')))" 2>/dev/null || echo "   Response: $BATCH_RESPONSE"

echo ""
echo "=== 2. Importing declarations ==="
$CURL -X POST "http://localhost:8080/api/batches/$BATCH_ID/import/declarations" \
  -F "file=@examples/declarations.csv" > /dev/null
echo "   Done"

echo ""
echo "=== 3. Importing tariffs ==="
$CURL -X POST "http://localhost:8080/api/batches/$BATCH_ID/import/tariffs" \
  -F "file=@examples/tariffs.json" > /dev/null
echo "   Done"

echo ""
echo "=== 4. Importing return receipts ==="
$CURL -X POST "http://localhost:8080/api/batches/$BATCH_ID/import/return-receipts" \
  -F "file=@examples/return_receipts.json" > /dev/null
echo "   Done"

echo ""
echo "=== 5. First ProcessBatch (should create items) ==="
$CURL -X POST "http://localhost:8080/api/batches/$BATCH_ID/process" > /dev/null
echo "   Done"

echo ""
echo "=== 6. Get item count before second process ==="
ITEMS_BEFORE=$($CURL "http://localhost:8080/api/batches/$BATCH_ID/items" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))")
echo "   Item count: $ITEMS_BEFORE"

echo ""
echo "=== 7. Second ProcessBatch (should NOT duplicate items) ==="
$CURL -X POST "http://localhost:8080/api/batches/$BATCH_ID/process" > /dev/null
echo "   Done"

echo ""
echo "=== 8. Get item count after second process (Bug Fix #2) ==="
ITEMS_AFTER=$($CURL "http://localhost:8080/api/batches/$BATCH_ID/items" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))")
echo "   Item count before: $ITEMS_BEFORE, after: $ITEMS_AFTER"
if [ "$ITEMS_BEFORE" = "$ITEMS_AFTER" ]; then
    echo "   PASS: No duplicate items after re-process!"
else
    echo "   FAIL: Items duplicated! Before=$ITEMS_BEFORE, After=$ITEMS_AFTER"
fi

echo ""
echo "=== 9. Get first item for review test ==="
ITEMS=$($CURL "http://localhost:8080/api/batches/$BATCH_ID/items")
FIRST_ITEM_ID=$(echo "$ITEMS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'])")
FIRST_ITEM_TAX=$(echo "$ITEMS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['final_tax_amount'])")
echo "   Item ID: $FIRST_ITEM_ID"
echo "   Final tax before review: $FIRST_ITEM_TAX"

echo ""
echo "=== 10. Review with ONLY new_tax_rate (Bug Fix #1) ==="
echo "   Sending: new_tax_rate=0.15, NO new_tax_amount"
REVIEW_RESPONSE=$($CURL -X POST "http://localhost:8080/api/items/review" \
  -H "Content-Type: application/json" \
  -d "{
    \"item_id\": \"$FIRST_ITEM_ID\",
    \"reviewer\": \"TestUser\",
    \"new_tax_rate\": 0.15,
    \"notes\": \"Only adjust rate\",
    \"resolve_discrepancies\": true
}")
echo "   Review response: $(echo "$REVIEW_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Old:', d.get('old_tax_amount','ERR'), 'New:', d.get('new_tax_amount','ERR'))" 2>/dev/null || echo "$REVIEW_RESPONSE")"

echo ""
echo "=== 11. Check final_tax_amount was NOT set to 0 ==="
ITEM_AFTER=$($CURL "http://localhost:8080/api/items/$FIRST_ITEM_ID/trace")
FINAL_TAX_AFTER=$(echo "$ITEM_AFTER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['item']['final_tax_amount'])")
echo "   Final tax after review: $FINAL_TAX_AFTER"

if [ "$FINAL_TAX_AFTER" = "0" ] || [ "$FINAL_TAX_AFTER" = "0E-10" ] || [ "$FINAL_TAX_AFTER" = "0.0000" ]; then
    echo "   FAIL: final_tax_amount was incorrectly set to 0!"
else
    echo "   PASS: final_tax_amount preserved ($FINAL_TAX_AFTER)!"
fi

echo ""
echo "=== 12. Check discrepancies resolved (from round 1) ==="
UNRESOLVED=$(echo "$ITEM_AFTER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(1 for x in d.get('discrepancies',[]) if not x.get('is_resolved', False)))")
echo "   Unresolved discrepancies: $UNRESOLVED"
if [ "$UNRESOLVED" = "0" ]; then
    echo "   PASS: All discrepancies resolved!"
else
    echo "   FAIL: $UNRESOLVED discrepancies still not resolved"
fi

echo ""
echo "=== 13. Check batch summary is NOT zero ==="
BATCH_DATA=$($CURL "http://localhost:8080/api/batches/$BATCH_ID")
MATCHED=$(echo "$BATCH_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('matched_count',-1))")
DISC=$(echo "$BATCH_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('discrepancy_count',-1))")
echo "   Matched: $MATCHED, Discrepancy: $DISC"
if [ "$MATCHED" = "-1" ] || [ "$DISC" = "-1" ]; then
    echo "   FAIL: Could not get batch summary!"
elif [ "$MATCHED" = "0" ] && [ "$DISC" = "0" ]; then
    echo "   FAIL: Batch summary is still zero!"
else
    echo "   PASS: Batch summary has real values!"
fi

echo ""
echo "=== 14. Test report generation and download (round 1) ==="
REPORT_RESPONSE=$($CURL -X POST "http://localhost:8080/api/reports" \
  -H "Content-Type: application/json" \
  -d "{\"batch_id\":\"$BATCH_ID\",\"report_type\":\"full\",\"format\":\"csv\",\"generated_by\":\"Test\"}")
REPORT_ID=$(echo "$REPORT_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id','ERROR'))")
echo "   Report ID: $REPORT_ID"

DOWNLOAD_STATUS=$($CURL -o /dev/null -w "%{http_code}" "http://localhost:8080/api/reports/$REPORT_ID/download")
echo "   Download status: $DOWNLOAD_STATUS"
if [ "$DOWNLOAD_STATUS" = "200" ]; then
    echo "   PASS: Report download works!"
else
    echo "   FAIL: Report download failed!"
fi

echo ""
echo "=== All Tests Completed ==="
