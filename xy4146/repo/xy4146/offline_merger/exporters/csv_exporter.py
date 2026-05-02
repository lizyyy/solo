import csv
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

from offline_merger.conflict.conflict_manager import ConflictManager, ConflictItem


class CSVExporter:
    def __init__(self):
        pass

    def export_conflicts(
        self,
        conflict_manager: ConflictManager,
        output_path: str,
        include_resolved: bool = True,
    ) -> str:
        conflicts = conflict_manager.get_all_conflicts()

        if not include_resolved:
            conflicts = [
                c for c in conflicts
                if c.status.value != "resolved"
            ]

        rows = []
        for conflict in conflicts:
            row = {
                "conflict_id": conflict.conflict_id,
                "conflict_type": conflict.conflict_type.value,
                "severity": conflict.severity,
                "status": conflict.status.value,
                "source_packages": ", ".join(conflict.source_packages),
                "message": conflict.message,
                "action": conflict.action.value,
                "resolved_at": conflict.resolved_at.isoformat() if conflict.resolved_at else "",
                "resolved_by": conflict.resolved_by or "",
                "resolution_notes": conflict.resolution_notes or "",
            }

            if conflict.affected_items:
                for i, item in enumerate(conflict.affected_items[:5]):
                    row[f"affected_item_{i+1}"] = str(item)

            rows.append(row)

        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        if not rows:
            with open(output_file, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["无冲突数据"])
            return output_path

        fieldnames = list(rows[0].keys())

        with open(output_file, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        return output_path

    def export_validation_summary(
        self,
        validation_results: Dict[str, Any],
        output_path: str,
    ) -> str:
        rows = []

        hash_result = validation_results.get("hash", {})
        if hash_result:
            conflicts = hash_result.get("conflicts", [])
            for conflict in conflicts:
                row = {
                    "validation_type": "hash_conflict",
                    "file_name": conflict.get("file_name", ""),
                    "conflict_type": conflict.get("conflict_type", ""),
                    "message": conflict.get("message", ""),
                    "affected_files": str(conflict.get("files", [])),
                }
                rows.append(row)

        attachment_result = validation_results.get("attachment", {})
        if attachment_result:
            missing = attachment_result.get("missing_attachments", [])
            for item in missing:
                row = {
                    "validation_type": "missing_attachment",
                    "point_id": item.get("point_id", ""),
                    "attachment_reference": item.get("attachment_reference", ""),
                    "source_package": item.get("source_package", ""),
                    "message": item.get("message", ""),
                    "search_paths": str(item.get("search_paths", [])),
                }
                rows.append(row)

        time_result = validation_results.get("time", {})
        if time_result:
            issues = time_result.get("issues", [])
            for issue in issues:
                row = {
                    "validation_type": "time_order_issue",
                    "track_name": issue.get("track_name", ""),
                    "segment_index": issue.get("segment_index", ""),
                    "point_index": issue.get("point_index", ""),
                    "time_delta_seconds": issue.get("time_delta_seconds", ""),
                    "source_package": issue.get("source_package", ""),
                    "message": issue.get("message", ""),
                }
                rows.append(row)

        coord_result = validation_results.get("coordinate", {})
        if coord_result:
            issues = coord_result.get("issues", [])
            for issue in issues:
                row = {
                    "validation_type": "coordinate_issue",
                    "item_type": issue.get("item_type", ""),
                    "item_name": issue.get("item_name", ""),
                    "issue_type": issue.get("issue_type", ""),
                    "lat": issue.get("lat", ""),
                    "lon": issue.get("lon", ""),
                    "source_package": issue.get("source_package", ""),
                    "message": issue.get("message", ""),
                }
                rows.append(row)

        duplicate_result = validation_results.get("duplicate", {})
        if duplicate_result:
            duplicates = duplicate_result.get("duplicates", [])
            for dup in duplicates:
                row = {
                    "validation_type": "duplicate_point",
                    "group_id": dup.get("group_id", ""),
                    "distance_meters": dup.get("distance_meters", ""),
                    "time_delta_seconds": dup.get("time_delta_seconds", ""),
                    "suggested_action": dup.get("suggested_action", ""),
                    "message": dup.get("message", ""),
                    "affected_points": str(dup.get("points", [])),
                }
                rows.append(row)

        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        if not rows:
            with open(output_file, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["无异常数据"])
            return output_path

        fieldnames = list(rows[0].keys())

        with open(output_file, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        return output_path

    def export_scan_results(
        self,
        scan_results: Dict[str, Any],
        output_path: str,
    ) -> str:
        rows = []

        packages = scan_results.get("packages", {})
        for package_name, package_data in packages.items():
            files = package_data.get("files", [])
            for file_info in files:
                row = {
                    "source_package": package_name,
                    "file_name": file_info.get("file_name", ""),
                    "file_path": file_info.get("file_path", ""),
                    "file_type": file_info.get("file_type", ""),
                    "file_size": file_info.get("file_size", ""),
                    "hash_sha256": file_info.get("hash_sha256", "")[:16] + "...",
                    "last_modified": file_info.get("last_modified", ""),
                    "errors": ", ".join(file_info.get("errors", [])),
                    "warnings": ", ".join(file_info.get("warnings", [])),
                }
                rows.append(row)

        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        if not rows:
            with open(output_file, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["无扫描数据"])
            return output_path

        fieldnames = list(rows[0].keys())

        with open(output_file, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        return output_path
