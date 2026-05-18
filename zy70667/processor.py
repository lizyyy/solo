from typing import List, Tuple
from models import (
    HotelRecord,
    ProcessingResult,
    ShortageLevel,
    ValidationError,
    DamageRecord,
    RewashRecord,
)


class LinenProcessor:
    def __init__(self):
        self.history: List[ProcessingResult] = []
        self.errors: List[ValidationError] = []

    def validate_input(self, record: HotelRecord, outbound_quantity: int) -> List[ValidationError]:
        errors = []

        if not record.hotel_name or not record.hotel_name.strip():
            errors.append(ValidationError("hotel_name", "酒店名称不能为空"))

        if not record.linen_type or not record.linen_type.strip():
            errors.append(ValidationError("linen_type", "布草类型不能为空"))

        if record.inbound_quantity < 0:
            errors.append(ValidationError("inbound_quantity", "入库数量不能为负数"))

        if record.inbound_quantity == 0:
            errors.append(
                ValidationError("inbound_quantity", "入库数量不能为0", severity="warning")
            )

        if outbound_quantity < 0:
            errors.append(ValidationError("outbound_quantity", "出库数量不能为负数"))

        total_damage = sum(d.quantity for d in record.damage_records)
        total_rewash = sum(r.quantity for r in record.rewash_records)

        for i, damage in enumerate(record.damage_records):
            if damage.quantity < 0:
                errors.append(
                    ValidationError(f"damage_records[{i}].quantity", "破损数量不能为负数")
                )
            if not damage.linen_type or not damage.linen_type.strip():
                errors.append(
                    ValidationError(f"damage_records[{i}].linen_type", "破损记录布草类型不能为空")
                )

        for i, rewash in enumerate(record.rewash_records):
            if rewash.quantity < 0:
                errors.append(
                    ValidationError(f"rewash_records[{i}].quantity", "返洗数量不能为负数")
                )
            if not rewash.linen_type or not rewash.linen_type.strip():
                errors.append(
                    ValidationError(f"rewash_records[{i}].linen_type", "返洗记录布草类型不能为空")
                )

        if total_damage > record.inbound_quantity:
            errors.append(
                ValidationError(
                    "damage_records",
                    f"破损总数({total_damage})不能超过入库数量({record.inbound_quantity})",
                )
            )

        if total_rewash > record.inbound_quantity - total_damage:
            errors.append(
                ValidationError(
                    "rewash_records",
                    f"返洗总数({total_rewash})不能超过入库扣减破损后的数量({record.inbound_quantity - total_damage})",
                )
            )

        return errors

    def calculate_shortage_level(self, shortage: int, inbound: int) -> Tuple[float, ShortageLevel]:
        if inbound == 0:
            return 0.0, ShortageLevel.NONE

        shortage_rate = (shortage / inbound) * 100

        if shortage <= 0:
            return 0.0, ShortageLevel.NONE
        elif shortage_rate <= 5:
            return round(shortage_rate, 2), ShortageLevel.MINOR
        elif shortage_rate <= 15:
            return round(shortage_rate, 2), ShortageLevel.MEDIUM
        else:
            return round(shortage_rate, 2), ShortageLevel.SEVERE

    def process(self, record: HotelRecord, outbound_quantity: int) -> Tuple[ProcessingResult, List[ValidationError]]:
        self.errors = self.validate_input(record, outbound_quantity)

        has_errors = any(e.severity == "error" for e in self.errors)
        if has_errors:
            raise ValueError(f"输入验证失败: {[e.message for e in self.errors if e.severity == 'error']}")

        total_damage = sum(d.quantity for d in record.damage_records)
        total_rewash = sum(r.quantity for r in record.rewash_records)

        expected_outbound = record.inbound_quantity - total_damage - total_rewash
        shortage = max(0, expected_outbound - outbound_quantity)

        shortage_rate, shortage_level = self.calculate_shortage_level(shortage, record.inbound_quantity)

        result = ProcessingResult(
            hotel_name=record.hotel_name.strip(),
            linen_type=record.linen_type.strip(),
            inbound_quantity=record.inbound_quantity,
            total_damage=total_damage,
            total_rewash=total_rewash,
            outbound_quantity=outbound_quantity,
            shortage=shortage,
            shortage_rate=shortage_rate,
            shortage_level=shortage_level,
        )

        self.history.append(result)
        return result, self.errors

    def batch_process(self, records_with_outbound: List[tuple]) -> Tuple[List[ProcessingResult], List[ValidationError]]:
        results = []
        all_errors = []

        for record, outbound_quantity in records_with_outbound:
            try:
                result, errors = self.process(record, outbound_quantity)
                results.append(result)
                all_errors.extend(errors)
            except ValueError as e:
                all_errors.append(ValidationError("batch_process", f"处理记录失败: {str(e)}"))

        return results, all_errors

    def get_history(self) -> List[ProcessingResult]:
        return self.history

    def clear_history(self):
        self.history = []
