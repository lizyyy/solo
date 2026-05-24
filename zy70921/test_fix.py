import sys
sys.path.insert(0, '.')

print("=" * 60)
print("Testing imports and models...")
print("=" * 60)

try:
    import main
    print("✓ main.py imported successfully")
except Exception as e:
    print(f"✗ main.py import failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    from app.database import engine, Base
    from sqlalchemy.orm import sessionmaker
    print("✓ Database imported successfully")
except Exception as e:
    print(f"✗ Database import failed: {e}")
    sys.exit(1)

try:
    from app.models.sample import Sample
    from app.models.test_item import TestItem
    from app.models.test_result import TestResult
    print("✓ All models imported successfully")
except Exception as e:
    print(f"✗ Models import failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("Creating tables and testing relationships...")
print("=" * 60)

try:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("✓ Tables created successfully")
except Exception as e:
    print(f"✗ Table creation failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    sample = Sample(
        batch_no="TEST001",
        cooperative="测试合作社",
        sample_type="蔬菜",
        sample_name="白菜",
        sample_code="SPC001"
    )
    db.add(sample)
    db.flush()
    
    test_item = TestItem(
        sample_id=sample.id,
        item_name="敌敌畏",
        limit_value=0.1,
        test_value=0.05
    )
    db.add(test_item)
    
    test_result = TestResult(
        sample_id=sample.id,
        sample_code=sample.sample_code,
        report_no="RPT001",
        status="normal"
    )
    db.add(test_result)
    
    db.commit()
    print("✓ Relationships work correctly!")
    
    db.refresh(sample)
    print(f"  - Sample has {len(sample.test_items)} test items")
    print(f"  - Sample has {len(sample.test_results)} test results")
    
    db.close()
except Exception as e:
    print(f"✗ Relationship test failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("Testing API with TestClient...")
print("=" * 60)

try:
    from fastapi.testclient import TestClient
    client = TestClient(main.app)
    
    import os
    csv_path = os.path.join(os.path.dirname(__file__), "app", "data", "samples.csv")
    json_path = os.path.join(os.path.dirname(__file__), "app", "data", "test_items.json")
    
    with open(csv_path, "rb") as f_csv, open(json_path, "rb") as f_json:
        response = client.post(
            "/api/process",
            files={
                "samples_file": ("samples.csv", f_csv, "text/csv"),
                "test_items_file": ("test_items.json", f_json, "application/json")
            },
            data={"operator": "test"}
        )
    
    if response.status_code == 200:
        print("✓ /api/process endpoint works!")
        data = response.json()
        print(f"  - Normal: {len(data['normal'])}")
        print(f"  - Pending: {len(data['pending'])}")
        print(f"  - Failed: {len(data['failed'])}")
        print(f"  - Total: {data['total_processed']}")
    else:
        print(f"✗ /api/process failed with status {response.status_code}")
        print(f"  Response: {response.text}")
        sys.exit(1)
except Exception as e:
    print(f"✗ API test failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("All tests passed! ✓")
print("=" * 60)
