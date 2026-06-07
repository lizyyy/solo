#!/usr/bin/env python3
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import SAMPLES_DIR
from modules.data_import import import_inspections, import_notices
from modules.conflict_detection import detect_conflicts, get_conflict_stats
from modules.heatmap import generate_heatmap, get_heatmap_stats
from modules.self_check import run_all_checks
from modules.export import export_full_report, get_data_summary

def test_step1_import():
    print("\n" + "="*60)
    print("📋 第一步：测试数据导入")
    print("="*60)
    
    print("\n1. 导入正常巡查表...")
    result = import_inspections(
        os.path.join(SAMPLES_DIR, 'inspection_normal.xlsx'),
        'normal', '测试用户'
    )
    print(f"   ✅ 成功: {result.success_count}条, 重复: {result.duplicate_count}条, {result.message}")
    
    print("\n2. 导入错口径巡查表...")
    result = import_inspections(
        os.path.join(SAMPLES_DIR, 'inspection_alternate.xlsx'),
        'alternate', '测试用户'
    )
    print(f"   ✅ 成功: {result.success_count}条, 重复: {result.duplicate_count}条, {result.message}")
    
    print("\n3. 导入补录巡查表...")
    result = import_inspections(
        os.path.join(SAMPLES_DIR, 'inspection_supplement.xlsx'),
        'supplement', '测试用户'
    )
    print(f"   ✅ 成功: {result.success_count}条, 重复: {result.duplicate_count}条, {result.message}")
    
    print("\n4. 导入正常施工告示...")
    result = import_notices(
        os.path.join(SAMPLES_DIR, 'notice_normal.xlsx'),
        'normal', '阿宁'
    )
    print(f"   ✅ 成功: {result.success_count}条, 重复: {result.duplicate_count}条, {result.message}")
    
    print("\n5. 导入错口径施工告示...")
    result = import_notices(
        os.path.join(SAMPLES_DIR, 'notice_alternate.xlsx'),
        'alternate', '阿宁'
    )
    print(f"   ✅ 成功: {result.success_count}条, 重复: {result.duplicate_count}条, {result.message}")
    
    print("\n6. 验证重复导入检测...")
    result = import_inspections(
        os.path.join(SAMPLES_DIR, 'inspection_normal.xlsx'),
        'normal', '测试用户'
    )
    print(f"   ✅ 重复导入被拦截: {result.status}")

def test_step2_conflict():
    print("\n" + "="*60)
    print("⚔️  第二步：测试冲突检测")
    print("="*60)
    
    print("\n1. 检测冲突...")
    new_conflicts = detect_conflicts()
    print(f"   ✅ 发现 {len(new_conflicts)} 个新冲突")
    
    stats = get_conflict_stats()
    print(f"\n2. 冲突统计:")
    print(f"   - 总数: {stats['total']}")
    print(f"   - 待处理: {stats['pending']}")
    print(f"   - 已确认: {stats['resolved']}")
    print(f"   - 已驳回: {stats['rejected']}")
    
    if new_conflicts:
        print(f"\n3. 冲突详情预览:")
        for c in new_conflicts[:2]:
            print(f"   - [{c.conflict_type}] {c.description}")
            print(f"     施工告示备注: {c.notice_data.get('remarks', '无')[:50]}...")

def test_step3_heatmap():
    print("\n" + "="*60)
    print("🗺️  第三步：测试热力图生成")
    print("="*60)
    
    print("\n1. 生成热力图...")
    result = generate_heatmap()
    print(f"   ✅ 生成 {result['stats']['grids_with_data']} 个网格")
    print(f"   - 总样本: {result['stats']['total_samples']}")
    print(f"   - 晚间缺口网格: {result['stats']['evening_gap_grids']}")
    print(f"   - 需复核网格: {result['stats']['needs_review_grids']}")
    
    stats = get_heatmap_stats()
    print(f"\n2. 热力图统计:")
    print(f"   - 网格总数: {stats['total_grids']}")
    print(f"   - 需复核: {stats['needs_review']}")
    print(f"   - 有晚间缺口: {stats['has_evening_gap']}")
    print(f"   - 已复核: {stats['reviewed']}")

def test_step4_selfcheck():
    print("\n" + "="*60)
    print("🔧 第四步：测试系统自检")
    print("="*60)
    
    print("\n1. 运行全部自检...")
    results = run_all_checks()
    for r in results:
        status_icon = {'pass': '✅', 'warning': '⚠️', 'fail': '❌'}.get(r['status'], '?')
        print(f"   {status_icon} {r['check_name']}: {r['message']}")

def test_step5_export():
    print("\n" + "="*60)
    print("📤 第五步：测试数据导出")
    print("="*60)
    
    print("\n1. 生成完整报告...")
    result = export_full_report()
    print(f"   ✅ 报告已生成: {result['report_dir']}")
    print(f"   - 包含 {len(result['files'])} 个文件")
    
    summary = result['summary']
    print(f"\n2. 数据汇总:")
    for k, v in summary.items():
        print(f"   - {k}: {v}")

def main():
    print("\n🚀 养老驿站配送路线系统 - 功能测试")
    print("="*60)
    
    summary_before = get_data_summary()
    print(f"\n📊 测试前数据状态: {summary_before}")
    
    try:
        test_step1_import()
        test_step2_conflict()
        test_step3_heatmap()
        test_step4_selfcheck()
        test_step5_export()
        
        summary_after = get_data_summary()
        print("\n" + "="*60)
        print("🎉 所有测试通过！")
        print("="*60)
        print(f"\n📊 测试后数据状态:")
        for k, v in summary_after.items():
            print(f"   - {k}: {v}")
        
        print("\n💡 提示：现在可以运行 'python3 app.py' 启动Web界面")
        print("   然后访问 http://localhost:5001 查看可视化界面")
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
