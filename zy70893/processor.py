import pandas as pd
from typing import List, Dict, Any, Tuple
from datetime import datetime
from collections import defaultdict
from models import (
    RepairRecord,
    WorkOrder,
    MaterialBatch,
    ProcessedItem,
    ProcessResult,
    RecordStatus
)


class DataProcessor:
    def __init__(self):
        self.processed_batches: set = set()
        self.work_orders: Dict[str, WorkOrder] = {}
        self.material_batches: Dict[str, MaterialBatch] = {}
        self.repair_records: List[RepairRecord] = []

    def parse_date(self, date_str: str) -> datetime:
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d",
            "%Y%m%d"
        ]
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        raise ValueError(f"无法解析日期: {date_str}")

    def load_work_orders(self, data: List[Dict[str, Any]]) -> Tuple[int, List[str]]:
        loaded = 0
        errors = []
        for item in data:
            try:
                wo = WorkOrder(
                    work_order_id=item["work_order_id"],
                    product_model=item["product_model"],
                    quantity=int(item["quantity"]),
                    production_line=item["production_line"],
                    start_date=self.parse_date(str(item["start_date"])),
                    end_date=self.parse_date(str(item["end_date"])) if item.get("end_date") else None,
                    status=item.get("status", "active")
                )
                self.work_orders[wo.work_order_id] = wo
                loaded += 1
            except Exception as e:
                errors.append(f"工单{item.get('work_order_id', 'unknown')}: {str(e)}")
        return loaded, errors

    def load_material_batches(self, data: List[Dict[str, Any]]) -> Tuple[int, List[str]]:
        loaded = 0
        errors = []
        for item in data:
            try:
                batch = MaterialBatch(
                    batch_id=item["batch_id"],
                    material_code=item["material_code"],
                    material_name=item["material_name"],
                    supplier_id=item["supplier_id"],
                    production_date=self.parse_date(str(item["production_date"])),
                    quantity=int(item["quantity"])
                )
                self.material_batches[batch.batch_id] = batch
                loaded += 1
            except Exception as e:
                errors.append(f"批次{item.get('batch_id', 'unknown')}: {str(e)}")
        return loaded, errors

    def validate_station_id(self, station_id: str) -> Tuple[bool, str]:
        if not station_id or not station_id.strip():
            return False, "工位编号不能为空"
        if not station_id.startswith(("S", "ST", "W")) and not station_id[0].isdigit():
            return False, "工位编号格式不正确，应以S/ST/W开头或数字"
        return True, ""

    def check_batch_duplicate(self, material_batch: str, defect_type: str = None) -> Tuple[bool, str]:
        if material_batch in self.processed_batches:
            return True, f"物料批次 {material_batch} 已处理，无法重复提交"
        return False, ""

    def check_multi_defect(self, material_batch: str, current_defect: str) -> Tuple[bool, str, List[str]]:
        batch_defects = defaultdict(set)
        for record in self.repair_records:
            if record.material_batch == material_batch:
                batch_defects[material_batch].add(record.defect_type)

        existing_defects = list(batch_defects.get(material_batch, set()))
        if len(existing_defects) >= 3:
            return True, f"该批次已存在{len(existing_defects)}种缺陷，超过阈值", existing_defects
        return False, "", existing_defects

    def check_repair_closed(self, work_order_id: str) -> Tuple[bool, str]:
        for record in self.repair_records:
            if record.work_order_id == work_order_id and record.is_closed:
                return True, f"工单 {work_order_id} 已完成返修闭环"
        return False, ""

    def check_responsibility_station(self, station_id: str) -> Tuple[bool, str]:
        valid_stations = {"S01", "S02", "S03", "S04", "S05", "ST01", "ST02", "W01", "W02"}
        if station_id not in valid_stations and not station_id.startswith(("S", "ST", "W")):
            return False, f"工位 {station_id} 不在责任工位列表中，请人工确认"
        return True, ""

    def process_repair_record(self, row: Dict[str, Any]) -> ProcessedItem:
        raw_data = row.copy()
        errors = []
        suggestion_parts = []

        try:
            material_batch = str(row.get("material_batch", ""))
            station_id = str(row.get("station_id", "")).strip()
            work_order_id = str(row.get("work_order_id", "")).strip()
            defect_type = str(row.get("defect_type", "")).strip()

            is_dup, dup_msg = self.check_batch_duplicate(material_batch)
            if is_dup:
                errors.append(dup_msg)
                suggestion_parts.append("请检查是否重复提交或使用新批次号")

            station_valid, station_msg = self.validate_station_id(station_id)
            if not station_valid:
                errors.append(station_msg)
                suggestion_parts.append("请修正工位编号格式")

            station_resp, station_resp_msg = self.check_responsibility_station(station_id)
            if not station_resp:
                errors.append(station_resp_msg)
                suggestion_parts.append("请联系质量工程师确认工位归属")

            is_closed, closed_msg = self.check_repair_closed(work_order_id)
            if is_closed:
                errors.append(closed_msg)
                suggestion_parts.append("该工单已完成返修，无需重复录入")

            multi_defect, multi_msg, existing = self.check_multi_defect(material_batch, defect_type)
            if multi_defect:
                errors.append(multi_msg)
                suggestion_parts.append(f"建议排查批次质量问题，已有缺陷：{', '.join(existing)}")

            if errors:
                if "已处理，无法重复提交" in str(errors):
                    return ProcessedItem(
                        status=RecordStatus.FAILED,
                        raw_data=raw_data,
                        suggestion="; ".join(suggestion_parts),
                        error_code="BATCH_DUPLICATE"
                    )
                elif "工位" in str(errors) and len(errors) == 1:
                    return ProcessedItem(
                        status=RecordStatus.PENDING,
                        raw_data=raw_data,
                        suggestion="; ".join(suggestion_parts),
                        error_code="STATION_PENDING"
                    )
                else:
                    return ProcessedItem(
                        status=RecordStatus.FAILED,
                        raw_data=raw_data,
                        suggestion="; ".join(suggestion_parts),
                        error_code="VALIDATION_FAILED"
                    )

            repair_date = self.parse_date(str(row.get("repair_date", datetime.now().isoformat())))

            record = RepairRecord(
                repair_id=f"R{len(self.repair_records) + 1:06d}",
                work_order_id=work_order_id,
                station_id=station_id,
                material_batch=material_batch,
                defect_type=defect_type,
                repair_date=repair_date,
                operator=str(row.get("operator", "")),
                is_closed=bool(row.get("is_closed", False)),
                close_date=self.parse_date(str(row["close_date"])) if row.get("close_date") else None,
                raw_data=raw_data
            )

            self.repair_records.append(record)
            self.processed_batches.add(material_batch)

            return ProcessedItem(
                status=RecordStatus.NORMAL,
                record=record,
                raw_data=raw_data,
                suggestion=None
            )

        except Exception as e:
            return ProcessedItem(
                status=RecordStatus.FAILED,
                raw_data=raw_data,
                suggestion=f"数据解析失败: {str(e)}。请检查必填字段是否完整",
                error_code="PARSE_ERROR"
            )

    def process_repair_csv(self, csv_content: str) -> ProcessResult:
        from io import StringIO
        df = pd.read_csv(StringIO(csv_content))
        records = df.to_dict('records')

        normal_items = []
        pending_items = []
        failed_items = []

        for row in records:
            item = self.process_repair_record(row)
            if item.status == RecordStatus.NORMAL:
                normal_items.append(item)
            elif item.status == RecordStatus.PENDING:
                pending_items.append(item)
            else:
                failed_items.append(item)

        summary = {
            "batch_count": len(self.processed_batches),
            "work_order_count": len(self.work_orders),
            "station_distribution": defaultdict(int),
            "defect_distribution": defaultdict(int)
        }

        for item in normal_items:
            if item.record:
                summary["station_distribution"][item.record.station_id] += 1
                summary["defect_distribution"][item.record.defect_type] += 1

        return ProcessResult(
            total_count=len(records),
            normal_count=len(normal_items),
            pending_count=len(pending_items),
            failed_count=len(failed_items),
            normal_items=normal_items,
            pending_items=pending_items,
            failed_items=failed_items,
            summary=dict(summary)
        )
