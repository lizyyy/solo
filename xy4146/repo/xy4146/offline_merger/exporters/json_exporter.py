import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from offline_merger.archiver.manifest import Manifest
from offline_merger.conflict.conflict_manager import ConflictManager, MergePlan


class JsonExporter:
    def __init__(self, indent: int = 2):
        self.indent = indent

    def _default_serializer(self, obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        if hasattr(obj, "to_dict"):
            return obj.to_dict()
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

    def export_merge_result(
        self,
        manifest: Manifest,
        conflict_manager: Optional[ConflictManager] = None,
        merge_plan: Optional[MergePlan] = None,
        additional_data: Optional[Dict[str, Any]] = None,
        output_path: Optional[str] = None,
    ) -> str:
        result: Dict[str, Any] = {
            "version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "task_id": manifest.task_id,
            "task_name": manifest.task_name,
            "manifest": manifest.to_dict(),
        }

        if conflict_manager:
            result["conflicts"] = {
                "summary": conflict_manager.get_summary(),
                "items": [c.to_dict() for c in conflict_manager.get_all_conflicts()],
            }

        if merge_plan:
            result["merge_plan"] = merge_plan.to_dict()

        if additional_data:
            result["additional_data"] = additional_data

        if output_path:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)

            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(
                    result,
                    f,
                    indent=self.indent,
                    ensure_ascii=False,
                    default=self._default_serializer,
                )
            return output_path

        return json.dumps(
            result,
            indent=self.indent,
            ensure_ascii=False,
            default=self._default_serializer,
        )

    def export_validation_results(
        self,
        validation_results: Dict[str, Any],
        output_path: Optional[str] = None,
    ) -> str:
        result = {
            "version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "validation_results": validation_results,
        }

        if output_path:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)

            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(
                    result,
                    f,
                    indent=self.indent,
                    ensure_ascii=False,
                    default=self._default_serializer,
                )
            return output_path

        return json.dumps(
            result,
            indent=self.indent,
            ensure_ascii=False,
            default=self._default_serializer,
        )

    def export_scan_results(
        self,
        scan_results: Dict[str, Any],
        output_path: Optional[str] = None,
    ) -> str:
        result = {
            "version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "scan_results": scan_results,
        }

        if output_path:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)

            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(
                    result,
                    f,
                    indent=self.indent,
                    ensure_ascii=False,
                    default=self._default_serializer,
                )
            return output_path

        return json.dumps(
            result,
            indent=self.indent,
            ensure_ascii=False,
            default=self._default_serializer,
        )

    def to_file(
        self,
        data: Dict[str, Any],
        output_path: str,
    ) -> str:
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(
                data,
                f,
                indent=self.indent,
                ensure_ascii=False,
                default=self._default_serializer,
            )

        return output_path
