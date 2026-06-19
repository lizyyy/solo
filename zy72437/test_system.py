import csv
import io
import json
from api import APIHandler


def test_a_song_alias_not_normalized():
    print("=" * 70)
    print("测试 A: 同一首歌有现场名和版权名时，不提前放行归为正常")
    print("=" * 70)

    api = APIHandler()
    workflow = api.create_workflow()
    wid = workflow["workflow_id"]

    step1 = api.workflow_step1(
        wid,
        {
            "operator": "许老师",
            "records": [
                {
                    "lesson_date": "2026-06-10",
                    "teacher": "许老师",
                    "student": "小星",
                    "song_live_name": "小星星变奏曲",
                    "song_copyright_name": "Twinkle Twinkle Little Star",
                    "attendance_count": 1,
                    "raw_remark": "原始签到备注：学生第一节课，手指力度还需加强。课后要求每天练20分钟哈农",
                },
            ],
        },
    )

    record1_id = step1["records"][0]["record_id"]
    r1_status = step1["records"][0]["status"]
    r1_status_text = step1["records"][0]["status_text"]
    print(f"  [导入后] 状态: {r1_status} / {r1_status_text}")
    assert r1_status != "normal", "导入后别名记录不应为 normal!"
    assert r1_status == "pending_review", "导入后别名记录应为 pending_review"
    print("  ✅ 导入后状态正确：待复核（未归为正常）")

    step2 = api.workflow_step2(
        wid,
        {
            "operator": "许老师",
            "ticket_mapping": {
                record1_id: {
                    "song_name": "小星星变奏曲",
                    "attendance_count": 1,
                    "remark": "票务原始备注：学生姓名小星，课程编码MUSIC-0610，已核销课时1节",
                    "song_copyright_name": "Twinkle Twinkle Little Star",
                }
            },
        },
    )

    still_pending = step2["still_pending_song_alias_review"]
    print(f"  [票务补录后] 仍有别名待复核: {len(still_pending)} 条")
    for sp in still_pending:
        print(f"    - {sp['student']}: 现场名='{sp['song_live_name']}' 版权名='{sp['song_copyright_name']}'")

    record1_detail = api.get_record(record1_id)
    print(f"  [票务补录后] 状态: {record1_detail['status']} / {record1_detail['status_text']}")
    assert record1_detail["status"] == "pending_review", "别名记录即使票务无冲突也不能归normal"
    print("  ✅ 票务补录后状态正确：即使同名同人数，别名记录仍保留待复核")

    has_alias = record1_detail["has_song_alias"]
    live_name = record1_detail["song_live_name"]
    copy_name = record1_detail["song_copyright_name"]
    print(f"  [双字段保留] has_song_alias={has_alias}, 现场名='{live_name}', 版权名='{copy_name}'")
    assert has_alias == True
    assert live_name and copy_name and live_name != copy_name
    print("  ✅ 歌曲现场名和版权名都保留，未互相覆盖")

    print("\n  --- 尝试跳过别名确认直接生成周报（应该报错） ---")
    try:
        api.workflow_step3(wid, {"operator": "许老师"})
        print("  ❌ 错误：周报生成应该被阻止，但实际通过了")
        assert False
    except ValueError as e:
        print(f"  ✅ 正确阻止生成周报: {str(e)[:60]}...")

    print("\n  --- 许老师人工确认别名处理 ---")
    alias_result = api.confirm_song_alias(
        record1_id,
        {
            "operator": "许老师",
            "confirm_live_name_as_official": True,
            "decision_note": "家长提供的课程协议上使用的是现场名，以现场名为准归档",
        },
    )
    print(f"  人工确认结果: {alias_result['decision']}")
    print(f"  状态变化: {alias_result['old_status']} -> {alias_result['new_status']}")
    print(f"  最终歌曲名: '{alias_result['final_song_name']}'")

    record1_after = api.get_record(record1_id)
    assert record1_after["status"] == "confirmed"
    assert record1_after["song_live_name"] == record1_after["song_copyright_name"]
    print("  ✅ 人工确认后状态变为已确认，双字段已统一")

    step3 = api.workflow_step3(wid, {"operator": "许老师"})
    print(f"\n  [周报生成] 步骤: {step3['step_name']}")
    print("  ✅ A组测试全部通过\n")


def test_b_remark_not_overwritten():
    print("=" * 70)
    print("测试 B: 票务备注不覆盖原话，历史里留住修改人和原因")
    print("=" * 70)

    api = APIHandler()

    workflow = api.create_workflow()
    wid = workflow["workflow_id"]

    sign_remark = (
        "签到原始备注（需要完整保留）："
        "学生今天表现非常好，音阶练习全部正确。"
        "但是《卡农》第二段琶音总是抢拍子，下节课重点练习。"
        "另外家长说下次课可能会晚到10分钟，请留意。"
    )
    step1 = api.workflow_step1(
        wid,
        {
            "operator": "许老师",
            "records": [
                {
                    "lesson_date": "2026-06-11",
                    "teacher": "许老师",
                    "student": "小卡",
                    "song_live_name": "卡农",
                    "song_copyright_name": "卡农",
                    "attendance_count": 1,
                    "raw_remark": sign_remark,
                },
            ],
        },
    )
    rid = step1["records"][0]["record_id"]

    ticket_remark_1 = "票务第一次备注：课时已核销，收费200元，开票单号INV-20260611-001。家长要求发票抬头为'某某教育科技有限公司'"
    step2 = api.workflow_step2(
        wid,
        {
            "operator": "许老师",
            "ticket_mapping": {
                rid: {
                    "song_name": "卡农",
                    "attendance_count": 1,
                    "remark": ticket_remark_1,
                }
            },
        },
    )

    ticket_remark_2 = "票务第二次备注（修正）：开票单号应为INV-20260611-002，001是另一位学生的，请以第二次为准！"
    step2_b = api.workflow_step2(
        wid,
        {
            "operator": "王会计",
            "ticket_mapping": {
                rid: {
                    "song_name": "卡农",
                    "attendance_count": 1,
                    "remark": ticket_remark_2,
                }
            },
        },
    )

    record = api.get_record(rid)
    print(f"  [最终 raw_remark] 长度={len(record['raw_remark'])}")
    assert record["raw_remark"] == sign_remark, "签到备注被覆盖了！"
    print("  ✅ 签到备注完整保留，没有被票务备注覆盖")

    print(f"  [最终 ticket_remark] 长度={len(record['ticket_remark'])}")
    assert record["ticket_remark"] == ticket_remark_2, "最新票务备注未正确记录"
    print("  ✅ 最新票务备注正确记录为第二次修正值")

    remark_histories = api.get_remark_histories(rid)
    print(f"\n  [备注历史总数] {remark_histories['count']} 条：")
    for h in remark_histories["remark_histories"]:
        print(f"    * [{h['source_text']}] 操作人: {h['modified_by']}")
        print(f"       原因: {h['change_reason']}")
        print(f"       内容: {h['remark_text'][:50]}...")

    assert len(remark_histories["remark_histories"]) == 3, f"应有3条历史（1签到+2票务），实际{len(remark_histories['remark_histories'])}"
    sources = [h["source"] for h in remark_histories["remark_histories"]]
    assert sources.count("sign_in_photo") == 1
    assert sources.count("ticket_export") == 2
    print("  ✅ 备注历史完整：签到1条 + 票务2条，修改人和原因都有记录")

    second_ticket_history = remark_histories["remark_histories"][2]
    assert "原值存在" in second_ticket_history["change_reason"], "第二次票务备注修改应说明原值存在并保留"
    print("  ✅ 第二次票务备注修改历史中明确说明：原值存在，已保留历史")

    export_csv = api.export_records_csv([rid])
    assert sign_remark in export_csv, "导出CSV中找不到签到原始备注"
    assert ticket_remark_2 in export_csv, "导出CSV中找不到最新票务备注"
    print("  ✅ 导出CSV包含完整签到备注和最新票务备注")

    page = api.get_record(rid)
    api_return = api.list_records()["records"][0]
    assert page["raw_remark"] == api_return["raw_remark"] == sign_remark
    assert page["ticket_remark"] == api_return["ticket_remark"] == ticket_remark_2
    print("  ✅ 页面展示和接口返回的备注一致")
    print("  ✅ B组测试全部通过\n")


def test_c_duplicate_classification():
    print("=" * 70)
    print("测试 C: 导入时区分本次重复、历史重复、新记录")
    print("=" * 70)

    api = APIHandler()

    workflow1 = api.create_workflow()
    w1 = workflow1["workflow_id"]
    step1 = api.workflow_step1(
        w1,
        {
            "operator": "许老师",
            "records": [
                {
                    "lesson_date": "2026-06-08",
                    "teacher": "许老师",
                    "student": "小李",
                    "song_live_name": "致爱丽丝",
                    "song_copyright_name": "Für Elise",
                    "attendance_count": 1,
                    "raw_remark": "历史新记录",
                },
                {
                    "lesson_date": "2026-06-09",
                    "teacher": "许老师",
                    "student": "小孙",
                    "song_live_name": "月光",
                    "song_copyright_name": "Clair de Lune",
                    "attendance_count": 1,
                    "raw_remark": "本次批次第一条",
                },
                {
                    "lesson_date": "2026-06-09",
                    "teacher": "许老师",
                    "student": "小孙",
                    "song_live_name": "月光",
                    "song_copyright_name": "Clair de Lune",
                    "attendance_count": 1,
                    "raw_remark": "本次批次重复（和小孙上一条完全一样）",
                },
            ],
        },
    )

    s = step1["import_summary"]
    print(f"  第一批导入汇总: 输入{s['total_input']}条 / 创建{s['total_created']}条")
    print(f"    新记录: {s['new_count']} 条")
    print(f"    本次批次内重复: {s['current_batch_duplicate_count']} 条")
    print(f"    与历史重复: {s['historical_duplicate_count']} 条")
    print(f"    歌曲别名待复核: {s['song_alias_needs_review_count']} 条")

    assert s["new_count"] == 2, "第一批应有2条新记录（小李、小孙第一条）"
    assert s["current_batch_duplicate_count"] == 1, "第一批应有1条批次内重复"
    assert s["historical_duplicate_count"] == 0, "第一批不应有历史重复"

    dup = step1["duplicate_breakdown"]["current_batch_duplicates"][0]
    print(f"  [本次重复] 学生: {dup['key']['student']}, 重复源: {dup['duplicate_of'][:8]}...")
    assert dup["key"]["student"] == "小孙"
    print("  ✅ 本次批次内重复正确识别")

    workflow2 = api.create_workflow()
    w2 = workflow2["workflow_id"]
    step1_b = api.workflow_step1(
        w2,
        {
            "operator": "许老师",
            "records": [
                {
                    "lesson_date": "2026-06-08",
                    "teacher": "许老师",
                    "student": "小李",
                    "song_live_name": "致爱丽丝",
                    "song_copyright_name": "Für Elise",
                    "attendance_count": 1,
                    "raw_remark": "和上一批的小李完全一样，属于历史重复",
                },
                {
                    "lesson_date": "2026-06-12",
                    "teacher": "许老师",
                    "student": "小周",
                    "song_live_name": "晴天",
                    "song_copyright_name": "晴天",
                    "attendance_count": 1,
                    "raw_remark": "全新的记录",
                },
            ],
        },
    )

    s2 = step1_b["import_summary"]
    print(f"\n  第二批导入汇总: 输入{s2['total_input']}条 / 创建{s2['total_created']}条")
    print(f"    新记录: {s2['new_count']} 条")
    print(f"    本次批次内重复: {s2['current_batch_duplicate_count']} 条")
    print(f"    与历史重复: {s2['historical_duplicate_count']} 条")

    assert s2["new_count"] == 1, "第二批应有1条新记录（小周）"
    assert s2["historical_duplicate_count"] == 1, "第二批应有1条历史重复（小李）"
    assert s2["current_batch_duplicate_count"] == 0

    hist_dup = step1_b["duplicate_breakdown"]["historical_duplicates"][0]
    print(f"  [历史重复] 学生: {hist_dup['key']['student']}, 与记录 {hist_dup['duplicate_of'][:8]}... 重复")
    assert hist_dup["key"]["student"] == "小李"

    for r in step1_b["records"]:
        print(f"    学生 {r['student']}: 类型={r['duplicate_type_text']}, 状态={r['status_text']}")
    print("  ✅ 每条记录都带有明确的重复类型标记，不靠总数糊过去")
    print("  ✅ C组测试全部通过\n")


def test_d_state_change_trail():
    print("=" * 70)
    print("测试 D: 反查改前内容、改后内容和状态变化")
    print("=" * 70)

    api = APIHandler()
    workflow = api.create_workflow()
    wid = workflow["workflow_id"]

    step1 = api.workflow_step1(
        wid,
        {
            "operator": "许老师",
            "records": [
                {
                    "lesson_date": "2026-06-12",
                    "teacher": "许老师",
                    "student": "小冲",
                    "song_live_name": "《小星星》现场演出版",
                    "song_copyright_name": "小星星（官方版权登记名）",
                    "attendance_count": 3,
                    "raw_remark": "签到：集体课，3个小朋友一起上",
                },
            ],
        },
    )
    rid = step1["records"][0]["record_id"]

    step2 = api.workflow_step2(
        wid,
        {
            "operator": "许老师",
            "ticket_mapping": {
                rid: {
                    "song_name": "小星星",
                    "attendance_count": 2,
                    "remark": "票务：系统登记人数为2人",
                }
            },
        },
    )

    record_before = api.get_record(rid)
    c1 = record_before["conflicts"][0]
    c2 = record_before["conflicts"][1]

    print("  [冲突前状态]")
    print(f"    歌曲: {record_before['song_live_name']}")
    print(f"    人数: {record_before['attendance_count']}")
    print(f"    状态: {record_before['status_text']}")
    print(f"    冲突1: {c1['description']}")
    print(f"    冲突2: {c2['description']}")

    api.resolve_conflict(
        rid,
        {
            "conflict_id": c1["conflict_id"],
            "resolution": "现场演出版确实是这节课的名称，家长和学生都这么称呼，以签到为准",
            "operator": "许老师",
            "use_sign_in_value": True,
        },
    )

    api.resolve_conflict(
        rid,
        {
            "conflict_id": c2["conflict_id"],
            "resolution": "实际到场3人，票务系统少登记了1人（有1人是试听旁听），以签到照片为准",
            "operator": "许老师",
            "use_sign_in_value": True,
        },
    )

    trail = api.get_state_change_trail(rid)
    print(f"\n  [状态变化追踪 - 共 {trail['count']} 步]")
    for step in trail["trail"]:
        print(f"\n  步骤 #{trail['trail'].index(step)+1} - [{step['source_text']}] {step['action_text']}")
        print(f"    操作人: {step['operator']}")
        print(f"    说明: {step['remark'][:80]}...")
        cd = step.get("change_detail", {})
        if cd.get("status_change"):
            print(f"    状态变化: {cd['status_change']}")
        if cd.get("field_changes"):
            for fc in cd["field_changes"]:
                ov = str(fc["old_value"])[:30] if fc["old_value"] is not None else "(空)"
                nv = str(fc["new_value"])[:30] if fc["new_value"] is not None else "(空)"
                field_label = fc.get("field_label", fc.get("field_key", "未知字段"))
                print(f"    字段 {field_label}: '{ov}' -> '{nv}'")

    audit = api.get_audit_trail(rid)
    sign_in_logs = api.get_audit_trail(rid, source="sign_in_photo")
    ticket_logs = api.get_audit_trail(rid, source="ticket_export")
    manual_logs = api.get_audit_trail(rid, source="manual_confirm")

    print(f"\n  [三段来源审计] 总计 {audit['count']} 条:")
    print(f"    课时签到照片来源: {sign_in_logs['count']} 条")
    print(f"    票务导出表补录:   {ticket_logs['count']} 条")
    print(f"    人工确认/处理:     {manual_logs['count']} 条")
    assert sign_in_logs["count"] >= 1
    assert ticket_logs["count"] >= 1
    assert manual_logs["count"] >= 2
    print("  ✅ 三段来源可追溯，不用重新翻聊天记录")

    record_final = api.get_record(rid)
    print(f"\n  [最终状态]")
    print(f"    歌曲: 现场名='{record_final['song_live_name']}' 版权名='{record_final['song_copyright_name']}'")
    print(f"    人数: {record_final['attendance_count']}")
    print(f"    has_song_alias: {record_final['has_song_alias']}")
    print(f"    状态: {record_final['status_text']}")

    assert record_final["has_song_alias"] == True, "别名应仍存在"
    assert record_final["status"] == "pending_review", "别名仍在，应还是待复核"
    print("  ✅ 冲突解决后歌曲别名仍保留待复核，没有提前放行归为已确认")

    print("  ✅ D组测试全部通过\n")


def test_e_consistency_verification():
    print("=" * 70)
    print("测试 E: 展示、接口、导出、明细 一致性")
    print("=" * 70)

    api = APIHandler()
    workflow = api.create_workflow()
    wid = workflow["workflow_id"]

    step1 = api.workflow_step1(
        wid,
        {
            "operator": "许老师",
            "records": [
                {
                    "lesson_date": "2026-06-12",
                    "teacher": "许老师",
                    "student": "小致",
                    "song_live_name": "《献给爱丽丝》学生演奏版",
                    "song_copyright_name": "Für Elise（Bagatelle No. 25 in A minor）",
                    "attendance_count": 1,
                    "raw_remark": "学生今天弹得完整流畅，尤其是中段的情感表达到位，建议下次挑战更快速度。注意左手低音不要盖过右手旋律",
                },
            ],
        },
    )
    rid = step1["records"][0]["record_id"]

    step2 = api.workflow_step2(
        wid,
        {
            "operator": "许老师",
            "ticket_mapping": {
                rid: {
                    "song_name": "献给爱丽丝",
                    "attendance_count": 1,
                    "remark": "票务备注：课时编码#LC20260612，已结算课时费，VIP学员折扣95%",
                    "song_copyright_name": "致爱丽丝（作品WoO 59）",
                }
            },
        },
    )

    page_data = api.get_record(rid)
    list_data = api.list_records()["records"][0]
    export_str = api.export_records_csv([rid])

    print(f"  [页面展示] 状态: {page_data['status']}, has_alias: {page_data['has_song_alias']}")
    print(f"  [接口列表] 状态: {list_data['status']}, has_alias: {list_data['has_song_alias']}")
    print(f"  [冲突数] 页面: {page_data['conflict_count']}, 接口: {list_data['conflict_count']}")

    assert page_data["status"] == list_data["status"]
    assert page_data["has_song_alias"] == list_data["has_song_alias"] == True
    print("  ✅ 页面和接口状态一致")

    assert page_data["song_live_name"] == list_data["song_live_name"]
    assert page_data["song_copyright_name"] == list_data["song_copyright_name"]
    assert page_data["raw_remark"] == list_data["raw_remark"]
    assert page_data["ticket_remark"] == list_data["ticket_remark"]
    print("  ✅ 页面和接口核心字段一致")

    assert page_data["raw_remark"] in export_str
    assert page_data["ticket_remark"] in export_str
    assert "《献给爱丽丝》学生演奏版" in export_str
    assert "Für Elise" in export_str
    print("  ✅ 导出CSV包含页面展示的所有关键内容")

    conflict_ids = [c["conflict_id"] for c in page_data["conflicts"]]
    for cid in conflict_ids:
        api.resolve_conflict(
            rid,
            {
                "conflict_id": cid,
                "resolution": "测试中统一采用签到值",
                "operator": "许老师",
                "use_sign_in_value": True,
            },
        )

    after_conflicts = api.get_record(rid)
    print(f"\n  [票务冲突解决后]")
    print(f"    has_song_alias: {after_conflicts['has_song_alias']}")
    print(f"    状态: {after_conflicts['status_text']}")
    assert after_conflicts["has_song_alias"] == True, "采用签到值后，现场名和版权名仍不同，别名应保留"
    assert after_conflicts["status"] == "pending_review", "别名仍在，应还是待复核，不是已确认"
    print("  ✅ 票务冲突解决后别名仍保留待复核，正确（符合需求：别急着归正常，留给许老师复核）")

    alias_result = api.confirm_song_alias(
        rid,
        {
            "operator": "许老师",
            "confirm_live_name_as_official": False,
            "decision_note": "学生要出国参加比赛，以版权登记的正式外文名称为准归档",
        },
    )
    print(f"\n  [许老师人工确认别名处理]")
    print(f"    决定: {alias_result['decision']}")
    print(f"    最终歌曲名: '{alias_result['final_song_name']}'")

    resolved = api.get_record(rid)
    assert resolved["has_song_alias"] == False
    assert resolved["status"] == "confirmed"
    print("  ✅ 人工确认别名后别名消失，状态变为已确认")

    check_result = api.run_self_check()
    print(f"\n  [自检结果] 通过 {check_result['passed_count']}/{check_result['check_count']}")
    for r in check_result["results"]:
        flag = "✅" if r["passed"] else "❌"
        print(f"    {flag} {r['check_type']}: {r['message']}")
    export_check = [r for r in check_result["results"] if r["check_type"] == "export_consistency"][0]
    assert export_check["passed"], "导出一致性自检失败"
    print("  ✅ 自检中导出一致性通过")

    conflicts_export = api.export_conflicts_csv([rid])
    assert "献给爱丽丝" in conflicts_export, "冲突导出不含冲突内容"
    print("  ✅ 冲突CSV导出内容与页面冲突列表一致")

    self_check_detail = api.run_self_check(rid)
    alias_check = [r for r in self_check_detail["results"] if r["check_type"] == "song_name_alias"][0]
    alias_recs = alias_check["details"]["alias_records"]
    print(f"\n  [歌曲别名自检详情] 检测到 {len(alias_recs)} 条别名记录:")
    for ar in alias_recs:
        print(f"    - {ar['live_name']} / {ar['copyright_name']} -> 状态: {ar['status']}")
        assert ar["status"] != "normal", f"别名记录 {ar['record_id']} 错误地归为normal"
    print("  ✅ 自检正确识别别名记录并阻止其归为normal")
    print("  ✅ E组测试全部通过\n")


def test_f_xiaoxingxing_full_flow():
    print("=" * 70)
    print("测试 F: 小星星样例全链路贯通 - 别名+票务冲突叠加场景")
    print("=" * 70)

    api = APIHandler()
    workflow = api.create_workflow()
    wid = workflow["workflow_id"]

    print("\n【第1步】导入课时签到照片")
    print("  歌曲: 现场名='现场演出版-小星星' 版权名='小星星官方版权名'")
    step1 = api.workflow_step1(
        wid,
        {
            "operator": "许老师",
            "records": [
                {
                    "lesson_date": "2026-06-15",
                    "teacher": "许老师",
                    "student": "小星",
                    "song_live_name": "现场演出版-小星星",
                    "song_copyright_name": "小星星官方版权名",
                    "attendance_count": 1,
                    "raw_remark": "签到备注：学生小星今天演奏小星星，左手和弦配合有进步",
                },
            ],
        },
    )
    rid = step1["records"][0]["record_id"]
    r1 = step1["records"][0]
    print(f"  导入后: 状态={r1['status']}({r1['status_text']}), has_song_alias={r1['has_song_alias']}")
    assert r1["status"] == "pending_review"
    assert r1["has_song_alias"] == True
    print("  ✅ 签到导入后别名已识别，状态为待复核")

    print("\n【第2步】补录票务导出表")
    print("  票务歌曲名='小星星'（与现场名、版权名都不一样，会产生票务冲突）")
    step2 = api.workflow_step2(
        wid,
        {
            "operator": "许老师",
            "ticket_mapping": {
                rid: {
                    "song_name": "小星星",
                    "attendance_count": 1,
                    "remark": "票务备注：2026暑期汇演-小星星节目，已核销1课时",
                }
            },
        },
    )
    r2 = api.get_record(rid)
    print(f"  补录后: 状态={r2['status']}({r2['status_text']})")
    print(f"         冲突数={r2['conflict_count']}, 未解决={r2['unresolved_conflict_count']}")
    print(f"         has_song_alias={r2['has_song_alias']}, 可生成周报={r2['can_generate_weekly_report']}")
    for c in r2["conflicts"]:
        print(f"         - 冲突字段[{c['field_name']}]: 签到='{c['sign_in_value']}' vs 票务='{c['ticket_value']}'")
    assert r2["status"] == "conflict", "票务冲突产生后状态应为 conflict"
    assert r2["unresolved_conflict_count"] >= 1
    assert r2["has_song_alias"] == True
    assert r2["can_generate_weekly_report"] == False
    print("  ✅ 票务冲突正确识别，别名仍保留，暂不可生成周报")

    print("\n【第3步】许老师先确认别名（但票务冲突还未解决！）")
    alias_result = api.confirm_song_alias(
        rid,
        {
            "operator": "许老师",
            "confirm_live_name_as_official": True,
            "decision_note": "家长确认以演出版名称为准，现场名统一为正式名",
        },
    )
    print(f"  别名确认返回:")
    print(f"    状态变化: {alias_result['old_status']} -> {alias_result['new_status']}")
    print(f"    最终歌曲名: '{alias_result['final_song_name']}'")
    print(f"    未解决冲突数: {alias_result['unresolved_conflict_count']}")
    print(f"    可生成周报: {alias_result['can_generate_weekly_report']}")
    print(f"    处理判断: {alias_result['processing_judgment'][:80]}...")
    assert alias_result["new_status"] == "conflict", "别名确认后仍有未解决票务冲突，状态必须保持 conflict!"
    assert alias_result["unresolved_conflict_count"] >= 1
    assert alias_result["can_generate_weekly_report"] == False
    print("  ✅ 别名已确认但状态未放行！因为仍有未解决票务冲突，保持 CONFLICT，不能进周报")

    r3 = api.get_record(rid)
    print(f"\n  别名确认后记录详情:")
    print(f"    歌曲: 现场名='{r3['song_live_name']}' 版权名='{r3['song_copyright_name']}'")
    print(f"    has_song_alias={r3['has_song_alias']}, 状态={r3['status']}")
    print(f"    未解决冲突数={r3['unresolved_conflict_count']}, 可生成周报={r3['can_generate_weekly_report']}")
    print(f"    processing_judgment: {r3['processing_judgment'][:80]}...")
    assert r3["has_song_alias"] == False
    assert r3["status"] == "conflict"
    assert r3["unresolved_conflict_count"] >= 1
    assert r3["can_generate_weekly_report"] == False
    print("  ✅ 别名字段已统一，但冲突仍在，状态仍为 CONFLICT，正确拦截")

    print("\n【第4步】尝试直接生成周报（应该被阻止！）")
    try:
        api.workflow_step3(wid, {"operator": "许老师"})
        print("  ❌ 错误：还有未解决票务冲突，但周报生成竟然通过了！")
        assert False, "未解决冲突时不应允许生成周报"
    except ValueError as e:
        err_msg = str(e)
        print(f"  ✅ 周报生成被正确阻止，错误信息包含冲突详情:")
        for line in err_msg.split("\n")[:5]:
            print(f"     {line[:100]}")
        assert "未解决" in err_msg or "票务冲突" in err_msg

    print("\n【第5步】解决票务冲突（选择采用签到值）")
    conflict_to_resolve = r3["conflicts"][0]
    print(f"  解决冲突字段[{conflict_to_resolve['field_name']}]: 签到='{conflict_to_resolve['sign_in_value']}' vs 票务='{conflict_to_resolve['ticket_value']}'")
    api.resolve_conflict(
        rid,
        {
            "conflict_id": conflict_to_resolve["conflict_id"],
            "resolution": "现场演出版-小星星是该曲的正式演出用名，票务的'小星星'是简称，以签到照片的完整名称为准",
            "operator": "许老师",
            "use_sign_in_value": True,
        },
    )
    r4 = api.get_record(rid)
    print(f"  冲突解决后: 状态={r4['status']}, 未解决={r4['unresolved_conflict_count']}, 可生成周报={r4['can_generate_weekly_report']}")
    assert r4["unresolved_conflict_count"] == 0
    assert r4["status"] == "confirmed"
    assert r4["can_generate_weekly_report"] == True
    print("  ✅ 票务冲突全部解决后，状态变为已确认，可生成周报")

    print("\n【第6步】再次生成周报（这次应该成功！）")
    step3 = api.workflow_step3(wid, {"operator": "许老师"})
    print(f"  周报生成成功: 步骤={step3['step_name']}")
    report = step3["weekly_report"]
    print(f"  周报汇总: 总记录={report['summary']['total_records']}, 已确认={report['summary']['confirmed']}")
    assert report["summary"]["confirmed"] >= 1
    assert report["summary"]["with_song_alias"] == 0
    print("  ✅ 周报生成成功，小星星记录正确纳入")

    print("\n【第7步】导出审计明细 CSV，核对每步字段快照")
    audit_csv = api.export_audit_csv(rid)
    csv_lines = audit_csv.strip().split("\n")
    print(f"  审计CSV行数: {len(csv_lines)} (含表头)")
    print(f"  表头列: {csv_lines[0]}")
    assert "old_value" in csv_lines[0], "审计导出必须有 old_value 列"
    assert "new_value" in csv_lines[0], "审计导出必须有 new_value 列"
    assert "field_label" in csv_lines[0], "审计导出必须有 field_label 列"
    assert "change_reason" in csv_lines[0], "审计导出必须有 change_reason 列"
    assert "processing_result" in csv_lines[0], "审计导出必须有 processing_result 列"
    assert "conflict_reason" in csv_lines[0], "审计导出必须有 conflict_reason 列"

    has_import_sign_in_snapshot = False
    has_import_ticket_snapshot = False
    has_confirm_alias_snapshot = False
    has_resolve_conflict_snapshot = False
    has_generate_report_snapshot = False
    print(f"\n  审计明细快照内容:")
    reader = csv.DictReader(io.StringIO(audit_csv))
    for i, row in enumerate(reader, 1):
        action_text = row.get("action_text", "")
        field_label = row.get("field_label", "")
        old_v = row.get("old_value", "")
        new_v = row.get("new_value", "")
        processing = row.get("processing_result", "")
        print(f"  #{i}: action={action_text[:20]}, field={field_label[:15]}, old={old_v[:20]}, new={new_v[:20]}, result={processing[:30]}")
        if "导入课时签到" in action_text:
            has_import_sign_in_snapshot = True
        if "导入票务导出" in action_text:
            has_import_ticket_snapshot = True
        if "人工确认歌曲别名" in action_text and (old_v or new_v):
            has_confirm_alias_snapshot = True
        if "人工解决冲突" in action_text and (old_v or new_v):
            has_resolve_conflict_snapshot = True
        if "生成店长周报" in action_text:
            has_generate_report_snapshot = True

    assert has_import_sign_in_snapshot, "签到导入步骤快照缺失"
    assert has_import_ticket_snapshot, "票务补录步骤快照缺失"
    assert has_confirm_alias_snapshot, "别名确认步骤字段快照缺失"
    assert has_resolve_conflict_snapshot, "冲突解决步骤字段快照缺失"
    assert has_generate_report_snapshot, "周报生成步骤快照缺失"
    print("  ✅ 审计导出完整覆盖签到/票务/别名确认/冲突解决/周报生成 各步的字段快照")

    print("\n【第8步】导出统一记录CSV，核对新增判断字段")
    records_csv = api.export_records_csv([rid])
    assert "unresolved_conflict_count" in records_csv
    assert "can_generate_weekly_report" in records_csv
    assert "processing_judgment" in records_csv
    assert "latest_action_text" in records_csv
    print("  ✅ 统一导出CSV包含新增判断字段：未解决冲突数、可否生成周报、处理判断、最近操作")

    print("\n【第9步】运行自检确认整体一致")
    check = api.run_self_check(rid)
    print(f"  自检结果: 通过 {check['passed_count']}/{check['check_count']}")
    for r in check["results"]:
        flag = "✅" if r["passed"] else "❌"
        print(f"    {flag} {r['check_type']}: {r['message'][:80]}")
    assert check["passed_count"] == check["check_count"], "自检应全部通过"
    print("  ✅ 全量自检通过")

    print("\n  ✅ F组（小星星别名+票务冲突叠加）全链路测试全部通过！\n")


if __name__ == "__main__":
    test_a_song_alias_not_normalized()
    test_b_remark_not_overwritten()
    test_c_duplicate_classification()
    test_d_state_change_trail()
    test_e_consistency_verification()
    test_f_xiaoxingxing_full_flow()

    print("=" * 70)
    print("🎉 A/B/C/D/E/F 六大组修复验证测试 全部通过！")
    print("=" * 70)
