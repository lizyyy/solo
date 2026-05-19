#!/usr/bin/env python3
"""
Webhook 重放脚本
夹具ID: fixture_20260519_081504_2924d77a
创建时间: 2026-05-19T08:15:04.959927
"""

import httpx
import json

FIXTURE_ID = "fixture_20260519_081504_2924d77a"
TARGET_URL = "https://test.example.com/webhook"
RESPONSE_METHOD = "POST"

RESPONSE_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "Webhook-Client/1.0"
}

SIGNATURE_HEADERS = {
  "X-Signature": "sha256=abc123def456",
  "X-Timestamp": "1620000000"
}

RAW_PAYLOAD = r"""
{"event_type":"payment.completed","data":{"id":"pay_123","amount":100.00,"currency":"CNY"}}
"""


def main():
    print("=== 重放夹具: {} ===".format(FIXTURE_ID))
    print("目标URL: {}".format(TARGET_URL))
    print("请求方法: {}".format(RESPONSE_METHOD))
    
    all_headers = {**RESPONSE_HEADERS, **SIGNATURE_HEADERS}
    
    print("\n请求头:")
    for k, v in all_headers.items():
        print("  {}: {}".format(k, v))
    
    print("\n载荷:")
    print(RAW_PAYLOAD)
    
    try:
        response = httpx.request(
            method=RESPONSE_METHOD,
            url=TARGET_URL,
            headers=all_headers,
            content=RAW_PAYLOAD.encode("utf-8"),
            timeout=30
        )
        print("\n=== 响应 ===")
        print("状态码: {}".format(response.status_code))
        print("响应头: {}".format(dict(response.headers)))
        print("响应体: {}".format(response.text))
    except Exception as e:
        print("\n重放失败: {}".format(e))


if __name__ == "__main__":
    main()