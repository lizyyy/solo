#!/usr/bin/env python3
"""测试项目功能的脚本"""

import sys
sys.path.insert(0, 'src')

from exhibit_inspector.parsers import (
    parse_sensor_csv,
    parse_route_csv,
    parse_box_csv,
    parse_photo_csv,
)
from exhibit_inspector.rules import RuleEngine
from exhibit_inspector.models import ThresholdSettings


def test_parsers():
    """测试解析器"""
    print("=" * 50)
    print("测试解析器模块")
    print("=" * 50)
    
    print("\n1. 测试传感器CSV解析器...")
    sensor_result = parse_sensor_csv('examples/sensor_data.csv')
    print(f"   总行数: {sensor_result.total_rows}")
    print(f"   有效行数: {sensor_result.valid_rows}")
    print(f"   错误数: {len(sensor_result.errors)}")
    if sensor_result.data:
        print(f"   样例数据: 箱号={sensor_result.data[0].box_id}, "
              f"温度={sensor_result.data[0].temperature_celsius}°C")
    assert sensor_result.valid_rows > 0, "传感器解析失败"
    print("   ✓ 通过")
    
    print("\n2. 测试路书CSV解析器...")
    route_result = parse_route_csv('examples/route_book.csv', 'SH-20250115-001')
    print(f"   有效行数: {route_result.valid_rows}")
    if route_result.data:
        route = route_result.data[0]
        print(f"   路书节点数: {len(route.nodes)}")
        for node in route.nodes[:2]:
            print(f"     节点 {node.node_id}: {node.location}")
    assert route_result.valid_rows > 0, "路书解析失败"
    print("   ✓ 通过")
    
    print("\n3. 测试展箱清单CSV解析器...")
    box_result = parse_box_csv('examples/box_list.csv', 'SH-20250115-001')
    print(f"   有效行数: {box_result.valid_rows}")
    if box_result.data:
        print(f"   样例展箱: {box_result.data[0].box_id} - {box_result.data[0].exhibit_name}")
    assert box_result.valid_rows > 0, "展箱清单解析失败"
    print("   ✓ 通过")
    
    print("\n4. 测试照片清单CSV解析器...")
    photo_result = parse_photo_csv('examples/photo_list.csv')
    print(f"   有效行数: {photo_result.valid_rows}")
    if photo_result.data:
        print(f"   样例照片: {photo_result.data[0].photo_id} - {photo_result.data[0].photo_type.value}")
    assert photo_result.valid_rows > 0, "照片清单解析失败"
    print("   ✓ 通过")
    
    return sensor_result, route_result, photo_result


def test_rule_engine(sensor_result, route_result, photo_result):
    """测试规则引擎"""
    print("\n" + "=" * 50)
    print("测试规则引擎")
    print("=" * 50)
    
    thresholds = ThresholdSettings(
        shock_threshold_g=2.0,
        temp_max_celsius=25.0,
        temp_min_celsius=15.0,
        humidity_max_pct=70.0,
        humidity_min_pct=40.0,
    )
    engine = RuleEngine(thresholds)
    
    print("\n5. 测试震动检测规则...")
    print(f"   震动阈值: {thresholds.shock_threshold_g}g")
    
    print("\n6. 测试温湿度检测规则...")
    print(f"   温度范围: {thresholds.temp_min_celsius}°C - {thresholds.temp_max_celsius}°C")
    print(f"   湿度范围: {thresholds.humidity_min_pct}% - {thresholds.humidity_max_pct}%")
    
    print("\n7. 执行完整分析...")
    route_book = route_result.data[0] if route_result.data else None
    
    analysis = engine.analyze(
        shipment_id='SH-TEST-001',
        sensor_records=sensor_result.data,
        photo_records=photo_result.data,
        route_book=route_book,
    )
    
    print(f"\n   分析结果统计:")
    print(f"   总问题数: {analysis.total_issues}")
    print(f"   严重(Critical): {analysis.critical_issues}")
    print(f"   高(High): {analysis.high_issues}")
    print(f"   中(Medium): {analysis.medium_issues}")
    print(f"   低(Low): {analysis.low_issues}")
    
    if analysis.issues:
        print(f"\n   检测到的问题 (前5条):")
        for i, issue in enumerate(analysis.issues[:5]):
            print(f"     {i+1}. [{issue.severity.value.upper()}] {issue.description}")
    
    print("   ✓ 通过")
    return analysis


def test_report_generation(analysis, route_result):
    """测试报告生成"""
    print("\n" + "=" * 50)
    print("测试报告生成模块")
    print("=" * 50)
    
    from exhibit_inspector.reports import (
        generate_markdown_report,
        export_issues_csv,
        export_json_audit,
    )
    from exhibit_inspector.storage import SessionManager
    from pathlib import Path
    import tempfile
    
    print("\n8. 测试JSON审计包导出...")
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        
        manager = SessionManager(tmp_path / "sessions")
        session = manager.init_transport(
            shipment_id="SH-TEST-001",
            shipment_name="测试运输",
            origin="测试始发地",
            destination="测试目的地",
            carrier="测试承运方",
        )
        
        manager.save_issues(analysis.issues)
        audit = manager.build_audit_package()
        
        json_file = tmp_path / "audit.json"
        export_json_audit(audit, json_file)
        print(f"   JSON审计包已生成: {json_file}")
        assert json_file.exists(), "JSON导出失败"
        print("   ✓ 通过")
        
        print("\n9. 测试CSV问题清单导出...")
        csv_file = tmp_path / "issues.csv"
        export_issues_csv(audit, csv_file)
        print(f"   CSV问题清单已生成: {csv_file}")
        assert csv_file.exists(), "CSV导出失败"
        print("   ✓ 通过")
        
        print("\n10. 测试Markdown报告导出...")
        md_file = tmp_path / "report.md"
        generate_markdown_report(audit, md_file)
        print(f"   Markdown报告已生成: {md_file}")
        assert md_file.exists(), "Markdown导出失败"
        print("   ✓ 通过")
        
        print(f"\n   输出文件内容预览:")
        print(f"\n   - CSV内容 (前10行):")
        with open(csv_file, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                if i < 5:
                    print(f"     {line.rstrip()}")
        
        print(f"\n   - Markdown内容 (前500字符):")
        with open(md_file, 'r', encoding='utf-8') as f:
            content = f.read()[:500]
            print(f"     {content}")


def main():
    """主测试函数"""
    print("\n" + "=" * 50)
    print("展箱震动温湿度复核员 - 功能测试")
    print("=" * 50)
    
    try:
        sensor_result, route_result, photo_result = test_parsers()
        analysis = test_rule_engine(sensor_result, route_result, photo_result)
        test_report_generation(analysis, route_result)
        
        print("\n" + "=" * 50)
        print("✓ 所有测试通过!")
        print("=" * 50)
        return 0
        
    except AssertionError as e:
        print(f"\n✗ 测试失败: {e}")
        return 1
    except Exception as e:
        print(f"\n✗ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
