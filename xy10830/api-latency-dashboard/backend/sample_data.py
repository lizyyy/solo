import requests
from datetime import datetime, timedelta
import random
import uuid

BASE_URL = "http://localhost:8000"

def generate_request_id():
    return f"REQ-{str(uuid.uuid4())[:12].upper()}"

def generate_samples(count, api_path, tenant_ids, base_latency, variance):
    samples = []
    methods = ["GET", "POST", "PUT", "DELETE"]
    status_codes = [200, 200, 200, 201, 204, 400, 500, 502, 503]
    
    for i in range(count):
        latency = base_latency + random.uniform(-variance * 0.3, variance)
        latency = max(100, latency)
        
        timestamp = datetime.utcnow() - timedelta(minutes=random.randint(0, 60), seconds=random.randint(0, 60))
        
        samples.append({
            "request_id": generate_request_id(),
            "tenant_id": random.choice(tenant_ids),
            "latency": latency,
            "timestamp": timestamp.isoformat(),
            "http_method": random.choice(methods),
            "status_code": random.choice(status_codes),
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "client_ip": f"192.168.{random.randint(1, 10)}.{random.randint(1, 254)}"
        })
    
    return sorted(samples, key=lambda x: x["latency"], reverse=True)

def create_normal_flow_incidents():
    print("=== 创建正常流事故记录 ===")
    
    api_paths = [
        "/api/v1/users/profile",
        "/api/v1/orders/list",
        "/api/v1/products/search",
    ]
    
    tenant_ids = ["TENANT_A", "TENANT_B", "TENANT_C", "TENANT_D", "TENANT_E"]
    
    for i, api_path in enumerate(api_paths):
        base_latency = 800 + i * 300
        sample_count = random.randint(15, 30)
        
        samples = generate_samples(sample_count, api_path, tenant_ids[:3+i], base_latency, 500)
        
        latencies = [s["latency"] for s in samples]
        avg_latency = sum(latencies) / len(latencies)
        p95_latency = sorted(latencies)[int(len(latencies) * 0.95)]
        p99_latency = sorted(latencies)[int(len(latencies) * 0.99)]
        
        total_requests = sample_count * 100
        slow_requests = sample_count
        
        incident_data = {
            "api_path": api_path,
            "avg_latency": avg_latency,
            "p95_latency": p95_latency,
            "p99_latency": p99_latency,
            "total_requests": total_requests,
            "slow_requests": slow_requests,
            "samples": samples,
            "start_time": (datetime.utcnow() - timedelta(hours=2+i)).isoformat()
        }
        
        response = requests.post(f"{BASE_URL}/api/incidents", json=incident_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✓ 已创建: {result['incident_id']} - {api_path} (状态: {result['status']})")
        else:
            print(f"✗ 创建失败: {response.text}")

def create_intercept_flow_incidents():
    print("\n=== 创建拦截流事故记录（严重延迟）===")
    
    severe_apis = [
        {
            "path": "/api/v1/payments/process",
            "base_latency": 4500,
            "severity": "critical",
            "tenant_ids": ["TENANT_X", "TENANT_Y", "TENANT_Z"]
        },
        {
            "path": "/api/v2/reports/generate",
            "base_latency": 8000,
            "severity": "fatal",
            "tenant_ids": ["TENANT_P", "TENANT_Q", "TENANT_R", "TENANT_S"]
        },
        {
            "path": "/api/v1/data/export",
            "base_latency": 12000,
            "severity": "fatal",
            "tenant_ids": ["TENANT_M", "TENANT_N"]
        }
    ]
    
    for api in severe_apis:
        sample_count = random.randint(20, 40)
        samples = generate_samples(sample_count, api["path"], api["tenant_ids"], api["base_latency"], 3000)
        
        latencies = [s["latency"] for s in samples]
        avg_latency = sum(latencies) / len(latencies)
        p95_latency = sorted(latencies)[int(len(latencies) * 0.95)]
        p99_latency = sorted(latencies)[int(len(latencies) * 0.99)]
        
        total_requests = sample_count * 50
        slow_requests = sample_count
        
        incident_data = {
            "api_path": api["path"],
            "avg_latency": avg_latency,
            "p95_latency": p95_latency,
            "p99_latency": p99_latency,
            "total_requests": total_requests,
            "slow_requests": slow_requests,
            "samples": samples,
            "start_time": (datetime.utcnow() - timedelta(minutes=random.randint(30, 120))).isoformat()
        }
        
        response = requests.post(f"{BASE_URL}/api/incidents", json=incident_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✓ 已创建: {result['incident_id']} - {api['path']} (状态: {result['status']}, 严重度: {result['severity']})")
        else:
            print(f"✗ 创建失败: {response.text}")

def simulate_status_transitions():
    print("\n=== 模拟状态流转 ===")
    
    response = requests.get(f"{BASE_URL}/api/incidents", params={"page_size": 10})
    if response.status_code == 200:
        incidents = response.json()["incidents"]
        
        operators = ["operator_zhang", "operator_li", "operator_wang"]
        
        for i, incident in enumerate(incidents[:5]):
            incident_id = incident["incident_id"]
            current_status = incident["status"]
            
            if current_status == "DETECTED":
                new_status = "INVESTIGATING"
            elif current_status == "INVESTIGATING" and i % 2 == 0:
                new_status = "ESCALATED"
            elif current_status == "INVESTIGATING":
                new_status = "RESOLVED"
            else:
                continue
            
            status_update = {
                "new_status": new_status,
                "operator": random.choice(operators),
                "notes": f"自动流转状态，进行{i+1}步处理"
            }
            
            response = requests.put(f"{BASE_URL}/api/incidents/{incident_id}/status", json=status_update)
            if response.status_code == 200:
                result = response.json()
                print(f"✓ {incident_id}: {current_status} -> {new_status}")
            else:
                print(f"✗ {incident_id} 状态更新失败: {response.text}")

def add_remarks():
    print("\n=== 添加排查备注 ===")
    
    response = requests.get(f"{BASE_URL}/api/incidents", params={"page_size": 5})
    if response.status_code == 200:
        incidents = response.json()["incidents"]
        
        remarks = [
            "正在检查数据库连接池配置",
            "发现慢查询，正在优化SQL语句",
            "第三方依赖服务响应超时",
            "已扩容Pod数量，观察中",
            "网络抖动导致，已联系网络组"
        ]
        
        authors = ["dev_ops_1", "sre_engineer", "dba_admin"]
        
        for incident in incidents:
            incident_id = incident["incident_id"]
            
            remark_data = {
                "author": random.choice(authors),
                "content": random.choice(remarks),
                "is_resolution": random.choice([True, False, False])
            }
            
            response = requests.post(f"{BASE_URL}/api/incidents/{incident_id}/remarks", json=remark_data)
            if response.status_code == 200:
                print(f"✓ {incident_id}: 已添加备注")

def main():
    print("开始生成接口延迟事故板样例数据...\n")
    
    create_normal_flow_incidents()
    create_intercept_flow_incidents()
    simulate_status_transitions()
    add_remarks()
    
    print("\n=== 样例数据生成完成 ===")
    print("请访问 http://localhost:8000/docs 查看API文档")

if __name__ == "__main__":
    main()
