from collections import defaultdict
from typing import List, Dict, Tuple
from datetime import datetime
from .models import TransactionRecord, DiffType, Attachment


class CashDiffEngine:
    def __init__(self, tolerance: float = 0.01):
        self.tolerance = tolerance
        self.records: List[TransactionRecord] = []
        self.processing_log: List[str] = []

    def add_records(self, records: List[TransactionRecord]):
        self.records.extend(records)

    def _log(self, msg: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.processing_log.append(f"[{timestamp}] {msg}")

    def _amount_eq(self, a: float, b: float) -> bool:
        return abs(a - b) <= self.tolerance

    def check_null_values(self):
        self._log("开始检查空值异常...")
        count = 0
        for rec in self.records:
            issues = []
            if rec.amount is None or (isinstance(rec.amount, str) and rec.amount.strip() == ""):
                issues.append("金额为空")
            if not rec.trade_date or str(rec.trade_date).strip() == "":
                issues.append("交易日期为空")
            if not rec.store_id or str(rec.store_id).strip() == "":
                issues.append("门店编号为空")
            
            if issues:
                reason = "门店日结现金差异: " + "、".join(issues)
                if rec.diff_type == DiffType.NONE:
                    rec.set_diff(DiffType.NULL_VALUE, reason)
                else:
                    rec.diff_reason = (rec.diff_reason or "") + "; " + reason
                self._log(f"  记录 {rec.id} ({rec.store_name}): {', '.join(issues)}")
                count += 1
        self._log(f"空值检查完成，共发现 {count} 条异常记录")

    def check_boundary_cases(self):
        self._log("开始检查边界记录...")
        count = 0
        for rec in self.records:
            issues = []
            if rec.amount is not None and isinstance(rec.amount, (int, float)):
                if rec.amount == 0:
                    issues.append("金额为0")
                elif rec.amount < 0:
                    issues.append(f"金额为负数({rec.amount})")
                elif abs(rec.amount) >= 100000:
                    issues.append(f"金额过大({rec.amount})")
            
            if rec.batch_no and isinstance(rec.batch_no, str):
                if rec.batch_no.endswith("999") or rec.batch_no.endswith("000"):
                    issues.append(f"批次号疑似测试数据({rec.batch_no})")
            
            if issues:
                reason = "门店日结现金差异: " + "、".join(issues)
                if rec.diff_type == DiffType.NONE:
                    rec.set_diff(DiffType.BOUNDARY_CASE, reason)
                else:
                    rec.diff_reason = (rec.diff_reason or "") + "; " + reason
                self._log(f"  边界记录 {rec.id} ({rec.store_name}): {', '.join(issues)}")
                count += 1
        self._log(f"边界记录检查完成，共发现 {count} 条边界记录")

    def check_duplicate_claims(self):
        self._log("开始检查重复认领（门店日结现金差异核心判断）...")
        amount_groups: Dict[Tuple[str, float], List[TransactionRecord]] = defaultdict(list)
        
        for rec in self.records:
            if rec.amount is None or not isinstance(rec.amount, (int, float)):
                continue
            key = (rec.store_id, round(rec.amount, 2))
            amount_groups[key].append(rec)
        
        dup_count = 0
        for (store_id, amount), group in amount_groups.items():
            if len(group) > 1:
                batch_nos = [r.batch_no for r in group if r.batch_no]
                if len(set(batch_nos)) > 1:
                    dup_count += 1
                    ids = [r.id for r in group]
                    self._log(f"  发现重复认领: 门店={store_id}, 金额={amount}, 涉及记录={ids}, 批次={batch_nos}")
                    
                    for rec in group:
                        other_ids = [r.id for r in group if r.id != rec.id]
                        rec.duplicate_with.extend(other_ids)
                        rec.matched_ids.extend(other_ids)
                        
                        reason = (f"门店日结现金差异: 同一笔金额 {amount} 元被多个批次认领，"
                                  f"涉及批次: {', '.join([b for b in batch_nos if b])}，"
                                  f"冲突记录: {', '.join(other_ids)}")
                        
                        if rec.diff_type == DiffType.NONE:
                            rec.set_diff(DiffType.DUPLICATE_CLAIM, reason)
                        else:
                            rec.diff_reason = (rec.diff_reason or "") + "; " + reason
        
        self._log(f"重复认领检查完成，共发现 {dup_count} 组重复认领")

    def check_amount_mismatch(self):
        self._log("开始检查金额不匹配...")
        bank_records = [r for r in self.records if "银行" in r.source.value]
        ledger_records = [r for r in self.records if "台账" in r.source.value]
        
        mismatch_count = 0
        for bank_rec in bank_records:
            if bank_rec.amount is None:
                continue
            for ledger_rec in ledger_records:
                if (ledger_rec.amount is not None and
                    ledger_rec.store_id == bank_rec.store_id and
                    ledger_rec.trade_date == bank_rec.trade_date and
                    not self._amount_eq(ledger_rec.amount, bank_rec.amount)):
                    
                    bank_rec.matched_ids.append(ledger_rec.id)
                    ledger_rec.matched_ids.append(bank_rec.id)
                    
                    reason = (f"门店日结现金差异: 银行回单金额({bank_rec.amount})与台账金额({ledger_rec.amount})不匹配，"
                              f"差额: {abs(bank_rec.amount - ledger_rec.amount)} 元")
                    
                    if bank_rec.diff_type == DiffType.NONE:
                        bank_rec.set_diff(DiffType.AMOUNT_MISMATCH, reason)
                    else:
                        bank_rec.diff_reason = (bank_rec.diff_reason or "") + "; " + reason
                    
                    if ledger_rec.diff_type == DiffType.NONE:
                        ledger_rec.set_diff(DiffType.AMOUNT_MISMATCH, reason)
                    else:
                        ledger_rec.diff_reason = (ledger_rec.diff_reason or "") + "; " + reason
                    
                    mismatch_count += 1
                    self._log(f"  金额不匹配: {bank_rec.id} vs {ledger_rec.id}, "
                              f"差额={abs(bank_rec.amount - ledger_rec.amount)}")
        
        self._log(f"金额匹配检查完成，共发现 {mismatch_count} 对金额不匹配")

    def process_late_attachment(self, record_id: str, attachment: Attachment, 
                                new_remark: str = None):
        self._log(f"处理晚到附件: 记录={record_id}, 附件={attachment.path}")
        
        target = None
        for rec in self.records:
            if rec.id == record_id:
                target = rec
                break
        
        if not target:
            self._log(f"  错误: 未找到记录 {record_id}")
            return False
        
        old_diff = target.diff_type
        old_reason = target.diff_reason
        old_remark = target.current_remark
        
        attachment.is_late = True
        target.add_attachment(attachment)
        
        if new_remark and new_remark != old_remark:
            target.add_history("备注", old_remark, new_remark, 
                              operator="系统(晚到附件)", 
                              reason=f"晚到附件{attachment.type}更新")
            target.current_remark = new_remark
        
        new_reason = (f"门店日结现金差异: 晚到附件[{attachment.type}]更新判断，"
                      f"原判断: {old_diff.value} - {old_reason}")
        
        if target.diff_type == DiffType.NONE:
            target.set_diff(DiffType.LATE_ATTACHMENT, new_reason)
        else:
            target.diff_reason = (target.diff_reason or "") + "; " + new_reason
            target.diff_type = DiffType.LATE_ATTACHMENT
        
        target.add_history("差异类型", old_diff.value, target.diff_type.value,
                          operator="系统(晚到附件)",
                          reason=f"附件{attachment.id}到账后重新判断")
        target.add_history("差异原因", old_reason, target.diff_reason,
                          operator="系统(晚到附件)",
                          reason=f"附件{attachment.id}到账后重新判断")
        
        self._log(f"  记录 {record_id} 已更新: {old_diff.value} -> {target.diff_type.value}")
        return True

    def run_all_checks(self):
        self._log("=" * 60)
        self._log("开始执行门店日结现金差异全量检查")
        self._log(f"共加载记录: {len(self.records)} 条")
        self._log("=" * 60)
        
        self.check_null_values()
        self.check_boundary_cases()
        self.check_duplicate_claims()
        self.check_amount_mismatch()
        
        processed = sum(1 for r in self.records if r.is_processed)
        self._log("=" * 60)
        self._log(f"检查完成: 共 {len(self.records)} 条记录, 其中 {processed} 条存在门店日结现金差异")
        self._log("=" * 60)

    def get_statistics(self) -> Dict:
        stats = defaultdict(int)
        for rec in self.records:
            stats[rec.diff_type.value] += 1
            stats["总记录数"] += 1
            if rec.is_processed:
                stats["已处理"] += 1
        return dict(stats)

    def get_diff_records(self) -> List[TransactionRecord]:
        return [r for r in self.records if r.is_processed]

    def get_duplicate_groups(self) -> List[List[TransactionRecord]]:
        groups = []
        seen = set()
        for rec in self.records:
            if rec.id in seen or not rec.duplicate_with:
                continue
            group = [rec]
            seen.add(rec.id)
            for other_id in rec.duplicate_with:
                for other in self.records:
                    if other.id == other_id and other.id not in seen:
                        group.append(other)
                        seen.add(other.id)
            groups.append(group)
        return groups
