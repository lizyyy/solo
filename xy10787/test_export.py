#!/usr/bin/env python3
import sys
import os
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

try:
    from fastapi.testclient import TestClient
    from main import app
    from database import Base, engine, SessionLocal
    from models import Translation, LanguageKey, LanguagePack, VersionRelease, CoverageReport
    print("✅ 导入成功")
except Exception as e:
    print(f"❌ 导入失败: {e}")
    sys.exit(1)

Base.metadata.create_all(bind=engine)
client = TestClient(app)
db = SessionLocal()

try:
    print("\n" + "=" * 60)
    print("验证导出功能完整流程")
    print("=" * 60)

    print("\n1. 清理测试数据...")
    db.query(CoverageReport).delete()
    db.query(VersionRelease).delete()
    db.query(Translation).delete()
    db.query(LanguageKey).delete()
    db.query(LanguagePack).delete()
    db.commit()

    print("2. 创建测试语言包...")
    pack = client.post("/api/translation/language-packs", json={
        "language_code": "zh-CN", 
        "language_name": "中文"
    })
    print(f"   状态: {pack.status_code}")
    language_pack_id = pack.json()['id']

    print("3. 创建测试文案 Key...")
    key = client.post("/api/translation/language-keys", json={
        "key": "test.welcome",
        "default_value": "Welcome {name}!"
    })
    print(f"   状态: {key.status_code}")
    
    print("4. 添加翻译内容...")
    trans = client.get("/api/translation")
    tid = trans.json()[0]['id']
    client.put(f"/api/translation/{tid}", json={
        "translated_text": "欢迎 {name}！"
    })

    print("5. 创建版本...")
    version = client.post("/api/version", json={
        "version": "v1.0.0",
        "language_pack_id": language_pack_id,
        "description": "测试版本"
    })
    print(f"   版本创建状态: {version.status_code}")
    version_id = version.json()['id']

    print("6. 发布版本（自动生成覆盖率报告）...")
    published = client.post(f"/api/version/{version_id}/publish")
    print(f"   发布状态: {published.status_code}")

    print("\n7. 获取覆盖率报告列表...")
    reports = client.get("/api/report")
    print(f"   获取报告状态: {reports.status_code}")
    reports_data = reports.json()
    
    if reports_data:
        print(f"   报告数量: {len(reports_data)}")
        report = reports_data[0]
        print(f"   报告 ID: {report['id']}")
        print(f"   版本 ID: {report['version_release_id']}")
        print(f"   语言包 ID: {report.get('language_pack_id', 'MISSING!')}")
        print(f"   版本号: {report.get('version', 'MISSING!')}")
        print(f"   语言代码: {report.get('language_code', 'MISSING!')}")
        print(f"   覆盖率: {report['coverage_rate']}%")
        
        if report.get('language_pack_id'):
            print("   ✅ language_pack_id 字段存在")
        else:
            print("   ❌ language_pack_id 字段缺失")
            sys.exit(1)
    else:
        print("   ❌ 没有找到报告")
        sys.exit(1)

    print("\n8. 测试导出功能（通过 language_pack_id）...")
    export1 = client.post("/api/report/export", json={
        "language_pack_id": language_pack_id,
        "format": "json"
    })
    print(f"   导出状态: {export1.status_code}")
    if export1.status_code == 200:
        print(f"   导出内容长度: {len(export1.content)} 字节")
        try:
            export_data = json.loads(export1.content)
            print(f"   导出元数据: {json.dumps(export_data.get('metadata', {}), ensure_ascii=False)}")
            print("   ✅ 导出成功（通过 language_pack_id）")
        except:
            print("   ✅ 导出成功（返回二进制内容）")
    else:
        print(f"   ❌ 导出失败: {export1.text}")
        sys.exit(1)

    print("\n9. 测试导出功能（通过 version_release_id 自动获取语言包）...")
    export2 = client.post("/api/report/export", json={
        "version_release_id": report['version_release_id'],
        "format": "json"
    })
    print(f"   导出状态: {export2.status_code}")
    if export2.status_code == 200:
        print(f"   导出内容长度: {len(export2.content)} 字节")
        print("   ✅ 导出成功（通过 version_release_id 自动获取语言包）")
    else:
        print(f"   ❌ 导出失败: {export2.text}")
        sys.exit(1)

    print("\n10. 测试只提供 version_release_id（模拟页面点击导出）...")
    export3 = client.post("/api/report/export", json={
        "version_release_id": report['version_release_id'],
        "format": "json"
    })
    print(f"   导出状态: {export3.status_code}")
    if export3.status_code == 200:
        print("   ✅ 模拟页面导出成功！")
    else:
        print(f"   ❌ 模拟页面导出失败: {export3.text}")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("✅ 所有导出功能验证通过！")
    print("=" * 60)
    print("\n完整功能链路:")
    print("  创建语言包 → 创建文案 Key → 翻译 → 创建版本")
    print("  ↓")
    print("  发布版本（自动生成覆盖率报告）")
    print("  ↓")
    print("  覆盖率报告页面展示报告（含 language_pack_id）")
    print("  ↓")
    print("  点击导出按钮 → 成功导出语言包 JSON")

finally:
    db.close()
