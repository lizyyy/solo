import uuid
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
from collections import defaultdict

from models import (
    MaterialBatch, FaultRecord, OrbitElements, VerificationRecord,
    VerificationItem, VerificationStatus, EvidenceLink, TaskBriefing,
    FaultSeverity
)
from storage import PersistentStorage


class AntennaPointingVerifier:
    def __init__(self, storage: PersistentStorage, expected_accuracy: float = 0.5):
        self.storage = storage
        self.expected_accuracy = expected_accuracy

    def _generate_id(self, prefix: str) -> str:
        return f"{prefix}_{uuid.uuid4().hex[:12]}"

    def _check_idempotency(self, batch: MaterialBatch) -> Optional[VerificationRecord]:
        content_hash = batch.compute_content_hash()
        existing = self.storage.find_verification_by_hash(content_hash)
        return existing

    def _build_evidence_chain(self, fault: FaultRecord, orbit: Optional[OrbitElements],
                              verification_id: str) -> List[EvidenceLink]:
        evidence = []

        evidence.append(EvidenceLink(
            from_type="VERIFICATION",
            from_id=verification_id,
            to_type="FAULT",
            to_id=fault.fault_id,
            relationship="VERIFIES",
            description=f"校验结论基于故障记录 {fault.fault_id}"
        ))

        if orbit:
            evidence.append(EvidenceLink(
                from_type="FAULT",
                from_id=fault.fault_id,
                to_type="ORBIT",
                to_id=orbit.orbit_id,
                relationship="USES_ORBIT_DATA",
                description=f"故障记录关联轨道根数 {orbit.orbit_id}，来源: {orbit.source}"
            ))

        if fault.confirmed:
            evidence.append(EvidenceLink(
                from_type="FAULT",
                from_id=fault.fault_id,
                to_type="CONFIRMATION",
                to_id=fault.confirmed_by or "unknown",
                relationship="CONFIRMED_BY",
                description=f"故障记录于 {fault.confirmed_at} 由 {fault.confirmed_by} 人工确认"
            ))

        for version in fault.versions:
            evidence.append(EvidenceLink(
                from_type="FAULT",
                from_id=fault.fault_id,
                to_type="VERSION",
                to_id=f"v{version.version}",
                relationship="HAS_VERSION",
                description=f"版本 {version.version} 由 {version.modified_by} 在 {version.modified_at} 修改: {version.change_summary}"
            ))

        for e in evidence:
            self.storage.save_evidence_link(e, verification_id)

        return evidence

    def _calculate_pointing_accuracy(self, fault: FaultRecord, orbit: Optional[OrbitElements]) -> Tuple[Optional[float], Optional[str]]:
        if not orbit:
            return None, "缺少对应的轨道根数数据，无法计算指向精度"

        if fault.antenna_pointing_error is None:
            return None, "故障记录中未包含天线指向误差数据"

        orbit_inclination = orbit.inclination
        orbit_eccentricity = orbit.eccentricity
        correction_factor = 1.0 + (orbit_eccentricity * 0.1) + (abs(orbit_inclination - 90) * 0.001)
        actual_error = fault.antenna_pointing_error * correction_factor

        return actual_error, None

    def _detect_duplicate_telemetry(self, faults: List[FaultRecord]) -> Dict[str, List[str]]:
        telemetry_map = defaultdict(list)
        for fault in faults:
            telemetry_map[fault.telemetry_segment_id].append(fault.fault_id)
        return {seg: ids for seg, ids in telemetry_map.items() if len(ids) > 1}

    def verify(self, batch: MaterialBatch, operator: str) -> Tuple[VerificationRecord, bool]:
        batch.content_hash = batch.compute_content_hash()

        existing_verification = self._check_idempotency(batch)
        is_re_run = existing_verification is not None

        verification_id = self._generate_id("VER")
        started_at = datetime.now()

        for fault in batch.faults:
            self.storage.save_fault(fault)
        for orbit in batch.orbits:
            self.storage.save_orbit(orbit)
        self.storage.save_batch(batch)

        orbit_map = {o.orbit_id: o for o in batch.orbits}
        duplicate_telemetry = self._detect_duplicate_telemetry(batch.faults)

        items = []
        for fault in batch.faults:
            orbit = orbit_map.get(fault.orbit_id) if fault.orbit_id else None

            pointing_accuracy, error_details = self._calculate_pointing_accuracy(fault, orbit)

            if fault.orbit_id and not orbit:
                status = VerificationStatus.PENDING
                error_details = f"轨道根数 {fault.orbit_id} 不存在，需补充数据后重新校验"
            elif fault.telemetry_segment_id in duplicate_telemetry:
                status = VerificationStatus.PARTIAL
                dup_faults = duplicate_telemetry[fault.telemetry_segment_id]
                error_details = f"遥测片段 {fault.telemetry_segment_id} 存在重复记录: {', '.join(dup_faults)}"
            elif pointing_accuracy is None:
                status = VerificationStatus.PENDING
            elif pointing_accuracy <= self.expected_accuracy:
                status = VerificationStatus.PASSED
            else:
                status = VerificationStatus.FAILED

            evidence = self._build_evidence_chain(fault, orbit, verification_id)

            item = VerificationItem(
                fault_id=fault.fault_id,
                orbit_id=fault.orbit_id,
                status=status,
                error_details=error_details,
                pointing_accuracy=pointing_accuracy,
                expected_accuracy=self.expected_accuracy,
                evidence=evidence
            )
            items.append(item)

        all_passed = all(item.status == VerificationStatus.PASSED for item in items)
        any_failed = any(item.status == VerificationStatus.FAILED for item in items)
        any_pending = any(item.status == VerificationStatus.PENDING for item in items)

        if all_passed:
            overall_status = VerificationStatus.PASSED
        elif any_failed:
            overall_status = VerificationStatus.FAILED
        elif any_pending:
            overall_status = VerificationStatus.PENDING
        else:
            overall_status = VerificationStatus.PARTIAL

        summary_parts = []
        if is_re_run:
            summary_parts.append(f"[重跑] 检测到相同材料批次，上一次校验ID: {existing_verification.verification_id}")
        summary_parts.append(f"共校验 {len(items)} 条故障记录")
        passed = sum(1 for i in items if i.status == VerificationStatus.PASSED)
        failed = sum(1 for i in items if i.status == VerificationStatus.FAILED)
        pending = sum(1 for i in items if i.status == VerificationStatus.PENDING)
        partial = sum(1 for i in items if i.status == VerificationStatus.PARTIAL)
        summary_parts.append(f"通过: {passed}, 失败: {failed}, 待处理: {pending}, 部分: {partial}")

        if duplicate_telemetry:
            summary_parts.append(f"检测到 {len(duplicate_telemetry)} 个重复遥测片段")

        verification = VerificationRecord(
            verification_id=verification_id,
            material_batch_id=batch.batch_id,
            material_content_hash=batch.content_hash,
            status=overall_status,
            items=items,
            started_at=started_at,
            completed_at=datetime.now(),
            summary=" | ".join(summary_parts),
            is_re_run=is_re_run,
            previous_verification_id=existing_verification.verification_id if existing_verification else None
        )

        self.storage.save_verification(verification)

        briefing = self._generate_briefing(verification, batch, operator)
        self.storage.save_briefing(briefing)

        return verification, is_re_run

    def _generate_briefing(self, verification: VerificationRecord, batch: MaterialBatch,
                           operator: str) -> TaskBriefing:
        faults_by_id = {f.fault_id: f for f in batch.faults}

        passed_count = sum(1 for i in verification.items if i.status == VerificationStatus.PASSED)
        failed_count = sum(1 for i in verification.items if i.status == VerificationStatus.FAILED)
        pending_count = sum(1 for i in verification.items if i.status == VerificationStatus.PENDING)

        critical_issues = []
        warnings = []
        evidence_summary = []
        recommendations = []

        for item in verification.items:
            fault = faults_by_id.get(item.fault_id)
            if not fault:
                continue

            evidence_summary.append({
                "fault_id": item.fault_id,
                "status": item.status.value,
                "orbit_id": item.orbit_id,
                "pointing_accuracy": item.pointing_accuracy,
                "evidence_links": [
                    {
                        "relationship": e.relationship,
                        "description": e.description,
                        "target": f"{e.to_type}:{e.to_id}"
                    } for e in item.evidence
                ]
            })

            if item.status == VerificationStatus.FAILED:
                if fault.severity == FaultSeverity.CRITICAL:
                    critical_issues.append(
                        f"{fault.fault_id}: {fault.description} | 指向误差: {item.pointing_accuracy:.3f}° > 阈值 {self.expected_accuracy}°"
                    )
                else:
                    warnings.append(
                        f"{fault.fault_id}: {fault.description} | 指向误差: {item.pointing_accuracy:.3f}°"
                    )
            elif item.status == VerificationStatus.PENDING:
                warnings.append(f"{fault.fault_id}: {item.error_details}")
                recommendations.append(f"补充 {fault.fault_id} 相关数据: {item.error_details}")

        if verification.is_re_run:
            recommendations.append(
                f"本次为重复校验，原始校验记录: {verification.previous_verification_id}"
            )

        pending_orbit_ids = set(
            item.orbit_id for item in verification.items
            if item.status == VerificationStatus.PENDING and item.orbit_id
        )
        if pending_orbit_ids:
            recommendations.append(f"补充以下轨道根数: {', '.join(pending_orbit_ids)}")

        duplicate_telemetry = self._detect_duplicate_telemetry(batch.faults)
        if duplicate_telemetry:
            for seg, fault_ids in duplicate_telemetry.items():
                critical_issues.append(
                    f"重复遥测片段 {seg}: 涉及故障记录 {', '.join(fault_ids)}，请排查数据一致性"
                )
                recommendations.append(f"去重处理遥测片段 {seg} 的 {len(fault_ids)} 条重复记录")

        if verification.status == VerificationStatus.PASSED:
            recommendations.append("天线指向校验通过，可继续后续任务")
        elif verification.status == VerificationStatus.FAILED:
            recommendations.append("天线指向校验失败，建议重新进行标定或调整控制参数")

        return TaskBriefing(
            briefing_id=self._generate_id("BRF"),
            verification_id=verification.verification_id,
            material_batch_id=batch.batch_id,
            generated_at=datetime.now(),
            generated_by=operator,
            overall_status=verification.status,
            total_faults=len(verification.items),
            passed_count=passed_count,
            failed_count=failed_count,
            pending_count=pending_count,
            critical_issues=critical_issues,
            warnings=warnings,
            evidence_summary=evidence_summary,
            recommendations=recommendations
        )

    def get_evidence_traversal(self, verification_id: str, fault_id: str) -> Dict[str, Any]:
        verification = self.storage.load_verification(verification_id)
        if not verification:
            return {"error": f"校验记录 {verification_id} 不存在"}

        target_item = next((i for i in verification.items if i.fault_id == fault_id), None)
        if not target_item:
            return {"error": f"故障记录 {fault_id} 不在本次校验中"}

        fault = self.storage.load_fault(fault_id)
        orbit = self.storage.load_orbit(target_item.orbit_id) if target_item.orbit_id else None

        traversal = {
            "verification": {
                "id": verification.verification_id,
                "status": verification.status.value,
                "summary": verification.summary,
                "is_re_run": verification.is_re_run
            },
            "conclusion": {
                "fault_id": fault_id,
                "status": target_item.status.value,
                "pointing_accuracy": target_item.pointing_accuracy,
                "expected_accuracy": target_item.expected_accuracy,
                "error_details": target_item.error_details
            },
            "fault_record": fault.to_dict() if fault else None,
            "orbit_elements": orbit.to_dict() if orbit else None,
            "version_history": [v.to_dict() for v in fault.versions] if fault else [],
            "evidence_chain": [e.to_dict() for e in target_item.evidence]
        }

        return traversal

    def update_fault_and_reverify(self, verification_id: str, fault_id: str,
                                   updates: Dict[str, Any], modified_by: str,
                                   change_summary: str) -> Optional[VerificationRecord]:
        fault = self.storage.load_fault(fault_id)
        if not fault:
            return None

        fault.update(updates, modified_by, change_summary)
        self.storage.save_fault(fault)

        old_verification = self.storage.load_verification(verification_id)
        if not old_verification:
            return None

        batch = self.storage.load_batch(old_verification.material_batch_id)
        if not batch:
            return None

        updated_faults = []
        for f in batch.faults:
            if f.fault_id == fault_id:
                updated_faults.append(fault)
            else:
                updated_faults.append(f)
        batch.faults = updated_faults

        new_verification, _ = self.verify(batch, modified_by)
        return new_verification
