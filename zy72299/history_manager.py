from datetime import datetime
from typing import List, Dict, Optional
import json
import uuid
from models import (
    HistoryEntry,
    ObstacleRecord,
    ConflictEvidence,
    ProcessingResult,
    RecordStatus,
    ReviewTrail,
)


class HistoryManager:
    def __init__(self):
        self.all_history: List[HistoryEntry] = []

    def merge_history(self, histories: List[List[HistoryEntry]]):
        for hist_list in histories:
            self.all_history.extend(hist_list)
        self.all_history.sort(key=lambda h: h.timestamp)

    def generate_timeline(self) -> List[Dict]:
        timeline = []
        for entry in self.all_history:
            timeline.append(
                {
                    "timestamp": entry.timestamp.isoformat(),
                    "action": entry.action,
                    "actor": entry.actor,
                    "record_id": entry.record_id,
                    "details": entry.details,
                }
            )
        return timeline

    def generate_audit_report(self, records: List[ObstacleRecord]) -> Dict:
        status_counts = {}
        source_counts = {}
        reviewer_counts = {}

        for record in records:
            status = record.status.value
            status_counts[status] = status_counts.get(status, 0) + 1

            source = record.caliber_source
            source_counts[source] = source_counts.get(source, 0) + 1

            if record.reviewed_by:
                reviewer = record.reviewed_by
                reviewer_counts[reviewer] = reviewer_counts.get(reviewer, 0) + 1

        action_counts = {}
        for entry in self.all_history:
            action = entry.action
            action_counts[action] = action_counts.get(action, 0) + 1

        return {
            "generated_at": datetime.now().isoformat(),
            "total_records": len(records),
            "status_distribution": status_counts,
            "source_distribution": source_counts,
            "reviewer_distribution": reviewer_counts,
            "action_distribution": action_counts,
            "total_history_entries": len(self.all_history),
        }

    def generate_replay_command(
        self,
        building_id: str,
        scenario_type: str,
        origin_file: Optional[str] = None,
        photo_file: Optional[str] = None,
        photo_files: Optional[List[str]] = None,
        conflict_resolutions: Optional[List[Dict]] = None,
        duplicate_resolutions: Optional[List[Dict]] = None,
        include_view: bool = True,
        view_version: Optional[int] = None,
    ) -> str:
        import glob as _glob
        import os as _os

        cmd_parts = [
            "python3 main.py",
            f"--building-id {building_id}",
        ]

        valid_scenarios = ["正常场景-顺利记录", "重复名称场景-同一障碍物多名称",
                           "补录场景-旧口径补录", "冲突场景-坐标与照片矛盾",
                           "完整场景-三种情况全包含", "custom"]
        scenario_map = {
            "正常场景-顺利记录": "normal",
            "重复名称场景-同一障碍物多名称": "duplicate",
            "补录场景-旧口径补录": "supplement",
            "冲突场景-坐标与照片矛盾": "conflict",
            "完整场景-三种情况全包含": "all",
        }
        mapped = scenario_map.get(scenario_type)
        if mapped:
            cmd_parts.append(f"--scenario {mapped}")
        else:
            cmd_parts.append(f"--scenario all")

        if origin_file:
            abs_origin = _os.path.abspath(origin_file)
            cmd_parts.append(f"--origin-spec '{abs_origin}'")

        # 处理照片文件：优先用 photo_files 列表，否则解析 photo_file（含glob）
        resolved_photos: List[str] = []
        if photo_files:
            for pf in photo_files:
                if any(ch in pf for ch in '*?['):
                    resolved_photos.extend(sorted(_glob.glob(pf)))
                elif _os.path.exists(pf):
                    resolved_photos.append(pf)
        elif photo_file:
            if any(ch in photo_file for ch in '*?['):
                resolved_photos = sorted(_glob.glob(photo_file))
            elif _os.path.exists(photo_file):
                resolved_photos = [photo_file]

        # 去重并转绝对路径
        seen = set()
        for pf in resolved_photos:
            abs_pf = _os.path.abspath(pf)
            if abs_pf not in seen and _os.path.exists(abs_pf):
                cmd_parts.append(f"--inspection-photos '{abs_pf}'")
                seen.add(abs_pf)

        if conflict_resolutions:
            resolutions_json = json.dumps(conflict_resolutions, ensure_ascii=False)
            cmd_parts.append(f'--conflict-resolutions \'{resolutions_json}\'')
        if duplicate_resolutions:
            dup_json = json.dumps(duplicate_resolutions, ensure_ascii=False)
            cmd_parts.append(f'--duplicate-resolutions \'{dup_json}\'')

        if include_view:
            cmd_parts.append("--include-view")
        else:
            cmd_parts.append("--no-view")

        if view_version is not None:
            cmd_parts.append(f"# 目标视图版本 v{view_version} (命令执行后自动递增)")

        cmd_parts.append("--generate-report")
        safe_scenario = scenario_type.replace("/", "_").replace(" ", "_")[:20]
        cmd_parts.append(f"--output result_{safe_scenario}_v{view_version or 1}.json")

        return " ".join(cmd_parts)

    def export_history(self, filepath: str):
        timeline = self.generate_timeline()
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(timeline, f, ensure_ascii=False, indent=2)

    def export_audit_report(self, records: List[ObstacleRecord], filepath: str):
        report = self.generate_audit_report(records)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)


class ResultFormatter:
    @staticmethod
    def format_result(
        result: ProcessingResult,
        include_history: bool = True,
        include_view: bool = True,
        include_review_trails: bool = True,
    ) -> Dict:
        formatted = {
            "result_id": result.result_id,
            "building_id": result.building_id,
            "scenario_type": result.scenario_type,
            "replay_command": result.replay_command,
            "summary": result.summary,
            "conflicts": [
                ResultFormatter._format_conflict(c) for c in result.conflicts
            ],
            "pending_reviews": [
                ResultFormatter._format_record_summary(r)
                for r in result.pending_reviews
            ],
            "records_summary": ResultFormatter._format_records_summary(
                result.processed_records
            ),
        }

        if include_view and result.view_state:
            formatted["view_state"] = result.view_state
            formatted["view_versions"] = [
                {
                    "version": v["version"],
                    "bumped_at": v["bumped_at"],
                    "trigger_reason": v["trigger_reason"],
                    "actor": v["actor"],
                    "total_record_changes": v["total_record_changes"],
                    "changed_record_ids": v["changed_record_ids"],
                    "changed_fields_by_record": v["changed_fields_by_record"],
                    "records_before": v["records_before"],
                    "records_after": v["records_after"],
                }
                for v in result.view_versions
            ]
            formatted["view_record_consistency"] = result.view_record_consistency
            formatted["cross_check_view_history"] = ResultFormatter._cross_check_view_history(
                result.view_versions, result.history, result.processed_records
            )

        if include_history:
            formatted["history_timeline"] = [
                ResultFormatter._format_history_entry(h) for h in result.history
            ]

        if result.cleaning_path:
            formatted["cleaning_path"] = ResultFormatter._format_path(
                result.cleaning_path
            )

        if include_review_trails:
            formatted["review_trails"] = [
                ResultFormatter._format_review_trail(t) for t in result.review_trails
            ]
            formatted["review_trace_matrix"] = ResultFormatter._build_trace_matrix(
                result.review_trails, result.processed_records, result.history
            )

        return formatted

    @staticmethod
    def _cross_check_view_history(
        view_versions: List[Dict],
        history: List[HistoryEntry],
        records: List[ObstacleRecord],
    ) -> Dict:
        issues = []
        version_ids = {v["version"] for v in view_versions}

        bump_actions = [h for h in history if h.action == "BUMP_VIEW_VERSION"]
        for ba in bump_actions:
            vnum = ba.details.get("new_version")
            if vnum not in version_ids:
                issues.append({
                    "type": "HISTORY_VIEW_MISMATCH",
                    "detail": f"历史记录中有BUMP v{vnum}，但view_versions里没有",
                })

        current_statuses = {r.record_id: r.status.value for r in records}
        if view_versions:
            latest = view_versions[-1]
            after = latest.get("records_after", {})
            for rid, snap in after.items():
                actual = current_statuses.get(rid)
                if actual and snap.get("status") != actual:
                    issues.append({
                        "type": "STATUS_MISMATCH_AFTER_LATEST_VIEW",
                        "record_id": rid,
                        "detail": f"视图最新快照status={snap.get('status')} vs 记录实际status={actual}",
                    })

        return {
            "checked_at": datetime.now().isoformat(),
            "total_view_versions": len(view_versions),
            "total_bump_in_history": len(bump_actions),
            "consistent": len(issues) == 0,
            "issue_count": len(issues),
            "issues": issues,
        }

    @staticmethod
    def _build_trace_matrix(
        trails: List[ReviewTrail],
        records: List[ObstacleRecord],
        history: List[HistoryEntry],
    ) -> List[Dict]:
        matrix = []
        rec_map = {r.record_id: r for r in records}

        for trail in trails:
            record = rec_map.get(trail.record_id)
            related_history = [
                {
                    "timestamp": h.timestamp.isoformat(),
                    "action": h.action,
                    "actor": h.actor,
                    "details_trail_id": h.details.get("review_trail_id"),
                }
                for h in history
                if h.record_id == trail.record_id
                and h.details.get("review_trail_id") == trail.trail_id
            ]

            matrix.append({
                "trail_id": trail.trail_id,
                "record_id": trail.record_id,
                "obstacle_name": record.obstacle_name if record else "(已删除)",
                "current_status": record.status.value if record else "(未知)",
                "handled_by": trail.handled_by,
                "handled_at": trail.handled_at.isoformat(),
                "changed_fields": trail.changed_fields,
                "original_value": trail.original_value,
                "modified_value": trail.modified_value,
                "field_diff": [
                    {
                        "field": f,
                        "original": trail.original_value.get(f),
                        "modified": trail.modified_value.get(f),
                    }
                    for f in trail.changed_fields
                ],
                "reason": trail.reason,
                "next_handler": trail.next_handler,
                "related_history_entries": related_history,
            })
        return matrix

    @staticmethod
    def _format_review_trail(trail: ReviewTrail) -> Dict:
        return {
            "trail_id": trail.trail_id,
            "record_id": trail.record_id,
            "changed_fields": trail.changed_fields,
            "original_value": trail.original_value,
            "modified_value": trail.modified_value,
            "reason": trail.reason,
            "next_handler": trail.next_handler,
            "handled_by": trail.handled_by,
            "handled_at": trail.handled_at.isoformat(),
        }

    @staticmethod
    def _format_conflict(conflict: ConflictEvidence) -> Dict:
        comparison = []
        for field in conflict.conflicting_fields:
            comparison.append({
                "field": field,
                "origin_value": conflict.origin_data.get(field),
                "photo_value": conflict.photo_data.get(field),
            })
        return {
            "conflict_id": conflict.conflict_id,
            "record_id": conflict.record_id,
            "conflicting_fields": conflict.conflicting_fields,
            "detected_at": conflict.detected_at.isoformat(),
            "origin_evidence": conflict.origin_data,
            "photo_evidence": conflict.photo_data,
            "field_by_field_comparison": comparison,
            "review_message": (
                f"坐标原点说明与巡检照片编号在{', '.join(conflict.conflicting_fields)}上存在矛盾，"
                f"请园区运维小陶选确认或驳回"
            ),
            "review_options": [
                {"resolution": "confirm_origin", "label": "确认坐标原点说明的口径"},
                {"resolution": "confirm_photo", "label": "确认巡检照片编号的口径"},
                {"resolution": "reject_both", "label": "双方均不可信，驳回"},
            ],
        }

    @staticmethod
    def _format_record_summary(record: ObstacleRecord) -> Dict:
        return {
            "record_id": record.record_id,
            "obstacle_name": record.obstacle_name,
            "obstacle_type": record.obstacle_type.value,
            "status": record.status.value,
            "status_display": ResultFormatter._get_status_display(record.status.value),
            "position": {
                "x": record.position.x,
                "y": record.position.y,
                "z": record.position.z,
            },
            "caliber_source": record.caliber_source,
            "source_display": ResultFormatter._get_source_display(record.caliber_source),
            "photo_number": record.photo_number,
            "origin_id": record.origin_id,
            "duplicate_of": record.duplicate_of,
            "reviewed_by": record.reviewed_by,
            "reviewed_at": record.reviewed_at.isoformat()
            if record.reviewed_at
            else None,
            "conflict_evidence": record.conflict_evidence,
        }

    @staticmethod
    def _format_records_summary(records: List[ObstacleRecord]) -> Dict:
        summary = {
            "total": len(records),
            "by_status": {},
            "by_source": {},
            "details": [],
        }

        for record in records:
            status = record.status.value
            summary["by_status"][status] = summary["by_status"].get(status, 0) + 1

            source = record.caliber_source
            summary["by_source"][source] = summary["by_source"].get(source, 0) + 1

            summary["details"].append(ResultFormatter._format_record_summary(record))

        return summary

    @staticmethod
    def _format_history_entry(entry: HistoryEntry) -> Dict:
        return {
            "timestamp": entry.timestamp.isoformat(),
            "action": entry.action,
            "actor": entry.actor,
            "record_id": entry.record_id,
            "details": entry.details,
        }

    @staticmethod
    def _format_path(path) -> Dict:
        return {
            "path_id": path.path_id,
            "path_name": path.path_name,
            "version": path.version,
            "created_at": path.created_at.isoformat(),
            "points_count": len(path.points),
            "points": [
                {
                    "sequence": p.sequence,
                    "position": {
                        "x": p.position.x,
                        "y": p.position.y,
                        "z": p.position.z,
                    },
                    "obstacle_id": p.obstacle_id,
                    "cleaning_action": p.cleaning_action,
                }
                for p in path.points
            ],
        }

    @staticmethod
    def print_console_report(result: ProcessingResult, include_view: bool = True):
        print("\n" + "=" * 60)
        print("楼宇外立面清洗路径 - 处理结果报告")
        print("=" * 60)
        print(f"\n场景类型: {result.scenario_type}")
        print(f"楼宇ID: {result.building_id}")
        print(f"结果ID: {result.result_id}")

        print("\n" + "-" * 60)
        print("记录统计")
        print("-" * 60)
        for status, count in result.summary["status_distribution"].items():
            display_name = ResultFormatter._get_status_display(status)
            print(f"  {display_name}: {count} 条")

        print("\n" + "-" * 60)
        print("数据来源统计")
        print("-" * 60)
        for source, count in result.summary["source_distribution"].items():
            display_name = ResultFormatter._get_source_display(source)
            print(f"  {display_name}: {count} 条")

        if result.review_trails:
            print("\n" + "-" * 60)
            print(f"复核痕迹矩阵 (共 {len(result.review_trails)} 条，原始说法→改后值→原因→下一步)")
            print("-" * 60)
            for i, trail in enumerate(result.review_trails, 1):
                rec = next((r for r in result.processed_records
                            if r.record_id == trail.record_id), None)
                name = rec.obstacle_name if rec else "(未知)"
                print(f"\n  [{i}] 痕迹 {trail.trail_id} / {name} / {trail.record_id}")
                print(f"    处理人: {trail.handled_by}  时间: {trail.handled_at.strftime('%H:%M:%S')}")
                print(f"    变更字段: {', '.join(trail.changed_fields)}")
                for f in trail.changed_fields:
                    print(f"      · {f}: 原始={trail.original_value.get(f)} → 改后={trail.modified_value.get(f)}")
                print(f"    处理原因: {trail.reason[:80]}{'...' if len(trail.reason) > 80 else ''}")
                print(f"    下一步: → {trail.next_handler}")

        if include_view and result.view_state:
            print("\n" + "-" * 60)
            vs = result.view_state
            print(f"三维标注视图摘要 (v{vs.get('version')})")
            print("-" * 60)
            print(f"  生成时间: {vs.get('last_updated')}")
            print(f"  图层数: {vs.get('layer_count', 0)}  标注数: {vs.get('annotation_count', 0)}")
            cons = vs.get("view_record_consistency", {})
            if cons:
                flag = "✓一致" if cons.get("consistent") else f"✗{cons.get('issue_count')}个问题"
                print(f"  记录-视图一致性: {flag}")
                if not cons.get("consistent"):
                    for issue in cons.get("issues", []):
                        print(f"    - [{issue['type']}] {issue.get('record_id', '')}: {issue['detail']}")
            print(f"  图层明细:")
            for layer in vs.get("layers", []):
                if layer.get("record_count", 0) > 0:
                    marker = "  " if layer["visible"] else "❌"
                    print(f"    {marker} [{layer['style']['color']}] {layer['layer_name']}: {layer['record_count']} 条")

            if result.view_versions:
                print(f"\n  视图版本变更链:")
                for v in result.view_versions:
                    print(f"    v{v['version']} [{v['bumped_at'][:19]}] {v['trigger_reason']} by {v['actor']}")
                    if v["changed_record_ids"]:
                        print(f"       ↳ 变更记录 {len(v['changed_record_ids'])} 条共 {v['total_record_changes']} 处: {', '.join(v['changed_record_ids'])}")

        if result.conflicts:
            print("\n" + "-" * 60)
            print("数据冲突列表（需要园区运维小陶确认，不自动拍板）")
            print("-" * 60)
            for i, conflict in enumerate(result.conflicts, 1):
                rec = next((r for r in result.processed_records
                            if r.record_id == conflict.record_id), None)
                print(f"\n  冲突 #{i}: {conflict.conflict_id}")
                print(f"  涉及记录: {conflict.record_id} ({rec.obstacle_name if rec else '未知'})")
                print(f"  矛盾字段: {', '.join(conflict.conflicting_fields)}")
                for field in conflict.conflicting_fields:
                    print(f"    · {field}:")
                    print(f"      坐标原点说明: {conflict.origin_data.get(field)}")
                    print(f"      巡检照片编号: {conflict.photo_data.get(field)}")
                print(f"  提示: 坐标原点说明与巡检照片编号在{', '.join(conflict.conflicting_fields)}上存在矛盾，请选择确认或驳回")
                print(f"  选项: confirm_origin | confirm_photo | reject_both")

        if result.pending_reviews:
            print("\n" + "-" * 60)
            print("待培训学员复核列表（别急着归正常，留给培训学员）")
            print("-" * 60)
            for i, record in enumerate(result.pending_reviews, 1):
                print(f"\n  复核项 #{i}: {record.record_id}")
                print(f"  障碍物名称: {record.obstacle_name}")
                print(f"  当前状态: {ResultFormatter._get_status_display(record.status.value)}")
                print(f"  位置: ({record.position.x}, {record.position.y}, {record.position.z})")
                if record.duplicate_of:
                    dup_of = next((r for r in result.processed_records
                                   if r.record_id == record.duplicate_of), None)
                    dup_name = dup_of.obstacle_name if dup_of else "未知"
                    print(f"  疑似重复: 与记录 {record.duplicate_of} ({dup_name}) 位置相同但名称不同")
                print(f"  下一步处理人: 培训学员")
                print(f"  提示: 留给培训学员复核，别急着归正常")

        print("\n" + "-" * 60)
        print("可重新跑的命令 (复制粘贴即可重新执行得到同一份结果)")
        print("-" * 60)
        print(f"  {result.replay_command}")

        print("\n" + "=" * 60)
        print("处理完成。以上为可复盘的记录、三维标注视图和可重新跑的命令。")
        print("视图↔记录↔命令三条链路已关联，可交叉核对。")
        print("=" * 60 + "\n")

    @staticmethod
    def _get_status_display(status: str) -> str:
        displays = {
            "normal": "正常记录",
            "duplicate_name": "同一障碍物多名称",
            "conflict": "数据冲突待确认",
            "pending_review": "培训学员复核中",
            "supplemented": "照片补录数据",
            "confirmed": "已确认",
            "rejected": "已驳回",
        }
        return displays.get(status, status)

    @staticmethod
    def _get_source_display(source: str) -> str:
        displays = {
            "coordinate_origin_spec": "坐标原点说明",
            "photo_supplement": "巡检照片编号补录",
        }
        return displays.get(source, source)
