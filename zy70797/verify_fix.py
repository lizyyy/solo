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
    
    user_service = next((e for e in valid if e.service_name == 'user-service'), None)
    if user_service:
        owners_set = set(user_service.owners)
        alerts_set = set(user_service.alert_rules)
        
        expected_owners = {'zhangsan@example.com', 'lisi'}
        expected_alerts = {'UserServiceHighErrorRate', 'UserServiceHighLatency'}
        
        owners_ok = owners_set == expected_owners
        alerts_ok = alerts_set == expected_alerts
        
        print()
        if owners_ok and alerts_ok:
            print("  ✓ Unquoted CSV parsed CORRECTLY - owners and alert_rules are separated!")
        else:
            print(f"  ✗ Unquoted CSV parsing issues:")
            print(f"    Owners expected {sorted(expected_owners)}, got {sorted(owners_set)}")
            print(f"    Alerts expected {sorted(expected_alerts)}, got {sorted(alerts_set)}")
    print()

if __name__ == "__main__":
    test_yaml_parsing()
    test_standard_csv()
    test_unquoted_csv()
    print("=== All tests completed ===")
