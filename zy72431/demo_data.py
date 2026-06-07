TUNER_MESSAGES = [
    """
    2025-06-05 录音室记录
    乐队：超音速乐队
    房间：3号录音室
    时间：14:00-17:00
    调音师：阿凯
    备注：设备正常，排练顺利完成
    """,
    """
    6月6日 调音记录
    极光乐队
    房间：2号排练厅
    时间：19:00-21:00
    阿明调音
    主唱请假了，其他人没来，取消
    """,
    """
    2025/06/07 调音日志
    乐队：老枪乐队
    室：1号厅
    时间：10:00-12:30
    调音师：阿凯
    正常排练
    """
]

GROUP_SIGNUPS = [
    """
    【超音速乐队 6月5日排练接龙】
    日期：2025-06-05
    曲目：《出发》、《逆风飞翔》、《星空下》、《黎明之前》
    人员：
    1. 阿杰 +1
    2. 小南 +1
    3. 胖子 +1
    4. 阿凯 +1
    备注：记得带效果器
    """,
    """
    【老枪乐队 6月7日补录】
    日期：2025/06/07
    乐队：老枪乐队
    曲目：
    《老地方》
    《岁月如烟》
    《再次上路》
    备注：旧口径统计，之前没接龙
    人员：
    1. 老周
    2. 老李
    3. 老王
    """
]

DEMO_SCENARIOS = {
    "normal": {
        "description": "顺利记录 - 超音速乐队 6月5日",
        "tuner_message_idx": 0,
        "group_signup_idx": 0
    },
    "leave_consumed": {
        "description": "请假课时被算进已消耗 - 极光乐队 6月6日",
        "tuner_message_idx": 1,
        "needs_review": True
    },
    "supplemented": {
        "description": "后来从排练群接龙补来的旧口径 - 老枪乐队 6月7日",
        "tuner_message_idx": 2,
        "group_signup_idx": 1,
        "is_old_caliber": True
    }
}


def load_demo_data(processor):
    print("=" * 60)
    print("  音响租赁调音记录 - 演示数据导入")
    print("=" * 60)
    
    record_ids = {}
    
    print("\n【第一步】导入调音师留言（共3条）")
    print("-" * 60)
    
    for i, msg in enumerate(TUNER_MESSAGES):
        print(f"\n  正在导入第 {i+1} 条调音师留言...")
        record = processor.import_tuner_message(msg)
        key = f"record_{i}"
        record_ids[key] = record.id
        print(f"  ✓ {record.band_name} {record.date} - {record.status.value}")
    
    print("\n【第二步】补录排练群接龙（共2条）")
    print("-" * 60)
    
    print("\n  补录 超音速乐队 的群接龙...")
    processor.supplement_group_signup(
        record_ids["record_0"],
        GROUP_SIGNUPS[0]
    )
    print("  ✓ 超音速乐队 曲目核对表已更新")
    
    print("\n  补录 老枪乐队 的旧口径群接龙...")
    processor.supplement_group_signup(
        record_ids["record_2"],
        GROUP_SIGNUPS[1]
    )
    print("  ✓ 老枪乐队 已标记为补录旧口径")
    
    print("\n【第三步】一次人工修正（极光乐队）")
    print("-" * 60)
    print("\n  巡演统筹正在复核极光乐队的请假记录...")
    processor.manual_correct(
        record_ids["record_1"],
        {
            "is_consumed": False,
            "needs_review": False,
            "status": "corrected",
            "review_note": "已确认请假，不计入消耗课时"
        },
        operator="巡演统筹"
    )
    print("  ✓ 极光乐队 已修正：请假不计入消耗")
    
    print("\n【第四步】一次重跑（超音速乐队）")
    print("-" * 60)
    print("\n  重跑 超音速乐队 记录...")
    processor.rerun_record(record_ids["record_0"])
    print("  ✓ 超音速乐队 重跑完成")
    
    print("\n" + "=" * 60)
    print("  演示数据导入完成！")
    print("=" * 60)
    
    return record_ids


def print_demo_summary(processor):
    print("\n" + "=" * 60)
    print("  三种场景处理结果对比")
    print("=" * 60)
    
    records = processor.get_records_summary()
    for r in records:
        print(f"\n【{r['band_name']}】{r['date']}")
        print(f"  状态: {r['status_text']}")
        print(f"  课时: {r['hours']}小时")
        print(f"  是否请假: {'是' if r['is_leave'] else '否'}")
        print(f"  是否消耗: {'是' if r['is_consumed'] else '否'}")
        print(f"  待复核: {'是' if r['needs_review'] else '否'}")
        print(f"  曲目数: {r['song_count']}")
        print(f"  运行次数: {r['run_count']}")
    
    print("\n" + "=" * 60)
    print("  曲目核对表")
    print("=" * 60)
    
    checklists = processor.get_song_checklist()
    current_band = ""
    for c in checklists:
        if c['band_name'] != current_band:
            current_band = c['band_name']
            print(f"\n【{current_band}】")
        status = "✓ 已排" if c['actually_performed'] else "✗ 未执行"
        print(f"  {status} - {c['song_name']} ({c['note']})")
    
    print("\n" + "=" * 60)
    print("  操作日志")
    print("=" * 60)
    
    logs = processor.get_logs()
    for log in logs:
        print(f"  [{log['timestamp'][11:19]}] {log['operator']}: {log['action']} - {log['detail'][:50]}...")
