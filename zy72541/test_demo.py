#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
sys.path.insert(0, '.')

from models import DataStore
from demo import DemoDataLoader

print("=" * 70)
print("  客服知识片段过期预警 - 完整流程测试")
print("=" * 70)

loader = DemoDataLoader()
batch_id = loader.load_full_demo()

print("\n" + "=" * 70)
print("  验证结果")
print("=" * 70)

store = DataStore()
results = store.get_all_results()

print(f"\n✅ 总预警结果数: {len(results)}")

for r in results:
    print(f"\n  [{r.session_id}] 预警={r.alert_status.value} | 脱敏={r.desensitization_status.value} | 证据={r.evidence_source.value} | v{r.version}")
    print(f"     问题: {r.original_question}")
    if r.raw_phone_found:
        print(f"     ⚠  发现手机号: {r.raw_phone_found}")
    if r.on_site_statement:
        print(f"     💬 现场说法: {r.on_site_statement[:50]}...")
    print(f"     历史操作数: {len(r.history)}")

print("\n" + "=" * 70)
print("  三种典型场景验证:")
print("=" * 70)

sess001 = next((r for r in results if r.session_id == "SESS_001"), None)
if sess001:
    print(f"✅ SESS_001 顺利记录: 预警={sess001.alert_status.value}, 脱敏={sess001.desensitization_status.value}")

sess002 = next((r for r in results if r.session_id == "SESS_002"), None)
if sess002:
    print(f"⚠  SESS_002 手机号漏遮: 预警={sess002.alert_status.value}, 脱敏={sess002.desensitization_status.value}, 手机号={sess002.raw_phone_found}")

sess003 = next((r for r in results if r.session_id == "SESS_003"), None)
if sess003:
    print(f"🔄 SESS_003 旧口径: 预警={sess003.alert_status.value}, 现场说法已补录={'是' if sess003.on_site_statement else '否'}")

sess005 = next((r for r in results if r.session_id == "SESS_005"), None)
if sess005:
    print(f"🔁 SESS_005 返工场景: 预警={sess005.alert_status.value}, 版本={sess005.version}")

anns = store.get_all_annotations()
print(f"\n📝 标注员留言数: {len(anns)}")

from exporter import ExportManager
exporter = ExportManager()
export_path = exporter.export_results_to_excel(results, batch_id=batch_id)
print(f"📥 导出文件: {export_path}")

print("\n🎉 测试完成！")
