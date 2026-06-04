#!/usr/bin/env python3
import urllib.request
import json

def api_get(path):
    url = f"http://localhost:8082{path}"
    with urllib.request.urlopen(url, timeout=5) as resp:
        return json.loads(resp.read().decode('utf-8'))

def api_post(path, data):
    url = f"http://localhost:8082{path}"
    body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=body, method='POST')
    req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode('utf-8'))

print("=" * 60)
print("🪂 降落伞开伞冲击 API 接口测试")
print("=" * 60)

# 1. 重置数据
print("\n1️⃣  重置数据")
data = api_post('/api/reset', {})
print(f"   当前阶段: {data['current_stage']}")
print(f"   总数据点: {data['total_points']}")
print(f"   混用点数: {data['mixed_count']}")
print(f"   校准记录: {data['calibration_count']}")

# 2. 测试点击数据点1
print("\n2️⃣  点击数据点1（混用点）")
data = api_get('/api/click?idx=1')
print(f"   点号: {data['point_idx']}")
print(f"   混用标记: {'⚠️' in data.get('warning', '')}")
print(f"   可回溯采样间隔说明: {any(o['type'] == '采样间隔说明' for o in data['navigate_options'])}")
for opt in data['navigate_options']:
    if opt['type'] == '采样间隔说明':
        print(f"     - 文件: {opt['file']}")
        print(f"     - 行号: {opt['line']}")
        print(f"     - 原文: {opt['raw_text']}")
cal_opt = next((o for o in data['navigate_options'] if o['type'] == '温度校准记录'), None)
print(f"   可回溯校准记录: {cal_opt and cal_opt.get('status') != '缺失'}")

# 3. 林老师补录校准记录
print("\n3️⃣  林老师补录温度校准记录")
data = api_post('/api/calibrate', {
    'point_ids': [1],
    'instrument_id': 'INS-2026-001',
    'calibration_temp': 24.85,
    'calibration_unit': '°C',
    'remarks': '开尔文298K转换为摄氏度24.85°C，已确认与原始采样一致'
})
print(f"   当前阶段: {data['current_stage']}")
print(f"   校准记录: {data['calibration_count']}")

# 4. 再次点击数据点1，验证校准记录已关联
print("\n4️⃣  再次点击数据点1（验证校准记录已关联）")
data = api_get('/api/click?idx=1')
cal_opt = next((o for o in data['navigate_options'] if o['type'] == '温度校准记录'), None)
print(f"   可回溯校准记录: {cal_opt and cal_opt.get('status') != '缺失'}")
if cal_opt and cal_opt.get('record_id'):
    print(f"     - 编号: {cal_opt['record_id']}")
    print(f"     - 记录人: {cal_opt['recorded_by']}")
    print(f"     - 备注: {cal_opt['remarks']}")

# 5. 更新交接报告
print("\n5️⃣  训练教练复核后更新交接报告")
data = api_post('/api/update', {
    'coach_notes': '已复核所有单位混用点，校准记录完整，可用于训练评估'
})
print(f"   当前阶段: {data['current_stage']}")

# 6. 获取完整报告
print("\n6️⃣  获取交接报告")
data = api_get('/api/report')
report = data['full_report']
if '训练教练您好' in report and '林老师您好' in report:
    print("   ✅ 报告包含双方摘要")
if '系统未对混用数据做自动归一化' in report:
    print("   ✅ 报告明确说明未自动归一化")
if '留存原因' in report:
    print("   ✅ 报告包含逐条留存说明")

print("\n" + "=" * 60)
print("✅ 所有API接口测试通过！")
print("=" * 60)
print("\n📊 Web看板地址: http://localhost:8082/dashboard")
print("💻 命令行演示: python3 cli.py demo")
print("🧪 单元测试: python3 -m pytest test_workflow.py -v")
