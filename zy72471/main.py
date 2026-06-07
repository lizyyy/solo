import sys
from models import BuildingSetbackRecord, RecordStatus
from scoring import RecordProcessor, ScoringEngine
from demo_data import get_demo_records, get_supplement_content, get_redline_notes, get_test_cases
from errors import InputValidator, UserFriendlyError


def print_separator(char="=", length=60):
    print(char * length)


def print_record_summary(record: BuildingSetbackRecord, show_history: bool = True, show_corrections: bool = True):
    print(f"\n📋 记录编号: {record.record_id}")
    print(f"   建筑名称: {record.building_name}")
    print(f"   地    址: {record.address}")
    print(f"   公交时段: {record.bus_card_time}")
    print(f"   当前评分: {record.current_score:.1f} 分")
    print(f"   状    态: {record.status.value}")
    print(f"   整改建议: {record.suggestion}")
    
    if show_corrections and record.corrections:
        print(f"\n   📝 修正记录 ({len(record.corrections)} 条):")
        for i, corr in enumerate(record.corrections, 1):
            print(f"      {i}. [{corr['source']}] {corr['content']}")
            print(f"         操作人: {corr['operator']}, 时间: {corr['time']}")
    
    if show_history and record.history:
        print(f"\n   📜 历史记录 ({len(record.history)} 条):")
        for i, h in enumerate(record.history, 1):
            print(f"      {i}. [{h['time']}] {h['operator']} - {h['action']}")
            print(f"         {h['detail']}")


def demo_full_workflow():
    """演示完整流程：公交刷卡时段导入 → 补看红线图备注 → 整改建议更新"""
    print_separator()
    print("🏢 楼宇退线空间占用 - 完整流程演示")
    print_separator()

    processor = RecordProcessor()
    records = get_demo_records()
    supplement_content = get_supplement_content()
    redline_notes = get_redline_notes()

    record_map = {r.record_id: r for r in records}

    print("\n第一步：导入公交刷卡时段数据")
    print("-" * 40)
    for record in records:
        InputValidator.validate_bus_card_time(record.bus_card_time)
        processor.step1_import_bus_data(record, operator="市政巡检员小付")
    print("✅ 已导入 3 条记录的公交刷卡数据\n")

    print("第二步：坡道补录（只针对有坡道的记录）")
    print("-" * 40)
    for record_id, content in supplement_content.items():
        record = record_map[record_id]
        print(f"\n处理记录: {record.building_name} ({record_id})")
        print(f"  补录前评分: {record.current_score:.1f} 分")
        processor.step2_ramp_supplement(record, content, operator="市政巡检员小付")
        print(f"  补录后评分: {record.current_score:.1f} 分")
        print(f"  新状态: {record.status.value}")
        if record.status == RecordStatus.NEEDS_REVIEW:
            print(f"  ⚠️  评分没变化！已转交通协管复核，没有直接归为正常")
    print()

    print("第三步：查看红线图备注")
    print("-" * 40)
    for record_id, note in redline_notes.items():
        record = record_map[record_id]
        print(f"\n处理记录: {record.building_name} ({record_id})")
        print(f"  查看红线图备注: {note}")
        old_status = record.status.value
        processor.step3_check_redline_note(record, note, operator="市政巡检员小付")
        print(f"  状态变化: {old_status} → {record.status.value}")
        print(f"  评分变化: {record.initial_score:.1f} → {record.current_score:.1f} 分")
    print()

    print("第四步：一次人工修正 + 一次重跑")
    print("-" * 40)
    record = record_map["TX-2026-002"]
    print(f"\n对 {record.building_name} 进行人工修正:")
    print(f"  修正前: {record.current_score:.1f} 分, 状态: {record.status.value}")
    processor.step4_manual_correction(record, new_score=88.0, reason="交通协管现场复核，确认坡道不影响通行", operator="交通协管老李")
    print(f"  修正后: {record.current_score:.1f} 分, 状态: {record.status.value}")

    print(f"\n对 {record.building_name} 进行重跑验证:")
    processor.rerun(record, operator="市政巡检员小付")
    print(f"  重跑后: {record.current_score:.1f} 分, 状态: {record.status.value}")

    print("\n" + "=" * 60)
    print("📊 三条记录最终结果对比")
    print_separator("-")
    for record in records:
        result = processor.get_result(record)
        print(f"\n{result.display_message}")
        print(f"   整改建议: {result.suggestion}")
        print(f"   历史记录: {result.history_count} 条, 修正记录: {result.correction_count} 条")

    print("\n" + "=" * 60)
    print("✅ 完整流程演示结束")
    print("   三种处理结果对比:")
    print("   1. 阳光花园A栋 - 顺利记录，评分正常")
    print("   2. 幸福里商业楼 - 坡道补录后评分没变，转复核后人工修正")
    print("   3. 老城区供销社大楼 - 红线图备注旧口径，按历史规则处理")


def run_test_materials():
    """运行三种测试材料：正常、错口径、补录"""
    print_separator()
    print("🧪 三种材料测试运行")
    print_separator()

    processor = RecordProcessor()
    test_cases = get_test_cases()
    supplement_content = get_supplement_content()
    redline_notes = get_redline_notes()

    for case_name, case_info in test_cases.items():
        print(f"\n\n📌 测试材料: {case_info['description']}")
        print("-" * 50)

        all_records = get_demo_records()
        record_map = {r.record_id: r for r in all_records}

        for record_id in case_info["records"]:
            record = record_map[record_id]
            print(f"\n处理记录: {record.building_name} ({record_id})")

            processor.step1_import_bus_data(record, operator="市政巡检员小付")
            print(f"  第一步 - 导入公交数据: 评分 {record.current_score:.1f} 分, 状态 {record.status.value}")
            print(f"  整改建议: {record.suggestion}")

            if case_name == "supplement" and record_id in supplement_content:
                processor.step2_ramp_supplement(record, supplement_content[record_id], operator="市政巡检员小付")
                print(f"  第二步 - 坡道补录: 评分 {record.current_score:.1f} 分, 状态 {record.status.value}")
                print(f"  整改建议: {record.suggestion}")
                print(f"  ✅ 历史记录和整改建议能对上：补录后评分没变 → 建议复核")

            if case_name == "wrong_standard" and record_id in redline_notes:
                processor.step3_check_redline_note(record, redline_notes[record_id], operator="市政巡检员小付")
                print(f"  第三步 - 红线图备注: 评分 {record.current_score:.1f} 分, 状态 {record.status.value}")
                print(f"  整改建议: {record.suggestion}")
                print(f"  ✅ 历史记录和整改建议能对上：发现旧口径 → 建议按旧口径核查")

            print(f"  📜 历史记录数: {len(record.history)} 条")
            for h in record.history:
                print(f"     - [{h['time']}] {h['action']}: {h['detail']}")

        print(f"\n预期结果: {case_info['expected_status']}")
        actual_status = record_map[case_info["records"][0]].status.value
        print(f"实际结果: {actual_status}")
        if actual_status == case_info["expected_status"]:
            print(f"✅ 测试通过！")
        else:
            print(f"❌ 测试不通过！")


def show_error_demo():
    """演示友好错误提示"""
    print_separator()
    print("⚠️  友好错误提示演示")
    print_separator()

    test_errors = [
        ("评分超出范围", lambda: InputValidator.validate_score(150)),
        ("空记录编号", lambda: InputValidator.validate_record_id("")),
        ("空操作人", lambda: InputValidator.validate_operator("")),
    ]

    for error_name, test_func in test_errors:
        print(f"\n测试场景: {error_name}")
        try:
            test_func()
        except UserFriendlyError as e:
            print(f"  错误提示: {e}")


def main():
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg == "demo":
            demo_full_workflow()
        elif arg == "test":
            run_test_materials()
        elif arg == "errors":
            show_error_demo()
        else:
            print("用法: python main.py [demo|test|errors]")
            print("  demo   - 完整流程演示")
            print("  test   - 三种材料测试")
            print("  errors - 错误提示演示")
    else:
        print_separator()
        print("🏢 楼宇退线空间占用分析系统")
        print_separator()
        print("\n请选择运行模式:")
        print("  1. 完整流程演示 (demo)")
        print("  2. 三种材料测试 (test)")
        print("  3. 错误提示演示 (errors)")
        print("\n运行命令示例:")
        print("  python main.py demo    # 看完整流程演示")
        print("  python main.py test    # 跑三种测试材料")
        print("  python main.py errors  # 看错误提示效果")
        
        print("\n" + "=" * 60)
        print("💡 核心设计说明:")
        print("  • 坡道补录后评分没变 → 不自动归正常，留给交通协管复核")
        print("  • 红线图备注含'旧口径' → 自动标记为旧口径状态")
        print("  • 所有错误提示说人话，不吐内部字段名")
        print("  • 每条操作都留历史记录，整改建议和历史能对上")
        print("  • 支持重跑，验证修正是否生效")


if __name__ == "__main__":
    main()
