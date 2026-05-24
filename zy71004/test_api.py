#!/usr/bin/env python3
import requests
import json
import subprocess
import time
import os

BASE_URL = "http://localhost:8080"

def test_health():
    print("=== Testing Health Check ===")
    try:
        r = requests.get(f"{BASE_URL}/api/health", timeout=2)
        print(f"Status: {r.status_code}")
        print(f"Response: {r.json()}")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

def test_import():
    print("\n=== Testing Import Record ===")
    data = {
        "exhibit_no": "EXH-2024-001",
        "contract_no": "CTR-BJ-2024-056",
        "check_point": "outbound",
        "check_time": "2024-05-01T10:00:00Z",
        "condition_desc": "出馆检查，品相完好",
        "has_scratch": False,
        "insurance_remark": "保险覆盖全程",
        "transport_node": "北京博物馆",
        "idempotent_key": "test-key-001"
    }
    headers = {"Content-Type": "application/json", "X-Operator": "curator_zhang"}
    r = requests.post(f"{BASE_URL}/api/records", json=data, headers=headers, timeout=5)
    print(f"Status: {r.status_code}")
    print(f"Response: {json.dumps(r.json(), indent=2, ensure_ascii=False)}")
    return r.status_code == 201

def test_list():
    print("\n=== Testing List Records ===")
    r = requests.get(f"{BASE_URL}/api/records", timeout=2)
    print(f"Status: {r.status_code}")
    print(f"Response: {json.dumps(r.json(), indent=2, ensure_ascii=False)}")
    return r.status_code == 200

def test_get(record_id):
    print(f"\n=== Testing Get Record {record_id} ===")
    r = requests.get(f"{BASE_URL}/api/records/{record_id}", timeout=2)
    print(f"Status: {r.status_code}")
    print(f"Response: {json.dumps(r.json(), indent=2, ensure_ascii=False)}")
    return r.status_code == 200

def main():
    print("Starting Museum Exhibit Condition API Test")
    
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    subprocess.run(["pkill", "-f", "museum-api"], capture_output=True)
    if os.path.exists("exhibit_condition.db"):
        os.remove("exhibit_condition.db")
        print("Removed old database")
    
    print("Starting server...")
    proc = subprocess.Popen(["./museum-api"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    time.sleep(2)
    
    try:
        if not test_health():
            print("Health check failed")
            return
        
        if test_import():
            if test_list():
                test_get(1)
        
        print("\n=== All tests completed ===")
    finally:
        proc.terminate()
        proc.wait()

if __name__ == "__main__":
    main()
