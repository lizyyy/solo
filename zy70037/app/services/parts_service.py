from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..models.parts import Part, PartsUsage
from ..models.repair_receipts import RepairReceipt
from ..schemas.parts import (
    PartCreate,
    PartUpdate,
    PartQuery,
    PartsUsageCreate,
)


class PartService:
    def __init__(self, db: Session):
        self.db = db

    def _build_part_query(self, query_params: PartQuery):
        query = self.db.query(Part)

        if query_params.name:
            query = query.filter(Part.name.like(f"%{query_params.name}%"))
        if query_params.code:
            query = query.filter(Part.code.like(f"%{query_params.code}%"))
        if query_params.category:
            query = query.filter(Part.category == query_params.category)

        return query

    def list_parts(self, query_params: PartQuery) -> Tuple[List[Part], int]:
        query = self._build_part_query(query_params)
        total = query.count()
        parts = (
            query.order_by(Part.id.desc())
            .offset((query_params.page - 1) * query_params.page_size)
            .limit(query_params.page_size)
            .all()
        )
        return parts, total

    def get_part_by_id(self, part_id: int) -> Optional[Part]:
        return self.db.query(Part).filter(Part.id == part_id).first()

    def get_part_by_code(self, code: str) -> Optional[Part]:
        return self.db.query(Part).filter(Part.code == code).first()

    def create_part(self, data: PartCreate) -> Part:
        part = Part(
            name=data.name,
            code=data.code,
            category=data.category,
            unit=data.unit,
            unit_price=data.unit_price,
            stock=data.stock,
            description=data.description,
        )
        self.db.add(part)
        self.db.commit()
        self.db.refresh(part)
        return part

    def update_part(self, part_id: int, data: PartUpdate) -> Optional[Part]:
        part = self.get_part_by_id(part_id)
        if not part:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(part, field, value)

        self.db.commit()
        self.db.refresh(part)
        return part

    def delete_part(self, part_id: int) -> bool:
        part = self.get_part_by_id(part_id)
        if not part:
            return False
        self.db.delete(part)
        self.db.commit()
        return True

    def update_stock(self, part_id: int, quantity_change: int) -> Optional[Part]:
        part = self.get_part_by_id(part_id)
        if not part:
            return None

        part.stock += quantity_change
        self.db.commit()
        self.db.refresh(part)
        return part


class PartsUsageService:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, usage_id: int) -> Optional[PartsUsage]:
        return self.db.query(PartsUsage).filter(PartsUsage.id == usage_id).first()

    def get_by_receipt(self, receipt_id: int) -> List[PartsUsage]:
        return self.db.query(PartsUsage).filter(PartsUsage.receipt_id == receipt_id).all()

    def create(self, data: PartsUsageCreate) -> Optional[PartsUsage]:
        part = self.db.query(Part).filter(Part.id == data.part_id).first()
        if not part:
            return None

        if part.stock < data.quantity:
            return None

        usage = PartsUsage(
            receipt_id=data.receipt_id,
            part_id=data.part_id,
            quantity=data.quantity,
            unit_price=part.unit_price,
            notes=data.notes,
        )
        self.db.add(usage)

        part.stock -= data.quantity

        self.db.commit()
        self.db.refresh(usage)
        return usage

    def delete(self, usage_id: int) -> bool:
        usage = self.get_by_id(usage_id)
        if not usage:
            return False

        part = self.db.query(Part).filter(Part.id == usage.part_id).first()
        if part:
            part.stock += usage.quantity

        self.db.delete(usage)
        self.db.commit()
        return True

    def batch_create(self, receipt_id: int, items: List[PartsUsageCreate]) -> List[PartsUsage]:
        results = []
        for item in items:
            item.receipt_id = receipt_id
            usage = self.create(item)
            if usage:
                results.append(usage)
        return results
