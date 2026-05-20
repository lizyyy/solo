import pandas as pd
import math
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
from .models import (
    BedInfo, PatientFlow, CleaningOrder,
    BedStatus, PatientFlowType, CleaningOrderStatus,
    ResultItem, ImportResponse
)
from .rules import BedManagementRules


def clean_nan_values(data: Dict[str, Any]) -> Dict[str, Any]:
    cleaned = {}
    for k, v in data.items():
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            cleaned[k] = None
        else:
            cleaned[k] = v
    return cleaned


def safe_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    s = str(value).strip()
    if s == "" or s.lower() == "nan":
        return None
    return s


class DataProcessor:
    def __init__(self, rules_engine: BedManagementRules):
        self.rules = rules_engine

    def parse_datetime(self, dt_str: str) -> datetime:
        try:
            return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            return datetime.now()

    def parse_bed_csv(self, csv_content: str, batch_id: str) -> List[Tuple[str, Optional[ResultItem], Optional[BedInfo]]]:
        results = []
        from io import StringIO
        df = pd.read_csv(StringIO(csv_content), dtype=str)
        
        for _, row in df.iterrows():
            row_dict = row.to_dict()
            original_data = {k: safe_str(v) for k, v in row_dict.items()}
            try:
                is_locked_val = safe_str(row.get('is_locked', ''))
                is_locked = is_locked_val is not None and is_locked_val.lower() in ('true', '1', 'yes')
                
                bed_info = BedInfo(
                    batch_id=batch_id,
                    ward_code=safe_str(row.get('ward_code', '')) or "",
                    bed_number=safe_str(row.get('bed_number', '')) or "",
                    status=BedStatus(safe_str(row.get('status', 'vacant')).lower()),
                    patient_id=safe_str(row.get('patient_id', '')),
                    patient_name=safe_str(row.get('patient_name', '')),
                    last_updated=self.parse_datetime(str(row.get('last_updated', ''))),
                    is_locked=is_locked,
                    lock_reason=safe_str(row.get('lock_reason', ''))
                )
                original_bed_number = safe_str(row.get('bed_number', '')) or ''
                record_id = f"{bed_info.ward_code}-{original_bed_number}"
                
                status, result = self.rules.validate_bed_info(bed_info, original_data)
                if status == "success":
                    self.rules.update_bed_cache(bed_info)
                    results.append((status, ResultItem(
                        record_type="bed",
                        record_id=record_id,
                        original_data=original_data
                    ), bed_info))
                else:
                    if result:
                        result.record_id = record_id
                    results.append((status, result, bed_info))
            except Exception as e:
                error_bed_number = safe_str(row.get('bed_number', '')) or 'unknown'
                results.append(("failed", ResultItem(
                    record_type="bed",
                    record_id=f"{safe_str(row.get('ward_code', '')) or ''}-{error_bed_number}",
                    original_data=original_data,
                    suggestion=f"数据解析失败: {str(e)}"
                ), None))
        
        return results

    def parse_patient_flow_json(self, json_data: List[Dict[str, Any]], batch_id: str) -> List[Tuple[str, Optional[ResultItem], Optional[PatientFlow]]]:
        results = []
        
        for item in json_data:
            original_data = item.copy()
            try:
                patient_flow = PatientFlow(
                    batch_id=batch_id,
                    flow_id=str(item.get('flow_id', '')).strip(),
                    flow_type=PatientFlowType(str(item.get('flow_type', '')).strip().lower()),
                    patient_id=str(item.get('patient_id', '')).strip(),
                    patient_name=str(item.get('patient_name', '')).strip(),
                    from_ward=str(item.get('from_ward', '')).strip() or None,
                    from_bed=str(item.get('from_bed', '')).strip() or None,
                    to_ward=str(item.get('to_ward', '')).strip() or None,
                    to_bed=str(item.get('to_bed', '')).strip() or None,
                    event_time=self.parse_datetime(str(item.get('event_time', '')))
                )
                status, result = self.rules.validate_patient_flow(patient_flow, original_data)
                if status == "success":
                    results.append((status, ResultItem(
                        record_type="patient_flow",
                        record_id=patient_flow.flow_id,
                        original_data=original_data
                    ), patient_flow))
                else:
                    results.append((status, result, patient_flow))
            except Exception as e:
                results.append(("failed", ResultItem(
                    record_type="patient_flow",
                    record_id=str(item.get('flow_id', 'unknown')),
                    original_data=original_data,
                    suggestion=f"数据解析失败: {str(e)}"
                ), None))
        
        return results

    def parse_cleaning_orders_json(self, json_data: List[Dict[str, Any]], batch_id: str) -> List[Tuple[str, Optional[ResultItem], Optional[CleaningOrder]]]:
        results = []
        
        for item in json_data:
            original_data = item.copy()
            try:
                cleaning_order = CleaningOrder(
                    batch_id=batch_id,
                    order_id=str(item.get('order_id', '')).strip(),
                    ward_code=str(item.get('ward_code', '')).strip(),
                    bed_number=str(item.get('bed_number', '')).strip(),
                    create_time=self.parse_datetime(str(item.get('create_time', ''))),
                    start_time=self.parse_datetime(str(item.get('start_time', ''))) if item.get('start_time') else None,
                    complete_time=self.parse_datetime(str(item.get('complete_time', ''))) if item.get('complete_time') else None,
                    status=CleaningOrderStatus(str(item.get('status', '')).strip().lower()),
                    cleaning_staff=str(item.get('cleaning_staff', '')).strip() or None
                )
                status, result = self.rules.validate_cleaning_order(cleaning_order, original_data)
                if status == "success":
                    results.append((status, ResultItem(
                        record_type="cleaning",
                        record_id=cleaning_order.order_id,
                        original_data=original_data
                    ), cleaning_order))
                else:
                    results.append((status, result, cleaning_order))
            except Exception as e:
                results.append(("failed", ResultItem(
                    record_type="cleaning",
                    record_id=str(item.get('order_id', 'unknown')),
                    original_data=original_data,
                    suggestion=f"数据解析失败: {str(e)}"
                ), None))
        
        return results

    def process_import(self, 
                      batch_id: str,
                      bed_csv: Optional[str] = None,
                      patient_flows: Optional[List[Dict[str, Any]]] = None,
                      cleaning_orders: Optional[List[Dict[str, Any]]] = None) -> ImportResponse:
        
        if self.rules.is_batch_processed(batch_id):
            return ImportResponse(
                batch_id=batch_id,
                total_count=0,
                success_count=0,
                pending_count=0,
                failed_count=0,
                success_items=[],
                pending_items=[
                    ResultItem(
                        record_type="system",
                        record_id=batch_id,
                        original_data={"batch_id": batch_id},
                        suggestion="该批次已处理过，为避免重复生效，本次跳过处理"
                    )
                ],
                failed_items=[]
            )

        success_items: list[ResultItem] = []
        pending_items: list[ResultItem] = []
        failed_items: list[ResultItem] = []

        if bed_csv:
            bed_results = self.parse_bed_csv(bed_csv, batch_id)
            for status, result, _ in bed_results:
                if status == "success" and result:
                    success_items.append(result)
                elif status == "pending" and result:
                    pending_items.append(result)
                elif status == "failed" and result:
                    failed_items.append(result)

        if patient_flows:
            flow_results = self.parse_patient_flow_json(patient_flows, batch_id)
            for status, result, _ in flow_results:
                if status == "success" and result:
                    success_items.append(result)
                elif status == "pending" and result:
                    pending_items.append(result)
                elif status == "failed" and result:
                    failed_items.append(result)

        if cleaning_orders:
            cleaning_results = self.parse_cleaning_orders_json(cleaning_orders, batch_id)
            for status, result, _ in cleaning_results:
                if status == "success" and result:
                    success_items.append(result)
                elif status == "pending" and result:
                    pending_items.append(result)
                elif status == "failed" and result:
                    failed_items.append(result)

        total_count = len(success_items) + len(pending_items) + len(failed_items)
        self.rules.mark_batch_processed(batch_id)

        return ImportResponse(
            batch_id=batch_id,
            total_count=total_count,
            success_count=len(success_items),
            pending_count=len(pending_items),
            failed_count=len(failed_items),
            success_items=success_items,
            pending_items=pending_items,
            failed_items=failed_items
        )
