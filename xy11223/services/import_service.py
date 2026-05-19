import pandas as pd
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal
from models import (
    FoodSample, TemperatureRecord, WasteRecord,
    BatchOperation, Store, RecordStatus
)
from utils import (
    generate_sample_id, generate_temperature_id, generate_waste_id,
    generate_batch_id, parse_datetime, validate_required_fields,
    validate_datetime as validate_dt, validate_temperature, validate_weight
)


class ImportService:
    def __init__(self, db: Optional[Session] = None):
        self.db = db or SessionLocal()

    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()

    def _validate_and_parse_sample_row(self, row_data: Dict[str, Any], row_num: int) -> Tuple[bool, Dict[str, Any], List[str]]:
        errors = []
        parsed = {}

        required_fields = ["store_id", "dish_name", "sample_time", "expire_time"]
        valid, missing = validate_required_fields(row_data, required_fields)
        if not valid:
            errors.append(f"缺少必填字段: {', '.join(missing)}")
            return False, parsed, errors

        parsed["store_id"] = str(row_data["store_id"]).strip()
        parsed["dish_name"] = str(row_data["dish_name"]).strip()

        sample_time = parse_datetime(row_data.get("sample_time"))
        if not sample_time:
            errors.append("留样时间格式无效")
        else:
            parsed["sample_time"] = sample_time

        expire_time = parse_datetime(row_data.get("expire_time"))
        if not expire_time:
            errors.append("预计过期时间格式无效")
        else:
            parsed["expire_time"] = expire_time

        if sample_time and expire_time and expire_time <= sample_time:
            errors.append("过期时间必须晚于留样时间")

        parsed["batch_id"] = str(row_data.get("batch_id", "")).strip() or None
        parsed["sample_type"] = str(row_data.get("sample_type", "cooked")).strip()
        parsed["storage_location"] = str(row_data.get("storage_location", "")).strip() or None
        parsed["keeper_id"] = str(row_data.get("keeper_id", "")).strip() or None
        parsed["keeper_name"] = str(row_data.get("keeper_name", "")).strip() or None

        weight_valid, weight_err = validate_weight(row_data.get("sample_weight"))
        if not weight_valid:
            errors.append(weight_err)
        else:
            parsed["sample_weight"] = float(row_data["sample_weight"]) if row_data.get("sample_weight") else None

        disposal_time = parse_datetime(row_data.get("disposal_time"))
        parsed["disposal_time"] = disposal_time
        parsed["disposal_person"] = str(row_data.get("disposal_person", "")).strip() or None

        return len(errors) == 0, parsed, errors

    def import_samples(self, file_path: str, operator_id: str = "", operator_name: str = "",
                       retry_batch_id: Optional[str] = None) -> Dict[str, Any]:
        batch_op = BatchOperation(
            id=generate_batch_id(),
            operation_type="import_samples",
            file_name=file_path.split("/")[-1],
            operator_id=operator_id,
            operator_name=operator_name
        )
        self.db.add(batch_op)
        self.db.commit()

        success_ids = []
        existing_ids = []

        if retry_batch_id:
            prev_batch = self.db.query(BatchOperation).filter_by(id=retry_batch_id).first()
            if prev_batch and prev_batch.success_ids:
                existing_ids = prev_batch.success_ids

        try:
            df = pd.read_excel(file_path) if file_path.endswith(('.xlsx', '.xls')) else pd.read_csv(file_path)
            batch_op.total_count = len(df)

            for idx, row in df.iterrows():
                row_num = idx + 2
                row_data = row.to_dict()

                valid, parsed, errors = self._validate_and_parse_sample_row(row_data, row_num)
                if not valid:
                    batch_op.add_failed(row_num, "; ".join(errors))
                    continue

                try:
                    sample = FoodSample(
                        id=generate_sample_id(),
                        batch_operation_id=batch_op.id,
                        source_file=batch_op.file_name,
                        source_row=row_num,
                        status=RecordStatus.PENDING,
                        **parsed
                    )
                    self.db.add(sample)
                    self.db.flush()
                    batch_op.add_success(sample.id)
                    success_ids.append(sample.id)
                except Exception as e:
                    self.db.rollback()
                    batch_op.add_failed(row_num, str(e))

            self.db.commit()

            if batch_op.failed_count == 0:
                batch_op.mark_success()
            elif batch_op.success_count > 0:
                batch_op.mark_partial()
            else:
                batch_op.mark_failed()

            self.db.commit()

        except Exception as e:
            self.db.rollback()
            batch_op.mark_failed({"error": str(e)})
            self.db.commit()

        return batch_op.to_dict()

    def _validate_and_parse_temperature_row(self, row_data: Dict[str, Any], row_num: int) -> Tuple[bool, Dict[str, Any], List[str]]:
        errors = []
        parsed = {}

        required_fields = ["store_id", "record_time", "temperature"]
        valid, missing = validate_required_fields(row_data, required_fields)
        if not valid:
            errors.append(f"缺少必填字段: {', '.join(missing)}")
            return False, parsed, errors

        parsed["store_id"] = str(row_data["store_id"]).strip()

        record_time = parse_datetime(row_data.get("record_time"))
        if not record_time:
            errors.append("记录时间格式无效")
        else:
            parsed["record_time"] = record_time

        temp_valid, temp_err = validate_temperature(row_data.get("temperature"))
        if not temp_valid:
            errors.append(temp_err)
        else:
            parsed["temperature"] = float(row_data["temperature"])

        parsed["min_temperature"] = float(row_data.get("min_temperature", 0.0)) if row_data.get("min_temperature") else 0.0
        parsed["max_temperature"] = float(row_data.get("max_temperature", 8.0)) if row_data.get("max_temperature") else 8.0

        parsed["fridge_id"] = str(row_data.get("fridge_id", "")).strip() or None
        parsed["fridge_name"] = str(row_data.get("fridge_name", "")).strip() or None
        parsed["recorder_id"] = str(row_data.get("recorder_id", "")).strip() or None
        parsed["recorder_name"] = str(row_data.get("recorder_name", "")).strip() or None
        parsed["remarks"] = str(row_data.get("remarks", "")).strip() or None

        return len(errors) == 0, parsed, errors

    def import_temperature_records(self, file_path: str, operator_id: str = "", operator_name: str = "") -> Dict[str, Any]:
        batch_op = BatchOperation(
            id=generate_batch_id(),
            operation_type="import_temperature",
            file_name=file_path.split("/")[-1],
            operator_id=operator_id,
            operator_name=operator_name
        )
        self.db.add(batch_op)
        self.db.commit()

        try:
            df = pd.read_excel(file_path) if file_path.endswith(('.xlsx', '.xls')) else pd.read_csv(file_path)
            batch_op.total_count = len(df)

            for idx, row in df.iterrows():
                row_num = idx + 2
                row_data = row.to_dict()

                valid, parsed, errors = self._validate_and_parse_temperature_row(row_data, row_num)
                if not valid:
                    batch_op.add_failed(row_num, "; ".join(errors))
                    continue

                try:
                    record = TemperatureRecord(
                        id=generate_temperature_id(),
                        batch_operation_id=batch_op.id,
                        source_file=batch_op.file_name,
                        source_row=row_num,
                        status=RecordStatus.PENDING,
                        **parsed
                    )
                    self.db.add(record)
                    self.db.flush()
                    batch_op.add_success(record.id)
                except Exception as e:
                    self.db.rollback()
                    batch_op.add_failed(row_num, str(e))

            self.db.commit()

            if batch_op.failed_count == 0:
                batch_op.mark_success()
            elif batch_op.success_count > 0:
                batch_op.mark_partial()
            else:
                batch_op.mark_failed()

            self.db.commit()

        except Exception as e:
            self.db.rollback()
            batch_op.mark_failed({"error": str(e)})
            self.db.commit()

        return batch_op.to_dict()

    def _validate_and_parse_waste_row(self, row_data: Dict[str, Any], row_num: int) -> Tuple[bool, Dict[str, Any], List[str]]:
        errors = []
        parsed = {}

        required_fields = ["store_id", "dish_name", "waste_time"]
        valid, missing = validate_required_fields(row_data, required_fields)
        if not valid:
            errors.append(f"缺少必填字段: {', '.join(missing)}")
            return False, parsed, errors

        parsed["store_id"] = str(row_data["store_id"]).strip()
        parsed["dish_name"] = str(row_data["dish_name"]).strip()

        waste_time = parse_datetime(row_data.get("waste_time"))
        if not waste_time:
            errors.append("废弃时间格式无效")
        else:
            parsed["waste_time"] = waste_time

        expected_waste_time = parse_datetime(row_data.get("expected_waste_time"))
        parsed["expected_waste_time"] = expected_waste_time

        production_time = parse_datetime(row_data.get("production_time"))
        parsed["production_time"] = production_time

        weight_valid, weight_err = validate_weight(row_data.get("waste_weight"))
        if not weight_valid:
            errors.append(weight_err)
        else:
            parsed["waste_weight"] = float(row_data["waste_weight"]) if row_data.get("waste_weight") else None

        parsed["batch_id"] = str(row_data.get("batch_id", "")).strip() or None
        parsed["waste_reason"] = str(row_data.get("waste_reason", "")).strip() or None
        parsed["handler_id"] = str(row_data.get("handler_id", "")).strip() or None
        parsed["handler_name"] = str(row_data.get("handler_name", "")).strip() or None
        parsed["remarks"] = str(row_data.get("remarks", "")).strip() or None

        return len(errors) == 0, parsed, errors

    def import_waste_records(self, file_path: str, operator_id: str = "", operator_name: str = "") -> Dict[str, Any]:
        batch_op = BatchOperation(
            id=generate_batch_id(),
            operation_type="import_waste",
            file_name=file_path.split("/")[-1],
            operator_id=operator_id,
            operator_name=operator_name
        )
        self.db.add(batch_op)
        self.db.commit()

        try:
            df = pd.read_excel(file_path) if file_path.endswith(('.xlsx', '.xls')) else pd.read_csv(file_path)
            batch_op.total_count = len(df)

            for idx, row in df.iterrows():
                row_num = idx + 2
                row_data = row.to_dict()

                valid, parsed, errors = self._validate_and_parse_waste_row(row_data, row_num)
                if not valid:
                    batch_op.add_failed(row_num, "; ".join(errors))
                    continue

                try:
                    record = WasteRecord(
                        id=generate_waste_id(),
                        batch_operation_id=batch_op.id,
                        source_file=batch_op.file_name,
                        source_row=row_num,
                        status=RecordStatus.PENDING,
                        **parsed
                    )
                    self.db.add(record)
                    self.db.flush()
                    batch_op.add_success(record.id)
                except Exception as e:
                    self.db.rollback()
                    batch_op.add_failed(row_num, str(e))

            self.db.commit()

            if batch_op.failed_count == 0:
                batch_op.mark_success()
            elif batch_op.success_count > 0:
                batch_op.mark_partial()
            else:
                batch_op.mark_failed()

            self.db.commit()

        except Exception as e:
            self.db.rollback()
            batch_op.mark_failed({"error": str(e)})
            self.db.commit()

        return batch_op.to_dict()

    def retry_import(self, batch_id: str, file_path: Optional[str] = None) -> Dict[str, Any]:
        prev_batch = self.db.query(BatchOperation).filter_by(id=batch_id).first()
        if not prev_batch:
            return {"error": "批次不存在"}

        if prev_batch.operation_type == "import_samples":
            return self.import_samples(
                file_path or prev_batch.file_name,
                prev_batch.operator_id,
                prev_batch.operator_name,
                retry_batch_id=batch_id
            )
        elif prev_batch.operation_type == "import_temperature":
            return self.import_temperature_records(
                file_path or prev_batch.file_name,
                prev_batch.operator_id,
                prev_batch.operator_name
            )
        elif prev_batch.operation_type == "import_waste":
            return self.import_waste_records(
                file_path or prev_batch.file_name,
                prev_batch.operator_id,
                prev_batch.operator_name
            )

        return {"error": "不支持的操作类型"}

    def get_batch_status(self, batch_id: str) -> Optional[Dict[str, Any]]:
        batch = self.db.query(BatchOperation).filter_by(id=batch_id).first()
        if not batch:
            return None
        return batch.to_dict()
