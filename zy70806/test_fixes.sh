#!/bin/bash
set -e

echo "=== Test Script for Bug Fixes ==="
echo ""

# 1. Create Batch
echo "1. Creating batch..."
BATCH_RESPONSE=$(curl -s -X POST http://localhost:8080/api/batches \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Batch 2024"}')
BATCH_ID=$(echo "$BATCH_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "   Batch ID: $BATCH_ID"

# 2. Import Declarations
echo ""
echo "2. Importing declarations..."
curl -s -X POST "http://localhost:8080/api/batches/$BATCH_ID/import/declarations" \
  -F "file=@examples/declarations.csv" > /dev/null
echo "   Done"

# 3. Import Tariffs
echo ""
echo "3. Importing tariffs..."
curl -s -X POST "http://localhost:8080/api/batches/$BATCH_ID/import/tariffs" \
  -F "file=@examples/tariffs.json" > /dev/null
echo "   Done"

# 4. Import Return Receipts
echo ""
echo "4. Importing return receipts..."
curl -s -X POST "http://localhost:8080/api/batches/$BATCH_ID/import/return-receipts" \
  -F "file=@examples/return_receipts.json" > /dev/null
echo "   Done"

# 5. Process Batch
echo ""
echo "5. Processing batch..."
curl -s -X POST "http://localhost:8080/api/batches/$BATCH_ID/process" > /dev/null
echo "   Done"

# 6. Check Batch Summary (Bug Fix #4: No zero counts)
echo ""
echo "6. Checking batch summary..."
BATCH_DATA=$(curl -s "http://localhost:8080/api/batches/$BATCH_ID")
MATCHED_COUNT=$(echo "$BATCH_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('matched_count',-1))")
DISC_COUNT=$(echo "$BATCH_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('discrepancy_count',-1))")
TOTAL_TAX=$(echo "$BATCH_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total_tax_expected',-1))")
echo "   Matched: $MATCHED_COUNT, Discrepancy: $DISC_COUNT, TotalTax: $TOTAL_TAX"
if [ "$MATCHED_COUNT" = "0" ] && [ "$DISC_COUNT" = "0" ]; then
    echo "   FAIL: Counts are still zero!"
else
    echo "   PASS: Batch summary counts are not zero!"
fi

# 7. Check Discrepancies have item_id (Bug Fix #1)
echo ""
echo "7. Checking discrepancies have reconciliation_item_id..."
DISCREPANCIES=$(curl -s "http://localhost:8080/api/batches/$BATCH_ID/discrepancies")
EMPTY_ID_COUNT=$(echo "$DISCREPANCIES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(1 for x in d if x.get('reconciliation_item_id') in ('', None)))")
TOTAL_DISC=$(echo "$DISCREPANCIES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))")
echo "   Total discrepancies: $TOTAL_DISC, Empty item_id: $EMPTY_ID_COUNT"
if [ "$EMPTY_ID_COUNT" = "0" ]; then
    echo "   PASS: All discrepancies have reconciliation_item_id!"
else
    echo "   FAIL: Some discrepancies have empty item_id!"
fi

# 8. Get reconciliation items
echo ""
echo "8. Getting reconciliation items..."
ITEMS=$(curl -s "http://localhost:8080/api/batches/$BATCH_ID/items")
FIRST_ITEM_ID=$(echo "$ITEMS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'])")
echo "   First item ID: $FIRST_ITEM_ID"

# 9. Review item (Bug Fix #2: Resolve discrepancies)
echo ""
echo "9. Reviewing item with resolve_discrepancies=true..."
REVIEW_RESPONSE=$(curl -s -X POST "http://localhost:8080/api/items/review" \
  -H "Content-Type: application/json" \
  -d "{
    \"item_id\": \"$FIRST_ITEM_ID\",
    \"reviewer\": \"TestUser\",
    \"new_tax_rate\": 0.15,
    \"notes\": \"Adjusted rate\",
    \"resolve_discrepancies\": true
}")
echo "   Review done"

# 10. Check if discrepancies were resolved
echo ""
echo "10. Checking if discrepancies were resolved..."
ITEM_DISCREPANCIES=$(curl -s "http://localhost:8080/api/items/$FIRST_ITEM_ID/trace")
UNRESOLVED_COUNT=$(echo "$ITEM_DISCREPANCIES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(1 for x in d.get('discrepancies',[]) if not x.get('is_resolved', False)))")
echo "   Unresolved discrepancies after review: $UNRESOLVED_COUNT"
if [ "$UNRESOLVED_COUNT" = "0" ]; then
    echo "   PASS: All discrepancies resolved after review!"
else
    echo "   FAIL: Some discrepancies still not resolved!"
fi

# 11. Generate report (Bug Fix #3: Report download)
echo ""
echo "11. Generating report..."
REPORT_RESPONSE=$(curl -s -X POST "http://localhost:8080/api/reports" \
  -H "Content-Type: application/json" \
  -d "{
    \"batch_id\": \"$BATCH_ID\",
    \"report_type\": \"full\",
    \"format\": \"csv\",
    \"generated_by\": \"TestUser\"
}")
REPORT_ID=$(echo "$REPORT_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "   Report ID: $REPORT_ID"

# 12. Test report download
echo ""
echo "12. Testing report download..."
DOWNLOAD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/api/reports/$REPORT_ID/download")
echo "   Download status code: $DOWNLOAD_STATUS"
if [ "$DOWNLOAD_STATUS" = "200" ]; then
    echo "   PASS: Report download works!"
else
    echo "   FAIL: Report download failed with status $DOWNLOAD_STATUS!"
fi

echo ""
echo "=== All Tests Completed ==="
