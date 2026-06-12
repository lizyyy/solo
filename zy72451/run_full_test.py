#!/usr/bin/env python3
"""真实复核完整链路测试脚本：导入→补录→重跑→生成报告"""
import sys
import json
from pathlib import Path

from bus_night_gap.models import ConstructionNotice, RampRecord, Role
from bus_night_gap.store import store
from bus_night_gap.scoring import calculate_score
from bus_night_gap.suggestions import generate_suggestion, update_workflow_after_supplement

from bus_night_gap.models import WorkflowState, RecordStatus


SEP = "=" * 70
print(SEP)
print("🚌 公交夜班覆盖缺口 - 真实复核完整链路")
print(SEP)

print("\n【步骤1】导入施工告示（带周姐的原始备注）")
print("-" * 50)
notice = ConstructionNotice(
    id="real-case-001",
    road_name="幸福路夜班公交12号线交叉口",
    construction_type="人行道及无障碍坡道改造",
    start_date="2026-06-01",
    end_date="2026-06-30",
    notes="夜班公交站改造",
    raw_notes=(
        "周姐备注：这个点是夜班12号线必经站，晚上11点半还有人下晚班，"
        "李叔和张阿姨都是坐轮椅的，天天在这坐车。上次李叔说站台东侧的坡道太陡，"
        "只有80公分宽，轮椅不好过，还容易摔跤。西侧没坡道，拎东西的老人只能绕路，"
        "晚上视线不好特别危险。施工队说临时通道会留，但我得盯紧，别把无障碍道堵了。"
        "还有，新增坡道的事要打报告审批，别忘了。"
    ),
    source="manual_import",
)
store.add_notice(notice)
wf = WorkflowState(
    notice_id=notice.id,
    step=0,
    step_description="施工告示已导入，开始复核",
    status=RecordStatus.PENDING_REVIEW,
    current_assignee=Role.COMMUNITY_SECRETARY,
    history=[{"step": 0, "action": "import_notice", "by": Role.SYSTEM.value}],
)
store.set_workflow(wf)
calculate_score(notice.id)
generate_suggestion(notice.id)
print(f"✅ 已导入: {notice.road_name}")
print(f"   原始备注保留: {len(notice.raw_notes)}字")
sugg_v1 = store.get_latest_suggestion(notice.id)
print(f"   整改建议v{sugg_v1.version}状态: {sugg_v1.status.value}")
print(f"   还缺什么材料({len(sugg_v1.missing_materials)}项):")
for m in sugg_v1.missing_materials:
    print(f"     ☐ {m}")


print("\n【步骤2】周姐补录第一条坡道记录（站台东侧）")
print("-" * 50)
ramp_east = RampRecord(
    id="rr-east-001",
    notice_id=notice.id,
    location="夜班公交12号线站台东侧",
    has_ramp=True,
    ramp_condition="fair",
    width_cm=None,
    notes="东侧坡道存在",
    raw_notes=(
        "周姐补记：东侧确实有坡道，但我用卷尺量了，宽度只有80公分，不符合90公分的标准。"
        "坡道表面有些破损，推轮椅经过时颠簸得厉害，状况fair。李叔上次差点就在这摔了。"
        "晚上路灯有点暗，视线不好的时候根本看不清坡道边缘。"
    ),
    recorded_by=Role.COMMUNITY_SECRETARY,
    is_supplement=True,
)
store.add_ramp_record(ramp_east)
calculate_score(notice.id)
update_workflow_after_supplement(notice.id)
generate_suggestion(notice.id)
print(f"✅ 已补录: {ramp_east.location}")
print(f"   录入人: 社区书记周姐")
print(f"   备注分析: 提到宽度80、破损、视线")
sugg_v2 = store.get_latest_suggestion(notice.id)
sc_v1, sc_v2 = store.get_all_scores(notice.id)[-2:]
diff = sc_v2.score - sc_v1.score
print(f"   评分变化: {sc_v1.score:.1f} → {sc_v2.score:.1f} ({diff:+.1f}分)")
unchanged = abs(diff) < 0.001
if unchanged:
    print(f"   ⚠️  评分未变化！已自动转交交通协管复核")
print(f"   整改建议v{sugg_v2.version}还缺什么材料({len(sugg_v2.missing_materials)}项):")
for m in sugg_v2.missing_materials:
    print(f"     ☐ {m}")
print(f"   新增vs上次缺材料:")
added_m = [m for m in sugg_v2.missing_materials if m not in sugg_v1.missing_materials]
removed_m = [m for m in sugg_v1.missing_materials if m not in sugg_v2.missing_materials]
for m in added_m:
    print(f"     + 新增: {m}")
for m in removed_m:
    print(f"     - 移除: {m}")


print("\n【步骤3】周姐补录第二条坡道记录（站台西侧）")
print("-" * 50)
ramp_west = RampRecord(
    id="rr-west-002",
    notice_id=notice.id,
    location="夜班公交12号线站台西侧",
    has_ramp=False,
    ramp_condition=None,
    width_cm=None,
    notes="西侧无坡道",
    raw_notes=(
        "周姐补记：西侧完全没有坡道，老人拎菜只能从马路牙子上往下搬，"
        "晚上视线差特别不安全。张阿姨说上次就是因为没坡道，绕了半条街，"
        "差点没赶上末班车。这里必须新增一个坡道，施工方案要尽快打报告。"
        "轮椅用户完全无法从西侧上下，这个缺口很大。"
    ),
    recorded_by=Role.COMMUNITY_SECRETARY,
    is_supplement=True,
)
store.add_ramp_record(ramp_west)
calculate_score(notice.id)
update_workflow_after_supplement(notice.id)
generate_suggestion(notice.id)
print(f"✅ 已补录: {ramp_west.location}")
print(f"   录入人: 社区书记周姐")
sugg_v3 = store.get_latest_suggestion(notice.id)
scores = store.get_all_scores(notice.id)
sc_v3 = scores[-1]
diff2 = sc_v3.score - scores[-2].score
print(f"   评分变化: {scores[-2].score:.1f} → {sc_v3.score:.1f} ({diff2:+.1f}分)")
print(f"   整改建议v{sugg_v3.version}还缺什么材料({len(sugg_v3.missing_materials)}项):")
for m in sugg_v3.missing_materials:
    print(f"     ☐ {m}")


print("\n【步骤4】交通协管复核+补充完整数据")
print("-" * 50)
ramp_correction = RampRecord(
    id="rr-east-correction",
    notice_id=notice.id,
    location="夜班公交12号线站台东侧(复核修正)",
    has_ramp=True,
    ramp_condition="poor",
    width_cm=80,
    notes="交通协管正式复核数据",
    raw_notes=(
        "交通协管复核：东侧坡道宽度实测80cm，确实未达标（标准90cm）。"
        "状况评估为poor，因为表面有3处破损，坡度超过1:12的标准值。"
        "照片备注已上传系统。夜班时段路灯亮度不足，需要额外的反光标识。"
        "建议施工时一并拓宽至100cm，表面重做防滑处理。"
    ),
    recorded_by=Role.TRAFFIC_COORDINATOR,
    is_supplement=True,
)
store.add_ramp_record(ramp_correction)
calculate_score(notice.id)
generate_suggestion(notice.id)

wf4 = store.get_workflow(notice.id)
wf4.status = RecordStatus.READY_FOR_COORDINATOR
wf4.step_description = "交通协管复核完成，数据已补充"
wf4.step += 1
wf4.history.append({
    "step": wf4.step,
    "action": "traffic_coordinator_review",
    "by": Role.TRAFFIC_COORDINATOR.value,
})
store.set_workflow(wf4)
generate_suggestion(notice.id)
print(f"✅ 交通协管已复核并补充: {ramp_correction.location}")
print(f"   宽度正式填入: 80cm (未达标)")
print(f"   状况正式评估: poor")
sugg_v4 = store.get_latest_suggestion(notice.id)
sc_v4 = store.get_latest_score(notice.id)
diff3 = sc_v4.score - sc_v3.score
print(f"   评分变化: {sc_v3.score:.1f} → {sc_v4.score:.1f} ({diff3:+.1f}分)")
print(f"   整改建议v{sugg_v4.version}还缺什么材料({len(sugg_v4.missing_materials)}项):")
for m in sugg_v4.missing_materials:
    print(f"     ☐ {m}")


print("\n【步骤5】重跑生成最终整改建议")
print("-" * 50)
wf5 = store.get_workflow(notice.id)
wf5.status = RecordStatus.RESOLVED
wf5.step_description = "最终报告已生成，复核流程完成"
wf5.step += 1
wf5.history.append({"step": wf5.step, "action": "final_report"})
store.set_workflow(wf5)

final_score, _ = calculate_score(notice.id)
final_sugg = generate_suggestion(notice.id)
print(f"✅ 最终评分: {final_score.score:.1f}/{final_score.max_score}分")
print(f"✅ 整改建议v{final_sugg.version}状态: {final_sugg.status.value}")
print(f"✅ 最终还缺什么材料({len(final_sugg.missing_materials)}项):")
for m in final_sugg.missing_materials:
    print(f"     ☐ {m}")
print(f"✅ 下一步: {final_sugg.next_action_person}")


print("\n【步骤6】生成完整真实复核报告")
print("-" * 50)
output_file = Path("data/final_report.json")
output_file.parent.mkdir(exist_ok=True)

from bus_night_gap.suggestions import _analyze_notes_for_missing as analyze

all_suggs = store.get_all_suggestions(notice.id)
all_scores_list = store.get_all_scores(notice.id)
all_ramps = store.get_ramp_records_for_notice(notice.id)
all_audits = store.get_audit_logs(entity_id=notice.id)

audit_review = []
for l in all_audits:
    entry = {
        "序号": len(audit_review) + 1,
        "时间": l.changed_at.strftime("%H:%M:%S"),
        "谁": l.changed_by.value,
        "做了什么": f"{l.action} {l.entity_type}",
        "为什么改": l.reason,
        "影响结果": [],
    }
    if hasattr(l, "score_before") and l.score_before is not None:
        d = (l.score_after or l.score_before) - l.score_before
        cn = "⚠️ 未变化(需复核)" if abs(d) < 0.001 else f"{d:+.1f}分"
        entry["影响结果"].append(f"评分 {l.score_before:.1f}→{l.score_after:.1f} ({cn})")
    if hasattr(l, "missing_materials_after") and (l.missing_materials_before or l.missing_materials_after):
        b = "、".join(l.missing_materials_before) if l.missing_materials_before else "空"
        a = "、".join(l.missing_materials_after) if l.missing_materials_after else "空"
        if b != a:
            entry["影响结果"].append(f"还缺什么材料: [{b}]→[{a}]")
    if hasattr(l, "status_after") and l.status_before and l.status_after and l.status_before != l.status_after:
        entry["影响结果"].append(f"状态: {l.status_before.value}→{l.status_after.value}")
    if hasattr(l, "affected_results") and l.affected_results:
        for r in l.affected_results:
            if r != "暂无直接影响":
                entry["影响结果"].append(r)
    audit_review.append(entry)

report = {
    "报告标题": "公交夜班覆盖缺口 - 无障碍坡道真实复核报告",
    "生成时间": final_sugg.generated_at.isoformat(),
    "一、基本信息": {
        "路段": notice.road_name,
        "施工类型": notice.construction_type,
        "工期": f"{notice.start_date} ~ {notice.end_date}",
        "当前步骤": f"{wf5.step} - {wf5.step_description}",
        "当前状态": wf5.status.value,
        "最终评分": f"{final_score.score:.1f}/{final_score.max_score}",
    },
    "二、施工告示原始备注(未清洗)": notice.raw_notes,
    "三、无障碍坡道记录(含备注及处理依据)": [
        {
            "位置": r.location,
            "有无坡道": "有" if r.has_ramp else "无",
            "正式状况评估": r.ramp_condition or "未填",
            "正式宽度(cm)": r.width_cm or "未填",
            "录入人": r.recorded_by.value,
            "补录标记": "是" if r.is_supplement else "否",
            "原始备注(未清洗)": r.raw_notes or "(无)",
            "从备注中分析出的关键发现": analyze(r.raw_notes)["key_findings"] if r.raw_notes else [],
            "备注处理逻辑说明": analyze(r.raw_notes)["processing_explanations"] if r.raw_notes else [],
            "备注推断缺材料": analyze(r.raw_notes)["inferred_missing"] if r.raw_notes else [],
        }
        for r in all_ramps
    ],
    "四、还缺什么材料变更追踪": [
        {
            "版本": f"v{s.version}",
            "状态": s.status.value,
            "缺材料清单": s.missing_materials if s.missing_materials else ["(无)"],
            "为什么被留下": s.why_kept,
            "下一步找谁": s.next_action_person,
        }
        for s in all_suggs
    ],
    "五、评分演变": [
        {
            "版本": f"v{s.version}",
            "分数": f"{s.score:.1f}",
            "评分因子明细": s.factors,
            "相对上次变化": ("0.0 (⚠️ 未变化,需复核)" if (
                i > 0 and abs(s.score - all_scores_list[i-1].score) < 0.001
            ) else (f"{s.score - all_scores_list[i-1].score:+.1f}" if i > 0 else "初始值"))
        }
        for i, s in enumerate(all_scores_list)
    ],
    "六、真实复核审计-谁改了什么影响什么": audit_review,
    "七、最终整改建议": {
        "版本": f"v{final_sugg.version}",
        "为什么这条被留下": final_sugg.why_kept,
        "还缺什么材料(含处理依据)": final_sugg.missing_materials,
        "下一步找谁": final_sugg.next_action_person,
        "下一步具体做什么": final_sugg.next_action.value,
        "全部保留的原始备注材料": final_sugg.notes,
    },
}

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

print(f"✅ 报告已生成: {output_file.resolve()}")
print(f"   共包含 7 个章节:")
for k in report.keys():
    if k.startswith("报告") or k.startswith("生成"):
        continue
    print(f"     • {k}")

print("\n" + SEP)
print("📋  复核链路总结")
print(SEP)
print(f"  数据持久化位置: data/store.json")
print(f"  最终报告位置: {output_file.resolve()}")
print(f"  整改建议版本数: {len(all_suggs)}")
print(f"  评分版本数: {len(all_scores_list)}")
print(f"  坡道记录数: {len(all_ramps)}")
print(f"  审计日志数: {len(all_audits)}")
print(f"  最终状态: {wf5.status.value}")
print(f"  最终评分: {final_score.score:.1f}分")
print(SEP)
print("✅ 完整链路已走通：导入→补录→复核→重跑→报告")
print(SEP)
