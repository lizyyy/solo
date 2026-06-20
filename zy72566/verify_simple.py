#!/usr/bin/env python3
"""精简版HTTP端到端验证 - 后端端口8001"""
import requests
import json
import sys

API = "http://localhost:8001/api"

def hr():
    print("=" * 60)

print("检查后端健康状态...")
try:
    r = requests.get(f"{API}/health", timeout=5)
    print("后端在线:", r.json())
except Exception as e:
    print("后端不在线:", e)
    sys.exit(1)
