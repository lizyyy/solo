import requests
import json

BASE_URL = "http://localhost:8000"

def test_health():
    print("1. Testing /api/health...")
    resp = requests.get(f"{BASE_URL}/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    print(f"   ✓ PASS: {data}")

def test_batches():
    print("\n2. Testing /api/batches...")
    resp = requests.get(f"{BASE_URL}/api/batches")
    assert resp.status_code == 200
    data = resp.json()
    print(f"   ✓ PASS: Found {len(data)} batches")
    
    resp = requests.get(f"{BASE_URL}/api/batches?risk_type=expired_version")
    assert resp.status_code == 200
    data = resp.json()
    print(f"   ✓ PASS: Found {len(data)} batches with risk_type=expired_version")

def test_failed_items():
    print("\n3. Testing /api/failed-items...")
    resp = requests.get(f"{BASE_URL}/api/failed-items")
    assert resp.status_code == 200
    data = resp.json()
    print(f"   ✓ PASS: Found {len(data)} failed items")

def test_candidate_lists():
    print("\n4. Testing /api/candidate-lists...")
    resp = requests.get(f"{BASE_URL}/api/candidate-lists")
    assert resp.status_code == 200
    data = resp.json()
    print(f"   ✓ PASS: Found {len(data)} candidate lists")

def test_approval_items():
    print("\n5. Testing /api/approval-items...")
    resp = requests.get(f"{BASE_URL}/api/approval-items")
    assert resp.status_code == 200
    data = resp.json()
    print(f"   ✓ PASS: Found {len(data)} approval items")

def test_reports():
    print("\n6. Testing /api/reports...")
    resp = requests.get(f"{BASE_URL}/api/reports")
    assert resp.status_code == 200
    data = resp.json()
    print(f"   ✓ PASS: Found {len(data)} reports")

def test_review():
    print("\n7. Testing /api/batches/1/review...")
    resp = requests.get(f"{BASE_URL}/api/batches/1/review")
    assert resp.status_code == 200
    data = resp.json()
    print(f"   ✓ PASS: Batch {data['batch_no']} review")
    print(f"     - Status changes: {len(data['status_changes'])}")
    print(f"     - Approval items: {len(data['approval_items'])}")

def test_candidate_list_protection():
    print("\n8. Testing candidate list protection (core fix)...")
    
    batch1_tokens = requests.get(f"{BASE_URL}/api/batches/1/tokens").json()
    active_before = sum(1 for t in batch1_tokens if t['status'] == 'active')
    print(f"   - Batch 1 tokens before: {len(batch1_tokens)} total, {active_before} active")
    
    candidates = requests.get(f"{BASE_URL}/api/candidate-lists").json()
    rollback_candidate = next(c for c in candidates if c['list_type'] == 'rollback')
    token_ids_in_list = [item['token_id'] for item in rollback_candidate['items']]
    print(f"   - Rollback candidate list contains: token IDs {token_ids_in_list}")
    
    revoked_after = sum(1 for t in batch1_tokens if t['status'] == 'revoked')
    
    assert revoked_after == len(token_ids_in_list), f"Expected {len(token_ids_in_list)} revoked tokens, got {revoked_after}"
    assert revoked_after < len(batch1_tokens), "Should NOT revoke all tokens from batch!"
    
    print(f"   ✓ PASS: Only {revoked_after} tokens revoked (matches candidate list size)")
    print(f"     - {len(batch1_tokens) - revoked_after} tokens untouched and protected")

if __name__ == "__main__":
    print("=" * 60)
    print("Temporary Token Service API Test Suite")
    print("=" * 60)
    
    try:
        test_health()
        test_batches()
        test_failed_items()
        test_candidate_lists()
        test_approval_items()
        test_reports()
        test_review()
        test_candidate_list_protection()
        
        print("\n" + "=" * 60)
        print("ALL TESTS PASSED! ✓")
        print("=" * 60)
    except Exception as e:
        print(f"\n✗ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
