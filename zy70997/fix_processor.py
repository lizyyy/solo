processor_path = '/Users/lzy/pro/solo/workspaces/zy70997/app/processor.py'

with open(processor_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_init = """    def __init__(self, db: Session):
        self.db = db
        self.success_items: List[ProcessedItem] = []
        self.pending_items: List[ProcessedItem] = []
        self.failed_items: List[ProcessedItem] = []"""

new_init = """    def __init__(self, db: Session):
        self.db = db
        self.success_items: List[ProcessedItem] = []
        self.pending_items: List[ProcessedItem] = []
        self.failed_items: List[ProcessedItem] = []
        self._processed_claims: set = set()"""

content = content.replace(old_init, new_init)

old_check_dup = """    def check_duplicate_claim(self, employee_id: str, claim_type: str) -> Tuple[bool, str]:
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
        return False, """""

new_check_dup = """    def check_duplicate_claim(self, employee_id: str, claim_type: str) -> Tuple[bool, str]:
        key = (employee_id, claim_type)
        
        if key in self._processed_claims:
            return True, (
                f"员工 {employee_id} 在本次名单中已申请过 {claim_type} 福利，"
                f"请检查是否重复录入"
            )
        
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
        return False, """""

content = content.replace(old_check_dup, new_check_dup)

old_process_single = """        self.success_items.append(ProcessedItem(
            original_data=original,
            status="success",
            reason=f"员工信息正常，{item.claim_type}福利发放条件满足",
            suggestion="正常发放"
        ))
        return "success""""

new_process_single = """        self._processed_claims.add((item.employee_id, item.claim_type))
        self.success_items.append(ProcessedItem(
            original_data=original,
            status="success",
            reason=f"员工信息正常，{item.claim_type}福利发放条件满足",
            suggestion="正常发放"
        ))
        return "success""""

content = content.replace(old_process_single, new_process_single)

with open(processor_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('processor.py 修复完成')
