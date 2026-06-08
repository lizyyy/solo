import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from .models import CoordinateOrigin, InspectionPhoto


class WorkflowEngine:
    def __init__(self, preflight_manager, review_manager, visualizer):
        self.preflight_manager = preflight_manager
        self.review_manager = review_manager
        self.visualizer = visualizer
        self._workflow_log: List[Dict[str, Any]] = []

    def run_three_step_workflow(self, test_data: Dict[str, Any]) -> Dict[str, Any]:
        self._log("workflow_started", {"steps": ["import_origins", "review_photos", "update_report"]})

        result = {
            "step1_import": self._step1_import_origins(test_data),
            "step2_review_photos": self._step2_review_photos(test_data),
            "step3_update_report": self._step3_update_report(test_data),
            "workflow_complete": True,
        }

        self._log("workflow_completed", result)
        return result

    def _step1_import_origins(self, test_data: Dict[str, Any]) -> Dict[str, Any]:
        origins_data = test_data.get("coordinate_origins", [])
        origins = [CoordinateOrigin(**o) for o in origins_data]

        created, skipped = self.preflight_manager.import_coordinate_origins(
            origins, actor="system_initial"
        )

        result = {
            "imported_count": len(created),
            "skipped_count": len(skipped),
            "created_records": [r.id for r in created],
            "skipped_origins": skipped,
        }

        self._log("step1_import", result)
        return result

    def _step2_review_photos(self, test_data: Dict[str, Any]) -> Dict[str, Any]:
        photos_data = test_data.get("inspection_photos", [])
        photos = [InspectionPhoto(**p) for p in photos_data]

        added_records = []
        blocked_count = 0
        for photo in photos:
            record = self.preflight_manager.add_inspection_photo(
                photo, actor="designer_ajing"
            )
            if record:
                added_records.append(record.id)
                if photo.is_alert_label_blocked():
                    blocked_count += 1

        result = {
            "photos_added": len(added_records),
            "records_affected": added_records,
            "blocked_alerts_detected": blocked_count,
            "photos_with_issue": [
                p.id for p in photos if p.is_alert_label_blocked()
            ],
        }

        self._log("step2_review_photos", result)
        return result

    def _step3_update_report(self, test_data: Dict[str, Any]) -> Dict[str, Any]:
        safety_distances = test_data.get("safety_distance_report", {})
        remark_updates = test_data.get("remark_updates", [])

        updated_remarks = []
        for update in remark_updates:
            result = self.preflight_manager.update_photo_remark(
                update["photo_id"],
                update["new_remark"],
                actor="designer_ajing"
            )
            if result and result["changed"]:
                updated_remarks.append(update["photo_id"])

        records_need_review = self.review_manager.get_records_needing_review()
        for record in records_need_review:
            photos = self.preflight_manager.get_photos_by_origin_id(record.coordinate_origin_id)
            for photo in photos:
                if photo.is_alert_label_blocked():
                    self.review_manager.submit_for_manager_review(
                        record.id, photo.id, submitter="designer_ajing"
                    )

        result = {
            "safety_distances_applied": safety_distances,
            "remarks_updated": updated_remarks,
            "records_submitted_for_manager_review": len(records_need_review),
            "pending_review_count": len(self.review_manager.get_records_needing_review()),
        }

        self._log("step3_update_report", result)
        return result

    def export_workflow_log(self, format_type: str = "json") -> str:
        log_data = {
            "generated_at": datetime.now().isoformat(),
            "total_entries": len(self._workflow_log),
            "entries": self._workflow_log,
        }

        if format_type == "json":
            return json.dumps(log_data, indent=2, ensure_ascii=False)
        return str(log_data)

    def _log(self, action: str, details: Dict[str, Any]):
        self._workflow_log.append({
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "details": details,
        })

    def generate_replay_script(self) -> str:
        pm = self.preflight_manager
        rm = self.review_manager

        origins_data = []
        photos_data = []
        remark_updates_data = []

        for record in pm.get_all_preflight_records():
            origin = pm.get_coordinate_origin(record.coordinate_origin_id)
            if origin:
                origins_data.append(origin.to_dict())

            photos = pm.get_photos_by_origin_id(record.coordinate_origin_id)
            for photo in photos:
                photos_data.append(photo.to_dict())

            for entry in record.history:
                if entry["action"] == "remark_updated":
                    remark_updates_data.append({
                        "photo_id": entry["details"]["photo_id"],
                        "old_remark": entry["details"]["old_remark"],
                        "new_remark": entry["details"]["new_remark"],
                        "actor": entry["actor"],
                    })

        replay_payload = json.dumps({
            "coordinate_origins": origins_data,
            "inspection_photos": photos_data,
            "remark_updates": remark_updates_data,
        }, indent=2, ensure_ascii=False)

        payload_literal = repr(replay_payload)

        header = '\n'.join([
            "#!/usr/bin/env python3",
            "# 机场廊桥停靠预演 - 重放脚本",
            "# 生成时间: " + datetime.now().isoformat(),
            "",
            "import sys",
            "import json",
            "",
            "sys.path.insert(0, '.')",
            "",
            "from airbridge import PreflightManager, ReviewManager, Visualizer, WorkflowEngine",
            "from airbridge.models import CoordinateOrigin, InspectionPhoto",
            "",
            "",
            "REPLAY_DATA = json.loads(" + payload_literal + ")",
            "",
            "",
        ])

        body = '\n'.join([
            "def replay():",
            "    pm = PreflightManager()",
            "    rm = ReviewManager(pm)",
            "    vz = Visualizer(pm)",
            "    we = WorkflowEngine(pm, rm, vz)",
            "",
            "    # ===== 步骤 1: 导入坐标原点说明 =====",
            "    print('[步骤 1] 导入坐标原点说明...')",
            "    print('-' * 60)",
            "    for origin_dict in REPLAY_DATA['coordinate_origins']:",
            "        origin = CoordinateOrigin(",
            "            id=origin_dict['id'],",
            "            name=origin_dict['name'],",
            "            x=origin_dict['x'],",
            "            y=origin_dict['y'],",
            "            z=origin_dict['z'],",
            "            description=origin_dict.get('description', ''),",
            "        )",
            "        created, skipped = pm.import_coordinate_origins([origin], actor='system_initial')",
            "        print(f'  导入 {origin.name}: 创建={len(created)}, 跳过={len(skipped)}')",
            "    print()",
            "",
            "    # ===== 步骤 2: 展陈设计师阿景补看巡检照片编号 =====",
            "    print('[步骤 2] 展陈设计师阿景补看巡检照片编号...')",
            "    print('-' * 60)",
            "    for photo_dict in REPLAY_DATA['inspection_photos']:",
            "        original_remark = photo_dict['remark']",
            "        for upd in REPLAY_DATA['remark_updates']:",
            "            if upd['photo_id'] == photo_dict['id'] and upd['old_remark'] != upd['new_remark']:",
            "                original_remark = upd['old_remark']",
            "                break",
            "        photo = InspectionPhoto(",
            "            id=photo_dict['id'],",
            "            photo_number=photo_dict['photo_number'],",
            "            coordinate_origin_id=photo_dict['coordinate_origin_id'],",
            "            remark=original_remark,",
            "            has_mobile_screenshot=photo_dict['has_mobile_screenshot'],",
            "            alert_label_visible=photo_dict['alert_label_visible'],",
            "        )",
            "        rec = pm.add_inspection_photo(photo, actor='designer_ajing')",
            "        if rec:",
            "            blocked = '遮挡' if photo.is_alert_label_blocked() else '正常'",
            "            print(f'  添加照片 {photo.photo_number}: {blocked}')",
            "    print()",
            "",
            "    # ===== 步骤 3: 安全距离报告更新 + 备注修改 =====",
            "    print('[步骤 3] 安全距离报告更新...')",
            "    print('-' * 60)",
            "    for upd in REPLAY_DATA['remark_updates']:",
            "        result = pm.update_photo_remark(",
            "            upd['photo_id'], upd['new_remark'], actor=upd['actor'],",
            "        )",
            "        if result and result.get('changed'):",
            "            print(f\"  备注更新: 照片={upd['photo_id']}, 改前={result['old']}, 改后={result['new']}\")",
            "",
            "    # 提交施工经理复核",
            "    need_review = rm.get_records_needing_review()",
            "    for rec in need_review:",
            "        photos = pm.get_photos_by_origin_id(rec.coordinate_origin_id)",
            "        for p in photos:",
            "            if p.is_alert_label_blocked():",
            "                rm.submit_for_manager_review(rec.id, p.id, submitter='designer_ajing')",
            "                print(f'  提交复核: 照片={p.photo_number}')",
            "    print()",
            "",
            "    # ===== 输出结果摘要 =====",
            "    print('=' * 60)",
            "    print('重放完成！结果摘要：')",
            "    print('=' * 60)",
            "    all_records = pm.get_all_preflight_records()",
            "    print(f'  预演记录总数: {len(all_records)}')",
            "    for r in all_records:",
            "        o = pm.get_coordinate_origin(r.coordinate_origin_id)",
            "        ps = pm.get_photos_by_origin_id(r.coordinate_origin_id)",
            "        blocked_photos = [p for p in ps if p.is_alert_label_blocked()]",
            "        origin_name = o.name if o else '未知'",
            "        review_flag = '是' if r.status in ('needs_review', 'manager_review') else '否'",
            "        print(f'  记录 {r.id}:')",
            "        print(f'    坐标原点: {origin_name}')",
            "        print(f'    状态: {r.status}')",
            "        print(f'    照片数: {len(ps)}, 其中遮挡: {len(blocked_photos)}')",
            "        print(f'    待复核: {review_flag}')",
            "    print(f'  待复核记录数: {len(rm.get_records_needing_review())}')",
            "",
            "",
            "if __name__ == '__main__':",
            "    replay()",
            "",
        ])

        return header + body

    def verify_history_diff(self, record_id: str) -> Optional[Dict[str, Any]]:
        history = self.preflight_manager.get_record_history(record_id)
        if not history:
            return None

        diffs = []
        for i in range(1, len(history)):
            prev = history[i - 1]
            curr = history[i]

            if curr["action"] == "remark_updated":
                diffs.append({
                    "timestamp": curr["timestamp"],
                    "actor": curr["actor"],
                    "type": "remark_change",
                    "photo_id": curr["details"]["photo_id"],
                    "old_value": curr["details"]["old_remark"],
                    "new_value": curr["details"]["new_remark"],
                })

        return {
            "record_id": record_id,
            "total_history_entries": len(history),
            "remark_changes": diffs,
        }
