#!/usr/bin/env python3
import requests
import json
from datetime import datetime, timedelta, timezone

BASE_URL = "http://localhost:8000"

def print_response(title, response):
    print(f"\n{'='*60}")
    print(f"📋 {title}")
    print(f"📍 URL: {response.url}")
    print(f"🔢 Status: {response.status_code}")
    try:
        data = response.json()
        print(f"📦 Response: {json.dumps(data, ensure_ascii=False, indent=2)}")
    except:
        print(f"📦 Response: {response.text}")
    print(f"{'='*60}\n")


def test_health():
    print("🏥 Testing health endpoint...")
    response = requests.get(f"{BASE_URL}/health")
    print_response("Health Check", response)
    return response


def test_create_dataset():
    print("📁 Creating dataset...")
    payload = {
        "name": "user_order_data",
        "description": "用户订单数据",
        "expected_frequency_seconds": 300,
        "owner": "data_team",
        "tags": ["order", "user", "transaction"]
    }
    response = requests.post(f"{BASE_URL}/api/v1/datasets", json=payload)
    print_response("Create Dataset", response)
    return response


def test_list_datasets():
    print("📋 Listing datasets...")
    response = requests.get(f"{BASE_URL}/api/v1/datasets")
    print_response("List Datasets", response)
    return response


def test_create_freshness_record(dataset_id):
    print("📝 Creating freshness record...")
    now = datetime.now(timezone.utc)
    source_time = now - timedelta(minutes=5)
    cache_time = now - timedelta(minutes=2)
    
    payload = {
        "dataset_id": dataset_id,
        "source_updated_at": source_time.isoformat(),
        "cache_updated_at": cache_time.isoformat(),
        "sync_watermark": "2024.05.14.001",
        "query_consumer": "report_service",
        "record_metadata": {"sync_job": "daily_sync_001"},
        "request_id": f"req_{int(now.timestamp())}"
    }
    response = requests.post(f"{BASE_URL}/api/v1/freshness/records", json=payload)
    print_response("Create Freshness Record", response)
    return response


def test_create_freshness_record_duplicate(dataset_id):
    print("🔄 Testing duplicate record (idempotency)...")
    now = datetime.now(timezone.utc)
    source_time = now - timedelta(minutes=5)
    cache_time = now - timedelta(minutes=2)
    request_id = f"test_req_{int(now.timestamp())}"
    
    payload = {
        "dataset_id": dataset_id,
        "source_updated_at": source_time.isoformat(),
        "cache_updated_at": cache_time.isoformat(),
        "sync_watermark": "2024.05.14.002",
        "query_consumer": "report_service",
        "request_id": request_id
    }
    
    print("First request:")
    response1 = requests.post(f"{BASE_URL}/api/v1/freshness/records", json=payload)
    print_response("First Request", response1)
    
    print("Duplicate request (same request_id):")
    response2 = requests.post(f"{BASE_URL}/api/v1/freshness/records", json=payload)
    print_response("Duplicate Request", response2)
    
    return response1, response2


def test_check_freshness(dataset_id):
    print("🔍 Checking freshness...")
    payload = {
        "dataset_id": dataset_id,
        "query_consumer": "report_service"
    }
    response = requests.post(f"{BASE_URL}/api/v1/freshness/check", json=payload)
    print_response("Check Freshness", response)
    return response


def test_advance_watermark(dataset_id):
    print("🚀 Advancing watermark...")
    payload = {
        "dataset_id": dataset_id,
        "new_watermark": "2024.05.14.002",
        "source_updated_at": datetime.now(timezone.utc).isoformat(),
        "operator": "data_engineer"
    }
    response = requests.post(f"{BASE_URL}/api/v1/freshness/watermark/advance", json=payload)
    print_response("Advance Watermark", response)
    return response


def test_get_history(dataset_id=None):
    print("📜 Getting freshness history...")
    params = {}
    if dataset_id:
        params["dataset_id"] = dataset_id
    params["limit"] = 10
    
    response = requests.get(f"{BASE_URL}/api/v1/freshness/history", params=params)
    print_response("Freshness History", response)
    return response


def test_error_cases():
    print("❌ Testing error cases...")
    
    print("\n1. Get non-existent dataset:")
    response = requests.get(f"{BASE_URL}/api/v1/datasets/nonexistent_id")
    print_response("Non-existent Dataset", response)
    
    print("\n2. Create duplicate dataset name:")
    payload = {
        "name": "user_order_data",
        "expected_frequency_seconds": 300
    }
    response = requests.post(f"{BASE_URL}/api/v1/datasets", json=payload)
    print_response("Duplicate Dataset Name", response)
    
    print("\n3. Check freshness with no records:")
    # First create a new empty dataset
    payload2 = {
        "name": "empty_test_dataset",
        "expected_frequency_seconds": 300
    }
    create_resp = requests.post(f"{BASE_URL}/api/v1/datasets", json=payload2)
    new_id = create_resp.json()["id"]
    
    payload3 = {"dataset_id": new_id, "query_consumer": "test"}
    response = requests.post(f"{BASE_URL}/api/v1/freshness/check", json=payload3)
    print_response("Check Freshness - No Records", response)


def main():
    print("🚀 Starting API Tests...")
    
    # Test health
    test_health()
    
    # Create dataset
    create_resp = test_create_dataset()
    if create_resp.status_code == 201:
        dataset_id = create_resp.json()["id"]
        print(f"✅ Created dataset with ID: {dataset_id}")
    else:
        # Try to get existing dataset
        list_resp = test_list_datasets()
        datasets = list_resp.json()
        if datasets:
            dataset_id = datasets[0]["id"]
            print(f"✅ Using existing dataset with ID: {dataset_id}")
        else:
            print("❌ Failed to get dataset")
            return
    
    # List datasets
    test_list_datasets()
    
    # Create freshness record
    test_create_freshness_record(dataset_id)
    
    # Test idempotency
    test_create_freshness_record_duplicate(dataset_id)
    
    # Check freshness
    test_check_freshness(dataset_id)
    
    # Advance watermark
    test_advance_watermark(dataset_id)
    
    # Get history
    test_get_history(dataset_id)
    
    # Test error cases
    test_error_cases()
    
    print("\n🎉 All tests completed!")


if __name__ == "__main__":
    main()
