import click
import json
from datetime import datetime
from .models import ConstructionNotice, RampRecord, Role, RecordStatus
from .store import store
from .scoring import calculate_score, check_score_changed
from .suggestions import generate_suggestion, update_workflow_after_supplement
from .demo_data import load_demo_data, demo_step2_supplement_ramp, demo_step3_manual_correction, demo_step4_rerun


def _print_separator():
    click.echo("=" * 70)


def _print_header(text):
    _print_separator()
    click.echo(f"  {text}")
    _print_separator()


@click.group()
def cli():
    """公交夜班覆盖缺口 - 无障碍坡道复核系统"""
    pass


@cli.command()
@click.option("--full", is_flag=True, help="运行完整演示流程")
def demo(full):
    """加载演示数据并展示完整流程"""
    _print_header("加载演示数据 - 公交夜班覆盖缺口")

    notice_id = load_demo_data()
    click.echo(f"✅ 施工告示已导入，ID: {notice_id}")

    notice = store.get_notice(notice_id)
    click.echo(f"   路段: {notice.road_name}")
    click.echo(f"   施工类型: {notice.construction_type}")
    click.echo(f"   原始备注（保留）: {notice.raw_notes[:80]}...")

    _show_status(notice_id)

    if not full:
        click.echo()
        click.echo("💡 使用 --full 参数运行完整演示流程")
        click.echo("   或逐步运行: bus-night-gap demo-step2 | demo-step3 | demo-step4")
        return

    click.echo()
    click.echo("⏭️  进入步骤2：社区书记周姐补看无障碍坡道记录")
    demo_step2_supplement_ramp(notice_id)
    _show_status(notice_id)

    click.echo()
    click.echo("⏭️  进入步骤3：交通协管人工修正，补充完整信息")
    demo_step3_manual_correction(notice_id)
    _show_status(notice_id)

    click.echo()
    click.echo("⏭️  进入步骤4：重跑生成最终报告")
    demo_step4_rerun(notice_id)
    _show_status(notice_id)

    click.echo()
    _print_header("演示流程完成！")
    click.echo("📋 完整审计日志:")
    _show_audit_logs(notice_id)


@cli.command()
def demo_step2():
    """演示步骤2：社区书记周姐补看无障碍坡道记录"""
    notice_id = _ensure_demo_loaded()
    demo_step2_supplement_ramp(notice_id)
    _show_status(notice_id)


@cli.command()
def demo_step3():
    """演示步骤3：交通协管人工修正"""
    notice_id = _ensure_demo_loaded()
    demo_step3_manual_correction(notice_id)
    _show_status(notice_id)


@cli.command()
def demo_step4():
    """演示步骤4：重跑生成最终报告"""
    notice_id = _ensure_demo_loaded()
    demo_step4_rerun(notice_id)
    _show_status(notice_id)


def _ensure_demo_loaded():
    if not store.list_notices():
        return load_demo_data()
    return store.list_notices()[0].id


@cli.command()
@click.argument("notice_id", required=False)
def status(notice_id):
    """查看当前状态和整改建议"""
    if not notice_id:
        notices = store.list_notices()
        if not notices:
            click.echo("暂无数据，请先运行 bus-night-gap demo 加载演示数据")
            return
        notice_id = notices[0].id

    _show_status(notice_id)


def _show_status(notice_id: str):
    notice = store.get_notice(notice_id)
    if not notice:
        click.echo(f"未找到告示 {notice_id}")
        return

    workflow = store.get_workflow(notice_id)
    latest_score = store.get_latest_score(notice_id)
    suggestion = store.get_latest_suggestion(notice_id)
    all_scores = store.get_all_scores(notice_id)
    ramp_records = store.get_ramp_records_for_notice(notice_id)

    _print_header(f"状态概览 - {notice.road_name}")

    if workflow:
        status_color = "yellow"
        if workflow.status == RecordStatus.SCORE_UNCHANGED:
            status_color = "red"
        elif workflow.status == RecordStatus.RESOLVED:
            status_color = "green"
        click.echo(f"📍 当前步骤: {workflow.step} - {workflow.step_description}")
        click.echo(f"📊 状态: {click.style(workflow.status.value, fg=status_color)}")
        if workflow.current_assignee:
            click.echo(f"👤 当前负责人: {workflow.current_assignee.value}")

    click.echo()
    click.echo(f"📝 施工告示信息:")
    click.echo(f"   路段: {notice.road_name}")
    click.echo(f"   类型: {notice.construction_type}")
    click.echo(f"   工期: {notice.start_date} ~ {notice.end_date}")

    if notice.raw_notes:
        click.echo(f"   💬 原始备注（未清洗）: ")
        click.echo(f"      {notice.raw_notes}")

    click.echo()
    click.echo(f"♿ 坡道记录 ({len(ramp_records)} 条):")
    for r in ramp_records:
        supplement_tag = " [补录]" if r.is_supplement else ""
        status_str = "✅ 有坡道" if r.has_ramp else "❌ 无坡道"
        click.echo(f"   • {r.location}{supplement_tag} - {status_str}")
        if r.ramp_condition:
            click.echo(f"     状况: {r.ramp_condition}, 宽度: {r.width_cm}cm")
        if r.raw_notes:
            click.echo(f"     💬 原始备注: {r.raw_notes}")
        click.echo(f"     录入人: {r.recorded_by.value}, 时间: {r.recorded_at.strftime('%H:%M:%S')}")

    click.echo()
    click.echo(f"🎯 评分历史 ({len(all_scores)} 个版本):")
    for idx, s in enumerate(all_scores):
        marker = " →" if idx == len(all_scores) - 1 else "   "
        click.echo(f"{marker} 版本{s.version}: {s.score:.1f}/{s.max_score}分")
        if idx > 0:
            prev = all_scores[idx - 1]
            diff = s.score - prev.score
            if abs(diff) < 0.001:
                click.echo(f"      ⚠️  {click.style('评分未变化', fg='red')} - 需交通协管复核")
            else:
                click.echo(f"      变化: {diff:+.1f}分")

    if suggestion:
        click.echo()
        _print_header("📋 整改建议")
        click.echo(f"版本: {suggestion.version} | 状态: {suggestion.status.value}")
        click.echo()
        click.echo(f"❓ 为什么这条被留下:")
        click.echo(f"   {suggestion.why_kept}")
        click.echo()
        if suggestion.missing_materials:
            click.echo(f"📦 还缺什么材料:")
            for m in suggestion.missing_materials:
                click.echo(f"   ☐ {m}")
            click.echo()
        click.echo(f"📞 下一步该找谁:")
        click.echo(f"   👉 {suggestion.next_action_person} ({suggestion.next_action.value})")
        if suggestion.notes:
            click.echo()
            click.echo(f"📝 保留的原始备注材料:")
            for line in suggestion.notes.split("\n"):
                click.echo(f"   {line}")


@cli.command()
@click.argument("notice_id", required=False)
@click.option("--entity-type", help="过滤实体类型")
def audit(notice_id, entity_type):
    """查看审计日志（谁改了什么、为什么改）"""
    if not notice_id:
        notices = store.list_notices()
        if not notices:
            click.echo("暂无数据")
            return
        notice_id = notices[0].id

    _show_audit_logs(notice_id, entity_type)


def _show_audit_logs(notice_id: str, entity_type=None):
    from .store import EnhancedAuditLog
    ramp_ids = [r.id for r in store.get_ramp_records_for_notice(notice_id)]
    sugg_ids = [s.id for s in store.get_all_suggestions(notice_id)]
    all_related_ids = set()
    all_related_ids.add(notice_id)
    all_related_ids.update(ramp_ids)
    all_related_ids.update(sugg_ids)
    logs = [l for l in store.audit_logs if l.entity_id in all_related_ids]
    logs = sorted(logs, key=lambda x: x.changed_at)
    if entity_type:
        logs = [l for l in logs if l.entity_type == entity_type]

    _print_header(f"真实复核审计日志 - {notice_id}")
    click.echo("格式：[时间] 谁 做了什么 → 改完影响哪些结果")
    click.echo()
    for i, log in enumerate(logs, 1):
        time_str = log.changed_at.strftime("%H:%M:%S")
        click.echo(f"{i:02d}. [{time_str}] 👤 {click.style(log.changed_by.value, fg='blue', bold=True)} "
                   f"{click.style(log.action, fg='green')} {log.entity_type}")
        if log.reason:
            click.echo(f"    📌 为什么改: {click.style(log.reason, fg='yellow')}")

        has_score = hasattr(log, 'score_before') and log.score_before is not None
        has_status = hasattr(log, 'status_before') and log.status_before is not None
        has_missing = hasattr(log, 'missing_materials_before') and log.missing_materials_before is not None
        has_affected = hasattr(log, 'affected_results') and log.affected_results

        if has_score or has_status or has_missing or has_affected:
            click.echo("    🎯 改完影响了哪些结果:")
        if has_score:
            diff = ""
            if log.score_after is not None:
                d = log.score_after - log.score_before
                diff_str = f"({d:+.1f}分)" if abs(d) > 0.001 else "(⚠️ 未变化，需复核)"
                diff = f" → {log.score_after:.1f} {diff_str}"
            click.echo(f"       • 评分: {log.score_before:.1f}{diff}")
        if has_status:
            status_diff = ""
            if log.status_after and log.status_before != log.status_after:
                status_diff = f" → {log.status_after.value}"
            click.echo(f"       • 状态: {log.status_before.value if log.status_before else ''}{status_diff}")
        if has_missing and (log.missing_materials_before or log.missing_materials_after):
            before = "、".join(log.missing_materials_before) if log.missing_materials_before else "(空)"
            after = "、".join(log.missing_materials_after) if log.missing_materials_after else "(空)"
            click.echo(f"       • 还缺什么材料: [{before}] → [{after}]")
        if has_affected:
            for r in log.affected_results:
                if r != "暂无直接影响":
                    click.echo(f"       • {r}")

        if log.old_value or log.new_value:
            if log.old_value:
                old_keys = [k for k in log.old_value.keys()][:3]
                click.echo(f"    📋 变更字段: {', '.join(old_keys)}...")
        click.echo()


@cli.command(name="list")
def list_notices():
    """列出所有施工告示"""
    notices = store.list_notices()
    if not notices:
        click.echo("暂无数据，请先运行 bus-night-gap demo 加载演示数据")
        return

    _print_header("施工告示列表")
    for n in notices:
        workflow = store.get_workflow(n.id)
        status = workflow.status.value if workflow else "unknown"
        click.echo(f"• {n.id} | {n.road_name} | {status}")


@cli.command()
@click.option("--road", required=True, help="路段名称")
@click.option("--type", "ctype", required=True, help="施工类型")
@click.option("--start", required=True, help="开始日期")
@click.option("--end", required=True, help="结束日期")
@click.option("--raw-notes", default="", help="原始备注（不要清洗）")
def import_notice(road, ctype, start, end, raw_notes):
    """导入施工告示"""
    notice = ConstructionNotice(
        road_name=road,
        construction_type=ctype,
        start_date=start,
        end_date=end,
        notes=raw_notes[:50] + "..." if len(raw_notes) > 50 else raw_notes,
        raw_notes=raw_notes,
    )
    store.add_notice(notice)
    calculate_score(notice.id)
    generate_suggestion(notice.id)

    click.echo(f"✅ 已导入施工告示: {notice.id}")
    _show_status(notice.id)


@cli.command()
@click.argument("notice_id")
@click.option("--location", required=True, help="坡道位置")
@click.option("--has-ramp/--no-ramp", default=True, help="是否有坡道")
@click.option("--condition", help="坡道状况 (good/fair/poor)")
@click.option("--width", type=int, help="宽度（厘米）")
@click.option("--raw-notes", default="", help="原始备注（保留）")
@click.option("--by", "by_role", default="community_secretary",
              type=click.Choice(["community_secretary", "traffic_coordinator"]),
              help="录入人角色")
def supplement(notice_id, location, has_ramp, condition, width, raw_notes, by_role):
    """补录无障碍坡道记录"""
    record = RampRecord(
        notice_id=notice_id,
        location=location,
        has_ramp=has_ramp,
        ramp_condition=condition,
        width_cm=width,
        notes=raw_notes[:50] + "..." if len(raw_notes) > 50 else raw_notes,
        raw_notes=raw_notes,
        recorded_by=Role(by_role),
        is_supplement=True,
    )
    store.add_ramp_record(record)
    calculate_score(notice_id)
    update_workflow_after_supplement(notice_id)
    generate_suggestion(notice_id)

    click.echo(f"✅ 已补录坡道记录: {record.id}")

    score_changed, latest, previous = check_score_changed(notice_id)
    if not score_changed and latest and previous:
        click.echo()
        click.echo(click.style("⚠️  重要：补录后评分没有变化！", fg="red", bold=True))
        click.echo(f"   补录前: {previous.score:.1f}分")
        click.echo(f"   补录后: {latest.score:.1f}分")
        click.echo("   已标记为待交通协管复核，不会自动归为正常")

    _show_status(notice_id)


@cli.command()
@click.argument("notice_id")
def rerun(notice_id):
    """重跑评分和整改建议"""
    calculate_score(notice_id)
    suggestion = generate_suggestion(notice_id)
    click.echo(f"✅ 已重跑，生成整改建议版本 {suggestion.version}")
    _show_status(notice_id)


@cli.command()
@click.argument("notice_id", required=False)
@click.option("--output", "-o", help="输出文件路径")
def report(notice_id, output):
    """生成真实复核报告（含谁改了什么、影响哪些结果、还缺什么材料）"""
    if not notice_id:
        notices = store.list_notices()
        if not notices:
            click.echo("暂无数据")
            return
        notice_id = notices[0].id

    notice = store.get_notice(notice_id)
    workflow = store.get_workflow(notice_id)
    suggestion = store.get_latest_suggestion(notice_id)
    all_suggestions = store.get_all_suggestions(notice_id)
    all_scores = store.get_all_scores(notice_id)
    ramp_records = store.get_ramp_records_for_notice(notice_id)
    ramp_ids = [r.id for r in ramp_records]
    sugg_ids = [s.id for s in all_suggestions]
    all_related_ids = set([notice_id]) | set(ramp_ids) | set(sugg_ids)
    audit_logs = sorted(
        [l for l in store.audit_logs if l.entity_id in all_related_ids],
        key=lambda x: x.changed_at
    )

    audit_review = []
    for l in audit_logs:
        entry = {
            "time": l.changed_at.isoformat(),
            "who": l.changed_by.value,
            "action": l.action,
            "entity": l.entity_type,
            "why": l.reason,
            "impact": [],
        }
        if hasattr(l, 'score_before') and l.score_before is not None:
            d = (l.score_after or l.score_before) - l.score_before
            change_note = "未变化（需复核）" if abs(d) < 0.001 else f"{d:+.1f}分"
            entry["impact"].append(f"评分: {l.score_before:.1f} → {l.score_after:.1f} ({change_note})")
        if hasattr(l, 'status_after') and l.status_before is not None and l.status_after is not None and l.status_before != l.status_after:
            entry["impact"].append(f"状态: {l.status_before.value} → {l.status_after.value}")
        if hasattr(l, 'missing_materials_before') and (l.missing_materials_before or l.missing_materials_after):
            b = "、".join(l.missing_materials_before) if l.missing_materials_before else "空"
            a = "、".join(l.missing_materials_after) if l.missing_materials_after else "空"
            if b != a:
                entry["impact"].append(f"还缺什么材料: [{b}] → [{a}]")
        if hasattr(l, 'affected_results') and l.affected_results:
            for r in l.affected_results:
                if r != "暂无直接影响":
                    entry["impact"].append(r)
        audit_review.append(entry)

    material_tracking = []
    for i, s in enumerate(all_suggestions):
        material_tracking.append({
            "suggestion_version": s.version,
            "status": s.status.value,
            "missing_materials": s.missing_materials,
            "why_kept_at_this_stage": s.why_kept,
            "next_person": s.next_action_person,
            "generated_at": s.generated_at.isoformat(),
        })

    from .suggestions import _analyze_notes_for_missing as analyze

    notes_analysis = []
    if notice.raw_notes:
        analysis = analyze(notice.raw_notes)
        notes_analysis.append({
            "source": "施工告示",
            "raw_notes": notice.raw_notes,
            "key_findings": analysis["key_findings"],
            "inferred_missing": analysis["inferred_missing"],
            "processing_logic": analysis["processing_explanations"],
        })
    ramp_records_report = []
    for r in ramp_records:
        record_entry = {
            "id": r.id,
            "location": r.location,
            "has_ramp": r.has_ramp,
            "ramp_condition": r.ramp_condition,
            "width_cm": r.width_cm,
            "raw_notes_preserved": r.raw_notes,
            "recorded_by": r.recorded_by.value,
            "is_supplement": r.is_supplement,
            "recorded_at": r.recorded_at.isoformat(),
        }
        if r.raw_notes:
            r_analysis = analyze(r.raw_notes)
            record_entry["notes_analysis"] = {
                "key_findings": r_analysis["key_findings"],
                "why_treated_this_way": r_analysis["processing_explanations"],
                "materials_inferred_from_notes": r_analysis["inferred_missing"],
            }
            notes_analysis.append({
                "source": f"坡道记录[{r.location}]",
                "raw_notes": r.raw_notes,
                "key_findings": r_analysis["key_findings"],
                "inferred_missing": r_analysis["inferred_missing"],
                "processing_logic": r_analysis["processing_explanations"],
                "recorded_by": r.recorded_by.value,
                "is_supplement": r.is_supplement,
            })
        else:
            record_entry["notes_analysis"] = "（无备注）"
        ramp_records_report.append(record_entry)

    score_changes_summary = []
    for idx in range(1, len(all_scores)):
        prev, curr = all_scores[idx - 1], all_scores[idx]
        diff = curr.score - prev.score
        score_changes_summary.append({
            "from_version": prev.version,
            "to_version": curr.version,
            "score_from": prev.score,
            "score_to": curr.score,
            "difference": diff,
            "is_unchanged": abs(diff) < 0.001,
            "ramp_records_used": curr.ramp_records_used,
        })

    report_data = {
        "report_title": "公交夜班覆盖缺口 - 无障碍坡道真实复核报告",
        "generated_at": datetime.now().isoformat(),
        "section_1_basic_info": {
            "notice": {
                "id": notice.id,
                "road_name": notice.road_name,
                "construction_type": notice.construction_type,
                "start_date": notice.start_date,
                "end_date": notice.end_date,
                "raw_notes_preserved": notice.raw_notes,
            },
            "workflow_current": {
                "step": workflow.step if workflow else 0,
                "step_description": workflow.step_description if workflow else "",
                "status": workflow.status.value if workflow else "unknown",
                "current_assignee": workflow.current_assignee.value if workflow and workflow.current_assignee else "",
            } if workflow else None,
        },
        "section_2_ramp_records_with_notes": ramp_records_report,
        "section_3_material_tracking": material_tracking,
        "section_4_score_evolution": {
            "latest_score": all_scores[-1].score if all_scores else 0,
            "changes": score_changes_summary,
        },
        "section_5_audit_review": {
            "summary": f"共 {len(audit_review)} 条变更记录",
            "detailed_logs": audit_review,
        },
        "section_6_final_suggestion": {
            "version": suggestion.version if suggestion else 0,
            "why_kept": suggestion.why_kept if suggestion else "",
            "still_missing_materials_with_reasons": [
                {
                    "material": m,
                    "in_report_notes": (lambda s=suggestion: s.notes if s else "")(),
                }
                for m in (suggestion.missing_materials if suggestion else [])
            ],
            "next_action_person": suggestion.next_action_person if suggestion else "",
            "next_action": suggestion.next_action.value if suggestion else "",
            "preserved_raw_notes": suggestion.notes if suggestion else "",
        },
        "section_7_notes_processing_explanations": notes_analysis,
    }

    report_str = json.dumps(report_data, ensure_ascii=False, indent=2)

    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(report_str)
        click.echo(f"✅ 真实复核报告已保存到: {output}")
        click.echo(f"   报告包含7个章节：基本信息、坡道记录备注、材料追踪、评分演变、审计复核、最终建议、备注处理说明")
        click.echo()
        _print_report_summary(report_data)
    else:
        _print_header("真实复核报告摘要")
        _print_report_summary(report_data)
        click.echo()
        click.echo("💡 使用 -o <路径> 保存完整JSON报告（包含全部7个章节）")


def _print_report_summary(r: dict):
    info = r["section_1_basic_info"]
    click.echo(f"路段: {info['notice']['road_name']}")
    click.echo(f"当前步骤: {info['workflow_current']['step']} - {info['workflow_current']['step_description']}")
    click.echo(f"当前状态: {info['workflow_current']['status']}")
    click.echo()

    mats = r["section_3_material_tracking"]
    click.echo(f"📦 还缺什么材料追踪（共 {len(mats)} 个整改建议版本）:")
    for m in mats:
        miss = "、".join(m["missing_materials"]) if m["missing_materials"] else "（无）"
        click.echo(f"  v{m['suggestion_version']} [{m['status']}] → 缺: {miss}")
    click.echo()

    audit = r["section_5_audit_review"]["detailed_logs"]
    click.echo(f"📋 真实复核 - 谁改了什么、影响哪些结果（共 {len(audit)} 条）:")
    for entry in audit:
        impact = "；".join(entry["impact"]) if entry["impact"] else "（无直接影响）"
        click.echo(f"  • [{entry['time'][11:19]}] {entry['who']} {entry['action']}")
        if entry["why"]:
            click.echo(f"      为什么改: {entry['why']}")
        if entry["impact"]:
            click.echo(f"      影响: {impact}")
    click.echo()

    final = r["section_6_final_suggestion"]
    click.echo(f"🎯 最终整改建议 (v{final['version']}):")
    click.echo(f"  为什么留下: {final['why_kept'][:120]}...")
    miss_list = [f"☐ {x['material']}" for x in final["still_missing_materials_with_reasons"]]
    if miss_list:
        click.echo(f"  还缺什么材料: {' '.join(miss_list)}")
    click.echo(f"  下一步找谁: 👉 {final['next_action_person']}")


@cli.command()
def reset():
    """清空所有数据（开始新的复核）"""
    if click.confirm("确定要清空所有数据吗？此操作不可撤销。"):
        store.clear()
        click.echo("✅ 已清空所有数据，可开始新的复核流程")


@cli.command()
def dashboard():
    """启动小看板（HTML界面）"""
    from .dashboard import run_dashboard
    run_dashboard()


if __name__ == "__main__":
    cli()
