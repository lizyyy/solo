import uuid
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models import (
    AppointmentDB,
    VaccineInventoryDB,
    ContraindicationRuleDB,
    ReconciliationRecordDB,
    RecordStatus,
    DiscrepancyType,
    Discrepancy
)


class ReconciliationEngine:
    def __init__(self, db: Session):
        self.db = db

    def run_reconciliation(self, appointment_batch_id: Optional[str] = None) -> Dict[str, Any]:
        batch_id = f"rec_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"

        query = self.db.query(AppointmentDB)
        if appointment_batch_id:
            query = query.filter(AppointmentDB.batch_id == appointment_batch_id)
        appointments = query.all()

        results = []
        for appt in appointments:
            record = self._reconcile_appointment(appt, batch_id)
            results.append(record)

        self.db.commit()

        return self._generate_result_summary(batch_id, results)

    def _reconcile_appointment(self, appt: AppointmentDB, batch_id: str) -> ReconciliationRecordDB:
        record_id = f"rec_{appt.appointment_id}_{uuid.uuid4().hex[:6]}"

        discrepancies = []
        discrepancies.extend(self._check_inventory(appt))
        discrepancies.extend(self._check_contraindications(appt))
        discrepancies.extend(self._check_duplicate_reschedule(appt))
        discrepancies.extend(self._check_age_appropriateness(appt))

        auto_check_passed = len([d for d in discrepancies if d.severity == 'critical']) == 0

        if auto_check_passed:
            if len(discrepancies) == 0:
                status = RecordStatus.AUTO_APPROVED
            else:
                status = RecordStatus.NEEDS_REVIEW
        else:
            status = RecordStatus.AUTO_REJECTED

        record = ReconciliationRecordDB(
            record_id=record_id,
            appointment_id=appt.appointment_id,
            reconciliation_batch_id=batch_id,
            status=status.value,
            discrepancies=[d.dict() for d in discrepancies],
            auto_check_passed=auto_check_passed,
            calculated_at=datetime.utcnow(),
            trace_path=[
                f"导入批次:{appt.batch_id}",
                f"对账批次:{batch_id}"
            ]
        )

        self.db.add(record)
        return record

    def _check_inventory(self, appt: AppointmentDB) -> List[Discrepancy]:
        discrepancies = []

        inventory = self.db.query(VaccineInventoryDB).filter(
            VaccineInventoryDB.vaccine_name == appt.vaccine_name,
            VaccineInventoryDB.available_quantity > 0
        ).first()

        if not inventory:
            discrepancies.append(Discrepancy(
                type=DiscrepancyType.NO_INVENTORY,
                description=f"疫苗 {appt.vaccine_name} 无可用库存，建议候补或改签",
                severity="critical",
                related_field="vaccine_name",
                suggested_action="联系家长进行改签或加入候补名单"
            ))
        elif inventory.available_quantity < inventory.min_stock_level:
            discrepancies.append(Discrepancy(
                type=DiscrepancyType.LOW_STOCK,
                description=f"疫苗 {appt.vaccine_name} 库存不足（仅剩 {inventory.available_quantity} 支，最低库存要求 {inventory.min_stock_level} 支）",
                severity="warning",
                related_field="available_quantity",
                suggested_action="优先保证已预约儿童，及时补货"
            ))

        return discrepancies

    def _check_contraindications(self, appt: AppointmentDB) -> List[Discrepancy]:
        discrepancies = []

        rules = self.db.query(ContraindicationRuleDB).filter(
            ContraindicationRuleDB.vaccine_name.in_([appt.vaccine_name, '']),
            ContraindicationRuleDB.is_active == True
        ).all()

        for rule in rules:
            if self._check_rule_match(appt, rule):
                discrepancies.append(Discrepancy(
                    type=DiscrepancyType.CONTRAINDICATION,
                    description=f"禁忌规则触发：{rule.description}",
                    severity=rule.severity,
                    related_field="contraindication",
                    suggested_action=rule.action
                ))

        return discrepancies

    def _check_rule_match(self, appt: AppointmentDB, rule: ContraindicationRuleDB) -> bool:
        condition = rule.condition
        if not condition:
            return False

        child_age = self._calculate_age(appt.birth_date, appt.appointment_date)

        if 'min_age_months' in condition:
            if child_age < condition['min_age_months']:
                return True

        if 'max_age_months' in condition:
            if child_age > condition['max_age_months']:
                return True

        if 'vaccine_batch' in condition:
            if appt.vaccine_batch == condition['vaccine_batch']:
                return True

        if 'has_remarks_keyword' in condition:
            keywords = condition['has_remarks_keyword']
            if appt.remarks and any(kw in appt.remarks for kw in keywords):
                return True

        return False

    def _calculate_age(self, birth_date: date, appointment_date: date) -> int:
        months = (appointment_date.year - birth_date.year) * 12 + (appointment_date.month - birth_date.month)
        return max(0, months)

    def _check_duplicate_reschedule(self, appt: AppointmentDB) -> List[Discrepancy]:
        discrepancies = []

        if appt.is_reschedule and appt.reschedule_count >= 2:
            discrepancies.append(Discrepancy(
                type=DiscrepancyType.DUPLICATE_RESCHEDULE,
                description=f"该预约已改签 {appt.reschedule_count} 次，超过建议次数",
                severity="warning",
                related_field="reschedule_count",
                suggested_action="核实多次改签原因，确认是否需要特殊处理"
            ))

        same_day_appts = self.db.query(AppointmentDB).filter(
            AppointmentDB.child_id_card == appt.child_id_card,
            AppointmentDB.appointment_date == appt.appointment_date,
            AppointmentDB.appointment_id != appt.appointment_id
        ).count()

        if same_day_appts > 0:
            discrepancies.append(Discrepancy(
                type=DiscrepancyType.DUPLICATE_RESCHEDULE,
                description=f"该儿童在同一天有 {same_day_appts + 1} 个预约，存在重复预约",
                severity="critical",
                related_field="appointment_date",
                suggested_action="立即联系家长确认正确预约时间"
            ))

        return discrepancies

    def _check_age_appropriateness(self, appt: AppointmentDB) -> List[Discrepancy]:
        discrepancies = []

        child_age = self._calculate_age(appt.birth_date, appt.appointment_date)

        age_ranges = {
            '乙肝疫苗': (0, 12),
            '卡介苗': (0, 3),
            '脊灰疫苗': (2, 48),
            '百白破疫苗': (3, 24),
            '麻疹疫苗': (8, 18),
            '乙脑疫苗': (8, 72),
            '流脑疫苗': (6, 72),
            '甲肝疫苗': (18, 36)
        }

        for vaccine_key, (min_age, max_age) in age_ranges.items():
            if vaccine_key in appt.vaccine_name:
                if child_age < min_age:
                    discrepancies.append(Discrepancy(
                        type=DiscrepancyType.AGE_INAPPROPRIATE,
                        description=f"接种年龄偏小：{child_age} 月龄，该疫苗建议接种年龄为 {min_age}-{max_age} 月龄",
                        severity="warning",
                        related_field="birth_date",
                        suggested_action="核实儿童年龄，确认是否提前接种"
                    ))
                elif child_age > max_age:
                    discrepancies.append(Discrepancy(
                        type=DiscrepancyType.AGE_INAPPROPRIATE,
                        description=f"接种年龄偏大：{child_age} 月龄，该疫苗建议接种年龄为 {min_age}-{max_age} 月龄",
                        severity="warning",
                        related_field="birth_date",
                        suggested_action="核实延迟接种原因，评估补种必要性"
                    ))
                break

        return discrepancies

    def _generate_result_summary(self, batch_id: str, records: List[ReconciliationRecordDB]) -> Dict[str, Any]:
        total = len(records)
        auto_approved = sum(1 for r in records if r.status == RecordStatus.AUTO_APPROVED.value)
        auto_rejected = sum(1 for r in records if r.status == RecordStatus.AUTO_REJECTED.value)
        needs_review = sum(1 for r in records if r.status == RecordStatus.NEEDS_REVIEW.value)
        discrepancies_found = sum(len(r.discrepancies) for r in records)

        return {
            "batch_id": batch_id,
            "total_records": total,
            "auto_approved": auto_approved,
            "auto_rejected": auto_rejected,
            "needs_review": needs_review,
            "manually_processed": 0,
            "discrepancies_found": discrepancies_found,
            "processed_at": datetime.utcnow(),
            "status": "completed"
        }

    def recalculate_record(self, record_id: str) -> ReconciliationRecordDB:
        record = self.db.query(ReconciliationRecordDB).filter(
            ReconciliationRecordDB.record_id == record_id
        ).first()

        if not record:
            raise ValueError(f"对账记录 {record_id} 不存在")

        appt = self.db.query(AppointmentDB).filter(
            AppointmentDB.appointment_id == record.appointment_id
        ).first()

        if not appt:
            raise ValueError(f"预约记录 {record.appointment_id} 不存在")

        previous_state = {
            "status": record.status,
            "discrepancies": record.discrepancies,
            "auto_check_passed": record.auto_check_passed
        }

        discrepancies = []
        discrepancies.extend(self._check_inventory(appt))
        discrepancies.extend(self._check_contraindications(appt))
        discrepancies.extend(self._check_duplicate_reschedule(appt))
        discrepancies.extend(self._check_age_appropriateness(appt))

        auto_check_passed = len([d for d in discrepancies if d.severity == 'critical']) == 0

        if record.status in [RecordStatus.MANUALLY_APPROVED.value, RecordStatus.MANUALLY_REJECTED.value, RecordStatus.NEEDS_MORE_INFO.value]:
            new_status = record.status
        else:
            if auto_check_passed:
                new_status = RecordStatus.AUTO_APPROVED.value if len(discrepancies) == 0 else RecordStatus.NEEDS_REVIEW.value
            else:
                new_status = RecordStatus.AUTO_REJECTED.value

        record.status = new_status
        record.discrepancies = [d.dict() for d in discrepancies]
        record.auto_check_passed = auto_check_passed
        record.calculated_at = datetime.utcnow()

        trace_entry = f"重新计算:{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        if trace_entry not in record.trace_path:
            record.trace_path.append(trace_entry)

        self.db.commit()
        return record
