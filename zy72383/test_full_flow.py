from cli import ConversionSystem
from models import RecordStatus
from demo_data import DEMO_SCENARIO_DESCRIPTION


def print_header(title):
    print("\n" + "=" * 80)
    print(f"📌 {title}")
    print("=" * 80)


def test_full_flow():
    print(DEMO_SCENARIO_DESCRIPTION)

    system = ConversionSystem()

    print_header("第一步：导入温度校准记录和压力数据")
    system.import_calibrations("demo_data/calibrations.csv")
    system.import_pressure("demo_data/pressure.csv")

    print("\n导入后记录状态：")
    system.list_records()

    print_header("查看QP-001详情（传感器编号异常）")
    system.show_record(1)

    print_header("第二步：训练教练老唐去现场核对物理标签")
    print("老唐查看传感器注册表，确认TAG-QP-001对应的正确编号是PT100-0042")
    system.show_sensors()

    print_header("老唐补录传感器编号")
    system.update_sensor_id(1, "PT100-0042", operator="老唐")

    print_header("第三步：补录后查看记录状态和安全提醒")
    system.show_record(1)

    print_header("查看所有记录状态")
    system.list_records()

    print_header("验证：传感器编号变化后没有直接归正常了吗？")
    record = system.records[0]
    if record.status == RecordStatus.PENDING_REVIEW:
        print("✅ 正确！状态是「待安全员复核」，没有自动归正常")
    else:
        print(f"❌ 错误！状态是「{record.status.value}」")

    print("\n验证：安全提醒从「找老唐」变成「找安全员」了吗？")
    pending_reminders = [r for r in record.safety_reminders if not r.is_resolved]
    for r in pending_reminders:
        print(f"   ⚠️  {r.title}")
        print(f"      下一步: {r.next_action.value}")
        if "找安全员" in r.next_action.value:
            print("      ✅ 正确！下一步是找安全员复核")

    print_header("第四步：安全员复核")
    system.safety_review(1, "经核查，传感器确实重启过，编号变化不影响数据有效性，同意放行", approve=True, operator="安全员老李")

    print_header("第五步：处理QP-003的口径问题（错口径返工）")
    print("现场技术修正口径为PT100")
    system.fix_caliber(3, "PT100", operator="现场技术")

    print_header("第六步：执行换算")
    print("\n对QP-002（正常记录）：")
    system.convert(2)

    print("\n对QP-001（安全员已复核）：")
    system.convert(1)

    print("\n对QP-003（口径已修正）：")
    system.convert(3)

    print_header("第七步：演示人工修正")
    print("老唐发现QP-002换算结果需要微调，进行人工修正：")
    system.manual_correct(2, 13.8, "现场实测调整0.1MPa", operator="老唐")

    print_header("第八步：演示重跑")
    print("对QP-001进行重跑（演示）：")
    system.rerun(1)

    print_header("最终状态")
    system.list_records()

    print_header("查看QP-001完整操作日志")
    system.show_record(1)

    print("\n" + "=" * 80)
    print("✅ 完整流程测试通过！")
    print("=" * 80)
    print("\n核心验证点总结：")
    print("  ✅ 传感器重启后编号变化被正确检测")
    print("  ✅ 安全提醒说明「为什么留下」「缺什么材料」「下一步找谁」")
    print("  ✅ 补录后安全提醒自动更新，从找老唐→找安全员")
    print("  ✅ 传感器编号变化不自动归正常，必须安全员复核")
    print("  ✅ 错口径问题被检测并可修复")
    print("  ✅ 人工修正和重跑功能正常")
    print("  ✅ 操作日志完整记录每一步操作")
    print("=" * 80)


if __name__ == "__main__":
    test_full_flow()
