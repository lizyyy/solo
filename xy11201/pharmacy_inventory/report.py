import csv
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from io import StringIO

from .models import Database, InventoryRecord


class ReportGenerator:
    def __init__(self, db: Database = None):
        self.db = db or Database()

    def query_records(self, receiver: str = None, status: str = None,
                      start_time: datetime = None, end_time: datetime = None,
                      abnormal_type: str = None, product_type: str = None) -> List[InventoryRecord]:
        return self.db.query_records(
            receiver=receiver,
            status=status,
            start_time=start_time,
            end_time=end_time,
            abnormal_type=abnormal_type,
            product_type=product_type
        )

    def generate_summary(self, records: List[InventoryRecord]) -> Dict[str, Any]:
        if not records:
            return {
                "total_count": 0,
                "by_status": {},
                "by_product_type": {},
                "by_abnormal_type": {},
                "by_receiver": {},
                "total_quantity": 0
            }

        by_status = {}
        by_product_type = {}
        by_abnormal_type = {}
        by_receiver = {}
        total_quantity = 0

        for record in records:
            by_status[record.status] = by_status.get(record.status, 0) + 1
            by_product_type[record.product_type] = by_product_type.get(record.product_type, 0) + 1
            by_abnormal_type[record.abnormal_type] = by_abnormal_type.get(record.abnormal_type, 0) + 1
            by_receiver[record.receiver] = by_receiver.get(record.receiver, 0) + 1
            total_quantity += record.quantity

        return {
            "total_count": len(records),
            "by_status": by_status,
            "by_product_type": by_product_type,
            "by_abnormal_type": by_abnormal_type,
            "by_receiver": by_receiver,
            "total_quantity": total_quantity
        }

    def export_to_csv(self, records: List[InventoryRecord], filepath: str = None) -> Optional[str]:
        if not records:
            return None

        fieldnames = [
            'ID', '批次号', '产品类型', '产品名称', '数量', '温度(℃)',
            '签收人', '签收时间', '是否破损', '破损描述', '状态',
            '异常类型', '处理人', '处理时间', '处理备注', '创建时间', '更新时间'
        ]

        output = StringIO() if filepath is None else open(filepath, 'w', newline='', encoding='utf-8-sig')
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()

        for record in records:
            writer.writerow({
                'ID': record.id,
                '批次号': record.batch_no,
                '产品类型': record.product_type,
                '产品名称': record.product_name,
                '数量': record.quantity,
                '温度(℃)': record.temperature,
                '签收人': record.receiver,
                '签收时间': record.receive_time.strftime('%Y-%m-%d %H:%M:%S') if record.receive_time else '',
                '是否破损': '是' if record.is_damaged else '否',
                '破损描述': record.damage_description,
                '状态': record.status,
                '异常类型': record.abnormal_type,
                '处理人': record.handler or '',
                '处理时间': record.handle_time.strftime('%Y-%m-%d %H:%M:%S') if record.handle_time else '',
                '处理备注': record.handle_notes,
                '创建时间': record.created_at.strftime('%Y-%m-%d %H:%M:%S') if record.created_at else '',
                '更新时间': record.updated_at.strftime('%Y-%m-%d %H:%M:%S') if record.updated_at else ''
            })

        if filepath is None:
            content = output.getvalue()
            output.close()
            return content
        else:
            output.close()
            return filepath

    def export_to_json(self, records: List[InventoryRecord], filepath: str = None) -> Optional[str]:
        if not records:
            return None

        data = {
            "summary": self.generate_summary(records),
            "records": [record.to_dict() for record in records]
        }

        if filepath:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return filepath
        else:
            return json.dumps(data, ensure_ascii=False, indent=2)

    def export_to_dict(self, records: List[InventoryRecord]) -> Dict[str, Any]:
        return {
            "summary": self.generate_summary(records),
            "records": [record.to_dict() for record in records]
        }
