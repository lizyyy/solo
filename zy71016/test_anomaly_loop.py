#!/usr/bin/env python3
import requests
import json
import time
import sys

BASE_URL = "http://localhost:8080/api/v1"

def test_duplicate_vehicle_anomaly_loop():
    print("=" * 60)
    print("Test: Duplicate Vehicle Anomaly Closed Loop Verification")
    print("=" * 60)
    
    batch_no = "BATCH-DUP-LOOP-" + str(int(time.time()))
    
    print("\n1. Creating dispatch batch with duplicate vehicle...")
    data = {
        "batch_no": batch_no,
        "weather_level_id": 2,
        "created_by": "tester",
        "items": [
            {"salt_depot_id": 1, "vehicle_id": 1, "road_section_id": 1, "salt_amount": 5},
            {"salt_depot_id": 1, "vehicle_id": 1, "road_section_id": 2, "salt_amount": 3}
        ]
    }
    resp = requests.post(f"{BASE_URL}/dispatch/batches", json=data, headers={"X-Operator": "tester"})
    result = resp.json()
    print(f"   Batch response: {result.get('message')}")
    
    item_ids = [item.get('id') for item in result.get('items', [])]
    print(f"   Created item IDs: {item_ids}")
    
    print("\n2. Querying /api/v1/anomalies to verify anomalies are queryable...")
    resp = requests.get(f"{BASE_URL}/anomalies")
    anomalies = resp.json()
    
    print(f"   Total anomalies: {len(anomalies)}")
    
    dup_vehicle_anomalies = [a for a in anomalies if a.get('anomaly_type') == 'duplicate_vehicle']
    print(f"   Duplicate vehicle anomalies: {len(dup_vehicle_anomalies)}")
    
    if len(dup_vehicle_anomalies) >= 2:
        print("   PASS: Duplicate vehicle anomalies written to items, queryable")
    else:
        print("   FAIL: Duplicate vehicle anomalies NOT written correctly")
        return False
    
    print("\n3. Viewing anomaly descriptions...")
    for a in dup_vehicle_anomalies[:2]:
        print(f"   Item {a['id']}: {a.get('anomaly_desc', '')}")
    
    print("\n4. Resolving anomaly...")
    anomaly_id = dup_vehicle_anomalies[0]['id']
    resp = requests.post(f"{BASE_URL}/anomalies/{anomaly_id}/resolve", 
                        json={"resolution": "Reassigned to vehicle 2"},
                        headers={"X-Operator": "dispatcher"})
    print(f"   Resolve response: {resp.json()}")
    
    print("\n5. Verifying anomaly resolved status...")
    resp = requests.get(f"{BASE_URL}/dispatch/items/{anomaly_id}")
    item = resp.json()
    print(f"   Item {anomaly_id} HasAnomaly: {item.get('has_anomaly')}")
    
    if not item.get('has_anomaly'):
        print("   PASS: Anomaly marked as resolved")
    else:
        print("   FAIL: Anomaly NOT marked as resolved")
        return False
    
    print("\n6. Verifying stats...")
    resp = requests.get(f"{BASE_URL}/stats")
    stats = resp.json()
    print(f"   Anomaly items count: {stats.get('anomaly_items')}")
    print("   PASS: Stats query successful")
    
    print("\n" + "=" * 60)
    print("Duplicate Vehicle Anomaly Closed Loop Verification PASSED!")
    print("=" * 60)
    return True

if __name__ == "__main__":
    try:
        success = test_duplicate_vehicle_anomaly_loop()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\nTest error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
