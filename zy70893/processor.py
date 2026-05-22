import pandas as pd
import math
from typing import List, Dict, Any, Tuple, Set
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
        self.work_orders: Dict[str, WorkOrder] = {}
        self.material_batches: Dict[str, MaterialBatch] = {}
        self.repair_records: List[RepairRecord] = []
        self.processed_batches: Set[str] = set()

    def _is_empty_value(self, value: Any) -> bool:
        if value is None:
            return True
        if isinstance(value, float) and math.isnan(value):
            return True
        if isinstance(value, str) and value.strip() == "":
            return True
        return False

    def _clean_nan_values(self, data: Dict[str, Any]) -> Dict[str, Any]:
        cleaned = {}
        for k, v in data.items():
            if isinstance(v, float) and math.isnan(v):
                cleaned[k] = None
            elif isinstance(v, dict):
                cleaned[k] = self._clean_nan_values(v)
            else:
                cleaned[k] = v
        return cleaned

    def parse_date(self, date_str: str) -> datetime:
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d",
            "%Y%m%d"
        ]
        date_str = str(date_str).strip()
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
                end_date_val = item.get("end_date")
                end_date = None
                if not self._is_empty_value(end_date_val):
                    end_date = self.parse_date(str(end_date_val))

                wo = WorkOrder(
                    work_order_id=item["work_order_id"],
                    product_model=item["product_model"],
                    quantity=int(item["quantity"]),
                    production_line=item["production_line"],
                    start_date=self.parse_date(str(item["start_date"])),
                    end_date=end_date,
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
            return False, "工位编号格式不正确"
        return True, ""

    def check_batch_duplicate(self, material_batch: str) -> Tuple[bool, str]:
        if material_batch in self.processed_batches:
            return True, f"物料批次 {material_batch} 已处理，无法重复提交"
        return False, ""

    def check_multi_defect(self, material_batch: str, current_defect: str, current_batch_defects: Set[str]) -> Tuple[bool, str, List[str]]:
        existing_defects = list(current_batch_defects - {current_defect})
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
        if station_id not in valid_stations:
            if station_id.startswith(("S", "ST", "W")):
                return False, f"工位{station_id}不在标准列表中，需确认"
            return False, f"工位{station_id}格式异常，请人工确认"
        return True, ""

    def process_repair_record(self, row: Dict[str, Any], current_batch_defects: Dict[str, Set[str]]) -> ProcessedItem:
        raw_data = self._clean_nan_values(row.copy())
        station_errors = []
        fatal_errors = []
        warning_msgs = []
        suggestion_parts = []

        try:
            material_batch = str(row.get("material_batch", "")).strip()
            station_id = str(row.get("station_id", "")).strip()
            work_order_id = str(row.get("work_order_id", "")).strip()
            defect_type = str(row.get("defect_type", "")).strip()

            is_dup, dup_msg = self.check_batch_duplicate(material_batch)
            if is_dup:
                fatal_errors.append(dup_msg)
                suggestion_parts.append("该批次已处理过，请检查是否重复提交")

            station_valid, station_msg = self.validate_station_id(station_id)
            if not station_valid:
                station_errors.append(station_msg)

            station_resp, station_resp_msg = self.check_responsibility_station(station_id)
            if not station_resp:
                station_errors.append(station_resp_msg)

            is_closed, closed_msg = self.check_repair_closed(work_order_id)
            if is_closed:
                fatal_errors.append(closed_msg)
                suggestion_parts.append("该工单已完成返修闭环")

            if material_batch not in current_batch_defects:
                current_batch_defects[material_batch] = set()
            current_batch_defects[material_batch].add(defect_type)
            multi_defect, multi_msg, existing = self.check_multi_defect(
                material_batch, defect_type, current_batch_defects[material_batch]
            )
            if multi_defect:
                warning_msgs.append(multi_msg)
                suggestion_parts.append(f"建议排查批次质量问题，已有缺陷：{', '.join(existing)}")

            if fatal_errors:
                return ProcessedItem(
                    status=RecordStatus.FAILED,
                    raw_data=raw_data,
                    suggestion="; ".join(suggestion_parts) if suggestion_parts else "; ".join(fatal_errors),
                    error_code="BATCH_DUPLICATE"
                )

            if station_errors:
                suggestion_parts = [f"工位问题：{'; '.join(station_errors)}"]
                suggestion_parts.append("请联系质量工程师确认工位归属后重新提交")
                return ProcessedItem(
                    status=RecordStatus.PENDING,
                    raw_data=raw_data,
                    suggestion="; ".join(suggestion_parts),
                    error_code="STATION_PENDING"
                )

            repair_date_val = row.get("repair_date", datetime.now().isoformat())
            repair_date = self.parse_date(str(repair_date_val))

            close_date_val = row.get("close_date")
            close_date = None
            if not self._is_empty_value(close_date_val):
                close_date = self.parse_date(str(close_date_val))

            is_closed_val = row.get("is_closed", False)
            if isinstance(is_closed_val, str):
                is_closed_val = is_closed_val.lower() in ("true", "1", "yes")

            record = RepairRecord(
                repair_id=f"R{len(self.repair_records) + 1:06d}",
                work_order_id=work_order_id,
                station_id=station_id,
                material_batch=material_batch,
                defect_type=defect_type,
                repair_date=repair_date,
                operator=str(row.get("operator", "")),
                is_closed=bool(is_closed_val),
                close_date=close_date,
                raw_data=raw_data
            )

            self.repair_records.append(record)
            self.processed_batches.add(material_batch)

            if warning_msgs:
                return ProcessedItem(
                    status=RecordStatus.NORMAL,
                    record=record,
                    raw_data=raw_data,
                    suggestion="; ".join(warning_msgs)
                )

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
        current_batch_defects: Dict[str, Set[str]] = {}

        for row in records:
            item = self.process_repair_record(row, current_batch_defects)
            if item.status == RecordStatus.NORMAL:
                normal_items.append(item)
            elif item.status == RecordStatus.PENDING:
                pending_items.append(item)
            else:
                failed_items.append(item)

        summary = {
            "batch_count": len(self.processed_batches),
            "work_order_count": len(self.work_orders),
            "station_distribution": {},
            "defect_distribution": {}
        }

        for item in normal_items:
            if item.record:
                sid = item.record.station_id
                summary["station_distribution"][sid] = summary["station_distribution"].get(sid, 0) + 1
                did = item.record.defect_type
                summary["defect_distribution"][did] = summary["defect_distribution"].get(did, 0) + 1

        return ProcessResult(
            total_count=len(records),
            normal_count=len(normal_items),
            pending_count=len(pending_items),
            failed_count=len(failed_items),
            normal_items=normal_items,
            pending_items=pending_items,
            failed_items=failed_items,
            summary=summary
        )
