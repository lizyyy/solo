import os
import sys
from datetime import datetime

from models import (
    PartStatus, AlarmStatus, AttributionStatus, STATUS_EXPORT_MAPPING
)
from service import PipelineAnomalyService

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pipeline_anomaly.db")


def _print_section(title):
    bar = "=" * 80
    print(f"\n{bar}\n  {title}\n{bar}")


def _print_sub(title):
    bar = "-" * 60
    print(f"\n{bar}\n  >>> {title}\n{bar}")


def step1_seed_data(service: PipelineAnomalyService):
    _print_section("【第1步】初始化备件清单（留正常记录+异常分支样本）")

    print("\n—— 添加一条【完全正常】的备件（用于留底，对比异常分支是否走通）")
    p_normal = service.add_spare_part(
        part_no="SP-2026-0001", part_name="球阀",
        part_model="Q41F-16P", expected_model="Q41F-16P",
        quantity=2, pipeline_id="PL-A01", status=PartStatus.NORMAL
    )
    print(f"  ✓ 正常备件：{p_normal.part_no} / {p_normal.part_name} / 型号={p_normal.part_model} / 状态={p_normal.status.value}")

    print("\n—— 添加一条【型号替换】的备件（走异常分支：型号不一致→待确认，不能直接当正常放过）")
    p_replace = service.add_spare_part(
        part_no="SP-2026-0002", part_name="截止阀",
        part_model="J41W-25P", expected_model="J41W-16P",
        quantity=1, pipeline_id="PL-A02", status=PartStatus.NORMAL
    )
    print(f"  ⚠ 型号替换备件：{p_replace.part_no} / 实际={p_replace.part_model} / 期望={p_replace.expected_model}")

    print("\n—— 添加一条【状态异常】的备件（走异常分支：缺失）")
    p_missing = service.add_spare_part(
        part_no="SP-2026-0003", part_name="压力表",
        part_model="Y-100", expected_model="Y-100",
        quantity=0, pipeline_id="PL-A03", status=PartStatus.MISSING
    )
    print(f"  ✗ 缺失备件：{p_missing.part_no} / {p_missing.part_name} / 状态={p_missing.status.value}")

    print("\n—— 备件清单汇总：")
    for p in service.get_all_parts():
        print(f"    - {p.part_no} | {p.part_name} | {p.part_model} vs {p.expected_model} | qty={p.quantity} | {p.status.value}")
    return p_normal, p_replace, p_missing


def step2_create_alarms_and_notes(service: PipelineAnomalyService, p_normal, p_replace, p_missing):
    _print_section("【第2步】创建报警与人工备注，故意留一组不匹配用于验证归因")

    a_normal = service.add_alarm(
        pipeline_id="PL-A01", alarm_type="压力波动",
        alarm_desc="PL-A01段压力短时升高后恢复", related_part_no=p_normal.part_no
    )
    print(f"  ✓ 正常报警：{a_normal.alarm_no} / {a_normal.alarm_desc}")

    a_replace = service.add_alarm(
        pipeline_id="PL-A02", alarm_type="阀门内漏",
        alarm_desc="截止阀疑似内漏", related_part_no=p_replace.part_no
    )
    print(f"  ⚠ 型号替换报警：{a_replace.alarm_no} / {a_replace.alarm_desc}")

    a_missing = service.add_alarm(
        pipeline_id="PL-A03", alarm_type="仪表无读数",
        alarm_desc="压力表无任何读数", related_part_no=p_missing.part_no
    )
    print(f"  ✗ 缺失报警：{a_missing.alarm_no} / {a_missing.alarm_desc}")

    n_normal = service.add_manual_note(
        pipeline_id="PL-A01",
        content="现场检查正常，压力波动为工艺调整，阀门及备件均无误",
        operator="老唐",
        related_alarm_no=a_normal.alarm_no,
        related_part_no=p_normal.part_no
    )
    print(f"  ✓ 正常备注：{n_normal.note_no} / {n_normal.content[:30]}...")

    n_replace = service.add_manual_note(
        pipeline_id="PL-A02",
        content="库房暂无J41W-16P，临时用J41W-25P替代，压力等级更高应无问题，但需确认",
        operator="老唐",
        related_alarm_no=a_replace.alarm_no,
        related_part_no=p_replace.part_no
    )
    print(f"  ⚠ 型号替换备注：{n_replace.note_no} / {n_replace.content[:30]}...")

    n_mismatch = service.add_manual_note(
        pipeline_id="PL-A99",
        content="这条备注故意关联到错的管线号，用于验证关联不匹配分支",
        operator="老唐",
        related_alarm_no=a_missing.alarm_no,
        related_part_no=p_missing.part_no
    )
    print(f"  ✗ 不匹配备注：{n_mismatch.note_no} / 管线={n_mismatch.pipeline_id}(应为PL-A03)")

    return (a_normal, a_replace, a_missing), (n_normal, n_replace, n_mismatch)


def step3_run_attribution(service: PipelineAnomalyService, parts, alarms, notes):
    _print_section("【第3步】安全员老唐执行『工厂管线异常归因』主流程")

    p_normal, p_replace, p_missing = parts
    a_normal, a_replace, a_missing = alarms
    n_normal, n_replace, n_mismatch = notes

    print(f"\n—— 3.1 正常分支：{p_normal.part_no} + 对应报警 + 对应备注（三者一致，型号匹配）")
    attr_normal = service.run_attribution_main(
        part_no=p_normal.part_no, operator="老唐",
        alarm_no=a_normal.alarm_no, note_no=n_normal.note_no,
        attribution_reason="工艺调整引起，设备与备件均正常"
    )
    print(f"    归因编号：{attr_normal.attr_no}")
    print(f"    最终状态：【{attr_normal.status.value}】")
    print(f"    归因原因：{attr_normal.attribution_reason}")
    assert attr_normal.status == AttributionStatus.NORMAL, "正常分支应该得到 NORMAL 状态"
    print("    ✓ PASS：主流程正常分支走通，备件清单里留有正常记录")

    print(f"\n—— 3.2 型号替换分支：{p_replace.part_no} + 对应报警 + 对应备注")
    print(f"    实际型号={p_replace.part_model}，期望={p_replace.expected_model}")
    attr_replace = service.run_attribution_main(
        part_no=p_replace.part_no, operator="老唐",
        alarm_no=a_replace.alarm_no, note_no=n_replace.note_no
    )
    print(f"    归因编号：{attr_replace.attr_no}")
    print(f"    最终状态：【{attr_replace.status.value}】")
    print(f"    是否型号替换：{attr_replace.is_model_replace}")
    print(f"    待确认理由：{attr_replace.pending_reason}")
    print(f"    受影响记录：{attr_replace.affected_records}")
    assert attr_replace.status == AttributionStatus.PENDING_CONFIRM, "型号替换必须留待确认，不能直接当正常放过"
    assert attr_replace.is_model_replace == True
    assert attr_replace.pending_reason, "型号替换必须有明确的待确认理由"
    assert attr_replace.affected_records, "型号替换必须列出受影响记录"
    print("    ✓ PASS：型号替换未被立即当成正常结果，待确认理由与受影响记录均已单列")

    print(f"\n—— 3.3 关联不匹配分支：{p_missing.part_no} + 报警 + 备注(管线号故意写错)")
    attr_mismatch = service.run_attribution_main(
        part_no=p_missing.part_no, operator="老唐",
        alarm_no=a_missing.alarm_no, note_no=n_mismatch.note_no
    )
    print(f"    归因编号：{attr_mismatch.attr_no}")
    print(f"    最终状态：【{attr_mismatch.status.value}】")
    print(f"    待确认理由：{attr_mismatch.pending_reason}")
    print(f"    受影响记录：{attr_mismatch.affected_records}")
    assert attr_mismatch.status == AttributionStatus.PENDING_CONFIRM
    print("    ✓ PASS：报警与人工备注对不上的关系被留存，状态为待确认")

    return attr_normal, attr_replace, attr_mismatch


def step4_model_replace_pending_list(service: PipelineAnomalyService):
    _print_section("【第4步】查询『型号替换待确认』清单（单独列理由+受影响记录）")

    pending = service.list_model_replace_pending()
    print(f"\n共 {len(pending)} 条型号替换待确认记录：")
    for idx, p in enumerate(pending, 1):
        print(f"\n  [{idx}] 归因编号={p['attr_no']}")
        print(f"      备件：{p['part_no']} / {p['part_name']}")
        print(f"      型号差异：实际={p['part_model']}  期望={p['expected_model']}")
        print(f"      待确认理由：{p['pending_reason']}")
        print(f"      受影响记录：{p['affected_records']}")
        print(f"      处理人：{p['operator']}")
    assert len(pending) >= 1, "至少有1条型号替换待确认"
    print("\n  ✓ PASS：型号替换待确认清单能单独列出待确认理由与受影响记录")


def step5_confirm_statuses(service, attrs):
    _print_section("【第5步】月底复核：把归因分流到 已确认 / 待补件 / 退回")

    attr_normal, attr_replace, attr_mismatch = attrs

    print(f"\n—— 5.1 正常记录确认 → 转为【已确认】")
    confirmed = service.confirm_attribution(
        attr_no=attr_normal.attr_no, operator="老唐",
        final_status=AttributionStatus.CONFIRMED,
        confirm_reason="月底复核：工艺调整确认无误，归档为已确认"
    )
    print(f"    {confirmed.attr_no} → {confirmed.status.value}")

    print(f"\n—— 5.2 型号替换 → 缺原厂件待采，标记为【待补件】")
    pending_part = service.confirm_attribution(
        attr_no=attr_replace.attr_no, operator="老唐",
        final_status=AttributionStatus.PENDING_PART,
        confirm_reason="月底复核：替换型号满足功能，但原厂型号缺货待补"
    )
    print(f"    {pending_part.attr_no} → {pending_part.status.value}")

    print(f"\n—— 5.3 关联不匹配+缺失 → 信息不完整，退回补录，标记【退回】")
    returned = service.confirm_attribution(
        attr_no=attr_mismatch.attr_no, operator="老唐",
        final_status=AttributionStatus.RETURNED,
        confirm_reason="月底复核：备注管线号填写错误+备件缺失，退回现场重新核查补录"
    )
    print(f"    {returned.attr_no} → {returned.status.value}")


def step6_monthly_review(service):
    _print_section("【第6步】月底复核视图：已确认 / 待补件 / 退回 三类分离")

    review = service.monthly_review()
    keys = list(review.keys())
    print(f"\n复核分组：{keys}")

    for grp in ["已确认", "待补件", "退回"]:
        items = review.get(grp, [])
        print(f"\n  【{grp}】共 {len(items)} 条：")
        for d in items:
            print(f"    - {d.attr_no} | 管线={d.pipeline_id} | 备件={d.part_no} | 原因={d.attribution_reason[:40]}")

    assert len(review.get("已确认", [])) >= 1
    assert len(review.get("待补件", [])) >= 1
    assert len(review.get("退回", [])) >= 1
    print("\n  ✓ PASS：月底复核三类记录清晰分离")


def step7_check_status_consistency(service):
    _print_section("【第7步】运营主管从接口查明细 vs 导出异常队列 —— 状态一致性检查")

    _print_sub("接口查询明细（query_attribution_details）")
    details = service.query_attribution_details()
    for d in details:
        print(f"  {d['attr_no']} | 接口状态={d['status']} | 导出映射={d['status_for_export']}")

    _print_sub("导出异常队列（export_anomaly_queue）")
    queue = service.export_anomaly_queue()
    for q in queue:
        print(f"  {q['归因编号']} | 队列状态={q['状态']} | 原因={q['归因原因'][:30]}")

    ok, errors = service.verify_status_consistency()
    if errors:
        print("\n状态一致性错误：")
        for e in errors:
            print(f"  ✗ {e}")
    else:
        print("\n  ✓ PASS：接口查询状态与导出异常队列完全一致")
    assert ok, "状态一致性校验失败"


def step8_restart_persistence(service):
    _print_section("【第8步】模拟重启：历史备注不丢，当前状态与异常队列能互相印证")

    print(f"\n—— 关闭当前 service 实例，重新 new 一个（模拟进程重启）")
    del service
    service2 = PipelineAnomalyService()

    _print_sub("重启后：备件清单还在吗？")
    parts = service2.get_all_parts()
    assert len(parts) >= 3, "重启后备件丢失！"
    for p in parts:
        print(f"  ✓ {p.part_no} | {p.part_name} | {p.status.value}")

    _print_sub("重启后：人工备注还在吗？（重点验证历史备注不丢）")
    from database import ManualNoteRepo
    all_pipeline_notes = ManualNoteRepo.list_all()
    assert len(all_pipeline_notes) >= 3, "重启后人工备注丢失！"
    for n in all_pipeline_notes:
        print(f"  ✓ 备注={n.note_no} | 管线={n.pipeline_id} | 人={n.operator} | 内容={n.content[:30]}")

    _print_sub("重启后：归因状态与异常队列互相印证")
    ok, errors = service2.verify_restart_persistence()
    if errors:
        print("\n持久化印证错误：")
        for e in errors:
            print(f"  ✗ {e}")
    else:
        print("\n  ✓ PASS：归因主表 ↔ 归因明细 ↔ 导出队列 三方一致")
    assert ok

    _print_sub("重启后：月底复核分类依然正确")
    review2 = service2.monthly_review()
    for grp in ["已确认", "待补件", "退回"]:
        cnt = len(review2.get(grp, []))
        assert cnt >= 1, f"重启后 {grp} 分类记录丢失！"
        print(f"  ✓ 【{grp}】：{cnt} 条")

    return service2


def step9_handover_end_to_end(service):
    _print_section("【第9步】接班流程端到端：安全员老唐从备件清单追到异常队列，讲清结果")

    print("""
    ┌──────────────────────────────────────────────────────────────────────┐
    │  接班场景：老唐把班交给下一位安全员老李，老李按流程追问每一条归因结果   │
    └──────────────────────────────────────────────────────────────────────┘
    """)

    _print_sub("老李：先看备件清单，有哪几条？")
    parts = service.get_all_parts()
    for p in parts:
        print(f"  老唐：{p.part_no} {p.part_name}，型号{p.part_model}（期望{p.expected_model}），状态{p.status.value}")

    _print_sub("老李：对应报警呢？")
    alarms = service.get_all_alarms()
    for a in alarms:
        print(f"  老唐：报警{a.alarm_no} {a.alarm_type} / {a.alarm_desc[:30]} / 备件{a.related_part_no}")

    _print_sub("老李：归因结果跟异常队列对得上吗？逐条说。")
    details = service.query_attribution_details()
    queue = service.export_anomaly_queue()
    for d in details:
        qr = next((q for q in queue if q["归因编号"] == d["attr_no"]), None)
        assert qr, f"{d['attr_no']} 在异常队列里不存在！"
        assert qr["状态"] == d["status_for_export"], f"{d['attr_no']} 状态不一致！"

        print(f"\n  老唐讲 {d['attr_no']}：")
        print(f"    管线={d['pipeline_id']}  状态={d['status']}（导出队列显示={qr['状态']}）")
        print(f"    备件={d['part_no']}  实际型号={d['part_model']}  期望={d['expected_model']}")
        print(f"    报警={d['alarm_no']} {d['alarm_desc'][:30]}")
        if d['note_no']:
            print(f"    备注={d['note_no']} 由[{d['note_operator']}]记录：{d['note_content'][:40]}")
        print(f"    归因：{d['attribution_reason']}")
        if d['pending_reason']:
            print(f"    待确认：{d['pending_reason']}  影响：{d['affected_records']}")

    print("\n  ✓ PASS：老唐按接班流程从备件清单追到异常队列，每一条归因都讲清了来龙去脉")


def main():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print(f"已清理旧数据库：{DB_PATH}")

    service = PipelineAnomalyService()

    start = datetime.now()
    print(f"\n{'*'*80}")
    print(f"  工厂管线异常归因系统 —— 全流程验证启动")
    print(f"  启动时间：{start.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'*'*80}")

    parts = step1_seed_data(service)
    alarms, notes = step2_create_alarms_and_notes(service, *parts)
    attrs = step3_run_attribution(service, parts, alarms, notes)
    step4_model_replace_pending_list(service)
    step5_confirm_statuses(service, attrs)
    step6_monthly_review(service)
    step7_check_status_consistency(service)
    service2 = step8_restart_persistence(service)
    step9_handover_end_to_end(service2)

    end = datetime.now()
    print(f"\n{'*'*80}")
    print(f"  ✅ 全流程验证通过！用时 {(end-start).total_seconds():.2f}s")
    print(f"  ✅ 数据库文件位于：{DB_PATH}（可随时重启，数据不丢失）")
    print(f"{'*'*80}\n")


if __name__ == "__main__":
    main()
