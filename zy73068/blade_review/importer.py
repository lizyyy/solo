from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .audit import AuditTrail
from .dedup import Deduplicator
from .gap_detector import GapDetector
from .models import (
    AuditLogEntry,
    BladeReport,
    InspectionRecord,
    ReviewStatus,
    SupplementaryMaterial,
)
from .version_tracker import VersionTracker


@dataclass
class ImportResult:
    report_id: str = ""
    records_added: int = 0
    records_skipped: int = 0
    materials_added: int = 0
    materials_updated: int = 0
    materials_skipped: int = 0
    suspensions: int = 0
    is_new_report: bool = True
    notes_preserved: int = 0


class ReportImporter:
    def __init__(
        self,
        deduplicator: Optional[Deduplicator] = None,
        version_tracker: Optional[VersionTracker] = None,
        gap_detector: Optional[GapDetector] = None,
        audit_trail: Optional[AuditTrail] = None,
    ) -> None:
        self.dedup = deduplicator or Deduplicator()
        self.tracker = version_tracker or VersionTracker()
        self.gap = gap_detector or GapDetector()
        self.audit = audit_trail or AuditTrail()

    def import_report(
        self,
        incoming: BladeReport,
        existing: Optional[BladeReport] = None,
        operator: str = "",
    ) -> ImportResult:
        result = ImportResult()

        if existing is None:
            dedup_check = self.dedup.check_report_duplicate(incoming)
            if dedup_check.is_duplicate:
                result.is_new_report = False
                return result

            for rec in incoming.records:
                rec.compute_hash()
            for mat in incoming.materials:
                mat.compute_hash()
                self.tracker.capture(mat)

            suspensions = self.gap.check_and_suspend(incoming)
            result.suspensions = len(suspensions)

            self.dedup.register_report(incoming)
            result.report_id = incoming.report_id
            result.records_added = len(incoming.records)
            result.materials_added = len(incoming.materials)
            result.is_new_report = True

            self.audit.log_action(
                report_id=incoming.report_id,
                action="import_new",
                operator=operator,
                detail=f"records={result.records_added}, materials={result.materials_added}",
            )
            return result

        result.is_new_report = False
        result.report_id = existing.report_id

        for rec in incoming.records:
            rec.compute_hash()
            dedup_result = self.dedup.check_record_duplicate(
                rec, existing.records
            )
            if dedup_result.is_duplicate:
                result.records_skipped += 1
                for ex_rec in existing.records:
                    if ex_rec.record_id == dedup_result.matched_report_id:
                        if rec.manual_note and not ex_rec.manual_note:
                            ex_rec.manual_note = rec.manual_note
                            result.notes_preserved += 1
                        elif rec.manual_note and ex_rec.manual_note:
                            if rec.manual_note not in ex_rec.manual_note:
                                ex_rec.manual_note += " | " + rec.manual_note
                                result.notes_preserved += 1
                        break
            else:
                existing.records.append(rec)
                self.dedup._content_hashes[rec.content_hash] = rec.record_id
                result.records_added += 1

        for mat in incoming.materials:
            mat.compute_hash()
            mat_result = self.dedup.check_material_name_mismatch(
                mat, existing.materials
            )
            if mat_result.is_duplicate and mat_result.name_mismatch:
                self._merge_material_with_version(mat, existing, operator)
                result.materials_updated += 1
            elif mat_result.is_duplicate and mat_result.stance_changed:
                self._merge_material_stance_change(mat, existing, operator)
                result.materials_updated += 1
            elif mat_result.is_duplicate:
                result.materials_skipped += 1
            else:
                existing.materials.append(mat)
                self.tracker.capture(mat)
                result.materials_added += 1

        suspensions = self.gap.check_and_suspend(existing)
        result.suspensions = len(suspensions)

        self.audit.log_action(
            report_id=existing.report_id,
            action="import_merge",
            operator=operator,
            detail=(
                f"added=({result.records_added}rec,{result.materials_added}mat) "
                f"skipped=({result.records_skipped}rec,{result.materials_skipped}mat) "
                f"updated={result.materials_updated}mat"
            ),
        )

        return result

    def _merge_material_with_version(
        self,
        incoming: SupplementaryMaterial,
        existing_report: BladeReport,
        operator: str,
    ) -> None:
        for idx, ex_mat in enumerate(existing_report.materials):
            if ex_mat.content_hash == incoming.content_hash or ex_mat.material_id == incoming.material_id:
                changes = self.tracker.apply_update(
                    ex_mat,
                    new_name=incoming.current_name,
                    new_content=incoming.content,
                    operator=operator,
                )
                for change in changes:
                    self.audit.log_change(
                        report_id=existing_report.report_id,
                        material_id=ex_mat.material_id,
                        change=change,
                    )
                existing_report.materials[idx] = ex_mat
                break

    def _merge_material_stance_change(
        self,
        incoming: SupplementaryMaterial,
        existing_report: BladeReport,
        operator: str,
    ) -> None:
        for idx, ex_mat in enumerate(existing_report.materials):
            if ex_mat.material_id == incoming.material_id or self.dedup._names_similar(
                ex_mat.current_name, incoming.current_name
            ):
                old_content = ex_mat.content
                changes = self.tracker.apply_update(
                    ex_mat,
                    new_content=incoming.content,
                    operator=operator,
                )
                ex_mat.stance_changed = True
                ex_mat.previous_stance = old_content
                for change in changes:
                    change.reason = "stance_changed_same_name"
                    self.audit.log_change(
                        report_id=existing_report.report_id,
                        material_id=ex_mat.material_id,
                        change=change,
                    )
                existing_report.materials[idx] = ex_mat
                break
