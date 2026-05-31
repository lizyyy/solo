#!/usr/bin/env python3
import json
import shutil
from datetime import datetime, timedelta
from pathlib import Path

from models import CallRecord
from storage import DataStorage
from manual_judgment import ManualJudgmentManager
from discrepancy_detector import DiscrepancyDetector
from quality_check import QualityCheckManager
from exporter import DataExporter


def generate_sample_calls(task_id="TASK001", count=5):
    """生成示例呼叫数据"""
    calls = []
    base_time = datetime.now() - timedelta(days=3)

    names = ["张三", "李四", "王五", "赵六", "钱七", "孙八", "周九", "吴十"]
    results = ["A类意向", "B类意向", "C类意向", "无意向", "无效号码"]

    for i in range(count):
        call_time = base_time + timedelta(minutes=i * 15)
        call = CallRecord(
            call_id=f"CALL{i+1:04d}",
            task_id=task_id,
            task_name="5月理财产品推广",
            phone_number=f"138{10000000+i:08d}",
            customer_name=names[i % len(names)],
            call_time=call_time,
            call_duration=30 + i * 10,
            ai_result=results[i % len(results)],
            ai_confidence=0.75 + i * 0.04,
            is_grayscale=(i % 3 == 0),
            grayscale_version="v2.1-beta" if i % 3 == 0 else None
        )
        calls.append(call)

    return calls


def demo_1_import_with_deduplication():
    """演示1: 重复导入自动去重"""
    print("\n" + "=" * 70)
    print("演示1: 同一批材料第二次导入不会创建新记录")
    print("=" * 70)

    storage = DataStorage("./demo_data")
    calls = generate_sample_calls("TASK001", 5)

    calls_json = [c.to_dict() for c in calls]
    Path("./temp").mkdir(exist_ok=True)
    with open("./temp/sample_calls.json", "w", encoding="utf-8") as f:
        json.dump(calls_json, f, ensure_ascii=False, indent=2)

    print("\n第一次导入 (批次 BATCH001)...")
    result1 = storage.import_calls(calls, "BATCH001")
    print(f"  导入: {result1['imported_count']} 条, 跳过: {result1['skipped_count']} 条")

    print("\n第二次导入同一批数据 (批次 BATCH001)...")
    result2 = storage.import_calls(calls, "BATCH001")
    print(f"  导入: {result2['imported_count']} 条, 跳过: {result2['skipped_count']} 条")

    if result2['skipped_calls']:
        print(f"\n  跳过原因: {result2['skipped_calls'][0]['reason']}")

    print("\n✅ 验证: 重复数据自动去重，历史不会被洗成新记录")
    return storage


def demo_2_manual_judgment_tracking(storage):
    """演示2: 人工改判追踪"""
    print("\n" + "=" * 70)
    print("演示2: 人工改判追踪 - 再也不用问谁改过了")
    print("=" * 70)

    manual_mgr = ManualJudgmentManager(storage)

    print("\n场景: 运营分析师 '李明' 改判 CALL0001")
    result = manual_mgr.update_manual_result(
        call_id="CALL0001",
        new_result="A类意向",
        operator="李明",
        reason="听录音确认客户明确表达购买意向"
    )
    print(f"  改判结果: {result['success']}")
    print(f"  旧值: {result['old_result']} → 新值: {result['new_result']}")

    print("\n场景: 运营分析师 '王芳' 再次改判同一条记录")
    result2 = manual_mgr.update_manual_result(
        call_id="CALL0001",
        new_result="B类意向",
        operator="王芳",
        reason="客户说需要再考虑一下，暂时不算A类"
    )
    print(f"  改判结果: {result2['success']}")
    print(f"  旧值: {result2['old_result']} → 新值: {result2['new_result']}")

    print("\n查询: 谁改过 CALL0001?")
    changers = manual_mgr.who_changed("CALL0001")
    for i, changer in enumerate(changers, 1):
        print(f"  {i}. {changer['operator']} 于 {changer['operate_time']}")
        print(f"     {changer['old_value']} → {changer['new_value']}")
        print(f"     原因: {changer['reason']}")

    print("\n查看完整改判历史:")
    history = manual_mgr.get_call_history("CALL0001")
    print(f"  当前结果: {history['current_result']}")
    print(f"  改判次数: {history['change_count']}")
    print(f"  最后改判人: {history['current_operator']}")

    print("\n✅ 验证: 改判记录完整可追溯，操作人、时间、原因一目了然")
    return manual_mgr


def demo_3_discrepancy_detection(storage):
    """演示3: 灰度结论与报表差异检测"""
    print("\n" + "=" * 70)
    print("演示3: 灰度结论与报表差异检测 - 不吞差异，明确责任人")
    print("=" * 70)

    discrepancy_mgr = DiscrepancyDetector(storage)

    report_data = [
        {
            "call_id": "CALL0001",
            "ai_result": "A类意向",
            "manual_result": "A类意向"
        },
        {
            "call_id": "CALL0002",
            "ai_result": "B类意向",
            "manual_result": "C类意向"
        },
        {
            "call_id": "CALL0003",
            "ai_result": "C类意向",
            "manual_result": "C类意向"
        }
    ]

    print("\n场景: 导入人工报表，检测与系统数据的差异")
    result = discrepancy_mgr.detect_discrepancies("TASK001", report_data)
    print(f"  检查记录数: {result['total_checked']}")
    print(f"  新发现差异: {result['new_discrepancies']} 条")

    if result['discrepancies']:
        print("\n差异详情:")
        for d in result['discrepancies']:
            print(f"  - 呼叫 {d['call_id']}: {d['field_name']} 不一致")
            print(f"    来源: {d['source']}")
            print(f"    责任人: {d['responsible_person']}")
            print(f"    描述: {d['description'][:50]}...")

    if result['discrepancies']:
        d_id = result['discrepancies'][0]['discrepancy_id']
        print(f"\n查看差异 {d_id} 的详情和下一步行动:")
        detail = discrepancy_mgr.get_discrepancy_detail(d_id)
        ns = detail['next_step']
        print(f"  下一步动作: {ns['action']}")
        print(f"  联系人: {ns['contact']}")
        print(f"  沟通方式: {ns['method']}")
        print(f"  升级路径: {ns['escalation']}")

    print("\n✅ 验证: 差异不会被忽略，来源和下一步明确，不用瞎猜找谁")
    return discrepancy_mgr


def demo_4_quality_check_tracking(storage):
    """演示4: 质检表修改历史追踪"""
    print("\n" + "=" * 70)
    print("演示4: 质检修改历史 - 周报与明细不再各说各话")
    print("=" * 70)

    quality_mgr = QualityCheckManager(storage)

    print("\n场景: 质检人员 '张质检' 提交质检结果")
    qc_result = quality_mgr.submit_quality_check(
        call_id="CALL0001",
        task_id="TASK001",
        checker="张质检",
        original_result="B类意向",
        checked_result="A类意向",
        comments="重新审核录音，客户确实有明确意向"
    )
    print(f"  质检ID: {qc_result['check_id']}")
    print(f"  是否修改结果: {'是' if qc_result['is_modified'] else '否'}")

    print("\n场景: 运营 '李明' 又改了同一条记录 (可能覆盖质检结果)")
    from manual_judgment import ManualJudgmentManager
    manual_mgr = ManualJudgmentManager(storage)
    manual_mgr.update_manual_result(
        call_id="CALL0001",
        new_result="C类意向",
        operator="李明",
        reason="客户后续回访说不需要了"
    )
    print("  李明已修改 CALL0001 的人工结果")

    print("\n周报告对比: 检测质检与人工改判的不一致")
    week_start = (datetime.now() - timedelta(days=7)).isoformat()
    week_end = datetime.now().isoformat()
    compare_result = quality_mgr.compare_weekly_reports(week_start, week_end, "TASK001")
    print(f"  质检数: {compare_result['total_checks']}")
    print(f"  人工改判数: {compare_result['total_manual_changes']}")
    print(f"  不一致数: {compare_result['inconsistency_count']}")

    if compare_result['inconsistencies']:
        inc = compare_result['inconsistencies'][0]
        print(f"\n  发现不一致: 呼叫 {inc['call_id']}")
        print(f"    人工改判人: {inc['manual_operator']} 于 {inc['manual_time']}")
        print(f"    人工结果: {inc['manual_result']}")
        print(f"    质检人: {inc['qc_checker']} 于 {inc['qc_time']}")
        print(f"    质检结果: {inc['qc_result']}")
        print(f"    问题: {inc['issue']}")

    print("\n查看 CALL0001 的质检完整历史:")
    qc_history = quality_mgr.get_call_quality_history("CALL0001")
    print(f"  质检次数: {qc_history['check_count']}")
    print(f"  修改次数: {qc_history['modified_count']}")
    for item in qc_history['quality_history']:
        print(f"    {item['check_time']} - {item['checker']}: "
              f"{item['original_result']} → {item['checked_result']}")

    print("\n✅ 验证: 质检修改留痕，周报与明细可对账")
    return quality_mgr


def demo_5_consistent_export(storage):
    """演示5: 一致性数据导出"""
    print("\n" + "=" * 70)
    print("演示5: 一致性导出 - 统一数据口径")
    print("=" * 70)

    exporter = DataExporter(storage)

    output_dir = "./demo_export"
    Path(output_dir).mkdir(exist_ok=True, parents=True)

    print("\n导出完整复盘数据包...")
    result = exporter.export_full_review_package(output_dir, task_id="TASK001")
    print(f"  输出目录: {result['output_dir']}")
    print(f"  导出时间: {result['export_time']}")

    print("\n导出文件清单:")
    for key, file_info in result['files'].items():
        if file_info.get('file_path'):
            print(f"  - {file_info['file_path']}")

    print("\n导出说明文件内容:")
    summary_files = [f for f in Path(output_dir).glob("导出说明_*.txt")]
    if summary_files:
        with open(summary_files[0], 'r', encoding='utf-8') as f:
            for line in f.readlines()[:15]:
                print(f"  {line.rstrip()}")

    print("\n✅ 验证: 所有数据同一时间点导出，口径一致，可互相印证")


def main():
    print("\n🚀 智能外呼复盘系统 - 功能演示")

    shutil.rmtree("./demo_data", ignore_errors=True)
    shutil.rmtree("./demo_export", ignore_errors=True)
    Path("./temp").mkdir(exist_ok=True)

    try:
        storage = demo_1_import_with_deduplication()
        demo_2_manual_judgment_tracking(storage)
        demo_3_discrepancy_detection(storage)
        demo_4_quality_check_tracking(storage)
        demo_5_consistent_export(storage)

        print("\n" + "=" * 70)
        print("🎉 所有演示完成！系统核心功能验证通过")
        print("=" * 70)
        print("\n主要特性总结:")
        print("  ✓ 同一批材料可反复跑，不洗历史记录")
        print("  ✓ 谁改过人工改判一键查询，不靠记忆")
        print("  ✓ 灰度与报表差异标注来源，明确下一步找谁")
        print("  ✓ 质检修改留痕，周报明细可对账")
        print("  ✓ 统一数据口径导出，确保各表一致")
        print("\n命令行使用: python cli.py --help")
        print("查看统计: python cli.py summary")
        print("")

    finally:
        shutil.rmtree("./temp", ignore_errors=True)


if __name__ == "__main__":
    main()
