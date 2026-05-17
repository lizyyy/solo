import csv
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from ..models import (
    ParsedData,
    Equipment,
    RentalOrder,
    ReturnInspection,
    DepositDeduction,
    AccessoryItem,
    SourceLocation,
    BadRecord,
    DamageLevel,
    ApprovalStatus,
)


def parse_date(date_str: str) -> Optional[datetime]:
    if not date_str or date_str.strip() == "":
        return None
    for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d-%m-%Y"]:
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            continue
    return None


def parse_float(value: str) -> float:
    if not value or value.strip() == "":
        return 0.0
    try:
        cleaned = value.strip().replace(",", "").replace("¥", "").replace("￥", "")
        return float(cleaned)
    except ValueError:
        return 0.0


def parse_int(value: str) -> int:
    if not value or value.strip() == "":
        return 0
    try:
        return int(value.strip())
    except ValueError:
        return 0


class CSVParser:
    def __init__(self):
        self.data = ParsedData()

    def parse_equipment_file(self, file_path: str) -> None:
        path = Path(file_path)
        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    source = SourceLocation(
                        file_path=str(path.absolute()),
                        row_number=row_num,
                        raw_content=str(row),
                    )

                    equipment_id = row.get("器材ID", "").strip()
                    if not equipment_id:
                        raise ValueError("器材ID不能为空")

                    purchase_date = parse_date(row.get("购买日期", ""))
                    if not purchase_date:
                        raise ValueError(f"无效的购买日期: {row.get('购买日期')}")

                    equipment = Equipment(
                        equipment_id=equipment_id,
                        name=row.get("器材名称", "").strip(),
                        category=row.get("分类", "").strip(),
                        model=row.get("型号", "").strip(),
                        serial_number=row.get("序列号", "").strip(),
                        purchase_date=purchase_date,
                        daily_rate=parse_float(row.get("日租金", "0")),
                        deposit_amount=parse_float(row.get("押金金额", "0")),
                        source=source,
                    )
                    self.data.equipments[equipment_id] = equipment
                except Exception as e:
                    bad_record = BadRecord(
                        source=SourceLocation(
                            file_path=str(path.absolute()),
                            row_number=row_num,
                            raw_content=str(row),
                        ),
                        error_message=str(e),
                        record_type="器材",
                    )
                    self.data.bad_records.append(bad_record)

    def parse_rental_order_file(self, file_path: str) -> None:
        path = Path(file_path)
        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    source = SourceLocation(
                        file_path=str(path.absolute()),
                        row_number=row_num,
                        raw_content=str(row),
                    )

                    order_id = row.get("借用单ID", "").strip()
                    if not order_id:
                        raise ValueError("借用单ID不能为空")

                    borrow_date = parse_date(row.get("借用日期", ""))
                    if not borrow_date:
                        raise ValueError(f"无效的借用日期: {row.get('借用日期')}")

                    expected_return_date = parse_date(row.get("预计归还日期", ""))
                    if not expected_return_date:
                        raise ValueError(f"无效的预计归还日期: {row.get('预计归还日期')}")

                    actual_return_date = parse_date(row.get("实际归还日期", ""))

                    accessories = []
                    accessory_str = row.get("配件清单", "")
                    if accessory_str:
                        for item in accessory_str.split(";"):
                            if ":" in item:
                                parts = item.split(":")
                                if len(parts) >= 3:
                                    accessories.append(
                                        AccessoryItem(
                                            accessory_id=parts[0].strip(),
                                            name=parts[1].strip(),
                                            quantity=parse_int(parts[2]),
                                            unit_price=parse_float(parts[3]) if len(parts) > 3 else 0.0,
                                        )
                                    )

                    rental_order = RentalOrder(
                        order_id=order_id,
                        equipment_id=row.get("器材ID", "").strip(),
                        borrower_name=row.get("借用人", "").strip(),
                        borrower_department=row.get("部门", "").strip(),
                        borrow_date=borrow_date,
                        expected_return_date=expected_return_date,
                        actual_return_date=actual_return_date,
                        accessories=accessories,
                        deposit_paid=parse_float(row.get("已付押金", "0")),
                        source=source,
                    )
                    self.data.rental_orders[order_id] = rental_order
                except Exception as e:
                    bad_record = BadRecord(
                        source=SourceLocation(
                            file_path=str(path.absolute()),
                            row_number=row_num,
                            raw_content=str(row),
                        ),
                        error_message=str(e),
                        record_type="借用单",
                    )
                    self.data.bad_records.append(bad_record)

    def parse_return_inspection_file(self, file_path: str) -> None:
        path = Path(file_path)
        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    source = SourceLocation(
                        file_path=str(path.absolute()),
                        row_number=row_num,
                        raw_content=str(row),
                    )

                    inspection_id = row.get("检查单ID", "").strip()
                    if not inspection_id:
                        raise ValueError("检查单ID不能为空")

                    inspection_date = parse_date(row.get("检查日期", ""))
                    if not inspection_date:
                        raise ValueError(f"无效的检查日期: {row.get('检查日期')}")

                    condition_map = {
                        "无损坏": DamageLevel.NONE,
                        "轻微划痕": DamageLevel.MINOR,
                        "中度损坏": DamageLevel.MODERATE,
                        "严重损坏": DamageLevel.SEVERE,
                    }
                    condition_str = row.get("器材状态", "").strip()
                    equipment_condition = condition_map.get(condition_str, DamageLevel.NONE)

                    returned_accessories = []
                    accessory_str = row.get("归还配件", "")
                    if accessory_str:
                        for item in accessory_str.split(";"):
                            if ":" in item:
                                parts = item.split(":")
                                if len(parts) >= 3:
                                    returned_accessories.append(
                                        AccessoryItem(
                                            accessory_id=parts[0].strip(),
                                            name=parts[1].strip(),
                                            quantity=parse_int(parts[2]),
                                            unit_price=parse_float(parts[3]) if len(parts) > 3 else 0.0,
                                        )
                                    )

                    inspection = ReturnInspection(
                        inspection_id=inspection_id,
                        order_id=row.get("借用单ID", "").strip(),
                        inspector_name=row.get("检查人", "").strip(),
                        inspection_date=inspection_date,
                        equipment_condition=equipment_condition,
                        equipment_notes=row.get("备注", "").strip(),
                        returned_accessories=returned_accessories,
                        source=source,
                    )
                    self.data.return_inspections[inspection_id] = inspection
                except Exception as e:
                    bad_record = BadRecord(
                        source=SourceLocation(
                            file_path=str(path.absolute()),
                            row_number=row_num,
                            raw_content=str(row),
                        ),
                        error_message=str(e),
                        record_type="归还检查",
                    )
                    self.data.bad_records.append(bad_record)

    def parse_deposit_deduction_file(self, file_path: str) -> None:
        path = Path(file_path)
        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    source = SourceLocation(
                        file_path=str(path.absolute()),
                        row_number=row_num,
                        raw_content=str(row),
                    )

                    deduction_id = row.get("扣款单ID", "").strip()
                    if not deduction_id:
                        raise ValueError("扣款单ID不能为空")

                    approval_date = parse_date(row.get("审批日期", ""))

                    status_map = {
                        "待审批": ApprovalStatus.PENDING,
                        "已批准": ApprovalStatus.APPROVED,
                        "已拒绝": ApprovalStatus.REJECTED,
                    }
                    status_str = row.get("审批状态", "").strip()
                    approval_status = status_map.get(status_str, ApprovalStatus.PENDING)

                    deduction = DepositDeduction(
                        deduction_id=deduction_id,
                        order_id=row.get("借用单ID", "").strip(),
                        deduction_type=row.get("扣款类型", "").strip(),
                        amount=parse_float(row.get("扣款金额", "0")),
                        reason=row.get("扣款原因", "").strip(),
                        applicant=row.get("申请人", "").strip(),
                        approval_status=approval_status,
                        approver=row.get("审批人", "").strip() or None,
                        approval_date=approval_date,
                        source=source,
                    )
                    self.data.deposit_deductions[deduction_id] = deduction
                except Exception as e:
                    bad_record = BadRecord(
                        source=SourceLocation(
                            file_path=str(path.absolute()),
                            row_number=row_num,
                            raw_content=str(row),
                        ),
                        error_message=str(e),
                        record_type="押金扣款",
                    )
                    self.data.bad_records.append(bad_record)

    def get_parsed_data(self) -> ParsedData:
        sorted_equipments = dict(sorted(self.data.equipments.items()))
        sorted_orders = dict(sorted(self.data.rental_orders.items()))
        sorted_inspections = dict(sorted(self.data.return_inspections.items()))
        sorted_deductions = dict(sorted(self.data.deposit_deductions.items()))

        return ParsedData(
            equipments=sorted_equipments,
            rental_orders=sorted_orders,
            return_inspections=sorted_inspections,
            deposit_deductions=sorted_deductions,
            bad_records=self.data.bad_records,
        )
