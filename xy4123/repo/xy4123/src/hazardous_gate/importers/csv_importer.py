import csv
import io
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from hazardous_gate.config import get_settings
from hazardous_gate.models.database import HazardLevel, StorageGroup
from hazardous_gate.models.schemas import (
    BatchCreate,
    ImportResult,
    ReagentCreate,
    ValidationErrorItem,
)
from hazardous_gate.storage.crud import BatchCRUD, ReagentCRUD

settings = get_settings()

CSV_REQUIRED_FIELDS = [
    "试剂名称",
    "CAS号",
    "危险等级",
    "储存分组",
    "储柜分类",
    "批号",
    "浓度值",
    "浓度单位",
    "初始数量",
    "有效期",
]

CSV_OPTIONAL_FIELDS = [
    "英文名称",
    "分子式",
    "分子量",
    "纯度",
    "生产厂家",
    "包装单位",
    "生产日期",
    "存放位置",
    "储柜编号",
    "最低授权等级",
    "安全信息",
]


class CSVImporter:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.errors: list[ValidationErrorItem] = []
        self.warnings: list[ValidationErrorItem] = []

    def validate_cas_number(self, cas: str, row_num: int) -> tuple[bool, str]:
        cas = cas.strip()
        if not cas:
            return False, "CAS号不能为空"

        parts = cas.split("-")
        if len(parts) != 3:
            return False, "CAS号格式错误，应为 数字-数字-数字 格式"

        if not all(p.isdigit() for p in parts):
            return False, "CAS号各部分必须为数字"

        try:
            digits = "".join(parts)
            check_digit = int(digits[-1])
            total = sum(int(d) * (i + 1) for i, d in enumerate(reversed(digits[1:])))
            if total % 10 != check_digit:
                return False, "CAS号校验位错误"
        except Exception:
            return False, "CAS号格式验证失败"

        return True, ""

    def validate_hazard_level(self, level: str, row_num: int) -> tuple[bool, Optional[HazardLevel]]:
        level = level.strip()
        level_map = {
            "低危": HazardLevel.LOW,
            "中危": HazardLevel.MEDIUM,
            "高危": HazardLevel.HIGH,
            "剧毒": HazardLevel.EXTREME,
        }
        if level in level_map:
            return True, level_map[level]

        valid_values = list(level_map.keys())
        return False, None

    def validate_storage_group(self, group: str, row_num: int) -> tuple[bool, Optional[StorageGroup]]:
        group = group.strip()
        group_map = {
            "酸类": StorageGroup.ACID,
            "碱类": StorageGroup.BASE,
            "氧化剂": StorageGroup.OXIDIZER,
            "还原剂": StorageGroup.REDUCER,
            "有机物": StorageGroup.ORGANIC,
            "金属": StorageGroup.METAL,
            "氰化物": StorageGroup.CYANIDE,
            "易燃物": StorageGroup.FLAMMABLE,
            "其他": StorageGroup.OTHER,
        }
        if group in group_map:
            return True, group_map[group]

        valid_values = list(group_map.keys())
        return False, None

    def validate_cabinet_type(self, cabinet: str, row_num: int) -> tuple[bool, str]:
        cabinet = cabinet.strip()
        if cabinet in settings.VALID_CABINET_TYPES:
            return True, cabinet
        return False, f"有效储柜类型: {list(settings.VALID_CABINET_TYPES)}"

    def validate_concentration_unit(self, unit: str, row_num: int) -> tuple[bool, str]:
        unit = unit.strip()
        if unit in settings.VALID_CONCENTRATION_UNITS:
            return True, unit
        return False, f"有效浓度单位: {list(settings.VALID_CONCENTRATION_UNITS)}"

    def validate_date(self, date_str: str, row_num: int, field_name: str) -> tuple[bool, Optional[datetime]]:
        date_str = date_str.strip()
        if not date_str:
            return True, None

        formats = ["%Y-%m-%d", "%Y/%m/%d", "%Y%m%d", "%d-%m-%Y", "%d/%m/%Y"]
        for fmt in formats:
            try:
                parsed = datetime.strptime(date_str, fmt)
                return True, parsed.date()
            except ValueError:
                continue

        return False, None

    def validate_decimal(self, value_str: str, row_num: int, field_name: str) -> tuple[bool, Optional[Decimal]]:
        value_str = value_str.strip()
        if not value_str:
            return True, None

        try:
            value = Decimal(value_str)
            if value < 0:
                return False, None
            return True, value
        except InvalidOperation:
            return False, None

    async def check_duplicate_batch(self, batch_number: str) -> bool:
        existing = await BatchCRUD.get_by_number(self.db, batch_number)
        return existing is not None

    async def check_duplicate_cas(self, cas_number: str) -> bool:
        existing = await ReagentCRUD.get_by_cas(self.db, cas_number)
        return existing is not None

    async def import_from_file(
        self,
        file_content: bytes,
        encoding: str = "utf-8",
        skip_first_row: bool = True,
    ) -> ImportResult:
        self.errors = []
        self.warnings = []

        content_str = file_content.decode(encoding)
        reader = csv.DictReader(io.StringIO(content_str))

        actual_fields = set(reader.fieldnames) if reader.fieldnames else set()
        required_set = set(CSV_REQUIRED_FIELDS)
        missing = required_set - actual_fields

        if missing:
            self.errors.append(ValidationErrorItem(
                field="CSV结构",
                message=f"缺少必需字段: {', '.join(missing)}",
                code="MISSING_REQUIRED_FIELDS",
            ))
            return ImportResult(
                success=False,
                total_rows=0,
                valid_rows=0,
                invalid_rows=0,
                errors=self.errors,
                imported_ids=[],
            )

        seen_batch_numbers: set[str] = set()
        reagent_cache: dict[str, int] = {}
        imported_batch_ids: list[int] = []
        valid_row_count = 0
        invalid_row_count = 0
        row_number = 0

        for row in reader:
            row_number += 1
            row_errors: list[str] = []

            cas_number = row.get("CAS号", "").strip()
            valid, msg = self.validate_cas_number(cas_number, row_number)
            if not valid:
                row_errors.append(f"CAS号: {msg}")

            hazard_level_str = row.get("危险等级", "")
            valid, hazard_level = self.validate_hazard_level(hazard_level_str, row_number)
            if not valid:
                row_errors.append(f"危险等级: 无效值 '{hazard_level_str}'")

            storage_group_str = row.get("储存分组", "")
            valid, storage_group = self.validate_storage_group(storage_group_str, row_number)
            if not valid:
                row_errors.append(f"储存分组: 无效值 '{storage_group_str}'")

            cabinet_type = row.get("储柜分类", "")
            valid, cabinet_type = self.validate_cabinet_type(cabinet_type, row_number)
            if not valid:
                row_errors.append(f"储柜分类: {cabinet_type}")

            batch_number = row.get("批号", "").strip()
            if not batch_number:
                row_errors.append("批号: 不能为空")
            else:
                if batch_number in seen_batch_numbers:
                    row_errors.append(f"批号: '{batch_number}' 在CSV中重复")
                else:
                    seen_batch_numbers.add(batch_number)
                    if await self.check_duplicate_batch(batch_number):
                        row_errors.append(f"批号: '{batch_number}' 已存在于数据库中")

            concentration_unit = row.get("浓度单位", "")
            valid, concentration_unit = self.validate_concentration_unit(concentration_unit, row_number)
            if not valid:
                row_errors.append(f"浓度单位: {concentration_unit}")

            valid, initial_quantity = self.validate_decimal(
                row.get("初始数量", ""), row_number, "初始数量"
            )
            if not valid:
                row_errors.append("初始数量: 必须为非负数")
            elif initial_quantity is None or initial_quantity <= 0:
                row_errors.append("初始数量: 必须大于0")

            valid, expiry_date = self.validate_date(
                row.get("有效期", ""), row_number, "有效期"
            )
            if not valid:
                row_errors.append("有效期: 日期格式错误，支持 YYYY-MM-DD 等格式")
            elif expiry_date is None:
                row_errors.append("有效期: 不能为空")

            valid, concentration = self.validate_decimal(
                row.get("浓度值", ""), row_number, "浓度值"
            )
            if not valid:
                row_errors.append("浓度值: 必须为非负数")

            valid, production_date = self.validate_date(
                row.get("生产日期", ""), row_number, "生产日期"
            )
            if not valid:
                row_errors.append("生产日期: 日期格式错误")

            valid, molecular_weight = self.validate_decimal(
                row.get("分子量", ""), row_number, "分子量"
            )
            if not valid:
                row_errors.append("分子量: 必须为非负数")

            auth_level_str = row.get("最低授权等级", "1").strip()
            try:
                min_auth_level = int(auth_level_str) if auth_level_str else 1
                if min_auth_level < 1 or min_auth_level > 5:
                    row_errors.append("最低授权等级: 必须在1-5之间")
            except ValueError:
                row_errors.append("最低授权等级: 必须为整数")
                min_auth_level = 1

            if row_errors:
                invalid_row_count += 1
                for err in row_errors:
                    self.errors.append(ValidationErrorItem(
                        field=f"行{row_number}",
                        message=err,
                        code="ROW_VALIDATION_ERROR",
                    ))
                continue

            valid_row_count += 1

            if cas_number not in reagent_cache:
                existing_reagent = await ReagentCRUD.get_by_cas(self.db, cas_number)
                if existing_reagent:
                    reagent_cache[cas_number] = existing_reagent.id
                else:
                    reagent_create = ReagentCreate(
                        name=row.get("试剂名称", "").strip(),
                        cas_number=cas_number,
                        english_name=row.get("英文名称", "").strip() or None,
                        molecular_formula=row.get("分子式", "").strip() or None,
                        molecular_weight=molecular_weight,
                        hazard_level=hazard_level,
                        storage_group=storage_group,
                        cabinet_type=cabinet_type,
                        min_authorization_level=min_auth_level,
                        safety_info=row.get("安全信息", "").strip() or None,
                    )
                    new_reagent = await ReagentCRUD.create(self.db, reagent_create)
                    reagent_cache[cas_number] = new_reagent.id

            reagent_id = reagent_cache[cas_number]

            batch_create = BatchCreate(
                reagent_id=reagent_id,
                batch_number=batch_number,
                manufacturer=row.get("生产厂家", "").strip() or None,
                purity=row.get("纯度", "").strip() or None,
                concentration=concentration,
                concentration_unit=concentration_unit,
                package_unit=row.get("包装单位", "ml").strip() or "ml",
                initial_quantity=initial_quantity or Decimal("0"),
                current_quantity=initial_quantity or Decimal("0"),
                expiry_date=expiry_date,
                production_date=production_date,
                storage_location=row.get("存放位置", "").strip() or None,
                cabinet_number=row.get("储柜编号", "").strip() or None,
            )
            new_batch = await BatchCRUD.create(self.db, batch_create)
            imported_batch_ids.append(new_batch.id)

        total_rows = row_number
        success = len(self.errors) == 0 or valid_row_count > 0

        return ImportResult(
            success=success,
            total_rows=total_rows,
            valid_rows=valid_row_count,
            invalid_rows=invalid_row_count,
            errors=self.errors,
            imported_ids=imported_batch_ids,
        )
