import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src import MarketStallRotation
from data.sample_data import save_sample_data

def main():
    print("=" * 70)
    print("农贸市场摊位轮换系统 - 演示流程")
    print("=" * 70)
    print("\n城市规划师小赵的工作日常：")
    print("从现场会议纪要 → 导入数据 → 自动归并 → 人工复核 → 导出公示")
    print("-" * 70)
    
    print("\n📋 步骤0: 准备样例数据")
    print("-" * 50)
    sample_file = save_sample_data()
    
    print("\n🔧 步骤1-3: 运行主流程（导入、归并、复核初始化）")
    print("-" * 50)
    processor = MarketStallRotation()
    result = processor.run_full_process(sample_file, "2024年农贸市场摊位轮换方案")
    
    print("\n📝 步骤4: 人工复核 - 小赵补录备注")
    print("-" * 50)
    print("  小赵查看待处理项...")
    
    pending_items = processor.reviewer.get_pending_items()
    for item in pending_items[:2]:
        record_id = item['_record_id']
        stall_id = item.get('stall_id', '未知')
        print(f"  正在处理摊位 {stall_id} (记录ID: {record_id})...")
        
        processor.add_review_note(
            record_id, 
            f"现场核查确认该摊位位置合理，已与摊主沟通调整方案。参考现场会议纪要第3页第2条。",
            "城市规划师小赵"
        )
        print(f"  ✓ 已添加复核备注")
    
    print("\n🔄 小赵调整一条记录的状态...")
    if pending_items:
        first_record = pending_items[0]
        record_id = first_record['_record_id']
        stall_id = first_record.get('stall_id', '未知')
        processor.update_record_status(
            record_id, 
            'processed', 
            f"经现场复核，摊位{stall_id}时间段设置已修正，可正常轮换。",
            "城市规划师小赵"
        )
        print(f"  ✓ 摊位 {stall_id} 状态已更新为'已处理'")
    
    print("\n📊 查看复核差异记录")
    print("-" * 50)
    diffs = processor.get_review_diffs()
    if diffs:
        for diff in diffs:
            print(f"  摊位 {diff['stall_id']}: {diff['original_status']} → {diff['new_status']}")
            print(f"    复核人: {diff['reviewer']}")
            print(f"    备注: {diff['notes'][:50]}...")
    else:
        print("  无复核差异")
    
    print("\n📤 步骤5: 导出公示清单")
    print("-" * 50)
    export_result = processor.export_results("农贸市场摊位轮换")
    
    print("\n✅ 演示完成！")
    print("=" * 70)
    print("\n💡 城市规划师小赵现在可以：")
    print("  1. 查看 output 目录下的导出文件")
    print("  2. 直接给社区公示清单")
    print("  3. 交接时不用再翻旧记录（所有来源和处理时间都已保留）")
    print("  4. 异常情况都在明面上，一眼就能看到")
    print("\n📂 输出文件位置:")
    for f in export_result['files']:
        print(f"  - {f['type']}: {f['path']}")
    print("=" * 70)

if __name__ == '__main__':
    main()
