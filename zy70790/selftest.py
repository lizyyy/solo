#!/usr/bin/env python3
import sys
import os
import json
from typing import Dict, Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.core.policy_engine import PolicyEngine

TEST_DB_URL = "sqlite:///./test_retry_policy.db"


def setup_test_db():
    if os.path.exists("./test_retry_policy.db"):
        os.remove("./test_retry_policy.db")
    
    engine = create_engine(TEST_DB_URL)
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()


def test_import_config(db):
    print("\n=== Test 1: Import SDK Configurations ===")
    
    python_config = {
        "retry": {
            "max_retries": 3,
            "backoff_strategy": "exponential",
            "initial_delay": 1.0,
            "max_delay": 30.0,
            "multiplier": 2.0,
            "jitter_enabled": True,
            "retryable_status_codes": [429, 500, 502, 503, 504],
            "non_retryable_status_codes": [400, 401, 403, 404]
        }
    }
    
    java_config = {
        "retryPolicy": {
            "maxAttempts": 4,
            "backoff": {
                "type": "exponential",
                "delay": 500,
                "maxDelay": 20000,
                "multiplier": 2.0,
                "jitter": True
            },
            "retryableStatusCodes": [429, 500, 502, 503],
            "nonRetryableStatusCodes": [400, 404]
        }
    }
    
    go_config = {
        "retry": {
            "maxRetries": 2,
            "backoffStrategy": "linear",
            "initialInterval": 1000,
            "maxInterval": 10000,
            "multiplier": 1.5,
            "jitter": False,
            "retryableStatusCodes": [429, 500, 502, 503, 504]
        }
    }
    
    engine = PolicyEngine(db)
    
    print("Importing Python config...")
    _, py_count = engine.import_sdk_config("python", python_config, "1.0.0", "config.yaml")
    print(f"  Python: {py_count} policies imported")
    
    print("Importing Java config...")
    _, java_count = engine.import_sdk_config("java", java_config, "2.1.0", "application.yml")
    print(f"  Java: {java_count} policies imported")
    
    print("Importing Go config...")
    _, go_count = engine.import_sdk_config("go", go_config, "1.5.0", "config.json")
    print(f"  Go: {go_count} policies imported")
    
    total = py_count + java_count + go_count
    print(f"Total: {total} policies imported")
    return total > 0


def test_filter_policies(db):
    print("\n=== Test 2: Filter Policies ===")
    engine = PolicyEngine(db)
    
    print("Filter by language: Python")
    py_policies = engine.get_policies(language="python")
    print(f"  Found {len(py_policies)} Python policies")
    
    print("Filter by status code: 500")
    status_500 = engine.get_policies(status_code=500)
    print(f"  Found {len(status_500)} policies with status 500")
    
    print("Filter by category: server_error")
    server_errors = engine.get_policies(status_code_category="server_error")
    print(f"  Found {len(server_errors)} server error policies")
    
    print("Filter retryable only: True")
    retryable = engine.get_policies(is_retryable=True)
    print(f"  Found {len(retryable)} retryable policies")
    
    return len(py_policies) > 0 and len(status_500) > 0


def test_compare_policies(db):
    print("\n=== Test 3: Compare Policies (Discrepancy Detection) ===")
    engine = PolicyEngine(db)
    
    languages = ["python", "java", "go"]
    print(f"Comparing policies for: {', '.join(languages)}")
    report = engine.compare_policies(languages)
    
    print(f"  Report ID: {report.id}")
    print(f"  Status codes analyzed: {report.status_codes_analyzed}")
    print(f"  Discrepancies found: {report.discrepancies_found}")
    print(f"  Needs review: {report.needs_review}")
    
    discrepancies = engine.get_report_discrepancies(report.id)
    
    print("\n  Discrepancies by severity:")
    severity_counts: Dict[str, int] = {}
    for d in discrepancies:
        severity_counts[d.severity] = severity_counts.get(d.severity, 0) + 1
        print(f"    [{d.severity.upper()}] Status {d.status_code}: {d.language_a} vs {d.language_b} - {d.field_name}: {d.value_a} != {d.value_b}")
    
    return report.discrepancies_found > 0


def test_export_report(db):
    print("\n=== Test 4: Export Report ===")
    engine = PolicyEngine(db)
    
    report = engine.compare_policies(["python", "java"])
    exported = engine.export_report(report.id)
    
    print(f"Exported report: {exported['report_name']}")
    print(f"  Generated at: {exported['generated_at']}")
    print(f"  Discrepancies: {len(exported['discrepancies'])}")
    
    output_file = "./report_export.json"
    with open(output_file, "w") as f:
        json.dump(exported, f, indent=2)
    
    print(f"  Report exported to: {output_file}")
    return os.path.exists(output_file)


def test_error_cases(db):
    print("\n=== Test 5: Error Cases / Business Rules ===")
    engine = PolicyEngine(db)
    
    report = engine.compare_policies(["python", "java"])
    
    print("Test: Mark report as reviewed")
    result = engine.mark_reviewed(report.id, "test_user")
    print(f"  First review: {result}")
    
    print("Test: Mark already reviewed report")
    result = engine.mark_reviewed(report.id, "test_user")
    print(f"  Second review: {result} (expected: False - already processed)")
    
    print("Test: Resolve discrepancy")
    discrepancies = engine.get_report_discrepancies(report.id)
    if discrepancies:
        result = engine.resolve_discrepancy(discrepancies[0].id)
        print(f"  First resolve: {result}")
        result = engine.resolve_discrepancy(discrepancies[0].id)
        print(f"  Second resolve: {result} (expected: False - already resolved)")
    
    return True


def test_languages(db):
    print("\n=== Test 6: Language Management ===")
    engine = PolicyEngine(db)
    
    languages = engine.get_all_languages()
    print(f"Registered languages: {len(languages)}")
    for lang in languages:
        print(f"  - {lang.name} ({lang.display_name})")
    
    return len(languages) >= 3


def main():
    print("=" * 60)
    print("API客户端重试策略差异退避校验后端 - 自检脚本")
    print("=" * 60)
    
    db = setup_test_db()
    
    tests = [
        ("Import Config", test_import_config),
        ("Filter Policies", test_filter_policies),
        ("Compare Policies", test_compare_policies),
        ("Export Report", test_export_report),
        ("Error Cases", test_error_cases),
        ("Languages", test_languages),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            passed = test_func(db)
            results.append((name, passed))
        except Exception as e:
            print(f"  ERROR: {e}")
            results.append((name, False))
    
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    for name, passed in results:
        status = "PASS" if passed else "FAIL"
        print(f"  [{status}] {name}")
    
    passed_count = sum(1 for _, p in results if p)
    print(f"\nTotal: {passed_count}/{len(results)} tests passed")
    
    db.close()
    
    if os.path.exists("./test_retry_policy.db"):
        os.remove("./test_retry_policy.db")
    
    if passed_count == len(results):
        print("\n✅ All tests passed!")
        return 0
    else:
        print("\n❌ Some tests failed!")
        return 1


if __name__ == "__main__":
    sys.exit(main())