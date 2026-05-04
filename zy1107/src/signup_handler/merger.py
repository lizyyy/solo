from typing import List, Dict, Tuple, Optional
from collections import defaultdict
from decimal import Decimal
import re

from .models import (
    RegistrationRecord,
    EditRecord,
    MergedRecord,
    PaymentRecord,
    RecordStatus,
    PaymentStatus,
    RulesConfig,
    ValidationIssue,
)


class MergeEngine:
    def __init__(self, rules: RulesConfig):
        self.rules = rules
        self.issues: List[ValidationIssue] = []

    def merge(
        self,
        registrations: List[RegistrationRecord],
        payments: List[PaymentRecord],
        edits: List[EditRecord],
    ) -> Tuple[List[MergedRecord], List[ValidationIssue]]:
        self.issues = []
        
        merged_dict: Dict[str, MergedRecord] = {}
        phone_to_records: Dict[str, List[RegistrationRecord]] = defaultdict(list)
        name_to_records: Dict[str, List[RegistrationRecord]] = defaultdict(list)
        
        for reg in registrations:
            if reg.phone:
                phone_to_records[reg.phone].append(reg)
            
            names = []
            if reg.real_name:
                names.append(reg.real_name)
            if reg.group_nickname and reg.group_nickname != reg.real_name:
                names.append(reg.group_nickname)
            
            for name in names:
                name_to_records[name].append(reg)
        
        processed_ids = set()
        
        for phone, records in phone_to_records.items():
            if len(records) > 1:
                primary = self._select_primary(records)
                merged = MergedRecord(primary_record=primary)
                
                for rec in records:
                    if rec.record_id != primary.record_id:
                        merged.duplicate_records.append(rec)
                        processed_ids.add(rec.record_id)
                
                merged_dict[primary.record_id] = merged
                processed_ids.add(primary.record_id)
                
                self.issues.append(ValidationIssue(
                    severity="warning",
                    category="duplicate",
                    message=f"找到 {len(records)} 条手机号相同的报名记录，已合并",
                    related_record_id=primary.record_id,
                    suggestion=f"请核对合并后的人数和时段：{merged.display_name}",
                ))
        
        for name, records in name_to_records.items():
            unprocessed = [r for r in records if r.record_id not in processed_ids]
            if len(unprocessed) > 1:
                if self._are_likely_same_person(unprocessed):
                    primary = self._select_primary(unprocessed)
                    
                    if primary.record_id not in merged_dict:
                        merged = MergedRecord(primary_record=primary)
                        merged_dict[primary.record_id] = merged
                    else:
                        merged = merged_dict[primary.record_id]
                    
                    for rec in unprocessed:
                        if rec.record_id != primary.record_id:
                            merged.duplicate_records.append(rec)
                            processed_ids.add(rec.record_id)
                    
                    processed_ids.add(primary.record_id)
                    
                    self.issues.append(ValidationIssue(
                        severity="warning",
                        category="name_duplicate",
                        message=f"姓名 '{name}' 出现 {len(unprocessed)} 次，已作为疑似重复合并",
                        related_record_id=primary.record_id,
                        suggestion="请确认是否为同一人，如不同请手动拆分",
                    ))
        
        for reg in registrations:
            if reg.record_id not in processed_ids:
                merged = MergedRecord(primary_record=reg)
                merged_dict[reg.record_id] = merged
                processed_ids.add(reg.record_id)
        
        merged_list = list(merged_dict.values())
        
        self._apply_edits(merged_list, edits)
        self._match_payments(merged_list, payments)
        self._calculate_payment_status(merged_list)
        
        return merged_list, self.issues

    def _select_primary(self, records: List[RegistrationRecord]) -> RegistrationRecord:
        scored = []
        for rec in records:
            score = 0
            if rec.phone:
                score += 10
            if rec.real_name and len(rec.real_name) >= 2:
                score += 5
            if rec.total_people > 1:
                score += 3
            if rec.time_slots and rec.time_slots != ['周六上午']:
                score += 2
            if rec.payment_amount:
                score += 5
            if rec.dietary_restrictions:
                score += 1
            score += (1000 - rec.line_number)
            scored.append((score, rec))
        
        scored.sort(key=lambda x: -x[0])
        return scored[0][1]

    def _are_likely_same_person(self, records: List[RegistrationRecord]) -> bool:
        if len(records) < 2:
            return False
        
        first = records[0]
        for rec in records[1:]:
            if first.total_people != rec.total_people and first.total_people > 0 and rec.total_people > 0:
                return False
            
            if first.time_slots and rec.time_slots:
                common_slots = set(first.time_slots) & set(rec.time_slots)
                if not common_slots:
                    return False
        
        return True

    def _apply_edits(
        self,
        merged_records: List[MergedRecord],
        edits: List[EditRecord],
    ) -> None:
        for edit in edits:
            matched = False
            
            for merged in merged_records:
                names_to_check = [
                    merged.primary_record.real_name,
                    merged.primary_record.group_nickname,
                    merged.display_name,
                ]
                
                if edit.original_name in names_to_check:
                    merged.edit_record = edit
                    edit.applied = True
                    edit.matched_registration_id = merged.merged_id
                    matched = True
                    
                    merged.warnings.append(f"已应用人工修改: {edit.original_name}")
                    
                    if edit.new_name:
                        merged.warnings.append(f"姓名修改为: {edit.new_name}")
                    if edit.new_phone:
                        merged.warnings.append(f"手机号修改为: {edit.new_phone}")
                    if edit.new_total_people is not None:
                        merged.warnings.append(f"总人数修改为: {edit.new_total_people}")
                    if edit.new_child_count is not None:
                        merged.warnings.append(f"儿童数修改为: {edit.new_child_count}")
                    
                    self.issues.append(ValidationIssue(
                        severity="info",
                        category="edit_applied",
                        message=f"已对 {edit.original_name} 应用人工修改",
                        related_record_id=merged.merged_id,
                    ))
                    break
            
            if not matched:
                for merged in merged_records:
                    if edit.original_name and merged.display_name:
                        if self._name_similarity(edit.original_name, merged.display_name) > 0.6:
                            self.issues.append(ValidationIssue(
                                severity="warning",
                                category="edit_not_matched",
                                message=f"修改记录 '{edit.original_name}' 未找到精确匹配，疑似对应: {merged.display_name}",
                                suggestion="请确认是否需要手动关联",
                            ))
                            break
                else:
                    self.issues.append(ValidationIssue(
                        severity="warning",
                        category="edit_not_found",
                        message=f"修改记录 '{edit.original_name}' 未找到对应报名记录",
                        suggestion="请检查原姓名拼写是否正确",
                    ))

    def _name_similarity(self, name1: str, name2: str) -> float:
        name1_clean = re.sub(r'[\+\s]', '', name1)
        name2_clean = re.sub(r'[\+\s]', '', name2)
        
        if name1_clean == name2_clean:
            return 1.0
        
        set1 = set(name1_clean)
        set2 = set(name2_clean)
        
        if not set1 or not set2:
            return 0.0
        
        intersection = set1 & set2
        union = set1 | set2
        
        return len(intersection) / len(union)

    def _match_payments(
        self,
        merged_records: List[MergedRecord],
        payments: List[PaymentRecord],
    ) -> None:
        for payment in payments:
            matched = False
            
            for merged in merged_records:
                names_to_check = [
                    merged.primary_record.real_name,
                    merged.primary_record.group_nickname,
                    merged.display_name,
                ]
                
                if payment.payer_name in names_to_check:
                    merged.payment_records.append(payment)
                    payment.matched = True
                    payment.matched_registration_ids.append(merged.merged_id)
                    payment.match_confidence = 1.0
                    payment.match_reason = "姓名精确匹配"
                    matched = True
                    break
                
                for name in names_to_check:
                    if name and payment.payer_name:
                        if self._name_similarity(payment.payer_name, name) > 0.8:
                            merged.payment_records.append(payment)
                            payment.matched = True
                            payment.matched_registration_ids.append(merged.merged_id)
                            payment.match_confidence = 0.8
                            payment.match_reason = f"姓名相似匹配: {payment.payer_name} ≈ {name}"
                            matched = True
                            
                            merged.status = RecordStatus.NAME_MISMATCH
                            merged.warnings.append(f"付款人姓名 '{payment.payer_name}' 与报名人 '{name}' 不一致，疑似同一人")
                            
                            self.issues.append(ValidationIssue(
                                severity="warning",
                                category="payment_name_mismatch",
                                message=f"付款人 '{payment.payer_name}' 与报名人 '{name}' 姓名不一致",
                                related_record_id=merged.merged_id,
                                related_payment_id=payment.payment_id,
                                suggestion="请确认是否为同一人，如不是请手动调整",
                            ))
                            break
                if matched:
                    break
            
            if not matched:
                payment.match_confidence = 0.0
                payment.match_reason = "未找到对应报名记录"
                
                self.issues.append(ValidationIssue(
                    severity="warning",
                    category="unmatched_payment",
                    message=f"付款记录 '{payment.payer_name}' (金额{payment.amount}) 未找到对应报名记录",
                    related_payment_id=payment.payment_id,
                    suggestion="请确认付款人是否报名，或付款人姓名是否正确",
                ))

    def _calculate_payment_status(self, merged_records: List[MergedRecord]) -> None:
        for merged in merged_records:
            expected = merged.calculate_expected_payment(self.rules)
            
            actual = sum(p.amount for p in merged.payment_records)
            merged.actual_payment = actual
            
            if actual == 0:
                merged.payment_status = PaymentStatus.UNPAID
                if merged.primary_record.has_payment_screenshot:
                    merged.warnings.append("有付款截图但无对应付款记录")
            elif actual == expected:
                merged.payment_status = PaymentStatus.PAID
            elif actual > expected:
                merged.payment_status = PaymentStatus.OVERPAID
                merged.warnings.append(f"疑似多付: 应付{expected}, 实付{actual}")
                
                self.issues.append(ValidationIssue(
                    severity="warning",
                    category="overpaid",
                    message=f"{merged.display_name} 疑似多付: 应付 {expected} 元，实付 {actual} 元",
                    related_record_id=merged.merged_id,
                    suggestion="请确认是否为多人合并付款",
                ))
            else:
                merged.payment_status = PaymentStatus.UNDERPAID
                merged.warnings.append(f"疑似少付: 应付{expected}, 实付{actual}")
                
                self.issues.append(ValidationIssue(
                    severity="warning",
                    category="underpaid",
                    message=f"{merged.display_name} 疑似少付: 应付 {expected} 元，实付 {actual} 元",
                    related_record_id=merged.merged_id,
                    suggestion="请确认付款是否完整",
                ))
