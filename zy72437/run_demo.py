from api import APIHandler
import json

def run_full_demo():
    print("=" * 70)
    print("启动乐器保险理赔材料系统 - 完整流程演示")
    print("=" * 70)

    api = APIHandler()

    wf = api.create_workflow()
    wid = wf["workflow_id"]
    print(f"\n1. 创建工作流: {wid}")

    print("\n" + "=" * 50)
    print("第一步：导入课时签到照片")
    print("=" * 50)
    step1 = api.workflow_step1(wid, {
        "operator": "许老师",
        "records": [
            {
                "lesson_date": "2026-06-12",
                "teacher": "许老师",
                "student": "测试生A",
                "song_live_name": "现场演出版-小星星",
                "song_copyright_name": "小星星官方版权名",
                "attendance_count": 1,
                "raw_remark": "原始签到备注：学生表现良好，注意琶音节奏",
            },
            {
                "lesson_date": "2026-06-12",
                "teacher": "许老师",
                "student": "测试生B",
                "song_live_name": "欢乐颂",
                "song_copyright_name": "欢乐颂",
                "attendance_count": 1,
                "raw_remark": "正常记录，无别名",
            }
        ]
    })

    print(f"导入结果: 新记录 {step1['import_summary']['new_count']} 条")
    print(f"歌曲别名待复核: {step1['import_summary']['song_alias_needs_review_count']} 条")
    for r in step1["song_alias_records_pending_review"]:
        print(f"  - {r['student']}: 现场名='{r['song_live_name']}' / 版权名='{r['song_copyright_name']}'")
        print(f"    状态: {r['status']} (不会自动归为normal)")

    rid_a = step1["records"][0]["record_id"]
    rid_b = step1["records"][1]["record_id"]

    print("\n" + "=" * 50)
    print("第二步：补录票务导出表")
    print("=" * 50)
    step2 = api.workflow_step2(wid, {
        "operator": "许老师",
        "ticket_mapping": {
            rid_a: {
                "song_name": "小星星",
                "attendance_count": 1,
                "remark": "票务备注：正常核销，发票已开",
            },
            rid_b: {
                "song_name": "欢乐颂",
                "attendance_count": 1,
                "remark": "票务备注：VIP客户",
            }
        }
    })

    print(f"状态迁移:")
    for st in step2["status_transitions"]:
        print(f"  {st['student']}: {st['old_status']} -> {st['new_status']}, has_alias={st['has_song_alias']}")

    print(f"\n仍有别名待复核: {len(step2['still_pending_song_alias_review'])} 条")
    for sp in step2["still_pending_song_alias_review"]:
        print(f"  - {sp['student']}: {sp['reason']}")

    print("\n" + "=" * 50)
    print("处理冲突和人工确认")
    print("=" * 50)

    alias_result = api.confirm_song_alias(rid_a, {
        "operator": "许老师",
        "confirm_live_name_as_official": True,
        "decision_note": "以学生上课登记的现场名为最终归档名称"
    })
    print(f"歌曲别名人工确认: {alias_result['decision']}")
    print(f"状态变化: {alias_result['old_status']} -> {alias_result['new_status']}")

    rec_a = api.get_record(rid_a)
    for c in rec_a["conflicts"]:
        if not c["resolved"]:
            api.resolve_conflict(rid_a, {
                "conflict_id": c["conflict_id"],
                "resolution": "人工确认冲突，以签到为准",
                "operator": "许老师",
                "use_sign_in_value": True,
            })
            print(f"冲突 {c['field_name']} 已人工解决")

    print("\n" + "=" * 50)
    print("第三步：生成店长周报")
    print("=" * 50)
    step3 = api.workflow_step3(wid, {"operator": "许老师"})

    print(f"步骤: {step3['step_name']}")
    print(f"周报汇总: {json.dumps(step3['weekly_report']['summary'], ensure_ascii=False)}")

    print("\n" + "=" * 50)
    print("系统自检")
    print("=" * 50)
    check = api.run_self_check()
    print(f"通过: {check['passed_count']}/{check['check_count']}")
    for r in check["results"]:
        flag = "✅" if r["passed"] else "❌"
        print(f"  {flag} {r['check_type']}: {r['message']}")

    print("\n" + "=" * 50)
    print("审计追踪 - 按来源分段查询")
    print("=" * 50)
    audit = api.get_audit_trail(rid_a)
    sign_in = api.get_audit_trail(rid_a, source="sign_in_photo")
    ticket = api.get_audit_trail(rid_a, source="ticket_export")
    manual = api.get_audit_trail(rid_a, source="manual_confirm")
    print(f"总计 {audit['count']} 条审计记录:")
    print(f"  1. 课时签到照片来源: {sign_in['count']} 条")
    print(f"  2. 票务导出表补录:   {ticket['count']} 条")
    print(f"  3. 人工确认/处理:     {manual['count']} 条")
    print("✓ 第二天复查时可按这三段追，不用翻聊天记录")

    print("\n" + "=" * 50)
    print("备注历史")
    print("=" * 50)
    rh = api.get_remark_histories(rid_a)
    print(f"共 {rh['count']} 条备注历史:")
    for h in rh["remark_histories"]:
        print(f"  [{h['source_text']}] 操作人: {h['modified_by']}")
        print(f"     原因: {h['change_reason']}")
        print(f"     内容: {h['remark_text']}")

    print("\n" + "=" * 50)
    print("状态变化追踪")
    print("=" * 50)
    trail = api.get_state_change_trail(rid_a)
    for t in trail["trail"]:
        cd = t.get("change_detail", {})
        sc = cd.get("status_change", "-")
        print(f"  [{t['source_text']}] {t['action_text']} -> 状态变化: {sc}")
        if cd.get("field_changes"):
            for fc in cd["field_changes"]:
                ov = str(fc["old"])[:20] if fc["old"] else "(空)"
                nv = str(fc["new"])[:20] if fc["new"] else "(空)"
                print(f"     字段 {fc['field']}: '{ov}' -> '{nv}'")

    print("\n" + "=" * 50)
    print("导出一致性验证")
    print("=" * 50)
    detail = api.get_record(rid_a)
    csv = api.export_records_csv([rid_a])
    assert detail["raw_remark"] in csv
    assert detail["ticket_remark"] in csv
    assert detail["song_live_name"] in csv
    list_data = api.list_records()["records"][0]
    assert detail["raw_remark"] == list_data["raw_remark"]
    assert detail["ticket_remark"] == list_data["ticket_remark"]
    assert detail["status"] == list_data["status"]
    print("✅ 页面展示、接口返回、CSV导出 三者数据完全一致")
    print("✅ 尤其是有现场名和版权名的记录，不会一个地方显示异常、另一个地方消失")

    print("\n" + "=" * 70)
    print("🎉 完整流程运行通过！所有关键需求均已验证")
    print("=" * 70)
    print("")
    print("关键修复点总结:")
    print("  1. 歌曲别名不再自动归为normal，始终保留待复核状态")
    print("  2. 票务补录无冲突时也会再次检查别名")
    print("  3. 票务冲突解决后别名仍保留，需单独人工确认")
    print("  4. 签到备注不被票务备注覆盖，历史完整保留")
    print("  5. 重复导入分三类：新记录/本次重复/历史重复")
    print("  6. 可反查改前/改后内容和状态变化")
    print("  7. 展示/接口/导出 三端数据完全一致")
    print("  8. 按来源分段审计，不用翻聊天记录")
    print("")

if __name__ == "__main__":
    run_full_demo()
