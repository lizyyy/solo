import csv
import json
from datetime import datetime
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from pydantic import ValidationError

from canteen.database import get_db
from canteen.models import (
    ImportRecord, ImportDetail, Elderly, MenuItem, DailyMenu,
    DeliveryAssignment, Route, ImportStatus, ElderlyStatus, MenuStatus
)
from canteen.schemas import (
    ElderlyImportSchema, MenuItemImportSchema, DailyMenuImportSchema,
    DeliveryImportSchema, ImportResult
)
from canteen.exceptions import (
    ValidationException, DatabaseException, RecordNotFoundException, BatchOperationException
)


class BaseImportService:
    def __init__(self, db: Session):
        self.db = db

    def _create_import_record(self, import_type: str, file_name: str) -> ImportRecord:
        record = ImportRecord(
            import_type=import_type,
            file_name=file_name,
            status=ImportStatus.PENDING
        )
        self.db.add(record)
        self.db.flush()
        return record

    def _create_import_detail(self, import_record_id: int, row_number: int, raw_data: dict) -> ImportDetail:
        detail = ImportDetail(
            import_record_id=import_record_id,
            row_number=row_number,
            raw_data=raw_data,
            status=ImportStatus.PENDING
        )
        self.db.add(detail)
        self.db.flush()
        return detail

    def _update_detail_success(self, detail: ImportDetail, target_id: int):
        detail.status = ImportStatus.SUCCESS
        detail.target_id = target_id
        detail.error_message = None
        detail.fix_suggestion = None

    def _update_detail_failed(self, detail: ImportDetail, error: Exception, fix_suggestion: str = None):
        detail.status = ImportStatus.FAILED
        detail.error_message = str(error)
        detail.fix_suggestion = fix_suggestion or self._get_fix_suggestion(error)

    def _get_fix_suggestion(self, error: Exception) -> str:
        if isinstance(error, ValidationError):
            errors = []
            for e in error.errors():
                field = e.get("loc", [""])[-1]
                msg = e.get("msg", "")
                errors.append(f"{field}: {msg}")
            return "请检查以下字段: " + "; ".join(errors)
        elif "身份证" in str(error):
            return "请检查身份证号是否为18位有效格式"
        elif "手机号" in str(error):
            return "请检查手机号是否为11位有效格式"
        elif "UNIQUE constraint" in str(error) or "Duplicate entry" in str(error):
            return "数据重复，请检查是否已存在相同记录"
        return "请检查数据格式是否正确"

    def _finalize_import(self, import_record: ImportRecord, details: List[ImportDetail]):
        success_count = sum(1 for d in details if d.status == ImportStatus.SUCCESS)
        failed_count = sum(1 for d in details if d.status == ImportStatus.FAILED)

        import_record.success_count = success_count
        import_record.failed_count = failed_count
        import_record.total_count = len(details)
        import_record.completed_at = datetime.utcnow()

        if failed_count == 0:
            import_record.status = ImportStatus.SUCCESS
        elif success_count == 0:
            import_record.status = ImportStatus.FAILED
        else:
            import_record.status = ImportStatus.PARTIAL

        self.db.commit()

    def get_import_result(self, import_record_id: int) -> ImportResult:
        record = self.db.query(ImportRecord).filter(ImportRecord.id == import_record_id).first()
        if not record:
            raise RecordNotFoundException(f"导入记录不存在: {import_record_id}")
        
        details = self.db.query(ImportDetail).filter(ImportDetail.import_record_id == import_record_id).all()
        return ImportResult(
            import_record_id=record.id,
            status=record.status,
            total_count=record.total_count,
            success_count=record.success_count,
            failed_count=record.failed_count,
            error_message=record.error_message,
            details=details
        )


class ElderlyImportService(BaseImportService):
    def import_from_csv(self, file_path: str) -> ImportResult:
        import_record = self._create_import_record("elderly", file_path)
        details = []

        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                detail = self._create_import_detail(import_record.id, row_num, dict(row))
                try:
                    elderly = self._process_row(row)
                    self._update_detail_success(detail, elderly.id)
                except Exception as e:
                    self.db.rollback()
                    self._update_detail_failed(detail, e)
                details.append(detail)

        self._finalize_import(import_record, details)
        return self.get_import_result(import_record.id)

    def _process_row(self, row: Dict[str, Any]) -> Elderly:
        try:
            data = ElderlyImportSchema(**row)
        except ValidationError as e:
            raise ValidationException(str(e))

        existing = self.db.query(Elderly).filter(Elderly.id_card == data.id_card).first()
        if existing:
            raise ValidationException(f"身份证号已存在: {data.id_card}", "请检查是否重复导入")

        dietary = []
        if data.dietary_restrictions:
            dietary = [x.strip() for x in data.dietary_restrictions.split(",") if x.strip()]
        
        diseases = []
        if data.chronic_diseases:
            diseases = [x.strip() for x in data.chronic_diseases.split(",") if x.strip()]

        elderly = Elderly(
            name=data.name,
            id_card=data.id_card,
            phone=data.phone,
            gender=data.gender,
            age=data.age,
            address=data.address,
            community=data.community,
            building=data.building,
            room=data.room,
            route_code=data.route_code,
            dietary_restrictions=dietary,
            chronic_diseases=diseases,
            notes=data.notes,
            status=ElderlyStatus.ACTIVE
        )
        self.db.add(elderly)
        self.db.flush()
        return elderly


class MenuImportService(BaseImportService):
    def import_from_json(self, file_path: str) -> ImportResult:
        import_record = self._create_import_record("menu", file_path)
        details = []

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        menu_items = data.get("menu_items", [])

        for row_num, item in enumerate(menu_items, start=1):
            detail = self._create_import_detail(import_record.id, row_num, dict(item))
            try:
                menu_item = self._process_item(item)
                self._update_detail_success(detail, menu_item.id)
            except Exception as e:
                self.db.rollback()
                self._update_detail_failed(detail, e)
            details.append(detail)

        self._finalize_import(import_record, details)
        return self.get_import_result(import_record.id)

    def _process_item(self, item: Dict[str, Any]) -> MenuItem:
        try:
            data = MenuItemImportSchema(**item)
        except ValidationError as e:
            raise ValidationException(str(e))

        existing = self.db.query(MenuItem).filter(MenuItem.name == data.name).first()
        if existing:
            raise ValidationException(f"菜品已存在: {data.name}", "请检查是否重复导入")

        menu_item = MenuItem(
            name=data.name,
            category=data.category,
            price=data.price or 0.0,
            ingredients=data.ingredients or [],
            allergens=data.allergens or [],
            suitable_diseases=data.suitable_diseases or [],
            unsuitable_diseases=data.unsuitable_diseases or [],
            is_vegetarian=data.is_vegetarian or False,
            is_soft=data.is_soft or False,
            status=MenuStatus.PUBLISHED
        )
        self.db.add(menu_item)
        self.db.flush()
        return menu_item


class DailyMenuImportService(BaseImportService):
    def import_from_json(self, file_path: str) -> ImportResult:
        import_record = self._create_import_record("daily_menu", file_path)
        details = []

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        daily_menus = data.get("daily_menus", [])

        for row_num, item in enumerate(daily_menus, start=1):
            detail = self._create_import_detail(import_record.id, row_num, dict(item))
            try:
                daily_menu = self._process_item(item)
                self._update_detail_success(detail, daily_menu.id)
            except Exception as e:
                self.db.rollback()
                self._update_detail_failed(detail, e)
            details.append(detail)

        self._finalize_import(import_record, details)
        return self.get_import_result(import_record.id)

    def _process_item(self, item: Dict[str, Any]) -> DailyMenu:
        try:
            data = DailyMenuImportSchema(**item)
        except ValidationError as e:
            raise ValidationException(str(e))

        existing = self.db.query(DailyMenu).filter(
            DailyMenu.menu_date == data.menu_date,
            DailyMenu.meal_type == data.meal_type
        ).first()
        if existing:
            raise ValidationException(
                f"该日期餐别的菜单已存在: {data.menu_date} {data.meal_type}",
                "请检查是否重复导入"
            )

        menu_item_ids = []
        for menu_name in data.menu_items:
            menu_item = self.db.query(MenuItem).filter(MenuItem.name == menu_name).first()
            if not menu_item:
                raise ValidationException(
                    f"菜品不存在: {menu_name}",
                    "请先导入菜品或修正菜品名称"
                )
            menu_item_ids.append(menu_item.id)

        daily_menu = DailyMenu(
            menu_date=data.menu_date,
            meal_type=data.meal_type,
            menu_item_ids=menu_item_ids,
            status=MenuStatus.PUBLISHED
        )
        self.db.add(daily_menu)
        self.db.flush()
        return daily_menu


class DeliveryImportService(BaseImportService):
    def import_from_csv(self, file_path: str) -> ImportResult:
        import_record = self._create_import_record("delivery", file_path)
        details = []

        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                detail = self._create_import_detail(import_record.id, row_num, dict(row))
                try:
                    delivery = self._process_row(row)
                    self._update_detail_success(detail, delivery.id)
                except Exception as e:
                    self.db.rollback()
                    self._update_detail_failed(detail, e)
                details.append(detail)

        self._finalize_import(import_record, details)
        return self.get_import_result(import_record.id)

    def _process_row(self, row: Dict[str, Any]) -> DeliveryAssignment:
        try:
            data = DeliveryImportSchema(**row)
        except ValidationError as e:
            raise ValidationException(str(e))

        elderly = self.db.query(Elderly).filter(Elderly.id_card == data.id_card).first()
        if not elderly:
            raise RecordNotFoundException(
                f"老人不存在: {data.id_card}",
                "请先导入老人档案"
            )

        menu_item_ids = []
        if data.menu_items:
            for menu_name in data.menu_items:
                menu_item = self.db.query(MenuItem).filter(MenuItem.name == menu_name).first()
                if not menu_item:
                    raise ValidationException(
                        f"菜品不存在: {menu_name}",
                        "请先导入菜品或修正菜品名称"
                    )
                menu_item_ids.append(menu_item.id)

        existing = self.db.query(DeliveryAssignment).filter(
            DeliveryAssignment.elderly_id == elderly.id,
            DeliveryAssignment.delivery_date == data.delivery_date,
            DeliveryAssignment.meal_type == data.meal_type
        ).first()
        if existing:
            raise ValidationException(
                f"该老人该日期餐别的配送已存在: {elderly.name} {data.delivery_date} {data.meal_type}",
                "请检查是否重复导入"
            )

        route_code = data.route_code or elderly.route_code

        delivery = DeliveryAssignment(
            elderly_id=elderly.id,
            delivery_date=data.delivery_date,
            meal_type=data.meal_type,
            menu_item_ids=menu_item_ids,
            route_code=route_code,
            delivery_sequence=data.delivery_sequence or 0,
            volunteer_name=data.volunteer_name,
            volunteer_phone=data.volunteer_phone,
            notes=data.notes
        )
        self.db.add(delivery)
        self.db.flush()
        return delivery


class ReviewService:
    def __init__(self, db: Session):
        self.db = db

    def get_pending_deliveries(self, delivery_date: date = None, route_code: str = None):
        query = self.db.query(DeliveryAssignment).filter(
            DeliveryAssignment.review_status == "pending"
        )
        if delivery_date:
            query = query.filter(DeliveryAssignment.delivery_date == delivery_date)
        if route_code:
            query = query.filter(DeliveryAssignment.route_code == route_code)
        return query.order_by(
            DeliveryAssignment.delivery_date,
            DeliveryAssignment.route_code,
            DeliveryAssignment.delivery_sequence
        ).all()

    def review_delivery(self, delivery_id: int, approved: bool, notes: str = None, reviewer: str = None):
        delivery = self.db.query(DeliveryAssignment).filter(
            DeliveryAssignment.id == delivery_id
        ).first()
        if not delivery:
            raise RecordNotFoundException(f"配送记录不存在: {delivery_id}")

        delivery.review_status = "approved" if approved else "rejected"
        delivery.review_notes = notes
        delivery.reviewed_at = datetime.utcnow()
        delivery.reviewed_by = reviewer
        self.db.commit()
        return delivery

    def batch_review(self, delivery_ids: List[int], approved: bool, notes: str = None, reviewer: str = None):
        successful = []
        failed = []

        for delivery_id in delivery_ids:
            try:
                self.review_delivery(delivery_id, approved, notes, reviewer)
                successful.append(delivery_id)
            except Exception as e:
                failed.append({"id": delivery_id, "error": str(e)})

        if failed:
            raise BatchOperationException(
                f"批量复核部分失败: {len(successful)}成功, {len(failed)}失败",
                successful_ids=successful,
                failed_ids=failed
            )
        return {"successful": successful, "failed": failed}

    def check_dietary_rules(self, delivery_id: int) -> List[Dict[str, Any]]:
        delivery = self.db.query(DeliveryAssignment).filter(
            DeliveryAssignment.id == delivery_id
        ).first()
        if not delivery:
            raise RecordNotFoundException(f"配送记录不存在: {delivery_id}")

        elderly = self.db.query(Elderly).filter(Elderly.id == delivery.elderly_id).first()
        if not elderly:
            return []

        warnings = []

        for menu_item_id in delivery.menu_item_ids:
            menu_item = self.db.query(MenuItem).filter(MenuItem.id == menu_item_id).first()
            if not menu_item:
                continue

            for restriction in elderly.dietary_restrictions:
                if restriction in menu_item.allergens or restriction in menu_item.ingredients:
                    warnings.append({
                        "type": "dietary_restriction",
                        "severity": "high",
                        "message": f"{elderly.name} 忌口 {restriction}，但菜品 {menu_item.name} 含有该成分"
                    })

            for disease in elderly.chronic_diseases:
                if disease in menu_item.unsuitable_diseases:
                    warnings.append({
                        "type": "disease_unsuitable",
                        "severity": "high",
                        "message": f"{elderly.name} 患有 {disease}，菜品 {menu_item.name} 不适合该病症"
                    })

        return warnings


class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def export_deliveries(self, delivery_date: date, route_code: str = None, output_file: str = None):
        query = self.db.query(DeliveryAssignment).filter(
            DeliveryAssignment.delivery_date == delivery_date,
            DeliveryAssignment.review_status == "approved"
        )
        if route_code:
            query = query.filter(DeliveryAssignment.route_code == route_code)

        deliveries = query.order_by(
            DeliveryAssignment.route_code,
            DeliveryAssignment.delivery_sequence
        ).all()

        results = []
        for delivery in deliveries:
            elderly = self.db.query(Elderly).filter(Elderly.id == delivery.elderly_id).first()
            menu_items = self.db.query(MenuItem).filter(MenuItem.id.in_(delivery.menu_item_ids)).all()

            results.append({
                "delivery_id": delivery.id,
                "elderly_name": elderly.name if elderly else "",
                "id_card": elderly.id_card if elderly else "",
                "phone": elderly.phone if elderly else "",
                "address": elderly.address if elderly else "",
                "community": elderly.community if elderly else "",
                "building": elderly.building if elderly else "",
                "room": elderly.room if elderly else "",
                "route_code": delivery.route_code,
                "delivery_sequence": delivery.delivery_sequence,
                "meal_type": delivery.meal_type,
                "menu_items": [mi.name for mi in menu_items],
                "dietary_restrictions": elderly.dietary_restrictions if elderly else [],
                "chronic_diseases": elderly.chronic_diseases if elderly else [],
                "volunteer_name": delivery.volunteer_name,
                "volunteer_phone": delivery.volunteer_phone,
                "notes": delivery.notes
            })

        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(results, f, ensure_ascii=False, indent=2, default=str)

        return results

    def export_failed_imports(self, import_record_id: int, output_file: str = None):
        details = self.db.query(ImportDetail).filter(
            ImportDetail.import_record_id == import_record_id,
            ImportDetail.status == ImportStatus.FAILED
        ).all()

        results = []
        for detail in details:
            results.append({
                "row_number": detail.row_number,
                "raw_data": detail.raw_data,
                "error_message": detail.error_message,
                "fix_suggestion": detail.fix_suggestion
            })

        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(results, f, ensure_ascii=False, indent=2)

        return results
