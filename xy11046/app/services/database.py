from datetime import datetime
from typing import Dict, List, Optional
from app.models.schemas import (
    MealVoucher, MealVoucherCreate, VerificationStatus, CertificateStatus,
    SubsidyLevel
)


class InMemoryDB:
    def __init__(self):
        self.vouchers: Dict[str, MealVoucher] = {}
        self.monthly_reports: Dict[str, Dict] = {}
        self.next_id = 1

    def add_voucher(self, voucher_create: MealVoucherCreate) -> MealVoucher:
        now = datetime.now()
        voucher = MealVoucher(
            id=self.next_id,
            **voucher_create.model_dump(),
            verification_status=VerificationStatus.PENDING,
            certificate_status=CertificateStatus.VALID,
            verification_time=None,
            verifier=None,
            verification_remark=None,
            subsidy_level_history=[voucher_create.subsidy_level],
            created_at=now,
            updated_at=now
        )
        self.vouchers[voucher.voucher_no] = voucher
        self.next_id += 1
        return voucher

    def get_voucher(self, voucher_no: str) -> Optional[MealVoucher]:
        return self.vouchers.get(voucher_no)

    def get_all_vouchers(self) -> List[MealVoucher]:
        return list(self.vouchers.values())

    def update_voucher(self, voucher_no: str, **kwargs) -> Optional[MealVoucher]:
        if voucher_no in self.vouchers:
            voucher = self.vouchers[voucher_no]
            for key, value in kwargs.items():
                if hasattr(voucher, key):
                    setattr(voucher, key, value)
            voucher.updated_at = datetime.now()
            self.vouchers[voucher_no] = voucher
            return voucher
        return None

    def delete_voucher(self, voucher_no: str) -> bool:
        if voucher_no in self.vouchers:
            del self.vouchers[voucher_no]
            return True
        return False

    def add_monthly_report(self, report_key: str, report_data: Dict):
        self.monthly_reports[report_key] = report_data

    def get_monthly_report(self, report_key: str) -> Optional[Dict]:
        return self.monthly_reports.get(report_key)


db = InMemoryDB()
