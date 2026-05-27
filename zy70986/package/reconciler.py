from __future__ import annotations

import uuid
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from .models import (
    Package, SmsRecord, ReturnRule, DisposalRecord,
    DisposalType, DifferenceType, ReconciliationStatus,
    SmsType, PackageStatus, AuditLog
)


class Reconciler:
    def __init__(self, default_overdue_days: int = 7):
        self.default_overdue_days = default_overdue_days
        self.disposals: Dict[str, DisposalRecord] = {}
        self.audit_logs: List[AuditLog] = []

    def _get_overdue_threshold(self, rules: List[ReturnRule]) -> int:
        enabled_rules = sorted(
            [r for r in rules if r.enabled],
            key=lambda x: x.priority
        )
        if enabled_rules:
            return enabled_rules[0].overdue_days
        return self.default_overdue_days

    def _check_overdue(self, pkg: Package, threshold_days: int,
                       reference_date: date) -> Tuple[bool, Optional[int]]:
        if pkg.status == PackageStatus.PICKED and pkg.pickup_date:
            days = (pkg.pickup_date - pkg.arrival_date).days
            return days > threshold_days, days
        days = (reference_date - pkg.arrival_date).days
        return days > threshold_days, days

    def _check_duplicate_reminders(self, pkg_id: str,
                                   sms_list: List[SmsRecord]) -> Tuple[bool, int, List[str]]:
        pkg_sms = [s for s in sms_list if s.package_id == pkg_id]
        reminders = [s for s in pkg_sms if s.sms_type in (SmsType.REMINDER, SmsType.OVERDUE)]

        if len(reminders) > 2:
            evidence = [f"共发送{len(reminders)}条催取短信: "
                       f"{', '.join(s.send_time.strftime('%m-%d') for s in reminders)}"]
            return True, len(reminders), evidence
        return False, 0, []

    def _check_sms_missing(self, pkg: Package, sms_list: List[SmsRecord]) -> Tuple[bool, List[str]]:
        pkg_sms = [s for s in sms_list if s.package_id == pkg.package_id]
        has_arrival = any(s.sms_type == SmsType.ARRIVAL for s in pkg_sms)
        evidence = []
        if not has_arrival:
            evidence.append("缺少入库通知短信")
        if pkg.status == PackageStatus.OVERDUE and not any(
                s.sms_type in (SmsType.OVERDUE, SmsType.RETURN_NOTICE) for s in pkg_sms):
            evidence.append("超期但未发送超期/退回通知")
        return len(evidence) > 0, evidence

    def _check_privacy_issues(self, pkg: Package) -> Tuple[bool, List[str]]:
        evidence = []
        if "*" not in pkg.recipient_name and len(pkg.recipient_name) > 1:
            evidence.append("姓名未脱敏")
        if "****" not in pkg.recipient_phone and len(pkg.recipient_phone) >= 11:
            evidence.append("手机号未脱敏")
        return len(evidence) > 0, evidence

    def _generate_disposal(self, pkg: Package, diff_types: List[DifferenceType],
                          reasons: List[str], evidence: List[str],
                          is_manual: bool = False) -> DisposalRecord:
        if DifferenceType.OVERDUE_PICKUP in diff_types:
            disposal_type = DisposalType.RETURN
        elif any(t in diff_types for t in [DifferenceType.MISSING_SMS, DifferenceType.DUPLICATE_REMINDER]):
            disposal_type = DisposalType.SUPPLEMENT
        else:
            disposal_type = DisposalType.MANUAL_REVIEW if is_manual else DisposalType.RELEASE

        return DisposalRecord(
            id=str(uuid.uuid4()),
            package_id=pkg.package_id,
            disposal_type=disposal_type,
            reason="; ".join(reasons),
            difference_types=diff_types,
            evidence=evidence,
            created_at=datetime.now(),
            status=ReconciliationStatus.PENDING_REVIEW if is_manual else ReconciliationStatus.AUTO_MATCHED
        )

    def reconcile(self, packages: List[Package], sms_records: List[SmsRecord],
                  return_rules: List[ReturnRule],
                  reference_date: Optional[date] = None) -> List[DisposalRecord]:
        reference_date = reference_date or date.today()
        threshold = self._get_overdue_threshold(return_rules)
        self.disposals.clear()

        for pkg in packages:
            diff_types: List[DifferenceType] = []
            reasons: List[str] = []
            evidence: List[str] = []
            needs_manual = False

            overdue, days = self._check_overdue(pkg, threshold, reference_date)
            if overdue:
                diff_types.append(DifferenceType.OVERDUE_PICKUP)
                reasons.append(f"超期{days - threshold}天（阈值{threshold}天）")
                evidence.append(f"到件日期{pkg.arrival_date}，已存放{days}天")

            dup, count, dup_evidence = self._check_duplicate_reminders(pkg.package_id, sms_records)
            if dup:
                diff_types.append(DifferenceType.DUPLICATE_REMINDER)
                reasons.append(f"重复催取{count}次")
                evidence.extend(dup_evidence)
                needs_manual = True

            missing, missing_evidence = self._check_sms_missing(pkg, sms_records)
            if missing:
                diff_types.append(DifferenceType.MISSING_SMS)
                reasons.append("短信记录不完整")
                evidence.extend(missing_evidence)
                needs_manual = True

            privacy, privacy_evidence = self._check_privacy_issues(pkg)
            if privacy:
                diff_types.append(DifferenceType.PRIVACY_MASKED)
                reasons.append("隐私数据未脱敏")
                evidence.extend(privacy_evidence)

            if not diff_types:
                diff_types = []
                reasons = ["核对一致，自动放行"]
                evidence = ["包裹状态正常，短信记录完整"]

            disposal = self._generate_disposal(pkg, diff_types, reasons, evidence, needs_manual)
            self.disposals[pkg.package_id] = disposal
            self._add_audit_log(pkg.package_id, "auto_reconcile",
                               new_value={"disposal_type": disposal.disposal_type.value})

        return list(self.disposals.values())

    def review_disposal(self, package_id: str, new_disposal_type: DisposalType,
                       review_note: str, reviewer: str = "station_master") -> Optional[DisposalRecord]:
        if package_id not in self.disposals:
            return None

        disposal = self.disposals[package_id]
        old_value = {"disposal_type": disposal.disposal_type.value,
                     "reason": disposal.reason,
                     "status": disposal.status.value}

        disposal.disposal_type = new_disposal_type
        disposal.review_note = review_note
        disposal.reviewed_at = datetime.now()
        disposal.reviewed_by = reviewer
        disposal.status = ReconciliationStatus.REVIEWED

        self._add_audit_log(package_id, "manual_review",
                           old_value=old_value,
                           new_value={"disposal_type": new_disposal_type.value,
                                     "review_note": review_note,
                                     "reviewed_by": reviewer},
                           operator=reviewer)
        return disposal

    def recalculate(self, packages: List[Package], sms_records: List[SmsRecord],
                   return_rules: List[ReturnRule]) -> List[DisposalRecord]:
        reviewed_backup = {}
        for pid, d in self.disposals.items():
            if d.status == ReconciliationStatus.REVIEWED:
                reviewed_backup[pid] = {
                    "disposal_type": d.disposal_type,
                    "review_note": d.review_note,
                    "reviewed_by": d.reviewed_by,
                    "reviewed_at": d.reviewed_at,
                    "status": d.status
                }

        self.reconcile(packages, sms_records, return_rules)

        for pid, backup in reviewed_backup.items():
            if pid in self.disposals:
                d = self.disposals[pid]
                d.disposal_type = backup["disposal_type"]
                d.review_note = backup["review_note"]
                d.reviewed_by = backup["reviewed_by"]
                d.reviewed_at = backup["reviewed_at"]
                d.status = backup["status"]
                self._add_audit_log(pid, "recalculate_preserve",
                                   old_value={"preserved": True},
                                   operator="system",
                                   note="重新计算后保留人工复核结果")

        return list(self.disposals.values())

    def explain_disposal(self, package_id: str) -> Optional[Dict]:
        if package_id not in self.disposals:
            return None
        d = self.disposals[package_id]
        type_map = {
            DisposalType.RELEASE: "放行",
            DisposalType.RETURN: "退回",
            DisposalType.SUPPLEMENT: "补充材料",
            DisposalType.MANUAL_REVIEW: "待人工复核"
        }
        diff_map = {
            DifferenceType.OVERDUE_PICKUP: "超期未取",
            DifferenceType.DUPLICATE_REMINDER: "重复催取",
            DifferenceType.PRIVACY_MASKED: "隐私未脱敏",
            DifferenceType.MISSING_SMS: "短信缺失",
            DifferenceType.MISMATCH_STATUS: "状态不符",
            DifferenceType.RULE_EXCEPTION: "规则例外"
        }
        return {
            "package_id": package_id,
            "disposal_type": type_map.get(d.disposal_type, d.disposal_type.value),
            "reasons": d.reason.split("; "),
            "difference_types": [diff_map.get(t, t.value) for t in d.difference_types],
            "evidence": d.evidence,
            "review_note": d.review_note,
            "reviewed_by": d.reviewed_by,
            "status": d.status.value
        }

    def _add_audit_log(self, package_id: str, action: str,
                      old_value: Optional[Dict] = None, new_value: Optional[Dict] = None,
                      operator: str = "system", note: Optional[str] = None):
        log = AuditLog(
            log_id=str(uuid.uuid4()),
            package_id=package_id,
            action=action,
            old_value=old_value,
            new_value=new_value,
            operator=operator,
            timestamp=datetime.now(),
            note=note
        )
        self.audit_logs.append(log)

    def get_audit_logs(self, package_id: Optional[str] = None) -> List[AuditLog]:
        if package_id:
            return [l for l in self.audit_logs if l.package_id == package_id]
        return self.audit_logs
