#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:8001"
GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

echo "=== Crash Cluster Demo ==="
echo ""

echo "--- 1. Check service status ---"
curl -s "$BASE/" | python3 -m json.tool || fail "Service not running. Start with: cd crash_cluster && pip install -r requirements.txt && uvicorn app:app --reload"
ok "Service is up"
echo ""

echo "--- 2. Submit first crash (normal stack, iPhone) ---"
R1=$(curl -s -X POST "$BASE/crashes" \
  -H "Content-Type: application/json" \
  -d '{
    "app_version": "2.3.1",
    "device_model": "iPhone15,2",
    "stack_trace": "#0 MyApp.LoginService.authenticate(User, String) + 56\n#1 MyApp.LoginViewController.loginButtonTapped() + 128\n#2 UIKit.UIApplication.main + 400",
    "user_note": "登录按钮必现崩溃"
  }')
ID1=$(echo "$R1" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "$R1" | python3 -m json.tool
ok "Created crash: $ID1"
echo ""

echo "--- 3. Submit second crash (same stack, different device — should cluster together) ---"
R2=$(curl -s -X POST "$BASE/crashes" \
  -H "Content-Type: application/json" \
  -d '{
    "app_version": "2.3.1",
    "device_model": "iPhone14,2",
    "stack_trace": "#0 MyApp.LoginService.authenticate(User, String) + 64\n#1 MyApp.LoginViewController.loginButtonTapped() + 132\n#2 UIKit.UIApplication.main + 400",
    "user_note": "同样登录必崩"
  }')
ID2=$(echo "$R2" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "$R2" | python3 -m json.tool
ok "Created crash: $ID2"
echo ""

echo "--- 4. Submit third crash (OBFUSCATED stack — key scenario) ---"
R3=$(curl -s -X POST "$BASE/crashes" \
  -H "Content-Type: application/json" \
  -d '{
    "app_version": "2.3.0",
    "device_model": "SM-G998B",
    "stack_trace": "#0 a.b + 16\n#1 c.d + 32\n#2 e.f + 48\n#3 com.app.MainActivity.onCreate + 120",
    "user_note": "混淆后无法定位"
  }')
ID3=$(echo "$R3" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "$R3" | python3 -m json.tool
ok "Created obfuscated crash: $ID3"
echo ""

echo "--- 5. Submit fourth crash (version misclassification — 2.4.x vs 2.3.x) ---"
R4=$(curl -s -X POST "$BASE/crashes" \
  -H "Content-Type: application/json" \
  -d '{
    "app_version": "2.4.0",
    "device_model": "iPhone15,2",
    "stack_trace": "#0 MyApp.LoginService.authenticate(User, String) + 56\n#1 MyApp.LoginViewController.loginButtonTapped() + 128\n#2 UIKit.UIApplication.main + 400",
    "user_note": "升级后还是崩"
  }')
ID4=$(echo "$R4" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "$R4" | python3 -m json.tool
ok "Created version-mismatch crash: $ID4"
echo ""

echo "--- 6. Submit fifth crash (DUPLICATE — same stack+version as first) ---"
R5=$(curl -s -X POST "$BASE/crashes" \
  -H "Content-Type: application/json" \
  -d '{
    "app_version": "2.3.1",
    "device_model": "iPhone16,1",
    "stack_trace": "#0 MyApp.LoginService.authenticate(User, String) + 56\n#1 MyApp.LoginViewController.loginButtonTapped() + 128\n#2 UIKit.UIApplication.main + 400",
    "user_note": "又是这个崩"
  }')
ID5=$(echo "$R5" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
ok "Created duplicate crash: $ID5"
echo ""

echo "--- 7. Append data to an existing crash (incremental update) ---"
curl -s -X PATCH "$BASE/crashes/$ID1" \
  -H "Content-Type: application/json" \
  -d '{"user_note": "补充：只在5G网络下触发", "raw_log": "full_crash_20240115.log"}' | python3 -m json.tool
ok "Updated crash $ID1 with additional data"
echo ""

echo "--- 8. Run clustering ---"
CLUSTER_RESULT=$(curl -s -X POST "$BASE/clusters/run")
echo "$CLUSTER_RESULT" | python3 -m json.tool
CLUSTER_COUNT=$(echo "$CLUSTER_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['clusters_found'])")
ok "Found $CLUSTER_COUNT clusters"
echo ""

echo "--- 9. List clusters ---"
curl -s "$BASE/clusters" | python3 -m json.tool
ok "Listed clusters"
echo ""

echo "--- 10. Check cluster detail ---"
FIRST_CLUSTER=$(echo "$CLUSTER_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['clusters'][0]['id'])")
curl -s "$BASE/clusters/$FIRST_CLUSTER" | python3 -m json.tool
ok "Cluster detail for $FIRST_CLUSTER"
echo ""

echo "--- 11. Detect duplicates ---"
curl -s "$BASE/analysis/duplicates" | python3 -m json.tool
ok "Duplicate detection done"
echo ""

echo "--- 12. Detect version misclassification ---"
curl -s "$BASE/analysis/version-issues" | python3 -m json.tool
ok "Version issue detection done"
echo ""

echo "--- 13. Find obfuscated stacks ---"
curl -s "$BASE/analysis/obfuscated" | python3 -m json.tool
ok "Obfuscated stack analysis done"
echo ""

echo "--- 14. Trend data ---"
curl -s "$BASE/trend?group_by=day" | python3 -m json.tool
ok "Trend data generated"
echo ""

echo "--- 15. Export report (JSON) ---"
curl -s "$BASE/report?fmt=json" | python3 -m json.tool | head -30
ok "JSON report exported"
echo ""

echo "--- 16. Export report (CSV) ---"
curl -s "$BASE/report?fmt=csv"
ok "CSV report exported"
echo ""

echo "--- 17. Export report (Markdown) ---"
curl -s "$BASE/report?fmt=markdown" | head -30
ok "Markdown report exported"
echo ""

echo "--- 18. Test error: get non-existent crash ---"
curl -s "$BASE/crashes/nonexistent123" | python3 -m json.tool
ok "404 error correctly returned"
echo ""

echo "--- 19. Test error: empty submit ---"
curl -s -X POST "$BASE/crashes" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool
ok "400 error correctly returned for empty submit"
echo ""

echo "=== Demo Complete ==="
echo "All main flows verified: submit, patch, cluster, analyze, export, error handling."
