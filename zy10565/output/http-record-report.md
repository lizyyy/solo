# HTTP Record Variable Report

> Generated at: 5/17/2026, 10:53:01 PM

## Summary Statistics

| Metric | Value | Status |
|--------|-------|--------|
| Total Requests | 7 | |
| Valid Requests | 5 | ✅ |
| Bad Requests | 2 | ❌ |
| Variables Extracted | 8 | 🔧 |
| Sensitive Values Masked | 2 | 🔒 |

## Extracted Variables

| Variable Name | Type | Location | Occurrences | Value |
|---------------|------|----------|-------------|-------|
| `TARGET_HOST` | host | url | 5 | `api.example.com` |
| `AUTH_TOKEN` | token | header | 2 | `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U` |
| `BEARER_TOKEN` | token | header | 2 | `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U` |
| `API_KEY` | token | header | 1 | `secret-key-123` |
| `TIMESTAMP_SEC` | timestamp | url | 2 | `1715000000` |
| `SENSITIVE_PASSWORD_1` | sensitive | url | 1 | `***MASKED***` |
| `TIMESTAMP_MS` | timestamp | url | 1 | `1715001234567` |
| `SENSITIVE_CREDIT_CARD_1` | sensitive | url | 1 | `***MASKED***` |

## Variable Export

```bash
# Variable Export
export TARGET_HOST="api.example.com"
export AUTH_TOKEN="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
export BEARER_TOKEN="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
export API_KEY="secret-key-123"
export TIMESTAMP_SEC="1715000000"
export SENSITIVE_PASSWORD_1="your_value_here"
export TIMESTAMP_MS="1715001234567"
export SENSITIVE_CREDIT_CARD_1="your_value_here"
```

## Replay Commands

```bash
# Request 1
curl 'https://${TARGET_HOST}/users/12345?timestamp=${TIMESTAMP_SEC}' -H 'Authorization: ${AUTH_TOKEN}' -H 'X-API-Key: ${API_KEY}' -H 'Content-Type: application/json'

# Request 2
curl -X POST 'https://${TARGET_HOST}/auth/login' -H 'Content-Type: application/json' -d '{"username":"test","password":"mySecretPassword123"}'

# Request 3
curl -X PUT 'https://${TARGET_HOST}/items/999' -H 'Authorization: ${AUTH_TOKEN}' -H 'Content-Type: application/json' -d '{"name":"test","timestamp":${TIMESTAMP_MS}}'

# Request 4
curl 'https://${TARGET_HOST}/healthcheck'

# Request 5
curl -X DELETE 'https://${TARGET_HOST}/orders/555?ts=${TIMESTAMP_SEC}'

```

## Bad Request Details

> These requests were preserved with their original location and reason

| Line Number | Reason | Original Content |
|-------------|--------|------------------|
| 3 | Unrecognized format | `这是一行坏数据，应该被识别为异常请求` |
| 11 | Unrecognized format | `invalid data that cannot be parsed as a valid requ` |

## Usage Instructions

1. Set environment variables (copy from the Variable Export section above)
2. Modify variable values as needed
3. Run replay commands to test
4. All sensitive values have been automatically masked, replace with actual values manually
