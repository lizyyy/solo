from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime

from .data_manager import DataManager
from .boundary_rules import BoundaryRuleEngine
from .models import ProcessingStatus, HeatmapIssue, ImportType


class WorkflowEngine:
    def __init__(self, data_manager: DataManager):
        self.dm = data_manager
        self.rule_engine = BoundaryRuleEngine()

    def step1_import_photos(
        self,
        rows: List[Dict[str, Any]],
        source_file: str,
        operator: str,
    ) -> Dict[str, Any]:
        imported, skipped = self.dm.import_photos(rows, source_file, operator)
        
        imported_details = [
            {
                "photo_id": p.photo_id,
                "intersection_name": p.intersection_name,
                "row_number": p.original_row.row_number,
                "type": "新增",
            }
            for p in imported
        ]
        
        skipped_details = [
            {**s, "type": "复用（已存在）"}
            for s in skipped
        ]
        
        return {
            "step": "步骤1: 路口照片导入",
            "total_input": len(rows),
            "new_count": len(imported),
            "reused_count": len(skipped),
            "new_records": imported_details,
            "reused_records": skipped_details,
            "note": "重复数据自动跳过，数量不翻倍（RULE_003），复用记录保留原始状态和历史",
        }

    def step2_add_bus_card_hours(
        self,
        photo_id: str,
        bus_card_hours: List[str],
        operator: str,
        reason: str = "市政巡检员补录公交刷卡时段",
    ) -> Dict[str, Any]:
        photo = self.dm.get_photo(photo_id)
        if not photo:
            return {"success": False, "error": "未找到该路口照片记录"}

        old_snapshot = self.dm._photo_to_snapshot(photo)

        photo.bus_card_hours = bus_card_hours
        photo.current_status = ProcessingStatus.BUS_CARD_DATA_ADDED
        photo.updated_at = datetime.now()

        self.dm._add_history_record(
            photo,
            change_type="公交刷卡时段补录",
            old_snapshot=old_snapshot,
            operator=operator,
            description=f"补录公交刷卡时段: {bus_card_hours}",
        )

        self.dm._save_data()

        return {
            "step": "步骤2: 公交刷卡时段补录",
            "success": True,
            "photo_id": photo_id,
            "intersection_name": photo.intersection_name,
            "bus_card_hours": bus_card_hours,
            "new_status": photo.current_status.value,
        }

    def step3_generate_heatmap(
        self,
        photo_id: str,
        heatmap_data: Dict[str, Any],
        operator: str,
    ) -> Dict[str, Any]:
        photo = self.dm.get_photo(photo_id)
        if not photo:
            return {"success": False, "error": "未找到该路口照片记录"}

        is_valid, issues = self.rule_engine.validate_before_heatmap_generation(photo)
        if not is_valid:
            return {
                "success": False,
                "error": "前置校验不通过",
                "issues": issues,
            }

        old_snapshot = self.dm._photo_to_snapshot(photo)

        issue_type, issue_reason = self.rule_engine.determine_heatmap_issue(heatmap_data)
        next_status = self.rule_engine.determine_next_status(photo, issue_type)

        photo.heatmap_data = heatmap_data
        photo.heatmap_issue = issue_type
        photo.current_status = next_status
        photo.updated_at = datetime.now()

        change_desc = f"生成热力图，检测结果: {issue_type.value}，原因: {issue_reason}"
        if issue_type != HeatmapIssue.NONE:
            change_desc += " → 进入待复核状态（RULE_005）"

        self.dm._add_history_record(
            photo,
            change_type="热力图生成",
            old_snapshot=old_snapshot,
            operator=operator,
            description=change_desc,
        )

        self.dm._save_data()

        result = {
            "step": "步骤3: 热力图生成",
            "success": True,
            "photo_id": photo_id,
            "intersection_name": photo.intersection_name,
            "heatmap_issue": issue_type.value,
            "issue_reason": issue_reason,
            "new_status": next_status.value,
        }

        if issue_type == HeatmapIssue.LOW_NIGHT_SAMPLING:
            result["action_required"] = "请街道规划员进行复核（RULE_001）"
            result["rule_reference"] = "RULE_001: 夜间缺采样导致热力图偏低，不得直接归为正常"

        return result

    def review_heatmap(
        self,
        photo_id: str,
        is_normal: bool,
        review_note: str,
        operator: str,
    ) -> Dict[str, Any]:
        photo = self.dm.get_photo(photo_id)
        if not photo:
            return {"success": False, "error": "未找到该路口照片记录"}

        if photo.current_status != ProcessingStatus.PENDING_REVIEW:
            return {
                "success": False,
                "error": f"当前状态为 {photo.current_status.value}，无需复核",
            }

        old_snapshot = self.dm._photo_to_snapshot(photo)

        if is_normal:
            photo.current_status = ProcessingStatus.REVIEWED_NORMAL
            photo.heatmap_issue = HeatmapIssue.NONE
            desc = "街道规划员复核通过，标记为正常"
        else:
            photo.current_status = ProcessingStatus.REVIEWED_LOW_SAMPLING
            desc = "街道规划员复核确认，标记为夜间缺采样"

        photo.review_note = review_note
        photo.updated_at = datetime.now()

        self.dm._add_history_record(
            photo,
            change_type="复核完成",
            old_snapshot=old_snapshot,
            operator=operator,
            description=f"{desc}，复核意见: {review_note}",
        )

        self.dm._save_data()

        return {
            "success": True,
            "photo_id": photo_id,
            "intersection_name": photo.intersection_name,
            "new_status": photo.current_status.value,
            "review_note": review_note,
        }

    def rollback(
        self,
        photo_id: str,
        operator: str,
        reason: str,
    ) -> Dict[str, Any]:
        photo = self.dm.get_photo(photo_id)
        if not photo:
            return {"success": False, "error": "未找到该路口照片记录"}

        can_rollback, rollback_msg = self.rule_engine.can_rollback(photo)
        if not can_rollback:
            return {"success": False, "error": rollback_msg}

        target_status = self.rule_engine.get_rollback_target(photo)
        if not target_status:
            return {"success": False, "error": "无法确定回滚目标状态"}

        old_snapshot = self.dm._photo_to_snapshot(photo)

        old_status = photo.current_status
        photo.current_status = target_status
        photo.updated_at = datetime.now()

        if target_status == ProcessingStatus.BUS_CARD_DATA_ADDED:
            photo.heatmap_data = None
            photo.heatmap_issue = HeatmapIssue.NONE
            photo.review_note = None
        elif target_status == ProcessingStatus.IMPORTED:
            photo.bus_card_hours = None
            photo.heatmap_data = None
            photo.heatmap_issue = HeatmapIssue.NONE
            photo.review_note = None
        elif target_status == ProcessingStatus.PENDING_REVIEW:
            photo.review_note = None

        rollback_desc = f"从 {old_status.value} 回滚至 {target_status.value}，原因: {reason}"
        
        if old_status in [ProcessingStatus.REVIEWED_NORMAL, ProcessingStatus.REVIEWED_LOW_SAMPLING]:
            rollback_desc += "，复核意见已清除"
        
        self.dm._add_history_record(
            photo,
            change_type="回滚",
            old_snapshot=old_snapshot,
            operator=operator,
            description=rollback_desc,
        )

        self.dm._save_data()

        return {
            "success": True,
            "photo_id": photo_id,
            "intersection_name": photo.intersection_name,
            "old_status": old_status.value,
            "new_status": target_status.value,
            "reason": reason,
        }

    def run_full_demo(
        self,
        sample_data: List[Dict[str, Any]],
        source_file: str = "demo_data.csv",
    ) -> List[Dict[str, Any]]:
        results = []

        step1_result = self.step1_import_photos(sample_data, source_file, "系统演示")
        results.append(step1_result)

        for photo_data in sample_data:
            photo_id = self.dm._generate_photo_id(photo_data, source_file)
            photo = self.dm.get_photo(photo_id)
            if not photo:
                continue

            bus_hours = photo_data.get("公交刷卡时段", photo_data.get("bus_card_hours", ["07:00-09:00", "17:00-19:00"]))
            step2_result = self.step2_add_bus_card_hours(
                photo_id, bus_hours, "市政巡检员-小付", "回看历史街区招牌整治时补录"
            )
            results.append(step2_result)

            heatmap_data = photo_data.get("热力图数据", photo_data.get("heatmap_data", self._generate_sample_heatmap()))
            step3_result = self.step3_generate_heatmap(photo_id, heatmap_data, "系统自动生成")
            results.append(step3_result)

        return results

    @staticmethod
    def _generate_sample_heatmap() -> Dict[str, Any]:
        hourly = {}
        for h in range(24):
            if 7 <= h <= 9 or 17 <= h <= 19:
                hourly[str(h)] = 100
            elif 10 <= h <= 16:
                hourly[str(h)] = 80
            elif 20 <= h <= 21:
                hourly[str(h)] = 40
            else:
                hourly[str(h)] = 10
        return {"hourly_samples": hourly, "total_samples": sum(hourly.values())}

    def export_report(self) -> Dict[str, Any]:
        photos = self.dm.get_all_photos()
        all_history = self.dm.get_all_history()
        
        photo_reports = []
        for photo in photos:
            history = self.dm.get_photo_history(photo.photo_id)
            
            remark_changes = [
                mc for mc in photo.manual_changes
                if mc.field_name == "remark"
            ]
            
            reuse_events = [
                h for h in history
                if h.change_type == "复用确认"
            ]
            
            rollback_events = [
                h for h in history
                if h.change_type == "回滚"
            ]
            
            photo_reports.append({
                "photo_id": photo.photo_id,
                "intersection_name": photo.intersection_name,
                "import_type": photo.import_type.value,
                "original_row_number": photo.original_row.row_number,
                "source_file": photo.original_row.source_file,
                "import_time": photo.original_row.import_timestamp.isoformat(),
                "current_status": photo.current_status.value,
                "heatmap_issue": photo.heatmap_issue.value,
                "review_note": photo.review_note,
                "remark": photo.remark,
                "bus_card_hours": photo.bus_card_hours,
                "remark_change_count": len(remark_changes),
                "remark_changes": [
                    {
                        "old_value": mc.old_value,
                        "new_value": mc.new_value,
                        "operator": mc.operator,
                        "reason": mc.reason,
                        "time": mc.change_timestamp.isoformat(),
                    }
                    for mc in remark_changes
                ],
                "reuse_event_count": len(reuse_events),
                "reuse_events": [
                    {
                        "time": h.change_timestamp.isoformat(),
                        "description": h.description,
                        "snapshot_at_reuse": h.new_snapshot,
                    }
                    for h in reuse_events
                ],
                "rollback_event_count": len(rollback_events),
                "rollback_events": [
                    {
                        "time": h.change_timestamp.isoformat(),
                        "description": h.description,
                        "old_status": h.old_snapshot.get("current_status", ""),
                        "new_status": h.new_snapshot.get("current_status", ""),
                        "review_note_cleared": h.old_snapshot.get("review_note") is not None and h.new_snapshot.get("review_note") is None,
                    }
                    for h in rollback_events
                ],
                "history_count": len(history),
            })
        
        stats = self.dm.get_statistics()
        
        return {
            "report_title": "历史街区招牌整治 - 路口照片管理报告",
            "generated_at": datetime.now().isoformat(),
            "summary": stats,
            "photos": photo_reports,
        }
