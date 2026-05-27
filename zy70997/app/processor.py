from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from .models import Employee, Coupon, ClaimRecord, Batch
from .schemas import ClaimItem, ProcessedItem, ProcessResult
import hashlib
import uuid
from datetime import datetime


def generate_file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def generate_batch_id() -> str:
    return f"BATCH-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8].upper()}"


class ClaimProcessor:
    def __init__(self, db: Session):
        self.db = db
        self.success_items: List[ProcessedItem] = []
        self.pending_items: List[ProcessedItem] = []
        self.failed_items: List[ProcessedItem] = []

    def check_employee_active(self, employee_id: str) -> Tuple[bool, str]:
        employee = self.db.query(Employee).filter(
            Employee.employee_id == employee_id
        ).first()

        if not employee:
            return False, f"员工编号 {employee_id} 不存在于员工库中"
        if not employee.is_active:
            return False, f"员工 {employee.name} ({employee_id}) 已离职，状态为非在职"
        return True, ""

    def check_duplicate_claim(self, employee_id: str, claim_type: str) -> Tuple[bool, str]:
        existing = self.db.query(ClaimRecord).filter(
            ClaimRecord.employee_id == employee_id,
            ClaimRecord.claim_type == claim_type
        ).first()

        if existing:
            return True, (
                f"员工 {employee_id} 已领取过 {claim_type} 福利。"
                f"领取时间: {existing.created_at.strftime('%Y-%m-%d %H:%M:%S')}, "
                f"批次号: {existing.batch_id}"
            )
        return False, ""

    def check_coupon_valid(self, coupon_code: str, claim_type: str) -> Tuple[bool, str]:
        if not coupon_code:
            return True, ""

        coupon = self.db.query(Coupon).filter(
            Coupon.coupon_code == coupon_code
        ).first()

        if not coupon:
            return False, f"券码 {coupon_code} 不存在于券码库中"
        if coupon.is_used:
            used_by = coupon.used_by or "未知用户"
            used_at = coupon.used_at.strftime('%Y-%m-%d %H:%M:%S') if coupon.used_at else "未知时间"
            return False, f"券码 {coupon_code} 已被 {used_by} 于 {used_at} 使用"
        if coupon.coupon_type != claim_type:
            return False, (
                f"券码 {coupon_code} 类型不匹配。"
                f"券码类型: {coupon.coupon_type}, 申请类型: {claim_type}"
            )
        return True, ""

    def check_proxy_requirements(self, item: ClaimItem) -> Tuple[bool, str, str]:
        if not item.is_proxy:
            return True, "", "正常领取"

        if not item.proxy_employee_id:
            return False, "代领未填写代领人编号", "请补充代领人 employee_id"
        if not item.proxy_employee_name:
            return False, "代领未填写代领人姓名", "请补充代领人姓名 proxy_employee_name"

        proxy_emp = self.db.query(Employee).filter(
            Employee.employee_id == item.proxy_employee_id
        ).first()

        if not proxy_emp:
            return False, f"代领人 {item.proxy_employee_id} 不存在", "请核对代领人编号"
        if not proxy_emp.is_active:
            return False, f"代领人 {proxy_emp.name} 已离职，不可代领", "请更换在职员工作为代领人"

        return True, "", f"代领留痕: 由 {proxy_emp.name} ({proxy_emp.employee_id}) 代领"

    def check_delivery_info(self, item: ClaimItem) -> Tuple[bool, str, str]:
        if item.delivery_method == "快递":
            if not item.address:
                return False, "快递寄送未填写收货地址", "请补充详细收货地址"
            if not item.contact_phone:
                return False, "快递寄送未填写联系电话", "请补充收件人联系电话"
            return True, "", f"快递寄送: {item.address}, 联系电话: {item.contact_phone}"
        elif item.delivery_method == "线下领取":
            return True, "", "线下领取，无需快递信息"
        else:
            return True, "", f"领取方式: {item.delivery_method or '未指定'}"

    def process_single_item(self, item: ClaimItem, original: Dict[str, Any]) -> str:
        reasons = []
        suggestions = []

        emp_ok, emp_msg = self.check_employee_active(item.employee_id)
        if not emp_ok:
            reasons.append(emp_msg)
            suggestions.append("请联系人事部门确认员工状态，或从本次名单中移除")

        dup_ok, dup_msg = self.check_duplicate_claim(item.employee_id, item.claim_type)
        if dup_ok:
            reasons.append(dup_msg)
            suggestions.append("该员工已领取过此福利，无需重复发放")

        coupon_ok, coupon_msg = self.check_coupon_valid(item.coupon_code, item.claim_type)
        if not coupon_ok:
            reasons.append(coupon_msg)
            suggestions.append("请核对券码有效性，或更换未使用的券码")

        proxy_ok, proxy_msg, proxy_note = self.check_proxy_requirements(item)
        if not proxy_ok:
            reasons.append(proxy_msg)
            suggestions.append(proxy_note)

        delivery_ok, delivery_msg, delivery_note = self.check_delivery_info(item)
        if not delivery_ok:
            reasons.append(delivery_msg)
            suggestions.append(delivery_note)

        if reasons:
            self.failed_items.append(ProcessedItem(
                original_data=original,
                status="failed",
                reason="；".join(reasons),
                suggestion="；".join(suggestions)
            ))
            return "failed"

        if item.is_proxy or item.delivery_method == "快递":
            combined_note = []
            if proxy_ok and item.is_proxy:
                combined_note.append(proxy_note)
            if delivery_ok:
                combined_note.append(delivery_note)

            self.pending_items.append(ProcessedItem(
                original_data=original,
                status="pending",
                reason="；".join(combined_note),
                suggestion="信息完整，请人工确认后代为发放或安排快递"
            ))
            return "pending"

        self.success_items.append(ProcessedItem(
            original_data=original,
            status="success",
            reason=f"员工信息正常，{item.claim_type}福利发放条件满足",
            suggestion="正常发放"
        ))
        return "success"

    def persist_records(self, batch_id: str, items: List[ClaimItem], results: List[str]):
        for item, result in zip(items, results):
            if result == "success":
                record = ClaimRecord(
                    batch_id=batch_id,
                    employee_id=item.employee_id,
                    employee_name=item.employee_name,
                    coupon_code=item.coupon_code,
                    claim_type=item.claim_type,
                    is_proxy=item.is_proxy,
                    proxy_employee_id=item.proxy_employee_id,
                    proxy_employee_name=item.proxy_employee_name,
                    delivery_method=item.delivery_method,
                    address=item.address,
                    contact_phone=item.contact_phone,
                    remark=item.remark
                )
                self.db.add(record)

                if item.coupon_code:
                    coupon = self.db.query(Coupon).filter(
                        Coupon.coupon_code == item.coupon_code
                    ).first()
                    if coupon:
                        coupon.is_used = True
                        coupon.used_by = item.employee_name
                        coupon.used_at = datetime.now()

        self.db.commit()

    def process_batch(
        self,
        claim_items: List[ClaimItem],
        original_data: List[Dict[str, Any]],
        file_hash: str,
        file_name: str = None
    ) -> ProcessResult:
        existing_batch = self.db.query(Batch).filter(
            Batch.file_hash == file_hash
        ).first()

        if existing_batch:
            return ProcessResult(
                batch_id=existing_batch.batch_id,
                total_count=existing_batch.total_count,
                success_count=existing_batch.success_count,
                pending_count=existing_batch.pending_count,
                failed_count=existing_batch.failed_count,
                success_items=[],
                pending_items=[],
                failed_items=[],
                created_at=existing_batch.created_at
            )

        batch_id = generate_batch_id()
        results = []

        for item, original in zip(claim_items, original_data):
            result = self.process_single_item(item, original)
            results.append(result)

        self.persist_records(batch_id, claim_items, results)

        batch = Batch(
            batch_id=batch_id,
            file_hash=file_hash,
            file_name=file_name,
            total_count=len(claim_items),
            success_count=len(self.success_items),
            pending_count=len(self.pending_items),
            failed_count=len(self.failed_items),
            status="completed"
        )
        self.db.add(batch)
        self.db.commit()
        self.db.refresh(batch)

        return ProcessResult(
            batch_id=batch_id,
            total_count=len(claim_items),
            success_count=len(self.success_items),
            pending_count=len(self.pending_items),
            failed_count=len(self.failed_items),
            success_items=self.success_items,
            pending_items=self.pending_items,
            failed_items=self.failed_items,
            created_at=batch.created_at
        )
