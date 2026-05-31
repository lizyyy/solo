#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from test_data import generate_test_records
from inspection_pipeline import InspectionPipeline


def main():
    print("🌞 光伏逆变器波动巡检系统启动")
    print("=" * 60)
    
    print("\n📥 正在加载测试数据包...")
    records = generate_test_records()
    print(f"   共加载 {len(records)} 条巡检记录")
    
    print("\n🔍 记录类型分布：")
    from collections import Counter
    source_count = Counter(r.source.value for r in records)
    for source, count in source_count.items():
        print(f"   - {source}: {count} 条")
    
    print("\n⚙️  开始处理巡检数据...")
    pipeline = InspectionPipeline()
    results = pipeline.process_batch(records)
    print(f"   处理完成，共生成 {len(results)} 条处理结果")
    
    print("\n📊 生成巡检报告...")
    report = pipeline.generate_report(results)
    
    print("\n" + "=" * 60)
    display_report = pipeline.format_report_for_display(report)
    print(display_report)
    
    print("\n" + "=" * 60)
    print("💡 系统设计说明：")
    print("=" * 60)
    print("""
1. 🎯 宁标待确认，不混正常结果
   - 阈值跨档、重复报警、时序错误都标为"待确认"
   - 值班长一眼就能看到哪些需要重点复核

2. 📝 人话提示，不是技术术语
   - 错误提示用日常语言描述，有emoji表情
   - 每条异常都有具体的处理建议

3. 🔍 可复核的审计追踪
   - 每条待确认记录都有完整的操作日志
   - 包含变化前后的值、时间、操作人等证据
   - 设备工程师可以据此追溯和扯皮（划掉）沟通

4. 📦 支持真实场景的混合数据
   - 正常记录：直接通过
   - 晚到附件：标记时效存疑
   - 重复项：保留最早的，标记其他
   - 人工更正：记录修改痕迹，保留原数据链接
    """)
    
    print("\n✅ 演示完成！如果要接入真实数据，请替换 test_data.py 中的数据生成逻辑。")


if __name__ == "__main__":
    main()
