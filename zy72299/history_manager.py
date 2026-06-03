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
        conflict_resolutions: Optional[List[Dict]] = None,
        duplicate_resolutions: Optional[List[Dict]] = None,
    ) -> str:
        cmd_parts = [
            "python main.py",
            f"--building-id {building_id}",
            f"--scenario {scenario_type}",
        ]

        if origin_file:
            cmd_parts.append(f"--origin-spec {origin_file}")
        if photo_file:
            cmd_parts.append(f"--inspection-photos {photo_file}")
        if conflict_resolutions:
            resolutions_json = json.dumps(conflict_resolutions, ensure_ascii=False)
            cmd_parts.append(f'--conflict-resolutions \'{resolutions_json}\'')
        if duplicate_resolutions:
            dup_json = json.dumps(duplicate_resolutions, ensure_ascii=False)
            cmd_parts.append(f'--duplicate-resolutions \'{dup_json}\'')

        cmd_parts.append("--generate-report")
        cmd_parts.append("--output result.json")

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

        if include_history:
            formatted["history_timeline"] = [
                ResultFormatter._format_history_entry(h) for h in result.history
            ]

        if result.cleaning_path:
            formatted["cleaning_path"] = ResultFormatter._format_path(
                result.cleaning_path
            )

        return formatted

    @staticmethod
    def _format_conflict(conflict: ConflictEvidence) -> Dict:
        return {
            "conflict_id": conflict.conflict_id,
            "record_id": conflict.record_id,
            "conflicting_fields": conflict.conflicting_fields,
            "detected_at": conflict.detected_at.isoformat(),
            "origin_evidence": conflict.origin_data,
            "photo_evidence": conflict.photo_data,
            "review_message": f"坐标原点说明与巡检照片编号在{', '.join(conflict.conflicting_fields)}上存在矛盾，请园区运维小陶选择确认或驳回",
        }

    @staticmethod
    def _format_record_summary(record: ObstacleRecord) -> Dict:
        return {
            "record_id": record.record_id,
            "obstacle_name": record.obstacle_name,
            "obstacle_type": record.obstacle_type.value,
            "status": record.status.value,
            "position": {
                "x": record.position.x,
                "y": record.position.y,
                "z": record.position.z,
            },
            "caliber_source": record.caliber_source,
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
    def print_console_report(result: ProcessingResult):
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

        if result.conflicts:
            print("\n" + "-" * 60)
            print("数据冲突列表（需要园区运维小陶确认）")
            print("-" * 60)
            for i, conflict in enumerate(result.conflicts, 1):
                print(f"\n  冲突 #{i}: {conflict.conflict_id}")
                print(f"  涉及记录: {conflict.record_id}")
                print(f"  矛盾字段: {', '.join(conflict.conflicting_fields)}")
                print(f"  坐标原点说明: {conflict.origin_data}")
                print(f"  巡检照片编号: {conflict.photo_data}")
                print(f"  提示: 坐标原点说明与巡检照片编号在{', '.join(conflict.conflicting_fields)}上存在矛盾，请选择确认或驳回")

        if result.pending_reviews:
            print("\n" + "-" * 60)
            print("待培训学员复核列表")
            print("-" * 60)
            for i, record in enumerate(result.pending_reviews, 1):
                print(f"\n  复核项 #{i}: {record.record_id}")
                print(f"  障碍物名称: {record.obstacle_name}")
                print(f"  当前状态: {ResultFormatter._get_status_display(record.status.value)}")
                print(f"  位置: ({record.position.x}, {record.position.y}, {record.position.z})")
                if record.duplicate_of:
                    print(f"  疑似重复: 与记录 {record.duplicate_of} 位置相同但名称不同")
                print(f"  提示: 留给培训学员复核，别急着归正常")

        print("\n" + "-" * 60)
        print("复盘命令（可重新运行）")
        print("-" * 60)
        print(f"  {result.replay_command}")

        print("\n" + "=" * 60)
        print("处理完成。以上为可复盘的记录和可重新跑的命令。")
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
