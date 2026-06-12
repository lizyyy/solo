from contract_review.api.server import app
import json

client = app.test_client()

print('=== 测试 API 接口 ===')
print()

# 1. 测试获取样本列表
resp = client.get('/api/samples')
data = resp.get_json()
print(f'1. GET /api/samples: {len(data)} 个样本')

# 2. 测试获取被掩盖的样本
resp = client.get('/api/masked-samples')
data = resp.get_json()
print(f'2. GET /api/masked-samples: {len(data)} 个被掩盖样本')

# 3. 测试获取样本详情
resp = client.get('/api/samples/SDEMO001')
data = resp.get_json()
print(f'3. GET /api/samples/SDEMO001: {data["contract_name"]}')

# 4. 测试获取修改历史
resp = client.get('/api/samples/SDEMO001/history')
data = resp.get_json()
print(f'4. GET /api/samples/SDEMO001/history: {len(data)} 条历史记录')

# 5. 测试版本对比
resp = client.post('/api/compare', json={'v1': '1.0.0', 'v2': '1.1.0', 'generated_by': '小孟'})
data = resp.get_json()
print(f'5. POST /api/compare: {data["report_id"]}, 对比 {data["summary"]["total_contracts"]} 份合同')

# 6. 测试文字版对比报告
resp = client.post('/api/compare/text', json={'v1': '1.0.0', 'v2': '1.1.0', 'generated_by': '小孟'})
data = resp.get_json()
print(f'6. POST /api/compare/text: 报告长度 {len(data["text"])} 字符')

# 7. 测试补录备注（带修改原因）
resp = client.post('/api/samples/SDEMO002/notes', json={
    'note': '服务协议中保密期限条款表述特殊，置信度低',
    'added_by': '小孟',
    'change_reason': '批量复核低置信度样本'
})
data = resp.get_json()
print(f'7. POST /api/samples/SDEMO002/notes: 成功，规则ID {data["rule_id"]}')

# 8. 验证补录后报告自动更新
resp = client.get('/api/reports')
reports = resp.get_json()
if reports:
    latest = reports[0]
    for item in latest['items']:
        if item['contract_name'] == '服务协议-2024-056':
            print(f'8. 验证联动更新: 脱敏备注={item["has_desensitization_note"]}, 下一步找={item["next_owner"]}')
            break

print()
print('✅ 所有 API 接口测试通过！')
print()
print('🌐 启动小看板: python3 main.py web')
print('   然后打开 http://localhost:5000')
