#!/usr/bin/env python3
"""Test the alert rule classification logic"""
import sys
sys.path.insert(0, '/Users/lzy/pro/solo/workspaces/zy70797')

from orphan_checker.parser import ServiceCatalogParser

def test_classification():
    parser = ServiceCatalogParser('examples/service_catalog.csv')
    
    test_cases = [
        ("zhangsan@example.com", "owner", "email"),
        ("lisi", "owner", "lowercase short"),
        ("owner1", "owner", "lowercase with digit"),
        ("owner2", "owner", "lowercase with digit"),
        ("dev1", "owner", "lowercase with digit"),
        ("dev2", "owner", "lowercase with digit"),
        ("RuleA", "alert", "Rule prefix"),
        ("RuleB", "alert", "Rule prefix"),
        ("TestAlertHigh", "alert", "Test prefix + camelCase"),
        ("TestAlertLow", "alert", "Test prefix + camelCase"),
        ("UserServiceHighErrorRate", "alert", "has High keyword"),
        ("UserServiceHighLatency", "alert", "has High keyword"),
    ]
    
    print("=== Testing Classification ===")
    all_passed = True
    
    for val, expected_type, description in test_cases:
        is_owner = parser._looks_like_owner(val)
        is_alert1 = parser._looks_like_alert_rule(val)
        is_alert2 = parser._is_likely_alert_name(val)
        is_alert = is_alert1 or is_alert2
        
        actual_type = "alert" if is_alert else "owner" if is_owner else "unknown"
        passed = actual_type == expected_type
        
        status = "✓" if passed else "✗"
        if not passed:
            all_passed = False
        
        print(f"  {status} {val}: expected={expected_type}, actual={actual_type} ({description})")
        if not passed:
            print(f"      _looks_like_owner={is_owner}, _looks_like_alert_rule={is_alert1}, _is_likely_alert_name={is_alert2}")
    
    print()
    if all_passed:
        print("✓ All classification tests passed!")
    else:
        print("✗ Some classification tests failed!")
    
    print()
    return all_passed

def test_csv_parsing():
    print("=== Testing CSV Parsing ===")
    
    parser = ServiceCatalogParser('examples/service_catalog_unquoted.csv')
    valid, invalid = parser.parse()
    
    print(f"Valid entries: {len(valid)}")
    all_passed = True
    
    for entry in valid:
        print(f"\n  {entry.service_name}:")
        print(f"    Owners: {entry.owners}")
        print(f"    Alerts: {entry.alert_rules}")
        
        has_mixed = any(rule.lower() in [o.lower() for o in entry.owners] for rule in entry.alert_rules)
        if has_mixed:
            print(f"    ✗ Mixed: SAME value in both owners and alerts!")
            all_passed = False
        else:
            print(f"    ✓ No mixing between owners and alerts")
    
    expected = {
        'user-service': {
            'owners': {'zhangsan@example.com', 'lisi'},
            'alerts': {'UserServiceHighErrorRate', 'UserServiceHighLatency'}
        },
        'test-service': {
            'owners': {'dev1', 'dev2'},
            'alerts': {'TestAlertHigh', 'TestAlertLow'}
        },
        'mixed-service': {
            'owners': {'owner1', 'owner2'},
            'alerts': {'RuleA', 'RuleB'}
        }
    }
    
    print("\n=== Verifying Expected Results ===")
    for service_name, expected_data in expected.items():
        entry = next((e for e in valid if e.service_name == service_name), None)
        if entry:
            owners_ok = set(entry.owners) == expected_data['owners']
            alerts_ok = set(entry.alert_rules) == expected_data['alerts']
            
            if owners_ok and alerts_ok:
                print(f"  ✓ {service_name}: Correct!")
            else:
                all_passed = False
                print(f"  ✗ {service_name}: Issues found!")
                if not owners_ok:
                    print(f"      Owners expected {sorted(expected_data['owners'])}, got {sorted(entry.owners)}")
                if not alerts_ok:
                    print(f"      Alerts expected {sorted(expected_data['alerts'])}, got {sorted(entry.alert_rules)}")
        else:
            print(f"  ✗ {service_name}: Not found in results")
            all_passed = False
    
    print()
    return all_passed

if __name__ == "__main__":
    passed1 = test_classification()
    passed2 = test_csv_parsing()
    
    if passed1 and passed2:
        print("=== ALL TESTS PASSED ✓ ===")
        sys.exit(0)
    else:
        print("=== SOME TESTS FAILED ✗ ===")
        sys.exit(1)
