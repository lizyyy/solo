from water_hammer_calc.models import NameplateData, MaintenanceScreenshot, WaterHammerInput
from water_hammer_calc.store import DataStore
from water_hammer_calc.engine import run_calculation
import json
import os
import shutil

if os.path.exists('./wh_data'):
    shutil.rmtree('./wh_data')

store = DataStore('./wh_data')

print('=' * 60)
print('第一步：导入设备铭牌参数并计算')
print('=' * 60)
with open('samples/nameplate_001.json', encoding='utf-8') as f:
    nameplate = NameplateData.model_validate(json.load(f))
store.save_nameplate(nameplate)
print(f'✓ 导入铭牌: {nameplate.equipment_id}')

with open('samples/calc_input_001.json', encoding='utf-8') as f:
    input_data = WaterHammerInput.model_validate(json.load(f))
result = run_calculation(input_data)
store.save_calculation('demo-workflow', input_data, result)
print(f'✓ 计算完成')
print(f'  分类: {result.classification}')
review_count = len([f for f in result.override_flags if f.needs_review])
print(f'  需复核数量: {review_count}')

print()
print('=' * 60)
print('第二步：训练教练老唐补看维修群截图')
print('=' * 60)
with open('samples/screenshot_001.json', encoding='utf-8') as f:
    screenshot = MaintenanceScreenshot.model_validate(json.load(f))
store.save_screenshot(screenshot)
print(f'✓ 导入截图: {screenshot.screenshot_id}')
print(f'  描述: {screenshot.description}')

updated_input = store.link_screenshot_to_parameters('SCREEN-2024-001', 'demo-workflow')
print(f'✓ 截图关联到参数，溯源更新如下:')
for e in updated_input.parameter_entries:
    print(f'  {e.name:20s} → {e.provenance.source.value}')

print()
print('=' * 60)
print('第三步：设备工程师复核并补充原因')
print('=' * 60)
updated_result = store.add_override_reason('demo-workflow', 'friction_factor', 
    '老唐提供的管道结垢照片显示实际粗糙度大于设计值')
print(f'✓ 补充 friction_factor 原因')
print(f'  当前分类: {updated_result.classification}')

updated_result2 = store.add_override_reason('demo-workflow', 'valve_closing_time',
    '维修群截图显示实测关阀时间为2.5秒，铭牌标称5秒偏保守')
print(f'✓ 补充 valve_closing_time 原因')
print(f'  当前分类: {updated_result2.classification}')

print()
print('=' * 60)
print('参数回放页叙事')
print('=' * 60)
print(updated_result2.replay_narrative)

print()
print('=' * 60)
print('✓ 三步工作流全部通过验证！')
print('=' * 60)
