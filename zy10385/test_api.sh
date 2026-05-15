#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== API Dependency Admission Check - API Test ==="
echo ""

echo "1. Create new application..."
response=$(curl -s -X POST "$BASE_URL/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "OrderService",
    "service_owner": "team-order",
    "description": "Order processing service",
    "dependencies": [
      {
        "api_name": "UserAPI",
        "api_endpoint": "/api/v1/users",
        "api_method": "GET",
        "description": "Get user info"
      },
      {
        "api_name": "PaymentAPI",
        "api_endpoint": "/api/v1/payments",
        "api_method": "POST",
        "description": "Process payment"
      }
    ]
  }')
echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
APP_ID=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
echo ""
echo "Application ID: $APP_ID"
echo ""

if [ -z "$APP_ID" ]; then
  echo "Failed to get application ID"
  exit 1
fi

echo "2. Submit for review..."
curl -s -X POST "$BASE_URL/applications/$APP_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{"operator": "admin"}' | python3 -m json.tool 2>/dev/null || echo "$response"
echo ""

echo "3. Start checking..."
curl -s -X POST "$BASE_URL/applications/$APP_ID/start-checking" \
  -H "Content-Type: application/json" \
  -d '{"operator": "reviewer"}' | python3 -m json.tool 2>/dev/null || echo "$response"
echo ""

echo "4. Register first dependency (UserAPI)..."
DEP1_ID=$(curl -s "$BASE_URL/applications/$APP_ID" | python3 -c "import sys, json; print(json.load(sys.stdin)['dependencies'][0]['id'])" 2>/dev/null)
echo "Dependency ID: $DEP1_ID"
curl -s -X POST "$BASE_URL/applications/$APP_ID/register-dependency" \
  -H "Content-Type: application/json" \
  -d "{\"dependency_id\": \"$DEP1_ID\", \"operator\": \"admin\"}" | python3 -m json.tool 2>/dev/null || echo "$response"
echo ""

echo "5. Register second dependency (PaymentAPI)..."
DEP2_ID=$(curl -s "$BASE_URL/applications/$APP_ID" | python3 -c "import sys, json; print(json.load(sys.stdin)['dependencies'][1]['id'])" 2>/dev/null)
echo "Dependency ID: $DEP2_ID"
curl -s -X POST "$BASE_URL/applications/$APP_ID/register-dependency" \
  -H "Content-Type: application/json" \
  -d "{\"dependency_id\": \"$DEP2_ID\", \"operator\": \"admin\"}" | python3 -m json.tool 2>/dev/null || echo "$response"
echo ""

echo "6. Check permissions..."
curl -s -X POST "$BASE_URL/applications/$APP_ID/check-permissions" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": [
      {
        "cred_type": "API_KEY",
        "cred_id": "key-12345",
        "valid": true
      }
    ],
    "operator": "admin"
  }' | python3 -m json.tool 2>/dev/null || echo "$response"
echo ""

echo "7. Check quota..."
curl -s -X POST "$BASE_URL/applications/$APP_ID/check-quota" \
  -H "Content-Type: application/json" \
  -d '{
    "quotas": [
      {
        "quota_type": "QPS",
        "requested": 100,
        "available": 1000
      },
      {
        "quota_type": "DAILY_CALLS",
        "requested": 100000,
        "available": 500000
      }
    ],
    "operator": "admin"
  }' | python3 -m json.tool 2>/dev/null || echo "$response"
echo ""

echo "8. Check alerts..."
curl -s -X POST "$BASE_URL/applications/$APP_ID/check-alerts" \
  -H "Content-Type: application/json" \
  -d '{
    "alerts": [
      {
        "alert_type": "SECURITY_SCAN",
        "severity": "LOW",
        "message": "No critical vulnerabilities found",
        "resolved": true
      }
    ],
    "operator": "admin"
  }' | python3 -m json.tool 2>/dev/null || echo "$response"
echo ""

echo "9. Approve application..."
curl -s -X POST "$BASE_URL/applications/$APP_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"operator": "reviewer"}' | python3 -m json.tool 2>/dev/null || echo "$response"
echo ""

echo "10. Get full history (service chain)..."
curl -s "$BASE_URL/applications/$APP_ID/history" | python3 -m json.tool 2>/dev/null || echo "$response"
echo ""

echo "11. Get final application status..."
curl -s "$BASE_URL/applications/$APP_ID" | python3 -m json.tool 2>/dev/null || echo "$response"
echo ""

echo "12. List all applications..."
curl -s "$BASE_URL/applications" | python3 -m json.tool 2>/dev/null || echo "$response"
echo ""

echo "=== Test Complete ==="
echo "Database persisted at: ./data/admission.db"
echo "Restart the server to verify data persistence"
