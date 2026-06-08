import re
import json
from pathlib import Path
from typing import Optional, List, Dict
from datetime import datetime

from .models import PaymentRecord, Approver, BalanceChange, ReviewStatus, IssueType
from . import config

class PinyinDetector:
    CHINESE_PATTERN = re.compile(r'[\u4e00-\u9fff]+')
    PINYIN_PATTERN = re.compile(r'^[a-zA-Z\s]+$')
    COMMON_CHINESE_NAMES = [
        "张三", "李四", "王五", "赵六", "林姐", "王经理", "李总",
        "张伟", "王芳", "李娜", "刘洋", "陈明", "杨丽", "赵强"
    ]

    @classmethod
    def is_pinyin(cls, name: str) -> bool:
        if not name or not name.strip():
            return False
        name_clean = name.strip()
        if cls.CHINESE_PATTERN.search(name_clean):
            return False
        if cls.PINYIN_PATTERN.match(name_clean):
            parts = name_clean.split()
            if len(parts) >= 2 and all(len(p) >= 2 for p in parts):
                return True
        return False

    @classmethod
    def detect_full_name(cls, pinyin_name: str) -> Optional[str]:
        mapping = {
            "lin jie": "林姐",
            "wang jing li": "王经理",
            "zhang san": "张三",
            "li si": "李四",
            "wang wu": "王五",
            "zhao liu": "赵六",
            "chen ming": "陈明",
            "yang li": "杨丽",
            "zhao qiang": "赵强",
            "zhang wei": "张伟",
            "wang fang": "王芳",
            "li na": "李娜",
            "liu yang": "刘洋",
        }
        pinyin_lower = pinyin_name.lower().strip()
        return mapping.get(pinyin_lower)

class CustodianImporter:
    def __init__(self):
        self.pinyin_detector = PinyinDetector()

    def import_from_json(self, file_path: str) -> PaymentRecord:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        return self._parse_data(data, source_file=path.name)

    def import_from_dict(self, data: Dict, record_id: Optional[str] = None) -> PaymentRecord:
        return self._parse_data(data, record_id=record_id)

    def _parse_data(self, data: Dict, source_file: Optional[str] = None, record_id: Optional[str] = None) -> PaymentRecord:
        record_id = record_id or data.get('id') or f"PAY{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        approver_name = data.get('approver', '')
        is_pinyin = self.pinyin_detector.is_pinyin(approver_name)
        
        approver = Approver(
            name=approver_name,
            is_pinyin=is_pinyin,
            full_name=self.pinyin_detector.detect_full_name(approver_name) if is_pinyin else approver_name
        )

        balance_data = data.get('balance_change', {})
        balance_change = None
        if balance_data:
            balance_change = BalanceChange(
                date=balance_data.get('date', datetime.now().strftime('%Y-%m-%d')),
                before_amount=float(balance_data.get('before_amount', 0)),
                change_amount=float(balance_data.get('change_amount', 0)),
                after_amount=float(balance_data.get('after_amount', 0)),
                reason=balance_data.get('reason', ''),
                missing_materials=balance_data.get('missing_materials', []),
                next_step=balance_data.get('next_step'),
                has_xr_screenshot=balance_data.get('has_xr_screenshot', False)
            )

        record = PaymentRecord(
            id=record_id,
            payment_date=data.get('payment_date', datetime.now().strftime('%Y-%m-%d')),
            amount=float(data.get('amount', 0)),
            currency=data.get('currency', 'CNY'),
            payee=data.get('payee', ''),
            approver=approver,
            balance_change=balance_change,
            status=ReviewStatus.PENDING_REVIEW,
            issues=[],
            xr_screenshot_path=data.get('xr_screenshot_path'),
            notes=data.get('notes', '')
        )

        self._detect_issues(record)
        self._update_balance_info(record)

        issue_names = [i.value for i in record.issues]
        record.add_audit_event(
            "导入托管确认页",
            "系统",
            f"问题: {', '.join(issue_names)}" if issue_names else "无问题"
        )

        return record

    def _detect_issues(self, record: PaymentRecord) -> None:
        if record.approver.is_pinyin:
            record.issues.append(IssueType.PINYIN_APPROVER)
        
        if record.balance_change and not record.balance_change.has_xr_screenshot:
            record.issues.append(IssueType.MISSING_XR_SCREENSHOT)
        
        if record.balance_change:
            expected = record.balance_change.before_amount - record.balance_change.change_amount
            if abs(expected - record.balance_change.after_amount) > 0.01:
                record.issues.append(IssueType.AMOUNT_MISMATCH)

    def _update_balance_info(self, record: PaymentRecord) -> None:
        if not record.balance_change:
            return

        reasons = []
        missing = []
        next_step = None

        if IssueType.PINYIN_APPROVER in record.issues:
            reasons.append("审批人仅留拼音，需确认身份")
            missing.append("审批人身份证明/签章")
            next_step = "联系客户经理"

        if IssueType.MISSING_XR_SCREENSHOT in record.issues:
            reasons.append("缺少除权日截图")
            missing.append("除权日交易截图")
            if not next_step:
                next_step = "联系基金会计林姐"

        if IssueType.AMOUNT_MISMATCH in record.issues:
            reasons.append("余额计算口径有误")
            missing.append("正确余额计算表")
            if not next_step:
                next_step = "联系基金会计林姐"

        if reasons:
            record.balance_change.reason = "；".join(reasons)
        if missing:
            record.balance_change.missing_materials = missing
        if next_step:
            record.balance_change.next_step = next_step

        if IssueType.PINYIN_APPROVER in record.issues:
            record.status = ReviewStatus.MANAGER_REVIEW
        elif IssueType.MISSING_XR_SCREENSHOT in record.issues:
            record.status = ReviewStatus.SUPPLEMENTING
