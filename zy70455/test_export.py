import urllib.parse
import urllib.request
import json

print("=" * 60)
print("调用链采样导出服务 - 导出功能验证")
print("=" * 60)

# 1. 初始化演示数据
print("\n1. 初始化演示数据...")
req = urllib.request.Request("http://localhost:8080/api/demo/init", method="POST")
resp = urllib.request.urlopen(req)
data = json.loads(resp.read().decode())
batch_id = data['data']['batch_ids'][0]
print(f"   测试批次: {batch_id}")
encoded_batch_id = urllib.parse.quote(batch_id)

# 2. 执行采样
print(f"\n2. 执行采样...")
req = urllib.request.Request(f"http://localhost:8080/api/batches/{encoded_batch_id}/sample", method="POST")
resp = urllib.request.urlopen(req)
sample_data = json.loads(resp.read().decode())
print(f"   采样完成，共 {sample_data.get('sampled_count', 0)} 条采样记录")

# 3. 测试导出摘要
print(f"\n3. 获取导出摘要...")
resp = urllib.request.urlopen(f"http://localhost:8080/api/export/{encoded_batch_id}/summary")
summary = json.loads(resp.read().decode())
print(f"   批次ID: {summary['batch_id']}")
print(f"   部门: {summary['department']}")
print(f"   总记录数: {summary['total_records']}")
print(f"   采样记录数: {summary['sampled_count']}")

# 4. 测试CSV导出
print(f"\n4. 测试CSV导出...")
resp = urllib.request.urlopen(f"http://localhost:8080/api/export/{encoded_batch_id}/csv?operator=tester")
csv_content = resp.read().decode('utf-8')
lines = csv_content.strip().split('\n')
print(f"   CSV导出成功！共 {len(lines)} 行")
print(f"   表头: {lines[0]}")

# 5. 测试Excel导出
print(f"\n5. 测试Excel导出...")
resp = urllib.request.urlopen(f"http://localhost:8080/api/export/{encoded_batch_id}/excel?operator=tester")
excel_content = resp.read()
print(f"   Excel导出成功！文件大小: {len(excel_content)} 字节")

# 6. 查看导出历史
print(f"\n6. 查看导出历史...")
resp = urllib.request.urlopen(f"http://localhost:8080/api/export/{encoded_batch_id}/summary")
summary = json.loads(resp.read().decode())
print(f"   历史导出次数: {len(summary['export_history'])}")
for h in summary['export_history']:
    print(f"     - {h['export_format']} by {h['operator']}")

# 7. 测试导出全部记录
print(f"\n7. 测试导出全部记录(不经过采样)...")
resp = urllib.request.urlopen(f"http://localhost:8080/api/export/{encoded_batch_id}/csv?sampled_only=False&operator=tester")
csv_all = resp.read().decode('utf-8')
lines_all = csv_all.strip().split('\n')
print(f"   全部记录CSV导出成功！共 {len(lines_all)} 行")

print("\n" + "=" * 60)
print("✅ 所有导出功能验证通过！")
print("=" * 60)


