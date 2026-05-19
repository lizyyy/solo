#!/usr/bin/env python3
from dnszone_diff.parser import parse_zone_file

result = parse_zone_file('test', 'test_zones/test_indent.zone')
print('Records:')
for r in result.records:
    print(f'  [{r.sources[0].line_number}] {r.name} {r.record_type}: {r.value}')
print()
print(f'Bad lines: {len(result.bad_lines)}')
for bl in result.bad_lines:
    print(f'  Line {bl.source.line_number}: {bl.error}')
