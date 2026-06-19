import sys
sys.path.insert(0, '.')
from app.coord_utils import detect_coord_type

cases = [
    ('30.2591, 121.9634, 12.5m', 'latlng_with_distance'),
    ('X:1500mm Y:3200mm Z:5800mm', 'metric'),
    ('31.2304/121.4737 X:2000mm', 'mixed'),
]

print('=== 三条样例验证 ===')
all_ok = True
for raw, expected in cases:
    actual = detect_coord_type(raw).value
    status = 'PASS' if actual == expected else 'FAIL'
    if actual != expected:
        all_ok = False
    print(f'{status}: \"{raw}\"')
    print(f'  期望: {expected}')
    print(f'  实际: {actual}')
    print()

print('=== 边界情况验证 ===')
edge_cases = [
    ('30.2591, 121.9634', 'latlng'),
    ('30.2591, 121.9634, D:12.5m', 'latlng_with_distance'),
    ('30.2591, 121.9634, 距离:12.5米', 'latlng_with_distance'),
    ('X:1500 Y:3200 Z:5800', 'metric'),
    ('1500,3200,5800', 'latlng'),
    ('30.2591, 121.9634, 12.5m, 障碍物:集装箱', 'latlng_with_distance'),
    ('30.2591, 121.9634 X:1500mm', 'mixed'),
]
for raw, expected in edge_cases:
    actual = detect_coord_type(raw).value
    status = 'PASS' if actual == expected else 'FAIL'
    if actual != expected:
        all_ok = False
    print(f'{status}: \"{raw}\" -> {actual} (expected: {expected})')

print()
print('OVERALL:', 'PASS' if all_ok else 'FAIL')
