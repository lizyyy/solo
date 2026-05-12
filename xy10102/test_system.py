import sys
import os

print('=' * 60)
print('依赖检查')
print('=' * 60)

required = ['yaml', 'pandas', 'numpy', 'sklearn', 'matplotlib', 'seaborn', 'openpyxl', 'joblib']

for lib in required:
    try:
        __import__(lib)
        print(f'✓ {lib} 已安装')
    except ImportError as e:
        print(f'✗ {lib} 未安装: {e}')

print()
print('=' * 60)
print('模块导入测试')
print('=' * 60)

try:
    from charging_forecast import (
        load_config,
        DataLoader,
        UnitConverter,
        QualityController,
        FeatureEngineer,
        LoadPredictor,
        ReportGenerator,
        ResultExporter
    )
    print('✓ 所有核心模块导入成功')
except ImportError as e:
    print(f'✗ 模块导入失败: {e}')
    import traceback
    traceback.print_exc()
    sys.exit(1)

print()
print('=' * 60)
print('配置文件验证')
print('=' * 60)

try:
    config = load_config('config.yaml')
    print(f'✓ 配置加载成功')
    print(f'  - 输入路径: {config.data.input_path}')
    print(f'  - 目标单位 (功率): {config.quality_control.charging_power.get("unit", "N/A")}')
    print(f'  - 目标单位 (能耗): {config.quality_control.energy_consumed.get("unit", "N/A")}')
    print(f'  - 目标单位 (时长): {config.quality_control.charging_duration.get("unit", "N/A")}')
except Exception as e:
    print(f'✗ 配置加载失败: {e}')
    sys.exit(1)

print()
print('=' * 60)
print('单位换算功能测试')
print('=' * 60)

unit_converter = UnitConverter(config)

test_cases = [
    ('100kW', 'kW', 100.0),
    ('100000W', 'kW', 100.0),
    ('0.1MW', 'kW', 100.0),
    ('50kWh', 'kWh', 50.0),
    ('50000Wh', 'kWh', 50.0),
    ('30min', 'minutes', 30.0),
    ('1800s', 'minutes', 30.0),
    ('0.5h', 'minutes', 30.0),
    ('100瓦', 'kW', 0.1),
    ('50度', 'kWh', 50.0),
]

print('单位换算测试:')
all_passed = True
for value, target_unit, expected in test_cases:
    result = unit_converter.convert_value(value, target_unit)
    if result.converted and abs(result.value - expected) < 0.001:
        print(f'  ✓ {value} -> {expected} {target_unit}')
    else:
        print(f'  ✗ {value} -> 期望 {expected}, 实际 {result.value} (错误: {result.error})')
        all_passed = False

print()
print('=' * 60)
print('异常类型测试')
print('=' * 60)

qc = QualityController(config)
print('✓ 质量控制器创建成功')
print(f'  - 支持的异常类型: ')
for attr in dir(qc):
    if attr.startswith('FAILURE_'):
        print(f'    * {attr}: {getattr(qc, attr)}')

print()
print('=' * 60)
if all_passed:
    print('✅ 所有检查通过!')
else:
    print('❌ 部分检查失败')
    sys.exit(1)
print('=' * 60)
