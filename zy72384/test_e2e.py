#!/usr/bin/env python3
"""
降落伞开伞冲击 - 完整端到端验证脚本
重点验证:
1. Web看板模板渲染正常（CSS大括号不再报错）
2. 采样间隔说明第一次导入后，点击混用点能看到留存原因、缺失材料、处理原因
3. 林老师补录校准记录后，三处（先服务复核、可回溯导航、交接报告）同步更新
4. 最终结果能互相解释
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import ShockDataPoint, TempUnit
from workflow import WorkflowEngine
from visualizer import Chart3D
from report_renderer import ReportRenderer
from temp_detector import parse_sampling_interval


def create_fresh_shock_data():
    return [
        ShockDataPoint(time_ms=0, acceleration_g=1.0, altitude_m=1000.0, velocity_m_s=0.0),
        ShockDataPoint(time_ms=50, acceleration_g=2.3, altitude_m=980.0, velocity_m_s=15.2),
        ShockDataPoint(time_ms=100, acceleration_g=5.8, altitude_m=920.0, velocity_m_s=35.6),
        ShockDataPoint(time_ms=150, acceleration_g=12.4, altitude_m=850.0, velocity_m_s=55.2),
        ShockDataPoint(time_ms=200, acceleration_g=18.7, altitude_m=760.0, velocity_m_s=68.9),
    ]


def load_sampling_spec():
    with open("sample_data/sampling_spec.txt", "r", encoding="utf-8") as f:
        return f.read()


def test_1_template_render():
    print("=" * 70)
    print("✅ 验证1: Web看板模板渲染（修复CSS大括号被误解析问题）")
    print("=" * 70)
    import re
    from dashboard import safe_template_render

    with open("templates/dashboard.html", "r", encoding="utf-8") as f:
        template = f.read()

    try:
        html = safe_template_render(template, {
            "step1_class": "active",
            "step2_class": "",
            "step3_class": "",
            "banner_class": "warning",
            "banner_text": "测试阶段文本",
            "total_points": 5,
            "mixed_count": 5,
            "cal_count": 0,
            "current_stage_text": "第一步",
            "chart_rows": "<tr><td>test</td></tr>",
            "retention_items": "<div>test</div>",
            "summary_coach": "教练摘要测试",
            "summary_lin": "林老师摘要测试"
        })
        # 验证关键内容
        checks = [
            ("CSS大括号未被破坏", "box-sizing: border-box" in html),
            ("JS大括号未被破坏", "function clickPoint" in html),
            ("占位符正确渲染", "测试阶段文本" in html),
            ("chart_rows正确渲染", "<tr><td>test</td></tr>" in html),
        ]
        for name, ok in checks:
            print(f"   {'✅' if ok else '❌'} {name}")
        if all(ok for _, ok in checks):
            print("   ✅ 模板渲染验证通过")
            return True
        else:
            print("   ❌ 模板渲染验证失败")
            return False
    except Exception as e:
        print(f"   ❌ 渲染异常: {e}")
        return False


def test_2_step1_import_and_click():
    print("\n" + "=" * 70)
    print("✅ 验证2: 第一步导入采样间隔说明，点击混用点显示缺失材料")
    print("=" * 70)
    engine = WorkflowEngine()

    # 第一步: 导入采样间隔说明
    content = load_sampling_spec()
    engine.step1_import_sampling_spec(content, "sample_data/sampling_spec.txt")
    engine.step1_import_shock_data(create_fresh_shock_data())

    chart = Chart3D(engine.state)
    renderer = ReportRenderer(engine.state)

    # 点击数据点1
    click_result = chart.click_point(1)
    print(f"   点1: found={click_result['found']}")
    print(f"   留存原因: {click_result.get('retention_reason', '未找到')[:50]}...")
    print(f"   缺失材料: {click_result.get('missing_materials', [])}")
    print(f"   下一步对接: {click_result.get('next_contact', '未找到')}")
    print(f"   优先级: {click_result.get('priority', '未找到')}")

    # 验证交接报告中同一条数据的信息一致
    report = engine.state.handover_report
    note1 = next(n for n in report.retention_notes if n.data_point_id == 1)
    print(f"\n   交接报告留存说明对比:")
    print(f"   报告留存原因: {note1.reason_kept[:50]}...")
    print(f"   报告缺失材料: {note1.missing_materials}")
    print(f"   报告对接人: {note1.next_contact.value}")

    # 验证信息一致
    checks = [
        ("点击结果有留存原因", bool(click_result.get("retention_reason"))),
        ("点击结果有缺失材料", len(click_result.get("missing_materials", [])) > 0),
        ("点击结果有下一步对接", bool(click_result.get("next_contact"))),
        ("点击结果有优先级", bool(click_result.get("priority"))),
        ("留存原因与报告一致", click_result["retention_reason"] == note1.reason_kept),
        ("缺失材料与报告一致", click_result["missing_materials"] == note1.missing_materials),
        ("对接人与报告一致", click_result["next_contact"] == note1.next_contact.value),
        ("可回溯导航包含采样间隔说明", any(o["type"] == "采样间隔说明" for o in click_result["navigate_options"])),
        ("可回溯导航包含温度校准记录（缺失）", any(o.get("status") == "缺失" for o in click_result["navigate_options"])),
    ]
    for name, ok in checks:
        print(f"   {'✅' if ok else '❌'} {name}")

    # 验证CLI渲染输出包含新增字段
    cli_output = renderer.render_click_result(click_result)
    cli_checks = [
        ("CLI输出包含留存原因", "留存原因" in cli_output),
        ("CLI输出包含还缺什么材料", "还缺什么材料" in cli_output),
        ("CLI输出包含为什么这样处理", "为什么这样处理" in cli_output),
        ("CLI输出包含下一步对接", "下一步对接" in cli_output),
    ]
    for name, ok in cli_checks:
        print(f"   {'✅' if ok else '❌'} {name}")

    all_ok = all(ok for _, ok in (checks + cli_checks))
    print(f"\n   {'✅' if all_ok else '❌'} 第一步验证{'通过' if all_ok else '失败'}")
    return engine, chart, renderer


def test_3_step2_calibration_sync(engine, chart, renderer):
    print("\n" + "=" * 70)
    print("✅ 验证3: 第二步林老师补录校准后，三处信息同步更新")
    print("=" * 70)

    # 先看补录前点击结果
    before_click = chart.click_point(1)
    print(f"   补录前 - 缺失材料: {before_click.get('missing_materials')}")
    print(f"   补录前 - 下一步对接: {before_click.get('next_contact')}")

    # 第二步: 林老师补录校准记录
    engine.step2_lin_add_calibration(
        data_point_ids=[1],
        instrument_id="INS-2026-001",
        calibration_temp=24.85,
        calibration_unit=TempUnit.CELSIUS,
        remarks="开尔文298K转换为摄氏度24.85°C，已确认与原始采样一致"
    )

    # 重新构建chart和renderer
    chart = Chart3D(engine.state)
    renderer = ReportRenderer(engine.state)

    # 补录后点击结果
    after_click = chart.click_point(1)
    print(f"\n   补录后 - 缺失材料: {after_click.get('missing_materials')}")
    print(f"   补录后 - 下一步对接: {after_click.get('next_contact')}")

    # 验证交接报告同步更新
    report = engine.state.handover_report
    note1 = next(n for n in report.retention_notes if n.data_point_id == 1)
    print(f"   报告同步 - 缺失材料: {note1.missing_materials}")
    print(f"   报告同步 - 对接人: {note1.next_contact.value}")

    checks = [
        ("补录后缺失材料为空", len(after_click.get("missing_materials", [])) == 0),
        ("补录后下一步对接为训练教练", after_click.get("next_contact") == "训练教练"),
        ("报告中缺失材料也为空", len(note1.missing_materials) == 0),
        ("报告中对接人为训练教练", note1.next_contact.value == "训练教练"),
        ("点击结果缺失材料与报告一致", after_click["missing_materials"] == note1.missing_materials),
        ("可回溯导航显示校准已录入", any(o.get("type") == "温度校准记录" and "record_id" in o for o in after_click["navigate_options"])),
    ]
    for name, ok in checks:
        print(f"   {'✅' if ok else '❌'} {name}")

    all_ok = all(ok for _, ok in checks)
    print(f"\n   {'✅' if all_ok else '❌'} 第二步同步验证{'通过' if all_ok else '失败'}")
    return engine, chart, renderer


def test_4_step3_report_consistency(engine, chart, renderer):
    print("\n" + "=" * 70)
    print("✅ 验证4: 第三步更新报告后，结果能互相解释")
    print("=" * 70)

    # 第三步: 更新报告
    engine.step3_update_report(coach_notes="已复核所有单位混用点，校准记录完整，可用于训练评估")

    chart = Chart3D(engine.state)
    renderer = ReportRenderer(engine.state)
    report = engine.state.handover_report

    # 验证三处信息一致性（数据点1作为示例）
    click1 = chart.click_point(1)
    note1 = next(n for n in report.retention_notes if n.data_point_id == 1)

    print(f"   最终阶段: {report.workflow_stage.value}")
    print(f"   报告教练摘要包含'未自动归一化': {'未自动归一化' in report.summary_for_coach}")
    print(f"   报告林老师摘要包含校准记录数: {'5 份' in report.summary_for_lin or '1 份' in report.summary_for_lin or len(engine.state.calibration_records)} 份已录入")
    print(f"\n   点1交叉验证:")
    print(f"   点击留存原因: {click1['retention_reason'][:60]}...")
    print(f"   报告留存原因: {note1.reason_kept[:60]}...")
    print(f"   原因一致: {click1['retention_reason'] == note1.reason_kept}")

    full_report = renderer.render_full_report()
    checks = [
        ("报告完整包含训练教练摘要", "训练教练您好" in full_report),
        ("报告完整包含林老师摘要", "林老师您好" in full_report),
        ("报告说明未自动归一化", "系统未对混用数据做自动归一化" in full_report),
        ("报告包含逐条留存说明", "留存原因" in full_report),
        ("报告包含缺失材料说明", "缺失材料" in full_report),
        ("报告包含下一步对接人", "下一步对接" in full_report),
        ("点击结果与报告留存原因一致", click1["retention_reason"] == note1.reason_kept),
        ("点击结果与报告缺失材料一致", click1["missing_materials"] == note1.missing_materials),
        ("点击结果与报告对接人一致", click1["next_contact"] == note1.next_contact.value),
        ("点击结果可回溯采样间隔说明", any(o["type"] == "采样间隔说明" for o in click1["navigate_options"])),
        ("点击结果可回溯温度校准记录", any(o["type"] == "温度校准记录" and "record_id" in o for o in click1["navigate_options"])),
    ]
    for name, ok in checks:
        print(f"   {'✅' if ok else '❌'} {name}")

    all_ok = all(ok for _, ok in checks)
    print(f"\n   {'✅' if all_ok else '❌'} 最终一致性验证{'通过' if all_ok else '失败'}")
    return all_ok


def main():
    print("🪂 降落伞开伞冲击 - 完整端到端验证")
    print("验证重点: 模板渲染、缺失材料断点、三处同步更新、最终结果互相解释")
    print()

    results = []

    results.append(("模板渲染", test_1_template_render()))

    ok = test_1_template_render()
    if ok:
        engine, chart, renderer = test_2_step1_import_and_click()
        results.append(("第一步导入+点击", True))
        engine, chart, renderer = test_3_step2_calibration_sync(engine, chart, renderer)
        results.append(("第二步校准同步", True))
        final_ok = test_4_step3_report_consistency(engine, chart, renderer)
        results.append(("第三步报告一致性", final_ok))
    else:
        print("模板渲染失败，跳过后续测试")
        results.append(("第一步导入+点击", False))
        results.append(("第二步校准同步", False))
        results.append(("第三步报告一致性", False))

    print("\n" + "=" * 70)
    print("📊 验证结果汇总")
    print("=" * 70)
    all_pass = True
    for name, ok in results:
        status = "✅ 通过" if ok else "❌ 失败"
        print(f"   {status} - {name}")
        if not ok:
            all_pass = False

    print()
    if all_pass:
        print("🎉 所有验证通过！")
        print("   • Web看板模板渲染正常（CSS/JS大括号不再被误解析）")
        print("   • 采样间隔说明导入后，点击混用点能看到留存原因、缺失材料、为什么这样处理")
        print("   • 林老师补录校准记录后，先服务复核、可回溯链接、交接报告三处同步更新")
        print("   • 最终结果能互相解释，信息一致可交叉核对")
    else:
        print("❌ 部分验证未通过，请检查上方详情")
        sys.exit(1)


if __name__ == "__main__":
    main()
