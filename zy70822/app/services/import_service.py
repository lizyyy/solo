import csv
import json
import uuid
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from io import StringIO
from sqlalchemy.orm import Session

from app.models import (
    AppointmentDB,
    VaccineInventoryDB,
    ContraindicationRuleDB,
    Appointment,
    VaccineInventory,
    ContraindicationRule
)


class ImportService:
    def __init__(self, db: Session):
        self.db = db

    def import_appointments_from_csv(self, csv_content: str) -> Dict[str, Any]:
        batch_id = f"appt_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        imported_count = 0
        errors = []
        appointments = []

        try:
            reader = csv.DictReader(StringIO(csv_content))
            for row_num, row in enumerate(reader, start=2):
                try:
                    appointment = self._parse_appointment_row(row, batch_id)
                    appointments.append(appointment)
                    imported_count += 1
                except Exception as e:
                    errors.append(f"行 {row_num}: {str(e)}")

            for appt in appointments:
                existing = self.db.query(AppointmentDB).filter(
                    AppointmentDB.appointment_id == appt.appointment_id
                ).first()
                if existing:
                    for key, value in appt.__dict__.items():
                        if not key.startswith('_'):
                            setattr(existing, key, value)
                else:
                    self.db.add(appt)

            self.db.commit()
        except Exception as e:
            self.db.rollback()
            raise e

        return {
            "batch_id": batch_id,
            "imported_count": imported_count,
            "errors": errors,
            "total_records": len(appointments)
        }

    def _parse_appointment_row(self, row: Dict[str, str], batch_id: str) -> AppointmentDB:
        def parse_date(date_str: str) -> date:
            for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%d-%m-%Y', '%d/%m/%Y']:
                try:
                    return datetime.strptime(date_str.strip(), fmt).date()
                except (ValueError, TypeError):
                    continue
            raise ValueError(f"无法解析日期: {date_str}")

        appointment_id = row.get('预约编号') or row.get('appointment_id') or row.get('id')
        if not appointment_id:
            raise ValueError("缺少预约编号")

        return AppointmentDB(
            appointment_id=appointment_id,
            child_name=row.get('儿童姓名') or row.get('child_name', ''),
            child_id_card=row.get('身份证号') or row.get('child_id_card', ''),
            birth_date=parse_date(row.get('出生日期') or row.get('birth_date', '')),
            vaccine_name=row.get('疫苗名称') or row.get('vaccine_name', ''),
            vaccine_batch=row.get('疫苗批次') or row.get('vaccine_batch', ''),
            appointment_date=parse_date(row.get('预约日期') or row.get('appointment_date', '')),
            appointment_time=row.get('预约时间') or row.get('appointment_time', ''),
            status=row.get('状态') or row.get('status', 'scheduled'),
            is_reschedule=(row.get('是否改签') or row.get('is_reschedule', 'false')).lower() in ['true', '1', '是'],
            original_appointment_id=row.get('原预约编号') or row.get('original_appointment_id'),
            reschedule_count=int(row.get('改签次数') or row.get('reschedule_count', 0) or 0),
            contact_phone=row.get('联系电话') or row.get('contact_phone', ''),
            address=row.get('住址') or row.get('address', ''),
            guardian_name=row.get('监护人姓名') or row.get('guardian_name', ''),
            remarks=row.get('备注') or row.get('remarks'),
            batch_id=batch_id
        )

    def import_inventory_from_json(self, json_content: str) -> Dict[str, Any]:
        batch_id = f"inv_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        imported_count = 0
        errors = []
        inventory_items = []

        try:
            data = json.loads(json_content)
            items = data if isinstance(data, list) else data.get('inventory', [])

            for idx, item in enumerate(items):
                try:
                    inventory = self._parse_inventory_item(item, batch_id)
                    inventory_items.append(inventory)
                    imported_count += 1
                except Exception as e:
                    errors.append(f"条目 {idx}: {str(e)}")

            for item in inventory_items:
                existing = self.db.query(VaccineInventoryDB).filter(
                    VaccineInventoryDB.vaccine_name == item.vaccine_name,
                    VaccineInventoryDB.vaccine_batch == item.vaccine_batch
                ).first()
                if existing:
                    for key, value in item.__dict__.items():
                        if not key.startswith('_'):
                            setattr(existing, key, value)
                else:
                    self.db.add(item)

            self.db.commit()
        except Exception as e:
            self.db.rollback()
            raise e

        return {
            "batch_id": batch_id,
            "imported_count": imported_count,
            "errors": errors,
            "total_records": len(inventory_items)
        }

    def _parse_inventory_item(self, item: Dict[str, Any], batch_id: str) -> VaccineInventoryDB:
        def parse_date(date_str: str) -> date:
            if isinstance(date_str, date):
                return date_str
            for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%d-%m-%Y', '%d/%m/%Y']:
                try:
                    return datetime.strptime(str(date_str).strip(), fmt).date()
                except (ValueError, TypeError):
                    continue
            raise ValueError(f"无法解析日期: {date_str}")

        vaccine_name = item.get('疫苗名称') or item.get('vaccine_name')
        if not vaccine_name:
            raise ValueError("缺少疫苗名称")

        available = int(item.get('可用数量') or item.get('available_quantity', 0))
        total = int(item.get('总数量') or item.get('total_quantity', available))

        return VaccineInventoryDB(
            vaccine_name=vaccine_name,
            vaccine_batch=item.get('疫苗批次') or item.get('vaccine_batch', ''),
            manufacturer=item.get('生产厂家') or item.get('manufacturer', ''),
            production_date=parse_date(item.get('生产日期') or item.get('production_date', '')),
            expiration_date=parse_date(item.get('有效期') or item.get('expiration_date', '')),
            total_quantity=total,
            used_quantity=int(item.get('已用数量') or item.get('used_quantity', 0)),
            reserved_quantity=int(item.get('预留数量') or item.get('reserved_quantity', 0)),
            available_quantity=available,
            min_stock_level=int(item.get('最低库存') or item.get('min_stock_level', 10)),
            location=item.get('存放位置') or item.get('location', ''),
            batch_id=batch_id
        )

    def import_rules_from_json(self, json_content: str) -> Dict[str, Any]:
        imported_count = 0
        errors = []
        rules = []

        try:
            data = json.loads(json_content)
            items = data if isinstance(data, list) else data.get('rules', [])

            for idx, item in enumerate(items):
                try:
                    rule = self._parse_rule_item(item)
                    rules.append(rule)
                    imported_count += 1
                except Exception as e:
                    errors.append(f"规则 {idx}: {str(e)}")

            for rule in rules:
                existing = self.db.query(ContraindicationRuleDB).filter(
                    ContraindicationRuleDB.rule_id == rule.rule_id
                ).first()
                if existing:
                    for key, value in rule.__dict__.items():
                        if not key.startswith('_'):
                            setattr(existing, key, value)
                else:
                    self.db.add(rule)

            self.db.commit()
        except Exception as e:
            self.db.rollback()
            raise e

        return {
            "imported_count": imported_count,
            "errors": errors,
            "total_records": len(rules)
        }

    def _parse_rule_item(self, item: Dict[str, Any]) -> ContraindicationRuleDB:
        rule_id = item.get('规则编号') or item.get('rule_id')
        if not rule_id:
            raise ValueError("缺少规则编号")

        return ContraindicationRuleDB(
            rule_id=rule_id,
            vaccine_name=item.get('疫苗名称') or item.get('vaccine_name', ''),
            rule_type=item.get('规则类型') or item.get('rule_type', ''),
            condition=item.get('条件') or item.get('condition', {}),
            description=item.get('描述') or item.get('description', ''),
            severity=item.get('严重程度') or item.get('severity', 'high'),
            action=item.get('处理方式') or item.get('action', ''),
            is_active=item.get('是否启用', True)
        )
