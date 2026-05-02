from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional, Sequence

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from hazardous_gate.models.database import (
    AuditLog,
    Batch,
    CourseUsage,
    HazardLevel,
    Reagent,
    ReturnItem,
    ReturnRecord,
    StorageGroup,
    UsageItem,
    UsageStatus,
)
from hazardous_gate.models.schemas import (
    BatchCreate,
    BatchUpdate,
    CourseUsageCreate,
    CourseUsageUpdate,
    ReagentCreate,
    ReagentUpdate,
    ReturnRecordCreate,
    UsageApproval,
)


class ReagentCRUD:
    @staticmethod
    async def get_by_id(db: AsyncSession, reagent_id: int) -> Optional[Reagent]:
        result = await db.execute(select(Reagent).where(Reagent.id == reagent_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_cas(db: AsyncSession, cas_number: str) -> Optional[Reagent]:
        result = await db.execute(
            select(Reagent).where(func.trim(Reagent.cas_number) == func.trim(cas_number))
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_all(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        hazard_level: Optional[str] = None,
        storage_group: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> Sequence[Reagent]:
        query = select(Reagent)
        if hazard_level:
            query = query.where(Reagent.hazard_level == hazard_level)
        if storage_group:
            query = query.where(Reagent.storage_group == storage_group)
        if keyword:
            keyword = f"%{keyword}%"
            query = query.where(
                or_(
                    Reagent.name.ilike(keyword),
                    Reagent.cas_number.ilike(keyword),
                    Reagent.english_name.ilike(keyword),
                )
            )
        query = query.offset(skip).limit(limit).order_by(Reagent.id)
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def count(
        db: AsyncSession,
        hazard_level: Optional[str] = None,
        storage_group: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> int:
        query = select(func.count(Reagent.id))
        if hazard_level:
            query = query.where(Reagent.hazard_level == hazard_level)
        if storage_group:
            query = query.where(Reagent.storage_group == storage_group)
        if keyword:
            keyword = f"%{keyword}%"
            query = query.where(
                or_(
                    Reagent.name.ilike(keyword),
                    Reagent.cas_number.ilike(keyword),
                    Reagent.english_name.ilike(keyword),
                )
            )
        result = await db.execute(query)
        return result.scalar_one()

    @staticmethod
    async def create(db: AsyncSession, obj_in: ReagentCreate) -> Reagent:
        db_obj = Reagent(**obj_in.model_dump())
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    @staticmethod
    async def update(db: AsyncSession, db_obj: Reagent, obj_in: ReagentUpdate) -> Reagent:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    @staticmethod
    async def delete(db: AsyncSession, reagent_id: int) -> bool:
        db_obj = await ReagentCRUD.get_by_id(db, reagent_id)
        if db_obj:
            await db.delete(db_obj)
            await db.commit()
            return True
        return False


class BatchCRUD:
    @staticmethod
    async def get_by_id(db: AsyncSession, batch_id: int, load_reagent: bool = False) -> Optional[Batch]:
        query = select(Batch).where(Batch.id == batch_id)
        if load_reagent:
            query = query.options(joinedload(Batch.reagent))
        result = await db.execute(query)
        return result.unique().scalar_one_or_none()

    @staticmethod
    async def get_by_number(db: AsyncSession, batch_number: str) -> Optional[Batch]:
        result = await db.execute(
            select(Batch).where(func.trim(Batch.batch_number) == func.trim(batch_number))
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_reagent(
        db: AsyncSession, reagent_id: int, only_active: bool = True
    ) -> Sequence[Batch]:
        query = select(Batch).where(Batch.reagent_id == reagent_id)
        if only_active:
            query = query.where(Batch.is_active == True)
        query = query.order_by(Batch.expiry_date)
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_all(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        reagent_id: Optional[int] = None,
        only_active: bool = True,
        expiring_soon: Optional[int] = None,
        keyword: Optional[str] = None,
    ) -> Sequence[Batch]:
        query = select(Batch).options(joinedload(Batch.reagent))
        if reagent_id:
            query = query.where(Batch.reagent_id == reagent_id)
        if only_active:
            query = query.where(Batch.is_active == True)
        if expiring_soon is not None:
            today = date.today()
            expiry_cutoff = today + timedelta(days=expiring_soon)
            query = query.where(and_(Batch.expiry_date <= expiry_cutoff, Batch.expiry_date >= today))
        if keyword:
            keyword = f"%{keyword}%"
            query = query.join(Reagent).where(
                or_(
                    Reagent.name.ilike(keyword),
                    Reagent.cas_number.ilike(keyword),
                    Batch.batch_number.ilike(keyword),
                )
            )
        query = query.offset(skip).limit(limit).order_by(Batch.id)
        result = await db.execute(query)
        return result.unique().scalars().all()

    @staticmethod
    async def count(
        db: AsyncSession,
        reagent_id: Optional[int] = None,
        only_active: bool = True,
        keyword: Optional[str] = None,
    ) -> int:
        query = select(func.count(Batch.id))
        if reagent_id:
            query = query.where(Batch.reagent_id == reagent_id)
        if only_active:
            query = query.where(Batch.is_active == True)
        if keyword:
            keyword = f"%{keyword}%"
            query = query.join(Reagent).where(
                or_(
                    Reagent.name.ilike(keyword),
                    Reagent.cas_number.ilike(keyword),
                    Batch.batch_number.ilike(keyword),
                )
            )
        result = await db.execute(query)
        return result.scalar_one()

    @staticmethod
    async def create(db: AsyncSession, obj_in: BatchCreate) -> Batch:
        db_obj = Batch(**obj_in.model_dump())
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    @staticmethod
    async def update(db: AsyncSession, db_obj: Batch, obj_in: BatchUpdate) -> Batch:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    @staticmethod
    async def update_quantity(
        db: AsyncSession, batch_id: int, quantity_delta: Decimal
    ) -> Optional[Batch]:
        db_obj = await BatchCRUD.get_by_id(db, batch_id)
        if db_obj:
            db_obj.current_quantity += quantity_delta
            if db_obj.current_quantity < 0:
                db_obj.current_quantity = Decimal("0")
            await db.commit()
            await db.refresh(db_obj)
        return db_obj

    @staticmethod
    async def deactivate(db: AsyncSession, batch_id: int) -> Optional[Batch]:
        db_obj = await BatchCRUD.get_by_id(db, batch_id)
        if db_obj:
            db_obj.is_active = False
            await db.commit()
            await db.refresh(db_obj)
        return db_obj


class CourseUsageCRUD:
    @staticmethod
    async def get_by_id(
        db: AsyncSession, usage_id: int, load_items: bool = True
    ) -> Optional[CourseUsage]:
        query = select(CourseUsage).where(CourseUsage.id == usage_id)
        if load_items:
            query = query.options(
                selectinload(CourseUsage.items).selectinload(UsageItem.batch).selectinload(Batch.reagent)
            )
        result = await db.execute(query)
        return result.unique().scalar_one_or_none()

    @staticmethod
    async def get_by_number(db: AsyncSession, usage_number: str) -> Optional[CourseUsage]:
        result = await db.execute(
            select(CourseUsage).where(CourseUsage.usage_number == usage_number)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_all(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        teacher_id: Optional[str] = None,
        status: Optional[str] = None,
        experiment_date_from: Optional[date] = None,
        experiment_date_to: Optional[date] = None,
        keyword: Optional[str] = None,
    ) -> Sequence[CourseUsage]:
        query = select(CourseUsage).options(
            selectinload(CourseUsage.items).selectinload(UsageItem.batch).selectinload(Batch.reagent)
        )
        if teacher_id:
            query = query.where(CourseUsage.teacher_id == teacher_id)
        if status:
            query = query.where(CourseUsage.status == status)
        if experiment_date_from:
            query = query.where(CourseUsage.experiment_date >= experiment_date_from)
        if experiment_date_to:
            query = query.where(CourseUsage.experiment_date <= experiment_date_to)
        if keyword:
            keyword = f"%{keyword}%"
            query = query.where(
                or_(
                    CourseUsage.course_name.ilike(keyword),
                    CourseUsage.teacher_name.ilike(keyword),
                    CourseUsage.usage_number.ilike(keyword),
                )
            )
        query = query.offset(skip).limit(limit).order_by(CourseUsage.id.desc())
        result = await db.execute(query)
        return result.unique().scalars().all()

    @staticmethod
    async def create(db: AsyncSession, obj_in: CourseUsageCreate) -> CourseUsage:
        now = datetime.now()
        usage_number = f"LY{now.strftime('%Y%m%d%H%M%S')}"

        usage_data = obj_in.model_dump(exclude={"items"})
        db_usage = CourseUsage(
            **usage_data,
            usage_number=usage_number,
            status=UsageStatus.PENDING,
        )
        db.add(db_usage)
        await db.flush()

        for item_in in obj_in.items:
            db_item = UsageItem(
                course_usage_id=db_usage.id,
                **item_in.model_dump(),
            )
            db.add(db_item)

        await db.commit()
        await db.refresh(db_usage)
        return db_usage

    @staticmethod
    async def update(db: AsyncSession, db_obj: CourseUsage, obj_in: CourseUsageUpdate) -> CourseUsage:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    @staticmethod
    async def approve(
        db: AsyncSession, usage_id: int, approval: UsageApproval
    ) -> Optional[CourseUsage]:
        db_usage = await CourseUsageCRUD.get_by_id(db, usage_id, load_items=True)
        if not db_usage:
            return None

        if approval.approved:
            db_usage.status = UsageStatus.APPROVED
        else:
            db_usage.status = UsageStatus.REJECTED

        db_usage.approved_by = approval.approved_by
        db_usage.approved_at = datetime.now()

        for item in db_usage.items:
            item.approved_quantity = item.requested_quantity if approval.approved else None

        await db.commit()
        await db.refresh(db_usage)
        return db_usage

    @staticmethod
    async def issue(db: AsyncSession, usage_id: int) -> Optional[CourseUsage]:
        db_usage = await CourseUsageCRUD.get_by_id(db, usage_id, load_items=True)
        if not db_usage or db_usage.status != UsageStatus.APPROVED:
            return None

        db_usage.status = UsageStatus.IN_USE

        for item in db_usage.items:
            if item.approved_quantity:
                item.issued_quantity = item.approved_quantity
                item.batch.current_quantity -= item.approved_quantity

        await db.commit()
        await db.refresh(db_usage)
        return db_usage


class ReturnRecordCRUD:
    @staticmethod
    async def get_by_id(
        db: AsyncSession, return_id: int, load_items: bool = True
    ) -> Optional[ReturnRecord]:
        query = select(ReturnRecord).where(ReturnRecord.id == return_id)
        if load_items:
            query = query.options(
                selectinload(ReturnRecord.items),
                selectinload(ReturnRecord.course_usage),
            )
        result = await db.execute(query)
        return result.unique().scalar_one_or_none()

    @staticmethod
    async def get_by_usage(db: AsyncSession, usage_id: int) -> Sequence[ReturnRecord]:
        query = (
            select(ReturnRecord)
            .where(ReturnRecord.course_usage_id == usage_id)
            .order_by(ReturnRecord.created_at.desc())
        )
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def create(db: AsyncSession, obj_in: ReturnRecordCreate) -> Optional[ReturnRecord]:
        db_usage = await CourseUsageCRUD.get_by_id(db, obj_in.course_usage_id, load_items=True)
        if not db_usage:
            return None

        now = datetime.now()
        return_number = f"GH{now.strftime('%Y%m%d%H%M%S')}"

        total_returned = Decimal("0")
        total_waste = Decimal("0")

        return_data = obj_in.model_dump(exclude={"items"})
        db_return = ReturnRecord(
            **return_data,
            return_number=return_number,
            total_returned_quantity=Decimal("0"),
            total_waste_quantity=Decimal("0"),
        )
        db.add(db_return)
        await db.flush()

        usage_item_map = {item.id: item for item in db_usage.items}

        for item_in in obj_in.items:
            usage_item = usage_item_map.get(item_in.usage_item_id)
            if not usage_item:
                continue

            max_returnable = (usage_item.issued_quantity or Decimal("0")) - usage_item.returned_quantity - usage_item.waste_quantity
            if item_in.returned_quantity + item_in.waste_quantity > max_returnable:
                continue

            db_return_item = ReturnItem(
                return_record_id=db_return.id,
                usage_item_id=item_in.usage_item_id,
                batch_id=usage_item.batch_id,
                returned_quantity=item_in.returned_quantity,
                waste_quantity=item_in.waste_quantity,
                unit=item_in.unit,
                condition=item_in.condition,
                remarks=item_in.remarks,
            )
            db.add(db_return_item)

            usage_item.returned_quantity += item_in.returned_quantity
            usage_item.waste_quantity += item_in.waste_quantity

            if item_in.returned_quantity > 0:
                usage_item.batch.current_quantity += item_in.returned_quantity

            total_returned += item_in.returned_quantity
            total_waste += item_in.waste_quantity

        db_return.total_returned_quantity = total_returned
        db_return.total_waste_quantity = total_waste

        all_returned = all(
            (item.issued_quantity or Decimal("0")) <= (item.returned_quantity + item.waste_quantity)
            for item in db_usage.items
        )
        if all_returned:
            db_usage.status = UsageStatus.RETURNED

        await db.commit()
        await db.refresh(db_return)
        return db_return


class AuditLogCRUD:
    @staticmethod
    async def create(
        db: AsyncSession,
        action: str,
        resource_type: str,
        resource_id: Optional[int] = None,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        details: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuditLog:
        db_log = AuditLog(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            user_id=user_id,
            user_name=user_name,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(db_log)
        await db.commit()
        await db.refresh(db_log)
        return db_log

    @staticmethod
    async def get_all(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        user_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Sequence[AuditLog]:
        query = select(AuditLog)
        if action:
            query = query.where(AuditLog.action == action)
        if resource_type:
            query = query.where(AuditLog.resource_type == resource_type)
        if user_id:
            query = query.where(AuditLog.user_id == user_id)
        if start_time:
            query = query.where(AuditLog.created_at >= start_time)
        if end_time:
            query = query.where(AuditLog.created_at <= end_time)
        query = query.offset(skip).limit(limit).order_by(AuditLog.created_at.desc())
        result = await db.execute(query)
        return result.scalars().all()
