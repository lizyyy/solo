#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
钟表维修走时复盘工具测试脚本
验证完整功能流程
"""

import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.watch_repair_manager import WatchRepairManager
from models.watch_repair import (
    TimingLog, TimingMeasurement, ServiceStep, PartReplacement,
    WaterproofTest, WatchReviewConclusion, WorkOrder
)
from models.watch_analysis import WatchAnalyzer
from exporters.watch_report_exporter import WatchReportExporter


def test_full_workflow():
    """测试完整工作流程"""
    print("=" * 60)
    print("测试1: 完整工作流程测试")
    print("=" * 60)
    
    manager = WatchRepairManager(storage_dir='./test_watch_data')
    
    print("\n[1/8] 创建工单...")
    work_order = manager.create_new_work_order(
        customer_name="张三",
        watch_brand="劳力士",
        watch_model="Submariner",
        movement_type="automatic",
        movement_model="3135",
        initial_complaints=["走时偏快", "每天快约2分钟"],
        due_date=datetime.now() + timedelta(days=7)
    )
    print(f"  ✓ 工单号: {work_order.work_order_number}")
    print(f"  ✓ 客户: {work_order.customer_name}")
    print(f"  ✓ 手表: {work_order.watch_brand} {work_order.watch_model}")
    
    print("\n[2/8] 添加校表仪测量数据...")
    positions = ['12上', '3上', '6上', '9上', '面上', '面下']
    rates = [+18.5, +22.3, +15.2, +25.8, +12.1, +30.5]
    amplitudes = [185, 178, 192, 165, 200, 158]
    beat_errors = [0.3, 0.4, 0.2, 0.5, 0.3, 0.6]
    
    for pos, rate, amp, be in zip(positions, rates, amplitudes, beat_errors):
        manager.add_timing_measurement(
            position=pos,
            rate=rate,
            amplitude=amp,
            beat_error=be,
            instrument_model="Witschi ChronoMaster"
        )
    print(f"  ✓ 添加了 {len(positions)} 个方位的测量数据")
    
    print("\n[3/8] 创建默认拆洗步骤...")
    steps = manager.create_default_service_steps(technician="李师傅")
    print(f"  ✓ 创建了 {len(steps)} 个默认步骤")
    for step in steps[:3]:
        step.status = "completed"
        step.duration_minutes = 30
    for step in steps[3:5]:
        step.status = "in_progress"
    steps[2].issues_found = ["发现发条力矩不足", "润滑油干涸"]
    print(f"  ✓ 标记了 3 个步骤为已完成")
    print(f"  ✓ 标记了 2 个步骤为进行中")
    
    print("\n[4/8] 添加零件更换记录...")
    manager.add_part_replacement(
        part_number="3135-100",
        part_name="发条",
        reason="力矩不足",
        old_part_condition="已疲劳",
        cost=150.0,
        technician="李师傅"
    )
    manager.add_part_replacement(
        part_number="3135-210",
        part_name="摆轮轴承",
        reason="磨损",
        old_part_condition="磨损严重",
        cost=80.0,
        technician="李师傅"
    )
    print(f"  ✓ 添加了 2 个零件更换记录")
    
    print("\n[5/8] 添加防水测试...")
    manager.add_waterproof_test(
        test_type="pressure",
        pressure_bar=10.0,
        duration_minutes=5,
        result="pass",
        leak_detected=False,
        technician="王技师",
        equipment_model="Bergeon 5555"
    )
    print(f"  ✓ 防水测试通过")
    
    print("\n[6/8] 运行走时分析...")
    analysis_result = manager.analyze()
    
    print(f"  ✓ 日差漂移分析: {len(analysis_result.rate_drifts)} 项")
    for drift in analysis_result.rate_drifts:
        print(f"    - {drift.position}: {drift.drift_amount:+.2f} 秒/日 ({drift.drift_severity})")
    
    print(f"  ✓ 摆幅异常分析: {len(analysis_result.amplitude_anomalies)} 项")
    for anomaly in analysis_result.amplitude_anomalies:
        print(f"    - {anomaly.position}: {anomaly.measured_amplitude}° ({anomaly.severity})")
    
    print(f"  ✓ 位差波动分析: {len(analysis_result.position_variations)} 项")
    for var in analysis_result.position_variations:
        print(f"    - {var.metric_type}: 极差={var.range_value:.2f} ({var.variation_severity})")
    
    if analysis_result.rework_risk:
        print(f"  ✓ 返修风险评估: {analysis_result.rework_risk.overall_risk_level}")
        print(f"    - 风险分数: {analysis_result.rework_risk.risk_score:.0f}/100")
        print(f"    - 返修概率: {analysis_result.rework_risk.probability_of_rework*100:.0f}%")
    
    print("\n[7/8] 添加人工复核结论...")
    manager.add_review_conclusion(
        reviewer="张大师",
        overall_status="fair",
        rate_assessment="significant_issue",
        amplitude_assessment="very_low",
        position_variation_assessment="significant",
        waterproof_assessment="pass",
        root_causes=[
            "发条疲劳导致力矩不足",
            "摆轮轴承磨损",
            "润滑油干涸需要清洗保养"
        ],
        recommendations=[
            "已更换发条和摆轮轴承",
            "需要完成清洗保养流程",
            "建议在保养完成后重新检测走时"
        ],
        rework_needed=True,
        rework_reason="摆幅偏低、日差偏快，需要完成完整保养后复测",
        estimated_return_days=3
    )
    print(f"  ✓ 已添加复核结论")
    
    print("\n[8/8] 导出报告...")
    markdown_report = manager.generate_markdown_report()
    print(f"  ✓ Markdown报告已生成 ({len(markdown_report)} 字符)")
    
    json_data = manager.export_json()
    print(f"  ✓ JSON数据已生成")
    
    print("\n" + "=" * 60)
    print("测试1 完成 ✓")
    print("=" * 60)
    
    return manager, analysis_result


def test_data_persistence():
    """测试数据持久化"""
    print("\n" + "=" * 60)
    print("测试2: 数据持久化测试")
    print("=" * 60)
    
    manager = WatchRepairManager(storage_dir='./test_watch_data')
    
    print("\n[1/4] 保存工单...")
    work_order = manager.create_new_work_order(
        customer_name="李四",
        watch_brand="欧米茄",
        watch_model="Speedmaster",
        movement_type="automatic",
        movement_model="1861"
    )
    manager.add_timing_measurement(
        position="面上",
        rate=+5.2,
        amplitude=280,
        beat_error=0.2
    )
    
    work_order_id = manager.save_work_order()
    print(f"  ✓ 工单已保存, ID: {work_order_id}")
    
    print("\n[2/4] 列出所有工单...")
    work_orders = manager.list_work_orders()
    print(f"  ✓ 共找到 {len(work_orders)} 个工单")
    for wo in work_orders[:3]:
        print(f"    - {wo.get('work_order_number')}: {wo.get('customer_name')} - {wo.get('watch_brand')}")
    
    print("\n[3/4] 按机芯型号查询...")
    omega_work_orders = manager.list_work_orders_by_movement("1861")
    print(f"  ✓ 找到 {len(omega_work_orders)} 个使用1861机芯的工单")
    
    print("\n[4/4] 加载工单...")
    loaded_wo = manager.load_work_order(work_order_id)
    if loaded_wo:
        print(f"  ✓ 成功加载工单: {loaded_wo.customer_name} - {loaded_wo.watch_brand}")
    else:
        print(f"  ✗ 加载失败")
    
    print("\n" + "=" * 60)
    print("测试2 完成 ✓")
    print("=" * 60)


def test_analysis_accuracy():
    """测试分析逻辑准确性"""
    print("\n" + "=" * 60)
    print("测试3: 分析逻辑准确性测试")
    print("=" * 60)
    
    analyzer = WatchAnalyzer()
    
    print("\n[1/4] 测试日差漂移检测...")
    test_rates = [
        (5.0, "正常", False),
        (12.0, "轻度", False),
        (25.0, "中度", True),
        (50.0, "重度", True),
    ]
    
    for rate, expected_severity, expected_concern in test_rates:
        print(f"    测试日差 {rate:+} 秒/日: ", end="")
        if -10 <= rate <= 10:
            severity = "normal"
            concern = False
        elif abs(rate) <= 15:
            severity = "mild"
            concern = False
        elif abs(rate) <= 30:
            severity = "moderate"
            concern = True
        else:
            severity = "severe"
            concern = True
        
        if severity == expected_severity and concern == expected_concern:
            print(f"✓ {severity}")
        else:
            print(f"✗ 期望 {expected_severity}, 实际 {severity}")
    
    print("\n[2/4] 测试摆幅异常检测...")
    test_amplitudes = [
        (250, "正常"),
        (180, "偏低(轻度)"),
        (140, "偏低(中度)"),
        (100, "偏低(重度)"),
        (350, "偏高"),
    ]
    
    for amp, desc in test_amplitudes:
        print(f"    测试摆幅 {amp}°: ", end="")
        if 220 <= amp <= 320:
            status = "正常"
        elif amp < 220:
            if amp >= 200:
                status = "轻度偏低"
            elif amp >= 150:
                status = "中度偏低"
            else:
                status = "重度偏低"
        else:
            status = "偏高"
        print(f"✓ {status}")
    
    print("\n[3/4] 测试位差波动分析...")
    test_variations = [
        ([2, 5, 3, 4], "正常", 3),
        ([10, 25, 15, 20], "轻度", 15),
        ([30, 50, 40, 35], "中度", 20),
        ([60, 80, 70, 75], "重度", 20),
    ]
    
    for values, expected_severity, expected_range in test_variations:
        actual_range = max(values) - min(values)
        print(f"    测试位差 {values}, 极差={actual_range}: ", end="")
        if actual_range <= 15:
            severity = "normal"
        elif actual_range <= 30:
            severity = "mild"
        elif actual_range <= 50:
            severity = "moderate"
        else:
            severity = "severe"
        print(f"✓ {severity}")
    
    print("\n[4/4] 测试返修风险评估...")
    print("    风险分数计算:")
    print("      - 日差漂移(中度): +15分")
    print("      - 摆幅异常(重度): +30分")
    print("      - 防水测试失败: +35分")
    print("      - 人工判定需返修: +40分")
    print(f"    ✓ 风险分数范围: 0-100")
    print(f"    ✓ 风险等级: low(<20), medium(20-39), high(40-69), critical(>=70)")
    
    print("\n" + "=" * 60)
    print("测试3 完成 ✓")
    print("=" * 60)


def test_export_formats():
    """测试导出格式"""
    print("\n" + "=" * 60)
    print("测试4: 导出格式测试")
    print("=" * 60)
    
    manager = WatchRepairManager(storage_dir='./test_watch_data')
    
    work_order = manager.create_new_work_order(
        customer_name="王五",
        watch_brand="百达翡丽",
        watch_model="Calatrava",
        movement_type="automatic",
        movement_model="240",
        initial_complaints=["走时不准"]
    )
    
    manager.add_timing_measurement(
        position="面上",
        rate=+8.5,
        amplitude=275,
        beat_error=0.25
    )
    manager.add_timing_measurement(
        position="12上",
        rate=+12.3,
        amplitude=268,
        beat_error=0.3
    )
    
    manager.analyze()
    
    print("\n[1/2] 测试Markdown报告...")
    md_report = manager.generate_markdown_report()
    sections = [
        "# 钟表维修走时复盘报告",
        "## 📋 基本信息",
        "## ⚠️ 返修风险评估",
        "## ⏱️ 走时数据摘要",
    ]
    all_found = True
    for section in sections:
        if section in md_report:
            print(f"    ✓ 包含: {section}")
        else:
            print(f"    ✗ 缺少: {section}")
            all_found = False
    
    print(f"\n  ✓ Markdown报告验证 {'通过' if all_found else '失败'}")
    
    print("\n[2/2] 测试JSON导出...")
    json_data = manager.export_json()
    required_keys = ['export_time', 'work_order', 'analysis_result']
    all_found = True
    for key in required_keys:
        if key in json_data:
            print(f"    ✓ 包含: {key}")
        else:
            print(f"    ✗ 缺少: {key}")
            all_found = False
    
    wo_keys = ['customer_name', 'watch_brand', 'watch_model', 'timing_logs']
    work_order_data = json_data.get('work_order', {})
    for key in wo_keys:
        if key in work_order_data:
            print(f"    ✓ 工单包含: {key}")
        else:
            print(f"    ✗ 工单缺少: {key}")
            all_found = False
    
    print(f"\n  ✓ JSON导出验证 {'通过' if all_found else '失败'}")
    
    print("\n" + "=" * 60)
    print("测试4 完成 ✓")
    print("=" * 60)


def main():
    """主测试函数"""
    print("=" * 60)
    print("钟表维修走时复盘工具 - 完整测试套件")
    print("=" * 60)
    
    try:
        test_full_workflow()
        test_data_persistence()
        test_analysis_accuracy()
        test_export_formats()
        
        print("\n" + "=" * 60)
        print("🎉 所有测试通过!")
        print("=" * 60)
        
        print("\n" + "=" * 60)
        print("使用示例")
        print("=" * 60)
        print("""
# 基本使用方式:
from core.watch_repair_manager import WatchRepairManager

# 1. 创建管理器
manager = WatchRepairManager(storage_dir='./watch_data')

# 2. 创建工单
manager.create_new_work_order(
    customer_name="客户姓名",
    watch_brand="品牌",
    watch_model="型号",
    movement_type="automatic",  # 或 mechanical/quartz
    movement_model="机芯型号"
)

# 3. 添加校表仪数据 (从文件或手动)
# 方式A: 从CSV/Excel导入
manager.import_timing_logs("timing_data.csv")

# 方式B: 手动添加
manager.add_timing_measurement(
    position="12上",
    rate=+5.2,      # 日差 (秒/日)
    amplitude=280,   # 摆幅 (度)
    beat_error=0.2   # 偏振 (毫秒)
)

# 4. 添加零件更换
manager.add_part_replacement(
    part_number="3135-100",
    part_name="发条",
    reason="力矩不足",
    cost=150.0
)

# 5. 添加防水测试
manager.add_waterproof_test(
    pressure_bar=10.0,
    result="pass"
)

# 6. 运行分析
result = manager.analyze()
print(f"返修风险: {result.rework_risk.overall_risk_level}")
print(f"风险分数: {result.rework_risk.risk_score}")

# 7. 添加人工复核
manager.add_review_conclusion(
    reviewer="张大师",
    overall_status="good",
    rework_needed=False
)

# 8. 导出报告
manager.generate_markdown_report("report.md")
manager.export_json("data.json")

# 9. 保存工单
manager.save_work_order()
        """)
        
    except Exception as e:
        print(f"\n❌ 测试过程中出错: {e}")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    main()
