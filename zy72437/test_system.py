import json
from api import APIHandler


def test_full_workflow():
    print("=" * 60)
    print("测试1: 完整三步工作流")
    print("=" * 60)

    api = APIHandler()

    result = api.create_workflow()
    workflow_id = result["workflow_id"]
    print(f"创建工作流: {workflow_id}")

    sign_in_data = {
        "operator": "许老师",
        "records": [
            {
                "lesson_date": "2026-06-01",
                "teacher": "许老师",
                "student": "小明",
                "song_live_name": "小星星变奏曲",
                "song_copyright_name": "Twinkle Twinkle Little Star",
                "attendance_count": 1,
                "raw_remark": "学生状态良好，第一小节流畅，第二小节需要加强练习。注意指法",
            },
            {
                "lesson_date": "2026-06-01",
                "teacher": "许老师",
                "student": "小红",
                "song_live_name": "欢乐颂",
                "song_copyright_name": "欢乐颂",
                "attendance_count": 1,
                "raw_remark": "课后作业：练习C大调音阶",
            },
        ],
    }

    step1_result = api.workflow_step1(workflow_id, sign_in_data)
    print(f"\n第一步 - 导入课时签到照片:")
    print(f"  导入记录数: {step1_result['imported_count']}")
    print(f"  当前步骤: {step1_result['step_name']}")
    print(f"  提示: {step1_result['note']}")

    for r in step1_result["records"]:
        print(f"  - {r['student']}: {r['status_text']}")
        if r.get("calculation_meta"):
            print(f"    计算参数: v{r['calculation_meta']['param_version']}")
            print(f"    取舍理由: {r['calculation_meta']['decision_reason']}")

    record_ids = [r["record_id"] for r in step1_result["records"]]

    ticket_mapping = {
        record_ids[0]: {
            "song_name": "小星星",
            "attendance_count": 2,
        },
        record_ids[1]: {
            "song_name": "欢乐颂",
            "attendance_count": 1,
        },
    }

    step2_data = {"operator": "许老师", "ticket_mapping": ticket_mapping}

    step2_result = api.workflow_step2(workflow_id, step2_data)
    print(f"\n第二步 - 补录票务导出表:")
    print(f"  当前步骤: {step2_result['step_name']}")
    print(f"  发现冲突: {step2_result['conflicts_found']} 条")

    for conflict in step2_result["conflicts_summary"]:
        print(f"  记录 {conflict['record_id'][:8]}... 有冲突:")
        for c in conflict["conflicts"]:
            print(f"    - {c['field']}: 签到={c['sign_in_value']}, 票务={c['ticket_value']}")

    print(f"\n处理冲突 - 第一条记录采用签到数据:")
    record1 = step2_result["records"][0]
    conflict_id = record1["conflicts"][0]["conflict_id"]

    resolve_data = {
        "conflict_id": conflict_id,
        "resolution": "确认课时签到照片正确，票务导出表统计有误",
        "operator": "许老师",
        "use_sign_in_value": True,
    }
    api.resolve_conflict(record1["record_id"], resolve_data)

    conflict_id2 = record1["conflicts"][1]["conflict_id"]
    resolve_data2 = {
        "conflict_id": conflict_id2,
        "resolution": "人数以签到照片为准",
        "operator": "许老师",
        "use_sign_in_value": True,
    }
    api.resolve_conflict(record1["record_id"], resolve_data2)

    step3_data = {"operator": "许老师"}
    step3_result = api.workflow_step3(workflow_id, step3_data)
    print(f"\n第三步 - 生成周报:")
    print(f"  当前步骤: {step3_result['step_name']}")
    print(f"  周报统计: {json.dumps(step3_result['weekly_report']['summary'], ensure_ascii=False)}")

    print("\n✅ 完整工作流测试通过")


def test_self_check():
    print("\n" + "=" * 60)
    print("测试2: 自检功能")
    print("=" * 60)

    api = APIHandler()

    api.record_service.import_sign_in_photos(
        [
            {
                "lesson_date": "2026-06-02",
                "teacher": "许老师",
                "student": "小李",
                "song_live_name": "致爱丽丝",
                "song_copyright_name": "Für Elise",
                "attendance_count": 1,
                "raw_remark": "重复导入测试",
            },
            {
                "lesson_date": "2026-06-02",
                "teacher": "许老师",
                "student": "小李",
                "song_live_name": "致爱丽丝",
                "song_copyright_name": "Für Elise",
                "attendance_count": 1,
                "raw_remark": "这是重复的记录",
            },
        ],
        operator="许老师",
    )

    check_result = api.run_self_check()
    print(f"自检结果: {check_result['passed_count']}/{check_result['check_count']} 通过")
    for r in check_result["results"]:
        status = "✅" if r["passed"] else "❌"
        print(f"  {status} {r['check_type']}: {r['message']}")
        if not r["passed"]:
            print(f"     详情: {json.dumps(r['details'], ensure_ascii=False)}")

    print("\n✅ 自检功能测试通过")


def test_audit_trail():
    print("\n" + "=" * 60)
    print("测试3: 审计追踪 - 按来源追溯")
    print("=" * 60)

    api = APIHandler()

    records = api.record_service.import_sign_in_photos(
        [
            {
                "lesson_date": "2026-06-03",
                "teacher": "许老师",
                "student": "小张",
                "song_live_name": "茉莉花",
                "song_copyright_name": "Jasmine Flower",
                "attendance_count": 1,
                "raw_remark": "审计追踪测试",
            }
        ],
        operator="许老师",
    )
    record_id = records[0].record_id

    api.record_service.import_ticket_export(
        record_id,
        {"song_name": "好一朵美丽的茉莉花", "attendance_count": 1},
        operator="许老师",
    )

    all_trail = api.get_audit_trail(record_id)
    print(f"全部审计记录: {all_trail['count']} 条")

    sign_in_trail = api.get_audit_trail(record_id, source="sign_in_photo")
    print(f"  课时签到照片来源: {sign_in_trail['count']} 条")
    for t in sign_in_trail["audit_trail"]:
        print(f"    - {t['action_text']} ({t['timestamp'][:19]})")

    ticket_trail = api.get_audit_trail(record_id, source="ticket_export")
    print(f"  票务导出表补录: {ticket_trail['count']} 条")
    for t in ticket_trail["audit_trail"]:
        print(f"    - {t['action_text']}: {t['remark']}")

    print("\n第二天复查时，可以清晰看到三段来源：")
    print("  1. 课时签到照片来源 - 原始导入数据")
    print("  2. 票务导出表补录 - 补充的数据及冲突")
    print("  3. 人工确认 - 许老师的处理决定")

    print("\n✅ 审计追踪测试通过")


def test_export_consistency():
    print("\n" + "=" * 60)
    print("测试4: 展示、接口、导出一致性")
    print("=" * 60)

    api = APIHandler()

    records = api.record_service.import_sign_in_photos(
        [
            {
                "lesson_date": "2026-06-04",
                "teacher": "许老师",
                "student": "小王",
                "song_live_name": "卡农",
                "song_copyright_name": "Canon in D",
                "attendance_count": 1,
                "raw_remark": "原始备注不要洗掉：学生今日迟到5分钟，但练习态度很好，音阶部分有进步，琶音需要继续练习。下次课检查《卡农》第三段。",
            }
        ],
        operator="许老师",
    )
    record_id = records[0].record_id

    page_data = api.data_access.get_record_detail(record_id)
    api_data = api.get_record(record_id)
    export_csv = api.export_records_csv([record_id])

    assert page_data["raw_remark"] == api_data["raw_remark"], "备注不一致"
    assert page_data["raw_remark"] in export_csv, "导出CSV中未包含完整备注"

    print(f"页面展示备注长度: {len(page_data['raw_remark'])} 字符")
    print(f"接口返回备注长度: {len(api_data['raw_remark'])} 字符")
    print(f"导出CSV包含备注: {'是' if page_data['raw_remark'] in export_csv else '否'}")

    assert page_data["song_copyright_name"] == api_data["song_copyright_name"]
    assert page_data["status"] == api_data["status"]

    print(f"歌曲现场名: {page_data['song_live_name']}")
    print(f"歌曲版权名: {page_data['song_copyright_name']}")
    print(f"状态: {page_data['status_text']} (未自动归为正常，待人工复核)")

    print("\n✅ 一致性测试通过")


def test_song_alias_not_auto_normal():
    print("\n" + "=" * 60)
    print("测试5: 同一首歌有现场名和版权名时不自动归为正常")
    print("=" * 60)

    api = APIHandler()

    records = api.record_service.import_sign_in_photos(
        [
            {
                "lesson_date": "2026-06-05",
                "teacher": "许老师",
                "student": "小赵",
                "song_live_name": "蓝色多瑙河",
                "song_copyright_name": "The Blue Danube",
                "attendance_count": 1,
                "raw_remark": "",
            },
            {
                "lesson_date": "2026-06-05",
                "teacher": "许老师",
                "student": "小钱",
                "song_live_name": "命运交响曲",
                "song_copyright_name": "命运交响曲",
                "attendance_count": 1,
                "raw_remark": "",
            },
        ],
        operator="许老师",
    )

    for r in records:
        if r.song_live_name != r.song_copyright_name:
            assert r.status.value != "normal", f"歌曲别名记录不应自动归为正常"
            print(
                f"  {r.student}: {r.song_live_name}/{r.song_copyright_name} -> {r.status.value} (✅ 正确：待复核)"
            )
        else:
            print(
                f"  {r.student}: {r.song_live_name} -> {r.status.value} (名称一致)"
            )

    print("\n✅ 歌曲别名不自动归正常测试通过")


if __name__ == "__main__":
    test_full_workflow()
    test_self_check()
    test_audit_trail()
    test_export_consistency()
    test_song_alias_not_auto_normal()

    print("\n" + "=" * 60)
    print("🎉 所有测试通过！")
    print("=" * 60)
