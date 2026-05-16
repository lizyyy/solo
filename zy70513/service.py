import uuid
import json
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from collections import defaultdict

from models import (
    ConfigReceipt, ConfigReceiptCreate, ConfigReceiptQuery,
    ReceiptStatus, DiffType, DiffSegment, ReceiptReport,
    AuditLog, StatusUpdateRequest, ManualCorrectionRequest,
    ReceiptSummary
)


class ConfigReceiptService:
    def __init__(self):
        self._receipts: Dict[str, ConfigReceipt] = {}
        self._default_timeout_hours = 24

    def _generate_id(self) -> str:
        return str(uuid.uuid4())

    def _add_audit_log(
        self,
        receipt: ConfigReceipt,
        operation: str,
        operator: Optional[str] = None,
        from_status: Optional[ReceiptStatus] = None,
        to_status: Optional[ReceiptStatus] = None,
        reason: Optional[str] = None,
        original_input: Optional[Dict[str, Any]] = None,
        processing_basis: Optional[Dict[str, Any]] = None,
        final_conclusion: Optional[str] = None
    ) -> None:
        audit_log = AuditLog(
            id=self._generate_id(),
            timestamp=datetime.now(),
            operator=operator,
            operation=operation,
            from_status=from_status,
            to_status=to_status,
            reason=reason,
            original_input=original_input,
            processing_basis=processing_basis,
            final_conclusion=final_conclusion
        )
        receipt.audit_logs.append(audit_log)

    def _detect_diffs(
        self,
        expected: Dict[str, Any],
        actual: Dict[str, Any],
        path: str = ""
    ) -> List[DiffSegment]:
        diffs = []
        all_keys = set(expected.keys()) | set(actual.keys())
        for key in all_keys:
            current_path = f"{path}.{key}" if path else key
            if key not in expected:
                diffs.append(DiffSegment(
                    id=self._generate_id(),
                    diff_type=DiffType.EXTRA_KEY,
                    key_path=current_path,
                    expected_value=None,
                    actual_value=actual[key],
                    description=f"Unexpected key found in actual config"
                ))
            elif key not in actual:
                diffs.append(DiffSegment(
                    id=self._generate_id(),
                    diff_type=DiffType.MISSING_KEY,
                    key_path=current_path,
                    expected_value=expected[key],
                    actual_value=None,
                    description=f"Missing key in actual config"
                ))
            else:
                expected_val = expected[key]
                actual_val = actual[key]
                if isinstance(expected_val, dict) and isinstance(actual_val, dict):
                    diffs.extend(self._detect_diffs(expected_val, actual_val, current_path))
                elif isinstance(expected_val, list) and isinstance(actual_val, list):
                    expected_str = json.dumps(expected_val, sort_keys=True)
                    actual_str = json.dumps(actual_val, sort_keys=True)
                    if expected_str != actual_str:
                        diffs.append(DiffSegment(
                            id=self._generate_id(),
                            diff_type=DiffType.VALUE_MISMATCH,
                            key_path=current_path,
                            expected_value=expected_val,
                            actual_value=actual_val,
                            description=f"Array content mismatch"
                        ))
                elif type(expected_val) != type(actual_val):
                    diffs.append(DiffSegment(
                        id=self._generate_id(),
                        diff_type=DiffType.TYPE_MISMATCH,
                        key_path=current_path,
                        expected_value=expected_val,
                        actual_value=actual_val,
                        description=f"Type mismatch: expected {type(expected_val).__name__}, got {type(actual_val).__name__}"
                    ))
                elif expected_val != actual_val:
                    diffs.append(DiffSegment(
                        id=self._generate_id(),
                        diff_type=DiffType.VALUE_MISMATCH,
                        key_path=current_path,
                        expected_value=expected_val,
                        actual_value=actual_val,
                        description=f"Value mismatch"
                    ))
        return diffs

    def _generate_report(self, diffs: List[DiffSegment]) -> ReceiptReport:
        total_checks = len(diffs)
        failed_checks = len(diffs)
        return ReceiptReport(
            total_checks=total_checks,
            passed_checks=0,
            failed_checks=failed_checks,
            diff_count=len(diffs),
            has_critical_diff=len(diffs) > 0,
            summary=f"Detected {len(diffs)} configuration differences" if diffs else "Configuration matches exactly",
            details={"diff_types": {d.diff_type: sum(1 for d in diffs if d.diff_type == d.diff_type) for d in diffs}}
        )

    def create_receipt(self, data: ConfigReceiptCreate) -> ConfigReceipt:
        receipt_id = self._generate_id()
        receipt = ConfigReceipt(
            id=receipt_id,
            service_name=data.service_name,
            config_version=data.config_version,
            snapshot_version=data.snapshot_version,
            instance_id=data.instance_id,
            raw_payload=data.raw_payload,
            timeout_at=datetime.now() + timedelta(hours=self._default_timeout_hours)
        )
        if data.expected_config and data.actual_config:
            diffs = self._detect_diffs(data.expected_config, data.actual_config)
            receipt.diffs = diffs
            receipt.report = self._generate_report(diffs)
            if not diffs:
                receipt.status = ReceiptStatus.CONFIRMED
                receipt.receipt_time = datetime.now()
        self._add_audit_log(
            receipt,
            operation="CREATE",
            original_input=data.dict(),
            processing_basis={
                "expected_config_provided": data.expected_config is not None,
                "actual_config_provided": data.actual_config is not None
            }
        )
        receipt.updated_at = datetime.now()
        self._receipts[receipt_id] = receipt
        return receipt

    def get_receipt(self, receipt_id: str) -> Optional[ConfigReceipt]:
        return self._receipts.get(receipt_id)

    def query_receipts(self, query: ConfigReceiptQuery) -> List[ConfigReceipt]:
        results = list(self._receipts.values())
        if query.service_name:
            results = [r for r in results if r.service_name == query.service_name]
        if query.config_version:
            results = [r for r in results if r.config_version == query.config_version]
        if query.snapshot_version:
            results = [r for r in results if r.snapshot_version == query.snapshot_version]
        if query.instance_id:
            results = [r for r in results if r.instance_id == query.instance_id]
        if query.status:
            results = [r for r in results if r.status == query.status]
        if query.start_time:
            results = [r for r in results if r.created_at >= query.start_time]
        if query.end_time:
            results = [r for r in results if r.created_at <= query.end_time]
        if query.has_diff is not None:
            results = [r for r in results if (len(r.diffs) > 0) == query.has_diff]
        return results

    def update_status(self, receipt_id: str, request: StatusUpdateRequest) -> Optional[ConfigReceipt]:
        receipt = self._receipts.get(receipt_id)
        if not receipt:
            return None
        old_status = receipt.status
        receipt.status = request.status
        receipt.updated_at = datetime.now()
        if request.status == ReceiptStatus.CONFIRMED:
            receipt.receipt_time = datetime.now()
        self._add_audit_log(
            receipt,
            operation="STATUS_UPDATE",
            operator=request.operator,
            from_status=old_status,
            to_status=request.status,
            reason=request.reason,
            processing_basis=request.processing_basis,
            final_conclusion=request.final_conclusion
        )
        return receipt

    def handle_exception(
        self,
        receipt_id: str,
        reason: str,
        operator: Optional[str] = None,
        processing_basis: Optional[Dict[str, Any]] = None,
        final_conclusion: Optional[str] = None
    ) -> Optional[ConfigReceipt]:
        receipt = self._receipts.get(receipt_id)
        if not receipt:
            return None
        old_status = receipt.status
        receipt.status = ReceiptStatus.BLOCKED
        receipt.updated_at = datetime.now()
        self._add_audit_log(
            receipt,
            operation="EXCEPTION_HANDLE",
            operator=operator,
            from_status=old_status,
            to_status=ReceiptStatus.BLOCKED,
            reason=reason,
            processing_basis=processing_basis,
            final_conclusion=final_conclusion
        )
        return receipt

    def manual_correction(self, receipt_id: str, request: ManualCorrectionRequest) -> Optional[ConfigReceipt]:
        receipt = self._receipts.get(receipt_id)
        if not receipt:
            return None
        old_status = receipt.status
        if request.corrected_diffs is not None:
            receipt.diffs = request.corrected_diffs
        if request.corrected_report is not None:
            receipt.report = request.corrected_report
        receipt.status = ReceiptStatus.COMPENSATED
        receipt.updated_at = datetime.now()
        self._add_audit_log(
            receipt,
            operation="MANUAL_CORRECTION",
            operator=request.operator,
            from_status=old_status,
            to_status=ReceiptStatus.COMPENSATED,
            reason=request.reason,
            processing_basis=request.processing_basis,
            final_conclusion=request.final_conclusion
        )
        return receipt

    def revoke_receipt(self, receipt_id: str, operator: str, reason: str) -> Optional[ConfigReceipt]:
        receipt = self._receipts.get(receipt_id)
        if not receipt:
            return None
        old_status = receipt.status
        receipt.status = ReceiptStatus.REVOKED
        receipt.updated_at = datetime.now()
        self._add_audit_log(
            receipt,
            operation="REVOKE",
            operator=operator,
            from_status=old_status,
            to_status=ReceiptStatus.REVOKED,
            reason=reason,
            final_conclusion="Receipt revoked by operator"
        )
        return receipt

    def get_timeout_receipts(self) -> List[ConfigReceipt]:
        now = datetime.now()
        return [
            r for r in self._receipts.values()
            if r.status == ReceiptStatus.PENDING and r.timeout_at and now > r.timeout_at
        ]

    def get_summary(
        self,
        service_name: Optional[str] = None,
        config_version: Optional[str] = None,
        snapshot_version: Optional[str] = None
    ) -> List[ReceiptSummary]:
        groups: Dict[Tuple[str, str, str], List[ConfigReceipt]] = defaultdict(list)
        for receipt in self._receipts.values():
            if service_name and receipt.service_name != service_name:
                continue
            if config_version and receipt.config_version != config_version:
                continue
            if snapshot_version and receipt.snapshot_version != snapshot_version:
                continue
            key = (receipt.service_name, receipt.config_version, receipt.snapshot_version)
            groups[key].append(receipt)
        summaries = []
        for (svc, ver, snap), receipts in groups.items():
            total = len(receipts)
            pending = sum(1 for r in receipts if r.status == ReceiptStatus.PENDING)
            confirmed = sum(1 for r in receipts if r.status == ReceiptStatus.CONFIRMED)
            blocked = sum(1 for r in receipts if r.status == ReceiptStatus.BLOCKED)
            revoked = sum(1 for r in receipts if r.status == ReceiptStatus.REVOKED)
            compensated = sum(1 for r in receipts if r.status == ReceiptStatus.COMPENSATED)
            timeout = sum(1 for r in receipts if r.timeout_at and datetime.now() > r.timeout_at and r.status == ReceiptStatus.PENDING)
            has_any_diff = any(len(r.diffs) > 0 for r in receipts)
            summaries.append(ReceiptSummary(
                service_name=svc,
                config_version=ver,
                snapshot_version=snap,
                total_instances=total,
                pending_count=pending,
                confirmed_count=confirmed,
                blocked_count=blocked,
                revoked_count=revoked,
                compensated_count=compensated,
                timeout_count=timeout,
                has_any_diff=has_any_diff,
                created_at=min(r.created_at for r in receipts)
            ))
        return summaries

    def export_receipts(self, query: ConfigReceiptQuery, fmt: str = "json") -> str:
        receipts = self.query_receipts(query)
        data = [r.dict() for r in receipts]
        if fmt == "json":
            return json.dumps(data, default=str, indent=2)
        elif fmt == "csv":
            import csv
            import io
            output = io.StringIO()
            if not data:
                return ""
            writer = csv.DictWriter(output, fieldnames=["id", "service_name", "config_version", "snapshot_version", "instance_id", "status", "receipt_time", "diff_count", "created_at"])
            writer.writeheader()
            for r in data:
                writer.writerow({
                    "id": r["id"],
                    "service_name": r["service_name"],
                    "config_version": r["config_version"],
                    "snapshot_version": r["snapshot_version"],
                    "instance_id": r["instance_id"],
                    "status": r["status"],
                    "receipt_time": r["receipt_time"],
                    "diff_count": len(r["diffs"]),
                    "created_at": r["created_at"]
                })
            return output.getvalue()
        return json.dumps(data, default=str, indent=2)
