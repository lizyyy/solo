#!/usr/bin/env python3
"""Verify CSV and YAML parser fixes"""
import sys
sys.path.insert(0, '/Users/lzy/pro/solo/workspaces/zy70797')

from orphan_checker.parser import ServiceCatalogParser
from orphan_checker.models import SourceLocation

def test_yaml_parsing():
    print("=== Testing YAML Parsing (Bad Line Location) ===")
    parser = ServiceCatalogParser('examples/service_catalog.yaml')
    valid, invalid = parser.parse()
    
    print(f"Valid entries: {len(valid)}")
    print(f"Invalid entries: {len(invalid)}")
    
    for entry in invalid:
        print(f"  - {entry.service_name}: line {entry.source.line_number}")
        print(f"    Error: {entry.parse_error}")
    
    if len(invalid) == 2:
        lines = sorted([e.source.line_number for e in invalid])
        if lines == [38, 40]:
            print("  ✓ YAML bad line locations CORRECT!")
        else:
            print(f"  ✗ YAML bad line locations WRONG: expected [38, 40], got {lines}")
    else:
        print("  ✗ Wrong number of invalid entries")
    print()

def test_standard_csv():
    print("=== Testing Standard CSV (Quoted Fields) ===")
    parser = ServiceCatalogParser('examples/service_catalog.csv')
    valid, invalid = parser.parse()
    
    print(f"Valid entries: {len(valid)}")
    
    for entry in valid:
        print(f"  {entry.service_name}:")
        print(f"    Owners: {entry.owners}")
        print(f"    Alerts: {entry.alert_rules}")
    
    user_service = next((e for e in valid if e.service_name == 'user-service'), None)
    if user_service:
        owners_ok = set(user_service.owners) == {'zhangsan@example.com', 'lisi'}
        alerts_ok = set(user_service.alert_rules) == {'UserServiceHighErrorRate', 'UserServiceHighLatency'}
        if owners_ok and alerts_ok:
            print("  ✓ Standard CSV parsed CORRECTLY!")
        else:
            print(f"  ✗ Standard CSV parsing issues: owners_ok={owners_ok}, alerts_ok={alerts_ok}")
    print()

def test_unquoted_csv():
    print("=== Testing Unquoted CSV (Multi-value without Quotes) ===")
    parser = ServiceCatalogParser('examples/service_catalog_unquoted.csv')
    valid, invalid = parser.parse()
    
    print(f"Valid entries: {len(valid)}")
    
    for entry in valid:
        print(f"  {entry.service_name}:")
        print(f"    Owners: {entry.owners}")
        print(f"    Alerts: {entry.alert_rules}")
        
        has_mixed = any(rule in entry.owners for rule in entry.alert_rules) or \
                    any(owner in entry.alert_rules for owner in entry.owners)
        print(f"    Mixed: {'YES - PROBLEM!' if has_mixed else 'NO - OK'}")
    
    expected_results = {
        'user-service': {
            'owners': {'zhangsan@example.com', 'lisi'},
            'alerts': {'UserServiceHighErrorRate', 'UserServiceHighLatency'},
            'desc': 'email + lowercase short owners, High keyword alerts'
        },
        'test-service': {
            'owners': {'dev1', 'dev2'},
            'alerts': {'TestAlertHigh', 'TestAlertLow'},
            'desc': 'devX owners, Test prefix + High/Low alerts'
        },
        'mixed-service': {
            'owners': {'owner1', 'owner2'},
            'alerts': {'RuleA', 'RuleB'},
            'desc': 'ownerX owners, RuleX alerts - key fix!'
        }
    }
    
    all_passed = True
    print()
    for service_name, expected in expected_results.items():
        entry = next((e for e in valid if e.service_name == service_name), None)
        if entry:
            owners_ok = set(entry.owners) == expected['owners']
            alerts_ok = set(entry.alert_rules) == expected['alerts']
            
            if owners_ok and alerts_ok:
                print(f"  ✓ {service_name}: {expected['desc']}")
            else:
                all_passed = False
                print(f"  ✗ {service_name}: {expected['desc']}")
                if not owners_ok:
                    print(f"      Owners expected {sorted(expected['owners'])}, got {sorted(entry.owners)}")
                if not alerts_ok:
                    print(f"      Alerts expected {sorted(expected['alerts'])}, got {sorted(entry.alert_rules)}")
        else:
            all_passed = False
            print(f"  ✗ {service_name}: NOT FOUND in results")
    
    print()
    if all_passed:
        print("  ✓ ALL unquoted CSV parsing tests PASSED!")
    else:
        print("  ✗ Some unquoted CSV parsing tests FAILED!")
    print()

if __name__ == "__main__":
    test_yaml_parsing()
    test_standard_csv()
    test_unquoted_csv()
    print("=== All tests completed ===")
