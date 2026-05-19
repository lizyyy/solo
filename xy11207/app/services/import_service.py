import uuid
import json
import csv
from datetime import datetime
from typing import List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from app.models import (
    DeliveryOrder, DeliveryItem, TemperatureRecord, DeliveryPhoto,
    BadImportRecord, ImportBatch, ImportRecordStatus, AnomalyType
)
from app.utils.validators import DataValidator


class ImportService:
    def __init__(self, db: Session):
        self.db = db
        self.validator = DataValidator()

    def _create_import_batch(self, import_type: str, file_name: str, started_by: str = None) -> str:
        batch_id = f"IMP{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"
        batch = ImportBatch(
            id=batch_id,
            import_type=import_type,
            file_name=file_name,
            started_by=started_by
        )
        self.db.add(batch)
        self.db.flush()
        return batch_id

    def _save_bad_record(self, batch_id: str, import_type: str, position: str, raw_data: str,
                         error_message: str, suggested_fix: str = None):
        bad_record = BadImportRecord(
            import_batch_id=batch_id,
            import_type=import_type,
            original_position=position,
            raw_data=raw_data,
            error_message=error_message,
            suggested_fix=suggested_fix
        )
        self.db.add(bad_record)

    def _complete_batch(self, batch_id: str, total_records: int, success_count: int, failed_count: int):
        batch = self.db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
        if batch:
            batch.total_records = total_records
            batch.success_count = success_count
            batch.failed_count = failed_count
            batch.status = ImportRecordStatus.SUCCESS if failed_count == 0 else ImportRecordStatus.FAILED
            batch.completed_at = datetime.now()
        self.db.commit()

    def import_delivery_orders_from_csv(self, file_path: str, file_name: str,
                                         started_by: str = None) -> Dict[str, Any]:
        batch_id = self._create_import_batch("delivery_order", file_name, started_by)
        success_count = 0
        failed_count = 0
        successful_ids = []
        row_number = 0

        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
                total_records = len(rows)

                for row in rows:
                    row_number += 1
                    raw_data = json.dumps(row, ensure_ascii=False)
                    errors = []
                    validated_data = {}

                    valid, error = self.validator.validate_order_number(row.get('order_number', ''))
                    if not valid:
                        errors.append(f"订单号: {error}")
                    else:
                        validated_data['order_number'] = row['order_number'].strip()

                    valid, error = self.validator.validate_supplier_name(row.get('supplier_name', ''))
                    if not valid:
                        errors.append(f"供应商名称: {error}")
                    else:
                        validated_data['supplier_name'] = row['supplier_name'].strip()

                    valid, error, delivery_date = self.validator.validate_date(
                        row.get('delivery_date', ''), "配送日期"
                    )
                    if not valid:
                        errors.append(f"配送日期: {error}")
                    else:
                        validated_data['delivery_date'] = delivery_date

                    valid, error, product_code = self.validator.validate_product_code(
                        row.get('product_code', '')
                    )
                    if not valid:
                        errors.append(f"产品编码: {error}")
                    else:
                        validated_data['product_code'] = product_code

                    valid, error, product_name = self.validator.validate_product_name(
                        row.get('product_name', '')
                    )
                    if not valid:
                        errors.append(f"产品名称: {error}")
                    else:
                        validated_data['product_name'] = product_name

                    valid, error, batch_number = self.validator.validate_batch_number(
                        row.get('batch_number', '')
                    )
                    if not valid:
                        errors.append(f"批号: {error}")
                    else:
                        validated_data['batch_number'] = batch_number

                    valid, error, quantity = self.validator.validate_quantity(row.get('quantity'))
                    if not valid:
                        errors.append(f"数量: {error}")
                    else:
                        validated_data['quantity'] = quantity

                    valid, error, expiry_date = self.validator.validate_date(
                        row.get('expiry_date', ''), "有效期"
                    )
                    if not valid:
                        errors.append(f"有效期: {error}")
                    else:
                        validated_data['expiry_date'] = expiry_date

                    if row.get('manufacture_date'):
                        valid, error, manufacture_date = self.validator.validate_date(
                            row.get('manufacture_date', ''), "生产日期"
                        )
                        if not valid:
                            errors.append(f"生产日期: {error}")
                        else:
                            validated_data['manufacture_date'] = manufacture_date

                    if errors:
                        failed_count += 1
                        error_message = "; ".join(errors)
                        suggested_fix = self.validator.suggest_fix(error_message, "数据行", raw_data)
                        self._save_bad_record(
                            batch_id, "delivery_order",
                            f"第{row_number}行", raw_data, error_message, suggested_fix
                        )
                        continue

                    try:
                        existing_order = self.db.query(DeliveryOrder).filter(
                            DeliveryOrder.order_number == validated_data['order_number']
                        ).first()

                        if existing_order:
                            order = existing_order
                        else:
                            order = DeliveryOrder(
                                order_number=validated_data['order_number'],
                                supplier_name=validated_data['supplier_name'],
                                delivery_date=validated_data['delivery_date'],
                                total_items=0
                            )
                            self.db.add(order)
                            self.db.flush()

                        item = DeliveryItem(
                            delivery_order_id=order.id,
                            product_code=validated_data['product_code'],
                            product_name=validated_data['product_name'],
                            batch_number=validated_data['batch_number'],
                            quantity=validated_data['quantity'],
                            unit=row.get('unit', '盒'),
                            manufacture_date=validated_data.get('manufacture_date'),
                            expiry_date=validated_data['expiry_date'],
                            storage_condition=row.get('storage_condition'),
                            min_temperature=float(row['min_temperature']) if row.get('min_temperature') else None,
                            max_temperature=float(row['max_temperature']) if row.get('max_temperature') else None,
                            remarks=row.get('remarks')
                        )
                        self.db.add(item)
                        self.db.flush()

                        order.total_items += 1
                        success_count += 1
                        successful_ids.append(order.id)

                    except Exception as e:
                        failed_count += 1
                        self._save_bad_record(
                            batch_id, "delivery_order",
                            f"第{row_number}行", raw_data,
                            f"保存失败: {str(e)}",
                            "请检查数据完整性后重试"
                        )

            self.db.commit()
            self._complete_batch(batch_id, total_records, success_count, failed_count)

        except Exception as e:
            self.db.rollback()
            raise e

        return {
            "batch_id": batch_id,
            "total_records": total_records,
            "success_count": success_count,
            "failed_count": failed_count,
            "successful_ids": successful_ids
        }

    def import_temperature_records_from_json(self, file_path: str, file_name: str,
                                              started_by: str = None) -> Dict[str, Any]:
        batch_id = self._create_import_batch("temperature", file_name, started_by)
        success_count = 0
        failed_count = 0
        successful_ids = []
        record_number = 0

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                records = data if isinstance(data, list) else data.get('records', [])
                total_records = len(records)

                for record in records:
                    record_number += 1
                    raw_data = json.dumps(record, ensure_ascii=False)
                    errors = []
                    validated_data = {}

                    valid, error = self.validator.validate_order_number(record.get('order_number', ''))
                    if not valid:
                        errors.append(f"订单号: {error}")
                    else:
                        validated_data['order_number'] = record['order_number'].strip()

                    valid, error, record_time = self.validator.validate_date(
                        record.get('record_time', ''), "记录时间"
                    )
                    if not valid:
                        errors.append(f"记录时间: {error}")
                    else:
                        validated_data['record_time'] = record_time

                    valid, error, temperature = self.validator.validate_temperature(record.get('temperature'))
                    if not valid:
                        errors.append(f"温度: {error}")
                    else:
                        validated_data['temperature'] = temperature

                    valid, error, humidity = self.validator.validate_humidity(record.get('humidity'))
                    if not valid:
                        errors.append(f"湿度: {error}")

                    if errors:
                        failed_count += 1
                        error_message = "; ".join(errors)
                        suggested_fix = self.validator.suggest_fix(error_message, "温度记录", raw_data)
                        self._save_bad_record(
                            batch_id, "temperature",
                            f"第{record_number}条", raw_data, error_message, suggested_fix
                        )
                        continue

                    try:
                        order = self.db.query(DeliveryOrder).filter(
                            DeliveryOrder.order_number == validated_data['order_number']
                        ).first()

                        if not order:
                            failed_count += 1
                            self._save_bad_record(
                                batch_id, "temperature",
                                f"第{record_number}条", raw_data,
                                f"订单号不存在: {validated_data['order_number']}",
                                "请先导入对应到货单，或检查订单号是否正确"
                            )
                            continue

                        is_anomaly = False
                        anomaly_type = None
                        for item in order.items:
                            if item.min_temperature is not None and temperature < item.min_temperature:
                                is_anomaly = True
                                anomaly_type = AnomalyType.TEMPERATURE_LOW
                                break
                            if item.max_temperature is not None and temperature > item.max_temperature:
                                is_anomaly = True
                                anomaly_type = AnomalyType.TEMPERATURE_HIGH
                                break

                        temp_record = TemperatureRecord(
                            delivery_order_id=order.id,
                            record_time=validated_data['record_time'],
                            temperature=validated_data['temperature'],
                            humidity=humidity,
                            device_id=record.get('device_id'),
                            location=record.get('location'),
                            is_anomaly=is_anomaly,
                            anomaly_type=anomaly_type,
                            remarks=record.get('remarks')
                        )
                        self.db.add(temp_record)
                        self.db.flush()

                        if is_anomaly:
                            order.anomaly_count += 1

                        success_count += 1
                        successful_ids.append(temp_record.id)

                    except Exception as e:
                        failed_count += 1
                        self._save_bad_record(
                            batch_id, "temperature",
                            f"第{record_number}条", raw_data,
                            f"保存失败: {str(e)}",
                            "请检查数据完整性后重试"
                        )

            self.db.commit()
            self._complete_batch(batch_id, total_records, success_count, failed_count)

        except Exception as e:
            self.db.rollback()
            raise e

        return {
            "batch_id": batch_id,
            "total_records": total_records,
            "success_count": success_count,
            "failed_count": failed_count,
            "successful_ids": successful_ids
        }

    def import_photo_list(self, file_path: str, file_name: str,
                           started_by: str = None) -> Dict[str, Any]:
        batch_id = self._create_import_batch("photo", file_name, started_by)
        success_count = 0
        failed_count = 0
        successful_ids = []
        record_number = 0

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                if file_path.endswith('.json'):
                    data = json.load(f)
                    records = data if isinstance(data, list) else data.get('photos', [])
                else:
                    reader = csv.DictReader(f)
                    records = list(reader)

                total_records = len(records)

                for record in records:
                    record_number += 1
                    raw_data = json.dumps(record, ensure_ascii=False)
                    errors = []
                    validated_data = {}

                    valid, error = self.validator.validate_order_number(record.get('order_number', ''))
                    if not valid:
                        errors.append(f"订单号: {error}")
                    else:
                        validated_data['order_number'] = record['order_number'].strip()

                    if not record.get('file_name') or not str(record['file_name']).strip():
                        errors.append("文件名不能为空")
                    else:
                        validated_data['file_name'] = str(record['file_name']).strip()

                    if not record.get('file_path') or not str(record['file_path']).strip():
                        errors.append("文件路径不能为空")
                    else:
                        validated_data['file_path'] = str(record['file_path']).strip()

                    if errors:
                        failed_count += 1
                        error_message = "; ".join(errors)
                        suggested_fix = self.validator.suggest_fix(error_message, "照片记录", raw_data)
                        self._save_bad_record(
                            batch_id, "photo",
                            f"第{record_number}条", raw_data, error_message, suggested_fix
                        )
                        continue

                    try:
                        order = self.db.query(DeliveryOrder).filter(
                            DeliveryOrder.order_number == validated_data['order_number']
                        ).first()

                        if not order:
                            failed_count += 1
                            self._save_bad_record(
                                batch_id, "photo",
                                f"第{record_number}条", raw_data,
                                f"订单号不存在: {validated_data['order_number']}",
                                "请先导入对应到货单，或检查订单号是否正确"
                            )
                            continue

                        photo = DeliveryPhoto(
                            delivery_order_id=order.id,
                            file_name=validated_data['file_name'],
                            file_path=validated_data['file_path'],
                            file_size=int(record['file_size']) if record.get('file_size') else None,
                            photo_type=record.get('photo_type'),
                            uploaded_by=started_by,
                            description=record.get('description'),
                            is_anomaly_evidence=record.get('is_anomaly_evidence', 'false').lower() == 'true'
                        )
                        self.db.add(photo)
                        self.db.flush()

                        success_count += 1
                        successful_ids.append(photo.id)

                    except Exception as e:
                        failed_count += 1
                        self._save_bad_record(
                            batch_id, "photo",
                            f"第{record_number}条", raw_data,
                            f"保存失败: {str(e)}",
                            "请检查数据完整性后重试"
                        )

            self.db.commit()
            self._complete_batch(batch_id, total_records, success_count, failed_count)

        except Exception as e:
            self.db.rollback()
            raise e

        return {
            "batch_id": batch_id,
            "total_records": total_records,
            "success_count": success_count,
            "failed_count": failed_count,
            "successful_ids": successful_ids
        }

    def get_bad_records(self, batch_id: str = None, import_type: str = None,
                         is_resolved: bool = None) -> List[BadImportRecord]:
        query = self.db.query(BadImportRecord)
        if batch_id:
            query = query.filter(BadImportRecord.import_batch_id == batch_id)
        if import_type:
            query = query.filter(BadImportRecord.import_type == import_type)
        if is_resolved is not None:
            query = query.filter(BadImportRecord.is_resolved == is_resolved)
        return query.order_by(BadImportRecord.created_at.desc()).all()

    def resolve_bad_record(self, record_id: int, resolved_by: str, resolution_notes: str):
        record = self.db.query(BadImportRecord).filter(BadImportRecord.id == record_id).first()
        if not record:
            raise ValueError("记录不存在")
        record.is_resolved = True
        record.resolved_by = resolved_by
        record.resolved_at = datetime.now()
        record.resolution_notes = resolution_notes
        self.db.commit()
        return record

    def retry_import_batch(self, batch_id: str) -> Dict[str, Any]:
        bad_records = self.get_bad_records(batch_id=batch_id, is_resolved=False)
        if not bad_records:
            return {
                "batch_id": batch_id,
                "total_records": 0,
                "success_count": 0,
                "failed_count": 0,
                "successful_ids": [],
                "message": "没有待重试的记录"
            }

        success_count = 0
        failed_count = 0
        successful_ids = []

        for bad_record in bad_records:
            try:
                raw_data = json.loads(bad_record.raw_data)

                if bad_record.import_type == "delivery_order":
                    pass
                elif bad_record.import_type == "temperature":
                    pass
                elif bad_record.import_type == "photo":
                    pass

                success_count += 1
                bad_record.is_resolved = True
                bad_record.resolved_at = datetime.now()

            except Exception as e:
                failed_count += 1

        self.db.commit()

        return {
            "batch_id": batch_id,
            "total_records": len(bad_records),
            "success_count": success_count,
            "failed_count": failed_count,
            "successful_ids": successful_ids
        }
