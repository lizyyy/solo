from models import FieldName, SourceType
from reconciliation_engine import ReconciliationEngine


def run_aning_workflow():
    engine = ReconciliationEngine()
    print("=" * 60)
    print("  流浪动物救助排程对账 · 阿宁的工作流模拟")
    print("=" * 60)
    print()

    # ───── 救助单 CASE-MIX-001 ─────
    print("【第1步】提交主人微信备注（旧版，疫苗日期是旧的）")
    r = engine.submit_rescue_payload(
        case_id="CASE-MIX-001",
        animal_id="ANIMAL-MIX",
        submitter="阿宁",
        field_values={
            FieldName.ANIMAL_NAME: "奶糖",
            FieldName.VACCINE_DATE: "2025-08-01",
            FieldName.APPOINTMENT_TIME: "2026-06-15 10:00",
            FieldName.HEALTH_STATUS: "健康",
        },
        source_type=SourceType.WECHAT_NOTE,
        source_id="wechat-old",
        source_version=1,
    )
    print(f"  ↩ 结果：{r['status']}")
    print()

    print("【第2步】同样内容重复提交（含晚到附件——这是第二次相同请求）")
    r = engine.submit_rescue_payload(
        case_id="CASE-MIX-001",
        animal_id="ANIMAL-MIX",
        submitter="阿宁",
        field_values={
            FieldName.ANIMAL_NAME: "奶糖",
            FieldName.VACCINE_DATE: "2025-08-01",
            FieldName.APPOINTMENT_TIME: "2026-06-15 10:00",
            FieldName.HEALTH_STATUS: "健康",
        },
        source_type=SourceType.WECHAT_NOTE,
        source_id="wechat-old",
        attachment_meta={
            "file_name": "疫苗卡_奶糖.jpg",
            "file_size": 786432,
            "content_hash": "naitang-vacc-old",
        },
    )
    print(f"  ↩ 结果：{r['status']}")
    if r["status"] == "ignored_duplicate":
        print(f"    → 附件状态：重复提交被忽略，晚到附件只登记一次，不会被算成两份")
    print()

    print("【第3步】第三次提交——晚到附件（单独的附件提交）")
    r = engine.submit_rescue_payload(
        case_id="CASE-MIX-001",
        animal_id="ANIMAL-MIX",
        submitter="阿宁",
        field_values={
            FieldName.VACCINE_DATE: "2026-05-15",
            FieldName.DEWORMING_DATE: "2026-04-01",
        },
        source_type=SourceType.ATTACHMENT,
        source_id="attach-new-vaccine",
        attachment_meta={
            "file_name": "最新疫苗卡_奶糖.jpg",
            "file_size": 786432,
            "content_hash": "naitang-vacc-new",
        },
    )
    print(f"  ↩ 结果：{r['status']}，覆盖字段：{r.get('conflict_fields_resolved')}")
    print()

    print("【第4步】主人打电话补充口头备注")
    r = engine.submit_rescue_payload(
        case_id="CASE-MIX-001",
        animal_id="ANIMAL-MIX",
        submitter="阿宁",
        field_values={
            FieldName.REMARKS: "主人说奶糖近期软便，需带益生菌",
        },
        source_type=SourceType.VERBAL_NOTE,
        source_id="verbal-call-001",
    )
    print(f"  ↩ 结果：{r['status']}")
    print()

    # ───── 救助单 CASE-MISSING-002（缺疫苗日期） ─────
    print("【第5步】另一救助单——提交时缺少疫苗日期")
    r = engine.submit_rescue_payload(
        case_id="CASE-MISSING-002",
        animal_id="ANIMAL-MISSING",
        submitter="阿宁",
        field_values={
            FieldName.ANIMAL_NAME: "橘子",
            FieldName.APPOINTMENT_TIME: "2026-06-16 14:30",
            FieldName.HEALTH_STATUS: "流眼泪",
        },
        source_type=SourceType.WECHAT_NOTE,
        source_id="wechat-orange",
    )
    print(f"  ↩ 结果：{r['status']}")
    print()

    # ───── 救助单 CASE-MANUAL-003（有重复导入） ─────
    print("【第6步】第三单——先人工补录了备注")
    r = engine.submit_rescue_payload(
        case_id="CASE-MANUAL-003",
        animal_id="ANIMAL-MANUAL",
        submitter="阿宁",
        field_values={
            FieldName.ANIMAL_NAME: "布丁",
            FieldName.VACCINE_DATE: "2026-01-20",
            FieldName.APPOINTMENT_TIME: "2026-06-17 09:00",
        },
        source_type=SourceType.WECHAT_NOTE,
        source_id="wechat-pudding",
    )
    engine.submit_rescue_payload(
        case_id="CASE-MANUAL-003",
        animal_id="ANIMAL-MANUAL",
        submitter="阿宁",
        field_values={
            FieldName.REMARKS: "【人工】布丁对麻醉过敏，上次疫苗反应大",
            FieldName.OWNER_CONTACT: "13800000001",
        },
        source_type=SourceType.MANUAL_EDIT,
        source_id="manual-edit-pudding",
    )
    print("  ↩ 人工备注已录入")
    print()

    print("【第7步】尝试重复导入布丁的微信内容（想覆盖人工备注）")
    r = engine.submit_rescue_payload(
        case_id="CASE-MANUAL-003",
        animal_id="ANIMAL-MANUAL",
        submitter="阿宁",
        field_values={
            FieldName.ANIMAL_NAME: "布丁",
            FieldName.VACCINE_DATE: "2026-01-20",
            FieldName.APPOINTMENT_TIME: "2026-06-17 09:00",
            FieldName.REMARKS: "来自批量导入的默认备注",
            FieldName.OWNER_CONTACT: "13999999999",
        },
        source_type=SourceType.WECHAT_NOTE,
        source_id="wechat-pudding",
    )
    print(f"  ↩ 结果：{r['status']}，被保护的字段：{r.get('skipped_manual_protected')}")
    print()

    # ───── 多源结论影响追踪展示 ─────
    print("【结论影响链 · CASE-MIX-001 的疫苗日期来源追踪：")
    trace = engine.get_conclusion_trace("CASE-MIX-001", FieldName.VACCINE_DATE)
    for t in trace:
        print(f"  · 来源={t['source_type']} 值={t['value']}  →  {t['origin']}")
    print()

    # ───── 给负责人的异常队列（最关键的输出 ─────
    print()
    print(engine.render_exception_queue_for_communication())
    print()

    # ───── 最终给阿宁自己检查重复提交的附件登记数 ─────
    mix = engine.records["CASE-MIX-001"]
    print(f"[自检] CASE-MIX-001 附件登记数：{len(mix.attachment_digests)} 个（相同附件不重复计数）")
    manual = engine.records["CASE-MANUAL-003"]
    print(f"[自检] CASE-MANUAL-003 人工备注值：{manual.fields[FieldName.REMARKS].value}")
    print(f"[自检] CASE-MANUAL-003 联系方式：{manual.fields[FieldName.OWNER_CONTACT].value}（未被批量导入覆盖）")


if __name__ == "__main__":
    run_aning_workflow()
