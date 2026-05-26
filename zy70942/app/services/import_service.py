import csv
import json
import uuid
from datetime import datetime
from io import StringIO, TextIOWrapper
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models import Waybill, TrackingRecord, PenaltyRule
from app.database import SessionLocal


class ImportService:
    def __init__(self, db: Session):
        self.db = db

    def import_waybills_from_csv(self, file_content: str, batch_id: Optional[str] = None) -> Dict[str, Any]:
        if batch_id is None:
            batch_id = f"WB_{datetime.now().strftime('%Y%m%d')}_{uuid.uuid4().hex[:8]}"

        errors = []
        success_count = 0
        total_count = 0

        try:
            reader = csv.DictReader(StringIO(file_content))

            for row_num, row in enumerate(reader, start=2):
                total_count += 1
                try:
                    waybill = self._parse_waybill_row(row, batch_id)
                    existing = self.db.query(Waybill).filter(
                        Waybill.waybill_no == waybill.waybill_no
                    ).first()

                    if existing:
                        self._update_waybill(existing, waybill)
                    else:
                        self.db.add(waybill)

                    success_count += 1

                    if success_count % 100 == 0:
                        self.db.commit()

                except Exception as e:
                    errors.append(f"行 {row_num}: {str(e)}")
                    self.db.rollback()

            self.db.commit()

        except Exception as e:
            errors.append(f"文件解析错误: {str(e)}")

        return {
            "success": len(errors) == 0,
            "total_count": total_count,
            "success_count": success_count,
            "failed_count": total_count - success_count,
            "errors": errors,
            "batch_id": batch_id
        }

    def _parse_waybill_row(self, row: Dict[str, str], batch_id: str) -> Waybill:
        def parse_datetime(value: str) -> Optional[datetime]:
            if not value:
                return None
            formats = [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d %H:%M",
                "%Y/%m/%d %H:%M:%S",
                "%Y/%m/%d %H:%M",
                "%Y-%m-%d",
                "%Y/%m/%d"
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(value, fmt)
                except ValueError:
                    continue
            return None

        def parse_float(value: str) -> Optional[float]:
            if not value:
                return None
            try:
                return float(value.replace(',', ''))
            except ValueError:
                return None

        def parse_int(value: str) -> Optional[int]:
            if not value:
                return None
            try:
                return int(value)
            except ValueError:
                return None

        waybill_no = row.get('运单号') or row.get('waybill_no') or row.get('waybillNumber')
        if not waybill_no:
            raise ValueError("缺少运单号")

        return Waybill(
            waybill_no=waybill_no.strip(),
            order_no=row.get('订单号') or row.get('order_no'),
            sender=row.get('发货人') or row.get('sender'),
            receiver=row.get('收货人') or row.get('receiver'),
            origin_city=row.get('出发城市') or row.get('origin_city') or row.get('出发地'),
            dest_city=row.get('目的城市') or row.get('dest_city') or row.get('目的地'),
            product_name=row.get('货物名称') or row.get('product_name') or row.get('品名'),
            weight=parse_float(row.get('重量') or row.get('weight')),
            volume=parse_float(row.get('体积') or row.get('volume')),
            quantity=parse_int(row.get('件数') or row.get('quantity')),
            declared_value=parse_float(row.get('声明价值') or row.get('declared_value')),
            freight=parse_float(row.get('运费') or row.get('freight')),
            planned_departure_time=parse_datetime(row.get('计划发车时间') or row.get('planned_departure')),
            planned_arrival_time=parse_datetime(row.get('计划到达时间') or row.get('planned_arrival')),
            actual_departure_time=parse_datetime(row.get('实际发车时间') or row.get('actual_departure')),
            actual_arrival_time=parse_datetime(row.get('实际到达时间') or row.get('actual_arrival')),
            transport_type=row.get('运输方式') or row.get('transport_type'),
            carrier=row.get('承运商') or row.get('carrier'),
            route_code=row.get('线路编码') or row.get('route_code'),
            damage_status=row.get('破损状态') or row.get('damage_status'),
            damage_description=row.get('破损描述') or row.get('damage_description'),
            batch_id=batch_id
        )

    def _update_waybill(self, existing: Waybill, new: Waybill):
        for attr in [
            'order_no', 'sender', 'receiver', 'origin_city', 'dest_city',
            'product_name', 'weight', 'volume', 'quantity', 'declared_value',
            'freight', 'planned_departure_time', 'planned_arrival_time',
            'actual_departure_time', 'actual_arrival_time', 'transport_type',
            'carrier', 'route_code', 'damage_status', 'damage_description'
        ]:
            new_value = getattr(new, attr)
            if new_value is not None:
                setattr(existing, attr, new_value)
        if new.batch_id:
            existing.batch_id = new.batch_id

    def import_tracking_from_json(self, json_content: str) -> Dict[str, Any]:
        errors = []
        success_count = 0
        total_count = 0

        try:
            data = json.loads(json_content)
            if isinstance(data, dict):
                records = data.get('records', [data])
            else:
                records = data

            for record in records:
                total_count += 1
                try:
                    tracking = self._parse_tracking_record(record)

                    waybill = self.db.query(Waybill).filter(
                        Waybill.waybill_no == tracking.waybill_no
                    ).first()

                    if waybill:
                        tracking.waybill_id = waybill.id

                    self.db.add(tracking)
                    success_count += 1

                    if success_count % 100 == 0:
                        self.db.commit()

                except Exception as e:
                    errors.append(f"记录 {total_count}: {str(e)}")
                    self.db.rollback()

            self.db.commit()

        except Exception as e:
            errors.append(f"JSON解析错误: {str(e)}")

        return {
            "success": len(errors) == 0,
            "total_count": total_count,
            "success_count": success_count,
            "failed_count": total_count - success_count,
            "errors": errors
        }

    def _parse_tracking_record(self, data: Dict[str, Any]) -> TrackingRecord:
        def parse_datetime(value: Any) -> Optional[datetime]:
            if not value:
                return None
            if isinstance(value, datetime):
                return value
            if isinstance(value, (int, float)):
                return datetime.fromtimestamp(value / 1000 if value > 10000000000 else value)
            formats = [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%dT%H:%M:%SZ",
                "%Y/%m/%d %H:%M:%S",
                "%Y-%m-%d %H:%M",
                "%Y-%m-%d"
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(str(value), fmt)
                except ValueError:
                    continue
            return None

        waybill_no = data.get('waybill_no') or data.get('waybillNumber') or data.get('运单号')
        if not waybill_no:
            raise ValueError("缺少运单号")

        timestamp = parse_datetime(data.get('timestamp') or data.get('time') or data.get('时间'))
        if not timestamp:
            raise ValueError("缺少时间戳")

        return TrackingRecord(
            waybill_no=waybill_no,
            timestamp=timestamp,
            location=data.get('location') or data.get('地点'),
            city=data.get('city') or data.get('城市'),
            status=data.get('status') or data.get('状态'),
            status_code=data.get('status_code') or data.get('状态码'),
            description=data.get('description') or data.get('描述'),
            operator=data.get('operator') or data.get('操作员'),
            transfer_station=data.get('transfer_station') or data.get('中转站'),
            is_transfer_point=bool(data.get('is_transfer_point', False)),
            scan_type=data.get('scan_type') or data.get('扫描类型')
        )

    def import_penalty_rules(self, rules_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        errors = []
        success_count = 0
        total_count = 0

        for rule_data in rules_data:
            total_count += 1
            try:
                rule = PenaltyRule(
                    rule_code=rule_data['rule_code'],
                    rule_name=rule_data['rule_name'],
                    rule_type=rule_data['rule_type'],
                    penalty_type=rule_data.get('penalty_type'),
                    calculation_method=rule_data.get('calculation_method'),
                    base_value=rule_data.get('base_value'),
                    percentage=rule_data.get('percentage'),
                    min_penalty=rule_data.get('min_penalty'),
                    max_penalty=rule_data.get('max_penalty'),
                    threshold_hours=rule_data.get('threshold_hours'),
                    conditions=rule_data.get('conditions'),
                    exempt_conditions=rule_data.get('exempt_conditions'),
                    priority=rule_data.get('priority', 0),
                    description=rule_data.get('description')
                )

                existing = self.db.query(PenaltyRule).filter(
                    PenaltyRule.rule_code == rule.rule_code
                ).first()

                if existing:
                    for attr in ['rule_name', 'rule_type', 'penalty_type', 'calculation_method',
                                 'base_value', 'percentage', 'min_penalty', 'max_penalty',
                                 'threshold_hours', 'conditions', 'exempt_conditions',
                                 'priority', 'description']:
                        setattr(existing, attr, getattr(rule, attr))
                    existing.is_active = True
                else:
                    self.db.add(rule)

                success_count += 1

            except Exception as e:
                errors.append(f"规则 {total_count}: {str(e)}")

        self.db.commit()

        return {
            "success": len(errors) == 0,
            "total_count": total_count,
            "success_count": success_count,
            "failed_count": total_count - success_count,
            "errors": errors
        }
