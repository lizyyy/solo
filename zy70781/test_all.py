#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

from dnszone_diff.parser import parse_zone_file
from dnszone_diff.comparator import compare_zones
from dnszone_diff.reporter import generate_report

print("=" * 60)
print("Test 1: Parse zone with indented continuation lines")
print("=" * 60)
result = parse_zone_file('test', 'test_zones/test_indent.zone')
print(f"Records found: {len(result.records)}")
print(f"Bad lines: {len(result.bad_lines)}")
for r in result.records:
    print(f"  [{r.sources[0].line_number}] {r.name} {r.record_type}: {r.value}")

expected_records = [
    ("www", "A", "1.1.1.1"),
    ("www", "AAAA", "::1"),
    ("www", "MX", "10  mail.example.com."),
    ("api", "A", "2.2.2.2"),
    ("api", "A", "2.2.2.3"),
]
actual_records = [(r.name, r.record_type, r.value) for r in result.records]
if all(er in actual_records for er in expected_records):
    print("✓ All expected records found")
else:
    print("✗ Some records missing!")

print()
print("=" * 60)
print("Test 2: Compare indented continuation line zones")
print("=" * 60)
a_result = parse_zone_file('a', 'test_zones/test_indent_a.zone')
b_result = parse_zone_file('b', 'test_zones/test_indent_b.zone')
diff_result = compare_zones([a_result, b_result])
report = generate_report(diff_result, fmt='text')
print(report)

print()
print("=" * 60)
print("Test 3: Regression - SOA multiline parsing")
print("=" * 60)
soa_result = parse_zone_file('test', 'test_zones/test_soa_a.zone')
for r in soa_result.records:
    if r.record_type == 'SOA':
        print(f"  SOA value length: {len(r.value)} chars")
        print(f"  SOA sources lines: {len(r.sources)}")
        if '2024010101' in r.value:
            print("✓ Serial found in SOA value")
        else:
            print("✗ Serial missing from SOA value!")

print()
print("=" * 60)
print("Test 4: Regression - NS record multi-value parsing")
print("=" * 60)
nsa_result = parse_zone_file('a', 'test_zones/test_ns_a.zone')
nsb_result = parse_zone_file('b', 'test_zones/test_ns_b.zone')
ns_diff = compare_zones([nsa_result, nsb_result])
if ns_diff.has_issues():
    print("✓ NS differences detected")
else:
    print("✗ NS differences not detected!")

print()
print("=" * 60)
print("All tests completed!")
