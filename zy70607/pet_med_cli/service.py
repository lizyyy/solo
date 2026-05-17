from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Tuple
import uuid

from .models import (
    Pet, FosterOrder, MedicationPlan, DosageVersion,
    ShiftExecution, ChangeRecord, CareReport, CareReportItem,
    MedicationStatus, ChangeStatus, ShiftType
)
from .store import DataStore


class MedicationService:
    def __init__(self, store: Optional[DataStore] = None):
        self.store = store or DataStore()

    def create_pet(self, name: str, pet_type: str, owner_name: str, 
                   owner_phone: str, **kwargs) -> Pet:
        pet_id = f"PET-{uuid.uuid4().hex[:8]}"
        pet = Pet(
            pet_id=pet_id,
            name=name,
            type=pet_type,
            owner_name=owner_name,
            owner_phone=owner_phone,
            **kwargs
        )
        self.store.save_pet(pet.dict())
        return pet

    def create_order(self, pet_id: str, checkin_date: date, 
                     checkout_date: date, **kwargs) -> FosterOrder:
        if not self.store.get_pet(pet_id):
            raise ValueError(f"Pet {pet_id} not found")
        
        order_id = f"ORD-{uuid.uuid4().hex[:8]}"
        order = FosterOrder(
            order_id=order_id,
            pet_id=pet_id,
            checkin_date=checkin_date,
            checkout_date=checkout_date,
            **kwargs
        )
        self.store.save_order(order.dict())
        return order

    def create_medication_plan(self, order_id: str, pet_id: str,
                               start_date: date, medication_name: str,
                               dosage_amount: str, dosage_unit: str,
                               frequency: str, route: str,
                               created_by: str, **kwargs) -> MedicationPlan:
        if not self.store.get_order(order_id):
            raise ValueError(f"Order {order_id} not found")
        
        plan_id = f"PLAN-{uuid.uuid4().hex[:8]}"
        initial_dosage = DosageVersion(
            version=1,
            medication_name=medication_name,
            dosage_amount=dosage_amount,
            dosage_unit=dosage_unit,
            frequency=frequency,
            route=route,
            created_by=created_by
        )
        
        plan = MedicationPlan(
            plan_id=plan_id,
            order_id=order_id,
            pet_id=pet_id,
            start_date=start_date,
            dosage_versions=[initial_dosage],
            **kwargs
        )
        self.store.save_medication_plan(plan.dict())
        return plan

    def update_dosage(self, plan_id: str, medication_name: Optional[str] = None,
                      dosage_amount: Optional[str] = None, 
                      dosage_unit: Optional[str] = None,
                      frequency: Optional[str] = None,
                      route: Optional[str] = None,
                      requested_by: str = "system") -> Tuple[Optional[ChangeRecord], str]:
        plan_data = self.store.get_medication_plan(plan_id)
        if not plan_data:
            raise ValueError(f"Plan {plan_id} not found")
        
        plan = MedicationPlan(**plan_data)
        current_dosage = plan.get_current_dosage()
        if not current_dosage:
            raise ValueError(f"No current dosage for plan {plan_id}")

        changes = {}
        if medication_name and medication_name != current_dosage.medication_name:
            changes["medication_name"] = (current_dosage.medication_name, medication_name)
        if dosage_amount and dosage_amount != current_dosage.dosage_amount:
            changes["dosage_amount"] = (current_dosage.dosage_amount, dosage_amount)
        if dosage_unit and dosage_unit != current_dosage.dosage_unit:
            changes["dosage_unit"] = (current_dosage.dosage_unit, dosage_unit)
        if frequency and frequency != current_dosage.frequency:
            changes["frequency"] = (current_dosage.frequency, frequency)
        if route and route != current_dosage.route:
            changes["route"] = (current_dosage.route, route)

        if not changes:
            return None, "No changes detected"

        change_records = []
        for field, (old_val, new_val) in changes.items():
            change_id = f"CHG-{uuid.uuid4().hex[:8]}"
            change = ChangeRecord(
                change_id=change_id,
                plan_id=plan_id,
                field_changed=field,
                old_value=old_val,
                new_value=new_val,
                requested_by=requested_by,
                status=ChangeStatus.PENDING,
                change_hash=""
            )
            saved_id = self.store.save_change_record(change.dict())
            if saved_id:
                change_records.append(change)

        if change_records:
            return change_records[0], f"Created {len(change_records)} change record(s) pending confirmation"
        return None, "Change already exists (idempotent)"

    def confirm_change(self, change_id: str, confirmed_by: str) -> bool:
        change_data = self.store.get_change_record(change_id)
        if not change_data:
            raise ValueError(f"Change {change_id} not found")
        
        if change_data["status"] != ChangeStatus.PENDING:
            return False

        plan_data = self.store.get_medication_plan(change_data["plan_id"])
        if not plan_data:
            raise ValueError(f"Plan {change_data['plan_id']} not found")
        
        plan = MedicationPlan(**plan_data)
        current_dosage = plan.get_current_dosage()
        if not current_dosage:
            raise ValueError("No current dosage")

        new_version_data = current_dosage.dict()
        new_version_data["version"] = plan.current_version + 1
        new_version_data["created_by"] = confirmed_by
        new_version_data[change_data["field_changed"]] = change_data["new_value"]
        new_dosage = DosageVersion(**new_version_data)

        plan.add_dosage_version(new_dosage)
        self.store.save_medication_plan(plan.dict())
        self.store.update_change_status(change_id, ChangeStatus.CONFIRMED, confirmed_by)
        return True

    def reject_change(self, change_id: str, rejected_by: str) -> bool:
        return self.store.update_change_status(change_id, ChangeStatus.REJECTED, rejected_by)

    def record_shift_execution(self, plan_id: str, shift_date: date,
                               shift_type: str, status: str,
                               executed_by: Optional[str] = None,
                               notes: Optional[str] = None) -> ShiftExecution:
        plan_data = self.store.get_medication_plan(plan_id)
        if not plan_data:
            raise ValueError(f"Plan {plan_id} not found")
        
        plan = MedicationPlan(**plan_data)
        
        execution_id = f"EXEC-{uuid.uuid4().hex[:8]}"
        execution = ShiftExecution(
            execution_id=execution_id,
            plan_id=plan_id,
            shift_date=shift_date,
            shift_type=shift_type,
            status=status,
            administered_by=executed_by,
            administered_at=datetime.now() if status == MedicationStatus.ADMINISTERED else None,
            dosage_version_at_execution=plan.current_version,
            notes=notes
        )
        self.store.save_shift_execution(execution.dict())
        return execution

    def check_missed_doses(self, check_date: Optional[date] = None) -> List[Dict]:
        check_date = check_date or date.today()
        missed = []
        
        for plan_data in self.store.get_all_plans():
            plan = MedicationPlan(**plan_data)
            if not plan.is_active:
                continue
            
            if plan.start_date > check_date:
                continue
            
            executions = self.store.get_executions_by_plan(plan.plan_id)
            executed_shifts = set(
                (e["shift_date"], e["shift_type"]) 
                for e in executions 
                if e["status"] in [MedicationStatus.ADMINISTERED, MedicationStatus.SKIPPED]
            )
            
            shifts_per_day = self._get_shifts_for_frequency(
                plan.get_current_dosage().frequency if plan.get_current_dosage() else "daily"
            )
            
            current_date = plan.start_date
            while current_date <= check_date:
                for shift in shifts_per_day:
                    if (str(current_date), shift) not in executed_shifts:
                        pet_data = self.store.get_pet(plan.pet_id)
                        pet_name = pet_data["name"] if pet_data else "Unknown"
                        missed.append({
                            "plan_id": plan.plan_id,
                            "pet_id": plan.pet_id,
                            "pet_name": pet_name,
                            "date": str(current_date),
                            "shift": shift,
                            "alert": f"漏喂告警: {pet_name} {current_date} {shift} 班次未喂药"
                        })
                current_date += timedelta(days=1)
        
        return missed

    def _get_shifts_for_frequency(self, frequency: str) -> List[str]:
        freq_map = {
            "daily": [ShiftType.MORNING],
            "twice_daily": [ShiftType.MORNING, ShiftType.EVENING],
            "thrice_daily": [ShiftType.MORNING, ShiftType.AFTERNOON, ShiftType.EVENING],
            "nightly": [ShiftType.NIGHT],
        }
        return freq_map.get(frequency, [ShiftType.MORNING])

    def generate_care_report(self, order_id: str, start_date: date, 
                             end_date: date) -> CareReport:
        order_data = self.store.get_order(order_id)
        if not order_data:
            raise ValueError(f"Order {order_id} not found")

        pet_data = self.store.get_pet(order_data["pet_id"])
        pet_name = pet_data["name"] if pet_data else "Unknown"

        report_id = f"RPT-{uuid.uuid4().hex[:8]}"
        report = CareReport(
            report_id=report_id,
            order_id=order_id,
            pet_id=order_data["pet_id"],
            start_date=start_date,
            end_date=end_date
        )

        plans = self.store.get_plans_by_order(order_id)
        
        for plan_data in plans:
            plan = MedicationPlan(**plan_data)
            changes = self.store.get_changes_by_plan(plan.plan_id)
            
            current_date = start_date
            while current_date <= end_date:
                executions = [
                    e for e in self.store.get_executions_by_plan(plan.plan_id)
                    if e["shift_date"] == str(current_date)
                ]
                
                for exec_data in executions:
                    dosage = plan.get_current_dosage()
                    has_change = any(
                        c["status"] == ChangeStatus.CONFIRMED and
                        c["requested_at"].split("T")[0] == str(current_date)
                        for c in changes
                    )
                    
                    item = CareReportItem(
                        date=current_date,
                        shift=exec_data["shift_type"],
                        pet_name=pet_name,
                        medication=dosage.medication_name if dosage else "Unknown",
                        dosage=f"{exec_data.get('dosage_version_at_execution', 'N/A')}",
                        status=exec_data["status"],
                        administered_by=exec_data.get("administered_by"),
                        notes=exec_data.get("notes"),
                        has_change=has_change,
                        change_info="剂量有变更" if has_change else None
                    )
                    report.items.append(item)
                
                current_date += timedelta(days=1)

        missed = self.check_missed_doses(end_date)
        for m in missed:
            if start_date <= date.fromisoformat(m["date"]) <= end_date:
                report.alerts.append(m["alert"])

        status_counts: Dict[str, int] = {}
        for item in report.items:
            status_counts[item.status] = status_counts.get(item.status, 0) + 1
        report.summary = status_counts

        return report

    def validate_data(self) -> Dict[str, List[str]]:
        errors = {
            "pets": [],
            "orders": [],
            "plans": [],
            "executions": [],
            "changes": []
        }

        for pet_data in self.store.get_all_pets():
            try:
                Pet(**pet_data)
            except Exception as e:
                errors["pets"].append(f"{pet_data.get('pet_id', 'unknown')}: {str(e)}")

        for order_data in self.store.get_all_orders():
            try:
                FosterOrder(**order_data)
            except Exception as e:
                errors["orders"].append(f"{order_data.get('order_id', 'unknown')}: {str(e)}")

        for plan_data in self.store.get_all_plans():
            try:
                MedicationPlan(**plan_data)
            except Exception as e:
                errors["plans"].append(f"{plan_data.get('plan_id', 'unknown')}: {str(e)}")

        for exec_data in self.store.get_all_executions():
            try:
                ShiftExecution(**exec_data)
            except Exception as e:
                errors["executions"].append(f"{exec_data.get('execution_id', 'unknown')}: {str(e)}")

        for change_data in self.store.get_all_changes():
            try:
                ChangeRecord(**change_data)
            except Exception as e:
                errors["changes"].append(f"{change_data.get('change_id', 'unknown')}: {str(e)}")

        return errors
