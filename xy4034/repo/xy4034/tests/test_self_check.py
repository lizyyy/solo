import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_sample_data_generation():
    print("=" * 50)
    print("测试1: 示例数据生成")
    print("=" * 50)
    
    from modules.sample_data import generate_sample_data
    
    try:
        data = generate_sample_data()
        
        required_keys = ['batches', 'temperatures', 'handover', 'samples']
        for key in required_keys:
            if key not in data:
                print(f"❌ 缺少 {key} 数据表")
                return False
            print(f"✅ {key} 数据表存在，共 {len(data[key])} 条记录")
        
        batches = data['batches']
        required_cols = ['批次号', '菜品', '生产时间', '出库时间', '门店', '配送车']
        for col in required_cols:
            if col not in batches.columns:
                print(f"❌ 批次表缺少字段: {col}")
                return False
        
        print("✅ 示例数据生成测试通过")
        return True
        
    except Exception as e:
        print(f"❌ 示例数据生成失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_field_validation():
    print("\n" + "=" * 50)
    print("测试2: 字段校验")
    print("=" * 50)
    
    from modules.sample_data import generate_sample_data
    from modules.field_validator import validate_all_fields, FieldValidationError
    
    try:
        data = generate_sample_data()
        errors = validate_all_fields(data)
        
        print(f"共发现 {len(errors)} 个字段校验问题")
        
        for error in errors[:5]:
            print(f"  - {error.table_name}.{error.field_name}: {error.message}")
        
        if len(errors) > 5:
            print(f"  ... 还有 {len(errors) - 5} 个问题")
        
        print("✅ 字段校验测试通过")
        return True
        
    except Exception as e:
        print(f"❌ 字段校验失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_time_window_merger():
    print("\n" + "=" * 50)
    print("测试3: 时间窗归并")
    print("=" * 50)
    
    from modules.sample_data import generate_sample_data
    from modules.time_window_merger import merge_by_time_window, BatchTimeWindow
    
    try:
        data = generate_sample_data()
        merged = merge_by_time_window(data)
        
        print(f"共归并 {len(merged)} 个批次")
        
        if len(merged) == 0:
            print("❌ 没有归并到任何批次")
            return False
        
        first_batch = list(merged.values())[0]
        
        required_attrs = ['batch_number', 'dish', 'store', 'delivery_car', 
                          'production_time', 'outbound_time', 'signoff_time',
                          'temperature_records', 'sample_records']
        
        for attr in required_attrs:
            if not hasattr(first_batch, attr):
                print(f"❌ BatchTimeWindow 缺少属性: {attr}")
                return False
        
        print(f"✅ 批次 {first_batch.batch_number} 详情:")
        print(f"   - 菜品: {first_batch.dish}")
        print(f"   - 门店: {first_batch.store}")
        print(f"   - 温度记录数: {len(first_batch.temperature_records)}")
        print(f"   - 留样记录数: {len(first_batch.sample_records)}")
        
        print("✅ 时间窗归并测试通过")
        return True
        
    except Exception as e:
        print(f"❌ 时间窗归并失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_risk_rules():
    print("\n" + "=" * 50)
    print("测试4: 风险规则识别")
    print("=" * 50)
    
    from modules.sample_data import generate_sample_data
    from modules.time_window_merger import merge_by_time_window
    from modules.risk_rules import run_all_risk_checks, get_risk_summary
    
    try:
        data = generate_sample_data()
        merged = merge_by_time_window(data)
        results = run_all_risk_checks(merged)
        
        summary = get_risk_summary(results)
        
        print(f"风险检测结果:")
        print(f"  - 总异常数: {summary['total']}")
        print(f"  - 高风险: {summary['by_level']['high']}")
        print(f"  - 中风险: {summary['by_level']['medium']}")
        print(f"  - 受影响批次: {summary['affected_batches']}")
        
        if summary['by_rule']:
            print("\n风险规则分布:")
            for rule, count in summary['by_rule'].items():
                print(f"  - {rule}: {count} 次")
        
        if results:
            print("\n前3条异常详情:")
            for result in results[:3]:
                level_label = '高' if result.risk_level == 'high' else '中'
                print(f"  [{level_label}风险] {result.rule_name}: {result.batch_number}")
                print(f"    描述: {result.description}")
        
        print("✅ 风险规则识别测试通过")
        return True
        
    except Exception as e:
        print(f"❌ 风险规则识别失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_chart_data_generation():
    print("\n" + "=" * 50)
    print("测试5: 图表数据生成")
    print("=" * 50)
    
    from modules.sample_data import generate_sample_data
    from modules.time_window_merger import merge_by_time_window
    from modules.risk_rules import run_all_risk_checks
    from modules.chart_data import (
        generate_trend_chart_data,
        generate_risk_timeline_data,
        generate_store_comparison_data
    )
    
    try:
        data = generate_sample_data()
        merged = merge_by_time_window(data)
        risk_results = run_all_risk_checks(merged)
        
        trend_data = generate_trend_chart_data(merged)
        print(f"✅ 趋势图表数据: {len(trend_data)} 行, {len(trend_data.columns)} 列")
        
        timeline_data = generate_risk_timeline_data(risk_results)
        print(f"✅ 风险时间轴数据: {len(timeline_data)} 行")
        
        store_data = generate_store_comparison_data(merged, risk_results)
        print(f"✅ 门店对比数据: {len(store_data)} 个门店")
        
        first_batch = list(merged.values())[0]
        if first_batch.temperature_records:
            from modules.chart_data import generate_temperature_chart_data
            temp_df, temp_stats = generate_temperature_chart_data(first_batch)
            print(f"✅ 批次温度图表数据: {len(temp_df)} 条记录")
        
        print("✅ 图表数据生成测试通过")
        return True
        
    except Exception as e:
        print(f"❌ 图表数据生成失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_report_export():
    print("\n" + "=" * 50)
    print("测试6: 报告导出")
    print("=" * 50)
    
    from modules.sample_data import generate_sample_data
    from modules.time_window_merger import merge_by_time_window
    from modules.risk_rules import run_all_risk_checks
    from modules.report_exporter import (
        generate_markdown_report,
        export_anomalies_csv,
        generate_batch_detail_report
    )
    
    try:
        data = generate_sample_data()
        merged = merge_by_time_window(data)
        risk_results = run_all_risk_checks(merged)
        
        md_report = generate_markdown_report(merged, risk_results, data)
        print(f"✅ Markdown报告: {len(md_report)} 字符")
        
        csv_data = export_anomalies_csv(risk_results)
        print(f"✅ CSV异常清单: {len(csv_data)} 字符")
        
        if merged:
            first_batch = list(merged.values())[0]
            batch_report = generate_batch_detail_report(first_batch, risk_results)
            print(f"✅ 批次详情报告: {len(batch_report)} 字符")
        
        print("✅ 报告导出测试通过")
        return True
        
    except Exception as e:
        print(f"❌ 报告导出失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_individual_rules():
    print("\n" + "=" * 50)
    print("测试7: 单个风险规则验证")
    print("=" * 50)
    
    from modules.time_window_merger import BatchTimeWindow
    from modules.risk_rules import (
        check_production_to_outbound_delay,
        check_signoff_before_outbound,
        check_missing_sample,
        check_temperature_gaps,
        check_continuous_over_temperature
    )
    from datetime import datetime, timedelta
    
    all_passed = True
    
    batch = BatchTimeWindow(
        batch_number="TEST001",
        dish="测试菜品",
        store="测试门店",
        delivery_car="TEST001"
    )
    batch.production_time = datetime(2026, 5, 1, 8, 0, 0)
    batch.outbound_time = datetime(2026, 5, 1, 8, 30, 0)
    
    result = check_production_to_outbound_delay(batch)
    if result is None:
        print("✅ 正常出库延迟规则: 正常情况不触发")
    else:
        print("❌ 正常出库延迟规则: 正常情况不应触发")
        all_passed = False
    
    batch.outbound_time = datetime(2026, 5, 1, 10, 0, 0)
    result = check_production_to_outbound_delay(batch)
    if result:
        print(f"✅ 延迟出库规则: 触发成功 - {result.description}")
    else:
        print("❌ 延迟出库规则: 应触发但未触发")
        all_passed = False
    
    batch = BatchTimeWindow(
        batch_number="TEST002",
        dish="测试菜品",
        store="测试门店",
        delivery_car="TEST002"
    )
    batch.outbound_time = datetime(2026, 5, 1, 10, 0, 0)
    batch.signoff_time = datetime(2026, 5, 1, 10, 30, 0)
    
    result = check_signoff_before_outbound(batch)
    if result is None:
        print("✅ 签收时间规则: 正常情况不触发")
    else:
        print("❌ 签收时间规则: 正常情况不应触发")
        all_passed = False
    
    batch.signoff_time = datetime(2026, 5, 1, 9, 30, 0)
    result = check_signoff_before_outbound(batch)
    if result:
        print(f"✅ 签收时间规则: 触发成功 - {result.description}")
    else:
        print("❌ 签收时间规则: 应触发但未触发")
        all_passed = False
    
    batch = BatchTimeWindow(
        batch_number="TEST003",
        dish="测试菜品",
        store="测试门店",
        delivery_car="TEST003"
    )
    batch.sample_records = [{'留样编号': 'S001', '抽检结论': '合格'}]
    
    result = check_missing_sample(batch)
    if result is None:
        print("✅ 留样缺失规则: 有留样不触发")
    else:
        print("❌ 留样缺失规则: 有留样不应触发")
        all_passed = False
    
    batch.sample_records = []
    result = check_missing_sample(batch)
    if result:
        print(f"✅ 留样缺失规则: 触发成功 - {result.description}")
    else:
        print("❌ 留样缺失规则: 应触发但未触发")
        all_passed = False
    
    base_time = datetime(2026, 5, 1, 10, 0, 0)
    batch = BatchTimeWindow(
        batch_number="TEST004",
        dish="测试菜品",
        store="测试门店",
        delivery_car="TEST004"
    )
    batch.temperature_records = [
        {'温度读数时间': base_time + timedelta(minutes=0), '温度值': 2.0},
        {'温度读数时间': base_time + timedelta(minutes=10), '温度值': 2.5},
        {'温度读数时间': base_time + timedelta(minutes=20), '温度值': 3.0},
    ]
    
    result = check_temperature_gaps(batch)
    if result is None:
        print("✅ 温度断档规则: 正常记录不触发")
    else:
        print("❌ 温度断档规则: 正常记录不应触发")
        all_passed = False
    
    batch.temperature_records = [
        {'温度读数时间': base_time + timedelta(minutes=0), '温度值': 2.0},
        {'温度读数时间': base_time + timedelta(minutes=40), '温度值': 2.5},
    ]
    
    result = check_temperature_gaps(batch)
    if result:
        print(f"✅ 温度断档规则: 触发成功 - {result.description}")
    else:
        print("❌ 温度断档规则: 应触发但未触发")
        all_passed = False
    
    if all_passed:
        print("\n✅ 所有单个风险规则验证通过")
    else:
        print("\n❌ 部分单个风险规则验证失败")
    
    return all_passed

def run_all_tests():
    print("\n" + "=" * 60)
    print("🚀 冷链留样复盘台 - 完整自检流程")
    print("=" * 60)
    
    results = []
    
    results.append(("示例数据生成", test_sample_data_generation()))
    results.append(("字段校验", test_field_validation()))
    results.append(("时间窗归并", test_time_window_merger()))
    results.append(("风险规则识别", test_risk_rules()))
    results.append(("图表数据生成", test_chart_data_generation()))
    results.append(("报告导出", test_report_export()))
    results.append(("单个规则验证", test_individual_rules()))
    
    print("\n" + "=" * 60)
    print("📊 测试结果汇总")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"  {name}: {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print("\n" + "-" * 60)
    print(f"总计: {passed} 通过, {failed} 失败")
    
    if failed == 0:
        print("\n🎉 所有测试通过! 系统运行正常。")
        return True
    else:
        print(f"\n⚠️  有 {failed} 个测试失败，请检查相关模块。")
        return False

if __name__ == "__main__":
    run_all_tests()
