import json
from typing import Dict, List, Optional, Any, Tuple
from .models import CoordinateOrigin, InspectionPhoto, PreflightRecord


class Visualizer:
    def __init__(self, preflight_manager):
        self.preflight_manager = preflight_manager
        self._view_mode = "list"

    def set_view_mode(self, mode: str) -> bool:
        valid_modes = ["list", "3d", "chart"]
        if mode not in valid_modes:
            return False
        self._view_mode = mode
        return True

    def get_view_mode(self) -> str:
        return self._view_mode

    def click_record(self, record_id: str) -> Optional[Dict[str, Any]]:
        record = self.preflight_manager.get_preflight_record(record_id)
        if not record:
            return None

        origin = self.preflight_manager.get_coordinate_origin(record.coordinate_origin_id)
        photos = self.preflight_manager.get_photos_by_origin_id(record.coordinate_origin_id)

        return {
            "record": record.to_dict(),
            "coordinate_origin": origin.to_dict() if origin else None,
            "inspection_photos": [p.to_dict() for p in photos],
            "back_links": {
                "to_origin": record.coordinate_origin_id,
                "to_photos": [p.id for p in photos],
            },
        }

    def navigate_to_origin(self, origin_id: str) -> Optional[Dict[str, Any]]:
        origin = self.preflight_manager.get_coordinate_origin(origin_id)
        if not origin:
            return None

        record = self.preflight_manager.get_preflight_by_origin_id(origin_id)
        photos = self.preflight_manager.get_photos_by_origin_id(origin_id)

        return {
            "type": "origin_detail",
            "origin": origin.to_dict(),
            "preflight_record": record.to_dict() if record else None,
            "photos": [p.to_dict() for p in photos],
        }

    def navigate_to_photo(self, photo_id: str) -> Optional[Dict[str, Any]]:
        photo = self.preflight_manager.get_inspection_photo(photo_id)
        if not photo:
            return None

        origin = self.preflight_manager.get_coordinate_origin(photo.coordinate_origin_id)
        record = self.preflight_manager.get_preflight_by_origin_id(photo.coordinate_origin_id)

        return {
            "type": "photo_detail",
            "photo": photo.to_dict(),
            "origin": origin.to_dict() if origin else None,
            "preflight_record": record.to_dict() if record else None,
            "blocked_alert_check": {
                "has_mobile_screenshot": photo.has_mobile_screenshot,
                "alert_label_visible": photo.alert_label_visible,
                "is_blocked": photo.is_alert_label_blocked(),
            },
        }

    def generate_3d_view_data(self) -> Dict[str, Any]:
        origins = []
        for record in self.preflight_manager.get_all_preflight_records():
            origin = self.preflight_manager.get_coordinate_origin(record.coordinate_origin_id)
            if origin:
                origins.append({
                    "id": origin.id,
                    "name": origin.name,
                    "position": {"x": origin.x, "y": origin.y, "z": origin.z},
                    "status": record.status,
                    "has_block": record.block_detected,
                    "record_id": record.id,
                })

        return {
            "view_mode": "3d",
            "coordinate_origins": origins,
            "interaction": {
                "click_handler": "navigate_to_record",
                "back_enabled": True,
            },
        }

    def generate_chart_view_data(self) -> Dict[str, Any]:
        all_records = self.preflight_manager.get_all_preflight_records()
        status_counts = {}
        block_stats = {
            "total": len(all_records),
            "with_block": 0,
            "without_block": 0,
            "pending_review": 0,
        }

        for record in all_records:
            status = record.status
            status_counts[status] = status_counts.get(status, 0) + 1

            if record.block_detected:
                block_stats["with_block"] += 1
            else:
                block_stats["without_block"] += 1

            if record.review_status == "pending":
                block_stats["pending_review"] += 1

        return {
            "view_mode": "chart",
            "status_distribution": status_counts,
            "block_statistics": block_stats,
            "interaction": {
                "click_segment": "filter_records_by_status",
                "back_enabled": True,
            },
        }

    def export_visualization_report(self, format_type: str = "json") -> str:
        data = {
            "view_mode": self._view_mode,
            "3d_view": self.generate_3d_view_data(),
            "chart_view": self.generate_chart_view_data(),
            "records": [
                {
                    "record": r.to_dict(),
                    "origin": self.preflight_manager.get_coordinate_origin(r.coordinate_origin_id).to_dict(),
                    "photos": [p.to_dict() for p in self.preflight_manager.get_photos_by_origin_id(r.coordinate_origin_id)],
                }
                for r in self.preflight_manager.get_all_preflight_records()
            ],
        }

        if format_type == "json":
            return json.dumps(data, indent=2, ensure_ascii=False)
        return str(data)

    def get_replay_commands(self) -> List[str]:
        commands = []
        for record in self.preflight_manager.get_all_preflight_records():
            for entry in record.history:
                cmd = self._history_to_command(entry)
                if cmd:
                    commands.append(cmd)
        return commands

    def _history_to_command(self, history_entry: Dict[str, Any]) -> Optional[str]:
        action = history_entry.get("action")
        details = history_entry.get("details", {})
        actor = history_entry.get("actor", "system")

        cmd_map = {
            "import": f"airbridge import --origin={details.get('origin_id')} --actor={actor}",
            "photo_added": f"airbridge add-photo --photo={details.get('photo_id')} --origin={details.get('photo_id')} --actor={actor}",
            "remark_updated": f"airbridge update-remark --photo={details.get('photo_id')} --remark='{details.get('new_remark')}' --actor={actor}",
            "submitted_for_review": f"airbridge submit-review --record={details.get('photo_id')} --photo={details.get('photo_id')} --actor={actor}",
            "block_confirmed": f"airbridge manager-review --record={details.get('photo_id')} --blocked=true --actor={actor}",
            "block_cleared": f"airbridge manager-review --record={details.get('photo_id')} --blocked=false --actor={actor}",
            "block_resolved": f"airbridge resolve-block --photo={details.get('photo_id')} --resolution={details.get('resolution')} --actor={actor}",
            "rollback": f"airbridge rollback --record={details.get('photo_id')} --actor={actor}",
        }

        return cmd_map.get(action)
