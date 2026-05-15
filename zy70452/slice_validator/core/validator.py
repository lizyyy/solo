import os
import hashlib
import xxhash
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from collections import defaultdict

from slice_validator.models.schemas import (
    BatchSubmission,
    SliceFile,
    SliceStatus,
    FailureType,
    ValidationResult,
)


class SliceValidator:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.results_dir = self.data_dir / "results"
        self.candidates_dir = self.data_dir / "candidates"
        self.results_dir.mkdir(parents=True, exist_ok=True)
        self.candidates_dir.mkdir(parents=True, exist_ok=True)

    def calculate_checksum(self, file_path: str, algorithm: str = "xxh3_64") -> str:
        if not os.path.exists(file_path):
            return ""

        if algorithm == "xxh3_64":
            h = xxhash.xxh3_64()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    h.update(chunk)
            return h.hexdigest()
        else:
            h = hashlib.sha256()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    h.update(chunk)
            return h.hexdigest()

    def validate_single_slice(
        self, slice_file: SliceFile, base_dir: str = ""
    ) -> Tuple[SliceStatus, Optional[FailureType], Dict]:
        full_path = os.path.join(base_dir, slice_file.file_path) if base_dir else slice_file.file_path

        if not os.path.exists(full_path):
            return SliceStatus.FAILED, FailureType.MISSING_SLICE, {
                "error": "文件不存在",
                "expected_path": full_path,
            }

        actual_size = os.path.getsize(full_path)
        if actual_size != slice_file.file_size:
            return SliceStatus.FAILED, FailureType.SIZE_MISMATCH, {
                "error": "文件大小不匹配",
                "expected": slice_file.file_size,
                "actual": actual_size,
            }

        actual_checksum = self.calculate_checksum(full_path)
        if actual_checksum != slice_file.checksum:
            return SliceStatus.FAILED, FailureType.CHECKSUM_MISMATCH, {
                "error": "校验和不匹配",
                "expected": slice_file.checksum,
                "actual": actual_checksum,
            }

        return SliceStatus.SUCCESS, None, {
            "actual_size": actual_size,
            "actual_checksum": actual_checksum,
        }

    def check_previous_result(self, batch_id: str) -> Optional[Dict]:
        result_file = self.results_dir / f"{batch_id}_validation.json"
        if result_file.exists():
            import json

            with open(result_file, "r") as f:
                return json.load(f)
        return None

    def detect_partial_success(
        self, results: List[Tuple[SliceStatus, Optional[FailureType], Dict]]
    ) -> bool:
        success_count = sum(1 for r in results if r[0] == SliceStatus.SUCCESS)
        total = len(results)
        return 0 < success_count < total

    def validate_batch(self, batch: BatchSubmission, base_dir: str = "", force_revalidate: bool = False) -> ValidationResult:
        previous_result = self.check_previous_result(batch.batch_id)
        if previous_result and not force_revalidate:
            return ValidationResult(**previous_result)

        results = []
        failure_groups = defaultdict(list)
        validated_slices = []

        for slice_file in batch.slices:
            status, failure_type, details = self.validate_single_slice(slice_file, base_dir)
            results.append((status, failure_type, details))

            validated_slice = {
                "file_name": slice_file.file_name,
                "slice_index": slice_file.slice_index,
                "status": status.value,
                "details": details,
            }

            if failure_type:
                failure_groups[failure_type].append(slice_file.file_name)
                validated_slice["failure_type"] = failure_type.value

            validated_slices.append(validated_slice)

        if self.detect_partial_success(results):
            failure_groups[FailureType.PARTIAL_SUCCESS].append(
                f"批次 {batch.batch_id} 部分成功，需要人工介入"
            )

        success_count = sum(1 for r in results if r[0] == SliceStatus.SUCCESS)
        failed_count = sum(1 for r in results if r[0] == SliceStatus.FAILED)
        partial_count = len(batch.slices) - success_count - failed_count

        if failed_count > 0 or FailureType.PARTIAL_SUCCESS in failure_groups:
            overall_status = SliceStatus.PARTIAL if partial_count > 0 else SliceStatus.FAILED
            if FailureType.PARTIAL_SUCCESS in failure_groups:
                overall_status = SliceStatus.PARTIAL
        else:
            overall_status = SliceStatus.SUCCESS

        validation_result = ValidationResult(
            batch_id=batch.batch_id,
            overall_status=overall_status,
            success_count=success_count,
            failed_count=failed_count,
            partial_count=partial_count,
            total_slices=len(batch.slices),
            failure_groups=dict(failure_groups),
            validated_slices=validated_slices,
        )

        self._save_validation_result(validation_result)
        return validation_result

    def _save_validation_result(self, result: ValidationResult) -> None:
        import json

        result_file = self.results_dir / f"{result.batch_id}_validation.json"
        with open(result_file, "w", encoding="utf-8") as f:
            json.dump(result.model_dump(mode="json"), f, ensure_ascii=False, indent=2)

    def filter_by_failure_type(self, batch_id: str, failure_type: FailureType) -> List[Dict]:
        result = self.check_previous_result(batch_id)
        if not result:
            return []

        return [
            s
            for s in result["validated_slices"]
            if s.get("failure_type") == failure_type.value
        ]
