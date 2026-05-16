#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')
from cli import probe_csv, validate_headers

print("Testing validate_headers...")
actual = ['name', 'age', 'city']
expected = ['name', 'age', 'city']
result = validate_headers(actual, expected)
print(f"  Matching headers: {result['is_valid']}")
assert result['is_valid'] == True

expected2 = ['name', 'city', 'age']
result2 = validate_headers(actual, expected2)
print(f"  Order mismatch: {result2['order_mismatch']}")
assert result2['order_mismatch'] == True
assert result2['is_valid'] == False

expected3 = ['name', 'age']
result3 = validate_headers(actual, expected3)
print(f"  Extra fields: {result3['extra_fields']}")
assert len(result3['extra_fields']) == 1

print("\nTesting probe_csv with bad rows...")
probe_result = probe_csv('test_samples/mixed_bad_rows.csv', ['name', 'age', 'city'])
print(f"  Total rows: {probe_result['total_rows']}")
print(f"  Good rows: {probe_result['good_rows']}")
print(f"  Bad rows: {len(probe_result['bad_rows'])}")
for bad in probe_result['bad_rows']:
    print(f"    Row {bad['row_number']}: {bad.get('error_type', 'unknown')} - {bad['reason']}")
    print(f"      Content: {bad.get('raw_content', '')[:60]}")

print(f"\n  Header validation: {probe_result['header_validation']}")

print("\nAll tests passed!")
