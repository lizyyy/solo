from datetime import datetime
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from database import Medicine, Inventory, Contraindication
from schemas import PrescriptionItemCreate, CheckResultItem
from config import settings
import json


class RulesEngine:
    def __init__(self, db: Session):
        self.db = db
    
    def check_dosage_range(
        self, 
        medicine: Medicine, 
        pet_weight_kg: float, 
        prescribed_dosage: float
    ) -> Tuple[bool, str, str, Optional[str]]:
        if not settings.DOSE_CHECK_ENABLED:
            return True, "passed", "剂量校验已禁用", None
        
        if pet_weight_kg <= 0:
            return False, "blocked", f"宠物体重无效: {pet_weight_kg}kg", None
        
        min_total_dose = medicine.min_dose_per_kg * pet_weight_kg
        max_total_dose = medicine.max_dose_per_kg * pet_weight_kg
        
        dosage_info = (
            f"药品: {medicine.name}, 体重: {pet_weight_kg}kg, "
            f"推荐剂量范围: {min_total_dose:.2f}-{max_total_dose:.2f}{medicine.dose_unit}, "
            f"处方剂量: {prescribed_dosage:.2f}{medicine.dose_unit}"
        )
        
        if prescribed_dosage < min_total_dose:
            diff_pct = ((min_total_dose - prescribed_dosage) / min_total_dose) * 100
            return False, "blocked", f"剂量不足: 低于最低推荐剂量{diff_pct:.1f}%", dosage_info
        
        if prescribed_dosage > max_total_dose:
            diff_pct = ((prescribed_dosage - max_total_dose) / max_total_dose) * 100
            return False, "blocked", f"剂量超标: 高于最高推荐剂量{diff_pct:.1f}%", dosage_info
        
        return True, "passed", f"剂量校验通过: 在推荐范围内", dosage_info
    
    def check_batch_expiry(
        self, 
        batch_number: str, 
        medicine_id: Optional[int] = None
    ) -> Tuple[bool, str, str]:
        if not settings.EXPIRY_CHECK_ENABLED:
            return True, "passed", "过期校验已禁用"
        
        if not batch_number:
            return False, "warning", "未提供批号，无法校验有效期"
        
        query = self.db.query(Inventory).filter(Inventory.batch_number == batch_number)
        if medicine_id:
            query = query.filter(Inventory.medicine_id == medicine_id)
        
        inventory = query.first()
        
        if not inventory:
            return False, "blocked", f"批号 {batch_number} 在库存中不存在"
        
        now = datetime.utcnow()
        days_to_expiry = (inventory.expiry_date - now).days
        
        if inventory.expiry_date < now:
            return False, "blocked", f"批号 {batch_number} 已过期 (过期日期: {inventory.expiry_date.strftime('%Y-%m-%d')})"
        
        if days_to_expiry <= 30:
            return True, "warning", f"批号 {batch_number} 即将过期，剩余 {days_to_expiry} 天"
        
        return True, "passed", f"批号 {batch_number} 有效期校验通过"
    
    def check_inventory_quantity(
        self, 
        batch_number: str, 
        required_quantity: int,
        medicine_id: Optional[int] = None
    ) -> Tuple[bool, str, str]:
        if not batch_number:
            return True, "warning", "未提供批号，无法校验库存数量"
        
        query = self.db.query(Inventory).filter(Inventory.batch_number == batch_number)
        if medicine_id:
            query = query.filter(Inventory.medicine_id == medicine_id)
        
        inventory = query.first()
        
        if not inventory:
            return False, "blocked", f"批号 {batch_number} 在库存中不存在"
        
        if inventory.quantity < required_quantity:
            return False, "blocked", f"库存不足: 批号 {batch_number} 现存 {inventory.quantity}{inventory.unit}，需要 {required_quantity}{inventory.unit}"
        
        return True, "passed", f"库存校验通过: 现存 {inventory.quantity}{inventory.unit}"
    
    def check_contraindications(
        self, 
        medicine_ids: List[int]
    ) -> List[Tuple[int, int, str, str]]:
        if not settings.CONTRAINDICATION_CHECK_ENABLED:
            return []
        
        if len(medicine_ids) < 2:
            return []
        
        conflicts = []
        for i, med_a_id in enumerate(medicine_ids):
            for med_b_id in medicine_ids[i+1:]:
                contra = self.db.query(Contraindication).filter(
                    ((Contraindication.medicine_a_id == med_a_id) & (Contraindication.medicine_b_id == med_b_id)) |
                    ((Contraindication.medicine_a_id == med_b_id) & (Contraindication.medicine_b_id == med_a_id))
                ).first()
                
                if contra:
                    med_a = self.db.query(Medicine).filter(Medicine.id == med_a_id).first()
                    med_b = self.db.query(Medicine).filter(Medicine.id == med_b_id).first()
                    conflicts.append((
                        med_a_id, 
                        med_b_id, 
                        contra.severity,
                        f"[{contra.severity.upper()}] {med_a.name if med_a else '药品A'} 与 {med_b.name if med_b else '药品B'} 存在禁忌: {contra.description}"
                    ))
        
        return conflicts
    
    def process_prescription_item(
        self,
        item: PrescriptionItemCreate,
        item_index: int,
        pet_weight_kg: float
    ) -> CheckResultItem:
        medicine = None
        if item.medicine_id:
            medicine = self.db.query(Medicine).filter(Medicine.id == item.medicine_id).first()
        
        if not medicine and item.medicine_name:
            medicine = self.db.query(Medicine).filter(Medicine.name == item.medicine_name).first()
        
        if not medicine:
            return CheckResultItem(
                item_index=item_index,
                medicine_name=item.medicine_name,
                passed=False,
                check_status="blocked",
                reason=f"药品 '{item.medicine_name}' 未在系统中注册，无法进行规则校验"
            )
        
        reasons = []
        final_status = "passed"
        passed = True
        dosage_info = None
        
        dosage_ok, dosage_status, dosage_msg, *dosage_extra = self.check_dosage_range(
            medicine, pet_weight_kg, item.dosage
        )
        reasons.append(dosage_msg)
        if dosage_extra:
            dosage_info = dosage_extra[0]
        if not dosage_ok:
            final_status = "blocked"
            passed = False
        elif dosage_status == "warning" and final_status == "passed":
            final_status = "warning"
        
        if item.batch_number:
            expiry_ok, expiry_status, expiry_msg = self.check_batch_expiry(
                item.batch_number, item.medicine_id
            )
            reasons.append(expiry_msg)
            if not expiry_ok:
                final_status = "blocked"
                passed = False
            elif expiry_status == "warning" and final_status == "passed":
                final_status = "warning"
            
            inv_ok, inv_status, inv_msg = self.check_inventory_quantity(
                item.batch_number, item.quantity, item.medicine_id
            )
            reasons.append(inv_msg)
            if not inv_ok:
                final_status = "blocked"
                passed = False
            elif inv_status == "warning" and final_status == "passed":
                final_status = "warning"
        
        combined_reason = " | ".join(reasons)
        
        return CheckResultItem(
            item_index=item_index,
            medicine_name=item.medicine_name,
            passed=passed,
            check_status=final_status,
            reason=combined_reason,
            dosage_info=dosage_info
        )
    
    def process_prescription(
        self,
        items: List[PrescriptionItemCreate],
        pet_weight_kg: float
    ) -> Tuple[List[CheckResultItem], List[str]]:
        item_results = []
        for idx, item in enumerate(items):
            result = self.process_prescription_item(item, idx, pet_weight_kg)
            item_results.append(result)
        
        medicine_ids = []
        for item in items:
            if item.medicine_id:
                medicine_ids.append(item.medicine_id)
            else:
                med = self.db.query(Medicine).filter(Medicine.name == item.medicine_name).first()
                if med:
                    medicine_ids.append(med.id)
        
        contraindication_messages = []
        if len(medicine_ids) >= 2:
            conflicts = self.check_contraindications(medicine_ids)
            for _, _, severity, message in conflicts:
                contraindication_messages.append(message)
                if severity == "danger":
                    for result in item_results:
                        if result.passed:
                            result.passed = False
                            result.check_status = "blocked"
                            result.reason += f" | 存在禁忌组合: {message}"
        
        return item_results, contraindication_messages
