from datetime import datetime
from typing import Dict, List, Optional, Tuple

from ..models.models import (
    Artifact,
    ArtifactGrade,
    Discrepancy,
    DiscrepancyType,
    InsurancePolicy,
    ReconciliationRecord,
    ReconciliationStatus,
    ReviewStatus,
    TransportRecord,
)
from ..analyzer.analyzer import DiscrepancyAnalyzer


class ReconciliationEngine:
    def __init__(self):
        self.records: Dict[str, ReconciliationRecord] = {}
        self.analyzer = DiscrepancyAnalyzer()
        self.reconciliation_batch = datetime.now().strftime("%Y%m%d_%H%M%S")

    def _find_related_transport(
        self, artifact_id: str, transports: Dict[str, TransportRecord]
    ) -> Optional[TransportRecord]:
        for transport in transports.values():
            if transport.artifact_id == artifact_id:
                return transport
        return None

    def _find_related_insurance(
        self, artifact_id: str, policies: Dict[str, InsurancePolicy]
    ) -> Optional[InsurancePolicy]:
        for policy in policies.values():
            if policy.artifact_id == artifact_id:
                return policy
        return None

    def reconcile(
        self,
        artifacts: Dict[str, Artifact],
        transports: Dict[str, TransportRecord],
        policies: Dict[str, InsurancePolicy],
    ) -> List[ReconciliationRecord]:
        results = []

        all_artifact_ids = set(artifacts.keys())
        all_artifact_ids.update(t.artifact_id for t in transports.values())
        all_artifact_ids.update(p.artifact_id for p in policies.values())

        for artifact_id in sorted(all_artifact_ids):
            artifact = artifacts.get(artifact_id)
            transport = self._find_related_transport(artifact_id, transports)
            insurance = self._find_related_insurance(artifact_id, policies)

            record = ReconciliationRecord(
                artifact_id=artifact_id,
                artifact_name=artifact.name if artifact else "",
                artifact_grade=artifact.grade if artifact else None,
                artifact=artifact,
                transport=transport,
                insurance=insurance,
                reconciliation_batch=self.reconciliation_batch,
            )

            discrepancies = self._compare_all(record)
            record.discrepancies = discrepancies

            matched, unmatched = self._classify_fields(record)
            record.matched_fields = matched
            record.unmatched_fields = unmatched

            if not discrepancies:
                record.status = ReconciliationStatus.MATCHED
            elif any(d.severity == "critical" for d in discrepancies):
                record.status = ReconciliationStatus.EXCEPTION
            else:
                record.status = ReconciliationStatus.NEEDS_REVIEW

            record.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            self.records[artifact_id] = record
            results.append(record)

        return results

    def _compare_all(self, record: ReconciliationRecord) -> List[Discrepancy]:
        discrepancies = []

        valuation_disc = self._compare_valuation(record)
        discrepancies.extend(valuation_disc)

        transport_disc = self._compare_transport(record)
        discrepancies.extend(transport_disc)

        environment_disc = self._compare_environment(record)
        discrepancies.extend(environment_disc)

        insurance_disc = self._compare_insurance(record)
        discrepancies.extend(insurance_disc)

        return discrepancies

    def _compare_valuation(self, record: ReconciliationRecord) -> List[Discrepancy]:
        discrepancies = []

        if record.artifact and record.artifact.previous_valuation is not None:
            prev_val = record.artifact.previous_valuation
            curr_val = record.artifact.current_valuation

            if prev_val != curr_val:
                change_pct = ((curr_val - prev_val) / prev_val) * 100
                severity = "critical" if abs(change_pct) > 50 else "normal"

                disc = Discrepancy(
                    artifact_id=record.artifact_id,
                    discrepancy_type=DiscrepancyType.VALUATION_CHANGE,
                    field_name="估值",
                    expected_value=f"¥{prev_val:,.2f}",
                    actual_value=f"¥{curr_val:,.2f}",
                    description=f"估值发生变更",
                    explanation=self.analyzer.explain_valuation_change(prev_val, curr_val, record.artifact.grade),
                    severity=severity,
                )
                discrepancies.append(disc)

        if record.artifact and record.insurance:
            if record.artifact.current_valuation != record.insurance.insured_amount:
                disc = Discrepancy(
                    artifact_id=record.artifact_id,
                    discrepancy_type=DiscrepancyType.INSURANCE_MISMATCH,
                    field_name="保险金额",
                    expected_value=f"¥{record.artifact.current_valuation:,.2f}",
                    actual_value=f"¥{record.insurance.insured_amount:,.2f}",
                    description="保险金额与估值不一致",
                    explanation=self.analyzer.explain_insurance_mismatch(
                        record.artifact.current_valuation,
                        record.insurance.insured_amount,
                    ),
                    severity="normal",
                )
                discrepancies.append(disc)

        return discrepancies

    def _compare_transport(self, record: ReconciliationRecord) -> List[Discrepancy]:
        discrepancies = []

        if not record.transport:
            return discrepancies

        transport = record.transport

        if transport.planned_end_date and transport.actual_end_date:
            planned = datetime.strptime(transport.planned_end_date, "%Y-%m-%d")
            actual = datetime.strptime(transport.actual_end_date, "%Y-%m-%d")
            delay_days = (actual - planned).days

            if delay_days > 0:
                disc = Discrepancy(
                    artifact_id=record.artifact_id,
                    discrepancy_type=DiscrepancyType.TRANSPORT_DELAY,
                    field_name="到达日期",
                    expected_value=transport.planned_end_date,
                    actual_value=transport.actual_end_date,
                    description=f"运输延误{delay_days}天",
                    explanation=self.analyzer.explain_transport_delay(
                        delay_days, transport.transport_method
                    ),
                    severity="normal" if delay_days <= 3 else "critical",
                )
                discrepancies.append(disc)

        for i, node in enumerate(transport.nodes):
            if node.planned_arrival and node.actual_arrival:
                planned_node = datetime.strptime(node.planned_arrival, "%Y-%m-%d")
                actual_node = datetime.strptime(node.actual_arrival, "%Y-%m-%d")
                node_delay = (actual_node - planned_node).days

                if node_delay > 0:
                    disc = Discrepancy(
                        artifact_id=record.artifact_id,
                        discrepancy_type=DiscrepancyType.TRANSPORT_DELAY,
                        field_name=f"运输节点-{node.node_name}",
                        expected_value=node.planned_arrival,
                        actual_value=node.actual_arrival,
                        description=f"节点{node.node_name}延误{node_delay}天",
                        explanation=self.analyzer.explain_node_delay(
                            node.node_name, node_delay, node.notes
                        ),
                        severity="normal",
                    )
                    discrepancies.append(disc)

            if not node.actual_arrival and node.status != "待到达":
                disc = Discrepancy(
                    artifact_id=record.artifact_id,
                    discrepancy_type=DiscrepancyType.TRANSPORT_NODE_MISSING,
                    field_name=f"运输节点-{node.node_name}",
                    expected_value="已到达",
                    actual_value="未到达",
                    description=f"运输节点{node.node_name}未到达",
                    explanation=self.analyzer.explain_node_missing(node.node_name, node.status),
                    severity="critical",
                )
                discrepancies.append(disc)

        return discrepancies

    def _compare_environment(self, record: ReconciliationRecord) -> List[Discrepancy]:
        discrepancies = []

        if not record.transport:
            return discrepancies

        TEMP_MIN = 18.0
        TEMP_MAX = 24.0
        HUMIDITY_MIN = 45.0
        HUMIDITY_MAX = 55.0

        for node in record.transport.nodes:
            if node.temperature is not None:
                if node.temperature < TEMP_MIN or node.temperature > TEMP_MAX:
                    disc = Discrepancy(
                        artifact_id=record.artifact_id,
                        discrepancy_type=DiscrepancyType.TEMPERATURE_ABNORMAL,
                        field_name=f"温度-{node.node_name}",
                        expected_value=f"{TEMP_MIN}°C~{TEMP_MAX}°C",
                        actual_value=f"{node.temperature}°C",
                        description=f"节点{node.node_name}温度超出正常范围",
                        explanation=self.analyzer.explain_temperature_abnormal(
                            node.temperature, TEMP_MIN, TEMP_MAX, node.node_name
                        ),
                        severity="critical" if abs(node.temperature - (TEMP_MIN + TEMP_MAX) / 2) > 5 else "normal",
                    )
                    discrepancies.append(disc)

            if node.humidity is not None:
                if node.humidity < HUMIDITY_MIN or node.humidity > HUMIDITY_MAX:
                    disc = Discrepancy(
                        artifact_id=record.artifact_id,
                        discrepancy_type=DiscrepancyType.HUMIDITY_ABNORMAL,
                        field_name=f"湿度-{node.node_name}",
                        expected_value=f"{HUMIDITY_MIN}%~{HUMIDITY_MAX}%",
                        actual_value=f"{node.humidity}%",
                        description=f"节点{node.node_name}湿度超出正常范围",
                        explanation=self.analyzer.explain_humidity_abnormal(
                            node.humidity, HUMIDITY_MIN, HUMIDITY_MAX, node.node_name
                        ),
                        severity="critical" if abs(node.humidity - (HUMIDITY_MIN + HUMIDITY_MAX) / 2) > 10 else "normal",
                    )
                    discrepancies.append(disc)

        return discrepancies

    def _compare_insurance(self, record: ReconciliationRecord) -> List[Discrepancy]:
        discrepancies = []

        if not record.insurance or not record.transport:
            return discrepancies

        insurance = record.insurance
        transport = record.transport

        try:
            coverage_start = datetime.strptime(insurance.coverage_start, "%Y-%m-%d")
            coverage_end = datetime.strptime(insurance.coverage_end, "%Y-%m-%d")

            if transport.actual_start_date:
                actual_start = datetime.strptime(transport.actual_start_date, "%Y-%m-%d")
                if actual_start < coverage_start:
                    disc = Discrepancy(
                        artifact_id=record.artifact_id,
                        discrepancy_type=DiscrepancyType.INSURANCE_MISMATCH,
                        field_name="保险覆盖期",
                        expected_value=insurance.coverage_start,
                        actual_value=transport.actual_start_date,
                        description="运输开始时间早于保险生效时间",
                        explanation="运输开始时间在保险生效时间之前，存在保险空白期，需要确认保险是否已提前生效或存在其他保障安排。",
                        severity="critical",
                    )
                    discrepancies.append(disc)

            if transport.actual_end_date:
                actual_end = datetime.strptime(transport.actual_end_date, "%Y-%m-%d")
                if actual_end > coverage_end:
                    disc = Discrepancy(
                        artifact_id=record.artifact_id,
                        discrepancy_type=DiscrepancyType.INSURANCE_MISMATCH,
                        field_name="保险覆盖期",
                        expected_value=insurance.coverage_end,
                        actual_value=transport.actual_end_date,
                        description="运输结束时间晚于保险到期时间",
                        explanation="运输结束时间在保险到期时间之后，保险已过期，需要确认是否已续保或存在其他保障安排。",
                        severity="critical",
                    )
                    discrepancies.append(disc)

        except (ValueError, TypeError):
            pass

        return discrepancies

    def _classify_fields(
        self, record: ReconciliationRecord
    ) -> Tuple[List[str], List[str]]:
        matched = []
        unmatched = []

        field_checks = {
            "估值": True,
            "运输节点完整": True,
            "温度合规": True,
            "湿度合规": True,
            "保险金额": True,
            "保险覆盖期": True,
            "运输时间": True,
        }

        for disc in record.discrepancies:
            if "估值" in disc.field_name or "保险金额" in disc.field_name:
                field_checks["估值"] = False
            if "运输节点" in disc.field_name:
                field_checks["运输节点完整"] = False
            if "温度" in disc.field_name:
                field_checks["温度合规"] = False
            if "湿度" in disc.field_name:
                field_checks["湿度合规"] = False
            if "保险金额" in disc.field_name:
                field_checks["保险金额"] = False
            if "保险覆盖期" in disc.field_name:
                field_checks["保险覆盖期"] = False
            if "到达日期" in disc.field_name:
                field_checks["运输时间"] = False

        for field, ok in field_checks.items():
            if ok:
                matched.append(field)
            else:
                unmatched.append(field)

        return matched, unmatched

    def apply_review_decision(
        self,
        artifact_id: str,
        decision: str,
        reviewer: str,
        comments: str = "",
        required_actions: str = "",
        manual_fix_fields: Optional[List[str]] = None,
    ) -> ReconciliationRecord:
        if artifact_id not in self.records:
            raise ValueError(f"未找到对账记录: {artifact_id}")

        record = self.records[artifact_id]
        decision_enum = ReviewStatus(decision)
        requires_manual = decision_enum == ReviewStatus.NEEDS_SUPPLEMENT

        from ..models.models import ReviewDecision

        record.review_decision = ReviewDecision(
            artifact_id=artifact_id,
            decision=decision_enum,
            reviewer=reviewer,
            review_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            comments=comments,
            required_actions=required_actions,
            requires_manual_fix=requires_manual,
            manual_fix_fields=manual_fix_fields or [],
        )

        if decision_enum in (ReviewStatus.APPROVED, ReviewStatus.REJECTED):
            record.status = ReconciliationStatus.RESOLVED
            for disc in record.discrepancies:
                disc.resolved = True
                disc.resolution_note = comments
        elif decision_enum == ReviewStatus.NEEDS_SUPPLEMENT:
            record.status = ReconciliationStatus.NEEDS_REVIEW
            for disc in record.discrepancies:
                if disc.field_name in (manual_fix_fields or []):
                    disc.resolved = False
                    disc.resolution_note = required_actions

        record.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return record

    def update_record_field(
        self,
        artifact_id: str,
        field: str,
        value,
        reviewer: str,
        reason: str,
    ) -> ReconciliationRecord:
        if artifact_id not in self.records:
            raise ValueError(f"未找到对账记录: {artifact_id}")

        record = self.records[artifact_id]

        if field == "valuation" and record.artifact:
            record.artifact.current_valuation = float(value)
        elif field == "insured_amount" and record.insurance:
            record.insurance.insured_amount = float(value)
        elif field == "transport_end_date" and record.transport:
            record.transport.actual_end_date = str(value)
        elif field == "condition" and record.artifact:
            record.artifact.condition = str(value)
        else:
            raise ValueError(f"不支持修改的字段: {field}")

        for disc in record.discrepancies:
            if field in disc.field_name or disc.field_name in field:
                disc.resolved = True
                disc.resolution_note = f"{reviewer}修正: {reason}"

        record.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        new_discrepancies = self._compare_all(record)
        record.discrepancies = new_discrepancies

        if not new_discrepancies:
            record.status = ReconciliationStatus.MATCHED
        elif any(d.severity == "critical" for d in new_discrepancies):
            record.status = ReconciliationStatus.EXCEPTION
        else:
            record.status = ReconciliationStatus.NEEDS_REVIEW

        return record

    def get_summary(self) -> dict:
        total = len(self.records)
        matched = sum(1 for r in self.records.values() if r.status == ReconciliationStatus.MATCHED)
        needs_review = sum(1 for r in self.records.values() if r.status == ReconciliationStatus.NEEDS_REVIEW)
        resolved = sum(1 for r in self.records.values() if r.status == ReconciliationStatus.RESOLVED)
        exception = sum(1 for r in self.records.values() if r.status == ReconciliationStatus.EXCEPTION)

        total_disc = sum(len(r.discrepancies) for r in self.records.values())
        critical_disc = sum(
            1
            for r in self.records.values()
            for d in r.discrepancies
            if d.severity == "critical"
        )

        by_type: Dict[str, int] = {}
        for r in self.records.values():
            for d in r.discrepancies:
                type_name = d.discrepancy_type.value
                by_type[type_name] = by_type.get(type_name, 0) + 1

        by_grade: Dict[str, int] = {}
        by_grade_with_issues: Dict[str, int] = {}
        for r in self.records.values():
            grade = r.artifact_grade.value if r.artifact_grade else "未分级"
            by_grade[grade] = by_grade.get(grade, 0) + 1
            if r.status != ReconciliationStatus.MATCHED:
                by_grade_with_issues[grade] = by_grade_with_issues.get(grade, 0) + 1

        return {
            "reconciliation_batch": self.reconciliation_batch,
            "total_records": total,
            "matched": matched,
            "needs_review": needs_review,
            "resolved": resolved,
            "exception": exception,
            "total_discrepancies": total_disc,
            "critical_discrepancies": critical_disc,
            "discrepancies_by_type": by_type,
            "records_by_grade": by_grade,
            "records_with_issues_by_grade": by_grade_with_issues,
            "artifacts_requiring_attention": [
                {
                    "artifact_id": r.artifact_id,
                    "artifact_name": r.artifact_name,
                    "grade": r.artifact_grade.value if r.artifact_grade else "未分级",
                    "status": r.status.value,
                    "discrepancy_count": len(r.discrepancies),
                    "critical_count": sum(1 for d in r.discrepancies if d.severity == "critical"),
                }
                for r in self.records.values()
                if r.status != ReconciliationStatus.MATCHED
            ],
        }