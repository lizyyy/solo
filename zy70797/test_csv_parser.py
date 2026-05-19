#!/usr/bin/env python3
from orphan_checker.parser import ServiceCatalogParser

print("=== Testing CSV Parser with unquoted multi-value fields ===")
print()

parser = ServiceCatalogParser('examples/service_catalog_unquoted.csv')
valid, invalid = parser.parse()

print(f"Valid entries: {len(valid)}")
print(f"Invalid entries: {len(invalid)}")
print()

for entry in valid:
    print(f"Service: {entry.service_name}")
    print(f"  Source: {entry.source}")
    print(f"  Owners: {entry.owners}")
    print(f"  Alert Rules: {entry.alert_rules}")
    
    has_mixed = any(rule in entry.owners for rule in entry.alert_rules) or any(owner in entry.alert_rules for owner in entry.owners)
    print(f"  Mixed: {'YES - PROBLEM!' if has_mixed else 'NO - OK'}")
    print()

print("=== Summary ===")
print("user-service should have owners: ['zhangsan@example.com', 'lisi']")
print("user-service should have alert_rules: ['UserServiceHighErrorRate', 'UserServiceHighLatency']")
