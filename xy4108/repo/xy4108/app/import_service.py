import csv
import io
from typing import List, Dict, Optional
from datetime import date, datetime
from sqlalchemy.orm import Session
from .models import Child, MenuItem, Ingredient, AuditAction
from .services import AuditService
from .schemas import ImportResult


class CSVImportService:
    @staticmethod
    def parse_date(date_str: Optional[str]) -> Optional[date]:
        if not date_str:
            return None
        formats = ["%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d/%m/%Y"]
        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except (ValueError, AttributeError):
                continue
        return None

    @staticmethod
    def import_children(
        db: Session,
        csv_content: bytes,
        operator: Optional[str] = None
    ) -> ImportResult:
        try:
            content = csv_content.decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(content))
        except UnicodeDecodeError:
            content = csv_content.decode('gbk')
            reader = csv.DictReader(io.StringIO(content))

        total = 0
        imported = 0
        skipped = 0
        errors = []

        for row_num, row in enumerate(reader, start=2):
            total += 1
            
            try:
                name = row.get('姓名', row.get('name', '')).strip()
                student_id = row.get('学号', row.get('student_id', '')).strip()
                class_name = row.get('班级', row.get('class_name', '')).strip()
                allergens = row.get('过敏原', row.get('allergens', '')).strip()
                forbidden_foods = row.get('禁忌食材', row.get('forbidden_foods', '')).strip()

                if not name or not student_id:
                    errors.append(f"第{row_num}行：姓名或学号为空")
                    continue

                existing = db.query(Child).filter(Child.student_id == student_id).first()
                
                if existing:
                    existing.name = name
                    existing.class_name = class_name
                    existing.allergens = allergens or None
                    existing.forbidden_foods = forbidden_foods or None
                    imported += 1
                else:
                    child = Child(
                        name=name,
                        student_id=student_id,
                        class_name=class_name,
                        allergens=allergens or None,
                        forbidden_foods=forbidden_foods or None,
                        is_active=True
                    )
                    db.add(child)
                    imported += 1

            except Exception as e:
                errors.append(f"第{row_num}行：{str(e)}")
                skipped += 1

        db.commit()

        AuditService.log_action(
            db=db,
            action=AuditAction.IMPORT,
            entity_type="Child",
            details={
                "total": total,
                "imported": imported,
                "skipped": skipped,
                "errors_count": len(errors)
            },
            operator=operator
        )

        return ImportResult(
            success=True,
            total=total,
            imported=imported,
            errors=errors[:100],
            skipped=skipped
        )

    @staticmethod
    def import_menu(
        db: Session,
        csv_content: bytes,
        operator: Optional[str] = None
    ) -> ImportResult:
        try:
            content = csv_content.decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(content))
        except UnicodeDecodeError:
            content = csv_content.decode('gbk')
            reader = csv.DictReader(io.StringIO(content))

        total = 0
        imported = 0
        skipped = 0
        errors = []

        for row_num, row in enumerate(reader, start=2):
            total += 1
            
            try:
                menu_date_str = row.get('日期', row.get('menu_date', '')).strip()
                meal_type = row.get('餐次', row.get('meal_type', '')).strip()
                dish_name = row.get('菜品名称', row.get('dish_name', '')).strip()
                ingredients = row.get('食材', row.get('ingredients', '')).strip()
                allergens = row.get('过敏原提示', row.get('allergens', '')).strip()
                notes = row.get('备注', row.get('notes', '')).strip()

                menu_date = CSVImportService.parse_date(menu_date_str)
                
                if not menu_date or not dish_name:
                    errors.append(f"第{row_num}行：日期或菜品名称为空或格式错误")
                    continue

                if not meal_type:
                    meal_type = "午餐"

                menu_item = MenuItem(
                    menu_date=menu_date,
                    meal_type=meal_type,
                    dish_name=dish_name,
                    ingredients=ingredients or None,
                    allergens=allergens or None,
                    notes=notes or None
                )
                db.add(menu_item)
                imported += 1

            except Exception as e:
                errors.append(f"第{row_num}行：{str(e)}")
                skipped += 1

        db.commit()

        AuditService.log_action(
            db=db,
            action=AuditAction.IMPORT,
            entity_type="MenuItem",
            details={
                "total": total,
                "imported": imported,
                "skipped": skipped,
                "errors_count": len(errors)
            },
            operator=operator
        )

        return ImportResult(
            success=True,
            total=total,
            imported=imported,
            errors=errors[:100],
            skipped=skipped
        )

    @staticmethod
    def import_ingredients(
        db: Session,
        csv_content: bytes,
        operator: Optional[str] = None
    ) -> ImportResult:
        try:
            content = csv_content.decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(content))
        except UnicodeDecodeError:
            content = csv_content.decode('gbk')
            reader = csv.DictReader(io.StringIO(content))

        total = 0
        imported = 0
        skipped = 0
        errors = []

        for row_num, row in enumerate(reader, start=2):
            total += 1
            
            try:
                name = row.get('食材名称', row.get('name', '')).strip()
                batch_number = row.get('批次号', row.get('batch_number', '')).strip()
                supplier = row.get('供应商', row.get('supplier', '')).strip()
                production_date_str = row.get('生产日期', row.get('production_date', '')).strip()
                expiry_date_str = row.get('有效期至', row.get('expiry_date', '')).strip()
                allergens = row.get('过敏原', row.get('allergens', '')).strip()
                ingredients_list = row.get('配料表', row.get('ingredients_list', '')).strip()

                if not name or not batch_number:
                    errors.append(f"第{row_num}行：食材名称或批次号为空")
                    continue

                production_date = CSVImportService.parse_date(production_date_str)
                expiry_date = CSVImportService.parse_date(expiry_date_str)

                existing = db.query(Ingredient).filter(
                    Ingredient.name == name,
                    Ingredient.batch_number == batch_number
                ).first()

                if existing:
                    existing.supplier = supplier or None
                    existing.production_date = production_date
                    existing.expiry_date = expiry_date
                    existing.allergens = allergens or None
                    existing.ingredients_list = ingredients_list or None
                    imported += 1
                else:
                    ingredient = Ingredient(
                        name=name,
                        batch_number=batch_number,
                        supplier=supplier or None,
                        production_date=production_date,
                        expiry_date=expiry_date,
                        allergens=allergens or None,
                        ingredients_list=ingredients_list or None
                    )
                    db.add(ingredient)
                    imported += 1

            except Exception as e:
                errors.append(f"第{row_num}行：{str(e)}")
                skipped += 1

        db.commit()

        AuditService.log_action(
            db=db,
            action=AuditAction.IMPORT,
            entity_type="Ingredient",
            details={
                "total": total,
                "imported": imported,
                "skipped": skipped,
                "errors_count": len(errors)
            },
            operator=operator
        )

        return ImportResult(
            success=True,
            total=total,
            imported=imported,
            errors=errors[:100],
            skipped=skipped
        )
