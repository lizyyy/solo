import csv
import json
from datetime import datetime
from typing import List, Dict, Any
from models import BoxTransferRecord, TellerSchedule, ErrorRecord


class FileImporter:
    def __init__(self):
        self.supported_formats = {
            'csv': self._import_csv,
            'json': self._import_json
        }

    def import_transfers(self, file_path: str) -> List[BoxTransferRecord]:
        ext = file_path.split('.')[-1].lower()
        if ext not in self.supported_formats:
            raise ValueError(f"Unsupported file format: {ext}")
        return self.supported_formats[ext](file_path, 'transfers')

    def import_schedules(self, file_path: str) -> List[TellerSchedule]:
        ext = file_path.split('.')[-1].lower()
        if ext not in self.supported_formats:
            raise ValueError(f"Unsupported file format: {ext}")
        return self.supported_formats[ext](file_path, 'schedules')

    def import_errors(self, file_path: str) -> List[ErrorRecord]:
        ext = file_path.split('.')[-1].lower()
        if ext not in self.supported_formats:
            raise ValueError(f"Unsupported file format: {ext}")
        return self.supported_formats[ext](file_path, 'errors')

    def _import_csv(self, file_path: str, data_type: str) -> List[Any]:
        records = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if data_type == 'transfers':
                    records.append(self._parse_transfer_csv(row))
                elif data_type == 'schedules':
                    records.append(self._parse_schedule_csv(row))
                elif data_type == 'errors':
                    records.append(self._parse_error_csv(row))
        return records

    def _import_json(self, file_path: str, data_type: str) -> List[Any]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        records = []
        items = data if isinstance(data, list) else data.get('data', [])
        for item in items:
            if data_type == 'transfers':
                records.append(self._parse_transfer_json(item))
            elif data_type == 'schedules':
                records.append(self._parse_schedule_json(item))
            elif data_type == 'errors':
                records.append(self._parse_error_json(item))
        return records

    def _parse_transfer_csv(self, row: Dict[str, str]) -> BoxTransferRecord:
        return BoxTransferRecord(
            transfer_id=row.get('transfer_id', row.get('交接编号', '')),
            box_id=row.get('box_id', row.get('尾箱编号', '')),
            transfer_date=row.get('transfer_date', row.get('交接日期', '')),
            transfer_time=row.get('transfer_time', row.get('交接时间', '')),
            sender_id=row.get('sender_id', row.get('移交人ID', '')),
            sender_name=row.get('sender_name', row.get('移交人姓名', '')),
            receiver_id=row.get('receiver_id', row.get('接收人ID', '')),
            receiver_name=row.get('receiver_name', row.get('接收人姓名', '')),
            cash_amount=float(row.get('cash_amount', row.get('现金金额', 0)) or 0),
            check_amount=float(row.get('check_amount', row.get('支票金额', 0)) or 0),
            total_amount=float(row.get('total_amount', row.get('总金额', 0)) or 0),
            first_signatory=row.get('first_signatory', row.get('第一签核人')),
            second_signatory=row.get('second_signatory', row.get('第二签核人')),
            first_sign_time=row.get('first_sign_time', row.get('第一签核时间')),
            second_sign_time=row.get('second_sign_time', row.get('第二签核时间')),
            remarks=row.get('remarks', row.get('备注'))
        )

    def _parse_schedule_csv(self, row: Dict[str, str]) -> TellerSchedule:
        return TellerSchedule(
            teller_id=row.get('teller_id', row.get('柜员ID', '')),
            teller_name=row.get('teller_name', row.get('柜员姓名', '')),
            date=row.get('date', row.get('日期', '')),
            shift=row.get('shift', row.get('班次', '')),
            is_working=row.get('is_working', row.get('是否上班', 'true')).lower() == 'true',
            assigned_box=row.get('assigned_box', row.get(' assigned_box'))
        )

    def _parse_error_csv(self, row: Dict[str, str]) -> ErrorRecord:
        return ErrorRecord(
            error_id=row.get('error_id', row.get('差错编号', '')),
            transfer_id=row.get('transfer_id', row.get('关联交接编号', '')),
            error_date=row.get('error_date', row.get('差错日期', '')),
            error_type=row.get('error_type', row.get('差错类型', '')),
            error_description=row.get('error_description', row.get('差错描述', '')),
            error_amount=float(row.get('error_amount', row.get('差错金额', 0)) or 0) if row.get('error_amount') or row.get('差错金额') else None,
            reporter_id=row.get('reporter_id', row.get('上报人ID', '')),
            reporter_name=row.get('reporter_name', row.get('上报人姓名', '')),
            status=row.get('status', row.get('状态', 'open')),
            resolution=row.get('resolution', row.get('处理结果'))
        )

    def _parse_transfer_json(self, item: Dict[str, Any]) -> BoxTransferRecord:
        return BoxTransferRecord(**item)

    def _parse_schedule_json(self, item: Dict[str, Any]) -> TellerSchedule:
        return TellerSchedule(**item)

    def _parse_error_json(self, item: Dict[str, Any]) -> ErrorRecord:
        return ErrorRecord(**item)

    @staticmethod
    def create_sample_files(output_dir: str = '.'):
        sample_transfers = [
            {
                "transfer_id": "T001",
                "box_id": "BOX-A01",
                "transfer_date": "2024-05-20",
                "transfer_time": "08:30:00",
                "sender_id": "U001",
                "sender_name": "张三",
                "receiver_id": "U002",
                "receiver_name": "李四",
                "cash_amount": 50000.00,
                "check_amount": 20000.00,
                "total_amount": 70000.00,
                "first_signatory": "U001",
                "second_signatory": "U003",
                "first_sign_time": "2024-05-20 08:31:00",
                "second_sign_time": "2024-05-20 08:32:00",
                "remarks": "正常早班交接"
            },
            {
                "transfer_id": "T002",
                "box_id": "BOX-A02",
                "transfer_date": "2024-05-20",
                "transfer_time": "17:30:00",
                "sender_id": "U002",
                "sender_name": "李四",
                "receiver_id": "U001",
                "receiver_name": "张三",
                "cash_amount": 45000.00,
                "check_amount": 25000.00,
                "total_amount": 69000.00,
                "first_signatory": "U002",
                "second_signatory": None,
                "first_sign_time": "2024-05-20 17:31:00",
                "second_sign_time": None,
                "remarks": "缺少第二签核"
            },
            {
                "transfer_id": "T003",
                "box_id": "BOX-A01",
                "transfer_date": "2024-05-21",
                "transfer_time": "08:25:00",
                "sender_id": "U001",
                "sender_name": "张三",
                "receiver_id": "U002",
                "receiver_name": "李四",
                "cash_amount": 55000.00,
                "check_amount": 15000.00,
                "total_amount": 70000.00,
                "first_signatory": "U001",
                "second_signatory": "U003",
                "first_sign_time": "2024-05-21 08:26:00",
                "second_sign_time": "2024-05-21 08:27:00",
                "remarks": "金额计算错误"
            }
        ]

        sample_schedules = [
            {
                "teller_id": "U001",
                "teller_name": "张三",
                "date": "2024-05-20",
                "shift": "早班",
                "is_working": True,
                "assigned_box": "BOX-A01"
            },
            {
                "teller_id": "U002",
                "teller_name": "李四",
                "date": "2024-05-20",
                "shift": "全天",
                "is_working": True,
                "assigned_box": "BOX-A02"
            },
            {
                "teller_id": "U003",
                "teller_name": "王五",
                "date": "2024-05-20",
                "shift": "晚班",
                "is_working": True,
                "assigned_box": None
            }
        ]

        sample_errors = [
            {
                "error_id": "E001",
                "transfer_id": "T002",
                "error_date": "2024-05-20",
                "error_type": "缺少双签",
                "error_description": "晚班交接缺少第二签核人确认",
                "error_amount": None,
                "reporter_id": "U003",
                "reporter_name": "王五",
                "status": "open",
                "resolution": None
            }
        ]

        with open(f"{output_dir}/sample_transfers.json", 'w', encoding='utf-8') as f:
            json.dump(sample_transfers, f, ensure_ascii=False, indent=2)

        with open(f"{output_dir}/sample_schedules.json", 'w', encoding='utf-8') as f:
            json.dump(sample_schedules, f, ensure_ascii=False, indent=2)

        with open(f"{output_dir}/sample_errors.json", 'w', encoding='utf-8') as f:
            json.dump(sample_errors, f, ensure_ascii=False, indent=2)

        return {
            "transfers": f"{output_dir}/sample_transfers.json",
            "schedules": f"{output_dir}/sample_schedules.json",
            "errors": f"{output_dir}/sample_errors.json"
        }
