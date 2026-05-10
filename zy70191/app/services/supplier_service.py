from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import Supplier, SupplierType, SupplierStatus, Qualification, QualificationStatus, PriceSnapshot
from app.schemas import SupplierCreate, QualificationCreate, PriceSnapshotCreate


class SupplierService:
    def __init__(self, db: Session):
        self.db = db

    def create_supplier(self, supplier_data: SupplierCreate) -> Supplier:
        supplier = Supplier(
            name=supplier_data.name,
            code=supplier_data.code,
            type=supplier_data.type,
            status=supplier_data.status,
            contact_person=supplier_data.contact_person,
            phone=supplier_data.phone,
            address=supplier_data.address
        )
        self.db.add(supplier)
        self.db.flush()

        if supplier_data.qualifications:
            for qual in supplier_data.qualifications:
                qualification = Qualification(
                    supplier_id=supplier.id,
                    name=qual.name,
                    certificate_number=qual.certificate_number,
                    issue_date=qual.issue_date,
                    expiry_date=qual.expiry_date,
                    status=qual.status,
                    description=qual.description
                )
                self.db.add(qualification)

        if supplier_data.price_snapshots:
            for ps in supplier_data.price_snapshots:
                price_snapshot = PriceSnapshot(
                    supplier_id=supplier.id,
                    product_code=ps.product_code,
                    product_name=ps.product_name,
                    unit_price=ps.unit_price,
                    is_current=ps.is_current
                )
                self.db.add(price_snapshot)

        self.db.commit()
        self.db.refresh(supplier)
        return supplier

    def get_supplier(self, supplier_id: int) -> Optional[Supplier]:
        return self.db.query(Supplier).filter(Supplier.id == supplier_id).first()

    def get_supplier_by_code(self, code: str) -> Optional[Supplier]:
        return self.db.query(Supplier).filter(Supplier.code == code).first()

    def get_all_suppliers(self, supplier_type: Optional[SupplierType] = None) -> List[Supplier]:
        query = self.db.query(Supplier)
        if supplier_type:
            query = query.filter(Supplier.type == supplier_type)
        return query.all()

    def get_alternative_suppliers(self) -> List[Supplier]:
        return self.db.query(Supplier).filter(
            Supplier.type == SupplierType.ALTERNATIVE,
            Supplier.status == SupplierStatus.ACTIVE
        ).all()

    def update_supplier_status(self, supplier_id: int, status: SupplierStatus) -> Optional[Supplier]:
        supplier = self.get_supplier(supplier_id)
        if supplier:
            supplier.status = status
            self.db.commit()
            self.db.refresh(supplier)
        return supplier

    def add_qualification(self, supplier_id: int, qual_data: QualificationCreate) -> Optional[Qualification]:
        supplier = self.get_supplier(supplier_id)
        if not supplier:
            return None
        qualification = Qualification(
            supplier_id=supplier_id,
            name=qual_data.name,
            certificate_number=qual_data.certificate_number,
            issue_date=qual_data.issue_date,
            expiry_date=qual_data.expiry_date,
            status=qual_data.status,
            description=qual_data.description
        )
        self.db.add(qualification)
        self.db.commit()
        self.db.refresh(qualification)
        return qualification

    def add_price_snapshot(self, supplier_id: int, ps_data: PriceSnapshotCreate) -> Optional[PriceSnapshot]:
        supplier = self.get_supplier(supplier_id)
        if not supplier:
            return None
        
        existing = self.db.query(PriceSnapshot).filter(
            PriceSnapshot.supplier_id == supplier_id,
            PriceSnapshot.product_code == ps_data.product_code,
            PriceSnapshot.is_current == True
        ).first()
        if existing:
            existing.is_current = False

        price_snapshot = PriceSnapshot(
            supplier_id=supplier_id,
            product_code=ps_data.product_code,
            product_name=ps_data.product_name,
            unit_price=ps_data.unit_price,
            is_current=ps_data.is_current
        )
        self.db.add(price_snapshot)
        self.db.commit()
        self.db.refresh(price_snapshot)
        return price_snapshot

    def get_current_price(self, supplier_id: int, product_code: str) -> Optional[PriceSnapshot]:
        return self.db.query(PriceSnapshot).filter(
            PriceSnapshot.supplier_id == supplier_id,
            PriceSnapshot.product_code == product_code,
            PriceSnapshot.is_current == True
        ).first()

    def get_supplier_qualifications(self, supplier_id: int) -> List[Qualification]:
        return self.db.query(Qualification).filter(Qualification.supplier_id == supplier_id).all()
