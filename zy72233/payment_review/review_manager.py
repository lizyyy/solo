import json
import shutil
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict
from dataclasses import asdict

from .models import PaymentRecord, ReviewStatus, IssueType
from . import config

class ReviewManager:
    def __init__(self):
        self.records: Dict[str, PaymentRecord] = {}
        self._load_records()

    def _load_records(self) -> None:
        records_file = config.DATA_DIR / "records.json"
        if records_file.exists():
            with open(records_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for record_data in data:
                    record = self._dict_to_record(record_data)
                    self.records[record.id] = record

    def _save_records(self) -> None:
        records_file = config.DATA_DIR / "records.json"
        data = [self._record_to_dict(r) for r in self.records.values()]
        with open(records_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    def _record_to_dict(self, record: PaymentRecord) -> Dict:
        data = asdict(record)
        data['status'] = record.status.value
        data['issues'] = [i.value for i in record.issues]
        return data

    def _dict_to_record(self, data: Dict) -> PaymentRecord:
        from .models import Approver, BalanceChange
        
        approver_data = data.pop('approver')
        approver = Approver(**approver_data)
        
        balance_data = data.pop('balance_change', None)
        balance_change = BalanceChange(**balance_data) if balance_data else None
        
        status_value = data.pop('status')
        status = ReviewStatus(status_value)
        
        issues_values = data.pop('issues', [])
        issues = [IssueType(v) for v in issues_values]
        
        created_at = data.pop('created_at')
        updated_at = data.pop('updated_at')
        
        record = PaymentRecord(
            approver=approver,
            balance_change=balance_change,
            status=status,
            issues=issues,
            **data
        )
        record.created_at = datetime.fromisoformat(created_at) if isinstance(created_at, str) else created_at
        record.updated_at = datetime.fromisoformat(updated_at) if isinstance(updated_at, str) else updated_at
        
        return record

    def add_record(self, record: PaymentRecord) -> None:
        self.records[record.id] = record
        self._save_records()

    def get_record(self, record_id: str) -> Optional[PaymentRecord]:
        return self.records.get(record_id)

    def get_all_records(self) -> List[PaymentRecord]:
        return list(self.records.values())

    def get_records_by_status(self, status: ReviewStatus) -> List[PaymentRecord]:
        return [r for r in self.records.values() if r.status == status]

    def upload_xr_screenshot(self, record_id: str, screenshot_path: str) -> bool:
        record = self.get_record(record_id)
        if not record:
            return False

        src_path = Path(screenshot_path)
        if not src_path.exists():
            return False

        dest_filename = f"{record_id}_xr_{datetime.now().strftime('%Y%m%d%H%M%S')}{src_path.suffix}"
        dest_path = config.UPLOAD_DIR / dest_filename
        
        shutil.copy2(src_path, dest_path)
        record.xr_screenshot_path = str(dest_path)

        self._update_balance_after_xr(record)
        self._save_records()
        return True

    def _update_balance_after_xr(self, record: PaymentRecord) -> None:
        if not record.balance_change:
            return

        record.balance_change.has_xr_screenshot = True

        if IssueType.MISSING_XR_SCREENSHOT in record.issues:
            record.issues.remove(IssueType.MISSING_XR_SCREENSHOT)

        reasons = []
        missing = []
        next_step = None

        if IssueType.PINYIN_APPROVER in record.issues:
            reasons.append("审批人仅留拼音，需确认身份")
            missing.append("审批人身份证明/签章")
            next_step = "联系客户经理"

        if IssueType.AMOUNT_MISMATCH in record.issues:
            reasons.append("余额计算口径有误")
            missing.append("正确余额计算表")
            next_step = "联系基金会计林姐"

        if reasons:
            record.balance_change.reason = "；".join(reasons)
        else:
            record.balance_change.reason = "除权日截图已补录，余额已确认"

        record.balance_change.missing_materials = missing
        record.balance_change.next_step = next_step

        if not record.issues:
            record.status = ReviewStatus.COMPLETED
        elif IssueType.PINYIN_APPROVER in record.issues:
            record.status = ReviewStatus.MANAGER_REVIEW
        else:
            record.status = ReviewStatus.SUPPLEMENTING

    def correct_amount(self, record_id: str, new_after_amount: float) -> bool:
        record = self.get_record(record_id)
        if not record or not record.balance_change:
            return False

        old_amount = record.balance_change.after_amount
        record.balance_change.after_amount = new_after_amount
        record.add_correction(f"修正余额: {old_amount:.2f} → {new_after_amount:.2f}")

        if IssueType.AMOUNT_MISMATCH in record.issues:
            record.issues.remove(IssueType.AMOUNT_MISMATCH)

        expected = record.balance_change.before_amount + record.balance_change.change_amount
        if abs(expected - new_after_amount) > 0.01:
            record.issues.append(IssueType.AMOUNT_MISMATCH)

        self._update_balance_after_xr(record)
        self._save_records()
        return True

    def confirm_pinyin_approver(self, record_id: str, full_name: str) -> bool:
        record = self.get_record(record_id)
        if not record:
            return False

        record.approver.full_name = full_name
        record.approver.is_pinyin = False
        record.add_correction(f"确认审批人: {record.approver.name} → {full_name}")

        if IssueType.PINYIN_APPROVER in record.issues:
            record.issues.remove(IssueType.PINYIN_APPROVER)

        self._update_balance_after_xr(record)
        self._save_records()
        return True

    def rerun_record(self, record_id: str) -> bool:
        record = self.get_record(record_id)
        if not record:
            return False

        record.mark_rerun()
        record.status = ReviewStatus.PENDING_REVIEW
        record.notes = f"第{record.rerun_count}次重跑: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        self._save_records()
        return True

    def delete_record(self, record_id: str) -> bool:
        if record_id in self.records:
            del self.records[record_id]
            self._save_records()
            return True
        return False
