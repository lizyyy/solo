#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8000"

sample_domains = [
    {"domain_name": "static.example.com", "primary_origin": "primary-static.example.com", "backup_origin": "backup-static.example.com"},
    {"domain_name": "img.example.com", "primary_origin": "unhealthy-img.example.com", "backup_origin": "backup-img.example.com"},
    {"domain_name": "cdn.example.org", "primary_origin": "healthy-cdn.example.org", "backup_origin": "backup-cdn.example.org"},
]

def init_samples():
    print("=" * 60)
    print("开始初始化样例数据...")
    print("=" * 60)
    
    print("\n1. 创建域名配置:")
    print("-" * 40)
    for domain in sample_domains:
        resp = requests.post(f"{BASE_URL}/api/domains", json=domain)
        data = resp.json()
        if data.get("code") == 0:
            print(f"  ✓ {domain['domain_name']} - 创建成功")
        else:
            print(f"  ⚠ {domain['domain_name']} - {data.get('message')}")
    
    print("\n2. 查询所有域名:")
    print("-" * 40)
    resp = requests.get(f"{BASE_URL}/api/domains")
    data = resp.json()
    if data.get("code") == 0:
        for d in data["data"]:
            print(f"  {d['domain_name']}")
            print(f"    主源站: {d['primary_origin']}")
            print(f"    备源站: {d['backup_origin']}")
            print(f"    当前: {d['current_origin']}")
    
    print("\n3. 创建切换请求 (img.example.com - 不健康):")
    print("-" * 40)
    switch1 = {
        "domain_name": "img.example.com",
        "switch_reason": "华南区域主源站 5xx 率超过 10%，持续 5 分钟",
        "recovery_condition": "主源站 5xx 率低于 1%，持续 15 分钟",
        "created_by": "ops-alert"
    }
    resp = requests.post(f"{BASE_URL}/api/switches", json=switch1)
    data = resp.json()
    print(f"  切换ID: {data.get('data', {}).get('switch_id')}")
    print(f"  消息: {data.get('message')}")
    
    print("\n4. 创建切换请求 (static.example.com):")
    print("-" * 40)
    switch2 = {
        "domain_name": "static.example.com",
        "switch_reason": "主源站带宽告警，超过阈值 90%",
        "recovery_condition": "带宽低于阈值 70%，持续 30 分钟",
        "created_by": "monitor-bot"
    }
    resp = requests.post(f"{BASE_URL}/api/switches", json=switch2)
    data = resp.json()
    switch_id = data.get('data', {}).get('switch_id')
    print(f"  切换ID: {switch_id}")
    print(f"  消息: {data.get('message')}")
    
    if switch_id:
        print(f"\n5. 推进切换流程 (ID: {switch_id}):")
        print("-" * 40)
        for i in range(3):
            resp = requests.post(f"{BASE_URL}/api/switches/{switch_id}/advance")
            data = resp.json()
            print(f"  第{i+1}次推进: {data.get('message')}")
            if data.get('code') != 0:
                break
    
    print("\n" + "=" * 60)
    print("样例数据初始化完成!")
    print("=" * 60)
    print("\n接下来你可以:")
    print("  - 查看所有切换记录: curl 'http://localhost:8000/api/switches'")
    print("  - 检查恢复提醒: curl 'http://localhost:8000/api/reminders'")
    print("  - 访问 API 文档: http://localhost:8000/docs")

if __name__ == "__main__":
    try:
        init_samples()
    except requests.exceptions.ConnectionError:
        print("\n❌ 错误: 无法连接到服务")
        print("请先启动服务: python main.py")
        exit(1)
