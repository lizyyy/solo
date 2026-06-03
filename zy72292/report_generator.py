from typing import Dict, Any
from models import PathPlayback, IssueStatus, NextAction


class ReportGenerator:
    @staticmethod
    def generate_playback_report(playback: PathPlayback) -> str:
        report = []
        report.append("=" * 60)
        report.append("大型会展摊位视线图 - 路径回放报告")
        report.append("=" * 60)
        report.append(f"项目名称: {playback.project_name}")
        report.append(f"回放ID: {playback.playback_id}")
        report.append(f"生成时间: {playback.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")

        report.append("━" * 60)
        report.append("【第一步】楼层剖面草图导入")
        report.append("━" * 60)
        if playback.sketch:
            report.append(f"  草图名称: {playback.sketch.name}")
            report.append(f"  导入时间: {playback.sketch.import_time.strftime('%Y-%m-%d %H:%M:%S')}")
            report.append(f"  导入人: {playback.sketch.importer}")
            report.append(f"  楼层: 第 {playback.sketch.floor_number} 层")
            report.append(f"  Z轴方向: {playback.sketch.z_axis_direction}")
            report.append(f"  摊位数量: {len(playback.sketch.stall_coordinates)}")
        else:
            report.append("  ⚠️  尚未导入楼层剖面草图")
        report.append("")

        report.append("━" * 60)
        report.append("【第二步】点云抽稀日志补录")
        report.append("━" * 60)
        if playback.point_cloud_logs:
            for i, log in enumerate(playback.point_cloud_logs, 1):
                report.append(f"  ▶ 日志 {i}: {log.action}")
                report.append(f"     时间: {log.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                report.append(f"     操作人: {log.operator}")
                report.append(f"     抽稀比例: {log.thinning_ratio * 100:.1f}%")
                if log.notes:
                    report.append(f"     备注: {log.notes}")
                report.append("")
        else:
            report.append("  ⏳ 航测内业小魏补看点云抽稀日志中...")
        report.append("")

        report.append("━" * 60)
        report.append("【第三步】问题与复核记录")
        report.append("━" * 60)
        if playback.issues:
            for issue in playback.issues:
                status_icon = "🔴" if issue.status == IssueStatus.PENDING else "🟡" if issue.status == IssueStatus.CONFIRMED else "🟢"
                report.append(f"  {status_icon} {issue.issue_id} - {issue.type}")
                report.append(f"     状态: {issue.status.value}")
                report.append(f"     发现人: {issue.discovered_by}")
                report.append(f"     发现时间: {issue.discovered_at.strftime('%Y-%m-%d %H:%M:%S')}")
                report.append(f"     描述: {issue.description}")
                report.append("")
                report.append(f"     📌 为什么这条被留下:")
                report.append(f"        {issue.why_kept}")
                report.append("")
                report.append(f"     📋 还缺什么材料:")
                if issue.missing_materials:
                    for mat in issue.missing_materials:
                        report.append(f"        ☐ {mat}")
                else:
                    report.append("        ✓ 材料齐全")
                report.append("")
                report.append(f"     🚩 下一步: {issue.next_action.value}")
                report.append("")
        else:
            report.append("  ✓ 无待处理问题")
        report.append("")

        report.append("━" * 60)
        report.append("【修改追踪】谁改了什么、为什么改")
        report.append("━" * 60)
        if playback.corrections:
            for corr in playback.corrections:
                report.append(f"  ✏️  {corr.correction_id}")
                report.append(f"     时间: {corr.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                report.append(f"     修改人: {corr.operator}")
                report.append(f"     修改字段: {corr.field_name}")
                report.append(f"     旧值 → 新值: {corr.old_value} → {corr.new_value}")
                report.append(f"     修改原因: {corr.reason}")
                report.append("")
        else:
            report.append("  (暂无人工修正记录)")
        report.append("")

        report.append("━" * 60)
        report.append("【重跑记录】改完影响哪些结果")
        report.append("━" * 60)
        if playback.re_runs:
            for run in playback.re_runs:
                report.append(f"  🔄 {run.run_id}")
                report.append(f"     时间: {run.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                report.append(f"     操作人: {run.operator}")
                report.append(f"     重跑原因: {run.reason}")
                report.append(f"     影响结果:")
                for result in run.affected_results:
                    report.append(f"        - {result}")
                report.append("")
        else:
            report.append("  (暂无重跑记录)")
        report.append("")

        report.append("=" * 60)
        report.append("报告结束 - 请现场班组重点复核Z轴方向标注问题")
        report.append("=" * 60)

        return "\n".join(report)

    @staticmethod
    def generate_json_report(playback: PathPlayback) -> Dict[str, Any]:
        return {
            "project_name": playback.project_name,
            "playback_id": playback.playback_id,
            "created_at": playback.created_at.isoformat(),
            "sketch": {
                "sketch_id": playback.sketch.sketch_id,
                "name": playback.sketch.name,
                "importer": playback.sketch.importer,
                "floor_number": playback.sketch.floor_number,
                "z_axis_direction": playback.sketch.z_axis_direction,
                "stall_count": len(playback.sketch.stall_coordinates),
            }
            if playback.sketch
            else None,
            "issues": [
                {
                    "issue_id": issue.issue_id,
                    "type": issue.type,
                    "description": issue.description,
                    "status": issue.status.value,
                    "discovered_by": issue.discovered_by,
                    "z_axis_inverted": issue.z_axis_inverted,
                    "why_kept": issue.why_kept,
                    "missing_materials": issue.missing_materials,
                    "next_action": issue.next_action.value,
                }
                for issue in playback.issues
            ],
            "point_cloud_logs": [
                {
                    "log_id": log.log_id,
                    "action": log.action,
                    "operator": log.operator,
                    "thinning_ratio": log.thinning_ratio,
                    "notes": log.notes,
                }
                for log in playback.point_cloud_logs
            ],
            "corrections": [
                {
                    "correction_id": corr.correction_id,
                    "operator": corr.operator,
                    "field_name": corr.field_name,
                    "old_value": corr.old_value,
                    "new_value": corr.new_value,
                    "reason": corr.reason,
                }
                for corr in playback.corrections
            ],
            "re_runs": [
                {
                    "run_id": run.run_id,
                    "operator": run.operator,
                    "reason": run.reason,
                    "affected_results": run.affected_results,
                }
                for run in playback.re_runs
            ],
        }
