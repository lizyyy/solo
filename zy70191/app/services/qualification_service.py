from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import Supplier, Qualification, QualificationStatus, ExceptionType
from app.schemas import QualificationCheckResult
from app.services.supplier_service import SupplierService


class QualificationService:
    def __init__(self, db: Session):
        self.db = db
        self.supplier_service = SupplierService(db)

    def check_qualification(self, supplier_id: int) -> QualificationCheckResult:
        supplier = self.supplier_service.get_supplier(supplier_id)
        if not supplier:
            return QualificationCheckResult(
                supplier_id=supplier_id,
                supplier_name="未知供应商",
                passed=False,
                failed_qualifications=["供应商不存在"],
                message="供应商未找到"
            )

        qualifications = self.supplier_service.get_supplier_qualifications(supplier_id)
        
        if not qualifications:
            return QualificationCheckResult(
                supplier_id=supplier_id,
                supplier_name=supplier.name,
                passed=False,
                failed_qualifications=["无任何资质信息"],
                message="供应商未提供资质证明"
            )

        failed_quals = []
        now = datetime.utcnow()

        for qual in qualifications:
            if qual.status == QualificationStatus.EXPIRED:
                failed_quals.append(f"资质「{qual.name}」已过期")
            elif qual.expiry_date <= now:
                failed_quals.append(f"资质「{qual.name}」已过期（有效期至: {qual.expiry_date.strftime('%Y-%m-%d')}）")
            elif qual.status == QualificationStatus.PENDING:
                failed_quals.append(f"资质「{qual.name}」待审核")

        if failed_quals:
            return QualificationCheckResult(
                supplier_id=supplier_id,
                supplier_name=supplier.name,
                passed=False,
                failed_qualifications=failed_quals,
                message=f"供应商「{supplier.name}」资质校验不通过"
            )

        return QualificationCheckResult(
            supplier_id=supplier_id,
            supplier_name=supplier.name,
            passed=True,
            failed_qualifications=[],
            message=f"供应商「{supplier.name}」资质校验通过"
        )

    def check_alternative_suppliers(self, primary_supplier_id: int) -> List[QualificationCheckResult]:
        results = []
        alternatives = self.supplier_service.get_alternative_suppliers()
        
        for alt in alternatives:
            if alt.id != primary_supplier_id:
                result = self.check_qualification(alt.id)
                results.append(result)
        
        return results

    def get_expiring_qualifications(self, days: int = 30) -> List[Qualification]:
        from datetime import timedelta
        cutoff_date = datetime.utcnow() + timedelta(days=days)
        
        return self.db.query(Qualification).filter(
            Qualification.status == QualificationStatus.VALID,
            Qualification.expiry_date <= cutoff_date,
            Qualification.expiry_date > datetime.utcnow()
        ).all()

    def update_expired_qualifications(self) -> int:
        now = datetime.utcnow()
        expired_count = self.db.query(Qualification).filter(
            Qualification.status == QualificationStatus.VALID,
            Qualification.expiry_date <= now
        ).update(
            {"status": QualificationStatus.EXPIRED},
            synchronize_session=False
        )
        self.db.commit()
        return expired_count
