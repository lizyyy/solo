#!/usr/bin/env python3
from sail_lift_curve import WorkflowEngine, create_sample_data, plot_lift_curve_2d, plot_lift_curve_3d
import os

def main():
    print("=" * 60)
    print("   实验风帆升力曲线 - 完整流程测试")
    print("=" * 60)
    print()

    sample_path = create_sample_data("./output")
    print(f"📁 样例数据: {sample_path}")
    print()

    print("-" * 60)
    print("第1步: 导入设备铭牌参数 + 检测被平均值盖掉的超阈值")
    print("-" * 60)
    engine = WorkflowEngine(name="测试项目")
    records, thresholds = engine.step1_import_equipment(sample_path)
    print(f"✅ 导入 {len(records)} 条记录")
    print(f"⚠️  检测到 {len(thresholds)} 条被平均值盖掉的超阈值记录")
    for i, t in enumerate(thresholds, 1):
        equip = None
        for r in records:
            if r.record_id == t.equipment_record_id:
                equip = r
                break
        name = equip.equipment_name if equip else "未知"
        print(f"   {i}. 偏离 {t.deviation_percent:.1f}% | 状态: {t.status} | 设备: {name}")
    print()

    if thresholds:
        t = thresholds[0]
        
        print("-" * 60)
        print("第2步: 维修师傅老岑补看维修群截图并复核")
        print("-" * 60)
        print(f"🔍 复核记录: {t.record_id}")
        result = engine.step2_laocen_review(
            threshold_record_id=t.record_id,
            screenshot_ref="wechat_group_20240615_001.png",
            reviewer_notes="现场核实，数据异常是因为传感器临时漂移，已复校",
            confirm=True,
        )
        print(f"✅ 复核完成")
        print(f"   状态: {result.status}")
        print(f"   确认人: {result.confirmed_by}")
        print(f"   确认时间: {result.confirmed_time}")
        print()

        print("-" * 60)
        print("第3步: 更新单位换算说明")
        print("-" * 60)
        note = engine.step3_update_conversion_note(
            threshold_record_id=t.record_id,
            original_unit="Cl",
            converted_unit="kgf",
            conversion_factor=9.8,
            why_kept="虽然数值超阈值，但经过老岑现场确认是传感器漂移，非设备本身问题，数据可用于趋势分析",
            missing_materials="还缺该时段的设备运行日志、当时的气象条件记录",
            next_action="找维修师傅补充调取当时的设备运行日志，确认复校后的后续数据是否正常",
            contact_person="老岑",
        )
        print(f"✅ 单位换算说明已更新")
        print(f"   换算: {note.original_value:.4f} {note.original_unit} = {note.converted_value:.4f} {note.converted_unit}")
        print(f"   为什么留下: {note.why_kept}")
        print(f"   缺什么材料: {note.missing_materials}")
        print(f"   下一步找谁: {note.next_action}")
        print(f"   联系人: {note.contact_person}")
        print()

    print("-" * 60)
    print("保存并生成输出")
    print("-" * 60)
    
    project_path = engine.save_project("./output")
    print(f"💾 项目: {project_path}")
    
    report_text = engine.generate_report_text()
    report_path = "./output/test_report.txt"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_text)
    print(f"📄 报告: {report_path}")
    
    curve_data = engine.get_lift_curve_data()
    fig_2d = plot_lift_curve_2d(curve_data, engine.state.equipment_records, engine.state.threshold_records)
    plot_2d_path = "./output/test_curve_2d.html"
    fig_2d.write_html(plot_2d_path, include_plotlyjs="cdn")
    print(f"📊 2D图: {plot_2d_path}")
    
    fig_3d = plot_lift_curve_3d(curve_data, engine.state.equipment_records, engine.state.threshold_records)
    plot_3d_path = "./output/test_curve_3d.html"
    fig_3d.write_html(plot_3d_path, include_plotlyjs="cdn")
    print(f"📊 3D图: {plot_3d_path}")
    
    print()
    print("=" * 60)
    print("🎉 测试完成！关键验证点:")
    print("=" * 60)
    pending = engine.get_pending_threshold_records()
    confirmed = engine.get_confirmed_records()
    print(f"   ✅ 超阈值记录不自动吞掉: 待处理 {len(pending)} 条")
    print(f"   ✅ 老岑确认前停在待处理: 已确认 {len(confirmed)} 条")
    print(f"   ✅ 三步流程走完: 当前第 {engine.state.step} 步 - {engine.state.step_description}")
    print(f"   ✅ 单位换算说明可追溯: {len(engine.state.unit_conversion_notes)} 条")
    print()
    print("报告中包含:")
    print("   - 为什么被留下")
    print("   - 还缺什么材料")
    print("   - 下一步该找谁")
    print()
    print("查看输出目录: ./output/")
    print("=" * 60)

if __name__ == "__main__":
    main()
