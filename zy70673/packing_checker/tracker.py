from typing import List, Dict, Any
from collections import defaultdict
from .models import MaterialItem, MissingItem, CheckResult


class SourceTracker:
    def __init__(self):
        self.line_tracking: Dict[int, Dict[str, Any]] = {}
        self.material_sources: Dict[str, List[int]] = defaultdict(list)

    def track_materials(self, materials: List[MaterialItem], invalid_rows: List[MaterialItem]):
        all_items = materials + invalid_rows

        for item in all_items:
            self.line_tracking[item.line_number] = {
                "city": item.city,
                "material_name": item.material_name,
                "is_valid": item.is_valid,
                "error_message": item.error_message,
                "raw_data": item.raw_data,
            }
            if item.material_name:
                self.material_sources[item.material_name].append(item.line_number)

    def get_source_info(self, line_number: int) -> Dict[str, Any]:
        return self.line_tracking.get(line_number, {})

    def get_material_lines(self, material_name: str) -> List[int]:
        return sorted(self.material_sources.get(material_name, []))

    def find_invalid_rows(self) -> List[Dict[str, Any]]:
        invalid = []
        for line_num, info in self.line_tracking.items():
            if not info["is_valid"]:
                invalid.append({"line_number": line_num, **info})
        return sorted(invalid, key=lambda x: x["line_number"])

    def generate_tracking_report(self) -> Dict[str, Any]:
        return {
            "total_lines_tracked": len(self.line_tracking),
            "invalid_rows_count": len(self.find_invalid_rows()),
            "materials_tracked": len(self.material_sources),
            "material_line_counts": {
                mat: len(lines) for mat, lines in sorted(self.material_sources.items())
            },
        }
