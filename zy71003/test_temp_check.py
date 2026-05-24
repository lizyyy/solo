from app.services import check_temperature_window

# 测试1: 空列表
print('测试1: 空列表')
result = check_temperature_window([], 50.0)
print(f'  结果: {result}')
assert result['is_anomaly'] == False
assert result['max_temperature'] == 0.0
assert result['min_temperature'] == 0.0
assert result['avg_temperature'] == 0.0
assert result['temp_diff'] == 0.0
assert result['max_temp_rise'] == 0.0
print('  ✓ 通过')

# 测试2: 单个温度值
print('测试2: 单个温度值')
result = check_temperature_window([25.0], 50.0)
print(f'  结果: {result}')
assert result['is_anomaly'] == False
assert result['max_temperature'] == 25.0
assert result['min_temperature'] == 25.0
assert result['avg_temperature'] == 25.0
assert result['temp_diff'] == 0.0
assert result['max_temp_rise'] == 0.0
print('  ✓ 通过')

# 测试3: 多个温度值（正常）
print('测试3: 多个温度值（正常）')
result = check_temperature_window([25.0, 26.0, 27.0, 25.5], 50.0)
print(f'  结果: {result}')
assert result['is_anomaly'] == False
assert result['max_temperature'] == 27.0
assert result['min_temperature'] == 25.0
assert abs(result['avg_temperature'] - 25.875) < 0.001
assert result['temp_diff'] == 2.0
assert result['max_temp_rise'] == 1.0
print('  ✓ 通过')

# 测试4: 多个温度值（异常）
print('测试4: 多个温度值（异常）')
result = check_temperature_window([25.0, 30.0, 55.0, 45.0], 50.0)
print(f'  结果: {result}')
assert result['is_anomaly'] == True
assert result['max_temperature'] == 55.0
assert result['min_temperature'] == 25.0
assert result['temp_diff'] == 30.0
assert result['max_temp_rise'] == 25.0
print('  ✓ 通过')

print('\n所有测试通过！')
