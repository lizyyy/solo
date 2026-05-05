#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
殡仪服务站复核台 - 测试脚本
"""

import json
from models import DataStore
from rules_engine import RulesEngine
from data_importer import DataImporter
from data_exporter import DataExporter
from storage import LocalStorage


def test_data_import():
    print("=" * 60)
    print("测试 1: 数据导入功能")
    print("=" * 60)
    
    data_store = DataStore()
    importer = DataImporter(data_store)
    
    json_file = "sample_data/sample_complete.json"
    print(f"\n导入JSON文件: {json_file}")
    
    try:
        importer.import_json(json_file)
        print(f"  ✓ 逝者数据: {len(data_store.deceased)} 条")
        print(f"  ✓ 柜位数据: {len(data_store.cabinets)} 条")
        print(f"  ✓ 接运单数据: {len(data_store.transport_orders)} 条")
        print(f"  ✓ 温度记录: {len(data_store.temperature_records)} 条")
        print(f"  ✓ 告别厅预约: {len(data_store.farewell_bookings)} 条")
        print(f"  ✓ 火化排期: {len(data_store.cremation_schedules)} 条")
        print(f"  ✓ 证件数据: {len(data_store.documents)} 条")
    except Exception as e:
        print(f"  ✗ 导入失败: {e}")
        return False
    
    return True


def test_rules_engine():
    print("\n" + "=" * 60)
    print("测试 2: 规则引擎功能")
    print("=" * 60)
    
    data_store = DataStore()
    importer = DataImporter(data_store)
    importer.import_json("sample_data/sample_complete.json")
    
    rules_engine = RulesEngine(data_store)
    rules_engine.check_all()
    
    risks = rules_engine.get_risks()
    print(f"\n检测到风险: {len(risks)} 项")
    
    risk_types = {}
    for risk in risks:
        risk_type = risk['type']
        if risk_type not in risk_types:
            risk_types[risk_type] = 0
        risk_types[risk_type] += 1
    
    print("\n风险类型统计:")
    for rtype, count in risk_types.items():
        print(f"  - {rtype}: {count} 项")
    
    print("\n风险详情示例:")
    for i, risk in enumerate(risks[:5]):
        print(f"\n  {i+1}. [{risk['level']}风险] {risk['type']} - {risk['deceased_name']}")
        print(f"     信息: {risk['info']}")
        print(f"     描述: {risk['description'][:80]}...")
    
    return True


def test_data_export():
    print("\n" + "=" * 60)
    print("测试 3: 数据导出功能")
    print("=" * 60)
    
    data_store = DataStore()
    importer = DataImporter(data_store)
    importer.import_json("sample_data/sample_complete.json")
    
    exporter = DataExporter(data_store)
    
    markdown_file = "test_output/handover.md"
    json_file = "test_output/audit.json"
    
    import os
    os.makedirs("test_output", exist_ok=True)
    
    try:
        exporter.export_markdown(markdown_file)
        print(f"\n  ✓ Markdown交接单已导出: {markdown_file}")
    except Exception as e:
        print(f"  ✗ Markdown导出失败: {e}")
        return False
    
    try:
        exporter.export_json_audit(json_file)
        print(f"  ✓ JSON审计包已导出: {json_file}")
    except Exception as e:
        print(f"  ✗ JSON导出失败: {e}")
        return False
    
    print("\n导出内容预览 (Markdown):")
    with open(markdown_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()[:30]
        for line in lines:
            print(f"  {line.rstrip()}")
    
    return True


def test_local_storage():
    print("\n" + "=" * 60)
    print("测试 4: 本地存储功能")
    print("=" * 60)
    
    data_store = DataStore()
    importer = DataImporter(data_store)
    importer.import_json("sample_data/sample_complete.json")
    
    storage = LocalStorage(data_dir="test_storage")
    print(f"\n存储路径: {storage.get_data_path()}")
    
    save_data = {
        'data_store': data_store.to_dict(),
        'reviews': [
            {
                'time': '2026-05-05 10:00:00',
                'operator': '测试员',
                'risk_type': '温度超限',
                'risk_id': 'test_001',
                'deceased_name': '张三',
                'note': '已通知维修人员检查',
                'status': '处理中'
            }
        ]
    }
    
    try:
        storage.save(save_data)
        print("  ✓ 数据保存成功")
    except Exception as e:
        print(f"  ✗ 保存失败: {e}")
        return False
    
    try:
        loaded_data = storage.load()
        if loaded_data:
            print(f"  ✓ 数据加载成功")
            print(f"    - 逝者数据: {len(loaded_data.get('data_store', {}).get('deceased', {}))} 条")
            print(f"    - 复核记录: {len(loaded_data.get('reviews', []))} 条")
        else:
            print("  ✗ 加载数据为空")
            return False
    except Exception as e:
        print(f"  ✗ 加载失败: {e}")
        return False
    
    return True


def test_csv_import():
    print("\n" + "=" * 60)
    print("测试 5: CSV导入功能")
    print("=" * 60)
    
    data_store = DataStore()
    importer = DataImporter(data_store)
    
    csv_files = [
        ("sample_data/sample_deceased.csv", "逝者数据"),
        ("sample_data/sample_cabinets.csv", "柜位数据"),
        ("sample_data/sample_temperature.csv", "温度记录"),
        ("sample_data/sample_transport.csv", "接运单"),
        ("sample_data/sample_farewell.csv", "告别厅预约"),
        ("sample_data/sample_cremation.csv", "火化排期"),
        ("sample_data/sample_documents.csv", "证件数据")
    ]
    
    print("\n逐类导入CSV文件:")
    for csv_file, desc in csv_files:
        try:
            importer.import_csv(csv_file)
            print(f"  ✓ {desc}导入成功: {csv_file}")
        except Exception as e:
            print(f"  ✗ {desc}导入失败: {e}")
    
    print(f"\n导入后数据统计:")
    print(f"  - 逝者: {len(data_store.deceased)} 条")
    print(f"  - 柜位: {len(data_store.cabinets)} 条")
    print(f"  - 温度记录: {len(data_store.temperature_records)} 条")
    print(f"  - 接运单: {len(data_store.transport_orders)} 条")
    print(f"  - 告别厅预约: {len(data_store.farewell_bookings)} 条")
    print(f"  - 火化排期: {len(data_store.cremation_schedules)} 条")
    print(f"  - 证件: {len(data_store.documents)} 条")
    
    return True


def main():
    print("=" * 60)
    print("殡仪服务站复核台 - 功能测试")
    print("=" * 60)
    
    results = []
    
    results.append(("数据导入", test_data_import()))
    results.append(("规则引擎", test_rules_engine()))
    results.append(("数据导出", test_data_export()))
    results.append(("本地存储", test_local_storage()))
    results.append(("CSV导入", test_csv_import()))
    
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    
    all_passed = True
    for test_name, passed in results:
        status = "✓ 通过" if passed else "✗ 失败"
        print(f"  {test_name}: {status}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("所有测试通过！")
    else:
        print("部分测试失败，请检查错误信息。")
    print("=" * 60)
    
    print("\n使用说明:")
    print("  1. 运行 python3 main.py 启动GUI应用")
    print("  2. 点击'导入数据'按钮选择 sample_data/sample_complete.json")
    print("  3. 查看'风险分析'标签页中的各项风险")
    print("  4. 双击风险项可以添加复核意见")
    print("  5. 点击'保存状态'保存当前进度")
    print("  6. 点击'导出Markdown'或'导出JSON审计包'导出数据")


if __name__ == "__main__":
    main()
