#!/usr/bin/env python3
"""直接测试API响应"""
import json
import urllib.request
import ssl
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import API_BASE, apply_no_proxy

apply_no_proxy()

proxy_handler = urllib.request.ProxyHandler({})
opener = urllib.request.build_opener(proxy_handler)

API = API_BASE

def test_api(path, method='GET', data=None):
    url = API + path
    print(f'\n=== {method} {path} ===')
    try:
        req = urllib.request.Request(url, method=method)
        if data:
            req.add_header('Content-Type', 'application/json')
            req.data = json.dumps(data).encode()
        
        with opener.open(req, timeout=5) as r:
            body = r.read().decode()
            print(f'Status: {r.status}')
            print(f'Response: {body[:500]}')
            
            try:
                d = json.loads(body)
                return d
            except:
                return body
    except Exception as e:
        print(f'Error: {e}')
        return None

# 测试
print('=== API 测试 ===')

# 1. 获取材料列表
r = test_api('/api/materials')
if r and r.get('code') == 0:
    mats = r.get('data', [])
    print(f'\n材料数量: {len(mats)}')
    for m in mats[:3]:
        print(f'  - {m["id"]}: {m["materialName"]} ({m["status"]})')
    if len(mats) > 3:
        print(f'  ... 还有 {len(mats)-3} 条')

# 2. 批次
r = test_api('/api/batches')
if r and r.get('code') == 0:
    print(f'\n批次数量: {len(r["data"])}')

# 3. 脏数据列表
r = test_api('/api/materials/dirty/list')
if r:
    print(f'\n脏数据响应: {json.dumps(r)[:300]}')

print('\n=== 测试完成 ===')
