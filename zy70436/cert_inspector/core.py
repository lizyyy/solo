import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from collections import defaultdict

from .models import (
    Certificate, LakePartitionInfo, InspectionResult,
    ManualCorrection, InvoiceRedemptionRecord, RiskType
)


class CertificateInspector:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        self.history_file = self.data_dir / "inspection_history.json"
        self.corrections_file = self.data_dir / "manual_corrections.json"
        self.redemption_file = self.data_dir / "invoice_redemption_records.json"
        self._init_storage()

    def _init_storage(self):
        if not self.history_file.exists():
            self.history_file.write_text(json.dumps({"history": []}, ensure_ascii=False, indent=2))
        if not self.corrections_file.exists():
            self.corrections_file.write_text(json.dumps({"corrections": []}, ensure_ascii=False, indent=2))

    def load_partitions(self, file_path: str) -> List[LakePartitionInfo]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return [LakePartitionInfo(**p) for p in data.get("partitions", [])]

    def load_certificates(self, file_path: str) -> List[Certificate]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return [Certificate(**c) for c in data.get("certificates", [])]

    def load_invoice_redemption_records(self, file_path: Optional[str] = None) -> List[InvoiceRedemptionRecord]:
        if file_path is None:
            file_path = str(self.redemption_file)
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return [InvoiceRedemptionRecord(**r) for r in data.get("records", [])]

    def detect_batch_conflicts(self, partitions: List[LakePartitionInfo]) -> List[Dict[str, Any]]:
        batch_groups = defaultdict(list)
        for p in partitions:
            batch_groups[p.batch_no].append(p)
        
        conflicts = []
        for batch_no, partition_list in batch_groups.items():
            if len(partition_list) > 1:
                conflicts.append({
                    "batch_no": batch_no,
                    "conflict_count": len(partition_list),
                    "partitions": [
                        {
                            "partition_id": p.partition_id,
                            "department": p.department,
                            "submitter": p.submitter,
                            "environment": p.environment
                        }
                        for p in partition_list
                    ],
                    "risk_type": RiskType.BATCH_CONFLICT
                })
        return conflicts

    def inspect_certificates(self, certificates: List[Certificate], 
                            partitions: Optional[List[LakePartitionInfo]] = None,
                            inspector: str = "system") -> InspectionResult:
        expired_count = 0
        expiring_soon_count = 0
        risk_details = []
        batch_conflicts = []

        if partitions:
            batch_conflicts = self.detect_batch_conflicts(partitions)

        for cert in certificates:
            risk = cert.risk_level
            if risk == RiskType.EXPIRED:
                expired_count += 1
            elif risk == RiskType.EXPIRING_SOON:
                expiring_soon_count += 1

            if risk != RiskType.NORMAL:
                risk_details.append({
                    "cert_id": cert.cert_id,
                    "cert_no": cert.cert_no,
                    "cert_type": cert.cert_type,
                    "holder": cert.holder,
                    "expiry_date": str(cert.expiry_date),
                    "days_until_expiry": cert.days_until_expiry,
                    "risk_type": risk,
                    "department": cert.department,
                    "data_source": cert.data_source,
                    "batch_no": cert.batch_no
                })

        result = InspectionResult(
            batch_id=f"INSPECT-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}",
            inspector=inspector,
            inspection_time=datetime.now(),
            total_certs=len(certificates),
            expired_count=expired_count,
            expiring_soon_count=expiring_soon_count,
            batch_conflicts=batch_conflicts,
            risk_details=risk_details,
            manual_corrections=[]
        )

        self._save_to_history(result)
        return result

    def _save_to_history(self, result: InspectionResult):
        with open(self.history_file, 'r+', encoding='utf-8') as f:
            data = json.load(f)
            data["history"].append(result.model_dump(mode="json"))
            f.seek(0)
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.truncate()

    def get_history(self, batch_id: Optional[str] = None, 
                   operator: Optional[str] = None,
                   risk_type: Optional[RiskType] = None) -> List[Dict[str, Any]]:
        with open(self.history_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        history = data.get("history", [])
        filtered = []

        for record in history:
            if batch_id and record["batch_id"] != batch_id:
                continue
            if operator and record["inspector"] != operator:
                continue
            if risk_type:
                has_risk = any(
                    d.get("risk_type") == risk_type 
                    for d in record.get("risk_details", [])
                )
                has_conflict = any(
                    c.get("risk_type") == risk_type
                    for c in record.get("batch_conflicts", [])
                )
                if not (has_risk or has_conflict):
                    continue
            filtered.append(record)
        
        return filtered

    def add_manual_correction(self, cert_id: str, original_risk: RiskType,
                             corrected_risk: RiskType, operator: str,
                             remark: str, batch_id: str) -> ManualCorrection:
        correction = ManualCorrection(
            correction_id=f"CORR-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}",
            cert_id=cert_id,
            original_risk=original_risk,
            corrected_risk=corrected_risk,
            operator=operator,
            operation_time=datetime.now(),
            remark=remark,
            batch_id=batch_id
        )

        with open(self.corrections_file, 'r+', encoding='utf-8') as f:
            data = json.load(f)
            data["corrections"].append(correction.model_dump(mode="json"))
            f.seek(0)
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.truncate()

        self._update_result_with_correction(batch_id, correction)
        return correction

    def _update_result_with_correction(self, batch_id: str, correction: ManualCorrection):
        with open(self.history_file, 'r+', encoding='utf-8') as f:
            data = json.load(f)
            for record in data["history"]:
                if record["batch_id"] == batch_id:
                    record["manual_corrections"].append(correction.model_dump(mode="json"))
                    break
            f.seek(0)
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.truncate()

    def get_manual_corrections(self, cert_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with open(self.corrections_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        corrections = data.get("corrections", [])
        if cert_id:
            corrections = [c for c in corrections if c["cert_id"] == cert_id]
        return corrections

    def find_redemption_by_environment(self, environment: str, 
                                      redemption_file: Optional[str] = None) -> List[InvoiceRedemptionRecord]:
        records = self.load_invoice_redemption_records(redemption_file)
        return [r for r in records if r.environment == environment]

    def get_redemption_detail(self, record_id: str, 
                             redemption_file: Optional[str] = None) -> Optional[InvoiceRedemptionRecord]:
        records = self.load_invoice_redemption_records(redemption_file)
        for r in records:
            if r.record_id == record_id:
                return r
        return None
