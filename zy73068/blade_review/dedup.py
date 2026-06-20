from __future__ import annotations

import hashlib
from difflib import SequenceMatcher
from typing import Optional

from .models import BladeReport, InspectionRecord, SupplementaryMaterial


class DeduplicationResult:
    def __init__(
        self,
        is_duplicate: bool,
        matched_report_id: Optional[str] = None,
        name_mismatch: bool = False,
        stance_changed: bool = False,
        reason: str = "",
    ):
        self.is_duplicate = is_duplicate
        self.matched_report_id = matched_report_id
        self.name_mismatch = name_mismatch
        self.stance_changed = stance_changed
        self.reason = reason


class Deduplicator:
    NAME_SIMILARITY_THRESHOLD = 0.75

    def __init__(self) -> None:
        self._request_hashes: dict[str, str] = {}
        self._content_hashes: dict[str, str] = {}

    def register_report(self, report: BladeReport) -> None:
        request_hash = report.compute_request_hash()
        self._request_hashes[request_hash] = report.report_id
        for rec in report.records:
            rec_hash = rec.compute_hash()
            self._content_hashes[rec_hash] = rec.record_id

    def check_report_duplicate(self, report: BladeReport) -> DeduplicationResult:
        request_hash = report.compute_request_hash()
        if request_hash in self._request_hashes:
            existing_id = self._request_hashes[request_hash]
            return DeduplicationResult(
                is_duplicate=True,
                matched_report_id=existing_id,
                name_mismatch=False,
                reason="request_hash_match",
            )
        return DeduplicationResult(
            is_duplicate=False, reason="no_match"
        )

    def check_record_duplicate(
        self,
        record: InspectionRecord,
        existing_records: list[InspectionRecord],
    ) -> DeduplicationResult:
        rec_hash = record.compute_hash()
        if rec_hash in self._content_hashes:
            return DeduplicationResult(
                is_duplicate=True,
                matched_report_id=self._content_hashes[rec_hash],
                reason="content_hash_match",
            )
        for existing in existing_records:
            if existing.content_hash == rec_hash:
                return DeduplicationResult(
                    is_duplicate=True,
                    matched_report_id=existing.record_id,
                    reason="content_hash_match",
                )
        return DeduplicationResult(is_duplicate=False, reason="no_match")

    def check_material_name_mismatch(
        self,
        material: SupplementaryMaterial,
        existing_materials: list[SupplementaryMaterial],
    ) -> DeduplicationResult:
        content_hash = material.compute_hash()
        for existing in existing_materials:
            names_similar = self._names_similar(
                material.current_name, existing.current_name
            )
            same_content = existing.content_hash == content_hash
            if same_content and names_similar:
                return DeduplicationResult(
                    is_duplicate=True,
                    matched_report_id=existing.material_id,
                    name_mismatch=False,
                    stance_changed=False,
                    reason="exact_duplicate",
                )
            if same_content and not names_similar:
                return DeduplicationResult(
                    is_duplicate=True,
                    matched_report_id=existing.material_id,
                    name_mismatch=True,
                    stance_changed=False,
                    reason="name_changed_same_content",
                )
            if not same_content and names_similar:
                return DeduplicationResult(
                    is_duplicate=True,
                    matched_report_id=existing.material_id,
                    name_mismatch=False,
                    stance_changed=True,
                    reason="stance_changed_same_name",
                )
        return DeduplicationResult(is_duplicate=False, reason="no_match")

    @staticmethod
    def _names_similar(name_a: str, name_b: str) -> bool:
        if not name_a or not name_b:
            return False
        if name_a == name_b:
            return True
        if name_a.startswith(name_b) or name_b.startswith(name_a):
            return True
        similarity = SequenceMatcher(None, name_a, name_b).ratio()
        return similarity >= Deduplicator.NAME_SIMILARITY_THRESHOLD

    def merge_duplicate_report(
        self,
        incoming: BladeReport,
        existing: BladeReport,
    ) -> BladeReport:
        for rec in incoming.records:
            result = self.check_record_duplicate(rec, existing.records)
            if not result.is_duplicate:
                existing.records.append(rec)
                rec_hash = rec.compute_hash()
                self._content_hashes[rec_hash] = rec.record_id
        for mat in incoming.materials:
            mat_result = self.check_material_name_mismatch(mat, existing.materials)
            if not mat_result.is_duplicate:
                existing.materials.append(mat)
            elif mat_result.name_mismatch:
                for idx, ex_mat in enumerate(existing.materials):
                    if ex_mat.material_id == mat_result.matched_report_id:
                        existing.materials[idx].name_changed = True
                        existing.materials[idx].original_name = ex_mat.current_name
                        existing.materials[idx].current_name = mat.current_name
                        existing.materials[idx].stance_changed = (
                            ex_mat.content != mat.content
                        )
                        existing.materials[idx].previous_stance = ex_mat.content
                        existing.materials[idx].content = mat.content
                        existing.materials[idx].version += 1
                        break
            elif mat_result.stance_changed:
                for idx, ex_mat in enumerate(existing.materials):
                    if ex_mat.material_id == mat_result.matched_report_id:
                        existing.materials[idx].stance_changed = True
                        existing.materials[idx].previous_stance = ex_mat.content
                        existing.materials[idx].content = mat.content
                        existing.materials[idx].content_hash = mat.content_hash
                        existing.materials[idx].version += 1
                        break
        return existing
