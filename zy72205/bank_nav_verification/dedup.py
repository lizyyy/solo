from __future__ import annotations

import hashlib
import json
from typing import Iterable

from .models import ChangeType, ImportBatch, RemarkStatus, SettlementType, TaxRateRemark


def _remark_identity_key(remark: TaxRateRemark) -> str:
    return f"{remark.product_code}:{remark.original_line_number}"


def _compute_batch_hash(remarks: Iterable[TaxRateRemark]) -> str:
    keys = sorted(_remark_identity_key(r) for r in remarks)
    raw = json.dumps(keys, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class DedupService:
    def __init__(self):
        self._existing_keys: dict[str, TaxRateRemark] = {}
        self._batch_hashes: dict[str, ImportBatch] = {}

    def register_existing(self, remarks: Iterable[TaxRateRemark]):
        for r in remarks:
            key = _remark_identity_key(r)
            self._existing_keys[key] = r

    def check_batch_duplicate(self, remarks: list[TaxRateRemark]) -> ImportBatch | None:
        content_hash = _compute_batch_hash(remarks)
        return self._batch_hashes.get(content_hash)

    def dedup_import(
        self,
        remarks: list[TaxRateRemark],
        source_file: str = "",
        operator: str = "",
    ) -> tuple[list[TaxRateRemark], list[TaxRateRemark], ImportBatch]:
        existing_batch = self.check_batch_duplicate(remarks)
        if existing_batch is not None:
            return [], [], existing_batch

        content_hash = _compute_batch_hash(remarks)
        batch = ImportBatch(
            source_file=source_file,
            remark_count=len(remarks),
            content_hash=content_hash,
        )
        self._batch_hashes[content_hash] = batch

        new_remarks: list[TaxRateRemark] = []
        updated_remarks: list[TaxRateRemark] = []

        for remark in remarks:
            remark.batch_id = batch.id
            key = _remark_identity_key(remark)

            if key in self._existing_keys:
                existing = self._existing_keys[key]
                merged = self._merge_existing(existing, remark, operator)
                updated_remarks.append(merged)
            else:
                remark.original_settlement_type = remark.settlement_type
                remark.record_change(
                    change_type=ChangeType.IMPORT,
                    operator=operator,
                    reason="首次导入",
                )
                new_remarks.append(remark)
                self._existing_keys[key] = remark

        return new_remarks, updated_remarks, batch

    def _merge_existing(
        self,
        existing: TaxRateRemark,
        incoming: TaxRateRemark,
        operator: str,
    ) -> TaxRateRemark:
        fields_to_check = [
            "tax_rate",
            "settlement_type",
            "remark_text",
            "product_name",
        ]
        changed = False
        for f in fields_to_check:
            old_val = getattr(existing, f)
            new_val = getattr(incoming, f)
            if old_val != new_val:
                setattr(existing, f, new_val)
                changed = True

        if changed:
            existing.record_change(
                change_type=ChangeType.IMPORT,
                operator=operator,
                reason="重复导入时字段有变更，已更新",
            )

        return existing
